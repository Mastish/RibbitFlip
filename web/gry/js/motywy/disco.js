// Motyw „Disco” (runda 4, 10-16): klub disco lat 70. z filcu. Tło to ilustracja (tlo.webp: kula z cekinów, filcowe
// reflektory, głośniki, winyle, buty na koturnie, fioletowe aksamitne kurtyny i parkiet z filcowych kwadratów), karta toru
// to ciemnofioletowa aksamitna szyba (faktura.webp: fiolet z cekinami, do tego pionowe fałdy kurtyny). Nuty: kafle
// parkietu w czterech kolorach (róż, limonka, musztarda z brokatem, fiolet) z przerywanym ściegiem po obrysie i szwami
// między kaflami. Klawiatura: kafle parkietu przygaszone, a śpiewany klawisz zapala się jasnym kolorem swojej nuty.
// Widownia: sześciu tancerzy w rytm (fan-*.webp) na pasie parkietu, w rytm rozjaśnia się jeden kafel (łagodnie, bez
// migania). Streak (detal PODPISOWY): ślad to taśma z cekinów (złote i różowe koraliki przesuwające się za żabą), za nim
// toczy się winyl, przy wyższym ogniu na śladzie mrugają gwiazdki; z toru lecą kula, winyle, buty, gwiazdki, serca
// i wrotki (iskra-0..5). Nic nie zmienia całej planszy naraz: bez stroboskopów. Wszystko z buforów.
(function(){
  "use strict";
  const ID="disco",PI=Math.PI,TAU=2*PI;
  const FIOL_C="#12041d",FIOL="#2a0e3f",ROZ="#e5368b",LIM="#b6d93c",MUSZT="#e9a92b",FIOLJ="#a54fd6",KREM="#f6e9cf",ZLOTO="#f0b429";
  const KAFLE=[ROZ,LIM,MUSZT,FIOLJ];                                       // kolory nut i kafli
  const KAFLE_C=["#a8286a","#7f9a2c","#b88624","#6e2a9c"];                  // klawisze w spoczynku (przygaszone)
  const KAFLE_J=["#ff5fb0","#d4f55a","#ffd04a","#cf86ff"];                 // klawisz zapalony
  const PC_KOL=[0,1,2,3,0,1,2,3,0,1,2,3];                                   // nuta (0..11) → kolor kafla
  const FANY=6,ISKRY=6;
  const ZASOBY=["tlo.webp","faktura.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const ul=x=>x-Math.floor(x);
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5],KORALIKI=[.1,6.5],KORALIKI2=[.1,12];   // kreski bez nowych tablic w klatce
  const fazaCw=ts=>typeof R!=="undefined"&&R&&R.st&&Number.isFinite(R.st.faza)?R.st.faza:ul(ts*2);
  const pcOd=s=>((Math.round(s)%12)+12)%12;

  // =========================================================================================== wzory (raz)
  const WZORY=new Map();
  function wzor(c,klucz,tworz,skala){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");if(skala&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix().scale(skala));WZORY.set(klucz,w);}
    return w;
  }
  // Brokat: drobne złote i białe cekiny na przezroczystym kafelku 48 px (bez szwu, bo punkty nie dotykają brzegu).
  function kafelekBrokatu(){
    const cv=document.createElement("canvas");cv.width=cv.height=48;const x=cv.getContext("2d");
    for(let i=0;i<46;i++){
      const px=2+los(i,1)*44,py=2+los(i,2)*44,s=.9+los(i,3)*1.5;
      x.fillStyle=i%3?"rgba(255,226,140,.85)":"rgba(255,255,255,.8)";x.fillRect(px,py,s,s);
    }
    return cv;
  }
  const brokat=c=>wzor(c,"brokat",kafelekBrokatu);
  // faktura motywu (fioletowy aksamit z cekinami, kafel 512 bez szwów); zanim się wczyta: nic (sam kolor karty)
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    if(!im)return null;
    return wzor(c,"faktura",()=>im,.6);
  }

  // =========================================================================================== sprite'y
  // Ciepłe światło reflektora (złoto z różem), gradient raz, w buforze.
  const luna=()=>bufor("di-luna",96,96,c=>{
    const g=c.createRadialGradient(48,48,0,48,48,48);
    g.addColorStop(0,"rgba(255,236,170,.5)");g.addColorStop(.45,"rgba(240,120,200,.2)");g.addColorStop(1,"rgba(240,120,200,0)");
    c.fillStyle=g;c.fillRect(0,0,96,96);
  });
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("di-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.14,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["233,169,43",.08],["229,54,139",.06]],swiatlo:["255,222,150","150,50,190"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#0d0614";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(10,2,18,0)");g.addColorStop(1,"rgba(10,2,18,.3)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Ciemnofioletowa aksamitna szyba: faktura z cekinami (przygaszona), pionowe fałdy kurtyny (gradient z pamięci),
  // złote światło reflektora od góry i różowa poświata parkietu przy dole. Nic nie jaśnieje przy nutach.
  const FALDY=new Map(),PION=new Map();
  function faldy(c,L){
    const k=Math.round(L.x)+"|"+Math.round(L.w);let g=FALDY.get(k);
    if(!g){
      if(FALDY.size>20)FALDY.clear();
      g=c.createLinearGradient(L.x,0,L.x+L.w,0);
      const n=Math.max(2,Math.min(40,Math.round(L.w/70)));
      for(let i=0;i<=n;i++){const t=i/n;g.addColorStop(t,i%2?"rgba(8,0,18,.26)":"rgba(160,90,210,.06)");}
      FALDY.set(k,g);
    }
    return g;
  }
  function pion(c,L){
    const k=Math.round(L.y)+"|"+Math.round(L.h);let g=PION.get(k);
    if(!g){
      if(PION.size>20)PION.clear();
      g=c.createLinearGradient(0,L.y,0,L.y+L.h);
      g.addColorStop(0,"rgba(255,214,130,.1)");g.addColorStop(.35,"rgba(255,214,130,0)");g.addColorStop(.75,"rgba(229,54,139,0)");g.addColorStop(1,"rgba(229,54,139,.12)");
      PION.set(k,g);
    }
    return g;
  }
  function fakturaKarty(c,L){
    const f=fakturaWzor(c);
    if(f){c.globalAlpha=.42;c.fillStyle=f;c.fillRect(L.x,L.y,L.w,L.h);c.globalAlpha=1;}
    c.fillStyle=faldy(c,L);c.fillRect(L.x,L.y,L.w,L.h);
    c.fillStyle=pion(c,L);c.fillRect(L.x,L.y,L.w,L.h);
  }

  // =========================================================================================== nuty
  // Kafel parkietu: kolor z ziarna (róż, limonka, musztarda z brokatem, fiolet), cień walca, szwy co jeden kafel
  // (pełna kreska), kremowy ścieg przerywany tuż przy obrysie. Obrys niemal czarny odcina taśmę od aksamitu.
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,255,255,.26)");g.addColorStop(.4,"rgba(255,255,255,0)");g.addColorStop(.75,"rgba(40,0,50,.08)");g.addColorStop(1,"rgba(40,0,50,.34)");
      WALEC.set(k,g);}
    return g;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2,ki=Math.abs(o.ziarno|0)%4;
      c.fillStyle=KAFLE[ki];c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(ki===2){c.fillStyle=brokat(c);c.fillRect(x0-2,y0-2,w+4,nh+4);}
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      const kom=Math.max(nh,w/10);
      if(w>kom*1.3){
        c.beginPath();for(let x=x0+kom;x<w/2-2;x+=kom){c.moveTo(x,y0);c.lineTo(x,y0+nh);}
        c.strokeStyle="rgba(18,4,29,.55)";c.lineWidth=1.3;c.stroke();
      }
      if(nh>=8){
        c.setLineDash(SCIEG);c.strokeStyle="rgba(246,233,207,.62)";c.lineWidth=1;
        c.strokeRect(x0+2.5,y0+2.5,w-5,nh-5);c.setLineDash(BRAK);
      }
    },
    brzeg:()=>FIOL_C,zapas:()=>0};

  // =========================================================================================== klawisze
  // Parkiet w przygaszonych kolorach (kolor kafla zależy od nuty), czarne klawisze z ciemnego filcu, kremowy ścieg
  // przerywany. Gracz: śpiewany klawisz rozjaśnia się w kolorze swojej nuty (jasny kafel, kremowy ścieg).
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(8,0,16,.5)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=FIOL_C;c.fill();
      const ins=Math.max(1,Math.min(2.2,L.rh*.18));
      let dol=y0+h;
      const seg=(yt,ki)=>{
        const hh=dol-yt-2*ins;dol=yt;if(hh<1)return;
        c.beginPath();c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,5));
        c.fillStyle=KAFLE_C[ki];c.fill();
        c.fillStyle=brokat(c);if(ki===2)c.fill();
        c.fillStyle="rgba(255,255,255,.1)";c.fillRect(x+ins+2,yt+ins+.5,w-2*ins-4,Math.max(1,Math.min(3,hh*.22)));
        c.strokeStyle="rgba(18,4,29,.7)";c.lineWidth=1;c.stroke();
      };
      let ost=0;
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=pcOd(s);
        ost=PC_KOL[pc];
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)seg(yy,ost);}
      }
      if(dol>y0+1+2*ins)seg(y0,ost);
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,4,4,0]);}
      c.fillStyle="#1c0a2c";c.fill();c.strokeStyle=FIOL_C;c.lineWidth=1.2;c.stroke();
      c.setLineDash(SCIEG);c.strokeStyle="rgba(240,180,41,.6)";c.lineWidth=1;c.stroke();c.setLineDash(BRAK);
      c.setLineDash(SCIEG);c.strokeStyle="rgba(246,233,207,.55)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=FIOL_C;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      const ki=PC_KOL[pcOd(s)];
      c.globalAlpha=g.naNucie?.96:.62;c.fillStyle=KAFLE_J[ki];c.fillRect(L.kx+1,y+.5,L.kw-2,hh);c.globalAlpha=1;
      c.fillStyle="rgba(255,255,255,.28)";c.fillRect(L.kx+1,y+.5,L.kw-2,Math.max(1,Math.min(3,hh*.3)));
      c.strokeStyle=g.naNucie?KREM:"rgba(246,233,207,.6)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Tancerze z fan-*.webp na pasie parkietu z filcowych kafli (kolory kafli z palety, brokat na musztardowych, szwy).
  // Kolejność z ziarnem bez sąsiadów-bliźniaków, odbicia i skala z ziarna. Przy śpiewie podskakują w rytm ćwierćnut
  // i kołyszą się na boki, przy kombo wyżej; w rytm jeden kafel rozjaśnia się i gaśnie łagodnie. W spokoju stoją.
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
    return bufor("di-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  const FLOOR=.3;   // udział wysokości pasa zajęty przez parkiet
  const parkiet=(W,h,tw)=>bufor("di-park|"+W+"x"+h+"|"+tw,W,h,c=>{
    const hf=Math.round(h*FLOOR),y=h-hf,n=Math.ceil(W/tw);
    const g=c.createLinearGradient(0,0,0,y);g.addColorStop(0,"rgba(10,2,18,0)");g.addColorStop(1,"rgba(10,2,18,.28)");
    c.fillStyle=g;c.fillRect(0,0,W,y);
    c.fillStyle=FIOL_C;c.fillRect(0,y-1,W,hf+1);
    for(let i=0;i<n;i++){
      const ki=(i+(i>>2))%4,x=i*tw;
      c.fillStyle=KAFLE[ki];c.fillRect(x+1,y+1,tw-2,hf-1);
      if(ki===2){c.fillStyle=brokat(c);c.fillRect(x+1,y+1,tw-2,hf-1);}
      const gg=c.createLinearGradient(0,y,0,h);gg.addColorStop(0,"rgba(255,255,255,.2)");gg.addColorStop(1,"rgba(40,0,50,.3)");
      c.fillStyle=gg;c.fillRect(x+1,y+1,tw-2,hf-1);
    }
    c.setLineDash(SCIEG);c.strokeStyle="rgba(246,233,207,.6)";c.lineWidth=1;c.beginPath();
    for(let i=0;i<n;i++){const x=i*tw+3;c.moveTo(x,y+3);c.lineTo(x+tw-6,y+3);}
    c.stroke();c.setLineDash(BRAK);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*.98),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.95)),krok=W/n,R0=rzad(n);
      const ruch=!st.spokoj&&!st.bezRuchu,zywe=st.spiewaja||(st.zar||0)>.05||(st.ap||0)>.12;
      const moc=zywe?.04+.05*Math.min(1,st.skok||0)+.03*Math.min(3,st.zar||0)+.06*Math.min(1,(st.ap||0)*2):.015*Math.min(1,st.skok||0);
      const fz=st.faza||0,dno=Wd.y+h*.94,kol=ruch&&zywe?Math.sin(PI*(st.beat!=null?st.beat:fz)*.5)*krok*.05:0;
      const tw=Math.max(18,Math.round(h*.36)),nT=Math.ceil(W/tw);
      c.drawImage(parkiet(W,h,tw).cv,0,Wd.y,W,h);
      if(ruch&&zywe){   // jeden kafel rozjaśnia się i łagodnie gaśnie (bez migania)
        const fr=ul(fz),a=.28*Math.sin(PI*Math.min(1,fr*1.4)),ix=(Math.floor(fz)*7+3)%nT,hf=Math.round(h*FLOOR);
        c.globalAlpha=a;c.fillStyle="#fff4d6";c.fillRect(ix*tw+1,Wd.y+h-hf+1,tw-2,hf-1);c.globalAlpha=1;
      }
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        const hop=ruch&&moc?Math.abs(Math.sin(PI*(fz+r.faza)))*fh*moc:0;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"disco",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
    }};

  // =========================================================================================== streak
  // Głowę zastępuje przebranie żaby (hak pusty). Sygnatura: taśma z cekinów za żabą, toczący się winyl i drobiazgi.
  const streak={
    glowa(){},
    // ślad: taśma z cekinów. Ciemny cień, różowo-złota nitka i dwie warstwy koralików (kreska 0,1 px z okrągłą
    // końcówką = kropka) przesuwające się wzdłuż śladu; przy ogniu 2+ mrugają na nim gwiazdki, tuż za żabą toczy się winyl.
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),sz=k.og>=3?5:k.og>=2?4.2:3.4;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}const y=p.y+Math.sin(p.x*.06)*1.3;if(pi)c.lineTo(p.x,y);else{c.moveTo(p.x,y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+2.4;c.stroke();
      c.strokeStyle=g.c;c.lineWidth=sz*.8;c.stroke();
      c.setLineDash(KORALIKI);c.lineDashOffset=k.ts*22;c.strokeStyle=g.b;c.lineWidth=sz*1.45;c.stroke();
      if(k.og>=1){c.setLineDash(KORALIKI2);c.lineDashOffset=-k.ts*30;c.strokeStyle="#fffbe8";c.lineWidth=sz*.85;c.stroke();}
      c.setLineDash(BRAK);c.lineDashOffset=0;
      if(!jest()||k.og<1)return;
      if(k.og>=2){
        const st=iskra(3,32);let ost=-1e9,nr=0;
        if(st)for(const p of pts){
          if(!p.sp||p.x-ost<64||p.x<k.x0)continue;ost=p.x;
          const f=(p.x-k.x0)/k.dlug;if(f<.2||f>.85)continue;
          if(++nr>5)break;
          const s=(9+7*f)*(.75+.25*Math.sin(k.ts*3+p.x*.04));c.drawImage(st.cv,p.x-s/2,p.y-s/2,s,s);
        }
      }
      const wl=iskra(1,48);if(!wl||k.pelna===false)return;
      const r=k.og>=3?12:10,x=k.xT-34,y=ySladu(pts,x);if(y==null)return;
      c.save();c.translate(x,y-r*.6);c.rotate(k.ts*4);c.drawImage(wl.cv,-r,-r,2*r,2*r);c.restore();
    },
    // płonąca nuta: zaśpiewana część rozjaśnia się złotem, na froncie mała kula dyskotekowa
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(255,230,150,.34)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas>.05&&jest()){
        const im=iskra(0,48),s=nh*(aktywna?1.5:1.15);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.6,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)blyskiToru(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{luna();for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(0,48);iskra(1,48);iskra(3,32);}catch(e){}},
    aura:["#fff0c0","#f0b429"],wypelnienie:["#fff6dc","#ffc2ec",ZLOTO],
    iskry:{kolory:["#ffffff","#ffd86b","#ff5fb0"]},dym:false,
    scena:["255,200,90","230,90,170","165,79,214"],
    tlo:{promienie:[["233,169,43",.08],["229,54,139",.06]],swiatlo:["255,222,150","150,50,190"]}};

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
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(18,4,29,0)");a.addColorStop(.5,"rgba(18,4,29,.5)");a.addColorStop(1,"rgba(18,4,29,.75)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(255,216,107,0)");b.addColorStop(.5,"rgba(255,216,107,.85)");b.addColorStop(1,"rgba(255,244,196,1)");
    const d=c.createLinearGradient(x0,0,xT,0);d.addColorStop(0,"rgba(229,54,139,0)");d.addColorStop(.5,"rgba(229,54,139,.8)");d.addColorStop(1,"rgba(255,110,190,.95)");
    g={a,b,c:d};GRAD.set(kl,g);return g;
  }

  // ---- drobiazgi z toru: pula na gracza, bez alokacji w klatce ----
  // Kula, winyl, but na koturnie, gwiazdka, serce i wrotka (iskra-0..5) wyskakują zza żaby i unoszą się wolno ku tyłowi,
  // gwiazdki i kula lekko mrugają skalą; winyle lecą szybciej i kręcą się jak frisbee. Na progu kombo co 4 nuty trzy naraz.
  const PULE=new WeakMap(),MAKS_CZ=10,TEMPO=[0,1,2,3.4],RODZAJE=[0,2,3,4,5];
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,dos:0,cz:[]};
    for(let i=0;i<MAKS_CZ;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,k:0,r:20,fz:0,rot:0,w:0});
    PULE.set(g,p);return p;
  }
  function rzuc(P,L,g,sc,og){
    for(const p of P.cz)if(p.z<=0){
      const pz=pozycjaZaby(L,g),winyl=Math.random()<.24;
      p.k=winyl?1:RODZAJE[Math.floor(Math.random()*5)];p.r=Math.round(sc*(.26+.05*og)*(.85+.3*Math.random()));
      p.x=pz.x-sc*.15+(Math.random()-.5)*sc*.4;p.y=pz.y-sc*.4;
      p.vx=-(winyl?55+45*Math.random():20+35*Math.random());p.vy=-(winyl?20+30*Math.random():45+40*Math.random());
      p.fz=Math.random()*TAU;p.rot=(Math.random()-.5)*.8;p.w=winyl?(Math.random()<.5?-1:1)*(5+3*Math.random()):(Math.random()-.5)*1.6;
      p.zy=winyl?1.4+.5*Math.random():1.8+.6*Math.random();p.z=p.zy;return;
    }
  }
  function blyskiToru(c,L,g,st){
    if(typeof pozycjaZaby!=="function"||!jest())return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(og>0){
      P.dos+=dt*TEMPO[og];if(P.dos>=1){P.dos-=1;rzuc(P,L,g,sc,og);}
      if(k>P.k&&k>=4&&k%4===0)for(let j=0;j<3;j++)rzuc(P,L,g,sc,og);
    }else P.dos=0;
    P.k=k;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt+Math.sin(p.fz+p.z*2.4)*dt*14;p.y+=p.vy*dt;p.vy=Math.min(30,p.vy+70*dt);
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,mrug=p.k===3||p.k===0?1+.1*Math.sin(p.fz+p.z*7):1,s=p.r*mrug*(f<.15?.5+.5*f/.15:1);
      c.globalAlpha=f<.12?f/.12:p.z<.5?p.z/.5:1;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot+p.w*(p.zy-p.z));c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Disco",kolejnosc:18,kolor:"#a54fd6",zasoby:ZASOBY,przebranie:true,
    opis:"Klub disco lat 70. z filcu: kula z cekinów, podświetlany parkiet z kwadratów, winyle, buty na koturnie i aksamitne kurtyny. Karta jak ciemnofioletowy aksamit z cekinami, nuty to kolorowe kafle parkietu, śpiewany klawisz zapala się w kolorze nuty, a przy kombo za żabą ciągnie się taśma z cekinów, toczy się winyl i lecą gwiazdki, serca i buty na koturnie.",
    cechy:{tlo:"klub disco z filcu",klawisze:"podświetlany parkiet",streak:"cekiny i winyle",widownia:"tancerze na parkiecie"},
    en:{nazwa:"Disco",
      opis:"A 70s disco club made of felt: a sequin mirror ball, a lit dance floor of felt squares, vinyl records, platform boots and velvet curtains. The card is dark purple sequinned velvet, notes are coloured dance floor tiles, the key you sing lights up in your note's colour, and on a combo a sequin ribbon trails behind you, a record rolls along and stars, hearts and platform boots fly by.",
      cechy:{tlo:"felt disco club",klawisze:"lit dance floor",streak:"sequins and records",widownia:"dancers on the floor"}},
    karta:{papier:FIOL,cien:"rgba(8,0,18,.45)",czarne:"rgba(8,0,18,.22)",liniaC:"rgba(255,214,130,.3)",minione:"rgba(8,0,18,.28)",
      nazwy:"rgba(246,230,255,.88)",kreski:"rgba(230,190,255,.24)",nic:ZLOTO,szpilka:ZLOTO,szpilkaBlask:"#fff3c4",
      cienNuty:"rgba(6,0,14,.55)",scieg:"rgba(246,233,207,.6)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
