// Motyw „Muchomor” (runda 5, 10-17): psychodeliczny las grzybów z motywami z Krainy Czarów, cały z filcu. Tło to
// ilustracja (tlo.webp: różowe i tęczowe muchomory, spiralne niebo, zegarek, drzwiczki, karty), karta toru to ciemnofioletowa
// szyba z wyraźną fakturą tie-dye (faktura.webp mnożona ok. 0,5), przy brzegach spirale ze ściegu. Nuty: pasy jak kapelusze
// muchomorów (czerwony filc z białymi kropkami z ziarna, co trzecia nuta pomarańczowa kurka albo fioletowy grzyb), zaśpiewana
// część mieni się tęczą od pomarańczu do fioletu. Klawiatura: białe klawisze to kremowe blaszki grzyba (cienkie linie), czarne
// to czerwień z białymi kropkami. Widownia: żaby-grzyby i żaby z Krainy Czarów (fan-0..5.webp) tańczą groove na trawie
// ze spiralami. Streak (detal PODPISOWY): ślad to tęczowa spirala (cztery pasy przeplatają się jak w tunelu), a z toru
// wylatują i wolno się obracają grzyby (iskra-0..5). Głowa bez efektu: żabę ubiera przebranie motywu. Wszystko z buforów.
(function(){
  "use strict";
  const ID="muchomor",PI=Math.PI,TAU=2*PI;
  const FIOL="#6a38b8",FIOL_C="#1d0a3a",CZERW="#dd3b44",CZERW_C="#8f1a2e",KROP="#fff3dc",KURKA="#f58f1f",GRZYB="#9a5be0",
    LIMON="#a8dc32",POMAR="#ff8f1f",MAGENTA="#ff4da0",KREM="#f6e8c8",OBRYS="#f7e6c4";
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
  function wzor(c,klucz,tworz,skala,obrot){
    let w=WZORY.get(klucz);
    if(!w){
      if(WZORY.size>60)WZORY.clear();
      w=c.createPattern(tworz(),"repeat");
      if(skala&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix().rotate(obrot||0).scale(skala));
      WZORY.set(klucz,w);
    }
    return w;
  }
  // Włókna filcu na kafelku 96 px (jak w tiki), tu do trawy.
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
  const filcTrawy=c=>wzor(c,"trawa",()=>kafelekFilcu("rgba(210,255,120,.4)","rgba(10,50,10,.3)",360));
  // Kafel kropek z białego filcu na przezroczystym tle, z zawinięciem na brzegach (bez szwu): `wys` px, układ z ziarna.
  function kafelekKropek(wys,uklad){
    const Wt=Math.max(24,Math.round(wys*4)),cv=document.createElement("canvas");cv.width=Wt;cv.height=wys;
    const x=cv.getContext("2d"),n=3;
    for(let i=0;i<n;i++){
      const px=(i+.15+.7*los(uklad,i+1))*Wt/n,py=wys*(.3+.4*los(uklad,i+9)),r=Math.max(2,wys*(.17+.12*los(uklad,i+5)));
      for(const ox of [-Wt,0,Wt]){
        x.fillStyle="rgba(120,30,50,.3)";x.beginPath();x.arc(px+ox+.5,py+.9,r,0,TAU);x.fill();
        x.fillStyle=KROP;x.beginPath();x.arc(px+ox,py,r,0,TAU);x.fill();
        x.fillStyle="rgba(255,255,255,.55)";x.beginPath();x.arc(px+ox-r*.25,py-r*.28,r*.45,0,TAU);x.fill();
      }
    }
    return cv;
  }
  const kropki=(c,wys,uklad)=>wzor(c,"krop|"+wys+"|"+uklad,()=>kafelekKropek(wys,uklad));
  // Blaszki grzyba: cienkie jasne i ciemne linie wzdłuż klawisza, lekko rozchodzące się (kafel 40 × 6).
  function kafelekBlaszek(){
    const cv=document.createElement("canvas");cv.width=40;cv.height=6;const x=cv.getContext("2d");
    x.fillStyle="rgba(150,100,60,.2)";x.fillRect(0,0,40,.8);x.fillRect(0,3,40,.6);
    x.fillStyle="rgba(255,255,250,.55)";x.fillRect(0,1.4,40,.7);x.fillRect(0,4.2,40,.7);
    return cv;
  }
  const blaszki=c=>wzor(c,"blaszki",kafelekBlaszek);
  // faktura motywu (tie-dye, kafel 512 bez szwów); zanim się wczyta: sam fiolet
  // wariant 1: drugi, obrócony i mniejszy kafel kładziony na pierwszy, żeby zlały się brzegi kafli (siatki się nie pokrywają)
  function fakturaWzor(c,wariant){
    const im=obraz("faktura.webp");
    if(!im)return null;
    if(!wariant)return wzor(c,"faktura",()=>im,.5);
    return wzor(c,"faktura2",()=>im,.34,33);
  }

  // =========================================================================================== sprite'y
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("mu-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};

  // Spirala ze ściegu: Archimedesa od środka na zewnątrz, `obr` obrotów (znak = kierunek), `kat0` obrót startowy.
  function spirala(c,cx,cy,r,obr,kat0){
    c.beginPath();
    const n=Math.max(24,Math.round(Math.abs(obr)*18));
    for(let i=0;i<=n;i++){
      const t=i/n,a=kat0+obr*TAU*t,rr=r*t;
      if(i)c.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);else c.moveTo(cx,cy);
    }
    c.stroke();
  }

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.16,rama:{bok:.1,gora:12,dol:6,odstep:10},
    tlo:{promienie:[["255,143,31",.09],["168,92,255",.08]],swiatlo:["255,170,90","90,40,170"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#cdbd9a";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(30,10,60,0)");g.addColorStop(1,"rgba(30,10,60,.3)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Ciemnofioletowa szyba z tie-dye mnożonym na fiolet (wyraźnie, 0,5), ciepły blask u góry i ścieg spiral przy brzegach
  // (prawy brzeg i górne rogi, lewa strona należy do klawiatury).
  const SPIR=[[POMAR,.8],[LIMON,.7],[MAGENTA,.75],[KREM,.6]];
  function fakturaKarty(c,L){
    const f=fakturaWzor(c);
    if(f){c.globalCompositeOperation="multiply";c.globalAlpha=.55;c.fillStyle=f;c.fillRect(L.x,L.y,L.w,L.h);
      c.globalAlpha=.3;c.fillStyle=fakturaWzor(c,1);c.fillRect(L.x,L.y,L.w,L.h);
      c.globalCompositeOperation="screen";c.globalAlpha=.14;c.fillRect(L.x,L.y,L.w,L.h);c.globalCompositeOperation="source-over";c.globalAlpha=1;}
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,140,60,.2)");g.addColorStop(.28,"rgba(255,140,60,0)");g.addColorStop(.72,"rgba(20,5,45,0)");g.addColorStop(1,"rgba(20,5,45,.3)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
    // spirale ze ściegu: wzdłuż prawego brzegu i w górnym rogu, półprzezroczyste, pod nutami
    const R=Math.max(22,Math.min(L.h*.2,76)),prawa=L.x+L.w;
    c.lineCap="round";c.lineWidth=2.6;c.setLineDash([6,4]);
    const miejsca=[[prawa-R*.1,L.y+L.h*.1,1],[prawa-R*.05,L.y+L.h*.42,-1],[prawa-R*.12,L.y+L.h*.74,1],[prawa-R*.2,L.y+L.h*.97,-1],
      [L.x+L.w*.55,L.y-R*.08,-1],[L.x+L.w*.28,L.y+L.h*1.01,1]];
    for(let i=0;i<miejsca.length;i++){
      const m=miejsca[i],k=SPIR[i%SPIR.length];
      c.strokeStyle=k[0];c.globalAlpha=k[1];spirala(c,m[0],m[1],R*(.8+.35*los(i,2)),m[2]*2.4,los(i,3)*TAU);
    }
    c.setLineDash(BRAK);c.globalAlpha=1;
  }

  // =========================================================================================== nuty
  // Kapelusz muchomora: czerwony filc (co trzecia nuta pomarańczowa kurka albo fioletowy grzyb) z białymi kropkami z wzoru
  // (układ z ziarna), cień walca jak kopuła, u dołu kremowy rąbek blaszek. Obrys kremowy odcina nutę od ciemnej karty.
  function kolorNuty(z){
    if(z%3!==2)return CZERW;
    return (Math.floor(z/3)%2)?KURKA:GRZYB;
  }
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,245,230,.42)");g.addColorStop(.28,"rgba(255,245,230,0)");g.addColorStop(.62,"rgba(60,10,40,.1)");g.addColorStop(1,"rgba(50,5,40,.5)");
      WALEC.set(k,g);}
    return g;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2,z=o.ziarno|0,kol=kolorNuty(z);
      c.fillStyle=kol;c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=kropki(c,Math.max(8,Math.round(nh)),z%4);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(nh>=7){c.fillStyle="rgba(246,232,200,.85)";c.fillRect(x0-2,y0+nh-Math.max(1.6,nh*.14),w+4,Math.max(1.6,nh*.14)+2);}
    },
    brzeg:()=>OBRYS,zapas:()=>0};

  // =========================================================================================== klawisze
  // Fioletowa szyba z tie-dye, białe klawisze to kremowe blaszki grzyba (cienkie linie), czarne to czerwień z białymi
  // kropkami. Ścieg pomarańczowo-kremowy wokół. Gracz: pomarańczowy pas z ciemnofioletowym ściegiem.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(20,5,45,.5)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=FIOL;c.fill();
      const f=fakturaWzor(c);
      if(f){c.save();c.clip();c.globalCompositeOperation="multiply";c.globalAlpha=.5;c.fillStyle=f;c.fillRect(x,y0,w,h);c.restore();}
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,"#fffaf0");grad.addColorStop(.65,KREM);grad.addColorStop(1,"#d9bf8f");
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,5));
      }
      c.fillStyle=grad;c.fill();c.save();c.clip();c.fillStyle=blaszki(c);c.fillRect(x,y0,w,h);c.restore();
      c.strokeStyle="rgba(90,40,50,.55)";c.lineWidth=1;c.stroke();
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,4,4,0]);}
      c.fillStyle=CZERW;c.fill();
      c.save();c.clip();c.fillStyle=kropki(c,Math.max(8,Math.round(L.rh*.9)),1);c.fillRect(x,y0,w,h);c.restore();
      c.strokeStyle=CZERW_C;c.lineWidth=1;c.stroke();
      c.setLineDash(SCIEG);c.strokeStyle="rgba(255,190,110,.75)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=FIOL_C;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(255,143,31,.94)":"rgba(255,143,31,.52)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?FIOL_C:"rgba(29,10,58,.6)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Żaby-grzyby i żaby z Krainy Czarów z fan-*.webp na trawie z filcu ze spiralami. Kolejność z ziarnem bez sąsiadów-
  // bliźniaków, odbicia i skala z ziarna; ruch groove (biodra na boki) z motywy.js.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=53;
    while(r.length<n){
      const p=[];for(let i=0;i<FANY;i++)p.push(i);for(let i=FANY-1;i>0;i--){const j=Math.floor(los(z,i)*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}z++;
      if(p[0]===ost){const t=p[0];p[0]=p[FANY-1];p[FANY-1]=t;}
      for(const f of p){if(r.length>=n)break;const k=r.length;
        r.push({f,lustro:los(k,3)>.5,sk:.86+.14*los(k,4),dx:(los(k,8)-.5)*.16});ost=f;}
    }
    RZAD.set(n,r);return r;
  }
  function fan(i,h,lustro){
    const im=obraz("fan-"+i+".webp");if(!im||!jest())return null;
    const s=h/im.naturalHeight,w=Math.max(1,Math.round(im.naturalWidth*s));
    return bufor("mu-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  // trawa: falisty pas zielonego filcu z włóknami, jaśniejsza limonkowa krawędź ze ściegiem i spirale ze ściegu (raz na rozmiar)
  const trawa=(W,h)=>bufor("mu-trawa|"+W+"x"+h,W,h,c=>{
    const y=h*.72,lin=o=>x=>y+o+Math.sin(x*.027)*h*.035+Math.sin(x*.0083+1)*h*.05;
    const fala=o=>{const f=lin(o);c.beginPath();c.moveTo(0,h);c.lineTo(0,f(0));
      for(let x=0;x<=W;x+=20)c.lineTo(x,f(x));c.lineTo(W,h);c.closePath();};
    fala(-3);c.fillStyle=LIMON;c.fill();
    fala(0);const g=c.createLinearGradient(0,y-6,0,h);g.addColorStop(0,"#5fa02a");g.addColorStop(1,"#2d6420");c.fillStyle=g;c.fill();
    c.fillStyle=filcTrawy(c);c.fill();
    const f=lin(5);c.beginPath();for(let x=0;x<=W;x+=20){if(x)c.lineTo(x,f(x));else c.moveTo(x,f(x));}
    c.strokeStyle="rgba(240,255,190,.7)";c.lineWidth=1.2;c.setLineDash([4,3]);c.stroke();
    // spirale ze ściegu na trawie, rozmieszczone z ziarna (kolory z palety motywu)
    c.lineWidth=1.3;c.lineCap="round";
    const R=Math.max(7,Math.min(h*.2,16)),ile=Math.max(2,Math.floor(W/150));
    for(let i=0;i<ile;i++){
      const cx=(i+.25+.5*los(i,21))*W/ile,cy=y+h*.14+h*.1*los(i,22)+Math.sin(cx*.027)*h*.035;
      c.strokeStyle=SPIR[i%SPIR.length][0];c.globalAlpha=.85;spirala(c,cx,Math.min(h-R*.5,cy+R*.5),R*(.8+.4*los(i,23)),(i%2?-1:1)*2.2,los(i,24)*TAU);
    }
    c.setLineDash(BRAK);c.globalAlpha=1;
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.95)),krok=W/n,R0=rzad(n),dno=Wd.y+h*1.0;
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"groove",i);
      }
      c.drawImage(trawa(W,h).cv,0,Wd.y,W,h);   // trawa na wierzchu: żaby stoją w niej po kostki
    }};

  // =========================================================================================== streak
  // Ślad: tęczowa spirala. Cztery pasy (pomarańcz, magenta, fiolet, limonka) przeplatają się wokół osi śladu jak w tunelu
  // i płyną ku żabie; pod spodem ciemny cień. Przy wyższym kombo po śladzie suną małe grzyby (iskra-*).
  const TECZA=["255,143,31","255,77,160","170,100,255","168,220,50"];
  const GRAD=new Map();
  function gradSladu(c,x0,xT){
    const kl=Math.round(x0)*16384+Math.round(xT);let g=GRAD.get(kl);if(g)return g;
    if(GRAD.size>24)GRAD.clear();
    const mk=(rgb,a0,a1)=>{const q=c.createLinearGradient(x0,0,xT,0);q.addColorStop(0,"rgba("+rgb+",0)");q.addColorStop(.5,"rgba("+rgb+","+a0+")");q.addColorStop(1,"rgba("+rgb+","+a1+")");return q;};
    g={cien:mk("20,5,45",.45,.75),p:[mk(TECZA[0],.9,1),mk(TECZA[1],.9,1),mk(TECZA[2],.9,1),mk(TECZA[3],.9,1)]};
    GRAD.set(kl,g);return g;
  }
  function ySladu(pts,x){
    let lo=0,hi=pts.length-1;if(hi<1||x<pts[0].x||x>pts[hi].x)return null;
    while(hi-lo>1){const m=(lo+hi)>>1;if(pts[m].x<=x)lo=m;else hi=m;}
    const a=pts[lo],b=pts[hi];if(!a.sp||!b.sp)return null;
    const t=b.x>a.x?(x-a.x)/(b.x-a.x):0;return a.y+(b.y-a.y)*t;
  }
  // wstęga rozpięta na punktach śladu: odchylenie pasa i od osi o amp*sin(x*.05 - ts*5 + faza)
  function pas(c,pts,amp,faza,ts,sz,styl){
    c.beginPath();let pi=false;
    for(let i=0,n=pts.length;i<n;i++){const p=pts[i];if(!p.sp){pi=false;continue;}const y=p.y+(amp?Math.sin(p.x*.05-ts*5+faza)*amp:0);if(pi)c.lineTo(p.x,y);else{c.moveTo(p.x,y);pi=true;}}
    c.strokeStyle=styl;c.lineWidth=sz;c.stroke();
  }
  const streak={
    glowa(){},
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),sz=k.og>=3?5:k.og>=2?4.4:3.8,ts=k.ts,amp=sz*(1.05+.12*k.og);
      c.lineCap="round";c.lineJoin="round";
      pas(c,pts,0,0,ts,amp*2+sz*.9,g.cien);
      // pasy rysowane w kolejności „głębi”: te, których sin właśnie schodzi w dół, na wierzchu (złudzenie spirali)
      for(let i=0;i<4;i++)pas(c,pts,amp,i*PI/2,ts,sz*.72,g.p[i]);
      if(!jest()||k.og<2)return;
      const gr=iskra(3,32);let ost=-1e9,nr=0;
      if(gr)for(const p of pts){
        if(!p.sp||p.x-ost<70||p.x<k.x0)continue;ost=p.x;
        const f=(p.x-k.x0)/k.dlug;if(f<.22||f>.86)continue;
        if(++nr>4)break;
        const s=10+7*f,y=p.y+Math.sin(p.x*.05-ts*5)*amp*.4;
        c.save();c.translate(p.x,y);c.rotate(Math.sin(ts*1.4+p.x*.03)*.45);c.drawImage(gr.cv,-s/2,-s/2,s,s);c.restore();
      }
    },
    // płonąca nuta: zaśpiewana część mieni się tęczą od pomarańczu do fioletu, na froncie grzyb
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.globalAlpha=.78;c.fillStyle=gradTeczy(c,w);c.fillRect(x0,-nh/2,fx-x0,nh);c.globalAlpha=1;}
      if(gas>.05&&jest()){
        const im=iskra(z%ISKRY,48),s=nh*(aktywna?1.5:1.15);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.6,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)grzybyToru(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{for(let i=0;i<ISKRY;i++){iskra(i,40);iskra(i,48);}iskra(3,32);}catch(e){}},
    aura:["#d7a6ff",POMAR],wypelnienie:["#fff3dc","#ffb13b","#ff5a3c"],
    iskry:{kolory:["#fff3dc","#ffa13a","#b76dff"]},dym:false,
    scena:["255,143,31","168,92,255","255,77,160"],
    tlo:{promienie:[["255,143,31",.09],["168,92,255",.08]],swiatlo:["255,170,90","90,40,170"]}};

  // tęczowy gradient wnętrza zaśpiewanej nuty (jeden na szerokość nuty, środek w 0)
  const TECZE=new Map();
  function gradTeczy(c,w){
    const k=Math.round(w);let g=TECZE.get(k);if(g)return g;
    if(TECZE.size>40)TECZE.clear();
    g=c.createLinearGradient(-w/2,0,w/2,0);
    g.addColorStop(0,"#ff8f1f");g.addColorStop(.3,"#ffc23a");g.addColorStop(.55,"#ff5aa6");g.addColorStop(.8,"#a869ff");g.addColorStop(1,"#ffa83a");
    TECZE.set(k,g);return g;
  }

  // ---- grzyby z toru: pula na gracza, bez alokacji w klatce ----
  // Grzyby (iskra-0..5) wylatują zza żaby w górę i do tyłu, bardzo wolno się obracają i opadają miękko jak zarodniki.
  const PULE=new WeakMap(),MAKS_CZ=9,TEMPO=[0,1,1.8,3];
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,dos:0,cz:[]};
    for(let i=0;i<MAKS_CZ;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,k:0,r:20,rot:0,wir:0});
    PULE.set(g,p);return p;
  }
  function rzuc(P,L,g,sc,og){
    for(const p of P.cz)if(p.z<=0){
      const pz=pozycjaZaby(L,g);
      p.k=Math.floor(Math.random()*ISKRY);p.r=Math.round(sc*(.26+.05*og)*(.85+.3*Math.random()));
      p.x=pz.x-sc*.2+(Math.random()-.5)*sc*.3;p.y=pz.y-sc*.35;p.vx=-(30+50*Math.random());p.vy=-(90+60*Math.random());
      p.rot=Math.random()*TAU;p.wir=(Math.random()<.5?-1:1)*(.5+.7*Math.random());p.zy=1.9+.6*Math.random();p.z=p.zy;return;
    }
  }
  function grzybyToru(c,L,g,st){
    if(typeof pozycjaZaby!=="function"||!jest())return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(og>0){
      P.dos+=dt*TEMPO[og];if(P.dos>=1){P.dos-=1;rzuc(P,L,g,sc,og);}
      if(k>P.k&&k>=4&&k%4===0)for(let j=0;j<3;j++)rzuc(P,L,g,sc,og);
    }else P.dos=0;
    P.k=k;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=95*dt;p.rot+=p.wir*dt;
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,s=p.r*(f<.15?.5+.5*f/.15:1);
      c.globalAlpha=f<.1?f/.1:p.z<.5?p.z/.5:1;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Muchomor",kolejnosc:25,kolor:"#e6453a",zasoby:ZASOBY,przebranie:true,
    opis:"Psychodeliczny las grzybów z Krainy Czarów, cały z filcu: różowe i tęczowe muchomory, spiralne niebo, zegarek i drzwiczki. Karta to fiolet z tie-dye i spiralami ze ściegu, nuty to kapelusze muchomorów w kropki, a przy kombo za żabą wije się tęczowa spirala i lecą grzyby.",
    cechy:{tlo:"las muchomorów",klawisze:"blaszki i kropki",streak:"tęczowa spirala",widownia:"żaby-grzyby, groove"},
    en:{nazwa:"Fly Agaric",
      opis:"A psychedelic felt mushroom forest straight out of Wonderland: pink and rainbow toadstools, a swirling sky, a pocket watch and a tiny door. The card is purple tie-dye with stitched spirals, notes are polka-dot mushroom caps, and on a combo a rainbow spiral winds behind you while mushrooms float up.",
      cechy:{tlo:"toadstool forest",klawisze:"gills and dots",streak:"rainbow spiral",widownia:"mushroom frogs, groove"}},
    karta:{papier:FIOL,cien:"rgba(20,5,45,.42)",czarne:"rgba(15,3,35,.2)",liniaC:"rgba(255,230,200,.24)",minione:"rgba(15,3,35,.26)",
      nazwy:"rgba(255,244,225,.88)",kreski:"rgba(255,230,200,.22)",nic:"#ffe9b8",szpilka:POMAR,szpilkaBlask:"#fff2dc",
      cienNuty:"rgba(15,3,35,.5)",scieg:"rgba(255,190,110,.65)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
