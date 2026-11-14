"use strict";
// ===================== trigger preview + rule editor =====================
// Two halves: (1) the compact/detailed preview of every rule — progress bars, condition
// timelines, mini 3D/2D orientation and motion previews drawn per frame; (2) the rule editor
// with its live condition scopes, which mirrors the backend activation logic so the preview
// matches what the server will actually do. Also holds config import/export.

// ===================== PREVIEW: COMPACT / DETAILS =====================
function setDetailView(v){
  state.detailView=!!v;
  try{localStorage.setItem("ribbitflip.detailView",v?"1":"0");}catch(e){}
  renderRules(); renderOverview();
}
// Orientation choice in the cheat sheet — THE SAME state as the main widget (POSE.view2d), so the appearance and behavior
//  stay consistent; switching here also refreshes the select in the 3D preview.
function setOverviewView(v){
  POSE.view2d=!!v;
  try{localStorage.setItem("ribbitflip.pose2d",v?"1":"0");}catch(e){}
  const pm=document.getElementById("poseMode"); if(pm)pm.value=POSE.view2d?"2d":POSE.mode;
  renderOverview();
}
// Cheat sheet toolbar: "Preview" (Compact/Details) + "Orientation" (3D/2D) — same segments as the
// rest of the UI. Przycisk powrotu dochodzi TYLKO w osobnym oknie (?view=overview): w panelu ściąga
// jest zwykłą zakładką, więc wychodzi się z niej klikając inną — a „wróć" w zakładce sugerowałoby,
// że wejście w nią było wyjściem z czegoś.
function overviewBarHtml(){
  return `<div class="tr-viewbar">
    <span class="tr-viewbar-lbl">Podgląd:</span>
    <div class="seg seg-sm tr-viewseg" role="group" aria-label="Podgląd">
      <button type="button" aria-pressed="${state.detailView?'false':'true'}" class="${state.detailView?'':'on'}" onclick="setDetailView(false)" title="Najważniejsze + odliczanie">Kompakt</button>
      <button type="button" aria-pressed="${state.detailView?'true':'false'}" class="${state.detailView?'on':''}" onclick="setDetailView(true)" title="Wykresy spełnienia warunków + postęp">Szczegóły</button>
    </div>
    <span class="tr-viewbar-lbl" style="margin-left:16px">Orientacja:</span>
    <div class="seg seg-sm" role="group" aria-label="Orientacja">
      <button type="button" aria-pressed="${POSE.view2d?'false':'true'}" class="${POSE.view2d?'':'on'}" onclick="setOverviewView(false)" title="Kula orientacji 3D">3D</button>
      <button type="button" aria-pressed="${POSE.view2d?'true':'false'}" class="${POSE.view2d?'on':''}" onclick="setOverviewView(true)" title="Inklinometr 2D — pochylenie + obrót">2D</button>
    </div>
    <span class="tr-viewbar-lbl" style="margin-left:16px">Model:</span>
    <div class="seg seg-sm" role="group" aria-label="Model">
      <button type="button" aria-pressed="${POSE.ball==='kapsel'?'false':'true'}" class="${POSE.ball==='kapsel'?'':'on'}" onclick="setPoseBall('kula')" title="Kula z siatką osi">Kula</button>
      <button type="button" aria-pressed="${POSE.ball==='kapsel'?'true':'false'}" class="${POSE.ball==='kapsel'?'on':''}" onclick="setPoseBall('kapsel')" title="Model kapsla — strzałka cyjan to przód">Kapsel</button>
    </div>
    ${(typeof IS_OVERVIEW!=="undefined"&&IS_OVERVIEW)
      ? `<button class="btn ov-back" onclick="goHome()" title="Otwórz pełny panel w tym oknie">← Pełny panel</button>` : ""}</div>`;
}
// Kliknięcie w znak firmowy (a w oknie ?view=overview także przycisk pod ściągą): wróć na
// pierwszą zakładkę, a w osobnym oknie ściągi — wczytaj w nim pełny panel. Od 2026-08-27 nie ma
// tu już nic do "wyłączania": ściąga jest zakładką, a nie osobnym ekranem chowającym panel.
function goHome(){
  if(typeof IS_OVERVIEW!=="undefined"&&IS_OVERVIEW){location.href="/";return;}
  try{const t=document.querySelector('.tab-btn[data-tab]');if(t)t.click();}catch(e){}
  try{window.scrollTo({top:0,behavior:"smooth"});}catch(e){}
}

function detailToggleHtml(){
  return `<div class="tr-viewbar"><span class="tr-viewbar-lbl">Podgląd:</span>
    <div class="seg seg-sm tr-viewseg" role="group" aria-label="Podgląd">
      <button type="button" aria-pressed="${state.detailView?'false':'true'}" class="${state.detailView?'':'on'}" onclick="setDetailView(false)" title="Najważniejsze + odliczanie">Kompakt</button>
      <button type="button" aria-pressed="${state.detailView?'true':'false'}" class="${state.detailView?'on':''}" onclick="setDetailView(true)" title="Wykresy spełnienia warunków + postęp">Szczegóły</button>
    </div></div>`;
}
// BEHAVIOR progress for the row (compact + details): countdown/elapsed + stage label
function progRowHtml(dev, r){
  if((r.behavior||"once")==="once")return "";   // one-shot: no time counting
  return `<div class="tr-prog idle" data-dev="${esc(dev)}" data-rule="${esc(r.id)}">`+
    `<span class="tr-prog-tx">—</span><span class="tr-prog-track"><span class="tr-prog-bar"></span></span></div>`;
}
function detailHtml(dev, r){
  const n=1+((r.extraConditions||[]).length);
  return `<div class="tr-detail"><div class="tr-detail-cap">warunki w czasie (~6 s)</div>`+
    `<canvas class="tr-detail-scope" data-dev="${esc(dev)}" data-rule="${esc(r.id)}" style="height:${Math.max(34,n*26+8)}px"></canvas></div>`;
}
// behavior state/stage -> {label, frac (0..1 bar fill), cls}
function behStage(r, rt, dev){
  const beh=r.behavior||"once", active=!!(rt&&rt.active), D=state.devices[dev];
  if(beh==="multi"||beh==="taps"){
    const tap=(beh==="taps");
    const sp=D&&D.seqProg&&D.seqProg[r.id], need=Math.max(tap?1:2,r.crossings||(tap?1:2)), win=Math.max(100,r.windowMs||600);
    if(sp){const remain=sp[2]; return {label:`⏱ ${sp[0]}/${sp[1]} · ${(remain/1000).toFixed(1)}s`, frac:Math.max(0,Math.min(1,remain/win)), cls:"counting"};}
    return {label:`0/${need} ${tap?"puknięć":"przekroczeń"}`, frac:0, cls:"idle"};
  }
  if(beh==="dwell"){
    const need=(r.dwellMs!=null?r.dwellMs:500)/1000;
    if(active&&rt.overSince){const el=Math.max(0,(state.clockNow||state.nowTs)-rt.overSince), fr=Math.min(1,el/need);
      return {label: fr>=1?"⚡ aktywowano":`spełnione · ${Math.max(0,need-el).toFixed(1)}s`, frac:fr, cls: fr>=1?"done":"counting"};}
    return {label:`czeka (${need.toFixed(1)}s nieprzerwanie)`, frac:0, cls:"idle"};
  }
  if(beh==="continuous")return {label: active?`↻ co ${r.intervalMs||100} ms`:"poniżej progu", frac: active?1:0, cls: active?"done":"idle"};
  if(beh==="hold")return {label: active?"⬇ trzymane":"zwolnione", frac: active?1:0, cls: active?"done":"idle"};
  // For a latch, "active" is not "the condition holds right now" but "the switch is on" — the
  // whole difference between this behaviour and the others, so the word has to say so.
  if(beh==="latch")return {label: active?_gl("⏻ włączony","⏻ on"):_gl("⏻ wyłączony","⏻ off"), frac: active?1:0, cls: active?"done":"idle"};
  return {label: active?"⚡ aktywne":"—", frac: active?1:0, cls: active?"done":"idle"};
}
function condShortLabel(src){return ruleSrcLabel({source:src||{}});}
// Detailed timeline: VALUE of each condition over time + threshold line(s) + range,
//   trace colored green at moments when the condition is MET (color change based on activity).
//   Value data from D.valBuf (pv stream, all slots); current states from D.rt[id].conds.
function drawCondTimeline(c, dev, r){
  const D=state.devices[dev]; if(!D)return;
  const ff=fit(c); if(!ff||!ff.w||!ff.h)return; const {ctx,w,h}=ff; ctx.clearRect(0,0,w,h);
  const conds=[{source:r.source,abs:r.abs,cmp:r.cmp,threshold:r.threshold,thresholdHi:r.thresholdHi,neg:r.neg,op:null}]
    .concat((r.extraConditions||[]));
  const n=conds.length, buf=(D.valBuf&&D.valBuf[r.id])||[], rt=D.rt[r.id]||{};
  const now=state.clockNow||state.nowTs, win=6, start=now-win, Pl=86;
  const rowH=(h-2)/Math.max(1,n), X=ts=>Pl+(ts-start)/win*(w-Pl-8);
  for(let i=0;i<n;i++){
    const y0=1+i*rowH, co=conds[i], src=co.source||{}, isBin=(src.kind==="button"||src.kind==="trigger"||src.kind==="gesture");
    const thr=+co.threshold||0, isRange=(co.cmp==="in"||co.cmp==="out"), hiT=(co.thresholdHi!=null?+co.thresholdHi:thr);
    let vmin,vmax;
    if(isBin){vmin=-0.15;vmax=1.15;}
    else{vmin=Math.min(thr,isRange?hiT:thr);vmax=Math.max(thr,isRange?hiT:thr);
      for(const smp of buf){if(smp[0]<start)continue;const v=smp[1]&&smp[1][i];if(v==null)continue;if(v<vmin)vmin=v;if(v>vmax)vmax=v;}
      if(vmax-vmin<1){vmin-=1;vmax+=1;}const pad=(vmax-vmin)*0.18;vmin-=pad;vmax+=pad;}
    const Y=v=>y0+rowH-3-((v-vmin)/((vmax-vmin)||1))*(rowH-6);
    const curSat=!!(rt.conds&&rt.conds[i]);
    // label (operator + NEGATE + source), color based on current satisfaction
    ctx.fillStyle=curSat?cv('--ok'):cv('--dim'); ctx.font="10px "+cv('--sans'); ctx.textAlign="left"; ctx.textBaseline="middle";
    const lab=(i>0?((co.op==="or"?"∨":"∧")+" "):"")+(co.neg?"¬":"")+condShortLabel(src);
    ctx.fillText(lab.length>15?lab.slice(0,14)+"…":lab, 2, y0+rowH/2);
    // Threshold line(s) / range bounds — WITH the number on them. The dashed line alone says
    // "somewhere here"; the point of watching this while playing is knowing how far off you are,
    // and that needs the figure the trace is being compared against, not just its height.
    if(!isBin){
      const dash=(v,txt)=>{
        ctx.strokeStyle="rgba(255,183,76,.55)";ctx.lineWidth=1;ctx.setLineDash([4,3]);
        ctx.beginPath();ctx.moveTo(Pl,Y(v));ctx.lineTo(w-5,Y(v));ctx.stroke();ctx.setLineDash([]);
        if(rowH>=22){                       // below that the figure would sit on top of the trace
          const s=(Math.abs(v)>=100?String(Math.round(v)):(+v).toFixed(1).replace(/\.0$/,""));
          ctx.font="9px "+cv('--mono');ctx.textAlign="right";ctx.textBaseline="bottom";
          const tw=ctx.measureText(s).width, ty=Math.max(y0+9,Math.min(y0+rowH-1,Y(v)-1));
          ctx.fillStyle=cv('--panel');ctx.globalAlpha=.75;
          ctx.fillRect(w-7-tw-2,ty-9,tw+4,10);ctx.globalAlpha=1;
          ctx.fillStyle="rgba(255,183,76,.95)";ctx.fillText(s,w-7,ty);
        }
      };
      dash(thr);
      if(isRange)dash(hiT);
    }
    // value trace — green segment when MET, gray when not
    let px=null,py=null,pv=null;
    for(const smp of buf){if(smp[0]<start)continue;const v=smp[1]&&smp[1][i];if(v==null){px=null;continue;}
      const x=X(smp[0]),yy=Y(v),sat=condSatAt(co,v);
      if(px!=null){ctx.strokeStyle=sat?cv('--ok'):cv('--dim');ctx.lineWidth=1.6;ctx.lineJoin="round";
        ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,yy);ctx.stroke();}
      px=x;py=yy;pv=v;}
    if(pv!=null){ctx.fillStyle=curSat?cv('--ok'):cv('--dim');ctx.beginPath();ctx.arc(w-5,Y(pv),2.6,0,7);ctx.fill();}
    if(i<n-1){ctx.strokeStyle="rgba(120,100,60,.16)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,Math.round(y0+rowH)+0.5);ctx.lineTo(w,Math.round(y0+rowH)+0.5);ctx.stroke();}
  }
}
// Per-controller orientation sphere (same visual language as the big drawPose3D widget),
// driven by the quaternion in the pv packet — so it works for every slot, active or not.
function drawMiniPose(c, pose, num){
  const ff=fit(c); if(!ff||!ff.w||!ff.h)return; const {ctx,w,h}=ff; ctx.clearRect(0,0,w,h);
  const cx=w/2, cy=h/2, scale=Math.min(w,h)*0.42;
  if(!pose||!Array.isArray(pose.quat)||pose.quat.length!==4){   // guard against NaN from an incomplete quaternion
    ctx.strokeStyle="rgba(120,100,60,.22)";ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,scale,0,7);ctx.stroke();
    ctx.fillStyle=cv('--dim');ctx.font="11px "+cv('--sans');ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(_cvT("brak orientacji"),cx,cy);return;}
  // Kamera i mapa osi z rf-14 (`poseViewMatrix`), czyli DOKŁADNIE ta sama, którą rysuje duża karta.
  // Wcześniej stała tu własna kopia macierzy i własny kąt kamery 0.95: oś kapsla wypadała tak samo,
  // ale południk zerowy (złota linia = obrót) był obrócony o 90°, więc miniatura i duża karta
  // pokazywały tę samą orientację inaczej. Lustro też jest wspólne, bo to ustawienie widoku,
  // a nie właściwość jednego kafla.
  const C=poseViewMatrix(poseMatrix(pose.quat)), mx=poseMirrorX();
  const P=v=>{const p=m_v(C,v);return {x:cx+mx*p[0]*scale,y:cy-p[1]*scale,z:p[2]};};
  // KAPSEL zamiast kuli (rf-14d): w nakładce wybór jest ustawieniem okna, w panelu — przeglądarki.
  // Skin kapsla tego kafla (płótno ma `data-dev`), nie tego z karty Czujnik.
  if(!(typeof poseBallIsCap==='function'&&poseBallIsCap()&&KAPSEL3D.draw(ctx,cx,cy,scale,C,mx,kapselSkinOf(c.dataset&&c.dataset.dev)))){
  const gr=ctx.createRadialGradient(cx-scale*0.35,cy-scale*0.35,scale*0.15,cx,cy,scale*1.15);
  gr.addColorStop(0,'#fdfaf2');gr.addColorStop(1,'#e6dcc6');
  ctx.fillStyle=gr;ctx.beginPath();ctx.arc(cx,cy,scale,0,7);ctx.fill();
  // The rim belongs to the BALL, not to the page: it is drawn on that cream gradient, in the same
  // literal cream-shadow the grid uses, and it has to stay dark on it whatever the page around is
  // doing. It used to be --line, which meant the overlay's "content only" look — where the ink goes
  // light so it can be seen on the game — rubbed the ball's edge out.
  ctx.strokeStyle='#b8ac90';ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,scale,0,7);ctx.stroke();
  // BATCH: instead of stroke() per segment (~750/sphere) -> 2 stroke()/curve (back, then front).
  //  This eliminates stutter in the "All" preview (N spheres x 60 fps).
  const curve=(pts,colF,colB,lw)=>{const pr=pts.map(P);ctx.lineWidth=lw;
    ctx.strokeStyle=colB;ctx.globalAlpha=0.18;ctx.beginPath();
    for(let i=1;i<pr.length;i++){const a=pr[i-1],b=pr[i];if(!(a.z>=-0.03&&b.z>=-0.03)){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}}
    ctx.stroke();
    ctx.strokeStyle=colF;ctx.globalAlpha=0.95;ctx.beginPath();
    for(let i=1;i<pr.length;i++){const a=pr[i-1],b=pr[i];if(a.z>=-0.03&&b.z>=-0.03){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}}
    ctx.stroke();ctx.globalAlpha=1;};
  const merid=d=>{const f=d*DEG2RAD,a=[];for(let i=0;i<=40;i++){const t=(-90+180*i/40)*DEG2RAD;a.push([Math.cos(t)*Math.cos(f),Math.cos(t)*Math.sin(f),Math.sin(t)]);}return a;};
  const paral=d=>{const t=d*DEG2RAD,a=[];for(let i=0;i<=48;i++){const f=360*i/48*DEG2RAD;a.push([Math.cos(t)*Math.cos(f),Math.cos(t)*Math.sin(f),Math.sin(t)]);}return a;};
  for(const lat of [-60,-30,0,30,60]) curve(paral(lat), lat===0?cv('--gx'):'#cdbfa6','#b8ac90', lat===0?1.6:1);
  for(let lon=0;lon<360;lon+=30) curve(merid(lon), lon===0?cv('--az'):'#cdbfa6','#b8ac90', lon===0?2:1);
  const pole=P([0,0,1]),pb=P([0,0,-1]),fr=P([1,0,0]);
  ctx.fillStyle='#a89a7d';ctx.globalAlpha=pb.z>0?0.45:0.9;ctx.beginPath();ctx.arc(pb.x,pb.y,scale*0.045,0,7);ctx.fill();
  ctx.fillStyle=cv('--az');ctx.globalAlpha=pole.z>0?1:0.4;ctx.beginPath();ctx.arc(pole.x,pole.y,scale*0.08,0,7);ctx.fill();   // puck axis (+Z)
  ctx.fillStyle=cv('--ax');ctx.globalAlpha=fr.z>0?1:0.35;ctx.beginPath();ctx.arc(fr.x,fr.y,scale*0.06,0,7);ctx.fill();        // front (X) — shows rotation
  ctx.globalAlpha=1;
  }
  // LICZBY POD KULĄ. `num===false` zdejmuje je — to jeden z drobiazgów, które nakładka wyłącza
  // per okno (`show["pose.num"]`, rf-41). Rysuje je płótno, więc nie da się ich schować stylem:
  // flaga musi dojechać tutaj. Brak argumentu znaczy „rysuj" — ściąga w panelu i każde wywołanie
  // sprzed 2026-09-01 zachowuje się jak dotąd.
  if(pose.tilt!=null&&num!==false){ctx.fillStyle=cv('--dim');ctx.font="10px "+cv('--mono');ctx.textAlign="left";ctx.textBaseline="bottom";
    ctx.fillText("tilt "+Math.round(pose.tilt)+"° · twist "+Math.round(pose.twist||0)+"°/s",6,h-4);ctx.textBaseline="alphabetic";}
}
// Per-controller 2D inclinometer ("either/or" alternative to the mini sphere) — SAME visual language
//  as the main drawPose2D: bubble=tilt, needle=rotation, rings at 30/60/90 deg. From pv quaternion.
function drawMiniPose2D(c, pose, num){
  const ff=fit(c); if(!ff||!ff.w||!ff.h)return; const {ctx,w,h}=ff; ctx.clearRect(0,0,w,h);
  const cx=w/2, cy=h/2, R=Math.min(w,h)*0.40;
  if(!pose||!Array.isArray(pose.quat)||pose.quat.length!==4){
    ctx.strokeStyle="rgba(120,100,60,.22)";ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.stroke();
    ctx.fillStyle=cv('--dim');ctx.font="11px "+cv('--sans');ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(_cvT("brak orientacji"),cx,cy);return;}
  const M=poseMatrix(pose.quat), ux=M[2], uy=M[5], fx=M[0], fy=M[3];   // puck axis (tilt) + front (azimuth)
  ctx.textAlign="center";ctx.textBaseline="middle";
  for(const deg of [30,60,90]){const rr=R*deg/90;
    ctx.strokeStyle=cv('--line');ctx.globalAlpha=deg===90?0.8:0.3;ctx.beginPath();ctx.arc(cx,cy,rr,0,7);ctx.stroke();}
  ctx.globalAlpha=1;
  ctx.strokeStyle=cv('--line');ctx.globalAlpha=0.25;ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(cx-R,cy);ctx.lineTo(cx+R,cy);ctx.moveTo(cx,cy-R);ctx.lineTo(cx,cy+R);ctx.stroke();ctx.globalAlpha=1;
  const az=Math.atan2(fy,fx);   // rotation needle (front azimuth)
  ctx.save();ctx.translate(cx,cy);ctx.rotate(-az);
  ctx.strokeStyle=cv('--ax');ctx.globalAlpha=0.9;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,R*0.16);ctx.lineTo(0,-R*0.88);ctx.stroke();
  ctx.fillStyle=cv('--ax');ctx.beginPath();ctx.moveTo(0,-R*0.88);ctx.lineTo(-4.5,-R*0.74);ctx.lineTo(4.5,-R*0.74);ctx.closePath();ctx.fill();
  ctx.restore();ctx.globalAlpha=1;
  const bx=cx+ux*R, by=cy-uy*R, tiltN=Math.min(1,(pose.tilt!=null?pose.tilt:0)/90);   // tilt bubble
  ctx.strokeStyle=cv('--az');ctx.globalAlpha=0.45;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(bx,by);ctx.stroke();ctx.globalAlpha=1;
  ctx.fillStyle=cv('--az');ctx.beginPath();ctx.arc(bx,by,5+4*tiltN,0,7);ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,.28)";ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle=cv('--dim');ctx.beginPath();ctx.arc(cx,cy,2.5,0,7);ctx.fill();
  // LICZBY POD KULĄ. `num===false` zdejmuje je — to jeden z drobiazgów, które nakładka wyłącza
  // per okno (`show["pose.num"]`, rf-41). Rysuje je płótno, więc nie da się ich schować stylem:
  // flaga musi dojechać tutaj. Brak argumentu znaczy „rysuj" — ściąga w panelu i każde wywołanie
  // sprzed 2026-09-01 zachowuje się jak dotąd.
  if(pose.tilt!=null&&num!==false){ctx.fillStyle=cv('--dim');ctx.font="10px "+cv('--mono');ctx.textAlign="left";ctx.textBaseline="bottom";
    ctx.fillText("tilt "+Math.round(pose.tilt)+"° · twist "+Math.round(pose.twist||0)+"°/s",6,h-4);ctx.textBaseline="alphabetic";}
}
// THE MOTION SETTINGS OF A CAPSULE NOBODY IS LOOKING AT.
// The cheat sheet draws every slot's stick / d-pad / mouse with the panel's own code, and that code
// needs the capsule's SETTINGS as well as its live position: the dead zone, the full deflection, one
// key at a time or diagonals, pad or keyboard. The panel holds those for the ACTIVE capsule only
// (state.mouse), and the live stream carries a position, not a configuration. So each slot's are
// read once over HTTP and kept on the device. Slowly on purpose: this is configuration — it changes
// when somebody changes it, not fifty times a second. (A read is also all an overlay window is
// allowed to do; see the fetch guard in rf-41.)
const _ovMouseAsk={};
function ovMotionCfg(D){
  const dev=D.meta.dev, t=(typeof performance!=="undefined"?performance.now():Date.now());
  if(!(_ovMouseAsk[dev]>t-3000)){
    _ovMouseAsk[dev]=t;
    fetch("/airmouse?dev="+encodeURIComponent(dev)).then(r=>r.json())
      .then(m=>{if(m&&!m.error)D.mouseCfg=m;}).catch(()=>{});
  }
  // Until the answer lands there is nothing honest to draw for another capsule — the active one's
  // dead zones are not this one's. The widget stays blank for that fraction of a second.
  return D.mouseCfg||((dev===state.activeDeviceId)?state.mouse:null);
}
// drag-resize height of 3D previews in the cheat sheet (shared height across all controllers)
function initOvResize(){
  let drag=null;
  document.addEventListener("pointerdown",e=>{
    const g=e.target&&e.target.closest&&e.target.closest(".ov-pose-grip"); if(!g)return;
    e.preventDefault(); drag={y0:e.clientY,h0:state.ovPoseH||160};
    try{g.setPointerCapture(e.pointerId);}catch(_){} document.body.style.cursor="ns-resize";
  });
  document.addEventListener("pointermove",e=>{ if(!drag)return;
    let h=Math.max(90,Math.min(520,Math.round(drag.h0+(e.clientY-drag.y0)))); state.ovPoseH=h;
    const wr=document.getElementById("overviewWrap"); if(wr)wr.style.setProperty("--ovPoseH",h+"px");
  });
  document.addEventListener("pointerup",()=>{ if(!drag)return; drag=null; document.body.style.cursor="";
    try{localStorage.setItem("ribbitflip.ovPoseH",state.ovPoseH);}catch(e){} });
}
// update all visible progress bars + timeline (from rAF)
function updateDetail(){
  // SCENA PODGLĄDU KOŁA — PRZED bramką poniżej, i to jest cała treść tego miejsca. Bramka
  // przepuszcza dalej wyłącznie zakładki Mapowanie i Kontroler (tam stoją listy reguł), a koło ma
  // od 2026-08-26 własną zakładkę — więc rysowanie wołane za bramką nie wykonywało się ANI RAZU
  // i podgląd w karcie był czarnym prostokątem. Osobny try/catch z tego samego powodu, co przy
  // pozostałych rysunkach: pętla klatek uzbraja się na KOŃCU frame(), więc jeden wyjątek tutaj
  // zatrzymałby cały panel.
  if(typeof whPreviewFrame==="function")try{whPreviewFrame();}
    catch(e){if(!updateDetail._wperr){updateDetail._wperr=1;console.error("[podgląd koła]",e);}}
  // "All" = overview-only screen (not a tab); the rule LISTS are two tabs now — Mapowanie holds the
  // keyboard/mouse rules and Kontroler the pad-button ones. Both draw the same .tr-prog rows, so
  // both have to be walked or a pad rule's progress bar would sit frozen in its own tab.
  const _tab=id=>{const p=document.getElementById(id);return (p&&p.classList.contains("active"))?p:null;};
  // ŚCIĄGA JEST TERAZ ZAKŁADKĄ („Nakładka"), a osobnym ekranem zostaje już tylko w oknie
  // `?view=overview` — więc pytanie „czy rysujemy ściągę" ma dwie odpowiedzi na „tak" i obie
  // muszą tu być. Wcześniej stała tu sama klasa `overview-only`; po przeniesieniu ściągi na
  // zakładkę wszystkie jej rysunki (orientacja, ruch, naciśnięcia, pad, koło) przestałyby się
  // odświeżać, bo tej klasy w panelu już nie ma.
  const onAll=document.body.classList.contains("overview-only")||!!_tab("tab-wszystkie");
  const _rules=onAll?null:(_tab("tab-mapowanie")||_tab("tab-kontroler"));
  if(!onAll&&!_rules)return;
  const root=onAll?document.getElementById("tab-wszystkie"):_rules;
  if(!root)return;
  root.querySelectorAll(".tr-prog[data-rule]").forEach(el=>{
    const dev=el.dataset.dev, rid=el.dataset.rule, D=state.devices[dev]; if(!D)return;
    const r=(D.rules||[]).find(x=>x.id===rid); if(!r)return;
    const stg=behStage(r, D.rt[rid], dev);
    const bar=el.querySelector(".tr-prog-bar"), tx=el.querySelector(".tr-prog-tx");
    // write to DOM ONLY on value change (without this, layout thrash every frame = stutter)
    const wpct=Math.round((stg.frac||0)*100);
    if(bar&&el._lw!==wpct){bar.style.width=wpct+"%";el._lw=wpct;}
    if(tx&&el._lt!==stg.label){tx.textContent=stg.label;el._lt=stg.label;}
    const cls="tr-prog "+stg.cls; if(el.className!==cls)el.className=cls;
  });
  if(onAll){   // orientation + motion control preview above each controller (cheat sheet)
    const drawP=POSE.view2d?drawMiniPose2D:drawMiniPose;   // 3D sphere <-> 2D inclinometer (choice in the cheat sheet bar)
    // Liczby pod kulą: w nakładce idą za jej własnym przełącznikiem, w panelu są zawsze (ściąga
    // pokazuje wszystkie kapsle naraz i nie należy do żadnego okna).
    const _poseNum=(typeof RF_OVL==="undefined"||!RF_OVL)
      ? true : !!(typeof OVL!=="undefined"&&OVL.cfg&&OVL.cfg.show&&OVL.cfg.show["pose.num"]);
    root.querySelectorAll(".ov-pose").forEach(c=>{ if(!c.offsetParent)return;
      const D=state.devices[c.dataset.dev]; if(!D)return;
      const tgt=D.poseLive;
      if(!tgt||!Array.isArray(tgt.quat)||tgt.quat.length!==4){drawP(c,tgt,_poseNum);return;}   // "no orientation" placeholder
      // INTERPOLATION (nlerp) every frame -> smooth rotation at 60 fps despite pv ~12 Hz (no more stutter)
      D._qd=D._qd?qnlerp(D._qd,tgt.quat,0.3):tgt.quat.slice();
      drawP(c,{quat:D._qd,tilt:tgt.tilt,twist:tgt.twist},_poseNum);});
    // Przód kapsla (rf-41e) — kropla w nakładce, rysowana tą samą pętlą co kula.
    if(typeof drawFrontAll==="function")drawFrontAll(root);
    // The overlay shows the widget whether motion control is on or not: there it is one of the
    // things being watched, and a box that appears and disappears under the player's eyes mid-game
    // is worse than a greyed one. In the panel it stays hidden until the group is on — in a
    // settings screen a permanently dead rectangle is just clutter.
    const _ovl=document.documentElement.classList.contains("rf-ovl");
    root.querySelectorAll(".ov-mouse").forEach(c=>{
      const D=state.devices[c.dataset.dev]; if(!D)return;
      const en=!!(D.mouseLive&&D.mouseLive.enabled);
      c.style.display=(en||_ovl)?"block":"none";
      if(!c.offsetParent)return;
      const cfg=ovMotionCfg(D); if(!cfg)return;
      // Drawn EVERY frame, with no "has the snapshot changed?" shortcut: this widget breathes —
      // the lit arrows pulse, the knob's halo beats at the rim, and with the group switched off the
      // sketch walks itself through the control. A cache keyed on the snapshot would freeze all of
      // that between packets.
      // One capsule's preview must never take the frame loop down with it (the loop re-arms itself
      // at the END of frame(), so one throw stops the whole panel). Reported once per canvas.
      // `|| {}` is load-bearing: a capsule that has never sent a motion snapshot would otherwise
      // hand the drawing `undefined`, which reads as "leave the global alone" — and the global is
      // the ACTIVE capsule's live position. This slot would then draw the other one's stick.
      try{drawMotionScope(c,{cfg:cfg,prev:D.mouseLive||{},conn:D.conn,ns:D.meta.dev+":"});}
      catch(e){if(!c._merr){c._merr=1;console.error("[podgląd ruchu "+D.meta.dev+"]",e);}}
    });
    // THE BUTTON: the figure first, the lane behind it. The figure is the live one — it counts up
    // while the button is down, then freezes on what the press came to — because "was that long
    // enough for the 600 ms trigger?" is a question a blinking lamp cannot answer. Written only on
    // change, like the progress bars above: this runs every frame.
    root.querySelectorAll(".ov-press").forEach(box=>{
      if(!box.offsetParent)return;                       // switched off, or a card that is not shown
      const D=state.devices[box.dataset.dev]; if(!D)return;
      const pr=D.btnPresses||[], last=pr[pr.length-1];
      const held=!!(last&&last.b==null);
      const now=Math.max(D.nowTs||0,(D.statusPkt&&D.statusPkt.ts)||0,state.nowTs||0);
      const ms=last?(((held?now:last.b)-last.a)*1000):null;
      const txt=(ms==null)?"–":_btnDur(Math.max(0,ms));
      const val=box.querySelector(".ov-press-val");
      if(val&&val._t!==txt){val.textContent=txt;val._t=txt;}
      if(box._h!==held){box.classList.toggle("held",held);box._h=held;}
      const lane=box.querySelector(".ov-press-lane");
      if(lane)try{drawOvPress(lane,D);}
        catch(e){if(!lane._perr){lane._perr=1;console.error("[naciśnięcia "+D.meta.dev+"]",e);}}
    });
    // THE VIRTUAL CONTROLLER (rf-42): rings on the mapped buttons, the pressed ones lit, the ones
    // that went nowhere in red. Its own try/catch for the same reason as the two above — the frame
    // loop re-arms at the END of frame(), so one throw in here would stop the whole panel.
    if(typeof gpvFrame==="function")try{gpvFrame(root);}
      catch(e){if(!updateDetail._gerr){updateDetail._gerr=1;console.error("[kontroler]",e);}}
    // KOŁO WYBORU (rf-46): w panelu stoi w kolumnie na stałe (przygaszone, złożone z konfiguracji
    // — wheelIdleState w rf-46g), a w chwili wybierania pokazuje żywy pakiet z silnika; nad grą
    // pojawia się dopiero na tę chwilę. Własny try/catch z tego samego powodu co
    // trzy wyżej: pętla klatek uzbraja się na KOŃCU frame(), więc jeden wyjątek tutaj zatrzymałby
    // cały panel.
    if(typeof wheelOverviewFrame==="function")try{wheelOverviewFrame(root);}
      catch(e){if(!updateDetail._werr){updateDetail._werr=1;console.error("[koło wyboru]",e);}}
  }
  if(state.detailView){
    root.querySelectorAll(".tr-detail-scope").forEach(c=>{
      if(!c.offsetParent)return;   // visible only
      const D=state.devices[c.dataset.dev]; if(!D)return;
      const r=(D.rules||[]).find(x=>x.id===c.dataset.rule); if(!r)return;
      drawCondTimeline(c, c.dataset.dev, r);
      const panel=c.closest(".tr-detail");   // state of the WHOLE rule: frame + header
      if(panel){const on=!!(D.rt[c.dataset.rule]&&D.rt[c.dataset.rule].active);
        panel.classList.toggle("over",on);
        const cap=panel.querySelector(".tr-detail-cap");
        if(cap)cap.textContent=(on?"● reguła AKTYWNA":"– reguła nieaktywna")+" · warunki w czasie (~6 s)";}
    });
  }
}

