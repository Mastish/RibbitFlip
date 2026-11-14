// Motyw „Giełda” (runda 5, 10-17): parkiet giełdy z filcu. Tło to ilustracja (tlo.webp: wykresy ze strzałkami w górę,
// złote posągi, stosy monet i banknotów, wieżowce z granatowego filcu), karta toru to granatowa szyba z garniturowym
// prążkiem (faktura.webp mnożona na granat), ledwo widoczną kremową siatką wykresu i cienką złotą linią wzrostów
// przebiegającą przez kartę (statycznie, w karta.rysuj). Nuty: zielone banknoty z filcu z jaśniejszą ramką i medalionem
// na początku, a ziarno wybiera dodatek: drugi medalion, pasek zabezpieczający albo gwiazdki. Klawiatura: białe klawisze
// z kremowego papieru, czarne z granatowego garnituru z cienką czerwoną linią krawata, ścieg złotą nicią. Widownia:
// korpo-żaby w garniturach i filcowe worki złota (fan-*.webp) na pasie granatowego parkietu z prążkiem, w rytm kiwają
// się i podskakują jak przy wysokiej piątce. Streak (detal PODPISOWY): ślad to ciąg złotych monet toczących się za żabą,
// przy ogniu 2+ nad nim rośnie zielona strzałka wykresu; z toru sypią się monety i banknoty (iskra-0..5) i opadają
// ciężko. Głowa bez efektu: żabę ubiera przebranie motywu (cylinder i monokl). Wszystko z buforów.
(function(){
  "use strict";
  const ID="gielda",PI=Math.PI,TAU=2*PI;
  const GRAN="#3a62ae",GRAN_C="#0e1b3d",GRAN_G="#1a2d5c",ZLOTO="#e0a92c",ZLOTO_J="#ffd76a",KREM="#f3ead2",
    BANKNOT=["#2f7d46","#3a8a4f","#2a7340"],BANKNOT_C="#0a2616",ZIEL="#4fc46d";
  const FANY=6,ISKRY=6;
  const ZASOBY=["tlo.webp","faktura.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5];   // kreski bez nowych tablic w klatce

  // =========================================================================================== wzory (raz)
  const WZORY=new Map();
  function wzor(c,klucz,tworz,skala){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");if(skala&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix().scale(skala));WZORY.set(klucz,w);}
    return w;
  }
  // faktura motywu (granatowy prążek garniturowy, kafel 512 bez szwów); zanim się wczyta: null (sam kolor)
  function fakturaWzor(c,skala){
    const im=obraz("faktura.webp");
    if(!im)return null;
    return wzor(c,"faktura|"+skala,()=>im,skala);
  }
  // gwiazdka jednostkowa (promień 1) do banknotów, raz
  let GWIAZDA=null;
  function gwiazda(){
    if(GWIAZDA||typeof Path2D==="undefined")return GWIAZDA;
    const p=new Path2D();
    for(let i=0;i<10;i++){const a=-PI/2+i*PI/5,r=i%2?.42:1;p[i?"lineTo":"moveTo"](Math.cos(a)*r,Math.sin(a)*r);}
    p.closePath();GWIAZDA=p;return p;
  }

  // =========================================================================================== sprite'y
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("gi-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.14,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["240,190,70",.09],["47,160,90",.05]],swiatlo:["255,226,150","30,50,110"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#c9a66a";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(10,16,40,0)");g.addColorStop(1,"rgba(10,16,40,.3)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Granatowa szyba: prążek mnożony (widać garniturową tkaninę), ledwo widoczna kremowa siatka wykresu, u góry ciepły
  // blask, a przez całą kartę pnie się cienka złota linia notowań (stała krzywa z ziarna, z kropkami w załamaniach).
  function liniaWykresu(c,L){
    const N=18,x0=L.x+L.w*.03,dx=L.w*.94/(N-1),yd=L.y+L.h*.88,yg=L.y+L.h*.14;
    c.beginPath();
    for(let i=0;i<N;i++){
      const t=i/(N-1),y=yd+(yg-yd)*Math.pow(t,.9)+(los(i,5)-.5)*L.h*.1*(i&&i<N-1?1:0),x=x0+i*dx;
      if(i)c.lineTo(x,y);else c.moveTo(x,y);
    }
    c.lineJoin="round";c.lineCap="round";
    c.strokeStyle="rgba(5,12,34,.35)";c.lineWidth=4;c.stroke();
    c.strokeStyle="rgba(240,190,70,.55)";c.lineWidth=1.6;c.stroke();
    c.fillStyle="rgba(255,215,106,.6)";
    for(let i=1;i<N-1;i+=3){
      const t=i/(N-1),y=yd+(yg-yd)*Math.pow(t,.9)+(los(i,5)-.5)*L.h*.1;
      c.beginPath();c.arc(x0+i*dx,y,2.2,0,TAU);c.fill();
    }
  }
  function fakturaKarty(c,L){
    const f=fakturaWzor(c,.55);
    if(f){c.globalCompositeOperation="multiply";c.globalAlpha=.5;c.fillStyle=f;c.fillRect(L.x,L.y,L.w,L.h);c.globalCompositeOperation="screen";c.globalAlpha=.2;c.fillRect(L.x,L.y,L.w,L.h);c.globalCompositeOperation="source-over";c.globalAlpha=1;}
    // siatka wykresu: kremowe linie bardzo subtelnie
    c.strokeStyle="rgba(243,234,210,.055)";c.lineWidth=1;c.beginPath();
    const kw=Math.max(48,Math.round(L.w/16)),kh=Math.max(40,Math.round(L.h/7));
    for(let x=L.x+kw;x<L.x+L.w;x+=kw){c.moveTo(Math.round(x)+.5,L.y);c.lineTo(Math.round(x)+.5,L.y+L.h);}
    for(let y=L.y+kh;y<L.y+L.h;y+=kh){c.moveTo(L.x,Math.round(y)+.5);c.lineTo(L.x+L.w,Math.round(y)+.5);}
    c.stroke();
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,205,110,.14)");g.addColorStop(.3,"rgba(255,205,110,0)");g.addColorStop(.7,"rgba(5,10,30,0)");g.addColorStop(1,"rgba(5,10,30,.22)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
    liniaWykresu(c,L);
  }

  // =========================================================================================== nuty
  // Banknot z zielonego filcu: ton z ziarna, cień walca, jaśniejsza ramka i przerywany ścieg tuż przy obrysie, okrągły
  // medalion na początku. Ziarno wybiera dodatek: małe medaliony, pasek zabezpieczający albo gwiazdki (powtarzane co
  // kilka wysokości taśmy). Ciemnozielony obrys odcina banknot od granatowej karty.
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(235,255,225,.3)");g.addColorStop(.35,"rgba(235,255,225,0)");g.addColorStop(.7,"rgba(0,40,15,.1)");g.addColorStop(1,"rgba(0,35,12,.4)");
      WALEC.set(k,g);}
    return g;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2,z=Math.abs(o.ziarno|0),orn=z%3,ton=((z/3)|0)%3;
      c.fillStyle=BANKNOT[ton];c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(nh<7||w<14)return;
      c.strokeStyle="rgba(176,232,188,.85)";c.lineWidth=Math.max(1,Math.min(1.6,nh*.1));c.strokeRect(x0+2.5,y0+2.5,w-5,nh-5);
      if(nh>=14){c.setLineDash(SCIEG);c.strokeStyle="rgba(243,234,210,.5)";c.lineWidth=1;c.strokeRect(x0+5.5,y0+5.5,w-11,nh-11);c.setLineDash(BRAK);}
      if(nh<9||w<nh*2.2)return;
      const r=Math.max(2.5,nh*.27),cy=0,mx=x0+Math.min(nh*.8,w*.3),lim=x0+w-nh*.7;
      c.beginPath();c.arc(mx,cy,r,0,TAU);c.fillStyle="#cdeccf";c.fill();
      c.lineWidth=Math.max(1,r*.28);c.strokeStyle="#1d5a31";c.stroke();
      c.beginPath();c.arc(mx,cy,r*.4,0,TAU);c.fillStyle=BANKNOT[ton];c.fill();
      if(w<nh*5)return;
      const st=orn===0?nh*2.6:nh*3.2;let n=0;
      for(let px=mx+nh*1.9;px<lim&&n<6;px+=st,n++){
        if(orn===0){c.beginPath();c.arc(px,cy,r*.55,0,TAU);c.fillStyle="#cdeccf";c.fill();c.lineWidth=1;c.strokeStyle="#1d5a31";c.stroke();}
        else if(orn===1){const bw=Math.max(2,nh*.16);c.fillStyle="rgba(240,244,214,.8)";c.fillRect(px-bw/2,y0+3,bw,nh-6);c.fillStyle="rgba(10,38,22,.5)";c.fillRect(px-bw/2-.8,y0+3,.8,nh-6);c.fillRect(px+bw/2,y0+3,.8,nh-6);}
        else{const S=gwiazda();if(!S)break;const rs=Math.max(2.4,nh*.24);c.translate(px,cy);c.scale(rs,rs);c.fillStyle="#eaf6d2";c.fill(S);c.scale(1/rs,1/rs);c.translate(-px,-cy);}
      }
    },
    brzeg:()=>BANKNOT_C,zapas:()=>0};

  // =========================================================================================== klawisze
  // Granatowy prążek jako tło klawiatury, białe klawisze z kremowego papieru z cienką czerwoną kreską marginesu jak w
  // księdze, czarne z granatowego garnituru (prążek jaśnieje) z cienką czerwoną linią krawata i węzłem, złoty ścieg.
  // Gracz: złoty pas z ciemnym ściegiem.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(4,8,24,.5)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=GRAN_G;c.fill();
      const f=fakturaWzor(c,.55);if(f){c.fillStyle=f;c.fill();}
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,"#fcf6e2");grad.addColorStop(.6,KREM);grad.addColorStop(1,"#d3c294");
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,5));
      }
      c.fillStyle=grad;c.fill();
      c.save();c.clip();c.strokeStyle="rgba(205,70,70,.3)";c.lineWidth=1;c.beginPath();c.moveTo(x+w*.1+.5,y0);c.lineTo(x+w*.1+.5,y0+h);c.stroke();c.restore();
      c.strokeStyle="rgba(14,27,61,.55)";c.lineWidth=1;c.stroke();
      // czarne: garnitur
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,4,4,0]);}
      c.fillStyle="#13244f";c.fill();
      if(f){c.save();c.clip();c.globalCompositeOperation="screen";c.globalAlpha=.5;c.fillStyle=f;c.fillRect(x,y0,w,h);c.restore();}
      c.strokeStyle=GRAN_C;c.lineWidth=1.2;c.stroke();
      // krawat: cienka czerwona linia wzdłuż klawisza i mały węzeł przy końcu
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s),yy=k.y+k.h/2;c.moveTo(k.x+k.w*.1,yy);c.lineTo(k.x+k.w*.5,yy);}
      c.strokeStyle="#d8342f";c.lineWidth=1.3;c.stroke();
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s),yy=k.y+k.h/2,xx=k.x+k.w*.5,r=Math.min(2.6,k.h*.28);c.moveTo(xx-r,yy);c.lineTo(xx,yy-r);c.lineTo(xx+r,yy);c.lineTo(xx,yy+r);c.closePath();}
      c.fillStyle="#d8342f";c.fill();
      c.setLineDash(SCIEG);c.strokeStyle="rgba(240,196,90,.75)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=GRAN_C;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(240,190,70,.93)":"rgba(240,190,70,.52)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.fillStyle="rgba(255,244,200,.3)";c.fillRect(L.kx+1,y+.5,L.kw-2,Math.max(1,Math.min(3,hh*.28)));
      c.strokeStyle=g.naNucie?GRAN_C:"rgba(14,27,61,.55)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Korpo-żaby i worki złota z fan-*.webp na pasie granatowego parkietu z prążkiem. Kolejność z ziarnem bez sąsiadów-
  // bliźniaków, odbicia i skala z ziarna, ruch „headbang” (kiwnięcie i podskok na ćwierćnutę jak wysoka piątka).
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=71;
    while(r.length<n){
      const p=[0,1,2,3,4,5];for(let i=5;i>0;i--){const j=Math.floor(los(z,i)*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}z++;
      if(p[0]===ost){const t=p[0];p[0]=p[5];p[5]=t;}
      for(const f of p){if(r.length>=n)break;const k=r.length;
        r.push({f,lustro:los(k,3)>.5,sk:.86+.14*los(k,4),dx:(los(k,8)-.5)*.16});ost=f;}
    }
    RZAD.set(n,r);return r;
  }
  function fan(i,h,lustro){
    const im=obraz("fan-"+i+".webp");if(!im||!jest())return null;
    const s=h/im.naturalHeight,w=Math.max(1,Math.round(im.naturalWidth*s));
    return bufor("gi-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  const FLOOR=.3;   // udział wysokości pasa zajęty przez parkiet
  const parkiet=(W,h)=>bufor("gi-park|"+W+"x"+h,W,h,c=>{
    const hf=Math.round(h*FLOOR),y=h-hf;
    const g=c.createLinearGradient(0,0,0,y);g.addColorStop(0,"rgba(8,14,36,0)");g.addColorStop(1,"rgba(8,14,36,.3)");
    c.fillStyle=g;c.fillRect(0,0,W,y);
    c.fillStyle=GRAN_G;c.fillRect(0,y,W,hf);
    const f=fakturaWzor(c,.5);if(f){c.fillStyle=f;c.fillRect(0,y,W,hf);}
    const gg=c.createLinearGradient(0,y,0,h);gg.addColorStop(0,"rgba(255,255,255,.1)");gg.addColorStop(1,"rgba(4,8,24,.4)");
    c.fillStyle=gg;c.fillRect(0,y,W,hf);
    c.fillStyle=ZLOTO;c.fillRect(0,y,W,2.2);
    c.fillStyle="rgba(5,12,34,.45)";c.fillRect(0,y+2.2,W,1.6);
    c.setLineDash(SCIEG);c.strokeStyle="rgba(243,234,210,.7)";c.lineWidth=1;c.beginPath();c.moveTo(0,y+6.5);c.lineTo(W,y+6.5);c.stroke();c.setLineDash(BRAK);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*.98),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.95)),krok=W/n,R0=rzad(n),dno=Wd.y+h*.94;
      c.drawImage(parkiet(W,h).cv,0,Wd.y,W,h);
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"headbang",i);
      }
    }};

  // =========================================================================================== streak
  // Głowę zastępuje przebranie żaby (hak pusty). Sygnatura: ciąg złotych monet toczących się za żabą i zielona strzałka
  // wykresu, która rośnie nad śladem przy ogniu 2+; z toru sypią się monety i banknoty.
  function ySladu(pts,x){
    let lo=0,hi=pts.length-1;if(hi<1||x<pts[0].x||x>pts[hi].x)return null;
    while(hi-lo>1){const m=(lo+hi)>>1;if(pts[m].x<=x)lo=m;else hi=m;}
    const a=pts[lo],b=pts[hi];if(!a.sp||!b.sp)return null;
    const t=b.x>a.x?(x-a.x)/(b.x-a.x):0;return a.y+(b.y-a.y)*t;
  }
  const GRAD=new Map();
  function gradSladu(c,x0,xT){
    const kl=Math.round(x0)*16384+Math.round(xT);let g=GRAD.get(kl);if(g)return g;
    if(GRAD.size>24)GRAD.clear();
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(8,14,36,0)");a.addColorStop(.5,"rgba(8,14,36,.45)");a.addColorStop(1,"rgba(8,14,36,.7)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(240,190,70,0)");b.addColorStop(.5,"rgba(240,190,70,.55)");b.addColorStop(1,"rgba(255,215,106,.9)");
    g={a,b};GRAD.set(kl,g);return g;
  }
  const STRZ_C="#0b3a1c";
  function strzalka(c,pts,k,og){
    const dl=k.dlug,x1=k.x0+dl*.14,x2=k.xT-dl*.08;if(!(x2-x1>60))return;
    const n=Math.max(4,Math.min(14,Math.round((x2-x1)/26))),dx=(x2-x1)/n,wys=(14+8*og),ts=k.ts;
    let px=0,py=0,lx=0,ly=0,ile=0;
    c.beginPath();
    for(let j=0;j<=n;j++){
      const x=x1+j*dx,y0=ySladu(pts,x);if(y0==null)continue;
      const f=j/n,zig=(j%2?-1:1)*(3+3*los(j,9))*(1+.15*Math.sin(ts*3+j)),y=y0-9-wys*Math.pow(f,1.1)-zig;
      if(ile)c.lineTo(x,y);else c.moveTo(x,y);
      lx=px;ly=py;px=x;py=y;ile++;
    }
    if(ile<3)return;
    c.lineJoin="round";c.lineCap="round";
    c.strokeStyle=STRZ_C;c.lineWidth=og>=3?6.4:5.4;c.stroke();
    c.strokeStyle=ZIEL;c.lineWidth=og>=3?3.4:2.8;c.stroke();
    // grot na końcu, zwrócony zgodnie z ostatnim odcinkiem
    const a=Math.atan2(py-ly,px-lx),s=og>=3?9:7.5;
    c.beginPath();c.moveTo(px+Math.cos(a)*s*.9,py+Math.sin(a)*s*.9);
    c.lineTo(px+Math.cos(a+2.5)*s,py+Math.sin(a+2.5)*s);c.lineTo(px+Math.cos(a-2.5)*s,py+Math.sin(a-2.5)*s);c.closePath();
    c.fillStyle=ZIEL;c.fill();c.lineWidth=1.4;c.strokeStyle=STRZ_C;c.stroke();
  }
  const streak={
    glowa(){},
    // ślad: cień, cienka złota nitka i monety (iskra-0) co kilkanaście pikseli, przewijane od żaby w tył; każda moneta
    // „obraca się” (zwężenie szerokości z położenia), z przodu pojawia się łagodnie, z tyłu zanika.
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),sz=k.og>=3?5:k.og>=2?4.4:3.6,ts=k.ts;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}const y=p.y+Math.sin(p.x*.05-ts*3)*1.2;if(pi)c.lineTo(p.x,y);else{c.moveTo(p.x,y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+2.4;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=sz*.55;c.stroke();
      if(!jest())return;
      const mon=iskra(0,40),dl=k.dlug;
      if(mon&&dl>40){
        const kr=k.og>=2?20:k.og>=1?25:32,n=Math.min(26,Math.floor(dl/kr)),r=k.og>=3?17:k.og>=2?15.5:14;
        const pr=ts*(30+10*k.og);
        for(let i=0;i<n;i++){
          const d=(i*kr+pr)%dl,x=k.xT-d,f=d/dl;if(x<k.x0)continue;
          const y=ySladu(pts,x);if(y==null)continue;
          const s=r*(1-.3*f),sx=.3+.7*Math.abs(Math.cos(d*.075+i));
          c.globalAlpha=f<.06?f/.06:f>.7?Math.max(0,(1-f)/.3):1;
          c.drawImage(mon.cv,x-s*sx/2,y-s/2,s*sx,s);
        }
        c.globalAlpha=1;
      }
      if(k.og>=2&&k.pelna!==false)strzalka(c,pts,k,k.og);
    },
    // płonąca nuta: zaśpiewana część złoci się (jasna górna krawędź), na froncie moneta
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){
        c.fillStyle="rgba(255,206,80,.6)";c.fillRect(x0,-nh/2,fx-x0,nh);
        c.fillStyle="rgba(255,246,200,.42)";c.fillRect(x0,-nh/2,fx-x0,Math.max(1,nh*.3));
        c.fillStyle="rgba(255,236,160,.9)";c.fillRect(fx-1.5,-nh/2,1.5,nh);
      }
      if(gas>.05&&jest()){
        const im=iskra(0,48),s=nh*(aktywna?1.5:1.15);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.6,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)sypanieToru(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(0,48);}catch(e){}},
    aura:["#fff3c8",ZLOTO],wypelnienie:["#fff4d0",ZLOTO_J,ZLOTO],
    iskry:{kolory:["#fff3c8","#f0c24a",ZIEL]},dym:false,
    scena:["240,190,70","79,196,109","60,90,170"],
    tlo:{promienie:[["240,190,70",.09],["47,160,90",.05]],swiatlo:["255,226,150","30,50,110"]}};

  // ---- monety i banknoty z toru: pula na gracza, bez alokacji w klatce ----
  // Moneta, stos monet, banknoty (zwykły, zwój, skrzydlaty) i żabia moneta (iskra-0..5) wylatują zza żaby w górę i do tyłu
  // i spadają ciężko (większa grawitacja niż lei w tiki): monety obracają się wokół osi pionowej (zwężenie), banknoty
  // trzepoczą. Na progu kombo co 4 nuty trzy naraz.
  const PULE=new WeakMap(),MAKS_CZ=12,TEMPO=[0,1,2,3.4],LOSUJ=[0,0,1,4,2,3,5,2,5,0],GRAW=330;
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,dos:0,cz:[]};
    for(let i=0;i<MAKS_CZ;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,k:0,r:20,rot:0,wir:0});
    PULE.set(g,p);return p;
  }
  function rzuc(P,L,g,sc,og){
    for(const p of P.cz)if(p.z<=0){
      const pz=pozycjaZaby(L,g);
      p.k=LOSUJ[Math.floor(Math.random()*LOSUJ.length)];p.r=Math.round(sc*(.25+.05*og)*(.85+.3*Math.random()));
      p.x=pz.x-sc*.2+(Math.random()-.5)*sc*.3;p.y=pz.y-sc*.35;p.vx=-(35+60*Math.random());p.vy=-(150+80*Math.random());
      p.rot=Math.random()*TAU;p.wir=(Math.random()<.5?-1:1)*(2+3*Math.random());p.zy=1.3+.5*Math.random();p.z=p.zy;return;
    }
  }
  function sypanieToru(c,L,g,st){
    if(typeof pozycjaZaby!=="function"||!jest())return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(og>0){
      P.dos+=dt*TEMPO[og];if(P.dos>=1){P.dos-=1;rzuc(P,L,g,sc,og);}
      if(k>P.k&&k>=4&&k%4===0)for(let j=0;j<3;j++)rzuc(P,L,g,sc,og);
    }else P.dos=0;
    P.k=k;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=GRAW*dt;p.rot+=p.wir*dt;
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,s=p.r*(f<.15?.5+.5*f/.15:1),mon=p.k===0||p.k===1||p.k===4;
      c.globalAlpha=f<.1?f/.1:p.z<.4?p.z/.4:1;
      if(mon){const sx=.25+.75*Math.abs(Math.cos(p.rot));c.drawImage(b.cv,p.x-s*sx/2,p.y-s/2,s*sx,s);}
      else{c.save();c.translate(p.x,p.y);c.rotate(Math.sin(p.rot)*.7);c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();}
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Giełda",kolejnosc:24,kolor:"#e0a92c",zasoby:ZASOBY,przebranie:true,
    opis:"Parkiet giełdy z filcu: wykresy ze strzałkami w górę, złote posągi, stosy monet i granatowe wieżowce, a w widowni żaby w garniturach i worki złota. Karta to granatowy prążek z cienką złotą linią wzrostów, nuty to zielone banknoty, a przy serii za żabą toczą się złote monety i rośnie strzałka zysku.",
    cechy:{tlo:"parkiet i wieżowce",klawisze:"papier i garnitur",streak:"monety i strzałka zysku",widownia:"korpo-żaby i worki złota"},
    en:{nazwa:"Stock Exchange",
      opis:"A felt trading floor: charts with upward arrows, golden statues, stacks of coins and navy skyscrapers, with suited frogs and sacks of gold in the crowd. The card is navy pinstripe with a thin golden growth line, notes are green banknotes, and on a streak golden coins roll behind you while a profit arrow grows.",
      cechy:{tlo:"trading floor",klawisze:"paper and pinstripe suit",streak:"coins and profit arrow",widownia:"suited frogs, gold sacks"}},
    karta:{papier:GRAN,cien:"rgba(4,8,24,.4)",czarne:"rgba(2,6,20,.2)",liniaC:"rgba(243,234,210,.22)",minione:"rgba(2,6,20,.26)",
      nazwy:"rgba(244,238,220,.88)",kreski:"rgba(243,234,210,.2)",nic:ZLOTO_J,szpilka:ZLOTO,szpilkaBlask:"#fff3c4",
      cienNuty:"rgba(2,6,20,.5)",scieg:"rgba(240,196,90,.6)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
