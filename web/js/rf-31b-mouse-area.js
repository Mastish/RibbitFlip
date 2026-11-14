"use strict";
// ===================== OBSZAR KURSORA: monitory, ogrodzenie i wskazywanie =====================
// Druga połowa karty „Mysz". Silnik dostał pojęcie ekranów (mouse_area w ribbitflip_monitor.py),
// a tutaj mieszka wszystko, co o nich mówi użytkownikowi: mapka układu monitorów, wybór tego
// jednego, na którym ma pracować kursor, własny prostokąt z pobieraniem rogów kursorem oraz
// przełącznik „prędkość / położenie".
//
// DLACZEGO OSOBNY PLIK: rf-31 ma 686 linii, czyli powyżej miękkiego limitu z reguły organizacji
// JS — nowa funkcja idzie do własnego modułu, a nie na koniec tamtego.
//
// DLACZEGO SERWER, A NIE PRZEGLĄDARKA: strona nie ma jak policzyć układu monitorów. `window.screen`
// opisuje ten ekran, na którym stoi okno przeglądarki, i nic poza nim — nie zna ani sąsiadów, ani
// ich położenia względem siebie, ani który jest główny. Zna je Windows, więc pyta o nie serwer
// (GET /screens) w tej samej przestrzeni współrzędnych, w której chodzi kursor.

// Ostatnia odpowiedź serwera + stan pobierania rogu. Jeden obiekt, bo to jedna rzecz: „co wiemy
// o ekranach w tej chwili".
const _mAreaS={scr:[],desk:null,cur:null,area:null,mon:null,fb:false,
               ts:0,busy:false,err:false,
               pick:0,which:"",_poll:null,_tick:null,_esc:null,last:null};

// Karta Mysz bywa schowana (inna zakładka) — wtedy nie ma po co odpytywać serwera ani rysować.
// Od UX 261120 L4d obszar leży w zwijaku „Obszar kursora”: zwinięty też nie odpytuje serwera.
function mAreaOn(){const c=document.getElementById("mGrpArea");return !!(c&&c.offsetParent&&!c.closest("details:not([open])"));}

function mAreaFetch(){
  if(_mAreaS.busy)return;
  _mAreaS.busy=true;
  const dev=encodeURIComponent(state.activeDeviceId||"d0");
  fetch("/screens?dev="+dev).then(r=>r.json()).then(j=>{
    _mAreaS.busy=false;
    if(!j)return;
    _mAreaS.scr=Array.isArray(j.screens)?j.screens:[];
    _mAreaS.desk=j.desktop||null;_mAreaS.cur=j.cursor||null;_mAreaS.area=j.area||null;
    _mAreaS.mon=j.monitor||null;_mAreaS.fb=!!j.fallback;_mAreaS.err=false;
    mAreaSync();
  }).catch(()=>{_mAreaS.busy=false;_mAreaS.err=true;});
}

// Wywoływane z pętli klatek (rf-09). Odpytywanie 4×/s wystarcza mapce — kursor na niej to
// orientacja („jestem na prawym ekranie"), nie celownik, a monitory nie przesuwają się co klatkę.
function mAreaFrame(){
  if(!mAreaOn())return;
  const t=Date.now();
  if(t-_mAreaS.ts>240){_mAreaS.ts=t;mAreaFetch();}
  drawAreaMap();
}

