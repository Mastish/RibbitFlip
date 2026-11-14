// Motyw „Skatepark” (runda 3, 10-10): filcowy skatepark w słoneczny dzień. Tło to ilustracja (tlo.webp: rampy ze
// sklejki i filcu po bokach, niebo z dżinsu, chorągiewki, beton z szarego filcu), karta toru to granatowa dżinsowa
// szyba (faktura.webp, sprany dżins przy niskim kryciu) z podwójnym ściegiem musztardową nicią, jak szew dżinsów.
// Nuty: paski musztardowego filcu z podwójnym ściegiem (górą kremowy, dołem brązowy). Klawiatura: granatowy dżins,
// białe klawisze z jasnego spranego dżinsu, czarne z czarnego filcu. Widownia: sześciu skejterów (fan-*.webp) na
// betonie z filcu, przy kombo skaczą jak przy ollie (wyżej i z lekkim przechyłem w rytm).
// Streak (detal PODPISOWY): spod głowy żaby sypią się iskry jak spod szlifującej deski (krótkie kreski, grawitacja),
// za głową kręci się kółko deski w ciepłej łunie, ślad to szew dżinsowy (granatowy pas, podwójny musztardowy ścieg,
// filcowe łatki), po którym toczą się kółka deski. Z głowy wylatują drobiazgi skejta (iskra-1..5). Wszystko z buforów.
(function(){
  "use strict";
  const ID="skatepark",PI=Math.PI,TAU=2*PI;
  const GRANAT="#1a2b45",DZINS="#2f5280",DZINS_J="#c9d6e4",DZINS_JC="#9fb3ca",MUSZT="#DA9F2D",MUSZT_C="#5c3b0a",
    ROZ="#DA2F74",LIM="#B6D35A",KREM="#EDE6DA",CZARNY="#1A1A1A";
  const FANY=6,ISKRY=6;
  const ZASOBY=["tlo.webp","faktura.webp","zaba-0.webp","zaba-1.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const ul=x=>x-Math.floor(x);
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5],SCIEG_SZEW=[4,3],SCIEG_KOLO=[5,4];   // kreski bez nowych tablic w klatce
  const faza=ts=>typeof R!=="undefined"&&R&&R.st&&Number.isFinite(R.st.faza)?R.st.faza:ul(ts*2);

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
  const filcNuty=c=>wzor(c,"nuta",()=>kafelekFilcu("rgba(255,245,210,.32)","rgba(70,40,0,.22)",420));
  const filcJasny=c=>wzor(c,"jasny",()=>kafelekFilcu("rgba(255,255,255,.35)","rgba(20,40,70,.12)",360));
  const filcCiemny=c=>wzor(c,"ciemny",()=>kafelekFilcu("rgba(200,200,200,.12)","rgba(0,0,0,.25)",360));
  // faktura motywu (sprany dżins, kafel 512 bez szwów, pomniejszony o połowę: drobniejszy splot); zanim się wczyta: włókna
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    if(!im)return filcJasny(c);
    return wzor(c,"faktura",()=>im,.5);
  }

  // =========================================================================================== sprite'y
  // Ciepła łuna za głową (musztarda w róż) i gorąca kropka iskry (gradienty raz, w buforze).
  const luna=()=>bufor("sk-luna",96,96,c=>{
    const g=c.createRadialGradient(48,48,0,48,48,48);
    g.addColorStop(0,"rgba(255,226,150,.55)");g.addColorStop(.45,"rgba(218,159,45,.28)");g.addColorStop(.75,"rgba(218,47,116,.1)");g.addColorStop(1,"rgba(218,47,116,0)");
    c.fillStyle=g;c.fillRect(0,0,96,96);
  });
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("sk-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};
  // Łatka z filcu na szwie: kwadrat w kolorze z palety, ciemny rant, kremowy ścieg, lekko przekrzywiona.
  const LATKI=[[ROZ,"#912348"],[LIM,"#6B803C"],[MUSZT,MUSZT_C]];
  const latka=v=>bufor("sk-latka|"+v,22,22,c=>{
    c.translate(11,11);c.rotate((v-1)*.22);
    c.fillStyle="rgba(0,0,0,.35)";c.fillRect(-7,-6,15,15);
    c.fillStyle=LATKI[v][1];c.fillRect(-8,-8,16,16);
    c.fillStyle=LATKI[v][0];c.fillRect(-7,-7,14,14);c.fillStyle=filcNuty(c);c.fillRect(-7,-7,14,14);
    c.strokeStyle="rgba(237,230,218,.95)";c.lineWidth=1;c.setLineDash([2,1.6]);c.strokeRect(-4.5,-4.5,9,9);c.setLineDash(BRAK);
  });

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.16,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["218,159,45",.10],["218,47,116",.06]],swiatlo:["255,226,150","47,82,128"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#5b80b0";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(16,28,48,0)");g.addColorStop(1,"rgba(16,28,48,.3)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Granatowa szyba z dżinsu: faktura spranego dżinsu przy niskim kryciu (splot widać, nuty nie giną), jaśniejsze
  // przetarcie od lewej góry i drugi rząd ściegu musztardową nicią obok ściegu karty (podwójny szew jak w dżinsach).
  function fakturaKarty(c,L){
    c.globalAlpha=.36;c.fillStyle=fakturaWzor(c);c.fillRect(L.x,L.y,L.w,L.h);c.globalAlpha=1;
    const r=Math.max(L.w,L.h)*.75,g=c.createRadialGradient(L.x+L.w*.2,L.y,0,L.x+L.w*.2,L.y,r);
    g.addColorStop(0,"rgba(200,220,240,.1)");g.addColorStop(1,"rgba(200,220,240,0)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
    const d=c.createLinearGradient(0,L.y+L.h*.55,0,L.y+L.h);d.addColorStop(0,"rgba(8,16,30,0)");d.addColorStop(1,"rgba(8,16,30,.2)");
    c.fillStyle=d;c.fillRect(L.x,L.y+L.h*.55,L.w,L.h*.45);
    c.strokeStyle="rgba(218,159,45,.5)";c.lineWidth=1.4;c.setLineDash([6,5]);
    c.beginPath();c.roundRect(L.x+11,L.y+11,L.w-22,L.h-22,8);c.stroke();c.setLineDash(BRAK);
  }

  // =========================================================================================== nuty
  // Pasek musztardowego filcu: odcień z ziarna, włókna, cień walca (gradient z pamięci po wysokości), podwójny ścieg
  // jak na nogawce: kremowy przy górnej krawędzi, ciemnobrązowy przy dolnej. Obrys ciemnobrązowy odcina pasek od granatu.
  const KOLORY_NUT=[MUSZT,"#e2aa3c","#d39527"];
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,250,220,.26)");g.addColorStop(.35,"rgba(255,250,220,0)");g.addColorStop(.7,"rgba(70,40,0,.08)");g.addColorStop(1,"rgba(70,40,0,.32)");
      WALEC.set(k,g);}
    return g;
  }
  const KRESKI=new Map();
  function kreska(d){const k=Math.round(d*2);let a=KRESKI.get(k);if(!a){a=[Math.max(2,k*.9),Math.max(1.5,k*.55)];KRESKI.set(k,a);}return a;}
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2;
      c.fillStyle=KOLORY_NUT[(o.ziarno|0)%3];c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=filcNuty(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(w<nh*1.2||nh<7)return;
      const m=Math.max(2.3,nh*.22);
      c.lineWidth=Math.max(1,nh*.085);c.setLineDash(kreska(Math.max(2,nh*.2)));c.lineDashOffset=(o.ziarno|0)%3;
      c.strokeStyle=KREM;c.beginPath();c.moveTo(x0+m,y0+m);c.lineTo(-x0-m,y0+m);c.stroke();
      if(nh>=11){c.strokeStyle="rgba(92,59,10,.7)";c.beginPath();c.moveTo(x0+m,-y0-m);c.lineTo(-x0-m,-y0-m);c.stroke();}
      c.setLineDash(BRAK);c.lineDashOffset=0;
    },
    brzeg:()=>MUSZT_C,zapas:()=>0};

  // =========================================================================================== klawisze
  // Granatowy dżins (faktura motywu), białe klawisze z jasnego spranego dżinsu (od kreski do kreski), czarne z
  // czarnego filcu, musztardowy ścieg wokół. Gracz: różowa łatka na swoim rzędzie z czarnym ściegiem.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(5,12,24,.45)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=GRANAT;c.fill();
      c.save();c.clip();c.globalAlpha=.4;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.globalAlpha=1;c.restore();
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,DZINS_J);grad.addColorStop(.7,"#bccbdc");grad.addColorStop(1,DZINS_JC);
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,4));
      }
      c.fillStyle=grad;c.fill();c.save();c.clip();c.globalAlpha=.35;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.globalAlpha=1;c.restore();
      c.strokeStyle="rgba(16,28,48,.55)";c.lineWidth=1;c.stroke();
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,3,3,0]);}
      c.fillStyle=CZARNY;c.fill();c.fillStyle=filcCiemny(c);c.fill();
      c.setLineDash(SCIEG);c.strokeStyle="rgba(218,159,45,.75)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=CZARNY;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(218,47,116,.85)":"rgba(218,47,116,.45)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?KREM:"rgba(237,230,218,.6)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Skejterzy z fan-*.webp na betonie z szarego filcu. Kolejność z ziarnem bez sąsiadów-bliźniaków, odbicia i skala
  // z ziarna. Przy śpiewie i kombo skaczą w rytm ćwierćnut jak przy ollie: im wyżej, tym mocniej się przechylają
  // (obrót wokół stóp, kierunek z ziarna). W spokoju stoją.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=23;
    while(r.length<n){
      const p=[0,1,2,3,4,5];for(let i=5;i>0;i--){const j=Math.floor(los(z,i)*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}z++;
      if(p[0]===ost){const t=p[0];p[0]=p[5];p[5]=t;}
      for(const f of p){if(r.length>=n)break;const k=r.length;
        r.push({f,lustro:los(k,3)>.5,sk:.86+.14*los(k,4),faza:[0,.5,.25,.75][k%4]+.1*los(k,5),kier:los(k,7)>.5?1:-1,dx:(los(k,8)-.5)*.2});ost=f;}
    }
    RZAD.set(n,r);return r;
  }
  function fan(i,h,lustro){
    const im=obraz("fan-"+i+".webp");if(!im||!jest())return null;
    const s=h/im.naturalHeight,w=Math.max(1,Math.round(im.naturalWidth*s));
    return bufor("sk-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  // beton: szary filc z włóknami i ciemniejszą krawędzią rampy, cienie stóp (raz na rozmiar)
  const podloga=(W,h)=>bufor("sk-podl|"+W+"x"+h,W,h,c=>{
    const y=h*.72,g=c.createLinearGradient(0,0,0,h);
    g.addColorStop(0,"rgba(16,28,48,0)");g.addColorStop(.6,"rgba(16,28,48,.22)");g.addColorStop(1,"rgba(16,28,48,.4)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
    c.fillStyle="#8d8c88";c.fillRect(0,y,W,h-y);c.fillStyle=filcJasny(c);c.fillRect(0,y,W,h-y);
    c.fillStyle="rgba(0,0,0,.25)";c.fillRect(0,y,W,2);
    c.strokeStyle="rgba(218,159,45,.85)";c.lineWidth=2.2;c.beginPath();c.moveTo(0,y+1.5);c.lineTo(W,y+1.5);c.stroke();
    c.strokeStyle="rgba(26,26,26,.7)";c.lineWidth=1;c.setLineDash([5,4]);c.beginPath();c.moveTo(0,y+5);c.lineTo(W,y+5);c.stroke();c.setLineDash(BRAK);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      c.drawImage(podloga(W,h).cv,0,Wd.y,W,h);
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.82)),krok=W/n,R0=rzad(n);
      const ruch=!st.spokoj&&!st.bezRuchu,zywe=st.spiewaja||(st.zar||0)>.05||(st.ap||0)>.12;
      const moc=zywe?.05+.05*Math.min(1,st.skok||0)+.035*Math.min(3,st.zar||0)+.06*Math.min(1,(st.ap||0)*2):.02*Math.min(1,st.skok||0);
      const fz=st.faza||0,dno=Wd.y+h*.95;
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        const sk=ruch&&moc?Math.abs(Math.sin(PI*(fz+r.faza))):0,hop=sk*fh*moc,cx=krok*(i+.5+r.dx);
        Motywy.fan(c,b,cx,dno,st,"headbang",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
    }};

  // =========================================================================================== streak
  // Za głową: ciepła łuna i kółko deski, które kręci się tym szybciej, im większy ogień; przy og ≥ 3 wokół niego
  // przeszyty musztardowy krąg kręcący się w drugą stronę.
  const streak={
    glowa(c,sc,og,ts,z,przod){
      if(przod||!jest())return;
      const cy=-sc*.37,rl=sc*(.85+.1*og);
      const l=luna();c.globalAlpha=.85+.1*Math.sin(ts*1.7+z);c.drawImage(l.cv,-rl,cy-rl,2*rl,2*rl);c.globalAlpha=1;
      const k=iskra(0,64);
      if(k){const s=sc*(.82+.06*og);c.save();c.translate(0,cy);c.rotate(-ts*(og>=3?7:4)+z);c.drawImage(k.cv,-s/2,-s/2,s,s);c.restore();}
      if(og>=3){c.lineCap="round";c.setLineDash(SCIEG_KOLO);c.lineDashOffset=ts*sc*.15;c.strokeStyle="rgba(218,159,45,.85)";
        c.lineWidth=Math.max(1.2,sc*.03);c.beginPath();c.arc(0,cy,sc*.55,0,TAU);c.stroke();c.setLineDash(BRAK);c.lineDashOffset=0;}
    },
    // ślad: szew dżinsowy. Ciemny rant, granatowy pas dżinsu, po bokach musztardowy podwójny ścieg; w świeższej części
    // filcowe łatki, a przy og ≥ 2 po szwie toczą się kółka deski (2–3, obracają się zgodnie z drogą)
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),sz=k.og>=3?10:k.og>=2?8.5:6.5;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+2.5;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=sz;c.stroke();
      if(sz>=8){
        const d=sz/2-2;c.setLineDash(SCIEG_SZEW);c.strokeStyle=g.c;c.lineWidth=1.3;
        c.translate(0,-d);c.stroke();c.translate(0,2*d);c.stroke();c.translate(0,-d);c.setLineDash(BRAK);
      }
      if(!jest()||k.og<2)return;
      let ost=-1e9,nr=0;
      for(const p of pts){
        if(!p.sp||p.x-ost<64||p.x<k.x0)continue;ost=p.x;
        const f=(p.x-k.x0)/k.dlug;if(f<.25||f>.85)continue;
        if(++nr>5)break;
        const b=latka(nr%3),s=13+5*f;
        c.drawImage(b.cv,p.x-s/2,p.y-s/2,s,s);
      }
      const kol=iskra(0,40);if(!kol||k.pelna===false)return;
      const n=k.og>=3?3:2,r=k.og>=3?9:7.5;
      for(let j=0;j<n;j++){
        const x=k.xT-30-ul(k.ts*.32+j/n)*(k.dlug*.8),y=ySladu(pts,x);if(y==null)continue;
        const a=Math.min(1,(k.xT-30-x)/40,(x-k.x0)/(k.dlug*.25));if(a<=.05)continue;
        c.globalAlpha=a;c.save();c.translate(x,y-r*.55);c.rotate(-(k.xT-x)/r);c.drawImage(kol.cv,-r,-r,2*r,2*r);c.restore();
      }
      c.globalAlpha=1;
    },
    // płonąca nuta: zaśpiewana część jaśnieje jak przetarty filc, na froncie mały płomień i dwie iskry
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(255,245,215,.34)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas>.05&&jest()){
        const im=iskra(1,40),s=nh*(aktywna?1.5:1.15);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.6,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)iskryDeski(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{luna();for(let v=0;v<3;v++)latka(v);for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(0,64);}catch(e){}},
    aura:[MUSZT,ROZ],wypelnienie:["#fff3d0","#f0c45a",MUSZT],
    iskry:{kolory:["#fff3d0",MUSZT,"#ffd27a"]},dym:false,
    scena:["255,226,150","92,134,184","218,159,45"],
    tlo:{promienie:[["218,159,45",.10],["218,47,116",.06]],swiatlo:["255,226,150","47,82,128"]}};

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
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(10,18,32,0)");a.addColorStop(.5,"rgba(10,18,32,.6)");a.addColorStop(1,"rgba(10,18,32,.85)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(70,110,160,0)");b.addColorStop(.5,"rgba(70,110,160,.85)");b.addColorStop(1,"rgba(92,134,184,1)");
    const d=c.createLinearGradient(x0,0,xT,0);d.addColorStop(0,"rgba(218,159,45,0)");d.addColorStop(.5,"rgba(232,176,60,.85)");d.addColorStop(1,"rgba(240,190,80,1)");
    g={a,b,c:d};GRAD.set(kl,g);return g;
  }

  // ---- iskry spod deski i drobiazgi skejta: pule na gracza, bez alokacji w klatce ----
  // Iskry rodzą się pod głową (jak spod szlifującej deski), lecą w tył i w górę, opadają z grawitacją; rysowane
  // jako krótkie kreski wzdłuż prędkości w dwóch ścieżkach (gorący krem i musztarda). Drobiazgi (płomień, piorun,
  // gwiazda, trampek, agrafka: iskra-1..5) wylatują zza głowy w tempie zależnym od ognia. Na progu kombo co 4 nuty
  // wybucha snop iskier.
  const PULE=new WeakMap(),MAKS_IS=28,MAKS_CZ=8,TEMPO_IS=[0,26,48,80],TEMPO_CZ=[0,.8,1.6,2.8];
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,dis:0,dcz:0,is:[],cz:[]};
    for(let i=0;i<MAKS_IS;i++)p.is.push({t:0,x:0,y:0,vx:0,vy:0,goraca:false});
    for(let i=0;i<MAKS_CZ;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,k:1,r:20,rot:0,vr:0});
    PULE.set(g,p);return p;
  }
  function rzucIskre(P,x,y,sila){
    for(const q of P.is)if(q.t<=0){
      q.t=.25+.3*Math.random();q.x=x+(Math.random()-.5)*6;q.y=y;
      q.vx=-(140+260*Math.random())*sila;q.vy=-(60+170*Math.random())*sila;q.goraca=Math.random()<.45;return;
    }
  }
  function iskryDeski(c,L,g,st){
    if(typeof pozycjaZaby!=="function")return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    let pz=null;
    if(og>0&&g.spiewa!==false){
      pz=pozycjaZaby(L,g);const yx=pz.y+sc*.3;
      P.dis+=dt*TEMPO_IS[og];while(P.dis>=1){P.dis-=1;rzucIskre(P,pz.x-sc*.05,yx,1);}
      if(k>P.k&&k>=4&&k%4===0)for(let j=0;j<8;j++)rzucIskre(P,pz.x-sc*.05,yx,1.25);
      P.dcz+=dt*TEMPO_CZ[og];
      if(P.dcz>=1){P.dcz-=1;
        for(const p of P.cz)if(p.z<=0){
          p.k=1+Math.floor(Math.random()*5);p.r=Math.round(sc*(.28+.05*og)*(.85+.3*Math.random()));
          p.x=pz.x-sc*.1+(Math.random()-.5)*sc*.3;p.y=pz.y-sc*.35;p.vx=-(30+50*Math.random());p.vy=-(70+50*Math.random());
          p.rot=(Math.random()-.5)*.6;p.vr=(Math.random()-.5)*2.4;p.zy=1.3+.5*Math.random();p.z=p.zy;break;
        }
      }
    }else{P.dis=0;P.dcz=0;}
    P.k=k;
    // iskry: dwie ścieżki kresek (bez alokacji)
    for(let pass=0;pass<2;pass++){
      c.beginPath();let ile=0;
      for(const q of P.is){
        if(q.t<=0)continue;
        if(pass===0){q.t-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=620*dt;if(q.t<=0)continue;}
        if(q.goraca!==(pass===1))continue;
        c.moveTo(q.x,q.y);c.lineTo(q.x-q.vx*.035,q.y-q.vy*.035);ile++;
      }
      if(ile){c.lineCap="round";c.lineWidth=pass?1.6:2.2;c.strokeStyle=pass?"#fff4d6":"rgba(232,170,50,.95)";c.stroke();}
    }
    // drobiazgi: lecą w górę i do tyłu, obracają się, opadają
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=55*dt;p.rot+=p.vr*dt;
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,s=p.r*(f<.15?.5+.5*f/.15:1);
      c.globalAlpha=f<.12?f/.12:p.z<.4?p.z/.4:1;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Skatepark",kolejnosc:11,kolor:"#4a7fc1",zasoby:ZASOBY,zaba:true,przebranie:true,
    opis:"Filcowy skatepark w słońcu: rampy ze sklejki, niebo z dżinsu i chorągiewki. Karta jak granatowy dżins z podwójnym musztardowym szwem, nuty z musztardowego filcu, a przy kombo spod głowy sypią się iskry jak spod szlifującej deski i po szwie śladu toczą się kółka.",
    cechy:{tlo:"filcowy skatepark",klawisze:"sprany dżins",streak:"iskry spod deski",widownia:"skejterzy"},
    en:{nazwa:"Skatepark",
      opis:"A felt skatepark in the sun: plywood ramps, a denim sky and bunting. The card is navy denim with a double mustard seam, notes are mustard felt, and on a combo sparks fly from under your head like from a grinding board while skate wheels roll along the stitched trail.",
      cechy:{tlo:"felt skatepark",klawisze:"washed denim",streak:"grinding sparks",widownia:"skater crowd"}},
    karta:{papier:"#162a4c",cien:"rgba(8,16,30,.4)",czarne:"rgba(5,10,22,.2)",liniaC:"rgba(201,214,228,.22)",minione:"rgba(5,10,22,.24)",
      nazwy:"rgba(225,233,242,.82)",kreski:"rgba(201,214,228,.22)",nic:ROZ,szpilka:MUSZT,szpilkaBlask:"#fff6dc",
      cienNuty:"rgba(5,10,22,.45)",scieg:"rgba(218,159,45,.75)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
