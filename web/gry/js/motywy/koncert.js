// Motyw „Koncert” (runda 2, 10-09 wieczór): scena rockowa z czarnego filcu. Ilustracja sceny (tlo.webp: kratownica,
// reflektory, kolumny, różowe cekinowe błyskawice) na cały ekran, karta toru to grafitowa szyba z włóknami filcu i
// bursztynowym ściegiem. Nuty: bursztynowy filc z cekinowym połyskiem (stałe kropki z wzoru) i różowym przeszyciem.
// Klawiatura z popielatego filcu, czarne klawisze z bursztynowym cekinem. Widownia: sześciu punkowych fanów
// (fan-*.webp) skacze w rytm. Streak: wianek migoczących cekinów za głową, drobiazgi z iskra-*.webp (zapalniczka,
// kostka gitarowa, gwiazda…), za żabą cekinowa nić. Wcześniej motyw dziedziczył stare stopnie (kurtyna, żar, raca,
// pirotechnika); teraz ma pełną własną definicję. Wszystko stałe w bufor(), w klatce tylko drawImage.
(function(){
  "use strict";
  const ID="koncert",PI=Math.PI,TAU=2*PI;
  const CZARNY="#161314",GRAFIT="#2b2629",BURSZTYN="#f2a531",BURSZTYN_C="#4a2a0c",ROZ="#ec2f86",POPIEL="#d8d0c6";
  const FANY=6,ISKRY=6;
  const ZASOBY=["tlo.webp","zaba-0.webp","zaba-1.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const ul=x=>x-Math.floor(x);
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;

  // =========================================================================================== wzory (raz)
  // Włókna filcu: krótkie kreski jasne i ciemne na przezroczystym kafelku 96 px, zawinięte na brzegach (bez szwu).
  function kafelekFilcu(jasne,ciemne,ile){
    const cv=document.createElement("canvas");cv.width=cv.height=96;const x=cv.getContext("2d");
    let s=564738291;const r=()=>(s=(Math.imul(s,1103515245)+12345)>>>0)/4294967296;
    x.lineCap="round";
    for(let i=0;i<ile;i++){
      const px=r()*96,py=r()*96,a=r()*TAU,l=2+r()*5,lw=.5+r()*.7;
      x.strokeStyle=i%2?jasne:ciemne;x.lineWidth=lw;x.beginPath();
      for(const [dx,dy] of [[0,0],[-96,0],[0,-96],[-96,-96]]){x.moveTo(px+dx,py+dy);x.lineTo(px+dx+Math.cos(a)*l,py+dy+Math.sin(a)*l);}
      x.stroke();
    }
    return cv;
  }
  // Cekiny na taśmie: rzadkie złote krążki z białym błyskiem na przezroczystym kafelku (stały połysk, bez animacji).
  function kafelekCekinow(){
    const d=3,n=40,cv=document.createElement("canvas");cv.width=cv.height=n*d;const x=cv.getContext("2d");x.scale(d,d);
    let s=24681357;const r=()=>(s=(Math.imul(s,1103515245)+12345)>>>0)/4294967296;
    for(let i=0;i<9;i++){
      const px=r()*n,py=r()*n,rr=1.3+r()*1.1,jasny=r()>.55;
      for(const [dx,dy] of [[0,0],[-n,0],[0,-n],[-n,-n]]){
        x.fillStyle=jasny?"rgba(255,236,170,.95)":"rgba(255,214,120,.7)";x.beginPath();x.arc(px+dx,py+dy,rr,0,TAU);x.fill();
        x.strokeStyle="rgba(74,42,12,.45)";x.lineWidth=.5;x.stroke();
        if(jasny){x.fillStyle="#ffffff";x.beginPath();x.arc(px+dx-rr*.35,py+dy-rr*.35,rr*.35,0,TAU);x.fill();}
      }
    }
    return {cv,d};
  }
  const WZORY=new Map();
  function wzor(c,klucz,tworz){
    let w=WZORY.get(klucz);
    if(!w){const t=tworz();const cv=t.cv||t,d=t.d||1;w=c.createPattern(cv,"repeat");
      if(w&&d!==1&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix([1/d,0,0,1/d,0,0]));
      WZORY.set(klucz,w);}
    return w;
  }
  const filc=c=>wzor(c,"filc",()=>kafelekFilcu("rgba(255,255,255,.2)","rgba(40,20,10,.16)",260));
  const filcKarty=c=>wzor(c,"filcK",()=>kafelekFilcu("rgba(255,235,215,.07)","rgba(0,0,0,.25)",240));
  const cekiny=c=>wzor(c,"cekiny",kafelekCekinow);

  // =========================================================================================== sprite'y
  // Cekin: krążek z dziurką, jasny błysk i ciemniejsza krawędź; dwa kolory (bursztyn, róż).
  const cekin=k=>bufor("kc-cekin|"+k,32,32,c=>{
    const [a,b,e]=k?["#ff8cc0",ROZ,"#7a1145"]:["#ffe7a6",BURSZTYN,"#7a4a10"];
    const g=c.createRadialGradient(11,10,1,16,16,15);g.addColorStop(0,"#ffffff");g.addColorStop(.3,a);g.addColorStop(1,b);
    c.fillStyle=g;c.beginPath();c.arc(16,16,13.5,0,TAU);c.fill();
    c.strokeStyle=e;c.lineWidth=1.4;c.stroke();
    c.fillStyle=e;c.beginPath();c.arc(16,16,2.4,0,TAU);c.fill();
  });
  const blask=k=>bufor("kc-blask|"+k,64,64,c=>{
    const [rgb,rgb2]=k?["236,47,134","236,47,134"]:["242,165,49","242,165,49"];
    const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,"rgba("+rgb+",.42)");g.addColorStop(.5,"rgba("+rgb2+",.2)");g.addColorStop(1,"rgba("+rgb2+",0)");
    c.fillStyle=g;c.fillRect(0,0,64,64);
  });
  const iskra=i=>{const im=obraz("iskra-"+i+".webp");return im?bufor("kc-iskra|"+i,44,44,c=>c.drawImage(im,0,0,44,44)):null;};

  // =========================================================================================== tło
  const tlo={przeswit:.2,rama:{bok:.08,odstep:12},
    tlo:{promienie:[["242,165,49",.14],["236,47,134",.08]],swiatlo:["255,200,120","242,165,49"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle=CZARNY;c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      const g=c.createRadialGradient(W/2,H*.45,Math.min(W,H)*.35,W/2,H*.45,Math.hypot(W,H)*.62);
      g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,.3)");
      c.fillStyle=g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Grafitowa szyba: sama faktura czarnego filcu (włókna), bez rekwizytów; bursztynowy ścieg rysuje gra.
  function fakturaKarty(c,L){
    c.fillStyle=filcKarty(c);c.fillRect(L.x,L.y,L.w,L.h);
  }

  // =========================================================================================== nuty
  // Bursztynowy filc, cekinowy połysk ze stałego wzoru, ciemny obrys i różowe przeszycie przy brzegach.
  const KOLORY_NUT=[BURSZTYN,"#f7b443","#ec9a2a"];
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2;
      c.fillStyle=KOLORY_NUT[(o.ziarno|0)%3];c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=filc(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=cekiny(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.strokeStyle=BURSZTYN_C;c.lineWidth=Math.max(2.4,Math.min(4,nh*.22));c.stroke();
      if(nh>=9&&w>=12){const m=Math.max(3,nh*.22);
        c.beginPath();c.moveTo(x0+m,y0+m);c.lineTo(w/2-m,y0+m);c.moveTo(x0+m,-y0-m);c.lineTo(w/2-m,-y0-m);
        c.setLineDash([3,2.5]);c.strokeStyle=ROZ;c.lineWidth=1.2;c.stroke();c.setLineDash([]);}
    },
    brzeg:()=>BURSZTYN_C,zapas:()=>0};

  // =========================================================================================== klawisze
  // Popielaty filc, czarne klawisze z czarnego filcu z bursztynowym cekinem, bursztynowy ścieg przy brzegu.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(0,0,0,.5)";c.beginPath();c.roundRect(x+2,y0+3,w,h,5);c.fill();
      c.fillStyle=POPIEL;c.beginPath();c.roundRect(x,y0,w,h,5);c.fill();c.fillStyle=filc(c);c.fill();
      c.fillStyle=CZARNY;
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.beginPath();c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,3,3,0]);c.fill();}
      c.fillStyle=filc(c);
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.fillRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2));}
      c.fillStyle="rgba(22,19,20,.4)";
      for(let s=L.dolN;s<=L.goraN;s++){const pc=((s%12)+12)%12;if(isBlack(s)||!(isBlack(s+1)||pc===4||pc===11))continue;
        const k=prostokatKlawisza(L,s);c.fillRect(k.x,Math.round(k.y)-.5,k.w,1);}
      if(L.rh>=6){const p=cekin(0);
        for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s),r=Math.min(k.h*.34,k.w*.1);c.drawImage(p.cv,k.x+k.w*.62-r*2.4,k.y+k.h/2-r,2*r,2*r);}}
      c.strokeStyle=CZARNY;c.lineWidth=2;c.beginPath();c.roundRect(x,y0,w,h,5);c.stroke();
      c.setLineDash([3,2.5]);c.strokeStyle="rgba(180,110,20,.6)";c.lineWidth=1;c.beginPath();c.roundRect(x+3,y0+3,w-6,h-6,3);c.stroke();c.setLineDash([]);
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2;
      c.fillStyle=g.naNucie?"rgba(242,165,49,.85)":"rgba(242,165,49,.5)";c.fillRect(L.kx+1,y+.5,L.kw-2,Math.max(1,L.rh-1));
      c.strokeStyle=CZARNY;c.lineWidth=1.6;c.strokeRect(L.kx+1,y+.5,L.kw-2,Math.max(1,L.rh-1));
    }};

  // =========================================================================================== widownia
  // Fani z fan-*.webp: kolejność z ziarnem bez powtórzeń obok siebie, część odbita, lekko różna skala; skok |sin|
  // na ćwierćnuty z przesuniętymi fazami (pogo), wyżej przy kombo i brawach, w grafice uproszczonej stoją.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=5;
    while(r.length<n){
      const p=[0,1,2,3,4,5];for(let i=5;i>0;i--){const j=Math.floor(los(z,i)*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}z++;
      if(p[0]===ost){const t=p[0];p[0]=p[5];p[5]=t;}
      for(const f of p){if(r.length>=n)break;const k=r.length;r.push({f,lustro:los(k,3)>.5,sk:.88+.12*los(k,4),faza:[0,.5,.25,.75][k%4]+.1*los(k,5)});ost=f;}
    }
    RZAD.set(n,r);return r;
  }
  function fan(i,h,lustro){
    const im=obraz("fan-"+i+".webp");if(!im)return null;
    const w=Math.max(1,Math.round(h*im.naturalWidth/im.naturalHeight));
    return bufor("kc-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{if(lustro){c.translate(w,0);c.scale(-1,1);}c.drawImage(im,0,0,w,h);});
  }
  const podloga=(W,h)=>bufor("kc-podl|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,.5)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      c.drawImage(podloga(W,h).cv,0,Wd.y,W,h);
      const fh=Math.round(h*1.1),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.66)),krok=W/n,R=rzad(n);
      const ruch=!st.spokoj&&!st.bezRuchu,moc=.06+.07*Math.min(1,st.skok||0)+.04*Math.min(3,st.zar||0)+.06*Math.min(1,(st.ap||0)*2);
      for(let i=0;i<n;i++){
        const r=R[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        const hop=ruch?Math.abs(Math.sin(PI*((st.faza||0)+r.faza)))*fh*moc:0;
        Motywy.fan(c,b,krok*(i+.5),Wd.y+h+hh*.1,st,"headbang",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
    }};

  // =========================================================================================== streak
  // Głowa: poświata bursztyn/róż, wianek cekinów migocze i krąży za głową, drobiazgi z iskra-*.webp wylatują w górę
  // (tor z czasu i ziarna, bez alokacji). Ślad: bursztynowa nić z cekinami, które migoczą na zmianę.
  const GRAD=new Map();
  function gradSladu(c,x0,x1){
    const k=Math.round(x0)*1e5+Math.round(x1);let g=GRAD.get(k);
    if(!g){if(GRAD.size>32)GRAD.clear();g=c.createLinearGradient(x0,0,x1,0);g.addColorStop(0,"rgba(242,165,49,0)");g.addColorStop(.8,"rgba(242,165,49,.85)");g.addColorStop(1,"rgba(255,220,140,.5)");GRAD.set(k,g);}
    return g;
  }
  const streak={
    glowa(c,sc,og,ts,z,przod){
      if(przod||!jest())return;
      const rb=sc*(.8+.12*og);
      c.globalAlpha=.5+.15*Math.sin(ts*5);c.drawImage(blask(0).cv,-rb,-sc*.4-rb,2*rb,2*rb);
      c.globalAlpha=.35+.15*Math.sin(ts*3.3+1);c.drawImage(blask(1).cv,-rb*.7,-sc*.55-rb*.7,1.4*rb,1.4*rb);
      const nc=og>=3?10:7,rx=sc*(.62+.05*og),ry=sc*.42;
      for(let j=0;j<nc;j++){   // wianek cekinów: krąży za głową, każdy migocze we własnej fazie
        const a=ts*.9+j/nc*TAU,sn=Math.sin(a);if(sn>.35)continue;   // przód elipsy chowa się za głową
        const migot=.5+.5*Math.sin(ts*9+j*2.3+z),r=sc*(.055+.03*migot);
        c.globalAlpha=.45+.55*migot;c.drawImage(cekin(j%2).cv,Math.cos(a)*rx-r,-sc*.35+sn*ry-r,2*r,2*r);
      }
      const n=og>=3?6:og>=2?4:2;
      for(let j=0;j<n;j++){
        const im=iskra((j+z)%ISKRY);if(!im)continue;
        const p=ul(ts*.45+j/n+los(z,j+20)*.25),a=-PI/2+(los(z,j+9)-.5)*2.4,d=sc*(.5+1*p);
        const s=sc*(.24+.07*los(z,j+13))*(og>=3?1.1:1)*(p<.15?.4+4*p:1);
        c.globalAlpha=p<.1?p*10:1-p*p;c.drawImage(im.cv,Math.cos(a)*d-s/2,-sc*.4+Math.sin(a)*d*.8-s/2,s,s);
      }
      c.globalAlpha=1;
    },
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      c.lineCap="round";c.lineJoin="round";c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.strokeStyle=gradSladu(c,k.x0,k.xT);c.lineWidth=k.og>=3?2.4:1.8;c.setLineDash([5,3]);c.stroke();c.setLineDash([]);
      if(!jest())return;
      const krok=k.og>=3?16:22;let ost=-1e9,nr=0;   // cekiny przyszyte do nici, migoczą na zmianę
      for(const p of pts){if(!p.sp||p.x-ost<krok||p.x<k.x0+k.dlug*.3)continue;ost=p.x;nr++;
        const f=(p.x-k.x0)/k.dlug,m=.5+.5*Math.sin(k.ts*8+nr*1.9),r=2.2+1.6*f+1.2*m;
        c.globalAlpha=Math.min(1,f*1.4)*(.5+.5*m);c.drawImage(cekin(nr%2).cv,p.x-r,p.y-r+(nr%2?-3:3),2*r,2*r);}
      c.globalAlpha=1;
    },
    // płonąca nuta: zaśpiewana część mieni się różowymi i złotymi cekinami
    nuty(c,w,nh,fx){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(236,47,134,.35)";c.fillRect(x0,-nh/2,fx-x0,nh);c.fillStyle=cekiny(c);c.fillRect(x0,-nh/2,fx-x0,nh);}
    },
    rozgrzej(){if(!jest())return;try{cekin(0);cekin(1);blask(0);blask(1);for(let i=0;i<ISKRY;i++)iskra(i);}catch(e){}},
    aura:[BURSZTYN,ROZ],wypelnienie:["#ffe7a6",BURSZTYN,ROZ],
    iskry:{kolory:[BURSZTYN,ROZ,"#8a1a50"],ksztalt:"kolo"},dym:false,
    scena:["255,214,140","242,165,49","236,47,134"],
    tlo:{promienie:[["242,165,49",.14],["236,47,134",.08]],swiatlo:["255,200,120","242,165,49"]}};

  Motywy.dodaj({id:"koncert",nazwa:"Koncert",kolejnosc:6,kolor:"#f2a531",zasoby:ZASOBY,zaba:true,przebranie:true,
    opis:"Scena rockowa z czarnego filcu: reflektory i kolumny, grafitowe karty z bursztynowym ściegiem, nuty z filcu z cekinami, punkowa widownia i wianek cekinów przy kombo.",
    cechy:{tlo:"scena z filcu",klawisze:"popielaty filc i cekiny",streak:"cekinowe iskry",widownia:"punkowa widownia"},
    en:{nazwa:"Concert",
      opis:"A rock stage of black felt: spotlights and speakers, graphite cards with amber stitching, felt notes with sequins, a punk crowd and a ring of sequins on a combo.",
      cechy:{tlo:"felt stage",klawisze:"grey felt and sequins",streak:"sequin sparks",widownia:"punk crowd"}},
    karta:{papier:GRAFIT,cien:"rgba(0,0,0,.3)",czarne:"rgba(0,0,0,.18)",liniaC:"rgba(255,226,196,.14)",minione:"rgba(0,0,0,.22)",
      nazwy:"rgba(255,232,206,.72)",kreski:"rgba(255,214,170,.16)",nic:ROZ,szpilka:BURSZTYN,szpilkaBlask:"#fff3d1",
      cienNuty:"rgba(0,0,0,.5)",scieg:"rgba(242,165,49,.5)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