// --- rule editor ---
// FOKUS WCHODZI DO EDYTORA. Edytor jest inline (nie modalny), więc przeglądarka zostawiała fokus
// na przycisku „Nowy wyzwalacz” — pierwsze pole było o kilkanaście Tabów dalej, a po „Anuluj” fokus
// gubił się zupełnie, bo przycisk-nadawca bywa przerysowany. Pierwsze pole to „Etykieta” (tryb
// zaawansowany) albo lista gestów (tryb prosty); `preventScroll` — o przewinięcie dba
// `_padEditorIntoView` po stronie Kontrolera.
// WHY: the editor is inline, so focus stayed outside it; this puts it on the first field.
function _edFocusFirst(){
  const go=()=>{
    const el=document.getElementById("edLabel")||document.getElementById("edGesture");
    if(!el||document.activeElement===el)return true;
    void el.offsetWidth;                                   // wymuś przeliczenie stylu (patrz niżej)
    try{el.focus({preventScroll:true});}catch(e){}
    return document.activeElement===el;
  };
  // DRUGIE PODEJŚCIE PO KLATCE. `#ruleEditor` przechodzi z `display:none` na `block` w TYM SAMYM
  // zadaniu, w którym wołamy `focus()`; przy dużym drzewie Chromium potrafi jeszcze uważać pole za
  // „nierysowane" i wtedy `focus()` przepada BEZ BŁĘDU (zmierzone w tests/ux_walk_harness.cjs).
  // Stąd wymuszony odczyt geometrii, a gdy i on nie wystarczy — powtórka w następnej klatce.
  // WHY: the editor is unhidden in the same task as the focus() call, and Chromium can still treat
  // the field as "not being rendered", silently dropping the focus; retry once on the next frame.
  if(go())return;
  requestAnimationFrame(()=>{go();});
}
window._edFocusFirst=_edFocusFirst;
// ODDANIE FOKUSA PO ZAMKNIĘCIU. Ołówek wiersza bywa przerysowany przez `commitRules`, więc nadawca
// może już nie istnieć — wtedy wracamy na widoczny przycisk „Nowy wyzwalacz” tego ekranu.
// WHY: the row's pencil may have been re-rendered away; fall back to the visible "New trigger".
function _edReturnFocus(){
  const op=state._edOpener; state._edOpener=null;
  const vis=el=>!!(el&&document.contains(el)&&el.offsetParent!==null);
  let t=vis(op)?op:null;
  if(!t)for(const id of ["addRule","padRuleAdd"]){const b=document.getElementById(id);if(vis(b)){t=b;break;}}
  if(t)try{t.focus({preventScroll:true});}catch(e){}
}
// JEDEN WIDOK NARAZ (UX 261120, P-G1-04). Otwarty edytor oznacza kartę, w której akurat stoi,
// klasą `is-editing`, a CSS chowa przy niej to, co pod edytorem tylko przeszkadza (pusty start,
// pasek „Nowy wyzwalacz”). Klasa na HOŚCIE, nie na sztywno na #trigCard: Kontroler pożycza ten sam
// edytor (rf-43 przenosi #ruleEditor do siebie) i jego karta ma zostać taka, jaka była.
// `is-new` = szkic nowej reguły (wtedy przy pustym module schodzi też pusty dziennik).
function _edHostMark(on){
  document.querySelectorAll(".is-editing").forEach(el=>el.classList.remove("is-editing","is-new"));
  if(!on)return;
  const ed=document.getElementById("ruleEditor"), host=ed&&ed.closest(".card");
  if(!host)return;
  host.classList.add("is-editing");
  const d=state._draft;
  if(d&&!state.rules.some(x=>x.id===d.id))host.classList.add("is-new");
}
// NIEZAPISANY SZKIC NIE ZNIKA BEZ PYTANIA. „Nowy wyzwalacz" i „Edytuj" w wierszu nadpisywały
// `state._draft` w locie — kilka minut pracy nad warunkiem, jeden klik obok i wszystko przepadało
// bez słowa. `openEditor` jest teraz opakowaniem: gdy w edytorze stoi szkic RÓŻNY od migawki
// zrobionej przy otwarciu (`state._draftBase`), najpierw pyta. Samo otwieranie robi
// `_openEditorNow` — tak samo dla obu odpowiedzi, żeby była jedna droga do otwartego edytora.
// `after(d)` woła się po `renderEditor()` i po migawce: to miejsce dla USTAWIEŃ PROGRAMOWYCH
// (Kontroler celuje nową regułę w przycisk pada), które nie są zmianą wprowadzoną przez człowieka
// — callback odświeża migawkę, więc taki szkic dalej liczy się jako czysty.
// An unsaved draft is no longer wiped silently: the wrapper asks first, `after(d)` carries the
// programmatic pre-aim that must not count as a user edit.
// ZWRACA OBIETNICĘ `true/false` — „czy edytor NAPRAWDĘ się otworzył". Kto przestawił coś JESZCZE
// PRZED otwarciem (rf-12d `gestNewRule` — tryb nowej reguły czyta render, więc `after` jest za
// późno), cofa to na `false`: „Wróć do edycji" znaczy, że tych drzwi nikt nie otworzył.
function openEditor(rule,after){
  // KTO OTWORZYŁ EDYTOR. Zapisujemy TUTAJ, a nie w `_openEditorNow`, bo między jednym a drugim
  // stoi pytanie „Porzucić niezapisany wyzwalacz?” (4.3) — po nim fokusem jest przycisk dialogu,
  // który za chwilę zniknie z DOM. `closeEditor` i tak sprawdza, czy cel nadal jest widoczny.
  // WHY: recorded before the discard dialog, whose button would otherwise become the return target.
  const _op=document.activeElement;
  state._edOpener=(_op&&_op!==document.body)?_op:null;
  const dirty=!!(state._draft&&state.editing&&state._draftBase&&JSON.stringify(state._draft)!==state._draftBase);
  if(!dirty||typeof rfConfirm!=="function"){_openEditorNow(rule,after);return Promise.resolve(true);}
  return rfConfirm(_gl("Porzucić niezapisany wyzwalacz? Wpisane zmiany przepadną.",
                "Discard the unsaved trigger? Your edits will be lost."),
            {tone:"danger",confirmLabel:_gl("Porzuć","Discard"),cancelLabel:_gl("Wróć do edycji","Back to editing")})
    .then(ok=>{if(ok)_openEditorNow(rule,after);return !!ok;});
}
function _openEditorNow(rule,after){
  // NOWA REGUŁA ZACZYNA OD FILTRA 3D, NIE OD OSI. Poradnik nazywa „Filtr 3D" zalecanym na start,
  // a „Oś (CH)" — dla zaawansowanych; edytor otwierał się dokładnie na tej drugiej, z surowym
  // progiem 5000 LSB na CH0. Wartości są te same, które nakłada przycisk „Filtr 3D" w karcie
  // warunku niżej, żeby ręczne przełączenie tam i z powrotem dawało ten sam stan.
  //
  // AKCJA ZACZYNA PUSTA. Do tej pory było `keySpec:"right"`, czyli reguła rodziła się ze strzałką
  // w prawo — a podpowiedź pod „Gotowy gest" i poradnik mówią, że „akcję dopisujesz sam". Kto im
  // uwierzył, zapisywał regułę przekonany, że nie ma akcji, i dostawał wciśniętą strzałkę w grze.
  // Zapis pustej akcji odbija się o istniejące sprawdzenie w `saveDraft`.
  const base={id:"r"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),label:"",enabled:true,
    source:{kind:"filter",metric:"tilt"},abs:false,cmp:">",threshold:30,thresholdHi:null,neg:false,
    extraConditions:[],match:"all",
    // `noAction:false` = „jeszcze nie wybrałem akcji" (blokuje zapis), `true` = „świadomie nic nie
    // naciskam" (zapis przechodzi). Oba stany mają pusty `keySpec` — dlatego to osobne pole, rf-10.
    behavior:"once",intervalMs:100,crossings:2,windowMs:600,dwellMs:500,keySpec:"",noAction:false,sequence:"",glow:true,
    layer:0,   // „Zawsze" — a new rule works in every layer until somebody says otherwise
    toast:{on:false,mode:"fire",silent:true}};
  const d=rule?JSON.parse(JSON.stringify(rule)):base;
  d.extraConditions=d.extraConditions||[]; d.match=d.match||"all"; d.sequence=d.sequence||"";
  d.actionMode=d.sequence?"seq":"single";   // UI mode (not saved)
  state._gesturePick="";                    // „Wybierz z domyślnych" zaczyna pusty przy KAŻDYM otwarciu:
                                            // lista mówi, od jakiego gestu wyszła TA sesja edycji, a nie poprzednia
  state._draft=d;
  state.editing=state._draft.id;
  // TWO FACES OF ONE EDITOR (rf-12e): „Prosty — nagraj gest" and „Zaawansowany". A saved rule
  // opens in the mode that can show all of it; a new one in the mode last used.
  state._edMode=(typeof gestEditorModeFor==="function")?gestEditorModeFor(rule):"advanced";
  state._edAdvSource=null;
  state._edTile=null;                       // kafel startu (trigTileNew) ustawia go w `after`
  state._edRef=null;                        // L4e: odniesienie „zmienione” na piętrze 2 (tylko z kafla)
  renderEditor();
  document.getElementById("ruleEditor").style.display="block";
  _edHostMark(true);
  _edFocusFirst();
  // Migawka PO renderze: render dopisuje do szkicu pola pomocnicze (tryb, znormalizowany gest),
  // więc porównanie ze stanem sprzed renderu meldowałoby zmianę, której nikt nie wprowadził.
  state._draftBase=JSON.stringify(state._draft);
  if(typeof after==="function")try{after(state._draft);}catch(e){}
}
function closeEditor(){if(typeof stopSeqRec==="function")stopSeqRec();
  // A countdown left running would keep polling the cursor for a panel that no longer exists.
  if(typeof ptPickStop==="function")ptPickStop();
  if(state._pt){state._pt.open=false;state._pt.autoOpen=false;}
  // A gesture recording or trial left running would keep judging for an editor that is gone.
  if(typeof gestEditorClosed==="function")try{gestEditorClosed();}catch(e){}
  state.editing=null;state._draft=null;state._draftBase=null;state._learnBtn=null;state._edTile=null;
  document.getElementById("ruleEditor").style.display="none";
  _edHostMark(false);
  const ct=document.getElementById("condToast");if(ct)ct.style.display="none";
  _edReturnFocus();}