// --- <select> monitorów + zdanie pod mapką ----------------------------------------------------
function _mScrLabel(s,i){
  const nm=(s.name||"").replace(/^\\\\\.\\/,"");     // \\.\DISPLAY2 -> DISPLAY2
  const main=s.primary?_gl(" · główny"," · primary"):"";
  return (i+1)+": "+s.w+"×"+s.h+(nm?" ("+nm+")":"")+main;
}
function mAreaSync(){
  const $=id=>document.getElementById(id),m=state.mouse;
  const sel=$("mMonitor");
  if(sel){
    const want=m.mouseMonitor||"";
    const opts=[`<option value="">${_gl("Główny monitor","The primary monitor")}</option>`]
      .concat(_mAreaS.scr.map((s,i)=>`<option value="${esc(s.name||"")}">${esc(_mScrLabel(s,i))}</option>`));
    // Zapisany monitor, którego już nie ma w układzie: zostaje na liście jako „niepodłączony",
    // żeby wybór nie przeskoczył po cichu na główny po wyjęciu kabla. O tym, że kursor JEST teraz
    // na głównym, mówi zdanie pod mapką (fallback z serwera).
    if(want&&!_mAreaS.scr.some(s=>(s.name||"")===want))
      opts.push(`<option value="${esc(want)}">${esc(want.replace(/^\\\\\.\\/,""))} — ${_gl("niepodłączony","not plugged in")}</option>`);
    const html=opts.join("");
    if(sel.innerHTML!==html)sel.innerHTML=html;
    if(document.activeElement!==sel)sel.value=want;
  }
  const note=$("mAreaNote");
  if(note){
    let t,cls="";
    const a=_mAreaS.area;
    if(_mAreaS.err){t=_gl("Nie wiem, jak stoją monitory — serwer nie odpowiedział.",
                          "I cannot tell how the monitors are arranged — the server did not answer.");cls="warn";}
    else if(!a){t=_gl("Nie znam rozmiaru pulpitu, więc kursor nie jest niczym ograniczony.",
                      "I do not know the desktop size, so nothing is fencing the cursor.");cls="warn";}
    else{
      const rect=a.w+"×"+a.h+" @ "+a.x+","+a.y;
      if(m.mouseArea==="desktop"&&!(+m.mouseAreaPad>0))
        t=_gl("Kursor chodzi po całym pulpicie: ","The cursor roams the whole desktop: ")+rect
          +_gl(" — kapsel może go zaprowadzić na każdy monitor."," — the capsule can take it to any monitor.");
      else{
        const nm=_mAreaS.mon?(" · "+(_mAreaS.mon.replace(/^\\\\\.\\/,""))):"";
        t=_gl("Obszar: ","Area: ")+rect+nm;
        if(_mAreaS.fb){t+=_gl(" — zapisanego monitora nie ma w układzie, więc biorę główny.",
                              " — the saved monitor is not in the layout, so I am using the primary one.");cls="warn";}
        else if(m.mouseAbsolute&&m.mouseSource==="filter")
          t+=_gl(" — środek tego prostokąta to kapsel trzymany na wprost.",
                 " — the middle of this rectangle is the capsule held level.");
        else t+=_gl(" — kapsel nie wyprowadzi kursora poza ten prostokąt.",
                    " — the capsule cannot take the cursor outside this rectangle.");
      }
    }
    if(_mAreaS.pick)t=_gl("ustaw kursor w rogu obszaru… biorę za ","put the cursor in the corner… taking it in ")
      +_mAreaS.pick+" s"+(_mAreaS.cur?(" · "+_mAreaS.cur.x+", "+_mAreaS.cur.y):"");
    note.textContent=t;note.className="mouse-avail col2"+(cls?" "+cls:"");
  }
}

