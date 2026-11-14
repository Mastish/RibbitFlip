// Motyw „Wyspa tiki” (runda 4, 10-16): tropikalna plaża z filcu o zachodzie słońca. Tło to ilustracja (tlo.webp:
// rzeźbione totemy, pochodnie z bambusa, palmy z kokosami, deska surfingowa, girlanda z hibiskusów i liści monstery,
// laguna pod pomarańczowym słońcem), karta toru to turkusowa szyba laguny z fakturą bambusowej maty (faktura.webp
// mnożona na turkus, widać splot, nic nie jaśnieje), u góry ciepły odblask zachodu. Nuty: bambusowe kije z kolankami
// (wzór z pamięci), wiązane u początku sznurkiem z kokosa, ziarno daje bambus złoty albo zielonkawy. Klawiatura: białe
// klawisze z jasnego bambusa, czarne z ciemnego drewna tiki, ścieg kremową nicią. Widownia: sześciu imprezowiczów
// i sześć tańczących totemów tiki (fan-0..11.webp; totemy i wielki totem w tle od 10-17) na piasku z filcu kołysze biodrami jak w hula i podskakuje w rytm.
// Streak (detal PODPISOWY): ślad to fala laguny (turkusowy pas z pianą ze ściegu), na której płyną płatki hibiskusa;
// zza żaby wylatują hibiskusy, kokosy, liście monstery, maski tiki, ukulele i ananasy (iskra-0..5) i opadają łukiem
// jak rzucone lei. Głowa bez efektu: żabę ubiera przebranie motywu. Wszystko z buforów.
(function(){
  "use strict";
  const ID="tiki",PI=Math.PI,TAU=2*PI;
  const LAG="#0f7f92",LAG_C="#073f45",TURK="#2cc2c0",PIANA="#f3ead6",BAMB="#e6c47c",BAMB_C="#b48a44",
    BAMB_Z="#c9cf7a",DREWNO="#3a2416",DREWNO_C="#22140b",ZACH="#f28a2e",HIBI="#e3307a",KREM="#f3ead6";
  const FANY=12,ISKRY=6;   // 10-17: fan-6..11 = tańczące totemy tiki
  const ZASOBY=["tlo.webp","faktura.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5],PIANA_K=[4,3];   // kreski bez nowych tablic w klatce

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
  // Kolanka bambusa: co 34 px ciemny pierścień z jasnym brzegiem, między nimi cienkie podłużne włókna (kafel 34 × 12).
  function kafelekKolanek(){
    const cv=document.createElement("canvas");cv.width=34;cv.height=12;const x=cv.getContext("2d");
    x.fillStyle="rgba(120,80,30,.13)";for(let i=0;i<4;i++)x.fillRect(0,1+i*3+(i%2),34,.7);
    x.fillStyle="rgba(90,55,18,.55)";x.fillRect(0,0,2,12);
    x.fillStyle="rgba(255,248,220,.6)";x.fillRect(2,0,1.2,12);
    x.fillStyle="rgba(90,55,18,.2)";x.fillRect(31.5,0,2.5,12);
    return cv;
  }
  const WZORY=new Map();
  function wzor(c,klucz,tworz,skala){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");if(skala&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix().scale(skala));WZORY.set(klucz,w);}
    return w;
  }
  const kolanka=c=>wzor(c,"kolanka",kafelekKolanek);
  const filcPiasek=c=>wzor(c,"piasek",()=>kafelekFilcu("rgba(255,246,220,.45)","rgba(130,90,40,.18)",360));
  // faktura motywu (bambusowa mata, kafel 512 bez szwów); zanim się wczyta: kolanka z kodu
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    if(!im)return kolanka(c);
    return wzor(c,"faktura",()=>im,.42);
  }

  // =========================================================================================== sprite'y
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("tk-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.16,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["255,190,110",.10],["44,194,192",.05]],swiatlo:["255,200,130","14,106,114"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#e7c48f";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(40,20,8,0)");g.addColorStop(1,"rgba(40,20,8,.28)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Turkusowa szyba laguny: bambusowa mata mnożona na turkus (splot widać jako ciemniejszą plecionkę), u góry ciepły
  // odblask zachodu, ku dołowi głębsza woda.
  function fakturaKarty(c,L){
    c.globalCompositeOperation="multiply";c.globalAlpha=.62;c.fillStyle=fakturaWzor(c);c.fillRect(L.x,L.y,L.w,L.h);
    c.globalCompositeOperation="source-over";c.globalAlpha=1;
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,150,70,.14)");g.addColorStop(.3,"rgba(255,150,70,0)");g.addColorStop(.7,"rgba(4,30,34,0)");g.addColorStop(1,"rgba(4,30,34,.25)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
  }

  // =========================================================================================== nuty
  // Bambusowy kij: złoty albo zielonkawy (z ziarna), kolanka i włókna z wzoru, cień walca, u początku owijka ze
  // sznurka kokosowego. Obrys z ciemnego drewna tiki odcina kij od turkusowej karty.
  const KIJ=[BAMB,BAMB,BAMB_Z];
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,250,225,.35)");g.addColorStop(.3,"rgba(255,250,225,0)");g.addColorStop(.65,"rgba(110,70,20,.08)");g.addColorStop(1,"rgba(90,50,10,.42)");
      WALEC.set(k,g);}
    return g;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2,z=o.ziarno|0;
      c.fillStyle=KIJ[z%3];c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=kolanka(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(w>=16&&nh>=6){c.fillStyle=DREWNO;c.fillRect(x0+3,y0-2,2,nh+4);c.fillRect(x0+7,y0-2,2,nh+4);}
    },
    brzeg:()=>DREWNO_C,zapas:()=>0};

  // =========================================================================================== klawisze
  // Turkusowa mata (faktura mnożona), białe klawisze z jasnego bambusa z kolankami, czarne z ciemnego drewna tiki,
  // kremowy ścieg wokół. Gracz: pomarańczowy pas zachodu z ciemnym ściegiem.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(4,30,34,.45)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=LAG;c.fill();
      c.save();c.clip();c.globalCompositeOperation="multiply";c.globalAlpha=.62;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.restore();
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,"#f3dda6");grad.addColorStop(.6,BAMB);grad.addColorStop(1,BAMB_C);
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,5));
      }
      c.fillStyle=grad;c.fill();c.save();c.clip();c.fillStyle=kolanka(c);c.fillRect(x,y0,w,h);c.restore();
      c.strokeStyle="rgba(58,36,22,.55)";c.lineWidth=1;c.stroke();
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,4,4,0]);}
      c.fillStyle=DREWNO;c.fill();c.save();c.clip();c.globalCompositeOperation="screen";c.globalAlpha=.18;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.restore();
      c.setLineDash(SCIEG);c.strokeStyle="rgba(243,234,214,.7)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=LAG_C;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(242,138,46,.92)":"rgba(242,138,46,.5)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?DREWNO_C:"rgba(34,20,11,.55)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Imprezowicze z fan-*.webp na piasku z filcu. Kolejność z ziarnem bez sąsiadów-bliźniaków, odbicia i skala z ziarna.
  // Przy śpiewie kołyszą biodrami jak w hula (każdy na boki w swojej fazie, pół taktu w jedną stronę) i podskakują
  // w rytm ćwierćnut, przy kombo wyżej. W spokoju stoją.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=71;
    while(r.length<n){
      const p=[];for(let i=0;i<FANY;i++)p.push(i);for(let i=FANY-1;i>0;i--){const j=Math.floor(los(z,i)*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}z++;
      if(p[0]===ost){const t=p[0];p[0]=p[FANY-1];p[FANY-1]=t;}
      for(const f of p){if(r.length>=n)break;const k=r.length;
        r.push({f,lustro:los(k,3)>.5,sk:.86+.14*los(k,4),faza:[0,.5,.25,.75][k%4]+.1*los(k,5),dx:(los(k,8)-.5)*.16,
          hula:(k%2?1:-1)*(.8+.4*los(k,9))});ost=f;}
    }
    RZAD.set(n,r);return r;
  }
  function fan(i,h,lustro){
    const im=obraz("fan-"+i+".webp");if(!im||!jest())return null;
    const s=h/im.naturalHeight,w=Math.max(1,Math.round(im.naturalWidth*s));
    return bufor("tk-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  // piasek: falisty pas złotego filcu z włóknami, brzeg z kremowej piany ze ściegiem, cień od góry (raz na rozmiar)
  const piasek=(W,h)=>bufor("tk-piasek|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(40,20,8,0)");g.addColorStop(.6,"rgba(40,20,8,.2)");g.addColorStop(1,"rgba(40,20,8,.32)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
    const y=h*.76,lin=o=>x=>y+o+Math.sin(x*.019)*h*.03+Math.sin(x*.0057+2)*h*.045;
    const fala=(o)=>{const f=lin(o);c.beginPath();c.moveTo(0,h);c.lineTo(0,f(0));
      for(let x=0;x<=W;x+=24)c.lineTo(x,f(x));c.lineTo(W,h);c.closePath();};
    fala(-3);c.fillStyle=PIANA;c.fill();
    fala(1);c.fillStyle="rgba(60,35,15,.3)";c.fill();
    fala(0);c.fillStyle="#dcb06a";c.fill();c.fillStyle=filcPiasek(c);c.fill();
    const f=lin(6);c.beginPath();for(let x=0;x<=W;x+=24){if(x)c.lineTo(x,f(x));else c.moveTo(x,f(x));}
    c.strokeStyle="rgba(120,70,25,.5)";c.lineWidth=1.2;c.setLineDash([4,3]);c.stroke();c.setLineDash(BRAK);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.95)),krok=W/n,R0=rzad(n);
      const ruch=!st.spokoj&&!st.bezRuchu,zywe=st.spiewaja||(st.zar||0)>.05||(st.ap||0)>.12;
      const moc=zywe?.03+.04*Math.min(1,st.skok||0)+.03*Math.min(3,st.zar||0)+.05*Math.min(1,(st.ap||0)*2):.012*Math.min(1,st.skok||0);
      const fz=st.faza||0,dno=Wd.y+h*1.02,bt=st.beat!=null?st.beat:fz,hula=ruch&&zywe?krok*.07:0;
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        const hop=ruch&&moc?Math.abs(Math.sin(PI*(fz+r.faza)))*fh*moc:0;
        const bok=hula?Math.sin(PI*(bt+r.faza)*.5)*hula*r.hula:0;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"bujanie",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
      c.drawImage(piasek(W,h).cv,0,Wd.y,W,h);   // piasek na wierzchu: imprezowicze stoją w nim po kostki
    }};

  // =========================================================================================== streak
  // Ślad: fala laguny. Ciemny cień, turkusowy pas wody falujący w czasie i kremowa piana ze ściegu (przerywana kreska
  // płynąca ku żabie); przy wyższym kombo na fali płyną płatki hibiskusa (iskra-0), a tuż za żabą liść monstery.
  const streak={
    glowa(){},
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),sz=k.og>=3?6:k.og>=2?5:4,ts=k.ts;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}const y=p.y+Math.sin(p.x*.05-ts*4)*2.2;if(pi)c.lineTo(p.x,y);else{c.moveTo(p.x,y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+2.6;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=sz;c.stroke();
      c.setLineDash(PIANA_K);c.lineDashOffset=-ts*14;c.strokeStyle=g.c;c.lineWidth=Math.max(1.2,sz*.32);c.stroke();c.setLineDash(BRAK);c.lineDashOffset=0;
      if(!jest()||k.og<1)return;
      if(k.og>=2){
        const hb=iskra(0,32);let ost=-1e9,nr=0;
        if(hb)for(const p of pts){
          if(!p.sp||p.x-ost<64||p.x<k.x0)continue;ost=p.x;
          const f=(p.x-k.x0)/k.dlug;if(f<.2||f>.84)continue;
          if(++nr>5)break;
          const s=9+7*f,y=p.y+Math.sin(p.x*.05-ts*4)*2.2;
          c.save();c.translate(p.x,y);c.rotate(Math.sin(ts*2+p.x*.03)*.5);c.drawImage(hb.cv,-s/2,-s/2,s,s);c.restore();
        }
      }
      const li=iskra(2,48);if(!li||k.pelna===false)return;
      const r=k.og>=3?11:9,x=k.xT-32,y=ySladu(pts,x);if(y==null)return;
      c.save();c.translate(x,y-r*.5);c.rotate(Math.sin(ts*3)*.35-.3);c.drawImage(li.cv,-r,-r,2*r,2*r);c.restore();
    },
    // płonąca nuta: zaśpiewana część rozgrzewa się pomarańczą zachodu, na froncie hibiskus
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(242,138,46,.34)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas>.05&&jest()){
        const im=iskra(0,48),s=nh*(aktywna?1.5:1.15);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.6,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)leiToru(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(0,48);iskra(0,32);iskra(2,48);}catch(e){}},
    aura:["#fff0d8",ZACH],wypelnienie:["#fff6e6","#ffd39a",ZACH],
    iskry:{kolory:["#fff6e6",TURK,HIBI]},dym:false,
    scena:["255,190,110","44,194,192","227,48,122"],
    tlo:{promienie:[["255,190,110",.10],["44,194,192",.05]],swiatlo:["255,200,130","14,106,114"]}};

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
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(4,40,46,0)");a.addColorStop(.5,"rgba(4,40,46,.5)");a.addColorStop(1,"rgba(4,40,46,.8)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(44,194,192,0)");b.addColorStop(.5,"rgba(44,194,192,.85)");b.addColorStop(1,"rgba(70,214,210,1)");
    const d=c.createLinearGradient(x0,0,xT,0);d.addColorStop(0,"rgba(243,234,214,0)");d.addColorStop(.5,"rgba(243,234,214,.8)");d.addColorStop(1,"rgba(255,250,236,.95)");
    g={a,b,c:d};GRAD.set(kl,g);return g;
  }

  // ---- lei z wyspy: pula na gracza, bez alokacji w klatce ----
  // Hibiskus, kokos, liść monstery, maska tiki, ukulele, ananas (iskra-0..5) wylatują zza żaby w górę i do tyłu,
  // wirując, i opadają łukiem jak rzucony wieniec; hibiskusy częściej. Na progu kombo co 4 nuty trzy naraz.
  const PULE=new WeakMap(),MAKS_CZ=10,TEMPO=[0,1,2,3.4],LOSUJ=[0,0,0,1,2,2,3,4,5,0];
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
      p.x=pz.x-sc*.2+(Math.random()-.5)*sc*.3;p.y=pz.y-sc*.35;p.vx=-(40+60*Math.random());p.vy=-(110+60*Math.random());
      p.rot=Math.random()*TAU;p.wir=(Math.random()<.5?-1:1)*(1.5+2*Math.random());p.zy=1.5+.5*Math.random();p.z=p.zy;return;
    }
  }
  function leiToru(c,L,g,st){
    if(typeof pozycjaZaby!=="function"||!jest())return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(og>0){
      P.dos+=dt*TEMPO[og];if(P.dos>=1){P.dos-=1;rzuc(P,L,g,sc,og);}
      if(k>P.k&&k>=4&&k%4===0)for(let j=0;j<3;j++)rzuc(P,L,g,sc,og);
    }else P.dos=0;
    P.k=k;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=170*dt;p.rot+=p.wir*dt;
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,s=p.r*(f<.15?.5+.5*f/.15:1);
      c.globalAlpha=f<.1?f/.1:p.z<.45?p.z/.45:1;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Wyspa tiki",kolejnosc:20,kolor:"#21a9b0",zasoby:ZASOBY,przebranie:true,
    opis:"Tropikalna plaża z filcu o zachodzie słońca: wielki totem tiki, pochodnie z bambusa, palmy i girlandy hibiskusów, a w widowni tańczą małe totemy. Karta to turkusowa laguna na bambusowej macie, nuty to bambusowe kije, a przy kombo za żabą płynie fala z płatkami hibiskusa i wylatują kwiaty, kokosy i liście.",
    cechy:{tlo:"plaża tiki",klawisze:"bambus i drewno tiki",streak:"fala i hibiskusy",widownia:"hula i totemy tiki"},
    en:{nazwa:"Tiki Island",
      opis:"A felt tropical beach at sunset: a big tiki totem, bamboo torches, palm trees and hibiscus garlands, with little totems dancing in the crowd. The card is a turquoise lagoon over a bamboo mat, notes are bamboo poles, and on a combo a wave with hibiscus petals trails behind you while flowers, coconuts and leaves fly out.",
      cechy:{tlo:"tiki beach",klawisze:"bamboo and tiki wood",streak:"wave and hibiscus",widownia:"hula crowd and tiki totems"}},
    karta:{papier:LAG,cien:"rgba(4,30,34,.4)",czarne:"rgba(2,20,24,.2)",liniaC:"rgba(230,250,245,.22)",minione:"rgba(2,20,24,.24)",
      nazwy:"rgba(240,250,244,.85)",kreski:"rgba(230,250,245,.2)",nic:KREM,szpilka:ZACH,szpilkaBlask:"#fff2dc",
      cienNuty:"rgba(2,20,24,.45)",scieg:"rgba(243,234,214,.6)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