function behaviorFieldsHtml(d){
  if(d.behavior==="continuous"){
    // Reguła bez klawisza też powtarza — tyle że nie klawisz, a zdarzenie, którego po drugiej
    // stronie słucha moduł Usługi sieciowe. Stąd wyższa podłoga odstępu (ta sama, co na serwerze).
    const noa=(typeof ruleNoAction==="function")&&ruleNoAction(d)&&d.actionMode!=="seq";
    const lo=noa?NOACT_MIN_IV:10, iv=Math.max(lo,+d.intervalMs||100);
    return `<label class="fld col2">Interwał
      <input id="edIv" type="number" min="${lo}" max="5000" step="10" value="${iv}"> ms
      <input id="edIvRange" type="range" min="${lo}" max="2000" step="10" value="${Math.min(2000,iv)}">
      <span class="num" id="edIvVal">${iv}</span></label>`
      +(noa?`<div class="fld col2 ednoactnote">Bez klawisza odstęp nie schodzi poniżej 200 ms — powtarzane zdarzenie leci do odbiorcy, a nie do systemu.</div>`:"");
  }
  if(d.behavior==="hold"){
    // BEZ KLAWISZA „Przytrzymaj" NIE JEST POWTARZANIEM. Nie ma czego trzymać, więc reguła po
    // prostu ZOSTAJE aktywna, dopóki warunek trwa, i daje jedno zdarzenie na wejściu — dokładnie
    // to, czego potrzebuje warunek „Wyzwalacz" w innej regule i odbiorca w Usługach sieciowych.
    // Pole odstępu w tym wariancie nie ma zastosowania, więc go nie ma (i nie ma jak zalać).
    if((typeof ruleNoAction==="function")&&ruleNoAction(d)&&d.actionMode!=="seq")
      return `<div class="fld col2 ednoactnote">Bez klawisza nie ma czego trzymać: reguła pozostaje aktywna przez cały czas spełnienia warunku i zgłasza się raz, na wejściu. Powtarzanie daje zachowanie Ciągłe.</div>`;
    return `<div class="fld col2" style="color:var(--dim);line-height:1.5">Wciśnij i <b style="color:var(--ink)">TRZYMAJ</b> klawisz/przycisk dopóki wartość jest powyżej progu (puść po zejściu) — idealne do ruchu w grach (np. trzymaj W przy wychyle).
      Dla scroll/ruchu myszy (brak „trzymania”) = powtarzaj co
      <input id="edIv" type="number" min="10" max="2000" step="10" value="${d.intervalMs}" style="width:78px"> ms.</div>`;
  }
  if(d.behavior==="multi"){
    const isBtn=d.source&&d.source.kind==="button";
    return `<label class="fld">${isBtn?"Liczba kliknięć":"Liczba przekroczeń"}
        <input id="edCross" type="number" min="2" max="8" step="1" value="${d.crossings}"></label>
      <label class="fld">w oknie
        <input id="edWin" type="number" min="100" max="10000" step="50" value="${d.windowMs}"> ms</label>
      <div class="fld col2" style="color:var(--dim)">${isBtn
        ?"np. <b>2 = podwójny klik</b>, <b>3 = potrójny</b> — wszystkie w zadanym odstępie czasu."
        :"np. 3 = potrójne „stuknięcie” progu w zadanym czasie uruchamia akcję (jak 10101)."}</div>`;
  }
  if(d.behavior==="taps"){
    // Te same dwa pola, co przy „X razy w czasie" (te same `id`, więc te same nasłuchy) — różni je
    // sens liczby: tam „co najmniej N i strzelaj", tu „DOKŁADNIE N, decyzja na końcu okna".
    const isBtn=d.source&&d.source.kind==="button";
    return `<label class="fld">${isBtn?"Liczba puknięć":"Liczba przekroczeń"}
        <input id="edCross" type="number" min="1" max="8" step="1" value="${Math.max(1,d.crossings||1)}"></label>
      <label class="fld">w oknie
        <input id="edWin" type="number" min="100" max="10000" step="50" value="${d.windowMs}"> ms</label>
      <div class="fld col2" style="color:var(--dim);line-height:1.5">Akcja idzie DOPIERO na koniec okna i tylko wtedy, gdy puknięć było dokładnie tyle. Dzięki temu „1 puknięcie” i „2 puknięcia” mogą stać na jednym przycisku: pojedyncze czeka, czy nie przyjdzie drugie — i o tyle się spóźnia. Przytrzymanie nie liczy się jako puknięcie, więc „przytrzymaj” (Po odczekaniu) da się dołożyć obok.</div>`;
  }
  if(d.behavior==="dwell")
    return `<label class="fld col2">${_gl("Aktywuj po","Activate after")} <input id="edDwell" type="number" min="50" max="10000" step="50" value="${d.dwellMs!=null?d.dwellMs:500}"> ms <small style="color:var(--dim)">${_gl("nieprzerwanego spełnienia warunku (np. „w zakresie przez 1 s”)","of uninterrupted condition holding (e.g. “in range for 1 s”)")}</small></label>`;
  // The latch is the only behaviour whose point is what happens AFTER the gesture ends, so it is
  // also the only one that has to say where that state can be used — otherwise it looks like
  // "once" with a lamp that forgot to go out.
  if(d.behavior==="latch")
    return `<div class="fld col2" style="color:var(--dim);line-height:1.5">${_gl(
      "Każde spełnienie warunku <b style=\"color:var(--ink)\">przełącza</b> tę regułę: raz włączona, raz wyłączona. Zostaje włączona po zakończeniu gestu, więc pamięta stan.<br>Inna reguła może z tego korzystać: dodaj jej warunek <b>Inna reguła</b> i wskaż tę regułę, a zadziała tylko przy włączonym przełączniku. Klawisz poniżej jest opcjonalny i wysyła się przy każdej zmianie stanu.",
      "Every time the condition is met this rule <b style=\"color:var(--ink)\">flips</b>: on, then off. It stays on after the gesture ends, so it remembers.<br>Another rule can use that: give it an <b>Another rule</b> condition pointing here and it will only work while the switch is on. The key below is optional and is sent on every flip.")}</div>`;
  return `<div class="fld col2" style="color:var(--dim)">jedna akcja na każde przekroczenie progu</div>`;
}
// Pole składni (`mouse:left`, `pad:a`) jest dla zaawansowanych (P-G1-08), więc zwinięte. Otwarte
// tylko wtedy, gdy reguła ma akcję, której lista szybkiego wyboru nie zna: inaczej nie byłoby jej
// gdzie poprawić.
function _edKeyRawOpen(d){
  const k=String(d.keySpec||"");
  return !!k&&!QUICKKEYS.some(q=>q[0]===k);
}
// Podgląd „→ akcja” tylko wtedy, gdy akcja jest: pusty „→ -” wyglądał jak błąd (P-G1-08).
function _edSpecShow(v){
  const s=document.getElementById("edSpec");if(!s)return;
  s.textContent=v||"";
  const w=s.closest(".edspec");if(w)w.hidden=!v;
}
function singleKeyHtml(d){
  // QUICKKEYS zaczyna się od pustej pozycji „— szybki wybór —", więc reguła bez akcji (nowa —
  // patrz `openEditor`) trafia w nią sama: `d.keySpec===""` pasuje do jej wartości. Bez tej
  // pozycji lista pokazywałaby PIERWSZĄ z brzegu i twierdziła, że akcja jest wybrana.
  // DRUGA pozycja („— bez klawisza —") to świadoma decyzja, że nic nie ma być naciśnięte;
  // niesie ją pole `noAction`, a nie `keySpec` — pełne uzasadnienie przy QUICKKEYS w rf-10.
  const sel=ruleNoAction(d)?NOACT_SPEC:String(d.keySpec||"");
  // Bez akcji modułów wyłączonych przy starcie (rf-10 quickKeysOn); wybrana zostaje z dopiskiem.
  const qk=quickKeysOn(sel).map(q=>`<option value="${q[0]}" ${sel===q[0]?"selected":""}>${q[1]}</option>`).join("");
  // Usługi sieciowe wyłączone przy starcie: zdanie o ich wyzwalaczu byłoby obietnicą bez pokrycia.
  const _restOn=(typeof rfModOn!=="function")||rfModOn("uslugi");
  return `<label class="fld col2">Klawisz / akcja
    <button class="btn" id="edCap">⌨ Naciśnij klawisz…</button>
    <button class="btn" id="edPoint" title="Klik w konkretnym miejscu ekranu — podaj X i Y albo wskaż punkt kursorem">🖱 Punkt na ekranie…</button>
    <select id="edQuick">${qk}</select>
    <span class="edspec"${d.keySpec?"":" hidden"}>→ <b id="edSpec">${esc(d.keySpec||"")}</b></span></label>
    <details class="fld col2 ed-keyraw"${_edKeyRawOpen(d)?" open":""}><summary>Wpisz ręcznie (dla zaawansowanych)</summary>
      <input id="edKey" type="text" value="${esc(d.keySpec||"")}" placeholder="np. right, ctrl+c, mouse:left, pad:a" aria-label="Klawisz albo akcja wpisana ręcznie"></details>
    <div class="fld col2 edpadnote" id="edPadNote" style="display:none"></div>
    ${_restOn
      ?`<div class="fld col2 ednoactnote" id="edNoActNote" style="display:none">Ta reguła nic nie naciska. Liczy warunki, zapala się na liście i publikuje zdarzenie — może się na niej oprzeć wyzwalacz w module Usługi sieciowe albo warunek Wyzwalacz w innej regule.</div>`
      :`<div class="fld col2 ednoactnote" id="edNoActNote" style="display:none">Ta reguła nic nie naciska. Liczy warunki, zapala się na liście i publikuje zdarzenie, więc może się na niej oprzeć warunek Wyzwalacz w innej regule. Moduł Usługi sieciowe wyłączono przy starcie, więc jego wyzwalacze teraz jej nie usłyszą.</div>`}`;
}
// Wyjaśnienie przy regule bez klawisza + podłoga odstępu dla zachowania „Ciągłe". Osobna funkcja
// obok `updPadNote` i wołana w tych samych miejscach, bo z tego samego powodu: przełączenie listy
// rozwijanej NIE przerysowuje edytora (to by wyrwało fokus), a napis pod polem musi się zgadzać
// z tym, co w liście stoi. Napis jest w HTML po polsku i tłumaczy go walker rf-01 (para w I18N_EN),
// bo jego treść się nie zmienia — zmienia się tylko to, czy jest widoczny.
function updNoActNote(){
  const el=document.getElementById("edNoActNote"),d=state._draft;if(!d)return;
  const no=ruleNoAction(d)&&d.actionMode!=="seq";
  if(el)el.style.display=no?"":"none";
  // „Ciągłe" przy braku klawisza powtarza samo zdarzenie, a nasłuchuje go ktoś po drugiej stronie
  // sieci — dlatego podłoga odstępu. Poprawiamy pole w miejscu (bez przerysowania), żeby wybór
  // „bez klawisza" przy już otwartym zachowaniu „Ciągłe" nie zostawił 10 ms w polu i 200 ms w regule.
  const iv=document.getElementById("edIv");
  if(no&&iv&&d.behavior==="continuous"){
    iv.min=String(NOACT_MIN_IV);
    if((+d.intervalMs||0)<NOACT_MIN_IV){
      d.intervalMs=NOACT_MIN_IV;iv.value=NOACT_MIN_IV;
      const rg=document.getElementById("edIvRange");if(rg){rg.min=String(NOACT_MIN_IV);rg.value=NOACT_MIN_IV;}
      const vv=document.getElementById("edIvVal");if(vv)vv.textContent=NOACT_MIN_IV;
    }
  }else if(iv&&d.behavior==="continuous"){
    iv.min="10";
    const rg=document.getElementById("edIvRange");if(rg)rg.min="10";
  }
}
// A controller button has NOTHING to fall back to when the pad is missing (unlike the d-pad in
// Motion control, which quietly uses the keyboard) — the mapping would just report "nie wysłano".
// So the editor says it here, while the rule is being written, not after an evening of testing.
function updPadNote(){
  const el=document.getElementById("edPadNote"),d=state._draft;if(!el||!d)return;
  const seq=d.actionMode==="seq"?String(d.sequence||""):"";
  // MODUŁ WYŁĄCZONY PRZY STARCIE wygrywa ze sterownikiem: bez Kontrolera albo Skanera ta akcja nic
  // nie zrobi, choćby ViGEmBus był zainstalowany. Reguła i tak się zapisze (wróci po restarcie).
  const mo=(typeof ruleModOff==="function")?ruleModOff({keySpec:d.actionMode==="seq"?"":d.keySpec,sequence:seq}):"";
  if(mo){el.style.display="";el.className="fld col2 edpadnote warn edmodoff";
    el.textContent=mo==="kontroler"
      ?"⚠ Moduł Kontroler wyłączono przy starcie aplikacji, więc przyciski pada w tej regule teraz nic nie zrobią. Reguła się zapisze i zadziała po uruchomieniu aplikacji bez parametru --disable / --only."
      :"⚠ Moduł Skaner wyłączono przy starcie aplikacji, więc sygnały skanera w tej regule teraz nic nie zrobią. Reguła się zapisze i zadziała po uruchomieniu aplikacji bez parametru --disable / --only.";
    return;}
  const uses=specIsPad(d.keySpec)||/(^|[\s;])(down |up )?pad:/i.test(seq);
  if(!uses){el.style.display="none";return;}
  const gp=state.mouseGp||{mod:false,on:false};
  el.style.display="";
  // Written in Polish and left to applyLang/the observer (I18N_EN has the pairs), NOT composed
  // with _gl(): a string translated at write time freezes in whatever language was on at the
  // moment, and this one is rewritten far more rarely than the language gets toggled.
  if(gp.on){el.className="fld col2 edpadnote ok";
    el.textContent="🎮 Wirtualny kontroler działa, więc przyciski polecą do gry tak jak z pada.";}
  else if(gp.mod&&gp.drv!==false){el.className="fld col2 edpadnote";
    el.textContent="🎮 Pad utworzy się przy pierwszym użyciu (potrzebny sterownik ViGEmBus).";}
  // Brak sterownika albo modułu: wzór „brakuje czegoś spoza aplikacji" (rf-28b, zgłoszenie
  // 2026-10-15), żeby nie zginął pod formularzem. Napisy nadal po polsku z parą w I18N_EN.
  else if(typeof rfNeedHtml==="function"){el.className="fld col2 edpadnote rf-need";
    el.innerHTML=rfNeedHtml({url:"https://github.com/nefarius/ViGEmBus/releases",urlLabel:"Pobierz ViGEmBus ↗",
      titleHtml:gp.mod?"Ten wyzwalacz potrzebuje sterownika ViGEmBus":"Ten wyzwalacz potrzebuje modułu vgamepad i sterownika ViGEmBus",
      whyHtml:"Bez tego przyciski kontrolera nigdzie nie polecą. Zainstaluj sterownik, a wyzwalacz zacznie działać bez zmian."});}
  else{el.className="fld col2 edpadnote warn";
    el.textContent="⚠ Brak modułu vgamepad, więc przyciski kontrolera nigdzie nie polecą. Zainstaluj vgamepad i sterownik ViGEmBus.";}
}
// ------------------------------------------------------------------------------------------
//  PORADNIK PISANIA MAKR — jeden tekst, dwa miejsca
// ------------------------------------------------------------------------------------------
// Stoi TU, przy nagrywaniu i bibliotece kroków, bo tu ludzie zaczynają pisać makro. Karta koła
// wyboru woła tę samą funkcję zamiast powtarzać treść u siebie: dwa opisy tej samej składni
// rozjeżdżają się przy pierwszej zmianie parsera, a rozjechany poradnik jest gorszy niż żaden,
// bo się mu ufa.
//
// TREŚĆ SPISANA Z PARSERA `parse_sequence` (ribbitflip_monitor.py), nie z pamięci — łącznie
// z aliasami, których nikt by nie zgadł (`ledon`, `led 1`, `pusc` bez ogonka). Test
// tests/test_wheel.py czyta ten plik jako tekst i sprawdza, czy każde słowo, które parser
// przyjmuje, jest tu wypisane; dopisanie nowego rodzaju kroku bez linijki tutaj wywala test.
//
// PISANE CAŁYMI ZDANIAMI W OSOBNYCH WĘZŁACH TEKSTOWYCH, bo tłumacz (rf-01) podmienia węzeł
// w całości i klucz musi się zgadzać co do znaku. Stąd znaczniki <code> tylko tam, gdzie stoją
// same tokeny, a w prozie słowa kluczowe w cudzysłowie.
function macroGuideHtml(){
  return `<h5>Z czego składa się makro</h5>
    <p>Makro to kilka kroków wykonywanych po kolei, od lewej do prawej. Kroki oddzielasz średnikiem albo nową linią, a spacje wokół kroku nie mają znaczenia.</p>
    <table class="mg-tab">
      <tr><td>Klawisz lub akcja</td>
          <td><code>a</code> <code>ctrl+c</code> <code>space</code> <code>mouse:left</code> <code>pad:a</code> <code>layer:2</code></td>
          <td>Jeden krok wciska i od razu puszcza.</td></tr>
      <tr><td>Pauza</td>
          <td><code>wait 100</code> <code>czekaj 100</code> <code>delay 100</code> <code>100ms</code></td>
          <td>Odstęp w milisekundach, zanim ruszy następny krok.</td></tr>
      <tr><td>Przytrzymanie</td>
          <td><code>down shift</code> <code>wcisnij shift</code> <code>hold shift</code></td>
          <td>Wciska i trzyma, dopóki nie puści tego osobny krok.</td></tr>
      <tr><td>Puszczenie</td>
          <td><code>up shift</code> <code>pusc shift</code> <code>puść shift</code> <code>release shift</code></td>
          <td>Puszcza klawisz przytrzymany wcześniej.</td></tr>
      <tr><td>Dioda kapsla</td>
          <td><code>led on</code> <code>led_on</code> <code>ledon</code> <code>led 1</code> <code>led off</code> <code>led_off</code> <code>ledoff</code> <code>led 0</code></td>
          <td>Zapala albo gasi diodę w samym kapslu.</td></tr>
    </table>
    <h5>Limity</h5>
    <ul>
      <li>Całe makro: najwyżej 500 znaków.</li>
      <li>Jeden krok: najwyżej 40 znaków.</li>
      <li>Pauza: od 0 do 10000 ms, czyli najwyżej dziesięć sekund. Dłuższa liczba jest przycinana do tego.</li>
      <li>Wielkość liter w słowach kluczowych nie ma znaczenia, a w nazwie klawisza zostaje taka, jaka została wpisana.</li>
      <li>Pusty krok i podwójny średnik są pomijane bez ostrzeżenia.</li>
    </ul>
    <h5>Trzy przykłady, od najprostszego</h5>
    <ul>
      <li><code>ctrl+c; wait 200; ctrl+v</code><br>Kopiuj, odczekaj chwilę, wklej.</li>
      <li><code>down shift; w; wait 500; up shift</code><br>Trzymaj shift przez pół sekundy i wciśnij w środku klawisz w.</li>
      <li><code>pad:a; wait 100; mouse:left@50%,50%</code><br>Przycisk pada, chwila przerwy, klik w samym środku ekranu.</li>
    </ul>
    <h5>Pułapki</h5>
    <ul>
      <li>Kroki „down” i „up” bez nazwy klawisza to zwykłe strzałki w dół i w górę, a nie przytrzymanie.</li>
      <li>Naciśnięcie przycisku pada musi TRWAĆ. Gra odpytuje kontroler kilkadziesiąt razy na sekundę i naciśnięcie krótsze niż jedno takie pytanie potrafi jej umknąć, więc zamiast jednego kroku napisz przytrzymanie, krótką pauzę i puszczenie.</li>
      <li>Makro wykonuje się w całości i nie da się go przerwać w połowie. Przerywa je dopiero wstrzymanie kapsla albo zamknięcie aplikacji, a wszystko, co zostało przytrzymane, jest wtedy puszczane.</li>
      <li>Makro jest polem ryzykownym przy wczytywaniu cudzego zestawu: tryb bezpieczny je pomija, bo cudza sekwencja może wcisnąć dowolny skrót w Twoim systemie.</li>
      <li>W kole wyboru krok „layer:” w makrze działa, choć ta sama akcja wpisana jako pojedyncza akcja wycinka jest odrzucana przy zapisie.</li>
    </ul>`;
}
// Zwijany blok, ten sam wzorzec co poradniki zakładek (details.mapwiki). Domyślnie zamknięty:
// osoba, która pisze makro z pamięci, nie chce przewijać przez ekran tłumaczenia.
//
// GDZIE ON STOI (od 2026-08-31): NA SPODZIE ZAKŁADKI „INFORMACJE" tego modułu, a nie w edytorze
// i nie na karcie koła: poradnik pisania makr należy do informacji, nie do zakładki
// konfiguracji. Wstawia go tam `buildFrame` (rf-49m) dla
// modułów, które mają w spisie `macroGuide` (rf-49j) — czyli Mapowanie i Koło wyboru. Ta funkcja
// jest już tylko WZORCEM tego bloku; miejsca, z których pisze się makra, mają zamiast niego
// jednolinijkowy odsyłacz z przyciskiem `data-mg-goto`.
function macroGuideFoldHtml(id){
  return `<details class="mapwiki mg-fold"${id?` id="${id}"`:""}>
    <summary><span class="rfic guide-ic" aria-hidden="true"></span>Jak pisać makra ręcznie?</summary>
    <div class="mapwiki-body">${macroGuideHtml()}</div></details>`;
}
function seqHtml(d){
  return `<div class="fld col2" style="align-items:flex-start">Sekwencja (makro)
    <div style="flex:1;min-width:240px">
      <div class="seqtools">
        <div class="seqtools-top">
          <button class="btn sm" type="button" id="seqRec"><span class="bic bic-camera" aria-hidden="true"></span>Nagraj klawisze</button>
          <span class="seqrec-hint" id="seqRecHint">nagrywa naciskane klawisze razem z pauzami</span>
        </div>
        <div class="seqtools-lib">
          <select id="seqLib" title="Biblioteka elementów — wybierz kategorię">
            ${[["keys","⌨ Klawisze"],["combos","⌨ Kombinacje"],["hold","⬇⬆ Przytrzymanie"],
               ["media","🎵 Media"],["mouse","🖱 Mysz"],["pad","🎮 Kontroler"],
               ["led","💡 LED"],["wait","⏱ Pauzy"]]
              // Bez Kontrolera (wyłączony przy starcie) nie ma czego proponować z pada.
              .filter(c=>c[0]!=="pad"||typeof rfModOn!=="function"||rfModOn("kontroler"))
              // The chosen category survives a re-render. It did not before, and the moment a chip
              // itself caused one (the point panel opens from 🖱 Mysz) the list jumped back to
              // Klawisze under the cursor.
              .map(c=>`<option value="${c[0]}" ${state._seqLibCat===c[0]?"selected":""}>${c[1]}</option>`).join("")}
          </select>
          <div class="seqchips" id="seqChips"></div>
        </div>
      </div>
      <textarea id="edSeq" rows="3" placeholder="a; wait 100; b; media_volume_up">${esc(d.sequence||"")}</textarea>
    </div></div>
    <div class="fld col2" style="color:var(--dim);line-height:1.5">Kroki oddziel <b>średnikiem</b> lub nową linią. Pauza: <b>wait 100</b> lub <b>100ms</b>. Kliknij element z biblioteki = dodaj, albo <b>nagraj</b> na żywo. Podgląd: <b id="edSeqPrev" style="color:var(--az)"></b></div>
    <div class="fld col2 mg-hint">Składnię opisuje poradnik <b>Jak pisać makra ręcznie</b> — stoi na spodzie zakładki <b>Informacje</b> tego modułu.
      <button class="btn xs" type="button" data-mg-goto="edSeqGuide">Otwórz poradnik</button></div>`;
}
// ONE consistent condition card — used for the main one (cc=-1) AND each extra one (cc=0..).
// Each has: source selection (axis/filter/button), parameters, threshold + SLIDER + down-arrow, own live preview.
function condCardHtml(c, cc, title, deletable){
  const kind=c.source.kind, isAxis=kind==="axis", isFilter=kind==="filter", isButton=kind==="button", isTrigger=kind==="trigger";
  const isGesture=kind==="gesture";   // a RECORDED gesture (rf-12d/e) — its card body comes from there
  const o=(v,sel,lab)=>`<option value="${v}" ${String(sel)===String(v)?"selected":""}>${esc(lab)}</option>`;
  const ch=[0,1,2,3,4,5].map(i=>o(i,c.source.channel,`CH${i} (${RE_LABEL[i]})`)).join("");
  const by=[1,2,3,4].map(i=>o(i,c.source.byte,`B${i}`)).join("");
  const bi=[0,1,2,3,4,5,6,7].map(i=>o(i,c.source.bit,`bit ${i}`)).join("");
  const cm=[[">","wart. > próg"],["<","wart. < próg"],[">=","wart. ≥ próg"],["<=","wart. ≤ próg"],["in","w zakresie x..y"],["out","poza zakresem x..y"]].map(x=>o(x[0],c.cmp,x[1])).join("");   // surowe znaki — o() robi esc(), pre-encoded encje dublowały się do literalnego "&gt;"
  const mt=FILTER_METRICS.map(m=>o(m[0],c.source.metric,`${m[1]} (${m[2]})`)).join("");
  const fm=FMETA[c.source.metric]||FMETA.tilt;
  const thrMin=c.abs?0:-32768, sMin=isFilter?(c.abs?0:fm.min):thrMin, sMax=isFilter?fm.max:32768, sStep=isFilter?1:50;
  const isRange=(c.cmp==="in"||c.cmp==="out"), hiVal=(c.thresholdHi!=null?c.thresholdHi:c.threshold);
  const loLab=isRange?"Od (x)":"Próg", uS=isFilter?`<small style="color:var(--dim)">${fm.unit}</small>`:"", thStep=isFilter?1:100;
  const hiFld=isRange?`<label class="fld">Do (y) <input type="number" data-cf="thresholdHi" step="${thStep}" value="${hiVal}"> ${uS}
         <button class="btn sm" data-cf="setcurHi" title="Ustaw na bieżącą wartość">↧</button></label>`:"";
  const refOpts=(state.rules||[]).filter(x=>!state._draft||x.id!==state._draft.id)
    .map(x=>o(x.id,c.source.ref,x.label||ruleSrcLabel(x)||x.id)).join("");
  const params = isGesture
    ? (typeof gestCondParamsHtml==="function"?gestCondParamsHtml(c,cc):"")
    : isTrigger
    ? `<label class="fld col2">Wyzwalacz <select data-cf="ref"><option value="">— wybierz wyzwalacz —</option>${refOpts}</select></label>
       <div class="fld col2 longpress-hint" style="color:var(--dim);font-size:11px;line-height:1.45;background:var(--bg2);border:1px solid var(--line);border-radius:7px;padding:6px 9px">💡 Warunek jest spełniony, gdy wybrany wyzwalacz jest <b>AKTYWNY</b> (jego warunek przekroczony) w tej chwili. Pozwala warstwować sterowanie — np. „strzelaj tylko gdy idziesz” albo z <b>NIE</b>: „skok tylko gdy NIE biegniesz”.${refOpts?"":"<br><b>Brak innych wyzwalaczy</b> — najpierw utwórz inny wyzwalacz, potem się do niego odwołaj."}</div>`
    : isAxis
    ? `<label class="fld">Kanał <select data-cf="channel">${ch}</select></label>
       <label class="fld"><input type="checkbox" data-cf="abs" ${c.abs?"checked":""}> |x|</label>
       <label class="fld">Warunek <select data-cf="cmp">${cm}</select></label>
       <label class="fld">${loLab} <input type="number" data-cf="threshold" step="100" value="${c.threshold}">
         <button class="btn sm" data-cf="setcur" title="Ustaw na bieżącą wartość">↧</button></label>${hiFld}`
    : isFilter
    ? `<label class="fld">Metryka <select data-cf="metric">${mt}</select></label>
       <label class="fld"><input type="checkbox" data-cf="abs" ${c.abs?"checked":""}> |x|</label>
       <label class="fld">Warunek <select data-cf="cmp">${cm}</select></label>
       <label class="fld">${loLab} <input type="number" data-cf="threshold" step="1" value="${c.threshold}"> ${uS}
         <button class="btn sm" data-cf="setcur" title="Ustaw na bieżącą wartość">↧</button></label>${hiFld}`
    : `<label class="fld col2"><input type="checkbox" data-cf="any" ${c.source.any?"checked":""}> Auto — reaguj na dowolne wciśnięcie (bez uczenia bitu)</label>
       <label class="fld col2">Trzymaj <input type="number" data-cf="holdMs" min="20" max="5000" step="10" value="${c.source.holdMs!=null?c.source.holdMs:250}"> <small style="color:var(--dim)">ms — minimum, jak długo po naciśnięciu uznawać za wciśnięty (przytrzymany przycisk trzyma tyle, ile go trzymasz)</small></label>
       <div class="fld col2 longpress-hint" style="color:var(--dim);font-size:11px;line-height:1.45;background:var(--bg2);border:1px solid var(--line);border-radius:7px;padding:6px 9px">💡 <b>Krótkie vs długie przyciśnięcie:</b> krótkie = zachowanie <b>„Jednorazowo”</b>; <b>długie przyciśnięcie</b> = zachowanie <b>„Po czasie”</b> (poniżej) + ustaw czas (np. 600 ms) — odpali dopiero po przytrzymaniu przycisku tyle czasu. Kapsel przez cały czas mówi, że przycisk jest wciśnięty, więc „Trzymaj” możesz zostawić na domyślnej wartości.</div>
       <details class="ed-btn-adv" ${c.source.any?"":"open"}><summary>konkretny bit (zaawansowane)</summary>
         <label class="fld col2"><button class="btn sm" data-cf="learn" title="Kliknij, potem naciśnij fizyczny przycisk na kapslu"><span class="bic bic-connect" aria-hidden="true"></span>Wykryj przycisk</button>
           <span class="ckhint">wykryty: B${c.source.byte}·bit${c.source.bit}</span></label>
         <span class="fld">Bajt <select data-cf="byte">${by}</select></span>
         <span class="fld">Bit <select data-cf="bit">${bi}</select></span></details>`;
  const slider = (isButton||isTrigger||isGesture) ? "" :
    // Suwak ma obok siebie napis „próg"/„od", ale to sąsiedni <span>, nie <label> — czytnik mówił
    // „suwak" i nic więcej. Nazwa idzie więc w aria-label, tym samym słowem, którym podpisane jest
    // pole liczbowe tego samego progu (loLab wyżej); walker rf-01 tłumaczy aria-label jak każdy tekst.
    // WHY: the slider's caption is a sibling span, not a label, so the control had no accessible
    // name; it takes the same wording as the number field for the same threshold.
    `<div class="ed-cond-slider"><span>${isRange?"od":"próg"}</span>
       <input type="range" data-cf="thrRange" aria-label="${isRange?"Od (x)":"Próg"}" min="${sMin}" max="${sMax}" step="${sStep}" value="${c.threshold}">
       <span class="num" data-cf="thrVal">${c.threshold}</span></div>`+
    (isRange?`<div class="ed-cond-slider"><span>do</span>
       <input type="range" data-cf="thrRangeHi" aria-label="Do (y)" min="${sMin}" max="${sMax}" step="${sStep}" value="${hiVal}">
       <span class="num" data-cf="thrValHi">${hiVal}</span></div>`:"");
  const headTxt = isGesture ? "podgląd · ostatni ruch kapsla wobec nagrania"
    : isButton ? "naciśnij przycisk — zaświeci, gdy wciśnięty"
    : isTrigger ? "podgląd · stan wskazanego wyzwalacza (aktywny = spełniony)"
    : (isRange?"podgląd · 2 linie = granice zakresu":"podgląd na żywo · linia = próg");
  return `<div class="ed-cond-card${c.neg?' is-neg':''}" data-cc="${cc}">
    <div class="ed-cond-top">
      ${cc>=0?`<select class="ed-cond-op" data-cf="op" title="Jak łączyć z dotychczasowym wynikiem (lewo→prawo)"><option value="and" ${c.op!=="or"?"selected":""}>ORAZ</option><option value="or" ${c.op==="or"?"selected":""}>LUB</option></select>`:''}
      <span class="ed-cond-n">${title}</span>
      <div class="seg seg-sm" role="group" aria-label="Źródło warunku">
        <button type="button" data-ck="axis" aria-pressed="${isAxis?'true':'false'}" class="${isAxis?'on':''}">Oś</button>
        <button type="button" data-ck="filter" aria-pressed="${isFilter?'true':'false'}" class="${isFilter?'on':''}">Filtr 3D</button>
        <button type="button" data-ck="button" aria-pressed="${isButton?'true':'false'}" class="${isButton?'on':''}">Przycisk</button>
        <button type="button" data-ck="trigger" aria-pressed="${isTrigger?'true':'false'}" class="${isTrigger?'on':''}" title="Powiąż z inną regułą">Inna reguła</button>
        ${typeof gestCondParamsHtml==="function"?`<button type="button" data-ck="gesture" aria-pressed="${isGesture?'true':'false'}" class="${isGesture?'on':''}" title="Nagrany gest kapsla">Gest</button>`:""}</div>
      <label class="ed-cond-neg" title="NEGUJ (NOT) — liczy się jako spełniony, gdy warunek NIE jest spełniony"><input type="checkbox" data-cf="neg" ${c.neg?'checked':''}> NIE</label>
      ${deletable?`<button class="btn sm ed-cond-del" title="Usuń warunek">×</button>`:""}</div>
    <div class="ed-cond-params">${params}</div>
    ${slider}
    <div class="ed-cond-head">${headTxt} <span class="edpv-state" data-pv="state">—</span></div>
    <canvas class="edscope edscope-sm" data-pv="scope"></canvas>
  </div>`;
}
// WARSTWA, w której ta reguła nasłuchuje. „Zawsze" (0) jest domyślne i takie ma każda reguła
// napisana, zanim warstwy powstały — dlatego dodanie tego pola niczego nikomu nie zmienia.
// Stoi w „Zachowaniu", a nie w „Warunkach": warstwa nie jest kolejnym warunkiem do spełnienia,
// tylko odpowiedzią na pytanie, KIEDY reguła w ogóle nasłuchuje.
// „Wybierz z domyślnych" — gotowy gest z rf-12c nałożony na szkic reguły. Przenosi WYŁĄCZNIE to,
// kiedy reguła ma zadziałać (źródło · porównanie · próg · zachowanie z jego czasami). Akcja zostaje
// nietknięta: `keySpec` i `sequence` to jedyna rzecz, której szablon nie może wiedzieć, a cichy
// nadpis skasowałby klawisz wybrany chwilę wcześniej. Dodatkowe warunki też zostają — szablon
// opisuje „Warunek 1 (główny)", nie całą kartę.
function gestureRowHtml(d){
  const gp=(typeof GESTURE_PRESETS!=="undefined")?GESTURE_PRESETS:[];
  if(!gp.length)return "";                       // starszy panel bez pliku z gestami — po prostu bez wiersza
  const pick=state._gesturePick||"", sel=gp.find(g=>g.key===pick);
  const opts=gp.map(g=>`<option value="${esc(g.key)}" ${g.key===pick?"selected":""}>${esc(g.label)}</option>`).join("");
  return `<label class="fld col2" title="Gotowy gest wypełnia warunek, próg i zachowanie. Akcję (klawisz albo przycisk pada) wybierasz sam, a wszystko możesz jeszcze poprawić.">Gotowy gest
    <select id="edGesture"><option value="">Wybierz z domyślnych…</option>${opts}</select>
    <small class="ed-sig-note" id="edGestureDesc">${sel?esc(sel.desc):"wypełnia warunek i zachowanie, akcję dopisujesz sam"}</small></label>`;
}
function applyGesturePreset(d, g){
  const r=(g&&g.rule)||{};
  d.source=JSON.parse(JSON.stringify(r.source||{kind:"axis",channel:0}));   // własna kopia, nigdy współdzielony obiekt szablonu
  d.abs=!!r.abs;
  d.cmp=r.cmp||">";
  d.threshold=(r.threshold!=null?r.threshold:0);
  d.thresholdHi=(r.thresholdHi!=null?r.thresholdHi:null);
  d.behavior=r.behavior||"once";
  if(r.intervalMs!=null)d.intervalMs=r.intervalMs;
  if(r.dwellMs!=null)d.dwellMs=r.dwellMs;
  if(r.crossings!=null)d.crossings=r.crossings;
  if(r.windowMs!=null)d.windowMs=r.windowMs;
  // Etykietę wpisujemy tylko w pustą albo w taką, którą zostawił poprzedni gest — własnej nazwy
  // reguły nie ruszamy, bo to jedyne pole, w którym użytkownik pisze o SWOIM zamiarze.
  const gp=(typeof GESTURE_PRESETS!=="undefined")?GESTURE_PRESETS:[];
  const auto=gp.some(x=>x.label===String(d.label||""));
  if(!String(d.label||"").trim()||auto)d.label=g.label;
}
function layerFieldHtml(d){
  const lay=Math.max(0,Math.min(4,+(d.layer||0)));
  let opts=`<option value="0" ${lay===0?"selected":""}>Zawsze</option>`;
  for(let n=1;n<=4;n++)opts+=`<option value="${n}" ${lay===n?"selected":""}>Warstwa ${n}</option>`;
  return `<label class="fld col2" title="Warstwy to kilka kompletów wyzwalaczy na jednym kapslu. „Zawsze” znaczy, że ta reguła działa w każdej z nich. Warstwę przełączasz paskiem nad listą albo regułą z akcją „Warstwa”.">Warstwa
    <select id="edLayer">${opts}</select>
    <small class="ed-sig-note">reguła spoza aktywnej warstwy śpi tak samo, jak wyłączona</small></label>`;
}
function renderEditor(){
  if(typeof stopSeqRec==="function")stopSeqRec();   // don't leave a recording listener attached when rebuilding the DOM
  // Rejestrator makra i biblioteka chipów pracują na CELU (rf-32), a ten edytor jest celem
  // domyślnym. Oddajemy im pole TUTAJ, a nie przy podpinaniu #edSeq: pole sekwencji istnieje tylko
  // w trybie „makro", więc otwarcie reguły klawiszowej zostawiałoby cel wskazujący na wycinek koła,
  // którego edytor był otwarty jako ostatni.
  if(typeof seqSetTarget==="function")seqSetTarget(null);
  state._behPrev=null;                              // reset activation preview (dwell/multi counters restart after behavior/condition changes)
  const d=state._draft;
  // A rule that already clicks a point opens its point panel by itself: the alternative is a
  // coordinate visible only as text in the spec field, editable only letter by letter.
  if(typeof ptSyncFromDraft==="function")ptSyncFromDraft();
  d.extraConditions=d.extraConditions||[];
  // THE SIMPLE MODE draws its own, shorter editor (rf-12e) — same draft, same ids for the parts
  // it shares (label, action, layer, signals, save/cancel), so wireEditor binds them unchanged.
  if(state._edMode==="simple"&&typeof gestSimpleRender==="function"){gestSimpleRender();return;}
  const opt=(v,sel,lab)=>`<option value="${v}" ${String(sel)===String(v)?"selected":""}>${lab}</option>`;
  const qk=quickKeysOn(d.keySpec).map(q=>opt(q[0],d.keySpec,q[1])).join("");
  // A recorded gesture is an EVENT: a behaviour that needs the condition to STAY true (hold,
  // continuous, dwell) can never see more than the short pulse the hub gives it. Shown, not
  // hidden — but switched off, with a line saying which three make sense.
  const _isG=!!(d.source&&d.source.kind==="gesture"), _gDis=_isG?" disabled":"";
  // ALL conditions as identical cards: main (cc=-1) + extra (cc=0..)
  const mainCond=condCardHtml(d,-1,"Warunek 1 (główny)",false);
  let conds="";
  d.extraConditions.forEach((c,i)=>conds+=condCardHtml(c,i,"Warunek "+(i+2),true));
  const opHint=d.extraConditions.length
    ? `<span class="ed-cond-ophint">Łączenie: każdy warunek ma własny <b>ORAZ/LUB</b> + opcjonalnie <b>NIE</b> — liczone lewo→prawo, bez nawiasów</span>`
    : "";
  // TRZY PIĘTRA (UX 261120 L4e). Na wierzchu to, co człowiek ustawia przy każdej regule: krok
  // kierunku albo tryb edycji, Nazwa, Akcja i stopka. Piętro 2 „Warunek i zachowanie” (zwinięte,
  // wartości w nagłówku): warunek główny, trzy podstawowe zachowania, warstwa. Piętro 3
  // „Zaawansowane” na dole: dodatkowe warunki, rzadkie zachowania z liczbą i oknem czasu
  // (`crossings`/`windowMs` są takie same we wszystkich regułach gotowych zestawów) i sygnały.
  // Te same id kontrolek, więc wireEditor wiąże je bez zmian; dwa `.seg-beh` dzielą jeden nasłuch.
  const tile=_edTileOf();
  const nameFld=`<label class="fld col2">Nazwa <input id="edLabel" type="text" value="${esc(d.label||"")}" placeholder="np. Przewijaj w prawo"></label>`;
  const bb=(k,lab,extra)=>`<button type="button" data-b="${k}" aria-pressed="${d.behavior===k?"true":"false"}" class="${d.behavior===k?"on":""}"${extra||""}>${lab}</button>`;
  const behMore=ED_BEH_MORE.indexOf(d.behavior)>=0;
  const condSec=`
    <section class="ed-sec col2">
      <!-- h3, nie h4: nazwa modułu jest h1, nagłówki kart h2 — sekcje edytora idą o stopień niżej. -->
      <h3 class="ed-sec-h">Warunki — kiedy ma zadziałać<span id="condToast" class="cond-toast" data-noi18n></span></h3>
      <div class="ed-conds">${mainCond}</div>
    </section>`;
  const behSec=`
    <section class="ed-sec col2">
      <h3 class="ed-sec-h">Zachowanie — jak ma reagować</h3>
      <div class="ed-sec-body">
        <div class="fld col2"><div class="seg seg-beh" role="group" aria-label="Zachowanie">
          ${bb("once","Jednorazowo")}${bb("continuous","Ciągłe",_gDis)}${bb("hold","Przytrzymaj",_gDis)}</div>
          ${_isG?`<small class="ed-sig-note">Zachowanie dla gestu: Jednorazowo, X razy w czasie albo Przełącznik — gest jest zdarzeniem, nie stanem</small>`:""}</div>
        ${behMore?"":behaviorFieldsHtml(d)}
        ${layerFieldHtml(d)}
      </div>
    </section>`;
  const moreCondSec=`
    <section class="ed-sec col2">
      <h3 class="ed-sec-h">Więcej warunków</h3>
      <div class="ed-conds">${conds}
        <div class="ed-cond-foot">${opHint}<button class="btn sm" id="edAddCond"><span class="bic bic-plus" aria-hidden="true"></span>Dodaj warunek</button></div></div>
    </section>`;
  const moreBehSec=`
    <section class="ed-sec col2">
      <h3 class="ed-sec-h">Więcej zachowań</h3>
      <div class="ed-sec-body">
        <div class="fld col2"><div class="seg seg-beh" role="group" aria-label="Więcej zachowań">
          ${bb("multi","X razy w czasie",' title="Aktywuj po N przekroczeniach progu/zakresu w zadanym czasie (np. 3× w 2 s)"')}${bb("taps","Dokładnie N puknięć",' title="DOKŁADNIE N puknięć w oknie czasu, decyzja na jego końcu: jedno puknięcie i dwuklik mogą wtedy stać na tym samym przycisku, bo pojedyncze czeka, czy nie przyjdzie drugie. Przytrzymanie nie liczy się jako puknięcie"')}${bb("dwell","Po odczekaniu",' title="Aktywuj po X ms nieprzerwanego spełnienia warunku"'+_gDis)}${bb("latch","Przełącznik",' title="Każde spełnienie warunku przełącza stan reguły: raz włączony, raz wyłączony. Inne reguły mogą się na nim opierać (warunek „Inna reguła”)"')}</div></div>
        ${behMore?behaviorFieldsHtml(d):""}
      </div>
    </section>`;
  const tune=`<details class="cardfold inset col2 ed-fold" id="edTune"><summary>Warunek i zachowanie</summary>
      <div class="cardfold-body">${condSec}${behSec}</div></details>`;
  const adv=`<details class="cardfold adv col2 ed-fold ed-adv" id="edAdv"><summary>Zaawansowane</summary>
      <div class="cardfold-body">${moreCondSec}${moreBehSec}${edSignalsSecHtml(d)}</div></details>`;
  document.getElementById("ruleEditor").innerHTML=tile?`<div class="ed-grid ed-guided">
    ${edHeadHtml()}
    ${tile.dir?trigStepHtml(tile):""}
    ${nameFld}
    ${edActionSecHtml(d)}
    ${tune}
    ${adv}
    ${edFootHtml()}
  </div>`:`<div class="ed-grid">
    ${edHeadHtml()}
    ${typeof gestModeBarHtml==="function"?gestModeBarHtml():""}
    ${gestureRowHtml(d)}
    ${nameFld}
    ${edActionSecHtml(d)}
    ${tune}
    ${adv}
    ${edFootHtml()}
  </div>`;
  wireEditor();
  edTiersWire(d,tile);
  if(tile){
    const fb=document.getElementById("trigFlip");
    if(fb)fb.onclick=()=>{
      d.cmp=(d.cmp==="<")?">":"<"; d.threshold=-(+d.threshold||0);
      renderEditor();
      flashTrigMsg(_gl("Zamieniono kierunek w tej regule.","The direction in this rule is switched."));
    };
    trigStepPaint();
  }
  edReadyPaint._k=null; edReadyPaint(); _edPlaceSync();
}
// THE ACTION AND THE SIGNALS as functions of their own, because the simple mode (rf-12e) shows
// exactly these two blocks under its recorder — one markup, one set of ids, one wiring.
function edActionSecHtml(d){
  return `<section class="ed-sec col2" data-sec="action">
      <h3 class="ed-sec-h">Akcja — co ma się stać</h3>
      <div class="ed-sec-body">
        <div class="fld col2"><div class="seg seg-am" role="group" aria-label="Rodzaj akcji">
          <button type="button" data-am="single" aria-pressed="${d.actionMode!=="seq"?"true":"false"}" class="${d.actionMode!=="seq"?"on":""}">Pojedyncza</button>
          <button type="button" data-am="seq" aria-pressed="${d.actionMode==="seq"?"true":"false"}" class="${d.actionMode==="seq"?"on":""}">Sekwencja (makro)</button></div></div>
        ${d.actionMode==="seq" ? seqHtml(d) : singleKeyHtml(d)}
        ${typeof ptBoxHtml==="function" ? ptBoxHtml(d) : ""}
      </div>
    </section>`;
}
function edSignalsSecHtml(d){
  return `<section class="ed-sec col2">
      <h3 class="ed-sec-h">Sygnały — jak ma dać znać</h3>
      <div class="ed-sig">
        <div class="ed-sigcard">
          <div class="ed-sigcard-h">Podświetlenie</div>
          <label class="ed-sigopt"><input type="checkbox" id="edGlow" ${d.glow?"checked":""}> świeć, gdy aktywny</label>
          <label class="ed-sigopt"><input type="checkbox" id="edLed" ${d.led&&d.led.on?"checked":""}> 💡 zaświeć LED przy wyzwoleniu</label>
          <div class="ed-sigsub" id="edLedMsFld" style="${d.led&&d.led.on?'':'display:none'}">
            <label class="fld">na <input id="edLedMs" type="number" min="0" max="10000" step="50" value="${d.led&&d.led.ms!=null?d.led.ms:300}" style="width:84px"> ms</label>
            <small class="ed-sig-note">(0 = zostaw zapalony)</small></div>
        </div>
        <div class="ed-sigcard">
          <div class="ed-sigcard-h">🔔 Powiadomienie Windows</div>
          <label class="ed-sigopt"><input type="checkbox" id="edToast" ${d.toast&&d.toast.on?"checked":""}> wysyłaj powiadomienie</label>
          <div class="ed-sigsub" id="edToastModeFld" style="${d.toast&&d.toast.on?'':'display:none'}">
            <label class="fld">kiedy
              <select id="edToastMode">
                <option value="fire" ${(!d.toast||d.toast.mode!=="active")?"selected":""}>przy zadziałaniu</option>
                <option value="active" ${d.toast&&d.toast.mode==="active"?"selected":""}>gdy staje się aktywny (i gdy przestaje)</option>
              </select></label>
            <label class="ed-toast-silent"><input type="checkbox" id="edToastSilent" ${(!d.toast||d.toast.silent!==false)?"checked":""}> bez dźwięku</label>
            <input id="edToastText" type="text" maxlength="120" value="${esc((d.toast&&d.toast.text)||"")}" placeholder="własna treść — puste = nazwa wyzwalacza i klawisz">
            <small class="ed-sig-note">dymek Windows z ikony w zasobniku — widoczny też, gdy panel jest schowany za grą. Nie częściej niż raz na 3 s; zdławione zadziałania dolicza licznik „(x7)”</small></div>
        </div>
      </div>
    </section>`;
}
// ===== UX 261120 B1: start z kafla, nagłówek i przyklejona stopka edytora =====
// Kafel, od którego zaczęła się TA sesja edycji (rf-12c TRIG_TILES), albo null.
function _edTileOf(){
  const k=state._edTile;
  return (k&&typeof TRIG_TILES!=="undefined")?(TRIG_TILES.find(t=>t.key===k)||null):null;
}
// KAFEL STARTU → EDYTOR (P-G1-01). Nowa reguła dostaje warunek, zachowanie i nazwę kafla, akcji
// kafel nie zgaduje. Otwiera się w trybie ręcznym, w układzie prowadzonym (renderEditor). Wszystko
// w `after`: openEditor może najpierw zapytać o niezapisany szkic, a ustawienia z kafla nie są
// zmianą człowieka, więc migawka „czysty szkic” powstaje po nich.
function trigTileNew(key){
  const t=(typeof TRIG_TILES!=="undefined")?TRIG_TILES.find(x=>x.key===key):null;
  if(!t)return;
  if(typeof GEST!=="undefined")GEST.mode="advanced";
  openEditor(null,d=>{
    applyGesturePreset(d,{rule:t.rule,label:_gl(t.label,t.en)});
    state._edMode="advanced";state._edTile=t.key;
    state._edRef=JSON.parse(JSON.stringify(_edTuneSnap(d)));   // L4e: „zmienione” liczone od kafla
    renderEditor();_edHostMark(true);
    state._edRef=JSON.parse(JSON.stringify(_edTuneSnap(d)));   // render normalizuje szkic
    state._draftBase=JSON.stringify(d);
    const b=document.getElementById("edCap");if(b)try{b.focus({preventScroll:true});}catch(e){}
    try{document.getElementById("ruleEditor").scrollIntoView({block:"nearest",behavior:"smooth"});}catch(e){}
  });
}
// NAGŁÓWEK EDYTORA (P-G1-04): „Nowy wyzwalacz” albo „Edycja: nazwa”, a obok kafel, od którego
// zaczęto. Rysowany zawsze, bo rf-43 przenosi edytor do Kontrolera dopiero PO renderze; tam chowa
// go CSS (`#padRuleEditorSlot .ed-head`), bo edytor stoi pod panelem części, która go nazywa.
function edHeadHtml(){
  const d=state._draft;
  if(!d)return "";
  const isNew=!state.rules.some(x=>x.id===d.id), t=_edTileOf();
  const nm=String(d.label||ruleSrcLabel(d)||"");
  return `<div class="head ed-head col2" data-noi18n><h2>${esc(isNew?_gl("Nowy wyzwalacz","New trigger"):_gl("Edycja: ","Editing: ")+nm)}</h2>`
    +(t?`<span class="hint">${esc(_gl(t.label,t.en))}</span>`:"")+`</div>`;
}
// STOPKA PRZYKLEJONA DO DOŁU (P-G1-04 + F-G1-06): co jeszcze brakuje do zapisu, komunikaty
// edytora (`#edMsg`, tam pisze flashTrigMsg, gdy edytor jest otwarty) i Anuluj · Zapisz.
function edFootHtml(){
  return `<div class="ed-actions col2">
      <span class="ed-why" data-edready data-noi18n></span>
      <span class="trigmsg ed-msg" id="edMsg" role="status" aria-live="polite"></span>
      <!-- Anuluj przed akcją główną: ta sama kolejność co rfModal/rfConfirm. -->
      <button class="btn" id="edCancel">Anuluj</button>
      <button class="btn rf-cta" id="edSave">Zapisz wyzwalacz</button></div>`;
}
// „Do zapisu brakuje: …” w trybie ręcznym (tryb „Nagraj gest” ma własne, rf-12e gestStepsPaint).
// Wołane z pętli klatek (drawEditorScope), więc dotyka DOM-u tylko przy zmianie zdania.
function edReadyPaint(){
  const d=state._draft;if(!d||state._edMode==="simple")return;
  const seq=d.actionMode==="seq";
  const miss=[];
  const src=d.source||{};
  if(src.kind==="gesture"&&!(src.takes||[]).length)miss.push(_gl("nagrania gestu","a recording of the gesture"));
  if(seq?!String(d.sequence||"").trim():!(String(d.keySpec||"").trim()||ruleNoAction(d)))
    miss.push(seq?_gl("makra","a macro"):_gl("klawisza","a key"));
  const txt=miss.length?_gl("Do zapisu brakuje: ","Still missing before saving: ")+miss.join(", ")+".":_gl("Wszystko gotowe, zapisz.","All set, save it.");
  if(edReadyPaint._k===txt)return;
  const el=document.querySelector("#ruleEditor [data-edready]");if(!el)return;
  edReadyPaint._k=txt;
  el.textContent=txt;el.classList.toggle("ok",!miss.length);
}
// KROK „POCHYL TERAZ KAPSEL…” (F-G1-07). Kierunek zależy od chwytu i od odwrócenia osi w Czujniku,
// więc kafel kierunkowy najpierw pokazuje, co aplikacja uważa za tę stronę: pasek rośnie przy
// ruchu w stronę reguły, kreska to próg. „U mnie to druga strona” zamienia znak w tej jednej regule.
function trigStepHtml(t){
  return `<div class="trig-step col2" id="trigStep">
      <p class="trig-step-t" data-noi18n>${esc(_gl("Pochyl teraz kapsel "+t.dir.pl[0],"Lean the capsule "+t.dir.en[0]+" now"))}</p>
      <p class="trig-step-s">Pasek pokazuje, jak mocno pochylasz. Przy kresce wciśnie się klawisz.</p>
      <div class="trig-meter" aria-hidden="true"><i></i><b></b></div>
      <div class="trig-meter-l" data-noi18n><span data-meter-now></span><span data-meter-at></span></div>
      <div class="trig-step-flip"><span>Pasek rusza się w drugą stronę?</span>
        <button type="button" class="btn sm" id="trigFlip">U mnie to druga strona</button></div></div>`;
}
function trigStepPaint(){
  const box=document.getElementById("trigStep"), d=state._draft, t=_edTileOf();
  if(!box||!d||!t||!t.dir)return;
  const p=state.pose, raw=(p&&d.source)?p[d.source.metric]:null;
  const sg=(d.cmp==="<")?-1:1, mag=Math.abs(+d.threshold||0), max=Math.max(mag*1.3,mag+8);
  const tw=(raw==null)?null:raw*sg;
  const fill=(tw==null)?0:Math.max(0,Math.min(1,tw/max));
  const w=(typeof _lang!=="undefined"&&_lang==="en")?t.dir.en:t.dir.pl;
  const now=(tw==null)?_gl("Teraz: brak ruchu z kapsla","Now: no motion from the capsule")
    :_gl("Teraz: ","Now: ")+Math.round(Math.abs(tw))+"° "+(tw>=0?w[0]:w[1]);
  const at=_gl("klawisz od ","key from ")+Math.round(mag)+"°";
  const k=fill.toFixed(3)+"|"+now+"|"+at;
  if(box._k===k)return;
  box._k=k;
  box.style.setProperty("--fill",(fill*100).toFixed(1)+"%");
  box.style.setProperty("--at",(mag/max*100).toFixed(1)+"%");
  box.classList.toggle("is-over",tw!=null&&tw>=mag);
  const n=box.querySelector("[data-meter-now]"), a=box.querySelector("[data-meter-at]");
  if(n)n.textContent=now; if(a)a.textContent=at;
}
// Podsumowanie zwiniętego „Warunek i zachowanie” (L4e): kierunek słowami tylko wtedy, gdy reguła dalej jest
// prostym pochyleniem (inaczej wzór, żeby zdanie nigdy nie kłamało), zachowanie słowami słownika.
function edAdvSum(d,t){
  let cond;
  const simple=!(d.extraConditions||[]).length&&!d.abs&&!d.neg&&(d.cmp==="<"||d.cmp===">");
  if(t&&t.dir&&simple&&d.source&&d.source.kind==="filter"){
    const m=Math.round(Math.abs(+d.threshold||0));
    cond=_gl(t.dir.pl[0]+" ponad "+m+"°",t.dir.en[0]+" beyond "+m+"°");
  }else cond=ruleCondLabel(d);
  const beh=d.behavior==="hold"?_gl("trzyma klawisz, póki trwa","holds the key while it lasts")
    :d.behavior==="once"?_gl("raz","once"):ruleBehLabel(d);
  return cond+" · "+beh;
}
// ===== UX 261120 L4e: piętra edytora wyzwalacza =====
// Rzadkie zachowania (piętro 3); podstawowe (Jednorazowo, Ciągłe, Przytrzymaj) stoją na piętrze 2.
const ED_BEH_MORE=["multi","taps","dwell","latch"];
function _edTuneSnap(d){return {source:d.source,cmp:d.cmp,threshold:d.threshold,thresholdHi:d.thresholdHi,
  abs:d.abs,neg:d.neg,behavior:d.behavior,intervalMs:d.intervalMs,layer:d.layer};}