// --- mapka ------------------------------------------------------------------------------------
// Prostokąty monitorów w skali, wybrany podświetlony, realny obszar kursora obrysowany kreską,
// kursor jako kropka. To samo, co pokazuje `mouse_area` na serwerze — rysowane z JEGO liczb, nie
// z osobnego rachunku w przeglądarce, żeby mapka nie mogła się z silnikiem rozjechać.
function drawAreaMap(){
  const c=document.getElementById("mAreaMap");if(!c)return;
  const f=(typeof fit==="function")?fit(c):null;if(!f)return;
  const {ctx,w,h}=f;if(w<=0||h<=0)return;
  ctx.clearRect(0,0,w,h);
  const scr=_mAreaS.scr,d=_mAreaS.desk;
  if(!scr.length||!d||!d.w||!d.h){
    ctx.fillStyle=cv('--dim');ctx.font="12px "+cv('--mono');ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(_cvT(_mAreaS.err?"brak połączenia z serwerem":"szukam monitorów…"),w/2,h/2);
    ctx.textBaseline="alphabetic";return;
  }
  const pad=10,S=Math.min((w-2*pad)/d.w,(h-2*pad)/d.h);
  const ox=(w-d.w*S)/2-d.x*S, oy=(h-d.h*S)/2-d.y*S;
  const X=x=>ox+x*S, Y=y=>oy+y*S;
  const m=state.mouse;
  // który monitor jest „ten wybrany": przy area=monitor ten z ustawień, przy area=cursor ten,
  // na którym stoi kursor, a serwer i tak zwraca nazwę tego, którego naprawdę użył
  const activeName=(m.mouseArea==="monitor"||m.mouseArea==="cursor")?(_mAreaS.mon||""):"";
  ctx.textAlign="center";ctx.textBaseline="middle";
  for(let i=0;i<scr.length;i++){
    const s=scr[i],on=(activeName&&(s.name||"")===activeName);
    const x=X(s.x),y=Y(s.y),ww=Math.max(6,s.w*S),hh=Math.max(6,s.h*S);
    ctx.fillStyle=on?"rgba(90,160,255,.20)":cv('--bg2');
    ctx.strokeStyle=on?cv('--az'):cv('--line');ctx.lineWidth=on?2:1;
    ctx.beginPath();ctx.rect(x+1,y+1,ww-2,hh-2);ctx.fill();ctx.stroke();
    ctx.fillStyle=on?cv('--ink'):cv('--muted');
    ctx.font=(on?"700 ":"")+Math.max(9,Math.min(13,hh/5)).toFixed(1)+"px "+cv('--mono');
    ctx.fillText(String(i+1),x+ww/2,y+hh/2-(hh>44?7:0));
    if(hh>44){ctx.fillStyle=cv('--dim');ctx.font="9.5px "+cv('--mono');
      ctx.fillText(s.w+"×"+s.h,x+ww/2,y+hh/2+8);}
    if(s.primary){ctx.fillStyle=cv('--dim');ctx.font="9px "+cv('--mono');
      ctx.fillText("★",x+10,y+11);}
  }
  const a=_mAreaS.area;
  if(a&&a.w&&a.h){
    ctx.save();ctx.setLineDash([5,4]);ctx.strokeStyle=cv('--ok');ctx.lineWidth=2;
    ctx.strokeRect(X(a.x)+1,Y(a.y)+1,Math.max(4,a.w*S)-2,Math.max(4,a.h*S)-2);ctx.restore();
  }
  const cu=_mAreaS.cur;
  if(cu){
    const cx=X(cu.x),cy=Y(cu.y);
    ctx.fillStyle=cv('--warn');ctx.beginPath();ctx.arc(cx,cy,3.2,0,7);ctx.fill();
    ctx.strokeStyle=cv('--warn');ctx.globalAlpha=.45;ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(cx,cy,6.5,0,7);ctx.stroke();ctx.globalAlpha=1;
  }
  ctx.textBaseline="alphabetic";
}

