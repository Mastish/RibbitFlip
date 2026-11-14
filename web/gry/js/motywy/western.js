// Motyw „Dziki Zachód” (runda 4, 10-16): pustynne miasteczko o złotej godzinie, całe z filcu. Tło to ilustracja
// (tlo.webp: turkusowe niebo, płaskowyże z terakoty, saloon, wiatrak, kaktusy i kłąb włóczki). Karta toru to szyba
// z terakotowego zamszu (faktura.webp z tłoczonym wzorem, widać ścieg wirujących wąsów). Nuty: skórzane paski
// z przeszyciem, rzędem ćwieków i turkusowym albo złotym wstawieniem przy górnej krawędzi. Klawiatura: deski saloonu
// (jasne piaskowe białe, orzechowe czarne) ze ściegiem wokół. Widownia: sześciu kowbojów (fan-*.webp) na wydmie z filcu,
// podskakują w rytm i kołyszą się jak przy pojedynku w południe.
// Streak (detal PODPISOWY): ślad to kurz spod butów (piaskowa smuga ze ściegiem), w świeższej części lecą podkowy,
// a tuż za żabą toczy się kłąb (iskra-4). Z głowy wylatują podkowy, gwiazdy szeryfa, kaktusy, buty i zwoje (iskra-0..5).
// Płonąca nuta ma złoty żar i gwiazdę szeryfa na froncie. Wszystko z buforów.
(function(){
  "use strict";
  const ID="western",PI=Math.PI,TAU=2*PI;
  const TERAK="#b4532a",TERAK_C="#4a1f0e",SKORA="#ecc994",SKORA_C="#c9965a",KREM="#f3e2bd",TURK="#2a9bb0",ZLOTO="#e3a82b",
    ORZECH="#4a2a17",PIASEK="#e6c48c";
  const FANY=6,ISKRY=6;
  const ZASOBY=["tlo.webp","faktura.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const ul=x=>x-Math.floor(x);
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5];   // kreski bez nowych tablic w klatce
  const fazaCw=ts=>typeof R!=="undefined"&&R&&R.st&&Number.isFinite(R.st.faza)?R.st.faza:ul(ts*2);

  // =========================================================================================== wzory (raz)
  const WZORY=new Map();
  function wzor(c,klucz,tworz,skala){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");if(skala&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix().scale(skala));WZORY.set(klucz,w);}
    return w;
  }
  // Włókna filcu: krótkie zakrzywione włoski w dwóch tonach, kafel 96 px zawinięty na brzegach.
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
  const filcPiasku=c=>wzor(c,"filc",()=>kafelekFilcu("rgba(255,236,190,.4)","rgba(110,60,25,.14)",360));
  // Ćwieki: srebrny guzik w narożach kafla 18 px, więc po zawinięciu rzędu ćwieków co 18 px (środek paska = (0,0)).
  function kafelekCwiekow(){
    const cv=document.createElement("canvas");cv.width=cv.height=18;const x=cv.getContext("2d");
    for(const [px,py] of [[0,0],[18,0],[0,18],[18,18]]){
      x.fillStyle="rgba(60,32,14,.55)";x.beginPath();x.arc(px+.6,py+.9,2.7,0,TAU);x.fill();
      x.fillStyle="#c9c3b6";x.beginPath();x.arc(px,py,2.5,0,TAU);x.fill();
      x.fillStyle="#fffdf4";x.beginPath();x.arc(px-.8,py-.8,.9,0,TAU);x.fill();
    }
    return cv;
  }
  // Ziarno skóry: drobne ciemne kropki, kafel 32 px.
  function kafelekSkory(){
    const cv=document.createElement("canvas");cv.width=cv.height=32;const x=cv.getContext("2d");
    for(let i=0;i<46;i++){
      x.fillStyle=i%3?"rgba(120,70,30,.16)":"rgba(255,240,200,.2)";
      x.beginPath();x.arc(los(i,1)*32,los(i,2)*32,.5+los(i,3)*.7,0,TAU);x.fill();
    }
    return cv;
  }
  // Słoje desek: poziome faliste żyłki wzdłuż klawisza (kafel 64 × 24, zawinięty).
  function kafelekDrewna(){
    const cv=document.createElement("canvas");cv.width=64;cv.height=24;const x=cv.getContext("2d");
    x.lineCap="round";
    for(let i=0;i<6;i++){
      const y=2+i*4+los(i,7)*2;x.strokeStyle=i%2?"rgba(255,235,190,.22)":"rgba(80,40,14,.26)";x.lineWidth=.7+los(i,8)*.6;
      x.beginPath();x.moveTo(0,y);x.bezierCurveTo(20,y+los(i,9)*3-1.5,44,y-los(i,10)*3+1.5,64,y);x.stroke();
    }
    return cv;
  }
  const cwieki=c=>wzor(c,"cwieki",kafelekCwiekow);
  const skora=c=>wzor(c,"skora",kafelekSkory);
  const drewno=c=>wzor(c,"drewno",kafelekDrewna);
  // faktura motywu (zamsz z tłoczonym wzorem, kafel 512 bez szwów); zanim się wczyta: włókna filcu
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    if(!im)return filcPiasku(c);
    return wzor(c,"faktura",()=>im,.6);
  }

  // =========================================================================================== sprite'y
  // Ciepła łuna złotej godziny (gradient raz, w buforze).
  const luna=()=>bufor("zw-luna",96,96,c=>{
    const g=c.createRadialGradient(48,48,0,48,48,48);
    g.addColorStop(0,"rgba(255,226,150,.5)");g.addColorStop(.45,"rgba(240,170,70,.22)");g.addColorStop(1,"rgba(200,100,40,0)");
    c.fillStyle=g;c.fillRect(0,0,96,96);
  });
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("zw-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.12,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["255,214,140",.10],["42,155,176",.05]],swiatlo:["255,210,140","180,83,42"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#d3a064";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(60,24,8,0)");g.addColorStop(1,"rgba(60,24,8,.28)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Terakotowa szyba: zamsz z tłoczonym wzorem przykryty półprzezroczyście (karta nie jaśnieje, wąsy ściegu
  // ledwo widać), ciepłe światło od góry i cień ku dołowi.
  function fakturaKarty(c,L){
    c.globalAlpha=.3;c.fillStyle=fakturaWzor(c);c.fillRect(L.x,L.y,L.w,L.h);c.globalAlpha=1;
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,200,130,.1)");g.addColorStop(.4,"rgba(255,200,130,0)");g.addColorStop(.7,"rgba(40,12,4,0)");g.addColorStop(1,"rgba(40,12,4,.24)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
  }

  // =========================================================================================== nuty
  // Skórzany pasek: jasna skóra z ziarnem, cień walca, przeszycie przerywaną nicią przy obu krawędziach, rząd
  // ćwieków pośrodku i wstawienie z turkusu albo złota przy górnej krawędzi (z ziarna). Obrys ciemna terakota.
  const WSTAWKA=[TURK,ZLOTO,TURK];
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,255,255,.22)");g.addColorStop(.35,"rgba(255,255,255,0)");g.addColorStop(.7,"rgba(90,50,20,.07)");g.addColorStop(1,"rgba(90,50,20,.32)");
      WALEC.set(k,g);}
    return g;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2;
      c.fillStyle=SKORA;c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=skora(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(nh>=7){c.fillStyle=WSTAWKA[(o.ziarno|0)%3];c.fillRect(x0-2,y0-2,w+4,Math.max(2,nh*.2)+2);}
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(nh>=9){
        c.fillStyle=cwieki(c);c.fillRect(x0-2,-3,w+4,6);
        c.strokeStyle="rgba(74,31,14,.62)";c.lineWidth=.9;c.setLineDash(SCIEG);c.beginPath();
        c.moveTo(x0,y0+nh-2.2);c.lineTo(x0+w,y0+nh-2.2);c.stroke();c.setLineDash(BRAK);
      }
    },
    brzeg:()=>TERAK_C,zapas:()=>0};

  // =========================================================================================== klawisze
  // Deski saloonu: orzechowe tło z dużym ściegiem, białe klawisze z jasnych desek piaskowych (słoje wzdłuż),
  // czarne z ciemnego orzecha, ścieg kremową nicią wokół. Gracz: turkusowy pas z przeszyciem.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(40,12,4,.45)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=TERAK;c.fill();
      c.save();c.clip();c.globalAlpha=.4;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.restore();
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,"#f1d9aa");grad.addColorStop(.7,PIASEK);grad.addColorStop(1,SKORA_C);
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,4));
      }
      c.fillStyle=grad;c.fill();c.save();c.clip();c.fillStyle=drewno(c);c.fillRect(x,y0,w,h);c.restore();
      c.strokeStyle="rgba(74,31,14,.55)";c.lineWidth=1;c.stroke();
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,4,4,0]);}
      c.fillStyle=ORZECH;c.fill();c.save();c.clip();c.fillStyle=drewno(c);c.fillRect(x,y0,w,h);c.restore();
      c.strokeStyle="rgba(20,8,2,.7)";c.lineWidth=1;c.stroke();
      c.setLineDash(SCIEG);c.strokeStyle="rgba(243,226,189,.72)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=TERAK_C;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(42,167,184,.9)":"rgba(42,167,184,.5)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?TERAK_C:"rgba(74,31,14,.6)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Kowboje z fan-*.webp na wydmie z filcu. Kolejność z ziarnem bez sąsiadów-bliźniaków, odbicia i skala z ziarna.
  // Przy śpiewie podskakują w rytm ćwierćnut (wyżej przy kombo) i lekko kołyszą się na bok, w spokoju stoją.
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
    return bufor("zw-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  // wydma: falisty pas piaskowego filcu z włóknami, ścieg terakotą wzdłuż grzbietu, cień od góry (raz na rozmiar)
  const wydma=(W,h)=>bufor("zw-wydma|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(60,24,8,0)");g.addColorStop(.6,"rgba(60,24,8,.2)");g.addColorStop(1,"rgba(60,24,8,.34)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
    const y=h*.74,fala=(o)=>{c.beginPath();c.moveTo(0,h);c.lineTo(0,y+o);
      for(let x=0;x<=W;x+=24)c.lineTo(x,y+o+Math.sin(x*.017)*h*.035+Math.sin(x*.0057+2)*h*.05);c.lineTo(W,h);c.closePath();};
    fala(2);c.fillStyle="rgba(60,24,8,.32)";c.fill();
    fala(0);c.fillStyle="#d9a866";c.fill();c.fillStyle=filcPiasku(c);c.fill();
    c.beginPath();for(let x=0;x<=W;x+=24){const yy=y+6+Math.sin(x*.017)*h*.035+Math.sin(x*.0057+2)*h*.05;if(x)c.lineTo(x,yy);else c.moveTo(x,yy);}
    c.strokeStyle="rgba(112,48,20,.55)";c.lineWidth=1.2;c.setLineDash([4,3]);c.stroke();c.setLineDash(BRAK);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.95)),krok=W/n,R0=rzad(n);
      const ruch=!st.spokoj&&!st.bezRuchu,zywe=st.spiewaja||(st.zar||0)>.05||(st.ap||0)>.12;
      const moc=zywe?.04+.05*Math.min(1,st.skok||0)+.03*Math.min(3,st.zar||0)+.06*Math.min(1,(st.ap||0)*2):.015*Math.min(1,st.skok||0);
      const fz=st.faza||0,dno=Wd.y+h*1.02,kol=ruch&&zywe?Math.sin(PI*(st.beat!=null?st.beat:fz)*.5)*krok*.04:0;
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        const hop=ruch&&moc?Math.abs(Math.sin(PI*(fz+r.faza)))*fh*moc:0;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"tupanie",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
      c.drawImage(wydma(W,h).cv,0,Wd.y,W,h);   // wydma na wierzchu: kowboje stoją w piachu po kostki
    }};

  // =========================================================================================== streak
  // Za głową (przebranie zastępuje efekt głowy): tylko ciepła łuna po południu, bez rekwizytów.
  // Ślad: kurz spod butów. Szeroka piaskowa smuga (rozmyta w trzech przejściach), jasne jądro i przerywany ścieg
  // z ciemnej nici. W świeższej części lecą podkowy, a tuż za żabą toczy się kłąb (iskra-4).
  const streak={
    glowa(){},
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),sz=k.og>=3?5:k.og>=2?4.2:3.4;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}const y=p.y+Math.sin(p.x*.06)*2;if(pi)c.lineTo(p.x,y);else{c.moveTo(p.x,y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+9;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=sz+3;c.stroke();
      c.setLineDash(SCIEG);c.lineDashOffset=-k.ts*8;c.strokeStyle=g.c;c.lineWidth=sz*.55;c.stroke();c.setLineDash(BRAK);c.lineDashOffset=0;
      if(!jest()||k.og<1)return;
      if(k.og>=2){
        const po=iskra(0,32);let ost=-1e9,nr=0;
        if(po)for(const p of pts){
          if(!p.sp||p.x-ost<64||p.x<k.x0)continue;ost=p.x;
          const f=(p.x-k.x0)/k.dlug;if(f<.25||f>.82)continue;
          if(++nr>5)break;
          const s=10+6*f;c.save();c.translate(p.x,p.y);c.rotate(p.x*.05);c.drawImage(po.cv,-s/2,-s/2,s,s);c.restore();
        }
      }
      const kl=iskra(4,48);if(!kl||k.pelna===false)return;
      const r=k.og>=3?11:9,x=k.xT-34,y=ySladu(pts,x);if(y==null)return;
      c.save();c.translate(x,y-r*.6);c.rotate(k.ts*3.2);c.drawImage(kl.cv,-r,-r,2*r,2*r);c.restore();
    },
    // płonąca nuta: zaśpiewana część rozżarza się złotem, na froncie gwiazda szeryfa
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(227,168,43,.38)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas>.05&&jest()){
        const im=iskra(1,48),s=nh*(aktywna?1.5:1.15);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.6,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)podkowyToru(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{luna();for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(0,32);iskra(1,48);iskra(4,48);}catch(e){}},
    aura:["#ffe9b0",ZLOTO],wypelnienie:["#fff3d0","#f2d08a",ZLOTO],
    iskry:{kolory:["#fff3d0","#f2c878",TURK]},dym:"#b58a55",
    scena:["255,214,140","42,155,176","227,168,43"],
    tlo:{promienie:[["255,214,140",.10],["42,155,176",.05]],swiatlo:["255,210,140","180,83,42"]}};

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
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(214,160,96,0)");a.addColorStop(.5,"rgba(214,160,96,.2)");a.addColorStop(1,"rgba(214,160,96,.34)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(240,210,150,0)");b.addColorStop(.5,"rgba(240,210,150,.62)");b.addColorStop(1,"rgba(248,226,176,.92)");
    const d=c.createLinearGradient(x0,0,xT,0);d.addColorStop(0,"rgba(110,52,24,0)");d.addColorStop(.5,"rgba(110,52,24,.6)");d.addColorStop(1,"rgba(90,40,16,.85)");
    g={a,b,c:d};GRAD.set(kl,g);return g;
  }

  // ---- lecące drobiazgi: pula na gracza, bez alokacji w klatce ----
  // Podkowa, gwiazda szeryfa, kaktus, but, kłąb i zwój (iskra-0..5) wyskakują zza głowy łukiem w tył toru,
  // kręcą się i opadają; na progu kombo co 4 nuty trzy naraz.
  const PULE=new WeakMap(),MAKS_CZ=10,TEMPO=[0,1.2,2.2,3.6];
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,dos:0,cz:[]};
    for(let i=0;i<MAKS_CZ;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,k:0,r:20,rot:0,w:0});
    PULE.set(g,p);return p;
  }
  function rzuc(P,L,g,sc,og){
    for(const p of P.cz)if(p.z<=0){
      const pz=pozycjaZaby(L,g);
      p.k=Math.floor(Math.random()*6);p.r=Math.round(sc*(.26+.05*og)*(.85+.3*Math.random()));
      p.x=pz.x-sc*.15+(Math.random()-.5)*sc*.4;p.y=pz.y-sc*.4;p.vx=-(40+60*Math.random());p.vy=-(110+70*Math.random());
      p.rot=Math.random()*TAU;p.w=(Math.random()<.5?-1:1)*(3+4*Math.random());p.zy=1.1+.5*Math.random();p.z=p.zy;return;
    }
  }
  function podkowyToru(c,L,g,st){
    if(typeof pozycjaZaby!=="function"||!jest())return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(og>0){
      P.dos+=dt*TEMPO[og];if(P.dos>=1){P.dos-=1;rzuc(P,L,g,sc,og);}
      if(k>P.k&&k>=4&&k%4===0)for(let j=0;j<3;j++)rzuc(P,L,g,sc,og);
    }else P.dos=0;
    P.k=k;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=260*dt;p.rot+=p.w*dt;
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,s=p.r*(f<.12?.5+.5*f/.12:1);
      c.globalAlpha=f<.1?f/.1:p.z<.35?p.z/.35:1;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Dziki Zachód",kolejnosc:17,kolor:"#c4572e",zasoby:ZASOBY,przebranie:true,
    opis:"Pustynne miasteczko o złotej godzinie, całe z filcu: saloon, kaktusy, wiatrak i płaskowyże. Karta jak terakotowy zamsz, nuty to skórzane paski z przeszyciem i ćwiekami, klawisze jak deski saloonu, a przy kombo za żabą wzbija się kurz, lecą podkowy i toczy się kłąb.",
    cechy:{tlo:"miasteczko o zachodzie",klawisze:"deski saloonu",streak:"kurz i podkowy",widownia:"kowboje na wydmie"},
    en:{nazwa:"Wild West",
      opis:"A desert town at golden hour, all made of felt: saloon, cacti, windmill and mesas. The card is terracotta suede, notes are leather straps with stitching and studs, keys are saloon planks, and on a combo a dust trail kicks up behind you, horseshoes fly and a tumbleweed rolls along.",
      cechy:{tlo:"town at sunset",klawisze:"saloon planks",streak:"dust and horseshoes",widownia:"cowboys on a dune"}},
    karta:{papier:"#8a3716",cien:"rgba(40,12,4,.4)",czarne:"rgba(30,8,2,.2)",liniaC:"rgba(255,226,180,.24)",minione:"rgba(30,8,2,.24)",
      nazwy:"rgba(250,232,200,.86)",kreski:"rgba(255,226,180,.22)",nic:KREM,szpilka:ZLOTO,szpilkaBlask:"#fff1c8",
      cienNuty:"rgba(30,8,2,.45)",scieg:"rgba(243,226,189,.6)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