function _edAdvSnap(d){return {extraConditions:d.extraConditions,behavior:d.behavior,crossings:d.crossings,
  windowMs:d.windowMs,dwellMs:d.dwellMs,glow:d.glow,led:d.led,toast:d.toast};}
const _edSame=(a,b)=>JSON.stringify(a==null?null:a)===JSON.stringify(b==null?null:b);
// Piętro 2 liczy zmiany tylko względem kafla, od którego zaczęto (`state._edRef`). W edytorze
// ręcznym warunek główny nie ma wartości domyślnej, bo to on JEST regułą; nagłówek i tak go podaje.
function edTuneChanged(d){
  const r=state._edRef;if(!r)return 0;
  const basic=ED_BEH_MORE.indexOf(d.behavior)<0;
  let n=0;
  if(!_edSame(d.source,r.source))n++;
  if(d.cmp!==r.cmp)n++;
  if(+d.threshold!==+r.threshold)n++;
  if(!_edSame(d.thresholdHi,r.thresholdHi))n++;
  if(!!d.abs!==!!r.abs)n++;
  if(!!d.neg!==!!r.neg)n++;
  if(basic&&d.behavior!==r.behavior)n++;
  if((d.behavior==="continuous"||d.behavior==="hold")&&+d.intervalMs!==+r.intervalMs)n++;
  if((+d.layer||0)!==(+r.layer||0))n++;
  return n;
}
function edTuneReset(d){
  const r=state._edRef;if(!r)return;
  const keep=ED_BEH_MORE.indexOf(d.behavior)>=0?d.behavior:null;   // rzadkie zachowanie należy do piętra 3
  Object.assign(d,JSON.parse(JSON.stringify(r)));
  if(keep)d.behavior=keep;
  renderEditor();
}
// Piętro 3 ma stałe wartości domyślne nowej reguły; pola liczbowe liczą się tylko wtedy, gdy je widać.
function edAdvChanged(d){
  let n=(d.extraConditions||[]).length;
  if(ED_BEH_MORE.indexOf(d.behavior)>=0)n++;
  if((d.behavior==="multi"||d.behavior==="taps")&&+d.crossings!==2)n++;
  if((d.behavior==="multi"||d.behavior==="taps")&&+d.windowMs!==600)n++;
  if(d.behavior==="dwell"&&+d.dwellMs!==500)n++;
  if(d.glow===false)n++;
  if(d.led&&d.led.on)n++;
  if(d.toast&&d.toast.on)n++;
  return n;
}
function edAdvReset(d){
  const r=state._edRef;
  if(ED_BEH_MORE.indexOf(d.behavior)>=0)d.behavior=(r&&ED_BEH_MORE.indexOf(r.behavior)<0)?r.behavior:"once";
  d.extraConditions=[];d.crossings=2;d.windowMs=600;d.dwellMs=500;d.glow=true;
  d.led={on:false,ms:(d.led&&d.led.ms!=null)?d.led.ms:300};
  d.toast=Object.assign({mode:"fire",silent:true},d.toast||{},{on:false});
  renderEditor();
}
function edTuneSum(d,t){
  let s=edAdvSum(Object.assign({},d,{extraConditions:[]}),t).replace(/^[^\p{L}\p{N}]+/u,"");   // bez emoji źródła
  if(+d.layer)s+=" · "+_gl("warstwa ","layer ")+d.layer;
  return s;
}
// Po każdym renderze: dwa zwijaki dostają rfTier (podsumowanie, „zmienione: N”, „Przywróć
// domyślne” przez rfUndo). Przywrócenie i cofnięcie przerysowują edytor tylko wtedy, gdy dalej
// stoi w nim ten sam szkic.
function edTiersWire(d,tile){
  const tune=document.getElementById("edTune"), adv=document.getElementById("edAdv");
  if(typeof rfTier!=="function"||!tune||!adv){state._edAdvSync=null;return;}
  const back=snap=>{if(state._draft!==d)return;Object.assign(d,snap);renderEditor();};
  const s2=rfTier(tune,tile?"mapowanie.edytor.warunek":"mapowanie.edytor.warunek-recznie",tile?{
    sum:()=>edTuneSum(d,tile), changed:()=>edTuneChanged(d),
    reset:()=>edTuneReset(d), take:()=>_edTuneSnap(d), restore:back
  }:{sum:()=>edTuneSum(d,null), changed:()=>0});
  const s3=rfTier(adv,"mapowanie.edytor.zaawansowane",{
    changed:()=>edAdvChanged(d), reset:()=>edAdvReset(d), take:()=>_edAdvSnap(d), restore:back
  });
  state._edAdvSync=()=>{s2();s3();};
}
// (koniec sekcji L4e w rf-12)
// GDZIE STOI EDYTOR. Kontroler pożycza #ruleEditor i przenosi go w `after` openEditor, czyli po
// renderze, więc to, co zależy od miejsca, poprawiamy tu (z pętli klatek, bez dotykania DOM-u, gdy
// nic się nie zmieniło): w Kontrolerze reguła jest mapowaniem przycisku pada (F-G3-06), a klasa
// `is-editing` ma siedzieć na karcie, w której edytor naprawdę stoi.
function _edPlaceSync(){
  const ed=document.getElementById("ruleEditor");if(!ed||!state._draft)return;
  const inPad=!!ed.closest("#padRuleEditorSlot");
  const b=document.getElementById("edSave");
  const t=inPad?_gl("Zapisz mapowanie","Save mapping"):_gl("Zapisz wyzwalacz","Save trigger");
  if(b&&b.textContent!==t)b.textContent=t;
  const host=ed.closest(".card");
  if(host&&!host.classList.contains("is-editing"))_edHostMark(true);
}
// (koniec sekcji B1 w rf-12)
function wireEditor(){
  const d=state._draft,$=id=>document.getElementById(id);
  // Gotowy gest — wybór nakłada pola szablonu i przerysowuje edytor (zmienia się źródło, więc i
  // cała karta warunku). Wybrana pozycja zostaje na liście, żeby było widać, od czego wyszliśmy.
  if($("edGesture"))$("edGesture").onchange=e=>{
    const gp=(typeof GESTURE_PRESETS!=="undefined")?GESTURE_PRESETS:[];
    const g=gp.find(x=>x.key===e.target.value);
    state._gesturePick=g?g.key:"";
    if(g)applyGesturePreset(d,g);
    renderEditor();};
  if($("edLabel"))$("edLabel").oninput=e=>d.label=e.target.value;
  // BEHAVIOR
  document.querySelectorAll("#ruleEditor .seg-beh button[data-b]").forEach(b=>b.onclick=()=>{d.behavior=b.dataset.b;renderEditor();});
  // Podłoga odstępu zależy od tego, czy reguła cokolwiek naciska (patrz NOACT_MIN_IV w rf-10).
  const syncIv=v=>{const _lo=(ruleNoAction(d)&&d.actionMode!=="seq")?NOACT_MIN_IV:10;
    v=Math.max(_lo,Math.min(5000,v||100));d.intervalMs=v;if($("edIv"))$("edIv").value=v;
    if($("edIvRange"))$("edIvRange").value=Math.min(2000,v);if($("edIvVal"))$("edIvVal").textContent=v;};
  if($("edIv"))$("edIv").oninput=e=>syncIv(+e.target.value);
  if($("edIvRange"))$("edIvRange").oninput=e=>syncIv(+e.target.value);
  if($("edCross"))$("edCross").oninput=e=>d.crossings=Math.max(2,Math.min(8,+e.target.value||2));
  if($("edWin"))$("edWin").oninput=e=>d.windowMs=Math.max(100,Math.min(10000,+e.target.value||600));
  if($("edDwell"))$("edDwell").oninput=e=>d.dwellMs=Math.max(50,Math.min(10000,+e.target.value||500));
  if($("edLayer"))$("edLayer").onchange=e=>d.layer=Math.max(0,Math.min(4,+e.target.value||0));
  if($("edGlow"))$("edGlow").onchange=e=>d.glow=e.target.checked;
  if($("edLed"))$("edLed").onchange=e=>{d.led=d.led||{on:false,ms:300};d.led.on=e.target.checked;
    const f=$("edLedMsFld");if(f)f.style.display=e.target.checked?"":"none";};
  if($("edLedMs"))$("edLedMs").oninput=e=>{d.led=d.led||{on:false,ms:300};d.led.ms=Math.max(0,Math.min(10000,+e.target.value||0));};
  // System notification for THIS rule (sent by the server engine, so it also works with the
  // dashboard closed). Switching it on — or changing the mode — pushes a preview notification right
  // away: otherwise the user has to provoke the trigger to find out what they just chose, and on a
  // machine that cannot show one (--no-tray) they would never find out at all.
  const _toastDraft=()=>(d.toast=d.toast||{on:false,mode:"fire",silent:true,text:""});
  const _toastPreview=()=>{if(d.toast.on&&typeof rfNotifyPreviewRule==="function")
    rfNotifyPreviewRule(d.label||ruleSrcLabel(d),d.toast.mode,d.toast.silent!==false,d.toast.text);};
  if($("edToast"))$("edToast").onchange=e=>{_toastDraft().on=e.target.checked;
    const f=$("edToastModeFld");if(f)f.style.display=e.target.checked?"":"none";
    _toastPreview();};
  if($("edToastMode"))$("edToastMode").onchange=e=>{
    _toastDraft().mode=(e.target.value==="active")?"active":"fire";_toastPreview();};
  if($("edToastSilent"))$("edToastSilent").onchange=e=>{
    _toastDraft().silent=e.target.checked;_toastPreview();};
  // Own wording. Typed live (oninput) but previewed only on 'change', so a preview does not fire
  // on every keystroke.
  if($("edToastText")){$("edToastText").oninput=e=>{_toastDraft().text=e.target.value.slice(0,120);};
    $("edToastText").onchange=_toastPreview;}
  // ACTION: key / macro
  // Wpisany klawisz WYGRYWA z „bez klawisza": flaga `noAction` opisuje regułę, która nic nie
  // naciska, więc nie ma prawa współistnieć z akcją. Bez przerysowania edytora — to jest pole,
  // w którym się PISZE, a render przy każdym znaku zabrałby kursor.
  if($("edKey"))$("edKey").oninput=e=>{d.keySpec=e.target.value.trim();
    if(d.keySpec)d.noAction=false;
    _edSpecShow(d.keySpec);updPadNote();updNoActNote();};
  if($("edQuick"))$("edQuick").onchange=e=>{
    const v=e.target.value;
    if(!v)return;                       // „— szybki wybór —" niczego nie ustawia
    const was=ruleNoAction(d);
    if(specIsNoAction(v)){d.noAction=true;d.keySpec="";}   // token listy NIE wchodzi do reguły
    else{d.noAction=false;d.keySpec=v;}
    $("edKey").value=d.keySpec;_edSpecShow(d.keySpec);
    updPadNote();
    // Przejście „klawisz ↔ bez klawisza" zmienia RODZAJ reguły, a nie jej parametr: inaczej
    // wygląda sekcja Zachowanie (Przytrzymaj, Ciągłe). Dlatego tu — i tylko tu — przerysowujemy
    // edytor: raz na taki wybór, nigdy przy pisaniu. Fokus wraca na tę samą listę.
    if(ruleNoAction(d)!==was){renderEditor();const q=document.getElementById("edQuick");if(q)try{q.focus();}catch(_e){}}
    else updNoActNote();};
  if($("edCap"))$("edCap").onclick=()=>captureKey($("edCap"));
  if($("edPoint"))$("edPoint").onclick=()=>{if(typeof ptOpen==="function")ptOpen("key");};
  document.querySelectorAll("#ruleEditor .seg-am button[data-am]").forEach(b=>b.onclick=()=>{d.actionMode=b.dataset.am;renderEditor();});
  updPadNote();
  updNoActNote();
  if(typeof ptWire==="function")ptWire();
  if($("edSeq")){const upd=()=>{d.sequence=$("edSeq").value;const p=$("edSeqPrev");
    if(p)p.textContent=seqPreview(d.sequence);updPadNote();}; $("edSeq").oninput=upd; upd();
    renderSeqLib();
    if($("seqLib"))$("seqLib").onchange=()=>renderSeqLib();
    if($("seqRec"))$("seqRec").onclick=toggleSeqRec;}
  // CONDITIONS (main cc=-1 + additional cc=0..) — one consistent handling per card
  document.querySelectorAll("#ruleEditor .ed-cond-card").forEach(card=>{
    const cc=+card.dataset.cc, cond=cc<0?d:d.extraConditions[cc]; if(!cond)return;
    card.querySelectorAll(".seg-sm button[data-ck]").forEach(bn=>bn.onclick=()=>{
      const k=bn.dataset.ck;
      if(k==="axis")cond.source={kind:"axis",channel:0};
      else if(k==="filter"){cond.source={kind:"filter",metric:"tilt"};cond.threshold=30;cond.cmp=">";cond.abs=false;}
      else if(k==="trigger")cond.source={kind:"trigger",ref:""};   // link to another trigger
      else if(k==="gesture"){cond.source=(typeof gestNewSource==="function")?gestNewSource():{kind:"gesture",takes:[]};
        // an event source cannot carry a level-shaped behaviour (see renderEditor)
        if(cc<0&&["hold","continuous","dwell"].includes(d.behavior))d.behavior="once";}
      else {let bb={byte:1,bit:0};try{const sv=localStorage.getItem("ribbitflip.btnbit");if(sv)bb=JSON.parse(sv);}catch(e){}
        cond.source={kind:"button",any:true,holdMs:250,byte:bb.byte,bit:bb.bit};}  // default AUTO (no learning)
      renderEditor();});
    const syncThr=v=>{cond.threshold=v;
      const n=card.querySelector("[data-cf=threshold]");if(n)n.value=v;
      const r=card.querySelector("[data-cf=thrRange]");if(r)r.value=v;
      const t=card.querySelector("[data-cf=thrVal]");if(t)t.textContent=v;};
    const syncThrHi=v=>{cond.thresholdHi=v;
      const n=card.querySelector("[data-cf=thresholdHi]");if(n)n.value=v;
      const r=card.querySelector("[data-cf=thrRangeHi]");if(r)r.value=v;
      const t=card.querySelector("[data-cf=thrValHi]");if(t)t.textContent=v;};
    card.querySelectorAll("[data-cf]").forEach(el=>{
      const f=el.dataset.cf;
      if(f==="channel")el.onchange=e=>{cond.source.channel=+e.target.value;renderEditor();};
      else if(f==="metric")el.onchange=e=>{cond.source.metric=e.target.value;renderEditor();};
      else if(f==="byte")el.onchange=e=>{cond.source.byte=+e.target.value;renderEditor();};
      else if(f==="bit")el.onchange=e=>{cond.source.bit=+e.target.value;renderEditor();};
      else if(f==="any")el.onchange=e=>{cond.source.any=e.target.checked;renderEditor();};
      else if(f==="holdMs")el.oninput=e=>{cond.source.holdMs=Math.max(20,Math.min(5000,+e.target.value||250));};
      else if(f==="abs")el.onchange=e=>{cond.abs=e.target.checked;renderEditor();};
      else if(f==="cmp")el.onchange=e=>{cond.cmp=e.target.value;   // switching to/from range → redraw (show/hide "To (y)")
        if((cond.cmp==="in"||cond.cmp==="out")&&(cond.thresholdHi==null))cond.thresholdHi=cond.threshold;renderEditor();};
      else if(f==="threshold")el.oninput=e=>syncThr(+e.target.value||0);
      else if(f==="thrRange")el.oninput=e=>syncThr(+e.target.value);
      else if(f==="thresholdHi")el.oninput=e=>syncThrHi(+e.target.value||0);
      else if(f==="thrRangeHi")el.oninput=e=>syncThrHi(+e.target.value);
      else if(f==="setcur")el.onclick=()=>{const v=curVal(cond);if(v!=null)syncThr(Math.round(v));};
      else if(f==="setcurHi")el.onclick=()=>{const v=curVal(cond);if(v!=null)syncThrHi(Math.round(v));};
      else if(f==="learn")el.onclick=()=>{state._learnBtn=cc;el.textContent="naciśnij przycisk na kapslu…";el.classList.add("on");
        flashTrigMsg("Naciśnij teraz przycisk na urządzeniu…");}
      else if(f==="op")el.onchange=e=>{cond.op=e.target.value;}                  // AND/OR (per condition, L→R)
      else if(f==="neg")el.onchange=e=>{cond.neg=e.target.checked;card.classList.toggle("is-neg",e.target.checked);}  // NEGATE
      else if(f==="ref")el.onchange=e=>{cond.source.ref=e.target.value;};        // linked trigger
    });
    const del=card.querySelector(".ed-cond-del");
    if(del)del.onclick=()=>{d.extraConditions.splice(cc,1);renderEditor();};
  });
  if($("edAddCond"))$("edAddCond").onclick=()=>{
    if(d.extraConditions.length>=4){flashTrigMsg("Maks. 4 dodatkowe warunki");return;}
    d.extraConditions.push({source:{kind:"axis",channel:0},abs:true,cmp:">",threshold:5000,op:"and",neg:false});
    renderEditor();};
  $("edSave").onclick=saveDraft;$("edCancel").onclick=closeEditor;
  // The mode bar, the gesture recorder boxes and their fields (rf-12e) — after everything
  // above, so a gesture card's own controls are bound on top of the generic [data-cf] ones.
  if(typeof gestWireCommon==="function")gestWireCommon();
  if(state._edMode!=="simple"&&typeof gestAfterRender==="function")gestAfterRender();
}
function seqPreview(s){
  const steps=String(s||"").replace(/\n/g,";").split(";").map(t=>t.trim()).filter(Boolean);
  if(!steps.length)return "—";
  return steps.map(t=>{const l=t.toLowerCase();
    if(l==="led on"||l==="led_on"||l==="ledon"||l==="led 1")return "💡 ON";
    if(l==="led off"||l==="led_off"||l==="ledoff"||l==="led 0")return "💡 OFF";
    const sp=l.split(/\s+/);
    if((sp[0]==="down"||sp[0]==="hold")&&sp.length>1){const key=t.slice(t.indexOf(" ")+1).trim();return "⬇"+keyLabel(key);}
    if((sp[0]==="up"||sp[0]==="release"||sp[0]==="puść"||sp[0]==="pusc")&&sp.length>1){const key=t.slice(t.indexOf(" ")+1).trim();return "⬆"+keyLabel(key);}
    let ms=null;
    for(const p of ["wait ","czekaj ","delay "])if(l.startsWith(p)){const n=l.slice(p.length).replace("ms","").trim();if(/^\d+$/.test(n))ms=+n;}
    if(ms===null&&/^\d+\s*ms$/.test(l))ms=parseInt(l);
    return ms!==null?`⏱${ms}ms`:keyLabel(t);
  }).join(" → ");
}
function specFromEvent(e){let main;const k=e.key;
  if(JSKEY[k]!==undefined)main=JSKEY[k];
  else if(/^F\d{1,2}$/.test(k))main=k.toLowerCase();
  else if(k.length===1)main=k.toLowerCase();
  else return null;
  const mods=[];if(e.ctrlKey)mods.push("ctrl");if(e.altKey)mods.push("alt");
  if(e.shiftKey)mods.push("shift");if(e.metaKey)mods.push("cmd");
  return mods.concat([main]).join("+");}