// --- podgląd trybu „Położenie" -----------------------------------------------------------------
// Wywoływane z _drawMotionScope (rf-31) zamiast strzałki prędkości. Rysunek odpowiada na pytanie
// tego trybu: „gdzie w obszarze celuje kapsel". Prostokąt ma proporcje REALNEGO obszaru (z
// broadcastu, nie z ustawień), więc widać od razu, czy kursor jeździ po jednym monitorze, czy po
// całym pulpicie. Rysuje w stanie podmienionym przez drawMotionScope — czyta state.mouse /
// state.mousePrev tak samo jak reszta podglądu i działa dla każdego kapsla.
function drawAimScope(ctx,w,h,S,idle){
  const m=state.mouse,p=state.mousePrev||{};
  const ar=Array.isArray(p.area)&&p.area[2]>0&&p.area[3]>0?(p.area[2]/p.area[3]):(16/9);
  const pad=16*S;
  let bw=w-2*pad, bh=bw/ar;
  if(bh>h-2*pad){bh=h-2*pad;bw=bh*ar;}
  const bx=(w-bw)/2, by=(h-bh)/2;
  ctx.fillStyle=cv('--bg2');ctx.strokeStyle=cv('--line');ctx.lineWidth=1.4*S;
  ctx.beginPath();ctx.rect(bx,by,bw,bh);ctx.fill();ctx.stroke();
  // krzyż w środku = kapsel trzymany na wprost
  ctx.save();ctx.globalAlpha=.5;ctx.strokeStyle=cv('--line');ctx.lineWidth=1*S;
  ctx.beginPath();ctx.moveTo(bx,by+bh/2);ctx.lineTo(bx+bw,by+bh/2);
  ctx.moveTo(bx+bw/2,by);ctx.lineTo(bx+bw/2,by+bh);ctx.stroke();ctx.restore();
  // martwa strefa: w tym trybie to płaski placek wokół środka, w tych samych proporcjach co obszar
  const sc=Math.max(2,+m.mouseFilterScale||30), dz=Math.max(0,+m.mouseFilterDead||0)/sc;
  if(dz>0.005){ctx.save();ctx.globalAlpha=.5;ctx.strokeStyle=cv('--muted');ctx.setLineDash([4,4]);
    ctx.lineWidth=1*S;ctx.beginPath();
    ctx.ellipse(bx+bw/2,by+bh/2,dz*bw/2,dz*bh/2,0,0,7);ctx.stroke();ctx.restore();}
  const ax=Math.max(-1,Math.min(1,+p.ax||0)), ay=Math.max(-1,Math.min(1,+p.ay||0));
  const ex=bx+(ax+1)/2*bw, ey=by+(ay+1)/2*bh;
  ctx.save();ctx.globalAlpha=.35;ctx.strokeStyle=p.live?cv('--ok'):cv('--az');ctx.lineWidth=1*S;
  ctx.beginPath();ctx.moveTo(bx,ey);ctx.lineTo(bx+bw,ey);ctx.moveTo(ex,by);ctx.lineTo(ex,by+bh);ctx.stroke();ctx.restore();
  if(!_drawMouseWalker(ctx,ex,ey,30*S,p.live)){   // 10-15: mysz chodzi (rf-31), kierunek i tempo z ruchu celownika
    ctx.fillStyle=p.live?cv('--ok'):cv('--az');ctx.beginPath();ctx.arc(ex,ey,4.8*S,0,7);ctx.fill();}
  // Klik bez klikania działa też przy wskazywaniu — pierścień postępu idzie za celownikiem,
  // dokładnie jak przy prędkości (rf-31c).
  if(typeof drawDwellRing==="function")drawDwellRing(ctx,ex,ey,S,p);
  // Jako SZKIC (grupa wyłączona) rysunek jest gościem w drawScopeIdle, które ma na dole własny
  // podpis — dwie linijki w tym samym miejscu nakładały się na siebie.
  if(!idle){
    ctx.fillStyle=cv('--dim');ctx.font=(10.5*S).toFixed(1)+"px "+cv('--mono');ctx.textAlign="left";
    ctx.fillText(Array.isArray(p.area)?(p.area[2]+"×"+p.area[3]):_cvT("obszar nieznany"),8*S,h-8*S);
    ctx.textAlign="right";ctx.fillStyle=p.live?cv('--warn'):cv('--dim');
    ctx.fillText(_cvT(p.live?"NA ŻYWO":"podgląd"),w-8*S,h-8*S);
  }
  ctx.textAlign="center";ctx.fillStyle=cv('--muted');ctx.font=(9.5*S).toFixed(1)+"px "+cv('--mono');
  ctx.fillText(_cvT("wskazywanie"),w/2,by-4*S);
}

