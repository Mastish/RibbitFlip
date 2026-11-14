// Motyw „Szkicownik” (runda 2, 10-09 wieczór): scrapbook DIY. Tło to ilustracja (rozłożony zeszyt z taśmami washi,
// filcowymi naklejkami i rysunkami ołówkiem), karta toru jasna szyba z kremowego papieru w kratkę, taśmy nut jak
// paski taśmy washi (nasycony kolor, półprzezroczysty wzór, poszarpane końce, grafitowy obrys dla kontrastu),
// klawiatura rysowana ołówkiem (kreskowane czarne klawisze). Widownia: sześć filcowych żab-naklejek (fan-0..5)
// skacze w rytm. Streak: bazgroł ołówkiem i zakreślacz za głową, ślad zakreślaczem z kreską ołówka, z głowy lecą
// filcowe naklejki i spinacze (iskra-0..5).
(function(){
  "use strict";
  const ID="szkicownik",PI=Math.PI,TAU=2*PI;
  const GRAF="#3b3833",PAPIER="#f8f1e0",KREM="#fbf6ea",ROZ="#e8457f",ZAKR="#ffe14d";
  const WASHI=["#e8457f","#2a9d8f","#e99a1c","#4f78d6","#6aa339","#9b5bd1"];
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};
  const jest=()=>typeof bufor==="function";
  // Grafika motywu albo null (jeszcze się wczytuje).
  const zasob=plik=>Motywy.zasob(ID,plik);
  const KAN=new Map(),KOL=new Map();
  function ka(hex,a){
    const q=Math.round(Math.max(0,Math.min(1,a))*50),k=hex+"|"+q;let s=KOL.get(k);if(s)return s;
    let r=KAN.get(hex);if(!r){const m=/^#([0-9a-f]{6})$/i.exec(hex||""),n=m?parseInt(m[1],16):0xe8457f;r=((n>>16)&255)+","+((n>>8)&255)+","+(n&255);KAN.set(hex,r);}
    s="rgba("+r+","+(q/50)+")";KOL.set(k,s);return s;
  }
  const WZORY=new Map();
  function wzor(c,nazwa,T,rysuj){
    let p=WZORY.get(nazwa);if(p)return p;
    const cv=document.createElement("canvas");cv.width=cv.height=T*2;const x=cv.getContext("2d");x.scale(2,2);rysuj(x,T);
    p=c.createPattern(cv,"repeat");if(p&&p.setTransform&&typeof DOMMatrix!=="undefined")p.setTransform(new DOMMatrix().scale(.5));
    WZORY.set(nazwa,p);return p;
  }
  const BEZ=[];
  // Kreska ołówka: odcinek z lekkim drżeniem (punkty co ~14 px), deterministyczna z ziarna. Do statycznych buforów.
  function olowek(c,x0,y0,x1,y1,z,amp){
    const d=Math.hypot(x1-x0,y1-y0),n=Math.max(1,Math.round(d/14)),nx=-(y1-y0)/(d||1),ny=(x1-x0)/(d||1);
    c.moveTo(x0,y0);
    for(let i=1;i<=n;i++){const t=i/n,o=i<n?(los(z,i)-.5)*amp:0;c.lineTo(x0+(x1-x0)*t+nx*o,y0+(y1-y0)*t+ny*o);}
  }

  // ============================================================================================ karta
  // Kremowy papier zeszytu (szyba, prześwit 0,18) w kratkę co 14 px: jedna ścieżka, raz na układ.
  function fakturaKarty(c,L){
    c.strokeStyle="rgba(80,120,170,.17)";c.lineWidth=1;c.beginPath();
    for(let x=L.x+14;x<L.x+L.w;x+=14){c.moveTo(Math.round(x)+.5,L.y);c.lineTo(Math.round(x)+.5,L.y+L.h);}
    for(let y=L.y+14;y<L.y+L.h;y+=14){c.moveTo(L.x,Math.round(y)+.5);c.lineTo(L.x+L.w,Math.round(y)+.5);}
    c.stroke();
  }

  // ============================================================================================ nuty
  // Taśma washi: kolor z palety według ziarna nuty (sąsiednie nuty różne), jeden z trzech białych wzorów (groszki,
  // paski skośne, kratka) i poszarpane końce w kolorze papieru. Grafitowy obrys trzyma kontrast z jasną kartą.
  const WZ=[
    c=>wzor(c,"groszki",8,(x,T)=>{x.fillStyle="rgba(255,255,255,.62)";x.beginPath();x.arc(2,2,1.4,0,TAU);x.arc(6,6,1.4,0,TAU);x.fill();}),
    c=>wzor(c,"paski",8,(x,T)=>{x.strokeStyle="rgba(255,255,255,.5)";x.lineWidth=1.8;x.beginPath();
      for(const d of [-T,0,T]){x.moveTo(d,T);x.lineTo(d+T,0);}x.stroke();}),
    c=>wzor(c,"kratka",10,(x,T)=>{x.fillStyle="rgba(255,255,255,.34)";x.fillRect(0,0,T/2,T);x.fillRect(0,0,T,T/2);})];
  function koncowki(c,x0,x1,y0,nh,z){   // ząbki poszarpanego końca: dwa wieloboki w jednej ścieżce
    c.beginPath();
    for(const [xa,sg] of [[x0,1],[x1,-1]]){
      c.moveTo(xa-sg*2,y0-1);
      for(let i=0;i<=5;i++){const y=y0+nh*i/5;c.lineTo(xa+sg*(1+3*los(z+sg,i)),y);}
      c.lineTo(xa-sg*2,y0+nh+1);c.closePath();
    }
    c.fill();
  }
  const nuty={
    cialo(c,w,nh,o){
      const z=(o&&o.ziarno)|0,x0=-w/2,y0=-nh/2;
      c.fillStyle=WASHI[(z*5)%WASHI.length];c.fillRect(x0-1,y0-1,w+2,nh+2);
      c.fillStyle=WZ[(z>>1)%3](c);c.fillRect(x0-1,y0-1,w+2,nh+2);
      c.fillStyle="rgba(255,255,255,.22)";c.fillRect(x0,y0+1,w,Math.max(1,nh*.14));
      c.fillStyle=PAPIER;koncowki(c,x0,x0+w,y0,nh,z);
    },
    brzeg:()=>"rgba(59,56,51,.8)",zapas:()=>0};

  // ============================================================================================ klawisze
  // Klawiatura narysowana ołówkiem na kremowym papierze: drżący obrys rysowany dwa razy, kreski między białymi,
  // czarne klawisze kreskowane skośnie. Śpiewany klawisz: zakreślacz w kolorze gracza i grafitowy obrys.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(60,50,30,.12)";c.fillRect(x+2,y0+3,w,h);
      c.fillStyle=KREM;c.fillRect(x,y0,w,h);
      c.lineCap="round";c.lineJoin="round";
      c.strokeStyle=ka(GRAF,.75);c.lineWidth=1.1;c.beginPath();
      olowek(c,x,y0,x+w,y0,1,1.2);olowek(c,x+w,y0,x+w,y0+h,2,1.2);olowek(c,x+w,y0+h,x,y0+h,3,1.2);olowek(c,x,y0+h,x,y0,4,1.2);
      for(let s=L.dolN;s<=L.goraN;s++){
        const pc=((s%12)+12)%12;if(isBlack(s))continue;
        if(isBlack(s+1)||pc===4||pc===11){const k=prostokatKlawisza(L,s),y=Math.round(k.y)+.5;olowek(c,x+1,y,x+w-1,y+(los(s,1)-.5)*1.2,s,.8);}
      }
      c.stroke();
      c.strokeStyle=ka(GRAF,.3);c.lineWidth=.9;c.beginPath();olowek(c,x-1,y0+1,x+w+1,y0-1,7,1.6);olowek(c,x+w+1,y0,x+w-1,y0+h+1,8,1.6);c.stroke();
      for(let s=L.dolN;s<=L.goraN;s++){
        if(!isBlack(s))continue;const k=prostokatKlawisza(L,s),bw=k.w*.62,bh=Math.max(1,k.h-1);
        c.save();c.beginPath();c.rect(k.x,k.y+.5,bw,bh);c.clip();
        c.fillStyle="rgba(59,56,51,.22)";c.fillRect(k.x,k.y,bw,bh+1);
        c.strokeStyle=ka(GRAF,.8);c.lineWidth=.9;c.beginPath();
        for(let d=-bh;d<bw;d+=2.6){c.moveTo(k.x+d,k.y+bh+.5);c.lineTo(k.x+d+bh+1,k.y);}c.stroke();
        c.restore();
        c.strokeStyle=ka(GRAF,.85);c.lineWidth=1;c.beginPath();olowek(c,k.x+bw,k.y+.5,k.x+bw,k.y+bh,s,.6);olowek(c,k.x,k.y+bh,k.x+bw,k.y+bh,s+3,.6);c.stroke();
      }
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),k=prostokatKlawisza(L,s);
      c.fillStyle=ka(ZAKR,g.naNucie?.7:.4);c.fillRect(k.x-2,k.y-1,k.w+4,k.h+2);
      if(g.naNucie){c.strokeStyle=GRAF;c.lineWidth=1.2;c.strokeRect(k.x+1,k.y+.5,k.w-2,Math.max(1,k.h-1));}
    }};

  // ============================================================================================ tło
  const tlo={przeswit:.18,scieg:false,rama:{bok:.075,gora:10,dol:8,odstep:6},
    tlo:{promienie:[["255,225,77",.10],["232,69,127",.04]],swiatlo:["255,236,180","255,214,120"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      const im=zasob("tlo.webp");
      c.fillStyle="#efe6d0";c.fillRect(0,0,W,H);
      if(!im)return;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      const g=c.createLinearGradient(0,H*.7,0,H);g.addColorStop(0,"rgba(90,70,40,0)");g.addColorStop(1,"rgba(90,70,40,.22)");c.fillStyle=g;c.fillRect(0,H*.7,W,H*.3);
    }};

  // ============================================================================================ widownia
  // Sześć filcowych żab-naklejek: kolejność bez powtórzeń w sąsiedztwie, lustrzane odbicia, lekko różna skala
  // i przechył jak przyklejone ręcznie, skok |sin| na ćwierćnuty z przesuniętą fazą (wyżej przy kombo i brawach).
  const KOLEJ=new Map();
  function kolejnosc(n){
    let a=KOLEJ.get(n);if(a)return a;a=[];
    for(let i=0;i<n;i++){let k=Math.floor(los(i,7)*6);
      while((i>0&&k===a[i-1].k)||(i>1&&k===a[i-2].k))k=(k+1)%6;
      a.push({k,lustro:(i+(los(i,3)>.7?1:0))%2===1,sk:.9+.15*los(i,5),fz:los(i,9),dx:(los(i,11)-.5)*.2,kat:(los(i,13)-.5)*.12});}
    KOLEJ.set(n,a);return a;
  }
  function fan(k,lustro,h){
    const im=zasob("fan-"+k+".webp");if(!im||!jest())return null;
    const w=Math.max(1,Math.round(h*im.naturalWidth/im.naturalHeight));
    return bufor("mw2-"+ID+"-fan|"+k+"|"+(lustro?1:0)+"|"+h,w,h,c=>{if(lustro){c.translate(w,0);c.scale(-1,1);}c.drawImage(im,0,0,w,h);});
  }
  const pas=(W,h)=>bufor("mw2-"+ID+"-pas|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(120,95,60,0)");g.addColorStop(1,"rgba(120,95,60,.28)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.max(8,Math.round(Wd.h*1.04)),mini=!!st.mini;
      if(!mini)c.drawImage(pas(W,Math.round(Wd.h)).cv,0,Wd.y,W,Wd.h);
      const n=mini?(st.n||3):Math.max(4,Motywy.ileFanow(ID,W,h,.86)),krok=W/n,ko=kolejnosc(n);
      const ruch=!st.spokoj&&!st.bezRuchu&&!mini,faza=st.faza||0;
      const amp=ruch?h*(.03+.06*Math.min(1,st.skok||0)+.025*Math.min(3,st.zar||0)+(st.spiewaja?.012:0)):0,dol=Wd.y+Wd.h+h*.03;
      for(let i=0;i<n;i++){
        const o=ko[i],fh=Math.round(h*o.sk),b=fan(o.k,o.lustro,fh);if(!b)continue;
        const sk=amp?Math.abs(Math.sin(PI*(faza+o.fz))):0,x=krok*(i+.5+o.dx);
        Motywy.fan(c,b,x,dol,st,"szkic",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
    }};

  // ============================================================================================ streak
  // Głowa: bazgroł ołówkiem (promienie odręcznym grafitem, sprite na poziom ognia) obraca się powoli za głową na
  // plamie zakreślacza. Ślad: szeroki zakreślacz w kolorze gracza i dwie kreski ołówka (szkicowo, przesunięte).
  // Płonąca nuta: zakreślona część i kreska ołówka, na froncie filcowa gwiazdka. Cząstki: iskra-0..5 z głowy.
  function bazgrol(og){
    return bufor("mw2-"+ID+"-bazgrol|"+og,128,128,c=>{
      const n=8+4*og;c.lineCap="round";c.strokeStyle=ka(GRAF,.8);c.lineWidth=1.6;c.beginPath();
      for(let i=0;i<n;i++){const a=i/n*TAU+(los(i,og)-.5)*.2,r0=34+4*los(i,2),r1=50+10*los(i,3)+(i%2?0:6);
        olowek(c,64+Math.cos(a)*r0,64+Math.sin(a)*r0,64+Math.cos(a)*r1,64+Math.sin(a)*r1,i+og*20,2.2);}
      c.stroke();
      c.strokeStyle=ka(GRAF,.45);c.lineWidth=1.1;c.beginPath();
      for(let k=0;k<2;k++){const r=30+k*2.5;c.moveTo(64+r,64);
        for(let i=1;i<=24;i++){const a=i/24*TAU+k*.2,rr=r+(los(i,k+5)-.5)*2.5;c.lineTo(64+Math.cos(a)*rr,64+Math.sin(a)*rr);}}
      c.stroke();
    });
  }
  const plama=()=>bufor("mw2-"+ID+"-plama",64,64,c=>{
    c.fillStyle=ka(ZAKR,.55);c.beginPath();c.ellipse(32,32,30,27,-.3,0,TAU);c.fill();
    c.fillStyle=ka(ZAKR,.35);c.beginPath();c.ellipse(34,30,24,30,.4,0,TAU);c.fill();
  });
  const GRAD=new Map();
  function gradX(c,x0,x1,kol,a1){
    const k=Math.round(x0)+"|"+Math.round(x1)+"|"+kol+"|"+a1;let g=GRAD.get(k);
    if(!g){if(GRAD.size>64)GRAD.clear();g=c.createLinearGradient(x0,0,x1,0);g.addColorStop(0,ka(kol,0));g.addColorStop(.4,ka(kol,a1*.6));g.addColorStop(1,ka(kol,a1));GRAD.set(k,g);}
    return g;
  }
  function sciezka(c,pts,dx,dy){
    c.beginPath();let pi=false;
    for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x+dx,p.y+dy);else{c.moveTo(p.x+dx,p.y+dy);pi=true;}}
  }
  const ISK=[];for(let i=0;i<6;i++)ISK.push("iskra-"+i+".webp");
  function iskra(k,r){
    const im=zasob(ISK[k]);if(!im||!jest())return null;
    return bufor("mw2-"+ID+"-isk|"+k+"|"+r,r,r,c=>c.drawImage(im,0,0,r,r));
  }
  const PULE=new WeakMap(),MAKS=12,TEMPO=[0,1.4,2.8,4.8];
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={dos:0,cz:[]};for(let i=0;i<MAKS;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,a:0,va:0,r:16,k:0});
    PULE.set(g,p);return p;
  }
  function czastki(c,L,g,st){
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),og=st.wyniki?0:Math.min(3,g.ogien|0);
    if(og>0&&typeof pozycjaZaby==="function"){
      P.dos+=dt*TEMPO[og];
      if(P.dos>=1){P.dos-=1;
        for(const p of P.cz)if(p.z<=0){
          const pz=pozycjaZaby(L,g),sc=L.zaba*110/96;
          p.k=Math.floor(Math.random()*6);p.r=Math.round(sc*(.36+.07*og)*(.85+.3*Math.random())/4)*4;
          p.x=pz.x-sc*.12+(Math.random()-.5)*sc*.3;p.y=pz.y-sc*.3;p.vx=-(30+60*Math.random());p.vy=-(50+60*Math.random())*(1+.15*og);
          p.a=(Math.random()-.5)*.6;p.va=(Math.random()-.5)*2;p.zy=1+.5*Math.random();p.z=p.zy;break;
        }
      }
    }else P.dos=0;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=36*dt;p.a+=p.va*dt;
      const b=iskra(p.k,Math.max(8,p.r));if(!b||p.z<=0)continue;
      const f=1-p.z/p.zy,al=f<.12?f/.12:p.z<.4?p.z/.4:1,s=f<.15?.6+.4*f/.15:1;
      c.globalAlpha=al;c.save();c.translate(p.x,p.y);c.rotate(p.a);c.drawImage(b.cv,-b.w*s/2,-b.h*s/2,b.w*s,b.h*s);c.restore();
    }
    c.globalAlpha=1;
  }
  const streak={
    glowa(c,sc,og,ts,z,przod){
      if(przod)return;
      const cy=-sc*.44,r=sc*(.62+.05*og);
      c.save();c.translate(0,cy);
      const p=plama();c.globalAlpha=.85;c.drawImage(p.cv,-r*.85,-r*.85,r*1.7,r*1.7);c.globalAlpha=1;
      c.rotate(ts*.35+z);const b=bazgrol(Math.max(1,Math.min(3,og)));c.drawImage(b.cv,-r,-r,2*r,2*r);
      c.restore();
    },
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const gr=k.og>=3?9:k.og>=2?7.5:6,kol=typeof k.kolor==="string"&&k.kolor[0]==="#"?k.kolor:ROZ;
      c.save();c.lineCap="butt";c.lineJoin="round";
      sciezka(c,pts,0,1);c.strokeStyle=gradX(c,k.x0,k.xT,kol,.38);c.lineWidth=gr;c.stroke();
      c.lineCap="round";
      sciezka(c,pts,0,-gr*.15);c.strokeStyle=gradX(c,k.x0,k.xT,GRAF,.85);c.lineWidth=1.3;c.stroke();
      sciezka(c,pts,-2,gr*.2);c.strokeStyle=gradX(c,k.x0,k.xT,GRAF,.4);c.lineWidth=.9;c.stroke();
      c.restore();
    },
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+2){c.fillStyle=ka(ZAKR,.6);c.fillRect(x0,-nh/2,fx-x0,nh);
        c.strokeStyle=ka(GRAF,.85);c.lineWidth=1.2;c.beginPath();c.moveTo(x0+2,nh*.05);c.lineTo(fx,-nh*.05);c.stroke();}
      if(gas>0){const b=iskra(0,24);if(b){const s=nh*(aktywna?1.4:1.1);c.globalAlpha=gas;c.drawImage(b.cv,fx-s/2,-s/2,s,s);c.globalAlpha=1;}}
    },
    tor(c,L,g,st){if(st&&!st.spokoj)czastki(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{plama();for(let i=1;i<=3;i++)bazgrol(i);}catch(e){}},
    aura:[ZAKR,ROZ],wypelnienie:[KREM,ZAKR,ROZ],iskry:{kolory:[ROZ,"#2a9d8f",GRAF]},dym:false,
    scena:["232,69,127","255,225,77","42,157,143"],
    tlo:{promienie:[["255,225,77",.10],["232,69,127",.04]],swiatlo:["255,236,180","255,214,120"]}};

  Motywy.dodaj({id:ID,nazwa:"Szkicownik",kolejnosc:8,kolor:"#8a8478",
    zasoby:["tlo.webp","zaba-0.webp","zaba-1.webp","fan-0.webp","fan-1.webp","fan-2.webp","fan-3.webp","fan-4.webp","fan-5.webp",
      "iskra-0.webp","iskra-1.webp","iskra-2.webp","iskra-3.webp","iskra-4.webp","iskra-5.webp"],zaba:true,przebranie:true,
    opis:"Scrapbook z zeszytu: kartka w kratkę, nuty z kolorowej taśmy washi, klawiatura rysowana ołówkiem, filcowe naklejki i spinacze lecące z głowy.",
    cechy:{tlo:"zeszyt i washi",klawisze:"rysowane ołówkiem",streak:"zakreślacz i naklejki",widownia:"żaby-naklejki"},
    en:{nazwa:"Sketchbook",
      opis:"A scrapbook from a school notebook: a squared page, notes of colourful washi tape, a keyboard drawn in pencil, felt stickers and paper clips flying off your head.",
      cechy:{tlo:"notebook and washi",klawisze:"pencil-drawn",streak:"highlighter and stickers",widownia:"sticker frogs"}},
    karta:{papier:PAPIER,cien:"rgba(90,70,40,.18)",czarne:"rgba(60,55,45,.045)",liniaC:"rgba(59,56,51,.3)",minione:"rgba(140,125,95,.12)",
      nazwy:"rgba(59,56,51,.8)",kreski:"rgba(59,56,51,.3)",nic:ROZ,szpilka:GRAF,szpilkaBlask:KREM,
      cienNuty:"rgba(60,45,20,.2)",scieg:null,rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