// Reusable "press a key" capture: the next key (with its modifiers) becomes a spec and goes to onSpec.
// A click anywhere else cancels, so a forgotten capture cannot keep swallowing the keyboard.
// `idle` is the label the button returns to (the wheel row uses a bare icon).
function captureKeyTo(btn,onSpec,idle){
  if(btn._capOff){btn._capOff();return;}   // second click on the same button = cancel
  const back=idle!=null?idle:btn.textContent;
  btn.textContent=_gl("naciśnij teraz…","press a key now…");btn.classList.add("on");
  const off=()=>{window.removeEventListener("keydown",h,true);window.removeEventListener("pointerdown",away,true);
    btn._capOff=null;btn.textContent=back;btn.classList.remove("on");};
  // Przycisk zniknął ze strony (lista wycinków koła przerysowała się sama, np. po zdarzeniu ze
  // strumienia albo stopie awaryjnym): nasłuch zdejmuje się sam i NIE połyka klawisza. Inaczej
  // następny klawisz gdziekolwiek w panelu zapisywał się jako akcja wycinka, którego już nie widać.
  const away=e=>{if(!btn.isConnected||(e.target!==btn&&!btn.contains(e.target)))off();};
  const h=e=>{if(!btn.isConnected){off();return;}
    e.preventDefault();e.stopPropagation();
    if(["Control","Shift","Alt","Meta"].includes(e.key))return;   // wait for the right key
    off();
    const spec=specFromEvent(e);if(spec)onSpec(spec);};
  btn._capOff=off;
  window.addEventListener("keydown",h,true);window.addEventListener("pointerdown",away,true);
}
function captureKey(btn){
  captureKeyTo(btn,spec=>{
    state._draft.keySpec=spec;
    const k=document.getElementById("edKey");if(k)k.value=spec;
    _edSpecShow(spec);},"⌨ Naciśnij klawisz…");
}
// Sekcja „Akcja" na czerwono na chwilę — komunikat `flashTrigMsg` stoi w pasku NAD listą reguł,
// czyli poza edytorem, a odmowa zapisu musi wskazać pole, o które chodzi. Klasa gaśnie sama, żeby
// nie zostawiać czerwonej ramki na polu, które człowiek właśnie wypełnia.
// POWÓD ODMOWY IDZIE TERAZ RAZEM Z OBWÓDKĄ. Przy edytorze przewiniętym do „Zapisz" pasek `#trigMsg`
// stoi ~590 px nad widokiem — człowiek widział samą czerwoną ramkę i nie wiedział, czego brakuje.
// `msg` ląduje pod nagłówkiem sekcji jako `.ed-sec-msg`, `aria-hidden`, bo to samo zdanie ogłasza
// już aria-live `#trigMsg`; `focusId` przenosi kursor do pola, którego brakuje (i przewija do niego).
// The refusal now carries its reason next to the field, not only in the bar above the rule list.
function _edFlagAction(msg,focusId){
  const s=document.querySelector('#ruleEditor .ed-sec[data-sec="action"]');
  if(!s)return;
  s.classList.remove("ed-sec-err");void s.offsetWidth;   // re-trigger the flash on a second click
  s.classList.add("ed-sec-err");
  const h=s.querySelector(".ed-sec-h");
  if(msg&&h){
    let m=s.querySelector(".ed-sec-msg");
    if(!m){m=document.createElement("div");m.className="ed-sec-msg";m.setAttribute("aria-hidden","true");h.insertAdjacentElement("afterend",m);}
    m.textContent=msg;
  }
  let k=document.getElementById(focusId||"edKey");
  if(k&&k.closest("details:not([open])"))k=document.getElementById("edCap")||k;   // pole składni bywa zwinięte (P-G1-08)
  if(k)try{k.focus();}catch(e){}
  clearTimeout(_edFlagAction._t);
  _edFlagAction._t=setTimeout(()=>{s.classList.remove("ed-sec-err");
    const m=s.querySelector(".ed-sec-msg");if(m)m.remove();},2600);
}
function saveDraft(){
  const d=state._draft;
  // A gesture condition without a recording is a rule that can never fire — refused here, with
  // the card flagged, the same way an empty action is refused below. The simple mode also
  // normalises the draft to what it showed (one gesture, fired once).
  if(typeof gestValidateDraft==="function"&&!gestValidateDraft(d))return;
  if(d.actionMode==="seq"){
    // Pusta sekwencja odmawiała zapisu bez obwódki i bez fokusu — tylko zdanie w pasku nad listą,
    // często poza ekranem. Teraz tak samo jak brak akcji niżej: sekcja świeci, pole dostaje kursor.
    if(!String(d.sequence||"").trim()){const m=_gl("Wpisz sekwencję","Enter a sequence");flashTrigMsg(m);_edFlagAction(m,"edSeq");return;}
    d.noAction=false;   // makro JEST akcją — flaga „nic nie naciska" nie ma tu czego opisywać
  }else{
    // Odmowa zapisu bez akcji — jedyne, co trzyma obietnicę „akcję dopisujesz sam" po tym, jak
    // nowa reguła przestała rodzić się ze strzałką w prawo. Sekcja „Akcja" dostaje przy okazji
    // obwódkę błędu, bo komunikat stoi w pasku nad listą, a pole jest niżej.
    // ŚWIADOME „bez klawisza" (`noAction`) przechodzi: to nie jest brak wyboru, tylko wybór —
    // reguła istnieje po to, żeby oprzeć na niej wyzwalacz Usług sieciowych albo warunek
    // „Wyzwalacz” w innej regule. Rozróżnienie niesie pole, nie pusty `keySpec` (rf-10, QUICKKEYS).
    if(!d.keySpec&&!d.noAction){const m=_gl("Wybierz klawisz / akcję","Choose a key / action");flashTrigMsg(m);_edFlagAction(m,"edKey");return;}
    d.sequence="";   // single mode -> no macro
    if(d.noAction){
      d.keySpec="";                       // token listy („none") nie ma prawa wyjechać z panelu
      // Ta sama podłoga, co w `sanitize_rules`: reguła bez klawisza powtarzana co 10 ms zalałaby
      // odbiorcę żądaniami. Zapisujemy TU, żeby serwer i panel trzymały tę samą liczbę.
      if(d.behavior==="continuous")d.intervalMs=Math.max(NOACT_MIN_IV,Math.min(5000,+d.intervalMs||100));
    }
  }
  delete d.actionMode;   // UI-only field
  d.layer=Math.max(0,Math.min(4,+(d.layer||0)));   // 0 = „Zawsze"; also repairs an imported oddity
  const i=state.rules.findIndex(x=>x.id===d.id);
  const _isNew=(i<0);
  if(i>=0)state.rules[i]=d;else state.rules.push(d);
  closeEditor();commitRules();
  // WARSTWA REGUŁY WYGRYWA Z WARSTWĄ LISTY. Reguła zapisana na warstwę 2, gdy lista stoi na 1,
  // wjeżdżała przygaszona (`rule-offlayer`) i bez słowa wyjaśnienia — wyglądało to jak zapis,
  // który się nie udał. Idziemy tą samą drogą, co kafelki „Warstwa: 1 2 3 4" nad listą
  // (`trigSetLayer` → POST /layer), żeby były dwie drogi do jednego stanu, a nie dwa stany.
  if(d.layer>=1&&d.layer<=4&&(state.activeLayer||1)!==d.layer&&typeof trigSetLayer==="function")trigSetLayer(d.layer);
  // PIERWSZA REGUŁA PRZY WYŁĄCZONYM MODULE (F-G1-05). Zapis się udał, ale nic nie będzie
  // naciskane, dopóki moduł jest wyłączony, a nowa osoba tego jeszcze nie wie. Przycisk w bąblu
  // klika ten sam przełącznik co człowiek (z pytaniem o symulację).
  if(_isNew&&!state.trigEnabled&&typeof rfSay==="function"&&state.rules.filter(x=>!specIsPad(x.keySpec)).length===1)
    rfSay(_gl("Zapisano. Mapowanie jest wyłączone, więc reguła jeszcze nic nie naciska.","Saved. Mapping is off, so the rule presses nothing yet."),
      {tone:"warn",ms:15000,action:{label:_gl("Włącz","Turn on"),onClick:()=>{const te=document.getElementById("trigEnable");if(te&&!state.trigEnabled)te.click();}}});
  if(_isNew&&window.rfPopNew){const _rl=document.getElementById("rulesList");const _el=_rl&&_rl.querySelector('.rule-wrap[data-id="'+d.id+'"]');if(_el)window.rfPopNew(_el);}   // new trigger enters with animation
}

