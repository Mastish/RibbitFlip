// Motyw „Komiks” (runda 2, 10-09 wieczór): komiks z filcowych aplikacji. Ilustracja dachów miasta (tlo.webp) na cały
// ekran, karta toru to kremowa szyba z tkaniny w kropki rastra i konturem z czarnej nici (jak tusz w kadrze). Nuty to
// płaskie paski filcu (cyjan, ciepły żółty, pomidorowa czerwień) z grubym czarnym obrysem i przeszyciem. Klawiatura z
// kremowego filcu, czarne klawisze z czarnego filcu. Widownia: sześciu fanów-superbohaterów (fan-*.webp) skacze w rytm.
// Streak: filcowa gwiazda-wybuch za głową, wylatujące drobiazgi z iskra-*.webp, ślad z nici jak linie ruchu.
// Celowo bez napisów (POW, ZIP, WOW): wyglądały tandetnie. Wszystko stałe w bufor(), w klatce drawImage.
(function(){
  "use strict";
  const ID="komiks",PI=Math.PI,TAU=2*PI;
  const TUSZ="#211f1d",KREM="#f6ecd4",ZOLTY="#f5c13a",CZERW="#e2492f",CYJAN="#2ea7d6";
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
    let s=987654321;const r=()=>(s=(Math.imul(s,1103515245)+12345)>>>0)/4294967296;
    x.lineCap="round";
    for(let i=0;i<ile;i++){
      const px=r()*96,py=r()*96,a=r()*TAU,l=2+r()*5,lw=.5+r()*.7;
      x.strokeStyle=i%2?jasne:ciemne;x.lineWidth=lw;x.beginPath();
      for(const [dx,dy] of [[0,0],[-96,0],[0,-96],[-96,-96]]){x.moveTo(px+dx,py+dy);x.lineTo(px+dx+Math.cos(a)*l,py+dy+Math.sin(a)*l);}
      x.stroke();
    }
    return cv;
  }
  // Raster: kropki w siatce przesuniętej co rząd (tkanina w kropki), kafelek krok×krok.
  function kafelekRastra(kolor,krok,r){
    const d=4,cv=document.createElement("canvas");cv.width=cv.height=krok*d;const x=cv.getContext("2d");
    x.scale(d,d);x.fillStyle=kolor;x.beginPath();x.arc(krok/2,krok/2,r,0,TAU);
    for(const [a,b] of [[0,0],[krok,0],[0,krok],[krok,krok]]){x.moveTo(a+r,b);x.arc(a,b,r,0,TAU);}
    x.fill();
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
  const filc=c=>wzor(c,"filc",()=>kafelekFilcu("rgba(255,255,255,.22)","rgba(33,31,29,.14)",260));
  const filcKarty=c=>wzor(c,"filcK",()=>kafelekFilcu("rgba(255,255,255,.4)","rgba(120,90,40,.07)",160));
  const kropki=c=>wzor(c,"kropki",()=>kafelekRastra("rgba(46,167,214,.13)",9,1.6));
  const raster=c=>wzor(c,"rasterC",()=>kafelekRastra("rgba(226,73,47,.5)",5,1.4));

  // =========================================================================================== sprite'y
  // Gwiazda-wybuch: n kolców o nierównej długości (z ziarna), środek w (0,0).
  function gwiazda(c,n,r0,r1,z){
    c.beginPath();
    for(let i=0;i<n*2;i++){const a=i/(n*2)*TAU-PI/2,r=i%2?r0*(.85+.3*los(z,i)):r1*(.8+.4*los(z,i+40));
      const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i)c.lineTo(x,y);else c.moveTo(x,y);}
    c.closePath();
  }
  // Filcowa aplikacja wybuchu: żółty filc z czarną nicią, w środku czerwona gwiazda z kremowym przeszyciem.
  const wybuch=()=>bufor("km-wybuch",120,120,c=>{
    c.translate(60,60);c.lineJoin="round";
    gwiazda(c,12,30,56,3);c.fillStyle=ZOLTY;c.fill();c.fillStyle=filc(c);c.fill();
    c.strokeStyle=TUSZ;c.lineWidth=3.2;c.stroke();
    gwiazda(c,10,17,33,9);c.fillStyle=CZERW;c.fill();c.fillStyle=filc(c);c.fill();
    c.strokeStyle=TUSZ;c.lineWidth=2.2;c.stroke();
    c.save();c.scale(.82,.82);gwiazda(c,10,17,33,9);c.restore();
    c.setLineDash([3,2.6]);c.strokeStyle=KREM;c.lineWidth=1.2;c.stroke();c.setLineDash([]);
  });
  const blask=()=>bufor("km-blask",64,64,c=>{
    const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,"rgba(245,193,58,.42)");g.addColorStop(.5,"rgba(245,193,58,.2)");g.addColorStop(1,"rgba(245,193,58,0)");
    c.fillStyle=g;c.fillRect(0,0,64,64);
  });
  const iskra=i=>{const im=obraz("iskra-"+i+".webp");return im?bufor("km-iskra|"+i,44,44,c=>c.drawImage(im,0,0,44,44)):null;};

  // =========================================================================================== tło
  const BOK=.075;
  const tlo={przeswit:.18,rama:{bok:BOK,odstep:12},
    tlo:{promienie:[["245,193,58",.16],["46,167,214",.1]],swiatlo:["255,240,190","245,193,58"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#efe2c6";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.62);
      // lekka winieta: kremowy środek zostaje, brzegi minimalnie ciemniejsze (karty odcinają się od ramy)
      const g=c.createRadialGradient(W/2,H*.45,Math.min(W,H)*.35,W/2,H*.45,Math.hypot(W,H)*.62);
      g.addColorStop(0,"rgba(33,31,29,0)");g.addColorStop(1,"rgba(33,31,29,.22)");
      c.fillStyle=g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Kremowa szyba: tkanina w cyjanowe kropki rastra, drobne włókna i kontur z czarnej nici przy brzegu (jak ramka kadru).
  function fakturaKarty(c,L){
    c.fillStyle=kropki(c);c.fillRect(L.x,L.y,L.w,L.h);
    c.fillStyle=filcKarty(c);c.fillRect(L.x,L.y,L.w,L.h);
    c.strokeStyle=TUSZ;c.lineWidth=4;c.beginPath();c.roundRect(L.x+2,L.y+2,L.w-4,L.h-4,15);c.stroke();
  }

  // =========================================================================================== nuty
  // Płaski filc w trzech kolorach, gruby czarny obrys (ścieżka taśmy jest przycięciem: obrys idzie do środka)
  // i przeszycie czarną nicią tuż przy brzegu. ≤ 10 wywołań, wzór z pamięci.
  const KOLORY_NUT=[CYJAN,ZOLTY,CZERW];
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2;
      c.fillStyle=KOLORY_NUT[(o.ziarno|0)%3];c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=filc(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.strokeStyle=TUSZ;c.lineWidth=Math.max(3,Math.min(5,nh*.28));c.stroke();
      if(nh>=9&&w>=12){const m=Math.max(3.2,nh*.24);
        c.beginPath();c.moveTo(x0+m,y0+m);c.lineTo(w/2-m,y0+m);c.moveTo(x0+m,-y0-m);c.lineTo(w/2-m,-y0-m);
        c.setLineDash([3,2.5]);c.strokeStyle="rgba(33,31,29,.7)";c.lineWidth=1.1;c.stroke();c.setLineDash([]);}
    },
    brzeg:()=>TUSZ,zapas:()=>0};

  // =========================================================================================== klawisze
  // Kremowy filc z czarnym konturem nici, czarne klawisze z czarnego filcu; śpiewany klawisz: żółta łatka.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(33,31,29,.35)";c.beginPath();c.roundRect(x+3,y0+3,w,h,5);c.fill();
      c.fillStyle=KREM;c.beginPath();c.roundRect(x,y0,w,h,5);c.fill();c.fillStyle=filc(c);c.fill();
      c.fillStyle="#2a2624";
      for(let s=L.dolN;s<=L.goraN;s++){const k=prostokatKlawisza(L,s);
        if(isBlack(s)){c.beginPath();c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,3,3,0]);c.fill();}}
      c.fillStyle=filc(c);
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.fillRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2));}
      c.fillStyle="rgba(33,31,29,.45)";
      for(let s=L.dolN;s<=L.goraN;s++){const pc=((s%12)+12)%12;if(isBlack(s)||!(isBlack(s+1)||pc===4||pc===11))continue;
        const k=prostokatKlawisza(L,s);c.fillRect(k.x,Math.round(k.y)-.6,k.w,1.2);}
      c.strokeStyle=TUSZ;c.lineWidth=2.6;c.beginPath();c.roundRect(x,y0,w,h,5);c.stroke();
      c.setLineDash([3,2.5]);c.strokeStyle="rgba(33,31,29,.55)";c.lineWidth=1;c.beginPath();c.roundRect(x+3.5,y0+3.5,w-7,h-7,3);c.stroke();c.setLineDash([]);
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2;
      c.fillStyle=g.naNucie?"rgba(245,193,58,.85)":"rgba(245,193,58,.5)";c.fillRect(L.kx+1,y+.5,L.kw-2,Math.max(1,L.rh-1));
      c.strokeStyle=TUSZ;c.lineWidth=2;c.strokeRect(L.kx+1,y+.5,L.kw-2,Math.max(1,L.rh-1));
    }};

  // =========================================================================================== widownia
  // Fani z fan-*.webp: kolejność z ziarnem bez powtórzeń obok siebie, co drugi odbity, lekko różna skala; skok |sin|
  // na ćwierćnuty z przesuniętymi fazami, wyżej przy kombo i brawach, w grafice uproszczonej stoją.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=7;
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
    return bufor("km-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{if(lustro){c.translate(w,0);c.scale(-1,1);}c.drawImage(im,0,0,w,h);});
  }
  const podloga=(W,h)=>bufor("km-podl|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(33,31,29,0)");g.addColorStop(1,"rgba(33,31,29,.32)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      c.drawImage(podloga(W,h).cv,0,Wd.y,W,h);
      const fh=Math.round(h*1.08),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.82)),krok=W/n,R=rzad(n);
      const ruch=!st.spokoj&&!st.bezRuchu,moc=.05+.06*Math.min(1,st.skok||0)+.035*Math.min(3,st.zar||0)+.06*Math.min(1,(st.ap||0)*2);
      for(let i=0;i<n;i++){
        const r=R[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        const hop=ruch?Math.abs(Math.sin(PI*((st.faza||0)+r.faza)))*fh*moc:0;
        Motywy.fan(c,b,krok*(i+.5),Wd.y+h+hh*.1,st,"pop",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
    }};

  // =========================================================================================== streak
  // Głowa: filcowa gwiazda-wybuch za głową (obrót i puls), poświata z bufora i drobiazgi z iskra-*.webp wylatujące
  // wachlarzem (tor z czasu i ziarna, bez alokacji: ≤ 10 naraz). Ślad: pasek czerwonego filcu i linie ruchu z czarnej nici.
  const GRAD=new Map();
  function gradSladu(c,x0,xT){
    const kl=Math.round(x0)*1e5+Math.round(xT);let g=GRAD.get(kl);
    if(!g){if(GRAD.size>32)GRAD.clear();
      const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(33,31,29,0)");a.addColorStop(.8,"rgba(33,31,29,.85)");a.addColorStop(1,"rgba(33,31,29,.3)");
      const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(226,73,47,0)");b.addColorStop(.85,"rgba(226,73,47,.9)");b.addColorStop(1,"rgba(226,73,47,.4)");
      g={a,b};GRAD.set(kl,g);}
    return g;
  }
  const streak={
    glowa(c,sc,og,ts,z,przod){
      if(przod||!jest())return;
      const bl=blask(),rb=sc*(.75+.12*og);
      c.globalAlpha=.55+.15*Math.sin(ts*6);c.drawImage(bl.cv,-rb,-sc*.4-rb,2*rb,2*rb);c.globalAlpha=1;
      const b=wybuch(),r=sc*(.42+.06*og)*(1+.05*Math.sin(ts*8));
      c.save();c.translate(0,-sc*.4);c.rotate(ts*.35+z);c.drawImage(b.cv,-r,-r,2*r,2*r);c.restore();
      const n=og>=3?10:og>=2?7:4;
      for(let j=0;j<n;j++){
        const im=iskra((j+z)%ISKRY);if(!im)continue;
        const p=ul(ts*.55+j/n+los(z,j)*.25),a=-PI/2+(los(z,j+9)-.5)*2.6,d=sc*(.5+1*p);
        const s=sc*(.2+.07*los(z,j+3))*(og>=3?1.15:1)*(p<.15?.4+4*p:1);
        c.globalAlpha=p<.1?p*10:1-p*p;c.drawImage(im.cv,Math.cos(a)*d-s/2,-sc*.4+Math.sin(a)*d*.8-s/2,s,s);
      }
      c.globalAlpha=1;
    },
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),dy=k.og>=3?6:4.5;
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.lineCap="round";c.lineJoin="round";c.strokeStyle=g.b;c.lineWidth=k.og>=3?5:3.5;c.stroke();
      // linie ruchu: krótkie przeszycia czarną nicią nad i pod torem lotu
      c.beginPath();let ost=-1e9,nr=0;
      for(const p of pts){if(!p.sp||p.x-ost<7||p.x<k.x0)continue;ost=p.x;nr++;
        const o=((nr*3)%5-2)*dy;if(o===0)continue;
        const len=8+20*los(nr,k.ziarno);c.moveTo(p.x-len,p.y+o);c.lineTo(p.x,p.y+o);}
      c.setLineDash([4,3]);c.strokeStyle=g.a;c.lineWidth=k.og>=3?1.8:1.4;c.lineCap="butt";c.stroke();c.setLineDash([]);
    },
    // płonąca nuta: czerwony raster (tkanina w kropki) na tym, co już zaśpiewane
    nuty(c,w,nh,fx){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle=raster(c);c.fillRect(x0,-nh/2,fx-x0,nh);}
    },
    rozgrzej(){if(!jest())return;try{wybuch();blask();for(let i=0;i<ISKRY;i++)iskra(i);}catch(e){}},
    aura:[ZOLTY,CZERW],wypelnienie:["#fff2b0",ZOLTY,CZERW],iskry:{kolory:[ZOLTY,CZERW,CYJAN],ksztalt:"gwiazda"},dym:false,
    scena:["245,193,58","226,73,47","46,167,214"],
    tlo:{promienie:[["245,193,58",.16],["46,167,214",.1]],swiatlo:["255,240,190","245,193,58"]}};

  Motywy.dodaj({id:"komiks",nazwa:"Komiks",kolejnosc:4,kolor:"#f5c13a",zasoby:ZASOBY,zaba:true,przebranie:true,
    opis:"Komiks z filcowych aplikacji: dachy miasta, karta z tkaniny w kropki z konturem z czarnej nici, nuty z płaskiego filcu, superbohaterowie na widowni i filcowy wybuch przy kombo.",
    cechy:{tlo:"dachy miasta z filcu",klawisze:"filc i czarna nić",streak:"filcowy wybuch",widownia:"superbohaterowie"},
    en:{nazwa:"Comic",
      opis:"A comic made of felt appliqué: city rooftops, a polka-dot fabric card outlined in black thread, flat felt notes, superheroes in the crowd and a felt explosion on a combo.",
      cechy:{tlo:"felt city rooftops",klawisze:"felt and black thread",streak:"felt explosion",widownia:"superheroes"}},
    karta:{papier:"#f7eedb",cien:"rgba(33,31,29,.22)",czarne:"rgba(33,31,29,.06)",liniaC:"rgba(33,31,29,.3)",minione:"rgba(120,100,70,.10)",
      nazwy:"rgba(33,31,29,.8)",kreski:"rgba(33,31,29,.28)",nic:CZERW,szpilka:TUSZ,szpilkaBlask:ZOLTY,
      cienNuty:"rgba(33,31,29,.5)",scieg:"rgba(33,31,29,.5)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
