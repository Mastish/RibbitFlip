// Motyw 1 „Filc” (start, przebudowa 10-09 wieczór): wizytówka marki, cały ekran jak logo z filcu. Tło = filcowa scena
// klubowa (tlo.webp: kurtyny, wzmacniacze, girlanda z pomponów), karta toru = kremowa szyba z włóknami filcu i ciemniejszym
// rąbkiem przyciętego materiału, nuty = paski zielonego filcu przyszyte kremową nicią, klawiatura z kremowego i czarnego
// filcu z różowym ściegiem. Widownia: sześciu punkowych fanów z fan-*.webp podskakuje w rytm. Streak: trzy filcowe
// płomyki za głową żaby (róż, krem, ścieg), różowa filcowa wstążka ze ściegiem jako ślad i naszywki z iskra-*.webp.
// Wszystko z buforów (bufor() gry, kafle włókien i wzory raz), w klatce same drawImage i kilka obrysów.
(function(){
  "use strict";
  const ID="filc",PI=Math.PI,TAU=2*PI;
  const ROZ="#ec1a83",ROZ_C="#a3105a",KREM="#fbf1dc",KREM_C="#d9c29a",TUSZ="#211f1d",ZIEL="#6aa83a",ZIEL_C="#2f5418",BURSZ="#f5a524";
  const los=(a,b)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v);};   // 0..1, powtarzalne
  const ulamek=x=>x-Math.floor(x);
  const BRAK=[];   // pusta kreska (setLineDash) bez nowej tablicy w klatce
  const zasob=p=>Motywy.zasob(ID,p);
  const ZASOBY=["tlo.webp","zaba-0.webp","zaba-1.webp"];
  for(let i=0;i<6;i++)ZASOBY.push("fan-"+i+".webp","iskra-"+i+".webp");

  // ---- kafel włókien filcu: krótkie włoski w dwóch tonach, zawinięte na brzegach (bez szwu kafla); raz na klucz ----
  const KAF=new Map();
  function kafelWlokien(klucz,jasne,ciemne,n){
    let cv=KAF.get(klucz);if(cv)return cv;
    const R0=128;cv=document.createElement("canvas");cv.width=cv.height=R0;const c=cv.getContext("2d");
    c.lineCap="round";
    for(const [kol,off,gr] of [[ciemne,0,.7],[jasne,1,.6],[ciemne,2,1.1]]){
      c.strokeStyle=kol;c.lineWidth=gr;c.beginPath();
      for(let i=off;i<n;i+=3){
        const x=los(i,1)*R0,y=los(i,2)*R0,a=los(i,3)*TAU,l=2+los(i,4)*(off===2?3:6),dx=Math.cos(a)*l,dy=Math.sin(a)*l;
        for(const ox of [0,-R0])for(const oy of [0,-R0]){c.moveTo(x+ox,y+oy);c.quadraticCurveTo(x+ox+dx*.5+dy*.2,y+oy+dy*.5-dx*.2,x+ox+dx,y+oy+dy);}
      }
      c.stroke();
    }
    KAF.set(klucz,cv);return cv;
  }
  const kafelKarty=()=>kafelWlokien("karta","rgba(255,255,255,.4)","rgba(150,110,60,.09)",1200);
  const kafelNuty=()=>kafelWlokien("nuta","rgba(220,245,190,.28)","rgba(20,50,10,.22)",700);
  let WZOR_NUTY=null;   // wzór włókien na taśmy (gorąca ścieżka: tworzony raz)
  const wzorNuty=c=>WZOR_NUTY||(WZOR_NUTY=c.createPattern(kafelNuty(),"repeat"));
  // przerywana nić: długości ściegu zależne od wysokości taśmy, tablice z pamięci podręcznej
  const KRESKI=new Map();
  function kreska(d){const k=Math.round(d*2);let a=KRESKI.get(k);if(!a){a=[Math.max(2,k*.9),Math.max(1.5,k*.55)];KRESKI.set(k,a);}return a;}

  // ---- tło: ilustracja na cały ekran + ciepła winieta (gradient raz na rozmiar) ----
  let WIN=null;
  function rysujTlo(c,st){
    const W=st.W,H=st.H;
    if(!Motywy.cover(c,zasob("tlo.webp"),0,0,W,H,.5,.7)){c.fillStyle="#e9d4ae";c.fillRect(0,0,W,H);}
    if(!WIN||WIN.W!==W||WIN.H!==H){
      const g=c.createRadialGradient(W/2,H*.45,Math.min(W,H)*.32,W/2,H*.5,Math.hypot(W,H)*.62);
      g.addColorStop(0,"rgba(60,30,10,0)");g.addColorStop(1,"rgba(60,30,10,.32)");WIN={W,H,g};
    }
    c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
  }

  // ---- karta: kremowa szyba z włóknami filcu i ciemniejszym rąbkiem przyciętego materiału ----
  function rysujKarte(c,L){
    c.fillStyle=c.createPattern(kafelKarty(),"repeat");c.fillRect(L.x,L.y,L.w,L.h);
    c.strokeStyle="rgba(150,100,50,.2)";c.lineWidth=6;c.beginPath();c.roundRect(L.x,L.y,L.w,L.h,16);c.stroke();
  }

  // ---- nuty: pasek zielonego filcu przyszyty kremową nicią wzdłuż górnej krawędzi ----
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2;
      c.fillStyle=ZIEL;c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=wzorNuty(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(w<nh*1.2)return;
      const m=Math.max(2.5,nh*.24);
      c.strokeStyle=KREM;c.lineWidth=Math.max(1,nh*.09);c.setLineDash(kreska(Math.max(2,nh*.22)));
      c.lineDashOffset=(o.ziarno|0)%3;
      c.beginPath();c.moveTo(x0+m,y0+m);c.lineTo(-x0-m,y0+m);c.stroke();
      c.setLineDash(BRAK);c.lineDashOffset=0;
    },
    brzeg:()=>ZIEL_C,zapas:()=>0};

  // ---- klawiatura: kremowy filc, czarne klawisze z czarnego filcu, różowy ścieg wokół ----
  function klawiatura(c,L){
    const x=L.kx,y0=L.gorna,w=L.kw,h=L.rzedy*L.rh;
    c.fillStyle="rgba(70,40,15,.25)";c.beginPath();c.roundRect(x+2,y0+3,w,h,5);c.fill();
    c.beginPath();c.roundRect(x,y0,w,h,5);c.fillStyle=KREM;c.fill();
    c.fillStyle=c.createPattern(kafelKarty(),"repeat");c.fill();
    c.fillStyle="rgba(120,85,45,.3)";
    for(let s=L.dolN;s<=L.goraN;s++){
      if(isBlack(s))continue;
      const pc=((s%12)+12)%12;
      if(isBlack(s+1)||pc===4||pc===11){const k=prostokatKlawisza(L,s);c.fillRect(x+2,Math.round(k.y)-.5,w-4,1);}
    }
    c.fillStyle="#2a2522";c.beginPath();
    for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.8,k.w*.62,Math.max(1,k.h-1.6),[0,3,3,0]);}
    c.fill();
    c.strokeStyle="rgba(255,255,255,.18)";c.lineWidth=1;c.stroke();
    c.strokeStyle=ROZ;c.lineWidth=1.3;c.setLineDash([3.5,2.5]);
    c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,3);c.stroke();c.setLineDash(BRAK);
    c.strokeStyle="rgba(60,35,15,.55)";c.lineWidth=1.2;c.beginPath();c.roundRect(x,y0,w,h,5);c.stroke();
  }
  const SCIEG_KL=[3,2.5];
  function klawiszGracza(c,L,g){
    if(!g.spiewa)return;
    const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),k=prostokatKlawisza(L,s);
    c.strokeStyle=g.naNucie?KREM:"rgba(251,241,220,.6)";c.lineWidth=1.4;c.setLineDash(SCIEG_KL);
    c.strokeRect(k.x+2.5,k.y+1.5,k.w-5,Math.max(1,k.h-3));c.setLineDash(BRAK);
  }

  // ---- widownia: fani z fan-*.webp, kolejność bez sąsiadów-bliźniaków, lustrzane odbicia, skok w rytm ----
  const CROP=[null,null,[0,205],null,null,null];   // fan-2 ma na prawym brzegu skrawek sąsiedniej postaci
  function fan(k,lustro,fh){
    const im=zasob("fan-"+k+".webp");if(!im)return null;
    const cr=CROP[k]||[0,im.naturalWidth],sw=cr[1]-cr[0],fw=Math.max(1,Math.round(fh*sw/im.naturalHeight));
    return bufor(ID+"-fan|"+k+"|"+(lustro?1:0)+"|"+fh,fw,fh,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(fw,0);c.scale(-1,1);}
      c.drawImage(im,cr[0],0,sw,im.naturalHeight,0,0,fw,fh);
    });
  }
  let KOLEJ=null;
  function kolejnosc(n){
    if(KOLEJ&&KOLEJ.length===n)return KOLEJ;
    const a=[];let p1=-1,p2=-1;
    for(let i=0;i<n;i++){
      let k=Math.floor(los(i,7)*6);for(let t=0;t<6&&(k===p1||k===p2);t++)k=(k+1)%6;
      a.push({k,lustro:los(i,8)<.5,sk:.88+.2*los(i,9),fa:los(i,10),dx:(los(i,11)-.5)*.3});p2=p1;p1=k;
    }
    KOLEJ=a;return a;
  }
  function rysujWidownie(c,Wd,st){
    const W=st.W,h=Wd.h*1.1,n=Math.max(3,Motywy.ileFanow(ID,W,h,.78)),q=kolejnosc(n),krok=W/n;
    const ruch=!st.bezRuchu&&!st.spokoj&&!st.mini,zywe=st.spiewaja||st.zar>.05||st.ap>.12;
    const amp=ruch?h*((zywe?.05+.035*Math.min(3,st.zar||0):.012)+.16*(st.skok||0)):0;
    for(let i=0;i<n;i++){
      const s=q[i],fh=Math.round(h*s.sk),b=fan(s.k,s.lustro,fh);if(!b)continue;
      const dy=amp?amp*Math.abs(Math.sin(PI*(st.faza+s.fa))):0;
      Motywy.fan(c,b,krok*(i+.5+s.dx),Wd.y+Wd.h+fh*.12,st,"skok",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
    }
  }

  // ---- streak: filcowe płomyki (róż, kremowy środek, ścieg), wstążka ze ściegiem, naszywki z iskra-*.webp ----
  // Płomyk w buforze 72×96: czarny podkład naszywki, różowy filc, kremowy środek, przerywana nić, włókna.
  // Obrys płomyka z punktów kontrolnych (języki po bokach, czubek), wygładzony krzywymi przez środki odcinków.
  const KSZT=[[0,.03],[.62,-.04],[.7,-.36],[.4,-.56],[.72,-.84],[.2,-.7],[.06,-1.08],[-.2,-.64],[-.6,-.76],[-.46,-.44],[-.7,-.24],[-.56,-.02]];
  function sciezkaPlomyka(c,cx,yb,w,h,lustro){
    const a=w/2*(lustro?-1:1),n=KSZT.length,X=i=>cx+KSZT[i%n][0]*a,Y=i=>yb+KSZT[i%n][1]*h;
    c.beginPath();c.moveTo((X(n-1)+X(0))/2,(Y(n-1)+Y(0))/2);
    for(let i=0;i<n;i++)c.quadraticCurveTo(X(i),Y(i),(X(i)+X(i+1))/2,(Y(i)+Y(i+1))/2);
    c.closePath();
  }
  function rysujPlomyk(c,v,kol){   // kol = [podkład, filc, środek, nić]; v: 0, 1 (lustro), 2 (smuklejszy)
    const l=v===1,sz=v===2?.86:1;
    c.lineJoin="round";
    sciezkaPlomyka(c,36,92,62*sz,88,l);c.strokeStyle=kol[0];c.lineWidth=5;c.stroke();c.fillStyle=kol[1];c.fill();
    c.save();c.clip();c.fillStyle=c.createPattern(kafelNuty(),"repeat");c.fillRect(0,0,72,96);c.restore();
    sciezkaPlomyka(c,36,86,30*sz,46,!l);c.fillStyle=kol[2];c.fill();
    sciezkaPlomyka(c,36,88,50*sz,74,l);c.strokeStyle=kol[3];c.lineWidth=1.6;c.setLineDash([4,3]);c.stroke();c.setLineDash(BRAK);
  }
  const PLOM=[TUSZ,ROZ,KREM,"#ffd1e6"];
  const plomyk=v=>bufor(ID+"-plom|"+v,72,96,c=>rysujPlomyk(c,v,PLOM));
  function iskra(k){
    const im=zasob("iskra-"+k+".webp");if(!im)return null;
    return bufor(ID+"-isk|"+k,44,44,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,44,44);});
  }
  const GR=new Map();
  function gradSladu(c,x0,xT){
    const kl=Math.round(x0)*16384+Math.round(xT);let g=GR.get(kl);if(g)return g;
    if(GR.size>24)GR.clear();
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(236,26,131,0)");a.addColorStop(.75,"rgba(236,26,131,.85)");a.addColorStop(1,"rgba(236,26,131,.95)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(251,241,220,0)");b.addColorStop(.75,"rgba(251,241,220,.9)");b.addColorStop(1,"rgba(251,241,220,1)");
    g={a,b};GR.set(kl,g);return g;
  }
  const SCIEG_SLADU=[5,4];
  const streak={
    // za głową: trzy płomyki (boczne niższe) kołyszą się, z nich wylatują naszywki (≤ 9 naraz)
    glowa(c,sc,og,ts,z,przod){
      if(przod)return;
      for(const j of [0,2,1]){
        const b=plomyk(j),s=sc*(j===1?.62:.42)*(.86+.07*og),f=1+.08*Math.sin(ts*7.3+j*2.1+z);
        const hh=s*f,ww=s*.75/f;
        c.drawImage(b.cv,(j-1)*sc*.27-ww/2,-sc*(j===1?.42:.36)-hh,ww,hh);
      }
      const n=og>=3?9:5;
      for(let j=0;j<n;j++){
        const u=ts*.55+j/n+z*.17,ph=ulamek(u),b=iskra((j*5+Math.floor(u))%6);if(!b)continue;
        const kier=j%3===0?-.45:1,s=sc*(.2+.04*og)*(1-.35*ph);
        const x=-kier*sc*(.12+.9*ph)+Math.sin(ts*2.3+j)*sc*.08,y=-sc*(.5+1.35*ph);
        c.globalAlpha=ph<.1?ph*10:Math.max(0,1-Math.pow((ph-.1)/.9,1.6));
        c.drawImage(b.cv,x-s/2,y-s/2,s,s);
      }
      c.globalAlpha=1;
    },
    // ślad: różowa filcowa wstążka z kremowym ściegiem, przy ogniu ≥ 2 małe płomyki na świeżym końcu
    slad(c,k){
      const g=gradSladu(c,k.x0,k.xT);
      c.beginPath();let pi=false;
      for(const p of k.pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.lineCap="round";c.lineJoin="round";
      c.strokeStyle=g.a;c.lineWidth=k.og>=3?11:k.og>=2?9:6;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=1.4;c.setLineDash(SCIEG_SLADU);c.stroke();c.setLineDash(BRAK);
      if(!k.pelna||k.og<2)return;
      let ost=-1e9,nr=0;const krok=k.og>=3?22:30;
      for(const p of k.pts){
        if(!p.sp||p.x-ost<krok||p.x<k.x0)continue;ost=p.x;
        const f=(p.x-k.x0)/k.dlug;if(f<.4||f>.94)continue;
        if(++nr>8)break;
        const b=plomyk(nr%3),hh=(k.og>=3?24:17)*f*(.8+.2*Math.sin(k.ts*8+nr*1.7)),ww=hh*.75;
        c.drawImage(b.cv,p.x-ww/2,p.y-hh+3,ww,hh);
      }
    },
    // płonąca nuta: ciepły róż na przejechanej części, płomyk na froncie
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(236,26,131,.26)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas>.05&&fx>x0+nh){
        const b=plomyk(z%3),hh=nh*(1.3+.4*(poziom||1)/3)*(.9+.1*Math.sin(ts*9+z)),ww=hh*.75;
        c.globalAlpha=Math.min(1,gas);c.drawImage(b.cv,fx-ww/2,-nh/2-hh*.75,ww,hh);c.globalAlpha=1;
      }
    },
    rozgrzej(){for(let v=0;v<3;v++)plomyk(v);for(let k=0;k<6;k++)iskra(k);},
    aura:[ROZ,BURSZ],wypelnienie:["#fff1d6","#ffb0d4",ROZ],scena:["245,165,36","245,165,36","236,26,131"],
    iskry:{kolory:["#ffd84a",BURSZ,ROZ]},dym:false,
    tlo:{promienie:[["255,240,214",.2],["236,26,131",.08]],swiatlo:["255,238,210","245,200,150"]}};

  Motywy.dodaj({id:"filc",nazwa:"Filc",kolejnosc:1,kolor:"#e9d4ae",zaba:true,zasoby:ZASOBY,
    opis:"Filcowa scena klubowa jak z logo: kremowa karta ze ściegiem, nuty z pasków zielonego filcu przyszytych nicią, punkowe żaby na widowni i filcowe płomyki przy kombo.",
    cechy:{tlo:"filcowa scena klubowa",klawisze:"filc ze ściegiem",streak:"filcowe płomyki",widownia:"punkowe żaby"},
    en:{nazwa:"Felt",
      opis:"A felt club stage straight from the logo: a cream card with stitching, notes made of green felt strips sewn on with thread, punk frogs in the crowd and felt flames on a combo.",
      cechy:{tlo:"felt club stage",klawisze:"stitched felt",streak:"felt flames",widownia:"punk frogs"}},
    karta:{papier:"#f7ecd6",cien:"rgba(70,40,15,.3)",czarne:"rgba(90,60,30,.06)",liniaC:"rgba(110,75,35,.2)",minione:"rgba(190,160,120,.2)",
      nazwy:"rgba(80,55,30,.75)",kreski:"rgba(130,90,45,.3)",nic:ROZ,szpilka:TUSZ,szpilkaBlask:KREM,
      cienNuty:"rgba(60,35,10,.3)",scieg:"rgba(236,26,131,.7)",rysuj:rysujKarte},
    tlo:{rysuj2d:rysujTlo,przeswit:.24,rama:{bok:.05,gora:10,dol:6,odstep:8},tlo:streak.tlo},
    klawisze:{tlo(c,L){klawiatura(c,L);},gracz:klawiszGracza},
    nuty,
    streak,
    widownia:{rysuj:rysujWidownie}});
})();