// --- save (POST -> server; localStorage = cache) ---
function commitRules(){
  try{localStorage.setItem(TRIG_LS,JSON.stringify(state.rules));}catch{}
  renderRules();
  fetch("/rules",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(state.rules)}).then(r=>r.json())
    .then(j=>{if(j&&j.ok)flashTrigMsg("Zapisano ("+j.count+")");})
    .catch(()=>flashTrigMsg("Offline — zapisano lokalnie"));
}
// PODPOWIEDŹ GŁÓWNEGO PRZEŁĄCZNIKA — osobna funkcja, bo zmienia się z DWÓCH powodów: przy każdym
// przestawieniu przełącznika (setArmed) i przy każdej zmianie skrótu stopu awaryjnego (rf-39j
// `_hkRender`: po /hotkey, po „Zmień skrót"/„Domyślny", po zmianie języka). Zdanie o stopie
// awaryjnym stoi TU, bo kombinację widać dziś tylko na ekranie Konfiguracja — a szuka się jej
// wtedy, gdy coś już leci do systemu, czyli patrząc na ten przycisk w pasku górnym.
// Kombinacja jest doklejana TYLKO wtedy, gdy skrót naprawdę działa (`rfHotkeyKeys()` — enabled
// I available); gdy go nie ma, podpowiedź milczy, zamiast obiecywać wyjście, którego nie ma, albo
// straszyć w dymku przełącznika zdaniem o wyłączonym stopie (od tego jest karta w Konfiguracji).
// Napisy przez `_gl` — składane w JS, więc bez kluczy w I18N_EN.
// TOOLTIP OF THE MASTER SWITCH — its own function because it changes for TWO reasons: the switch
// itself, and the emergency-stop combination (which is configurable, so it cannot be hard-coded).
function rfArmTipSync(){
  const b=document.getElementById("armBtn");if(!b)return;
  let t=_gl("Główny przełącznik wyjścia. Wstrzymane = nic nie wychodzi z żadnego modułu.",
            "Master output switch. Paused = nothing leaves any module.");
  const k=(typeof rfHotkeyKeys==="function")?rfHotkeyKeys():null;
  if(k)t+=" "+_gl("Stop awaryjny z klawiatury: ","Emergency stop from the keyboard: ")+k.join(" + ")+".";
  // Ten dymek SIĘ ZMIENIA (kombinacja skrótu, język), a walker i18n pamięta pierwszy napis, jaki
  // zobaczył w atrybucie, żeby móc go przywrócić w drodze do polskiego. Zostawiony w spokoju
  // przepisywałby nasz nowy tekst z powrotem na tłumaczenie STAREGO — po przełączeniu języka
  // zdanie o stopie awaryjnym znikało z dymka w tej samej milisekundzie, w której je dopisaliśmy.
  // Ta sama sztuczka i ten sam powód, co przy pigułce kapsla (rf-11-devices-ui.js:251-258).
  if(b._i18nA){delete b._i18nA.title;delete b._i18nA["data-rftip"];}
  b.title=t;   // rf-05 obserwuje [title] i przepisuje je na data-rftip (dymek aplikacji)
}
function setArmed(on,fromServer){
  state.armed=on; state.masterArmed=on;   // global master (single source of truth)
  const b=document.getElementById("armBtn");
  if(b){b.classList.toggle("on",on);
    // Napis jest NAZWĄ tego przycisku (rola „switch" + aria-checked niesie stan dla czytnika),
    // a podpowiedź mówi, czego dotyczy — bo „Wstrzymane" samo w sobie nie zdradza, że chodzi
    // o wszystkie moduły naraz. Rozdzielone też dlatego, że rf-05 od 2026-09-02 nie zabiera
    // widocznego napisu na aria-label (WCAG 2.5.3), tylko podpina tooltip jako opis.
    b.textContent=on?"⏻ Uzbrojone":"⏻ Wstrzymane";
    b.setAttribute("aria-checked",on?"true":"false");}
  rfArmTipSync();
  updateKeysNote();
  // Stopka („parametry: …") mówi to samo zdanie co reszta paska stanu, więc musi się zmienić razem
  // z przełącznikiem — inaczej po stopie awaryjnym zostawałaby na „sterowanie WŁĄCZONE".
  if(typeof rfCfgLineSync==="function")try{rfCfgLineSync();}catch(e){}
  if(typeof renderOverview==="function")try{renderOverview();}catch(e){}   // „Przegląd" pokazuje ten sam fakt
  if(typeof mUpdateNote==="function")mUpdateNote();          // mouse mode warning
  if(typeof miReflectEnable==="function")miReflectEnable();  // "live" indicator for the MIDI/OSC group
  if(typeof trigReflectEnable==="function")trigReflectEnable(); // "live" indicator for the Mapping group
  if(!fromServer)fetch("/arm",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({armed:on})}).catch(()=>{});
}
// whether keys actually reach the system (armed + emitter alive). SIMULATION COUNTS: the synthetic
// (or hand-driven) capsule drives the system for real, which is the whole point of testing
// triggers without hardware. Only --no-keys / paused / a capsule on hold keep it at preview.
// NOT mute: muting is the app's own sound, and it never had any business stopping the keyboard.
function keysLive(){const D=state.devices[state.activeDeviceId];
  return state.cfg.sendKeys && state.armed && !devOutOff(D);}
