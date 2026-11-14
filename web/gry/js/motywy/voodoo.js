// Motyw „Voodoo” (runda 5, 10-17): trujące bagno voodoo z filcu. Tło to ilustracja (tlo.webp: chata szamana, kocioł
// z limonkową miksturą, fiolki, czaszki, kości i świece, z góry zwisają toksyczne opary i mech), karta toru to ciemna,
// bagienna szyba (faktura.webp: zielony filc z czaszkami mnożony na zieleń, od dołu limonkowa łuna jak z kotła, po
// bokach fioletowe winiety). Nuty: kości z cieniem walca, porami i kłykciami na końcach (ziarno nuty ustala ich
// wielkość), zaśpiewana część zalewa się trującą zielenią z bąbelkami. Klawiatura: białe klawisze z kości, czarne z
// ciemnego fioletu zszyte zieloną nicią. Widownia: trujące żaby i żabi szamani (fan-*.webp) na omszałym gruncie ze
// świecami (iskra-4), ruch tupanie albo upiorne unoszenie się. Streak (detal PODPISOWY): ślad to smuga toksycznego,
// limonkowo-fioletowego dymu z bąbelkami; z toru lecą czaszki, fiolki, kości, laleczki voodoo, świece i krople
// (iskra-0..5) i ociężale opadają. Głowa bez efektu: żabę ubiera przebranie motywu. Wszystko z buforów.
(function(){
  "use strict";
  const ID="voodoo",PI=Math.PI,TAU=2*PI;
  const BAGNO="#1b4026",BAGNO_C="#06110a",LIM="#9fe02b",LIM_J="#d8ff7a",LIM_C="#4f9a10",FIOL="#3a1558",FIOL_C="#1d0a2e",
    FIOL_J="#9a4fe0",KOSC="#efe4c6",KOSC_C="#a8956a",KOSC_B="#4b3e24",MECH="#2b5a22";
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
  // Włókna filcu: krótkie zakrzywione włoski w dwóch tonach na kafelku 96 px, zawinięte na brzegach (bez szwu).
  function kafelekFilcu(jasne,ciemne,ile){
    const cv=document.createElement("canvas");cv.width=cv.height=96;const x=cv.getContext("2d");
    x.lineCap="round";
    for(const [kol,off] of [[ciemne,0],[jasne,1]]){
      x.strokeStyle=kol;x.lineWidth=off?.6:.8;x.beginPath();
      for(let i=off;i<ile;i+=2){
        const px=los(i,1)*96,py=los(i,2)*96,a=los(i,3)*TAU,l=2+los(i,4)*5,dx=Math.cos(a)*l,dy=Math.sin(a)*l;
        for(const [ox,oy] of [[0,0],[-96,0],[0,-96],[-96,-96]]){x.moveTo(px+ox,py+oy);x.quadraticCurveTo(px+ox+dx*.5+dy*.2,py+oy+dy*.5-dx*.2,px+ox+dx,py+oy+dy);}
      }
      x.stroke();
    }
    return cv;
  }
  const WZORY=new Map();
  function wzor(c,klucz,tworz,skala){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");if(skala&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix().scale(skala));WZORY.set(klucz,w);}
    return w;
  }
  const filcMech=c=>wzor(c,"mech",()=>kafelekFilcu("rgba(190,255,110,.35)","rgba(5,25,5,.28)",360));
  // faktura motywu (zielony filc z czaszkami, kafel 512 bez szwów); zanim się wczyta: włókna z kodu
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    if(!im)return filcMech(c);
    return wzor(c,"faktura",()=>im,.5);
  }

  // =========================================================================================== sprite'y
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("vd-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};
  // obłoczek toksycznego dymu: miękka plama limonkowa albo fioletowa (jeden gradient, raz)
  const puf=fiol=>bufor("vd-puf|"+(fiol?1:0),64,64,c=>{
    const g=c.createRadialGradient(32,32,0,32,32,32),r=fiol?"150,70,224":"150,232,40";
    g.addColorStop(0,"rgba("+r+",.85)");g.addColorStop(.5,"rgba("+r+",.38)");g.addColorStop(1,"rgba("+r+",0)");
    c.fillStyle=g;c.fillRect(0,0,64,64);
  });
  // blask świecy: limonkowy płomień, miękki
  const blask=()=>bufor("vd-blask",64,64,c=>{
    const g=c.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,"rgba(190,255,90,.75)");g.addColorStop(.4,"rgba(150,232,40,.28)");g.addColorStop(1,"rgba(150,232,40,0)");
    c.fillStyle=g;c.fillRect(0,0,64,64);
  });

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.14,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["159,224,43",.09],["138,63,208",.07]],swiatlo:["200,255,120","90,40,150"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#0a0614";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(8,2,20,0)");g.addColorStop(1,"rgba(8,2,20,.34)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Bagienna szyba: zielony filc z czaszkami mnożony na zieleń, od dołu limonkowa łuna jak z kotła, po bokach
  // fioletowe winiety, u góry lekkie zaciemnienie. Rysowane raz na układ do bufora, więc gradienty tu są tanie.
  function fakturaKarty(c,L){
    c.globalCompositeOperation="multiply";c.globalAlpha=.62;c.fillStyle=fakturaWzor(c);c.fillRect(L.x,L.y,L.w,L.h);
    c.globalCompositeOperation="source-over";c.globalAlpha=1;
    const v=c.createLinearGradient(0,L.y,0,L.y+L.h);
    v.addColorStop(0,"rgba(4,8,6,.32)");v.addColorStop(.3,"rgba(4,8,6,0)");v.addColorStop(.62,"rgba(159,224,43,0)");v.addColorStop(1,"rgba(159,224,43,.24)");
    c.fillStyle=v;c.fillRect(L.x,L.y,L.w,L.h);
    const lu=c.createRadialGradient(L.x+L.w/2,L.y+L.h*1.05,0,L.x+L.w/2,L.y+L.h*1.05,Math.max(L.w*.55,L.h*.8));
    lu.addColorStop(0,"rgba(190,255,90,.2)");lu.addColorStop(1,"rgba(190,255,90,0)");
    c.fillStyle=lu;c.fillRect(L.x,L.y,L.w,L.h);
    const bk=Math.min(L.w*.2,150),g=c.createLinearGradient(L.x,0,L.x+L.w,0);
    g.addColorStop(0,"rgba(110,40,170,.42)");g.addColorStop(bk/L.w,"rgba(110,40,170,0)");
    g.addColorStop(1-bk/L.w,"rgba(110,40,170,0)");g.addColorStop(1,"rgba(110,40,170,.42)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
  }

  // =========================================================================================== nuty
  // Kość: walec z kości słoniowej (jasny grzbiet u góry, cień od dołu), kilka porów i rysa z ziarna. Kłykcie na obu
  // końcach (dwie pary guzów poza obrysem); ziarno ustala, jak duże i wydłużone są kłykcie. Brązowy obrys odcina
  // kość od zielonej karty.
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"#fffbea");g.addColorStop(.3,KOSC);g.addColorStop(.72,"#d8c9a0");g.addColorStop(1,KOSC_C);
      WALEC.set(k,g);}
    return g;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2,z=o.ziarno|0;
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle="rgba(110,90,50,.38)";
      const por=Math.min(6,Math.max(2,Math.floor(w/22)));
      for(let k=0;k<por;k++)c.fillRect(x0+nh*.8+los(z,k)*(w-nh*1.6),y0+nh*.2+los(z,k+30)*nh*.5,1.5,1.5);
      if(w>nh*3&&z%3===0){
        const xa=x0+w*(.3+.4*los(z,5));
        c.strokeStyle="rgba(100,80,45,.55)";c.lineWidth=.8;c.beginPath();
        c.moveTo(xa,y0+nh*.12);c.lineTo(xa+nh*.2,y0+nh*.4);c.lineTo(xa+nh*.05,y0+nh*.62);c.stroke();
      }
    },
    poza(c,w,nh,o){
      const z=o.ziarno|0,x0=-w/2,x1=w/2,dl=los(z,3);
      const rx=nh*(.27+.1*dl),ry=nh*(.3+.18*dl),dy=nh*.42;
      c.fillStyle="#f6ecd0";c.strokeStyle=KOSC_B;c.lineWidth=1.3;
      c.beginPath();
      const xs=w>nh*3.2?[x0+nh*.9,x1-nh*.75]:[x0+nh*.9];
      for(const x of xs)for(const s of [-1,1]){c.moveTo(x+rx,s*dy);c.ellipse(x,s*dy,rx,ry,0,0,TAU);}
      c.fill();c.stroke();
    },
    brzeg:()=>KOSC_B,zapas:nh=>Math.ceil(nh*.62)};

  // =========================================================================================== klawisze
  // Mokry filc bagna (faktura mnożona), białe klawisze z kości, czarne z ciemnego fioletu zszyte zieloną nicią.
  // Gracz: limonkowy pas jak ze słoika z trucizną.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(2,8,4,.5)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=BAGNO;c.fill();
      c.save();c.clip();c.globalCompositeOperation="multiply";c.globalAlpha=.62;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.restore();
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,"#fffbea");grad.addColorStop(.6,KOSC);grad.addColorStop(1,KOSC_C);
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,5));
      }
      c.fillStyle=grad;c.fill();
      c.strokeStyle="rgba(75,62,36,.7)";c.lineWidth=1;c.stroke();
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,4,4,0]);}
      c.fillStyle="#2a1042";c.fill();c.strokeStyle=FIOL_C;c.lineWidth=1;c.stroke();
      c.save();c.clip();c.globalCompositeOperation="screen";c.globalAlpha=.1;c.fillStyle=filcMech(c);c.fillRect(x,y0,w,h);c.restore();
      c.setLineDash(SCIEG);c.strokeStyle="rgba(159,224,43,.85)";c.lineWidth=1.2;c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s),yy=k.y+k.h/2;c.moveTo(k.x+3,yy);c.lineTo(k.x+k.w*.62-4,yy);}
      c.stroke();
      c.strokeStyle="rgba(190,240,100,.5)";c.lineWidth=1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=BAGNO_C;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(159,224,43,.9)":"rgba(159,224,43,.48)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?FIOL_C:"rgba(29,10,46,.6)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Trujące żaby i żabi szamani z fan-*.webp na omszałym gruncie, między nimi świece z iskra-4 z delikatnie
  // drżącym blaskiem. Kolejność z ziarnem bez sąsiadów-bliźniaków, odbicia i skala z ziarna. Żaby (0..2) tupią,
  // szamani (3..5) unoszą się upiornie; w spokoju stoją.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=83;
    while(r.length<n){
      const p=[];for(let i=0;i<FANY;i++)p.push(i);for(let i=FANY-1;i>0;i--){const j=Math.floor(los(z,i)*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}z++;
      if(p[0]===ost){const t=p[0];p[0]=p[FANY-1];p[FANY-1]=t;}
      for(const f of p){if(r.length>=n)break;const k=r.length;
        r.push({f,lustro:los(k,3)>.5,sk:.86+.14*los(k,4),dx:(los(k,8)-.5)*.16,swiecz:los(k,12)>.5,fl:los(k,13)*TAU});ost=f;}
    }
    RZAD.set(n,r);return r;
  }
  function fan(i,h,lustro){
    const im=obraz("fan-"+i+".webp");if(!im||!jest())return null;
    const s=h/im.naturalHeight,w=Math.max(1,Math.round(im.naturalWidth*s));
    return bufor("vd-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  // grunt: pas mchu z zielonego filcu z włóknami, jaśniejszy brzeg ze ściegiem, cień od góry (raz na rozmiar)
  const grunt=(W,h)=>bufor("vd-grunt|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(4,10,6,0)");g.addColorStop(.6,"rgba(4,10,6,.22)");g.addColorStop(1,"rgba(4,10,6,.38)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
    const y=h*.76,lin=o=>x=>y+o+Math.sin(x*.021)*h*.03+Math.sin(x*.0061+1)*h*.045;
    const fala=o=>{const f=lin(o);c.beginPath();c.moveTo(0,h);c.lineTo(0,f(0));
      for(let x=0;x<=W;x+=24)c.lineTo(x,f(x));c.lineTo(W,h);c.closePath();};
    fala(-3);c.fillStyle="#8fd02a";c.fill();
    fala(1);c.fillStyle="rgba(6,20,6,.4)";c.fill();
    fala(0);c.fillStyle=MECH;c.fill();c.fillStyle=filcMech(c);c.fill();
    const f=lin(6);c.beginPath();for(let x=0;x<=W;x+=24){if(x)c.lineTo(x,f(x));else c.moveTo(x,f(x));}
    c.strokeStyle="rgba(215,255,140,.55)";c.lineWidth=1.2;c.setLineDash([4,3]);c.stroke();c.setLineDash(BRAK);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.95)),krok=W/n,R0=rzad(n);
      const dno=Wd.y+h*1.02,ts=(st.teraz||0)/1000,ruch=!st.spokoj&&!st.bezRuchu;
      // świece za fanami: stoją w szczelinach rzędu, blask drży łagodnie (bez migania)
      const sw=iskra(4,64),bl=blask();let ile=0;
      if(sw&&bl)for(let i=1;i<n&&ile<5;i++){
        const r=R0[i];if(!r.swiecz||R0[i-1].swiecz)continue;ile++;
        const x=krok*i,cs=fh*.62,dr=ruch?.85+.15*Math.sin(ts*3+r.fl):1,gs=cs*1.7;
        c.globalAlpha=.55*dr;c.drawImage(bl.cv,x-gs/2,dno-cs*.74-gs/2,gs,gs);c.globalAlpha=1;
        c.drawImage(sw.cv,x-cs/2,dno-cs*1.0,cs,cs);
      }
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,r.f<3?"tupanie":"upior",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
      c.drawImage(grunt(W,h).cv,0,Wd.y,W,h);   // mech na wierzchu: fani stoją w nim po kostki
    }};

  // =========================================================================================== streak
  // Ślad: smuga toksycznego dymu. Ciemnofioletowy cień, limonkowa wstęga z jasnym rdzeniem, na niej obłoczki dymu
  // (limonkowe i fioletowe, większe i rzadsze ku ogonowi, unoszące się) oraz bąbelki pękające nad śladem.
  const POF=6,BABLE=8;
  const streak={
    glowa(){},
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),sz=k.og>=3?7:k.og>=2?6:5,ts=k.ts;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}const y=p.y+Math.sin(p.x*.045-ts*3)*2.4;if(pi)c.lineTo(p.x,y);else{c.moveTo(p.x,y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+5;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=sz;c.stroke();
      c.strokeStyle=g.c;c.lineWidth=Math.max(1.2,sz*.3);c.stroke();
      if(!jest()||k.pelna===false||k.og<1)return;
      const pl=puf(false),pf=puf(true);let ost=-1e9,nr=0;
      for(const p of pts){
        if(!p.sp||p.x-ost<26||p.x<k.x0)continue;ost=p.x;
        const f=Math.max(0,Math.min(1,(p.x-k.x0)/(k.dlug||1)));
        if(++nr>POF*2+k.og*2)break;
        const r=12+18*(1-f)+k.og*2,y=p.y+Math.sin(p.x*.045-ts*3)*2.4-(1-f)*10-3*Math.sin(ts*2+p.x*.04),b=nr%3===2?pf:pl;
        c.globalAlpha=.2+.45*f;c.drawImage(b.cv,p.x-r,y-r,2*r,2*r);
      }
      c.globalAlpha=1;
      // bąbelki: unoszą się nad śladem i bledną (jedno stroke na bąbel, najwyżej BABLE)
      ost=-1e9;nr=0;c.lineWidth=1.1;
      for(const p of pts){
        if(!p.sp||p.x-ost<48||p.x<k.x0)continue;ost=p.x;
        const f=(p.x-k.x0)/(k.dlug||1);if(f<.1||f>.95)continue;
        if(++nr>Math.min(BABLE,3+k.og*2))break;
        const ph=(ts*.7+los(nr,2))%1,r=1.8+2.2*los(nr,3),y=p.y-sz*.5-3-ph*(14+8*los(nr,4));
        c.globalAlpha=(1-ph)*.9;c.strokeStyle=nr%2?LIM_J:"#c9a0f5";
        c.beginPath();c.arc(p.x+Math.sin(ts*3+nr)*2,y,r,0,TAU);c.stroke();
      }
      c.globalAlpha=1;
    },
    // płonąca nuta: zaśpiewana część zalewa się trującą zielenią z bąbelkami, na froncie kropla trucizny
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){
        c.fillStyle="rgba(120,214,26,.7)";c.fillRect(x0,-nh/2,fx-x0,nh);
        c.fillStyle="rgba(225,255,150,.42)";c.fillRect(x0,-nh/2,fx-x0,Math.max(1.5,nh*.2));
        c.fillStyle="rgba(26,80,10,.34)";c.fillRect(x0,nh/2-Math.max(1.5,nh*.2),fx-x0,Math.max(1.5,nh*.2));
        if(aktywna&&fx-x0>nh){
          c.strokeStyle="rgba(235,255,180,.8)";c.lineWidth=1;c.beginPath();
          for(let k=0;k<3;k++){const ph=(ts*.8+k*.33)%1,bx=fx-nh*.5-k*nh*.9;if(bx<x0+2)continue;
            const by=nh*.3-ph*nh*.7;c.moveTo(bx+nh*.1,by);c.arc(bx,by,Math.max(1.2,nh*.1),0,TAU);}
          c.stroke();
        }
      }
      if(gas>.05&&jest()){
        const im=iskra(5,48),s=nh*(aktywna?1.4:1.1);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.6,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)trucizna(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(5,48);iskra(4,64);puf(false);puf(true);blask();}catch(e){}},
    aura:["#d8ff7a","#9a4fe0"],wypelnienie:["#f4ffd8","#b8f23a",LIM_C],
    iskry:{kolory:["#f4ffd8",LIM,FIOL_J]},dym:"#8bd024",
    scena:["159,224,43","138,63,208","40,120,30"],
    tlo:{promienie:[["159,224,43",.09],["138,63,208",.07]],swiatlo:["200,255,120","90,40,150"]}};

  const GRAD=new Map();
  function gradSladu(c,x0,xT){
    const kl=Math.round(x0)*16384+Math.round(xT);let g=GRAD.get(kl);if(g)return g;
    if(GRAD.size>24)GRAD.clear();
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(29,10,46,0)");a.addColorStop(.5,"rgba(29,10,46,.5)");a.addColorStop(1,"rgba(40,14,64,.8)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(159,224,43,0)");b.addColorStop(.5,"rgba(159,224,43,.8)");b.addColorStop(1,"rgba(170,240,60,.98)");
    const d=c.createLinearGradient(x0,0,xT,0);d.addColorStop(0,"rgba(235,255,170,0)");d.addColorStop(.5,"rgba(235,255,170,.7)");d.addColorStop(1,"rgba(245,255,200,.95)");
    g={a,b,c:d};GRAD.set(kl,g);return g;
  }

  // ---- trucizna z kotła: pula na gracza, bez alokacji w klatce ----
  // Czaszka, fiolka, kość, laleczka, świeca i kropla (iskra-0..5) wylatują zza żaby w górę i do tyłu, wirując,
  // i opadają ociężale jak z kotła (większa grawitacja niż wieńce w tiki); czaszki i krople częściej. Na progu
  // kombo co 4 nuty trzy naraz.
  const PULE=new WeakMap(),MAKS_CZ=10,TEMPO=[0,1,2,3.4],LOSUJ=[0,0,5,5,1,2,3,4,0,3];
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,dos:0,cz:[]};
    for(let i=0;i<MAKS_CZ;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,k:0,r:20,rot:0,wir:0});
    PULE.set(g,p);return p;
  }
  function rzuc(P,L,g,sc,og){
    for(const p of P.cz)if(p.z<=0){
      const pz=pozycjaZaby(L,g);
      p.k=LOSUJ[Math.floor(Math.random()*LOSUJ.length)];p.r=Math.round(sc*(.24+.05*og)*(.85+.3*Math.random()));
      p.x=pz.x-sc*.2+(Math.random()-.5)*sc*.3;p.y=pz.y-sc*.35;p.vx=-(36+55*Math.random());p.vy=-(120+60*Math.random());
      p.rot=Math.random()*TAU;p.wir=(Math.random()<.5?-1:1)*(1.2+1.8*Math.random());p.zy=1.4+.5*Math.random();p.z=p.zy;return;
    }
  }
  function trucizna(c,L,g,st){
    if(typeof pozycjaZaby!=="function"||!jest())return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(og>0){
      P.dos+=dt*TEMPO[og];if(P.dos>=1){P.dos-=1;rzuc(P,L,g,sc,og);}
      if(k>P.k&&k>=4&&k%4===0)for(let j=0;j<3;j++)rzuc(P,L,g,sc,og);
    }else P.dos=0;
    P.k=k;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=240*dt;p.rot+=p.wir*dt;
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,s=p.r*(f<.15?.5+.5*f/.15:1);
      c.globalAlpha=f<.1?f/.1:p.z<.45?p.z/.45:1;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Voodoo",kolejnosc:23,kolor:"#9fe02b",zasoby:ZASOBY,przebranie:true,
    opis:"Trujące bagno voodoo z filcu: chata szamana, kocioł z limonkową miksturą, czaszki, świece i kości. Karta to ciemna, bagienna zieleń z łuną od kotła, nuty to kości, a przy kombo za żabą ciągnie się smuga toksycznego dymu z bąbelkami i lecą czaszki, fiolki i laleczki.",
    cechy:{tlo:"bagno szamana",klawisze:"kość i fiolet",streak:"toksyczny dym",widownia:"trujące żaby i szamani"},
    en:{nazwa:"Voodoo",
      opis:"A felt voodoo swamp: a shaman's hut, a cauldron of lime-green brew, skulls, candles and bones. The card is dark swamp green with a glow from the cauldron, notes are bones, and on a combo a trail of toxic smoke with bubbles follows you while skulls, vials and voodoo dolls fly out.",
      cechy:{tlo:"shaman's swamp",klawisze:"bone and violet",streak:"toxic smoke",widownia:"poison frogs and shamans"}},
    karta:{papier:BAGNO,cien:"rgba(2,10,4,.5)",czarne:"rgba(14,4,26,.28)",liniaC:"rgba(200,255,150,.2)",minione:"rgba(2,10,4,.3)",
      nazwy:"rgba(228,246,205,.85)",kreski:"rgba(190,240,130,.2)",nic:KOSC,szpilka:"#b8f23a",szpilkaBlask:"#f4ffd0",
      cienNuty:"rgba(2,10,4,.55)",scieg:"rgba(190,240,100,.55)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