// Klik w mapkę = wybór monitora. Przy „własnym prostokącie" wpisuje jego wymiary do pól, bo
// prostokąt najczęściej zaczyna się od jednego ekranu i dopiero potem jest przycinany.
function _mAreaClick(e){
  const c=document.getElementById("mAreaMap"),d=_mAreaS.desk;
  if(!c||!d||!d.w||!_mAreaS.scr.length)return;
  const r=c.getBoundingClientRect(),w=r.width,h=r.height,pad=10;
  const S=Math.min((w-2*pad)/d.w,(h-2*pad)/d.h);
  const ox=(w-d.w*S)/2-d.x*S, oy=(h-d.h*S)/2-d.y*S;
  const px=(e.clientX-r.left-ox)/S, py=(e.clientY-r.top-oy)/S;
  const s=_mAreaS.scr.find(z=>px>=z.x&&px<z.x+z.w&&py>=z.y&&py<z.y+z.h);
  if(!s)return;
  const m=state.mouse;
  if(m.mouseArea==="custom"){
    m.mouseRectX=s.x;m.mouseRectY=s.y;m.mouseRectW=s.w;m.mouseRectH=s.h;
    flashTrigMsg(_gl("Prostokąt = monitor ","Rectangle = monitor ")+(s.w+"×"+s.h));
  }else{
    m.mouseArea="monitor";m.mouseMonitor=s.name||"";
    flashTrigMsg(_gl("Kursor zostaje na monitorze ","The cursor stays on monitor ")
      +((_mAreaS.scr.indexOf(s)+1)+": "+s.w+"×"+s.h));
  }
  mFill();commitMouse();mAreaFetch();
}

// --- pobieranie rogu kursorem ------------------------------------------------------------------
// Ta sama mechanika co przy „punkcie na ekranie" (rf-12b): strona nie widzi kursora poza własnym
// oknem, a kliknięcie gdzieś na pulpicie jest dla niej niewidoczne — więc odliczanie, przycisk
// „weź teraz" i Escape na wycofanie.
function mAreaPickStart(which){
  mAreaPickStop();
  _mAreaS.which=which;_mAreaS.pick=5;
  const b=document.getElementById(which==="a"?"mRectPickA":"mRectPickB");
  if(b){b.textContent=_gl("⏹ Weź teraz","⏹ Take it now");b.classList.add("on");}
  _mAreaS._tick=setInterval(()=>{
    _mAreaS.pick--;
    if(_mAreaS.pick<=0)mAreaPickTake();else mAreaSync();
  },1000);
  _mAreaS._esc=e=>{if(e.key==="Escape"){mAreaPickStop();
    flashTrigMsg(_gl("Wskazywanie rogu anulowane","Corner picking cancelled"));}};
  window.addEventListener("keydown",_mAreaS._esc,true);
  mAreaSync();
}
function mAreaPickTake(){
  const which=_mAreaS.which,p=_mAreaS.cur;
  mAreaPickStop();
  if(!p){flashTrigMsg(_gl("Nie udało się odczytać pozycji kursora","Could not read the cursor position"));return;}
  const m=state.mouse;
  if(which==="a"){
    // Lewy górny róg: prawy dolny (X+W, Y+H) ma zostać tam, gdzie był — inaczej przesunięcie
    // jednego rogu przesuwałoby cały prostokąt i drugi róg trzeba by brać od nowa.
    const bx=(+m.mouseRectW>0)?(+m.mouseRectX+ +m.mouseRectW):(p.x+400);
    const by=(+m.mouseRectH>0)?(+m.mouseRectY+ +m.mouseRectH):(p.y+300);
    m.mouseRectX=p.x;m.mouseRectY=p.y;
    m.mouseRectW=Math.max(8,bx-p.x);m.mouseRectH=Math.max(8,by-p.y);
  }else{
    m.mouseRectW=Math.max(8,p.x-(+m.mouseRectX||0));
    m.mouseRectH=Math.max(8,p.y-(+m.mouseRectY||0));
  }
  m.mouseArea="custom";
  mFill();commitMouse();mAreaFetch();
  flashTrigMsg(_gl("Róg: ","Corner: ")+p.x+", "+p.y);
}
function mAreaPickStop(){
  if(_mAreaS._tick){clearInterval(_mAreaS._tick);_mAreaS._tick=null;}
  if(_mAreaS._esc){window.removeEventListener("keydown",_mAreaS._esc,true);_mAreaS._esc=null;}
  _mAreaS.pick=0;
  for(const id of ["mRectPickA","mRectPickB"]){const b=document.getElementById(id);
    if(b){b.classList.remove("on");
      b.textContent=(id==="mRectPickA")?_gl("🎯 Lewy górny róg…","🎯 Top-left corner…")
                                       :_gl("🎯 Prawy dolny róg…","🎯 Bottom-right corner…");}}
  mAreaSync();
}

