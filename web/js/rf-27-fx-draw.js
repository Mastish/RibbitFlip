"use strict";
// Canvas rendering for the XY effect pads (grid, ripples, axis labels, lily-pad puck),
// plus keyboard activation for .rf-toggle switches.
// .rf-toggle is a <div role="switch">, not a <button>, so Enter/Space activation is wired by hand.
document.addEventListener("keydown",function(e){
  if(e.key!=="Enter"&&e.key!==" ")return;
  const _t=e.target&&e.target.closest&&e.target.closest(".rf-toggle");
  if(_t){e.preventDefault();_t.click();}
});
function fxDraw(){
  if(!XPAD.fxPads.length)return;
  for(const p of XPAD.fxPads){const cv=p._cv;if(!cv||!cv.clientWidth||cv.offsetParent===null)continue;
    const dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;
    if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
    const x=cv.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
    // background plate (rf-24b) under this canvas — it listens to the pad this one steers
    const _pl=(typeof PadPlate!=="undefined")&&PadPlate.drawFx(p,W,H,dpr),_dk=_pl&&padPlateDark(p.plate),_sv=p.scaleView!==false;
    if(!_pl){x.fillStyle="#f6f1e5";x.fillRect(0,0,W,H);}
    /* gentle water ripples — spawned along the drag path, capped at 5, slow soft fade */
    var _now=performance.now();if(!p.ripples)p.ripples=[];
    if(p._active&&!_prefersReducedMotion()){var _lr=p._lastRip,_mv=_lr?Math.hypot(p.cur.x-_lr.x,p.cur.y-_lr.y):1;
      if((!_lr||_mv>0.13)&&(_now-(p._lastRipT||0))>420){p.ripples.push({x:p.cur.x,y:p.cur.y,t:_now});
        if(p.ripples.length>5)p.ripples.shift();p._lastRip={x:p.cur.x,y:p.cur.y};p._lastRipT=_now;}}
    p.ripples=p.ripples.filter(function(r){return _now-r.t<1800;});
    if(_pl)p.ripples.length=0;   // the plate draws its own water — no extra rings
    for(var _ri=0;_ri<p.ripples.length;_ri++){var _r=p.ripples[_ri],_pt=(_now-_r.t)/1800,_ra=1-_pt,_ease=1-(1-_pt)*(1-_pt);
      x.strokeStyle="rgba(84,158,208,"+(_ra*0.32).toFixed(3)+")";x.lineWidth=1.3;
      x.beginPath();x.arc(_r.x*W,(1-_r.y)*H,6+_ease*30,0,Math.PI*2);x.stroke();}
    x.lineWidth=1;
    x.strokeStyle=_dk?"rgba(255,255,255,.14)":"rgba(120,100,60,.14)";x.lineWidth=1;
    if(_sv)for(let i=1;i<4;i++){x.beginPath();x.moveTo(W*i/4,0);x.lineTo(W*i/4,H);x.stroke();
      x.beginPath();x.moveTo(0,H*i/4);x.lineTo(W,H*i/4);x.stroke();}
    if(!XPAD._font)XPAD._font="10px "+(getComputedStyle(document.body).fontFamily||"sans-serif");
    x.font=XPAD._font;x.fillStyle=_dk?"rgba(255,255,255,.8)":"rgba(90,75,45,.6)";
    // axis label says so when the target pad has that effect switched OFF — otherwise steering it here
    // would look broken (the switch wins, so nothing is heard until it is turned back on)
    const _tg=(typeof synthInstById==="function")?synthInstById(p.target):null;
    // _cvT: canvas text never meets the i18n walker, so the Polish label is looked up here (rf-01 has the pairs)
    const _axL=k=>_cvT(FX_PARAMS[k])+((_tg&&typeof padFxOn==="function"&&fxSwitchable(k)&&!padFxOn(_tg,k))?" "+_gl("(wyłączony)","(off)"):"");
    if(_sv){x.textAlign="right";x.textBaseline="bottom";x.fillText("→ "+_axL(p.xp),W-4,H-3);
      x.save();x.translate(10,4);x.rotate(Math.PI/2);x.textAlign="left";x.textBaseline="bottom";x.fillText("↑ "+_axL(p.yp),0,0);x.restore();}
    const cx=p.cur.x*W,cy=(1-p.cur.y)*H,active=p._active;
    x.strokeStyle=_dk?"rgba(255,255,255,.22)":"rgba(120,100,60,.28)";x.beginPath();x.moveTo(cx,0);x.lineTo(cx,H);x.moveTo(0,cy);x.lineTo(W,cy);x.stroke();
    if(active&&!_prefersReducedMotion()){x.shadowColor="rgba(236,26,131,.55)";x.shadowBlur=14;}
    if(_lilypadImg&&_lilypadImg.complete&&_lilypadImg.naturalWidth){const s=active?42:30;x.globalAlpha=active?1:.85;x.drawImage(_lilypadImg,cx-s/2,cy-s/2,s,s);x.globalAlpha=1;}
    else{x.fillStyle=active?"rgba(236,26,131,.92)":"rgba(120,100,60,.4)";x.beginPath();x.arc(cx,cy,active?9:6,0,Math.PI*2);x.fill();}
    x.shadowBlur=0;
    if(_pl&&PadPlate.hud)PadPlate.hud(p._plateInst,x,W,H);   // the plate's own layer (e.g. trick names in the skate bowl)
  }
}