// PASEK MÓWI TYLKO „NA ŻYWO” (UX 261120, P-G1-02). Moduł wyłączony, sterowanie wstrzymane i tryb
// podglądu mówi teraz linia gotowości pod nagłówkiem modułu (rejestracja w initTriggers), z
// przyciskiem naprawy. Tu zostaje jedno ostrzeżenie: klawisze naprawdę lecą do aktywnego okna.
function updateKeysNote(){
  const kn=document.getElementById("trigKeysNote");
  const c=state.cfg;
  const warn=!!(c.sendKeys&&state.trigEnabled&&state.armed);
  if(kn){kn.textContent=warn?_gl("Uwaga: klawisze lecą do aktywnego okna","Heads up: keys go to the active window"):"";
    kn.style.color=warn?"var(--warn)":"";}
  const ab=document.getElementById("armBtn");if(ab)ab.classList.toggle("live",warn);
}
function testKey(spec){ if(spec)testAction({keySpec:spec}, keyLabel(spec)); else flashTrigMsg("Brak akcji"); }
function testRule(r){
  if(r.sequence)return testAction({sequence:r.sequence}, seqPreview(r.sequence));
  // „Brak akcji" przy regule bez klawisza brzmiałoby jak wytknięcie niedokończonej roboty, a to
  // jest cały jej sens — nie ma czego wysłać, bo ta reguła istnieje dla innych.
  if(typeof ruleNoAction==="function"&&ruleNoAction(r))
    return flashTrigMsg(_gl("Ta reguła nic nie naciska — jest wyzwalaczem dla innych.",
                            "This rule presses nothing — it is a trigger for other things."));
  testKey(r.keySpec);
}
function testAction(payload,label){
  // --no-keys / paused / capsule on hold -> preview only (nothing goes to the system). Simulation DOES send,
  // so it takes the countdown path like any live test.
  if(!keysLive()){ doTestAction(payload,label); return; }
  // real input goes to the FOCUSED WINDOW -> countdown to switch to the target
  startSendCountdown(payload,label);
}
function startSendCountdown(payload,label){
  let ov=document.getElementById("sendOverlay");
  if(!ov){ov=document.createElement("div");ov.id="sendOverlay";document.body.appendChild(ov);}
  let n=3;
  const render=()=>{ov.innerHTML=`<div class="so-box">
    <div class="so-top">Kliknij teraz w OKNO DOCELOWE<br><small>Notatnik, przeglądarkę, grę… — tam trafią klawisze</small></div>
    <div class="so-num">${n}</div>
    <div class="so-act">wysyłam: <b>${esc(label)}</b></div>
    <div class="so-hint">Esc = anuluj</div></div>`;};
  ov.style.display="flex"; render();
  const tick=()=>{ n--; if(n>0){render();state._soT=setTimeout(tick,1000);}
    else{ hideSendOverlay(); doTestAction(payload,label); } };
  state._soT=setTimeout(tick,1000);
  state._soEsc=(e)=>{ if(e.key==="Escape"){hideSendOverlay();flashTrigMsg("Test anulowany");} };
  window.addEventListener("keydown",state._soEsc,true);
}
function hideSendOverlay(){
  const ov=document.getElementById("sendOverlay");if(ov)ov.style.display="none";
  if(state._soT){clearTimeout(state._soT);state._soT=null;}
  if(state._soEsc){window.removeEventListener("keydown",state._soEsc,true);state._soEsc=null;}
}
function doTestAction(payload,label){
  fetch("/test-key",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)}).then(r=>r.json())
    .then(j=>{
      if(j&&j.ok===false)flashTrigMsg("Błąd: "+(j.error||"nieznana akcja"));
      else flashTrigMsg(j.sent?("Wysłano do aktywnego okna: "+label)
        :("Podgląd (nie wysłano): "+label));
    })
    .catch(()=>flashTrigMsg("Serwer nieosiągalny — uruchom ponownie RibbitFlip.exe"));
}
// UX 261120 A1: `#trigMsg` stoi w karcie Mapowania; wołane z innego ekranu (Mysz, Kontroler,
// Czujnik) pisało w miejsce, którego nie widać. Niewidoczne pole = mówi czaszka (`rfSay`).
// Nowy kod spoza edytora Mapowania woła `rfSay` wprost.
// Otwarty edytor mówi w swojej przyklejonej stopce (`#edMsg`, F-G1-06), bo pasek nad listą bywa
// wtedy schowany albo daleko nad widokiem; poza edytorem pasek `#trigMsg`, a z ekranu, na którym
// żadnego z nich nie widać, wspólny bąbel `rfSay`.
function flashTrigMsg(t){
  const em=document.getElementById("edMsg");
  const el=(em&&em.offsetParent)?em:document.getElementById("trigMsg");
  if(!el||!el.offsetParent){if(typeof rfSay==="function")rfSay(t);return;}
  el.textContent=t;el.classList.add("show");clearTimeout(el._t);
  el._t=setTimeout(()=>el.classList.remove("show"),1800);}