// --- podpięcia ---------------------------------------------------------------------------------
function initMouseArea(){
  const $=id=>document.getElementById(id),m=()=>state.mouse;
  {const e=$("mArea");if(e)e.onchange=()=>{
    m().mouseArea=e.value;
    // Wybrany monitor bez wskazanego monitora = główny, co jest zgodne z silnikiem, ale nudne:
    // jeśli układ jest znany, weź ten, na którym stoi kursor — to niemal zawsze ten właściwy.
    if(e.value==="monitor"&&!m().mouseMonitor&&_mAreaS.cur&&_mAreaS.scr.length){
      const c=_mAreaS.cur,s=_mAreaS.scr.find(z=>c.x>=z.x&&c.x<z.x+z.w&&c.y>=z.y&&c.y<z.y+z.h);
      if(s)m().mouseMonitor=s.name||"";
    }
    mFill();commitMouse();mAreaFetch();};}
  {const e=$("mMonitor");if(e)e.onchange=()=>{m().mouseMonitor=e.value;mFill();commitMouse();mAreaFetch();};}
  {const e=$("mAreaWork");if(e)e.onchange=()=>{m().mouseAreaWork=e.checked;mFill();commitMouse();mAreaFetch();};}
  {const e=$("mAreaPad");if(e)e.oninput=()=>{m().mouseAreaPad=+e.value||0;commitMouse();mAreaFetch();};}
  for(const [id,key] of [["mRectX","mouseRectX"],["mRectY","mouseRectY"],["mRectW","mouseRectW"],["mRectH","mouseRectH"]]){
    const e=$(id);if(e)e.oninput=()=>{m()[key]=+e.value||0;commitMouse();mAreaFetch();};}
  {const e=$("mRectPickA");if(e)e.onclick=()=>{_mAreaS.pick?mAreaPickTake():mAreaPickStart("a");};}
  {const e=$("mRectPickB");if(e)e.onclick=()=>{_mAreaS.pick?mAreaPickTake():mAreaPickStart("b");};}
  {const e=$("mRectMon");if(e)e.onclick=()=>{
    const c=_mAreaS.cur;
    const s=(c&&_mAreaS.scr.find(z=>c.x>=z.x&&c.x<z.x+z.w&&c.y>=z.y&&c.y<z.y+z.h))
          ||_mAreaS.scr.find(z=>z.primary)||_mAreaS.scr[0];
    if(!s){flashTrigMsg(_gl("Nie znam układu monitorów","I do not know the monitor layout"));return;}
    const M=m();M.mouseRectX=s.x;M.mouseRectY=s.y;M.mouseRectW=s.w;M.mouseRectH=s.h;
    mFill();commitMouse();mAreaFetch();
    flashTrigMsg(_gl("Prostokąt = monitor ","Rectangle = monitor ")+(s.w+"×"+s.h));};}
  {const c=$("mAreaMap");if(c)c.addEventListener("click",_mAreaClick);}
  // PRĘDKOŚĆ / POŁOŻENIE. Wskazywanie potrzebuje kąta, więc przy źródle „Oś" przestawiamy je na
  // filtr 3D — i mówimy o tym wprost. Cicha zmiana cudzego ustawienia byłaby gorsza od odmowy,
  // ale odmowa („nie da się") zostawiłaby użytkownika z pytaniem, czego brakuje.
  {const sg=$("mAbsSeg");
   if(sg)for(const b of sg.querySelectorAll("button"))b.onclick=()=>{
     const want=(b.dataset.v==="1"),M=m();
     M.mouseAbsolute=want;
     if(want&&M.mouseSource!=="filter"){
       M.mouseSource="filter";
       flashTrigMsg(_gl("Wskazywanie wymaga filtra 3D — przełączam źródło ruchu",
                        "Pointing needs the 3D filter — switching the motion source"));
     }
     buildMouseControls();mFill();commitMouse();mAreaFetch();};}
  mAreaFetch();
}
