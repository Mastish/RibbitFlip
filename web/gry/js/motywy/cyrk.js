// Motyw „Cyrk” (runda 4, 10-16): wnętrze starego namiotu z filcu. Tło to ilustracja (tlo.webp: kurtyna w czerwono-kremowe
// pasy, girlanda chorągiewek, obręcze ognia, bęben, kręgle, popcorn i piłki na brzegach), karta toru to przygaszona
// szyba z pasów namiotu (faktura.webp na ciemnej czerwieni, pasy ledwie świecą, żeby nuty były czytelne). Nuty:
// kobaltowe wstążki z filcu z czarnym obrysem, kremowym ściegiem i złotymi guzikami, na górnej krawędzi kolorowy pasek
// jak chorągiewka. Klawiatura: podest areny, białe klawisze z kremowego filcu w czerwone pasy, czarne w głębokim
// błękicie ze złotym guzikiem, złoty ścieg wokół. Widownia: sześciu artystów (fan-*.webp) za pasiastą bandą areny
// ze złotą poręczą i guzikami; podskakują w rytm.
// Streak (detal PODPISOWY): ślad to girlanda chorągiewek zawieszona na czarnym sznurku (kolorowe filcowe trójkąty, ściegiem
// obrysowane), tuż za żabą podskakuje żonglowana piłka, a zza niej wylatują łukiem popcorn, bilety, bębenki i piłki
// (iskra-0..5). Wszystko z buforów.
(function(){
  "use strict";
  const ID="cyrk",PI=Math.PI,TAU=2*PI;
  const CZERW="#c8202e",CZERW_C="#4f0c15",KREM="#f1e5c8",KREM_C="#d3bf93",BLEKIT="#2459b8",BLEKIT_C="#0f2550",
    ZLOTO="#e0a21f",ZLOTO_J="#f6d36b",ROZ="#d9327c",ZIEL="#7cc23a",CZARN="#17110f";
  const FLAGI=[ROZ,ZLOTO,ZIEL,BLEKIT,CZERW,KREM];
  const FANY=6,ISKRY=6;
  const ZASOBY=["tlo.webp","faktura.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const ul=x=>x-Math.floor(x);
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5],NITKA=[2.5,3.5];   // kreski bez nowych tablic w klatce
  const fazaCw=ts=>typeof R!=="undefined"&&R&&R.st&&Number.isFinite(R.st.faza)?R.st.faza:ul(ts*2);

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
  // Rząd złotych guzików: kafel 24 × 6, guzik na brzegu kafla (dwie połówki), więc po przesunięciu leży na osi ciała nuty.
  function kafelekGuzikow(){
    const cv=document.createElement("canvas");cv.width=24;cv.height=6;const x=cv.getContext("2d");
    for(const y of [0,6]){
      x.fillStyle=CZARN;x.beginPath();x.arc(12,y,2.9,0,TAU);x.fill();
      x.fillStyle=ZLOTO;x.beginPath();x.arc(12,y,2.3,0,TAU);x.fill();
      x.fillStyle=ZLOTO_J;x.beginPath();x.arc(11.3,y-.7,.9,0,TAU);x.fill();
    }
    return cv;
  }
  const WZORY=new Map();
  function wzor(c,klucz,tworz,skala){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");if(skala&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix().scale(skala));WZORY.set(klucz,w);}
    return w;
  }
  const filcBialy=c=>wzor(c,"filc-b",()=>kafelekFilcu("rgba(255,255,255,.2)","rgba(10,20,60,.18)",360));
  const filcKrem=c=>wzor(c,"filc-k",()=>kafelekFilcu("rgba(255,255,255,.35)","rgba(120,90,50,.12)",360));
  const guziki=c=>wzor(c,"guziki",kafelekGuzikow);
  // faktura motywu (pasy namiotu, kafel 512 bez szwów); zanim się wczyta: pasy z kodu
  function kafelekPasow(){
    const cv=document.createElement("canvas");cv.width=cv.height=64;const x=cv.getContext("2d");
    x.fillStyle=KREM;x.fillRect(0,0,64,64);x.fillStyle=CZERW;
    for(let i=0;i<4;i++)x.fillRect(i*16,0,8,64);
    return cv;
  }
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    if(!im)return wzor(c,"pasy",kafelekPasow);
    return wzor(c,"faktura",()=>im,.6);
  }

  // =========================================================================================== sprite'y
  // Ciepła łuna jak od reflektora areny (złoto i krem, gradient raz, w buforze).
  const luna=()=>bufor("cy-luna",96,96,c=>{
    const g=c.createRadialGradient(48,48,0,48,48,48);
    g.addColorStop(0,"rgba(255,240,190,.5)");g.addColorStop(.45,"rgba(240,190,90,.22)");g.addColorStop(1,"rgba(224,162,31,0)");
    c.fillStyle=g;c.fillRect(0,0,96,96);
  });
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("cy-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.12,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["255,214,120",.10],["216,50,124",.05]],swiatlo:["255,226,160","150,20,30"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#d9c6a0";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(50,8,12,0)");g.addColorStop(1,"rgba(50,8,12,.3)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Przygaszona szyba z pasów namiotu: faktura (kremowo-czerwone pasy) na 0,3 krycia (10-16: przy 0,5 pasy biły się z nutami) na ciemnej czerwieni, do tego
  // ciemniejsze boki jak w namiocie, światło reflektora od góry i cień ku dołowi. Pasy zostają widoczne, ale spokojne.
  function fakturaKarty(c,L){
    c.globalAlpha=.3;c.fillStyle=fakturaWzor(c);c.fillRect(L.x,L.y,L.w,L.h);c.globalAlpha=1;
    const gb=c.createLinearGradient(L.x,0,L.x+L.w,0);
    gb.addColorStop(0,"rgba(30,2,8,.4)");gb.addColorStop(.2,"rgba(30,2,8,.08)");gb.addColorStop(.8,"rgba(30,2,8,.08)");gb.addColorStop(1,"rgba(30,2,8,.4)");
    c.fillStyle=gb;c.fillRect(L.x,L.y,L.w,L.h);
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,230,170,.12)");g.addColorStop(.4,"rgba(255,230,170,0)");g.addColorStop(.7,"rgba(30,2,8,0)");g.addColorStop(1,"rgba(30,2,8,.28)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
  }

  // =========================================================================================== nuty
  // Kobaltowa wstążka z filcu: włókna, złote guziki na osi, kremowy ścieg przy brzegach, cień walca, a przy górnej
  // krawędzi kolorowy pasek (z ziarna: różowy, złoty albo zielony) jak chorągiewka. Obrys z czarnego filcu.
  const PASEK=[ROZ,ZLOTO,ZIEL];
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,255,255,.22)");g.addColorStop(.35,"rgba(255,255,255,0)");g.addColorStop(.7,"rgba(0,10,40,.08)");g.addColorStop(1,"rgba(0,10,40,.34)");
      WALEC.set(k,g);}
    return g;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2;
      c.fillStyle=BLEKIT;c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=filcBialy(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(nh>=7){c.fillStyle=PASEK[(o.ziarno|0)%3];c.fillRect(x0-2,y0-2,w+4,Math.max(2,nh*.2)+2);}
      if(nh>=10){c.fillStyle=guziki(c);c.fillRect(x0-2,-3,w+4,6);}
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(nh>=8&&w>10){c.setLineDash(SCIEG);c.strokeStyle="rgba(241,229,200,.75)";c.lineWidth=1;c.strokeRect(x0+2.5,y0+2.5,w-5,nh-5);c.setLineDash(BRAK);}
    },
    brzeg:()=>CZARN,zapas:()=>0};

  // =========================================================================================== klawisze
  // Podest areny: czerwono-kremowe pasy (faktura), białe klawisze z kremowego filcu przetarte pasami, czarne w głębokim
  // błękicie ze złotym guzikiem, złoty ścieg wokół. Gracz: złoty pas z czarnym ściegiem.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(30,2,8,.5)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=CZERW_C;c.fill();
      c.save();c.clip();c.globalAlpha=.85;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.restore();
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,"#fbf3dd");grad.addColorStop(.7,KREM);grad.addColorStop(1,KREM_C);
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,5));
      }
      c.fillStyle=grad;c.fill();c.save();c.clip();
      c.fillStyle=filcKrem(c);c.fillRect(x,y0,w,h);
      c.globalCompositeOperation="multiply";c.globalAlpha=.4;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.restore();
      c.strokeStyle="rgba(79,12,21,.55)";c.lineWidth=1;c.stroke();
      c.beginPath();const guz=[];
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,4,4,0]);guz.push(k);}
      c.fillStyle=BLEKIT_C;c.fill();c.save();c.clip();c.fillStyle=filcBialy(c);c.fillRect(x,y0,w,h);c.restore();
      c.strokeStyle=CZARN;c.lineWidth=1;c.stroke();
      // złote guziki na czarnych klawiszach (jeden przebieg, tylko gdy klawisz ma miejsce)
      c.beginPath();
      for(const k of guz){const r=Math.min(k.h*.26,3);if(r<1.1)continue;const gx=k.x+k.w*.62*.7,gy=k.y+k.h/2;c.moveTo(gx+r,gy);c.arc(gx,gy,r,0,TAU);}
      c.fillStyle=ZLOTO;c.fill();c.strokeStyle=CZARN;c.lineWidth=.8;c.stroke();
      c.setLineDash(SCIEG);c.strokeStyle="rgba(246,211,107,.8)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=CZARN;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(246,200,70,.92)":"rgba(246,200,70,.5)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?CZARN:"rgba(23,17,15,.55)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Artyści z fan-*.webp za pasiastą bandą areny. Kolejność z ziarnem bez sąsiadów-bliźniaków, odbicia i skala z ziarna.
  // Przy śpiewie podskakują w rytm ćwierćnut i kołyszą się na boki, przy kombo wyżej. W spokoju stoją.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=71;
    while(r.length<n){
      const p=[0,1,2,3,4,5];for(let i=5;i>0;i--){const j=Math.floor(los(z,i)*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}z++;
      if(p[0]===ost){const t=p[0];p[0]=p[5];p[5]=t;}
      for(const f of p){if(r.length>=n)break;const k=r.length;
        r.push({f,lustro:los(k,3)>.5,sk:.86+.14*los(k,4),faza:[0,.5,.25,.75][k%4]+.1*los(k,5),dx:(los(k,8)-.5)*.16});ost=f;}
    }
    RZAD.set(n,r);return r;
  }
  function fan(i,h,lustro){
    const im=obraz("fan-"+i+".webp");if(!im||!jest())return null;
    const s=h/im.naturalHeight,w=Math.max(1,Math.round(im.naturalWidth*s));
    return bufor("cy-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  // banda areny: trociny u dołu, czerwono-kremowe pasy z kremowym ściegiem, złota poręcz z guzikami, czarny cokół (raz na rozmiar)
  const banda=(W,h)=>bufor("cy-banda|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(50,20,10,0)");g.addColorStop(.6,"rgba(50,20,10,.18)");g.addColorStop(1,"rgba(50,20,10,.34)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
    const yb=Math.round(h*.66),hb=h-yb,rail=Math.max(3,Math.round(hb*.2)),cok=Math.max(2,Math.round(hb*.14));
    const pw=Math.max(16,Math.round(hb*.8)),n=Math.ceil(W/pw);
    for(let i=0;i<n;i++){c.fillStyle=i%2?KREM:CZERW;c.fillRect(i*pw,yb+rail,pw,hb-rail);}
    c.fillStyle=filcKrem(c);c.fillRect(0,yb+rail,W,hb-rail);
    const gp=c.createLinearGradient(0,yb+rail,0,h);gp.addColorStop(0,"rgba(255,255,255,.18)");gp.addColorStop(.5,"rgba(0,0,0,0)");gp.addColorStop(1,"rgba(30,2,8,.35)");
    c.fillStyle=gp;c.fillRect(0,yb+rail,W,hb-rail);
    c.strokeStyle="rgba(23,17,15,.55)";c.lineWidth=1;c.beginPath();
    for(let i=1;i<n;i++){c.moveTo(i*pw,yb+rail);c.lineTo(i*pw,h);}c.stroke();
    c.setLineDash(SCIEG);c.strokeStyle="rgba(120,90,50,.55)";c.lineWidth=.9;c.beginPath();
    for(let i=0;i<n;i++){c.moveTo(i*pw+pw/2,yb+rail+3);c.lineTo(i*pw+pw/2,h-cok-2);}c.stroke();c.setLineDash(BRAK);
    c.fillStyle=CZARN;c.fillRect(0,h-cok,W,cok);
    c.fillStyle=ZLOTO;c.fillRect(0,yb,W,rail);c.fillStyle=ZLOTO_J;c.fillRect(0,yb,W,Math.max(1,rail*.3));
    c.strokeStyle=CZARN;c.lineWidth=1.2;c.strokeRect(-1,yb,W+2,rail+.5);
    const r=Math.max(1.2,rail*.28);c.beginPath();
    for(let x=pw/2;x<W;x+=pw){c.moveTo(x+r,yb+rail/2);c.arc(x,yb+rail/2,r,0,TAU);}
    c.fillStyle="#fff1c4";c.fill();c.strokeStyle="rgba(23,17,15,.6)";c.lineWidth=.7;c.stroke();
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.95)),krok=W/n,R0=rzad(n);
      const ruch=!st.spokoj&&!st.bezRuchu,zywe=st.spiewaja||(st.zar||0)>.05||(st.ap||0)>.12;
      const moc=zywe?.04+.05*Math.min(1,st.skok||0)+.03*Math.min(3,st.zar||0)+.06*Math.min(1,(st.ap||0)*2):.015*Math.min(1,st.skok||0);
      const fz=st.faza||0,dno=Wd.y+h*1.02,kol=ruch&&zywe?Math.sin(PI*(st.beat!=null?st.beat:fz)*.5)*krok*.05:0;
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        const hop=ruch&&moc?Math.abs(Math.sin(PI*(fz+r.faza)))*fh*moc:0;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"akrobata",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
      c.drawImage(banda(W,h).cv,0,Wd.y,W,h);   // banda na wierzchu: artyści wyglądają zza niej
    }};

  // =========================================================================================== streak
  // glowa pusta: efekt głowy niesie przebranie żaby. Sygnatura siedzi w śladzie (girlanda), nucie i drobiazgach z tor().
  const streak={
    glowa(){},
    // ślad: czarny sznurek ze złotą nitką wzdłuż melodii, na nim wisi girlanda filcowych chorągiewek w stałych miejscach
    // za żabą (rozmiar maleje z oddaleniem). Tuż za żabą żonglowana piłka (iskra-5) podskakuje w rytm.
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),sz=k.og>=3?3.4:k.og>=2?2.9:2.4;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+1.8;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=sz;c.stroke();
      c.setLineDash(NITKA);c.lineDashOffset=-k.ts*8;c.strokeStyle=g.c;c.lineWidth=sz*.4;c.stroke();c.setLineDash(BRAK);c.lineDashOffset=0;
      if(k.og<1)return;
      const nf=k.og>=3?7:k.og>=2?5:3,ile=Math.max(10,k.dlug||0),sp=k.og>=3?38:42,sf=k.og>=3?19:16;
      c.lineWidth=1.2;c.setLineDash(BRAK);
      for(let j=0;j<nf;j++){
        const xc=k.xT-30-j*sp;if(xc<k.x0+8||xc>k.xT)break;
        const f=1-(k.xT-xc)/Math.max(ile,sp*nf),s=sf*(.7+.3*Math.max(0,f));
        const ym=ySladu(pts,xc),yb=ySladu(pts,xc+s*.5);
        if(ym==null||yb==null)continue;
        const dy=(yb-ym)*.5*2;
        c.globalAlpha=Math.min(1,.35+(xc-k.x0)/Math.max(1,.25*(k.xT-k.x0)));
        c.beginPath();c.moveTo(xc-s*.5,ym-dy);c.lineTo(xc+s*.5,yb);c.lineTo(xc+dy*.15,ym+s*1.05);c.closePath();
        c.fillStyle=FLAGI[(j+(k.ziarno|0))%FLAGI.length];c.fill();c.strokeStyle=CZARN;c.stroke();
      }
      c.globalAlpha=1;
      const pl=jest()&&k.pelna!==false?iskra(5,48):null;if(!pl)return;
      const r=k.og>=3?11:9,x=k.xT-18,y=ySladu(pts,x);if(y==null)return;
      const hop=Math.abs(Math.sin(PI*fazaCw(k.ts)))*r*1.4;
      c.save();c.translate(x,y-r*.9-hop);c.rotate(k.ts*3);c.drawImage(pl.cv,-r,-r,2*r,2*r);c.restore();
    },
    // płonąca nuta: zaśpiewana część rozgrzewa się złotem, na froncie rozeta (iskra-4)
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(246,200,70,.34)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas>.05&&jest()){
        const im=iskra(4,48),s=nh*(aktywna?1.5:1.15);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.6,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)rzucanie(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{luna();for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(4,48);iskra(5,48);}catch(e){}},
    aura:["#fff1c4",ZLOTO],wypelnienie:["#fff7e0","#f6d36b",ZLOTO],
    iskry:{kolory:["#ffffff",ZLOTO_J,ROZ,"#5aa0ff"]},dym:false,
    scena:["255,226,160","216,50,124","224,162,31"],
    tlo:{promienie:[["255,214,120",.10],["216,50,124",.05]],swiatlo:["255,226,160","150,20,30"]}};

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
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(255,226,160,0)");a.addColorStop(.5,"rgba(255,226,160,.4)");a.addColorStop(1,"rgba(255,226,160,.6)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(23,17,15,0)");b.addColorStop(.5,"rgba(23,17,15,.8)");b.addColorStop(1,"rgba(23,17,15,1)");
    const d=c.createLinearGradient(x0,0,xT,0);d.addColorStop(0,"rgba(246,211,107,0)");d.addColorStop(.5,"rgba(246,211,107,.85)");d.addColorStop(1,"rgba(255,226,140,1)");
    g={a,b,c:d};GRAD.set(kl,g);return g;
  }

  // ---- żonglowane drobiazgi: pula na gracza, bez alokacji w klatce ----
  // Piłka, popcorn, bilet, bębenek, rozeta i czerwony nos (iskra-0..5) wylatują łukiem zza żaby, obracają się i opadają
  // jak żonglowane; na progu kombo co 4 nuty trzy naraz.
  const PULE=new WeakMap(),MAKS_CZ=10,TEMPO=[0,1,2,3.4];
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,dos:0,cz:[]};
    for(let i=0;i<MAKS_CZ;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,k:0,r:20,rot:0,om:0});
    PULE.set(g,p);return p;
  }
  function rzuc(P,L,g,sc,og){
    for(const p of P.cz)if(p.z<=0){
      const pz=pozycjaZaby(L,g);
      p.k=Math.floor(Math.random()*6);p.r=Math.round(sc*(.26+.05*og)*(.85+.3*Math.random()));
      p.x=pz.x-sc*.2+(Math.random()-.5)*sc*.4;p.y=pz.y-sc*.35;p.vx=-(sc*(.5+.9*Math.random()));p.vy=-(sc*(2.2+1.2*Math.random()));
      p.rot=Math.random()*TAU;p.om=(Math.random()-.5)*9;p.zy=1.5+.4*Math.random();p.z=p.zy;return;
    }
  }
  function rzucanie(c,L,g,st){
    if(typeof pozycjaZaby!=="function"||!jest())return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(og>0){
      P.dos+=dt*TEMPO[og];if(P.dos>=1){P.dos-=1;rzuc(P,L,g,sc,og);}
      if(k>P.k&&k>=4&&k%4===0)for(let j=0;j<3;j++)rzuc(P,L,g,sc,og);
    }else P.dos=0;
    P.k=k;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=sc*5*dt;p.rot+=p.om*dt;
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,s=p.r*(f<.12?.5+.5*f/.12:1);
      c.globalAlpha=f<.1?f/.1:p.z<.4?p.z/.4:1;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Cyrk",kolejnosc:19,kolor:"#2459b8",zasoby:ZASOBY,przebranie:true,
    opis:"Wnętrze starego namiotu cyrkowego z filcu: czerwono-kremowe pasy, girlandy chorągiewek, bęben, kręgle, popcorn i obręcz ognia. Karta jak przygaszone pasy namiotu, nuty to kobaltowe wstążki ze złotymi guzikami, a przy kombo za żabą zwisa girlanda chorągiewek, tuż za nią żonglowana jest piłka, a zza niej wylatują popcorn, bilety i bębenki.",
    cechy:{tlo:"namiot z filcu",klawisze:"podest areny",streak:"girlanda i żonglerka",widownia:"artyści za bandą"},
    en:{nazwa:"Circus",
      opis:"The inside of an old felt circus tent: red and cream stripes, bunting, a drum, bowling pins, popcorn and a ring of fire. The card is a dimmed tent stripe, notes are cobalt ribbons with gold buttons, and on a combo a string of bunting flags trails behind you, a juggled ball bounces right behind, and popcorn, tickets and little drums fly out in an arc.",
      cechy:{tlo:"felt big top",klawisze:"arena podium",streak:"bunting and juggling",widownia:"performers at the rail"}},
    karta:{papier:"#4d0e17",cien:"rgba(30,2,8,.45)",czarne:"rgba(20,2,6,.2)",liniaC:"rgba(255,236,200,.26)",minione:"rgba(20,2,6,.26)",
      nazwy:"rgba(255,240,215,.88)",kreski:"rgba(255,236,200,.24)",nic:KREM,szpilka:ZLOTO,szpilkaBlask:"#fff1c4",
      cienNuty:"rgba(20,2,6,.5)",scieg:"rgba(246,211,107,.6)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
