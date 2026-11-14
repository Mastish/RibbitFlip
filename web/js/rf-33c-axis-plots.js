"use strict";
// ===================== THE TWO LIVE PICTURES OF ONE TUNED AXIS =====================
// LEFT  — the transfer curve: how far you lean along the bottom, what the axis reports up the side,
//         with the capsule's current position riding on the curve.
// RIGHT — the same axis over six seconds: the pale line is what arrives, the coloured one is what
//         comes out, and the ribbon between them IS the smoothing.
// Works for BOTH families (the four filter axes and the six raw channels) — everything family
// specific is asked of rf-33b through paxGet/paxLive/paxTrace.
// Split out of rf-33b when the tuning block passed the 500-line mark (.github/CONTRIBUTING.md).
// Nothing here runs until renderPoseCal() has painted the panel, so the load order does not matter.

// MUST mirror _pose_shape() in the monitor — both families go through the same function there.
// If the two drift apart the picture starts lying, which is worse than having no picture.
function paxOut(v,a,k){
  const x=v-a.zero;
  let mag,sign;
  if(paxUni(k)){mag=Math.max(0,x);sign=1;}
  else{mag=Math.abs(x);sign=x>=0?1:-1;}
  if(mag<=a.dead)return 0;
  const span=a.inHi-a.dead;
  let t=span<=0?1:Math.min(1,(mag-a.dead)/span);
  if(a.expo!==1)t=Math.pow(t,a.expo);
  return sign*t*a.outHi;
}
// Axis ticks: a channel runs to 32768, and "32768" written four times is just noise.
function _paxTick(v){
  const a=Math.abs(v);
  if(a<1000)return String(Math.round(v));
  // one decimal, dropped when it is a round thousand: 32768 -> "32,8k", not "33k" (which is a lie
  // about the axis maximum) and not "32,768k" (which is not a tick label).
  return (v/1000).toFixed(1).replace('.0','').replace('.',',')+'k';
}
function _paxPlotFrame(ctx,P,pw,ph){
  ctx.fillStyle=cv('--panel');ctx.globalAlpha=.55;ctx.fillRect(P.l,P.t,pw,ph);ctx.globalAlpha=1;
  ctx.strokeStyle=cv('--line');ctx.globalAlpha=.75;ctx.lineWidth=1;
  ctx.strokeRect(P.l+.5,P.t+.5,pw-1,ph-1);ctx.globalAlpha=1;
}
function drawAxisPlot(cv2,k){
  if(typeof fit!=='function')return;
  const {ctx,w,h}=fit(cv2); if(!w||!h)return;
  ctx.clearRect(0,0,w,h);
  const a=paxGet(k),full=paxFull(k),uni=paxUni(k);
  const P={l:38,r:10,t:10,b:18};
  const pw=w-P.l-P.r, ph=h-P.t-P.b;
  if(pw<20||ph<20)return;
  const xLo=uni?0:-full, xHi=full, yLo=uni?0:-full, yHi=full;
  const X=v=>P.l+(v-xLo)/(xHi-xLo)*pw, Y=v=>P.t+(1-(v-yLo)/(yHi-yLo))*ph;
  const col=paxColor(k);
  _paxPlotFrame(ctx,P,pw,ph);
  // quarter grid — a curve without one is a shape, with one it is a measurement
  ctx.strokeStyle=cv('--line');ctx.globalAlpha=.30;ctx.lineWidth=1;ctx.beginPath();
  for(let i=1;i<4;i++){const gy=Math.round(P.t+ph*i/4)+.5,gx=Math.round(P.l+pw*i/4)+.5;
    ctx.moveTo(P.l,gy);ctx.lineTo(P.l+pw,gy);ctx.moveTo(gx,P.t);ctx.lineTo(gx,P.t+ph);}
  ctx.stroke();ctx.globalAlpha=1;
  ctx.strokeStyle=cv('--line');ctx.globalAlpha=.85;ctx.beginPath();
  ctx.moveTo(P.l,Math.round(Y(0))+.5);ctx.lineTo(P.l+pw,Math.round(Y(0))+.5);
  ctx.moveTo(Math.round(X(0))+.5,P.t);ctx.lineTo(Math.round(X(0))+.5,P.t+ph);ctx.stroke();ctx.globalAlpha=1;
  // dead zone — the band that reports nothing, drawn where it actually sits (the trim moves it)
  if(a.on&&a.dead>0){
    const x0=X(Math.max(xLo,a.zero-(uni?0:a.dead))), x1=X(Math.min(xHi,a.zero+a.dead));
    ctx.fillStyle=cv('--bad');ctx.globalAlpha=.13;ctx.fillRect(x0,P.t,Math.max(1,x1-x0),ph);
    ctx.globalAlpha=.5;ctx.strokeStyle=cv('--bad');ctx.setLineDash([2,3]);ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(Math.round(x1)+.5,P.t);ctx.lineTo(Math.round(x1)+.5,P.t+ph);
    if(!uni){ctx.moveTo(Math.round(x0)+.5,P.t);ctx.lineTo(Math.round(x0)+.5,P.t+ph);}
    ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
  }
  // reference: what the axis would report untouched
  ctx.strokeStyle=cv('--dim');ctx.globalAlpha=.5;ctx.lineWidth=1.4;ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.moveTo(X(xLo),Y(uni?yLo:xLo));ctx.lineTo(X(xHi),Y(xHi));ctx.stroke();
  ctx.setLineDash([]);ctx.globalAlpha=1;
  // the curve this axis is actually set to — filled underneath, so "how much gets through" is a
  // quantity you can see rather than a line you have to read
  const pts=[];
  for(let i=0;i<=140;i++){
    const v=xLo+(xHi-xLo)*i/140, y=a.on?paxOut(v,a,k):v;
    pts.push([X(v),Y(Math.max(yLo,Math.min(yHi,y)))]);
  }
  const y0=Y(0);
  ctx.beginPath();ctx.moveTo(pts[0][0],y0);
  for(const p of pts)ctx.lineTo(p[0],p[1]);
  ctx.lineTo(pts[pts.length-1][0],y0);ctx.closePath();
  ctx.fillStyle=col;ctx.globalAlpha=.13;ctx.fill();ctx.globalAlpha=1;
  ctx.strokeStyle=col;ctx.lineWidth=2.6;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
  pts.forEach((p,i)=>{if(i===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);});
  ctx.stroke();
  // where the capsule is on that curve, right now
  const L=paxLive(k);
  const rd=document.querySelector(`.pcal-plotread[data-read="${k}"]`);
  if(L&&isFinite(L.inV)){
    const px=X(Math.max(xLo,Math.min(xHi,L.inV))), py=Y(Math.max(yLo,Math.min(yHi,L.outV)));
    ctx.strokeStyle=col;ctx.globalAlpha=.5;ctx.lineWidth=1.2;ctx.setLineDash([2,3]);
    ctx.beginPath();ctx.moveTo(px,P.t+ph);ctx.lineTo(px,py);ctx.lineTo(P.l,py);ctx.stroke();
    ctx.setLineDash([]);ctx.globalAlpha=1;
    ctx.fillStyle=col;ctx.globalAlpha=.22;ctx.beginPath();ctx.arc(px,py,9,0,7);ctx.fill();ctx.globalAlpha=1;
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(px,py,5,0,7);ctx.fill();
    ctx.strokeStyle=cv('--panel');ctx.lineWidth=1.6;ctx.stroke();
    if(rd)rd.innerHTML=_axT('wychylenie ','lean ')+`<b>${paxVal(k,L.inV)}</b> `
      +_axT('→ oś raportuje ','→ axis reports ')+`<b style="color:${col}">${paxVal(k,L.outV)}</b>`;
  }else if(rd)rd.textContent=_axT('(brak danych z kapsla)','(no data from the capsule)');
  // axis labels
  ctx.fillStyle=cv('--dim');ctx.font='10px '+cv('--mono');ctx.textBaseline='middle';
  ctx.textAlign='right';ctx.fillText(_paxTick(yHi),P.l-4,P.t+6);
  ctx.fillText(_paxTick(yLo),P.l-4,P.t+ph-6);
  ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText(_paxTick(xLo),X(xLo)+11,P.t+ph+4);
  ctx.fillText(_paxTick(xHi),X(xHi)-11,P.t+ph+4);
  ctx.fillText(_axT('wychylenie','lean')+(paxUnit(k)?' '+paxUnit(k):'')+' →',P.l+pw/2,P.t+ph+4);
}
// The curve on the left says what the tuning WOULD do; this says what it IS doing, over time.
// Two lines on one time axis: what arrives (before this axis's smoothing) and what the axis reports.
// The gap between them is the smoothing — a number in a box cannot show that, a picture can.
function drawAxisTrace(cv2,k){
  if(typeof fit!=='function')return;
  const {ctx,w,h}=fit(cv2); if(!w||!h)return;
  ctx.clearRect(0,0,w,h);
  const P={l:38,r:10,t:10,b:18}, pw=w-P.l-P.r, ph=h-P.t-P.b;
  if(pw<20||ph<20)return;
  const T=paxTrace(k), buf=T.buf, sg=T.sg;
  const end=T.now||0, WIN=6, start=end-WIN;
  const col=paxColor(k);
  // Scale to what actually happened in the window, never below a floor — otherwise a capsule lying
  // still fills the box with the noise floor and every wobble looks dramatic.
  const uni=paxUni(k), FLOOR=paxFloor(k);
  let lo=uni?0:-FLOOR, hi=FLOOR;
  for(let i=buf.length-1;i>=0;i--){const s=buf[i];if(s[0]<start)break;
    for(const raw of [s[1],s[2]]){if(raw==null||!isFinite(raw))continue;const v=sg*raw;if(v<lo)lo=v;if(v>hi)hi=v;}}
  const pad=(hi-lo)*0.12||1; lo-=uni?0:pad; hi+=pad; if(uni&&lo<0)lo=0;
  const X=t=>P.l+(t-start)/WIN*pw, Y=v=>P.t+(1-(v-lo)/((hi-lo)||1))*ph;
  _paxPlotFrame(ctx,P,pw,ph);
  ctx.strokeStyle=cv('--line');ctx.globalAlpha=.30;ctx.lineWidth=1;ctx.beginPath();
  for(let i=1;i<4;i++){const gy=Math.round(P.t+ph*i/4)+.5;ctx.moveTo(P.l,gy);ctx.lineTo(P.l+pw,gy);}
  ctx.stroke();ctx.globalAlpha=1;
  if(lo<0&&hi>0){ctx.globalAlpha=.85;ctx.strokeStyle=cv('--line');ctx.beginPath();
    ctx.moveTo(P.l,Math.round(Y(0))+.5);ctx.lineTo(P.l+pw,Math.round(Y(0))+.5);ctx.stroke();ctx.globalAlpha=1;}
  const clampY=v=>Y(Math.max(lo,Math.min(hi,v)));
  // The RIBBON between the two lines: that area is the delay the smoothing is adding, and it is
  // the one thing a row of numbers cannot say at all.
  let ribbon=0;
  ctx.beginPath();let open=false,back=[];
  for(let i=0;i<buf.length;i++){const s=buf[i];if(s[0]<start)continue;
    const a=s[1],b=s[2];
    if(a==null||b==null||!isFinite(a)||!isFinite(b)){open=false;back.length=0;continue;}
    const px=X(s[0]);
    if(!open){ctx.moveTo(px,clampY(sg*a));open=true;}else ctx.lineTo(px,clampY(sg*a));
    back.push([px,clampY(sg*b)]);ribbon=Math.max(ribbon,Math.abs(a-b));}
  for(let i=back.length-1;i>=0;i--)ctx.lineTo(back[i][0],back[i][1]);
  if(back.length){ctx.closePath();ctx.fillStyle=col;ctx.globalAlpha=.14;ctx.fill();ctx.globalAlpha=1;}
  const line=(idx,style,width,alpha)=>{
    ctx.strokeStyle=style;ctx.lineWidth=width;ctx.globalAlpha=alpha;ctx.lineJoin='round';ctx.lineCap='round';
    ctx.beginPath();let started=false;
    for(let i=0;i<buf.length;i++){const s=buf[i];if(s[0]<start)continue;
      const v=s[idx];if(v==null||!isFinite(v)){started=false;continue;}
      const px=X(s[0]),py=clampY(sg*v);
      if(!started){ctx.moveTo(px,py);started=true;}else ctx.lineTo(px,py);}
    ctx.stroke();ctx.globalAlpha=1;
  };
  line(2,cv('--dim'),1.4,.8);      // what arrives — before smoothing
  line(1,col,2.4,1);               // what the axis reports
  // the head of the trace, so the eye finds "now" without hunting
  for(let i=buf.length-1;i>=0;i--){const s=buf[i];
    if(s[0]<start||s[1]==null||!isFinite(s[1]))continue;
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(X(s[0]),clampY(sg*s[1]),3.2,0,7);ctx.fill();
    ctx.strokeStyle=cv('--panel');ctx.lineWidth=1.4;ctx.stroke();break;}
  ctx.fillStyle=cv('--dim');ctx.font='10px '+cv('--mono');ctx.textBaseline='middle';ctx.textAlign='right';
  ctx.fillText(_paxTick(hi),P.l-4,P.t+6);ctx.fillText(_paxTick(lo),P.l-4,P.t+ph-6);
  ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText('−'+WIN+' s',P.l+2,P.t+ph+4);
  ctx.textAlign='right';ctx.fillText(_axT('teraz','now'),P.l+pw-2,P.t+ph+4);
}
// Only the unfolded blocks are drawn — a closed <details> has no layout and nobody is looking.
// The live number in every header IS refreshed though, folded or not: ten signals side by side is
// how you find the one that moves when you move the capsule, which is the first thing anybody
// tuning an axis needs to know.
// ⚠️ GUARD NA EKRAN, NIE NA WIDOCZNOŚĆ (2026-09-05). Ta funkcja siedzi w pętli klatek
// (rf-09 `frame()`), więc chodziła 60 razy na sekundę NA KAŻDYM ekranie — także na Mapowaniu,
// gdzie Czujnika w ogóle nie widać — i za każdym razem robiła `querySelectorAll` po całym
// dokumencie plus 7-10 zapisów `textContent`. `classList.contains('active')` zamiast
// `offsetParent`: to drugie WYMUSZA układ, czyli dokładnie ten koszt, który tu odcinamy.
// WHY: the frame loop paid for the sensor screen on every other screen too.
function drawAxisPlots(){
  const tab=document.getElementById('tab-czujnik');
  if(!tab||!tab.classList.contains('active'))return;
  const box=tab.querySelector('.posecal');if(!box)return;
  box.querySelectorAll('.pcal-axnow').forEach(el=>{
    const k=el.dataset.now,L=paxLive(k);
    // `_rdSet` (rf-09) zapisuje TYLKO przy zmianie: ta sama liczba co klatkę budziła
    // obserwatora i18n i brudziła układ tuż przed `fit()`.
    _rdSet(el,'text',(L&&isFinite(L.outV))?paxVal(k,L.outV):'—');
  });
  box.querySelectorAll('.pcal-ax[open]').forEach(det=>{
    const k=det.dataset.ax;
    const c1=det.querySelector('canvas.pcal-plot'), c2=det.querySelector('canvas.pcal-trace');
    try{if(c1)drawAxisPlot(c1,k);}catch(e){}
    try{if(c2)drawAxisTrace(c2,k);}catch(e){}
  });
}
// One block, right now — used when a block is unfolded (the rAF loop would only get to it on the
// next frame, and an empty box for 16 ms reads as "broken").
function paxDrawOne(det){
  if(!det||!det.open)return;
  const k=det.dataset.ax,c1=det.querySelector('canvas.pcal-plot'),c2=det.querySelector('canvas.pcal-trace');
  try{if(c1)drawAxisPlot(c1,k);}catch(e){}
  try{if(c2)drawAxisTrace(c2,k);}catch(e){}
}