function updateTriggerLive(){
  for(const r of state.rules){const el=document.getElementById("rcur-"+r.id);if(!el)continue;
    const v=curVal(r);el.textContent=v==null?"—":v;}
}
// live preview of a SINGLE condition (axis/filter/button): trace + threshold line + trigger zone.
// Used for the main condition AND each additional one (each has its own canvas).
function drawCondScope(c, cond, head){     // c=canvas element, cond=condition, head=state element
  if(!c||!cond)return;
  if(cond.source&&cond.source.kind==="gesture"){   // a recorded gesture: a similarity meter (rf-12e)
    if(typeof gestDrawScope==="function")gestDrawScope(c,cond,head);
    return;
  }
  const {ctx,w,h}=fit(c);if(!w||!h)return;ctx.clearRect(0,0,w,h);
  if(cond.source.kind==="trigger"){       // source = another trigger: show its state (active/not)
    const rt=state.rt&&state.rt[cond.source.ref],on=!!(rt&&rt.active),cx=w/2,cy=h/2-4,r=Math.min(w,h)/3.4;
    ctx.globalAlpha=on?1:0.28;ctx.fillStyle=on?cv('--ok'):cv('--idle');
    ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fill();ctx.globalAlpha=1;
    ctx.fillStyle=cv('--ink');ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.font="700 16px "+cv('--mono');ctx.fillText(on?"1":"0",cx,cy);
    ctx.fillStyle=on?cv('--ok'):cv('--dim');ctx.font="11px "+cv('--sans');
    ctx.fillText(_cvT(on?"aktywny":"nieaktywny"),cx,cy+r+12);
    const met=condMet(cond);
    if(head){head.textContent=(met?"● spełniony":"– niespełniony")+(cond.neg?" (NEGUJ)":"");head.style.color=met?cv('--ok'):cv('--dim');}
    c.style.boxShadow=met?("inset 0 0 0 2px "+cv('--ok')):"none";
    return;
  }
  if(cond.source.kind==="button"){
    const v=curVal(cond),on=v===1,cx=w/2,cy=h/2-4,r=Math.min(w,h)/3.4;
    ctx.globalAlpha=on?1:0.28;ctx.fillStyle=on?cv('--ok'):cv('--idle');
    ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fill();ctx.globalAlpha=1;
    ctx.fillStyle=cv('--ink');ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.font="700 18px "+cv('--mono');ctx.fillText(v==null?"?":String(v),cx,cy);
    ctx.fillStyle=on?cv('--ok'):cv('--dim');ctx.font="12px "+cv('--sans');
    ctx.fillText(_cvT(on?"WCIŚNIĘTY":"zwolniony"),cx,cy+r+12);
    if(head){head.textContent=on?"● teraz: 1":"– teraz: "+(v==null?"?":v);head.style.color=on?cv('--ok'):cv('--dim');}
    c.style.boxShadow=on?("inset 0 0 0 2px "+cv('--ok')):"none";
    return;
  }
  let buf,col;
  if(cond.source.kind==="filter"){buf=(state.poseBuf&&state.poseBuf[cond.source.metric||"tilt"])||[];col=cv('--gz');}
  // A tuned channel is drawn AFTER its chain (same buffer the panel and the scopes use), because
  // that is the number the threshold is compared against. Untuned channels keep the raw buffer.
  else{const _ci=cond.source.channel|0;
    buf=chanSrcBuf(state.devices[state.activeDeviceId],AKEYS[_ci])||state.buf[RE_NAME[_ci]]||[];
    col=CHCOL(_ci);}
  const win=state.windowSec,end=state.nowTs,start=end-win;
  const Pl=46,Pr=10,Pt=10,Pb=14,pw=w-Pl-Pr,ph=h-Pt-Pb;
  const tr=v=>cond.abs?Math.abs(v):v,thr=cond.threshold;
  const isRange=(cond.cmp==="in"||cond.cmp==="out"),hi=(cond.thresholdHi!=null?cond.thresholdHi:thr);
  const rLo=Math.min(thr,hi),rHi=Math.max(thr,hi),thrs=isRange?[rLo,rHi]:[thr];
  let ymin=Infinity,ymax=-Infinity,n=0,sum=0,sum2=0,cur=curVal(cond);
  for(let i=buf.length-1;i>=0;i--){if(buf[i][0]<start-0.5)break;const v=tr(buf[i][1]);
    if(v<ymin)ymin=v;if(v>ymax)ymax=v;if(buf[i][0]>=end-1.5){n++;sum+=v;sum2+=v*v;}}
  ymin=Math.min(isFinite(ymin)?ymin:thr,...thrs,cond.abs?0:Math.min(...thrs));ymax=Math.max(isFinite(ymax)?ymax:thr,...thrs);
  if(ymax-ymin<1){ymin-=500;ymax+=500;}
  const pad=(ymax-ymin)*0.14;ymin-=pad;ymax+=pad;if(cond.abs&&ymin<0)ymin=0;
  const X=ts=>Pl+(ts-start)/win*pw,Y=v=>Pt+(1-(v-ymin)/(ymax-ymin))*ph;
  const over=v=>{if(cond.cmp==="<")return v<thr;if(cond.cmp==="<=")return v<=thr;if(cond.cmp===">=")return v>=thr;
    if(isRange)return cond.cmp==="in"?(v>=rLo&&v<=rHi):(v<rLo||v>rHi);return v>thr;};
  ctx.fillStyle=cv('--warn');ctx.globalAlpha=0.09;     // trigger zone
  if(isRange){const yA=Y(rLo),yB=Y(rHi);          // yB (larger value) higher than yA
    if(cond.cmp==="in")ctx.fillRect(Pl,yB,pw,yA-yB);
    else{ctx.fillRect(Pl,Pt,pw,Math.max(0,yB-Pt));ctx.fillRect(Pl,yA,pw,Math.max(0,Pt+ph-yA));}}
  else if(cond.cmp==="<"||cond.cmp==="<=")ctx.fillRect(Pl,Y(thr),pw,Pt+ph-Y(thr));
  else ctx.fillRect(Pl,Pt,pw,Y(thr)-Pt);
  ctx.globalAlpha=1;
  ctx.font="9px "+cv('--mono');ctx.textBaseline="middle";  // Y grid
  for(const tv of niceTicks(ymin,ymax,4)){const yy=Math.round(Y(tv))+0.5;
    ctx.strokeStyle=cv('--line');ctx.globalAlpha=0.25;ctx.beginPath();ctx.moveTo(Pl,yy);ctx.lineTo(Pl+pw,yy);ctx.stroke();
    ctx.globalAlpha=1;ctx.fillStyle=cv('--dim');ctx.textAlign="right";ctx.fillText(fmtTick(tv),Pl-4,yy);}
  const drawThrLine=(val,lab)=>{const ty=Y(val);    // threshold line (1 or 2 for range)
    ctx.strokeStyle=cv('--warn');ctx.lineWidth=1.4;ctx.setLineDash([5,3]);
    ctx.beginPath();ctx.moveTo(Pl,ty);ctx.lineTo(Pl+pw,ty);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=cv('--warn');ctx.textAlign="left";ctx.fillText(lab,Pl+3,(ty-7<Pt+5)?ty+8:ty-7);};
  if(isRange){drawThrLine(rLo,"⟵ od "+rLo);drawThrLine(rHi,"⟵ do "+rHi);}
  else drawThrLine(thr,"⟵ "+_cvT("próg")+" "+thr);
  ctx.strokeStyle=col;ctx.lineWidth=1.7;ctx.lineJoin="round";ctx.beginPath();let st=false;  // trace
  for(let i=0;i<buf.length;i++){const t=buf[i][0];if(t<start-0.5)continue;const px=X(t),py=Y(tr(buf[i][1]));
    if(!st){ctx.moveTo(px,py);st=true;}else ctx.lineTo(px,py);}
  ctx.stroke();
  if(cur!=null){const py=Y(cur);ctx.fillStyle=col;ctx.beginPath();ctx.arc(Pl+pw-1,py,3.4,0,7);ctx.fill();}  // current
  const isOver=cur!=null&&over(cur);
  c.style.boxShadow=isOver?("inset 0 0 0 2px "+cv('--warn')):"none";
  if(head){const mean=n?sum/n:0,std=n?Math.sqrt(Math.max(0,sum2/n-mean*mean)):0;
    head.textContent=(isOver?_gl("● WYZWALA — teraz ","● TRIGGERS — now "):_gl("– poniżej — teraz ","– below — now "))+(cur==null?"?":cur)+` · σ ${std.toFixed(0)}`;
    head.style.color=isOver?cv('--warn'):cv('--dim');}
}
function condMet(cond){   // whether the SINGLE condition is met NOW (with NEGATE) — mirrors the backend
  const s=cond.source||{};let m=false;
  if(s.kind==="gesture"){m=(typeof gestCondMet==="function")?gestCondMet(cond):false;}   // the draft's live trial (rf-12e)
  else if(s.kind==="trigger"){const rt=state.rt&&state.rt[s.ref];m=!!(rt&&rt.active);}
  else{const v=curVal(cond);
    if(v!=null){
      if(s.kind==="button")m=(v===1);
      else{const thr=cond.threshold,c=cond.cmp;
        if(c==="in"||c==="out"){const hi=(cond.thresholdHi!=null?cond.thresholdHi:thr),a=Math.min(thr,hi),b=Math.max(thr,hi);
          m=(c==="in")?(v>=a&&v<=b):(v<a||v>b);}
        else m=(c==="<")?v<thr:(c==="<=")?v<=thr:(c===">=")?v>=thr:v>thr;}
    }}
  return cond.neg?!m:m;
}
// Sequential combination of conditions (op/neg, left→right) — MIRROR of backend _rule_over.
// conds[0] = main condition (draft), conds[1..] = additional (each with its .op AND/OR).
function evalDraftOver(conds){
  let acc=false;
  conds.forEach((c,i)=>{const v=condMet(c); acc=(i===0)?v:(c.op==="or"?(acc||v):(acc&&v));});
  return acc;
}
// whether the condition is MET for a specific VALUE v (after NEGATE) — for coloring the chart over time
function condSatAt(cond, v){
  if(v==null)return false;
  const s=cond.source||{};let m;
  if(s.kind==="button"||s.kind==="trigger")m=(v>0.5);
  else{const thr=+cond.threshold||0,c=cond.cmp;
    if(c==="in"||c==="out"){const hi=(cond.thresholdHi!=null?+cond.thresholdHi:thr),a=Math.min(thr,hi),b=Math.max(thr,hi);
      m=(c==="in")?(v>=a&&v<=b):(v<a||v>b);}
    else m=(c==="<")?v<thr:(c==="<=")?v<=thr:(c===">=")?v>=thr:v>thr;}
  return cond.neg?!m:m;
}
// ACTIVATION preview in the editor — FAITHFUL mirror of backend logic (tick) for the edited DRAFT.
// Shows when the rule would ACTUALLY activate per the behavior, not just whether the condition is currently met:
//  • once/continuous/hold — active immediately once all conditions are met,
//  • dwell ("After time") — counts down dwellMs of UNINTERRUPTED fulfillment → activation only after the time (reset on drop),
//  • multi ("X times within time") — counts N fulfillment edges within windowMs → activation once N is collected (window expires → reset).
// Time measured by a real-time clock (performance.now), independent of sample rate.
function behPreview(d, allMet){
  const now=performance.now()/1000;
  let bp=state._behPrev;
  if(!bp){bp=state._behPrev={over:false,dwellStart:0,fired:false,seqCount:0,seqStart:0,flashUntil:0};}
  const beh=d.behavior||'once';
  if(beh==='latch'){
    // Same edge/state split the server keeps: `over` is the rising edge of the CONDITION,
    // `latched` is the switch it flips. Without both, the preview would toggle every frame.
    if(allMet&&!bp.over){bp.over=true;bp.latched=!bp.latched;}
    else if(!allMet&&bp.over){bp.over=false;}
    return bp.latched
      ? {cls:'all',label:_gl('⏻ włączony (kolejne spełnienie wyłączy)','⏻ on (next time it goes off)')}
      : {cls:'none',label:_gl('⏻ wyłączony (spełnienie warunku włączy)','⏻ off (meeting the condition turns it on)')};
  }
  if(beh==='dwell'){
    const dwell=Math.max(50,Math.min(10000,+d.dwellMs||500))/1000;
    if(allMet){
      if(!bp.over){bp.over=true;bp.dwellStart=now;bp.fired=false;}
      if(!bp.fired&&(now-bp.dwellStart)>=dwell)bp.fired=true;
      if(bp.fired)return {cls:'all',label:_gl('⚡ aktywowano','⚡ activated')};
      return {cls:'some',label:_gl(`spełnione — aktywacja za ${Math.max(0,dwell-(now-bp.dwellStart)).toFixed(1)} s`,`met — activates in ${Math.max(0,dwell-(now-bp.dwellStart)).toFixed(1)} s`)};
    }
    bp.over=false;bp.fired=false;
    return {cls:'none',label:_gl(`czekam na nieprzerwane spełnienie (${dwell.toFixed(1)} s)`,`waiting for ${dwell.toFixed(1)} s of unbroken fulfilment`)};
  }
  if(beh==='multi'){
    const need=Math.max(2,Math.min(8,+d.crossings||2));
    const win=Math.max(0.1,Math.min(10,(+d.windowMs||600)/1000));
    if(bp.seqCount>0&&(now-bp.seqStart)>win)bp.seqCount=0;            // window expired
    if(allMet&&!bp.over){                                            // fulfillment edge
      bp.over=true;
      if(bp.seqCount===0)bp.seqStart=now;
      bp.seqCount++;
      if(bp.seqCount>=need){bp.seqCount=0;bp.flashUntil=now+0.9;}     // N collected → activation (flash)
    } else if(!allMet&&bp.over){bp.over=false;}
    if(bp.flashUntil&&now<bp.flashUntil)return {cls:'all',label:_gl(`⚡ aktywowano (${need}×)`,`⚡ activated (${need}×)`)};
    if(bp.seqCount>0)return {cls:'some',label:_gl(`${bp.seqCount}/${need} w oknie · zostało ${Math.max(0,win-(now-bp.seqStart)).toFixed(1)} s`,`${bp.seqCount}/${need} in the window · ${Math.max(0,win-(now-bp.seqStart)).toFixed(1)} s left`)};
    return {cls:'none',label:_gl(`0/${need} przekroczeń`,`0/${need} crossings`)};
  }
  if(allMet)return {cls:'all',label:beh==='continuous'?_gl('⚡ aktywne (powtarza)','⚡ active (repeating)'):beh==='hold'?_gl('⚡ trzymane','⚡ held'):_gl('⚡ aktywowano','⚡ activated')};
  return {cls:'none',label:''};
}
function drawEditorScope(){
  const d=state._draft;if(!d)return;
  document.querySelectorAll("#ruleEditor .ed-cond-card").forEach(card=>{   // each card (main + additional) has its own preview
    const cc=+card.dataset.cc, cond=cc<0?d:(d.extraConditions||[])[cc]; if(!cond)return;
    drawCondScope(card.querySelector("[data-pv=scope]"), cond, card.querySelector("[data-pv=state]"));
  });
  // TOAST: condition counter + ACTIVATION status per behavior (dwell counts down, multi counts within window).
  // Color: no conditions→gray; partially met→orange; all met→per behavior
  // (dwell/multi: orange "waiting/counting down", green "⚡ activated"; once: green immediately).
  const conds=[d].concat(d.extraConditions||[]), tot=conds.length, met=conds.filter(condMet).length;
  const allMet=tot>0&&evalDraftOver(conds);   // sequential op/neg (not a simple met===tot)
  const bp=behPreview(d, allMet);
  let cls=(met===0)?'none':(allMet?bp.cls:'some');     // per sequential logic (allMet), not the raw counter
  const t=document.getElementById("condToast");
  if(t){t.style.display="flex";
    t.innerHTML=`<span>${_gl(met+'/'+tot+' warunków',met+'/'+tot+' conditions')}</span>`+(bp.label?` <span style="opacity:.82">· ${esc(bp.label)}</span>`:'');
    t.className="cond-toast "+cls;}
  if(typeof gestStepsPaint==="function")gestStepsPaint();   // the simple mode's „done" marks (rf-12e); repaints only on change
  edReadyPaint();trigStepPaint();_edPlaceSync();             // stopka, krok kierunku, miejsce edytora (B1); DOM tylko przy zmianie
  if(state._edAdvSync)state._edAdvSync();                    // podsumowanie „Zaawansowane” nadąża za suwakami
}
// SAVE / LOAD the entire configuration (JSON file)
// exportConfig() is gone with its button: rules leave the machine as trigger presets now (saved
// in the bar below, downloaded from the Library or the exchange window), one format instead of two.
// The undo toast lasts 25 seconds and holds one step back — no help to somebody who notices two
// days later that the rules they spent an evening on are gone. So an import of mappings leaves the
// same durable copy a setup import does, except the unit here is a trigger preset. The name is
// worked out BEFORE the preview opens, so the sentence in it can promise the name it will use.
async function _rfTrigBackupName(){
  if(!(state.rules&&state.rules.length))return "";   // nothing to lose ⇒ nothing to save
  let taken=[];
  try{const m=await fetch("/profiles").then(r=>r.json());taken=m.profiles||[];}catch(e){}
  return _rfBackupName(rfBackupStamp(),taken);
}
async function _rfTrigBackupSave(name){
  if(!name)return null;
  try{
    const res=await fetch("/profile/save",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name,rules:state.rules})}).then(r=>r.json());
    if(!(res&&res.ok)){flashTrigMsg(_gl("Nie udało się zapisać kopii — importuję mimo to","Could not save the copy — importing anyway"));return null;}
  }catch(e){flashTrigMsg(_gl("Nie udało się zapisać kopii — importuję mimo to","Could not save the copy — importing anyway"));return null;}
  try{if(typeof loadProfileList==="function")loadProfileList();}catch(e){}   // the picker lists it without stealing the selection
  try{if(typeof rfLibReload==="function")rfLibReload();}catch(e){}
  return name;
}
function importConfig(file){
  const fr=new FileReader();
  fr.onload=async ()=>{try{
    const o=JSON.parse(fr.result);
    const rules=Array.isArray(o)?o:(Array.isArray(o.rules)?o.rules:null);
    if(!rules){flashTrigMsg(_gl("Zły plik — brak listy reguł","Bad file — no rules list"));return;}
    const backupName=await _rfTrigBackupName();
    const backupLabel=backupName
      ? (_gl("Obecne wyzwalacze najpierw zapiszę w Bibliotece jako preset „","I will first save your current triggers to the Library as the “")+
         backupName+_gl("”, żeby dało się wrócić.","” preset, so you can go back."))
      : "";
    // route through the SAME macro-safety warning as setup/bundle imports (this was the only import bypassing it)
    const _commit=async (list,mode)=>{
      if(backupName)await _rfTrigBackupSave(backupName);   // durable copy first, then the one-step snapshot
      await _rfUndoStash("rules");   // snapshot the current triggers BEFORE replacing them
      if(state.editing)closeEditor();
      state.rules=list;commitRules();   // POST -> server sanitizes and returns the canonical list
      const skipped=(mode==="safe"&&list.length<rules.length);
      flashTrigMsg(_gl("Wczytano "+list.length+" reguł"+(skipped?" (pominięto ryzykowne)":""),
        "Loaded "+list.length+" rule"+(list.length===1?"":"s")+(skipped?" (skipped risky)":"")));
      _rfUndoShowToast();   // triggers apply without a reload, so offer the undo toast immediately
    };
    const _title=_gl("Import mapowań","Import mappings");
    fetch("/setup/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({config:{rules:rules}})})
      .then(r=>r.ok?r.json():Promise.reject()).then(a=>{
        const ar=Array.isArray(a.rules)?a.rules:[];
        rfSafetyModal({title:_title,analysis:a,backupName,backupLabel,apply:(mode)=>{
          _commit((mode==="safe")?rules.filter((r,i)=>!(ar[i]&&ar[i].level==="risky")):rules, mode);
        }});
      }).catch(()=>{
        // analyzer unavailable -> be conservative: treat all as risky so nothing loads without explicit consent
        rfSafetyModal({title:_title,analysis:{riskyCount:rules.length,safeCount:0,
          rules:rules.map(r=>({level:"risky",label:(r&&(r.label||r.name||r.key))||_gl("reguła","rule"),desc:""}))},
          backupName,backupLabel,
          apply:(mode)=>{ if(mode==="advanced")_commit(rules,"advanced"); }});
      });
  }catch(e){flashTrigMsg(_gl("Błąd: nieprawidłowy JSON","Error: invalid JSON"));}};
  fr.readAsText(file);
}
function initTriggers(){
  // „Nowy wyzwalacz” otwiera wybór ruchu nad listą (P-G1-05), ten sam co pusty stan.
  document.getElementById("addRule").onclick=()=>{if(typeof trigStartToggle==="function")trigStartToggle();else openEditor(null);};
  // LINIA GOTOWOŚCI MAPOWANIA (P-G1-02). Nie na pustym module: tam prowadzą kafle startu.
  if(window.rfReady)rfReady.register({id:"rfReadyMap",anchor:()=>rfReady.headOf("mapowanie"),
    empty:()=>!(state.rules||[]).some(r=>!specIsPad(r.keySpec)),
    allOk:()=>(state.cfg&&state.cfg.sendKeys===false)?["Mapowanie jest gotowe.","Mapping is ready."]
      :["Mapowanie jest gotowe: ruch kapsla naciska klawisze w aktywnym oknie.","Mapping is ready: capsule motion presses keys in the active window."],
    rows:()=>[rfReady.mappingRow(),rfReady.armedRow(),rfReady.capsuleRow(),
      (state.cfg&&state.cfg.sendKeys===false)?{ok:false,info:true,pl:"Tryb podglądu: aplikacja pokazuje, co by nacisnęła, ale nic nie wysyła.",
        en:"Preview mode: the app shows what it would press but sends nothing."}:null]});
  // ESCAPE ZAMYKA — ALE TYLKO NIETKNIĘTY SZKIC. Edytor był jedynym oknem panelu, z którego Escape
  // nie wyprowadzał; zamykanie nim szkicu ZE ZMIANAMI byłoby jednak tym samym cichym kasowaniem,
  // które załatała pozycja 4.3, więc przy zmienionym szkicu Escape tylko przypomina o Anuluj/Zapisz.
  // Nasłuch jest na `#ruleEditor` w fazie bubbling, więc omijają go z natury tryby, które czytają
  // Escape w capture i zatrzymują propagację: „⌨ Naciśnij klawisz…” (captureKey) i nagrywanie
  // sekwencji (rf-32). Reszta trybów propagacji nie stopuje, dlatego mają tu jawnych strażników:
  // nakładka testu wysyłki (`state._soEsc`), wskazywanie punktu kursorem (rf-12b `ptState().pick`),
  // wskazywanie rogu obszaru myszy (rf-31b `_mAreaS.pick`) i nagrywanie gestu (rf-12d `GEST.rec`).
  // `_mAreaS` jest `const` na poziomie skryptu — NIE jest własnością `window`, stąd `typeof`.
  // WHY: Escape closes an untouched draft only; every "point at something" mode guards itself here.
  const _ed=document.getElementById("ruleEditor");
  if(_ed)_ed.addEventListener("keydown",e=>{
    if(e.key!=="Escape"||!state.editing)return;
    if(state._soEsc)return;
    if(typeof ptState==="function"&&ptState().pick>0)return;
    if(typeof _mAreaS!=="undefined"&&_mAreaS&&_mAreaS.pick>0)return;
    if(typeof GEST!=="undefined"&&GEST&&GEST.rec)return;
    if(JSON.stringify(state._draft)===state._draftBase){e.preventDefault();closeEditor();}
    else flashTrigMsg(_gl("Niezapisane zmiany — użyj Anuluj lub Zapisz","Unsaved changes — use Cancel or Save"));
  });
  // There is no global arm button any more — each output group (Mapping / Motion / MIDI-OSC)
  // has its own switch. state.armed therefore stays true permanently (see keysLive); what
  // actually gates sending is the per-group switch.
  const te=document.getElementById("trigEnable");
  // In simulation the first switch-on has to be confirmed (rf-39f): the mode sends for real.
  if(te)te.onclick=()=>{const want=!state.trigEnabled;
    const apply=()=>setTrigEnabled(want,false);
    if(typeof rfSimConfirmOn==="function")rfSimConfirmOn(want,apply,"mapping"); else apply();};
  fetch("/rules").then(r=>r.json()).then(d=>{if(typeof d.enabled==="boolean")setTrigEnabled(d.enabled,true);}).catch(()=>{});
  trigReflectEnable();
  // The bar's own Export/Import buttons are gone: rules travel as trigger PRESETS (the bar below
  // plus the „Wymiana" button). importConfig() stays — the content sniffer still routes the old
  // ribbitflip-wyzwalacze.json format through it, so legacy files keep loading.
  try{const s=localStorage.getItem(TRIG_LS);if(s){const a=JSON.parse(s);if(Array.isArray(a))state.rules=a;}}catch{}
  renderRules();   // server will send the authoritative list via the "rules" event
  updateKeysNote();
}

