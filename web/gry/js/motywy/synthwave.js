// Motyw „Synthwave” (runda 2, 10-09 wieczór): neonowy HAFT na granatowo-indygo filcu. Tło to ilustracja (cekinowe
// słońce nad haftowaną siatką, filcowe palmy), karta toru ciemna szyba z indygo z delikatnymi włóknami filcu, taśmy
// nut jak haftowane nici satynowym ściegiem (skośne ściegi z wzoru w pamięci) w cyjanie z magentowym obrzeżem,
// klawiatura z ciemnego filcu ze ściegami zamiast kresek. Widownia: sześciu fanów z ilustracji (fan-0..5) skacze
// w rytm. Streak: haftowane obręcze nici za głową, ślad jak podwójny ścieg nicią i naszywki (iskra-0..5) z głowy.
// Bez shadowBlur i gładkich neonowych gradientów: blask to tylko wielowarstwowa nić i miękka łuna z bufora.
(function(){
  "use strict";
  const ID="synthwave",PI=Math.PI,TAU=2*PI;
  const MAG="#ff3fa4",CYJ="#33e4f2",IND="#1a1442",NOC="#0e0a26",FIOL="#7a4cff",ZLOTO="#ffc65a",BIEL="#f6f2ff";
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};
  const jest=()=>typeof bufor==="function";
  // Grafika motywu albo null (jeszcze się wczytuje).
  const zasob=plik=>Motywy.zasob(ID,plik);
  // Kolor z alfą: kanały raz na kolor, napis raz na (kolor, alfa co 1/50).
  const KAN=new Map(),KOL=new Map();
  function ka(hex,a){
    const q=Math.round(Math.max(0,Math.min(1,a))*50),k=hex+"|"+q;let s=KOL.get(k);if(s)return s;
    let r=KAN.get(hex);if(!r){const m=/^#([0-9a-f]{6})$/i.exec(hex||""),n=m?parseInt(m[1],16):0xff3fa4;r=((n>>16)&255)+","+((n>>8)&255)+","+(n&255);KAN.set(hex,r);}
    s="rgba("+r+","+(q/50)+")";KOL.set(k,s);return s;
  }
  // Wzór kafelkowy w 2× rozdzielczości (ostry na ekranach dpr 2), skala wzoru 1/2: jeden na nazwę.
  const WZORY=new Map();
  function wzor(c,nazwa,T,rysuj){
    let p=WZORY.get(nazwa);if(p)return p;
    const cv=document.createElement("canvas");cv.width=cv.height=T*2;const x=cv.getContext("2d");x.scale(2,2);rysuj(x,T);
    p=c.createPattern(cv,"repeat");if(p&&p.setTransform&&typeof DOMMatrix!=="undefined")p.setTransform(new DOMMatrix().scale(.5));
    WZORY.set(nazwa,p);return p;
  }
  const KRESKI_6=[6,4],KRESKI_3=[3,2.4],BEZ=[];

  // ============================================================================================ karta
  // Indygo filc jako szyba (prześwit 0,28) i jedna faktura: krótkie włókna w dwóch tonach, raz na układ.
  function fakturaKarty(c,L){
    const n=Math.min(1800,Math.round(L.w*L.h/85));c.lineWidth=1;
    for(const [kol,z0] of [["rgba(160,140,255,.07)",1],["rgba(0,0,0,.16)",5]]){
      c.strokeStyle=kol;c.beginPath();
      for(let i=0;i<n;i+=2){const x=L.x+los(i,z0)*L.w,y=L.y+los(i,z0+1)*L.h,a=los(i,z0+2)*TAU,d=2+4*los(i,z0+3);
        c.moveTo(x,y);c.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d);}
      c.stroke();
    }
  }

  // ============================================================================================ nuty
  // Haftowana nić: cyjan z satynowym ściegiem (skośne nitki z wzoru), magentowe obrzeże u góry, rząd drobnych
  // ściegów wzdłuż taśmy. Pasek partii (kolor gracza) gra rysuje na dole, obrys taśmy to magenta (brzeg).
  const satyna=c=>wzor(c,"satyna",6,(x,T)=>{
    x.lineCap="butt";
    x.strokeStyle="rgba(255,255,255,.42)";x.lineWidth=1.1;x.beginPath();
    for(const d of [-T,0,T]){x.moveTo(d,T);x.lineTo(d+T,0);}x.stroke();
    x.strokeStyle="rgba(10,20,60,.32)";x.lineWidth=.9;x.beginPath();
    for(const d of [-T,0,T]){x.moveTo(d+T/2,T);x.lineTo(d+T*1.5,0);}x.stroke();
  });
  const nuty={
    cialo(c,w,nh){
      const x0=-w/2,y0=-nh/2,ob=Math.max(1.6,nh*.17);
      c.fillStyle=CYJ;c.fillRect(x0-1,y0-1,w+2,nh+2);
      c.fillStyle=satyna(c);c.fillRect(x0-1,y0-1,w+2,nh+2);
      c.fillStyle=MAG;c.fillRect(x0-1,y0-1,w+2,ob+1);
      c.fillStyle=ka(BIEL,.55);c.fillRect(x0-1,y0+ob,w+2,.8);
      if(nh>=10){c.setLineDash(KRESKI_3);c.strokeStyle=ka(NOC,.45);c.lineWidth=1;
        c.beginPath();c.moveTo(x0+3,y0+ob+nh*.24);c.lineTo(x0+w-3,y0+ob+nh*.24);c.stroke();c.setLineDash(BEZ);}
    },
    brzeg:()=>MAG,zapas:()=>0};

  // ============================================================================================ klawisze
  // Ciemny filc: białe klawisze rozdzielone ściegiem cyjanowej nici, czarne z głębszego granatu z magentowym
  // obrysem ściegiem, cała klawiatura obszyta. Śpiewany klawisz: kolor gracza i biały ścieg.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(0,0,0,.45)";c.beginPath();c.roundRect(x+2,y0+3,w,h,4);c.fill();
      c.fillStyle="#2a2066";c.beginPath();c.roundRect(x,y0,w,h,4);c.fill();
      c.setLineDash(KRESKI_3);c.strokeStyle=ka(CYJ,.75);c.lineWidth=1;c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){
        const pc=((s%12)+12)%12;if(isBlack(s))continue;
        if(isBlack(s+1)||pc===4||pc===11){const k=prostokatKlawisza(L,s),y=Math.round(k.y)+.5;c.moveTo(x+2,y);c.lineTo(x+w-2,y);}
      }
      c.stroke();c.setLineDash(BEZ);
      for(let s=L.dolN;s<=L.goraN;s++){
        if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);
        c.fillStyle=NOC;c.beginPath();c.roundRect(k.x,k.y+.5,k.w*.62,Math.max(1,k.h-1),[0,2,2,0]);c.fill();
        c.strokeStyle=ka(MAG,.85);c.lineWidth=1;c.setLineDash(KRESKI_3);c.stroke();c.setLineDash(BEZ);
      }
      c.setLineDash(KRESKI_6);c.strokeStyle=ka(MAG,.9);c.lineWidth=1.4;c.beginPath();c.roundRect(x+2,y0+2,w-4,h-4,3);c.stroke();c.setLineDash(BEZ);
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),k=prostokatKlawisza(L,s);
      c.setLineDash(KRESKI_3);c.strokeStyle=g.naNucie?BIEL:ka(BIEL,.55);c.lineWidth=1.3;
      c.beginPath();c.roundRect(k.x+2,k.y+1,k.w-4,Math.max(1,k.h-2),2);c.stroke();c.setLineDash(BEZ);
    }};

  // ============================================================================================ tło
  // Ilustracja na cały ekran (cover, środek spokojny), lekka winieta po bokach i u dołu pod widownią.
  const tlo={przeswit:.28,rama:{bok:.075,gora:10,dol:8,odstep:6},
    tlo:{promienie:[["255,63,164",.10],["51,228,242",.08]],swiatlo:["255,90,180","80,60,220"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      const im=zasob("tlo.webp");
      c.fillStyle=IND;c.fillRect(0,0,W,H);
      if(!im)return;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      let g=c.createRadialGradient(W/2,H*.45,Math.min(W,H)*.35,W/2,H*.45,Math.hypot(W,H)*.62);
      g.addColorStop(0,"rgba(14,10,38,0)");g.addColorStop(1,"rgba(14,10,38,.45)");c.fillStyle=g;c.fillRect(0,0,W,H);
    }};

  // ============================================================================================ widownia
  // Fani z ilustracji: kolejność bez powtórzeń w sąsiedztwie (ziarno), co drugi w lustrze, skala 0,9–1,05,
  // skok |sin| na ćwierćnuty z przesuniętą fazą, wyżej przy kombo i brawach. Sprite'y skalowane raz na wysokość pasa.
  const KOLEJ=new Map();
  function kolejnosc(n){
    let a=KOLEJ.get(n);if(a)return a;a=[];
    for(let i=0;i<n;i++){let k=Math.floor(los(i,7)*6);
      while((i>0&&k===a[i-1].k)||(i>1&&k===a[i-2].k))k=(k+1)%6;
      a.push({k,lustro:(i+(los(i,3)>.7?1:0))%2===1,sk:.9+.15*los(i,5),fz:los(i,9),dx:(los(i,11)-.5)*.25});}
    KOLEJ.set(n,a);return a;
  }
  function fan(k,lustro,h){
    const im=zasob("fan-"+k+".webp");if(!im||!jest())return null;
    const w=Math.max(1,Math.round(h*im.naturalWidth/im.naturalHeight));
    return bufor("mw2-"+ID+"-fan|"+k+"|"+(lustro?1:0)+"|"+h,w,h,c=>{if(lustro){c.translate(w,0);c.scale(-1,1);}c.drawImage(im,0,0,w,h);});
  }
  const pas=(W,h)=>bufor("mw2-"+ID+"-pas|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(14,10,38,0)");g.addColorStop(.55,"rgba(14,10,38,.35)");g.addColorStop(1,"rgba(14,10,38,.7)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.max(8,Math.round(Wd.h*1.04)),mini=!!st.mini;
      if(!mini)c.drawImage(pas(W,Math.round(Wd.h)).cv,0,Wd.y,W,Wd.h);
      const n=mini?(st.n||3):Math.max(4,Math.min(22,Math.round(W/(h*.74)))),krok=W/n,ko=kolejnosc(n);
      const ruch=!st.spokoj&&!st.bezRuchu&&!mini,faza=st.faza||0;
      const amp=ruch?h*(.03+.06*Math.min(1,st.skok||0)+.025*Math.min(3,st.zar||0)+(st.spiewaja?.012:0)):0,dol=Wd.y+Wd.h+h*.03;
      for(let i=0;i<n;i++){
        const o=ko[i],fh=Math.round(h*o.sk),b=fan(o.k,o.lustro,fh);if(!b)continue;
        const sk=amp?Math.abs(Math.sin(PI*(faza+o.fz))):0,x=krok*(i+.5+o.dx)-b.w/2;
        Motywy.fan(c,b,x+b.w/2,dol,st,"groove",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
    }};

  // ============================================================================================ streak
  // Głowa: obręcze haftowanej nici (magenta, przy ogniu 2 druga w cyjanie w przeciwną stronę), przy pełnym ogniu
  // wianek cekinów; pod spodem miękka łuna z bufora. Ślad: podwójny ścieg (cyjan i magenta przesunięte o pół
  // ściegu) na miękkiej łunie z gradientu w pamięci. Płonąca nuta: przeszyta część jaśnieje, front to cekin.
  // Cząstki: naszywki iskra-0..5 z głowy (pula 12 na gracza, liczba i wielkość rosną z ogniem).
  const lunaGlowy=()=>bufor("mw2-"+ID+"-luna",64,64,c=>{
    const g=c.createRadialGradient(32,32,4,32,32,32);g.addColorStop(0,"rgba(255,63,164,.55)");g.addColorStop(.5,"rgba(122,76,255,.22)");g.addColorStop(1,"rgba(122,76,255,0)");
    c.fillStyle=g;c.fillRect(0,0,64,64);
  });
  const cekin=k=>bufor("mw2-"+ID+"-cekin|"+k,24,24,c=>{
    const kol=[ZLOTO,MAG,CYJ][k];
    c.fillStyle=kol;c.beginPath();c.arc(12,12,10,0,TAU);c.fill();
    c.fillStyle="rgba(255,255,255,.55)";c.beginPath();c.arc(9,9,4,0,TAU);c.fill();
    c.strokeStyle="rgba(14,10,38,.7)";c.lineWidth=1.2;c.beginPath();c.arc(12,12,10,0,TAU);c.stroke();
    c.fillStyle=NOC;c.beginPath();c.arc(12,12,2.4,0,TAU);c.fill();
  });
  const GRAD=new Map();
  function gradX(c,x0,x1,kol,a1){
    const k=Math.round(x0)+"|"+Math.round(x1)+"|"+kol+"|"+a1;let g=GRAD.get(k);
    if(!g){if(GRAD.size>64)GRAD.clear();g=c.createLinearGradient(x0,0,x1,0);g.addColorStop(0,ka(kol,0));g.addColorStop(.5,ka(kol,a1*.45));g.addColorStop(1,ka(kol,a1));GRAD.set(k,g);}
    return g;
  }
  function sciezka(c,pts,dy){
    c.beginPath();let pi=false;
    for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y+dy);else{c.moveTo(p.x,p.y+dy);pi=true;}}
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
          p.k=Math.floor(Math.random()*6);p.r=Math.round(sc*(.34+.07*og)*(.85+.3*Math.random())/4)*4;
          p.x=pz.x-sc*.12+(Math.random()-.5)*sc*.3;p.y=pz.y-sc*.3;p.vx=-(30+60*Math.random());p.vy=-(50+60*Math.random())*(1+.15*og);
          p.a=(Math.random()-.5)*.6;p.va=(Math.random()-.5)*2.4;p.zy=1+.5*Math.random();p.z=p.zy;break;
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
      const cy=-sc*.44,r=sc*(.5+.04*og);
      c.save();c.translate(0,cy);
      const l=lunaGlowy();c.globalAlpha=.55+.15*og;c.drawImage(l.cv,-r*1.5,-r*1.5,r*3,r*3);c.globalAlpha=1;
      c.lineCap="round";
      c.setLineDash([sc*.09,sc*.05]);
      c.lineDashOffset=-ts*sc*.35;c.strokeStyle=ka(MAG,.35);c.lineWidth=sc*.07;c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();
      c.strokeStyle=MAG;c.lineWidth=sc*.035;c.stroke();
      if(og>=2){c.lineDashOffset=ts*sc*.3;c.strokeStyle=CYJ;c.lineWidth=sc*.03;c.beginPath();c.arc(0,0,r*1.18,0,TAU);c.stroke();}
      c.setLineDash(BEZ);c.lineDashOffset=0;
      if(og>=3){const n=10,rc=r*1.38,s=sc*.13;
        for(let i=0;i<n;i++){const a=i/n*TAU+ts*.5,b=cekin(i%3);c.drawImage(b.cv,Math.cos(a)*rc-s/2,Math.sin(a)*rc-s/2,s,s);}}
      c.restore();
    },
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const gr=k.og>=3?3.4:k.og>=2?2.8:2.2;
      c.save();c.lineCap="round";c.lineJoin="round";
      sciezka(c,pts,0);c.strokeStyle=gradX(c,k.x0,k.xT,MAG,.2);c.lineWidth=gr*4.5;c.stroke();
      c.setLineDash(KRESKI_6);
      sciezka(c,pts,-gr*.5);c.strokeStyle=gradX(c,k.x0,k.xT,CYJ,.95);c.lineWidth=gr;c.stroke();
      c.lineDashOffset=5;sciezka(c,pts,gr*.5);c.strokeStyle=gradX(c,k.x0,k.xT,MAG,.95);c.stroke();
      c.restore();
    },
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+2){c.fillStyle=ka(MAG,.38);c.fillRect(x0,-nh/2,fx-x0,nh);
        c.setLineDash(KRESKI_3);c.strokeStyle=ka(BIEL,.85);c.lineWidth=1.2;c.beginPath();c.moveTo(x0+2,0);c.lineTo(fx,0);c.stroke();c.setLineDash(BEZ);}
      if(gas>0){const s=nh*(aktywna?1.2:.9);c.globalAlpha=gas;c.drawImage(cekin(Math.floor(ts*3+z)%3).cv,fx-s/2,-s/2,s,s);c.globalAlpha=1;}
    },
    tor(c,L,g,st){if(st&&!st.spokoj)czastki(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{lunaGlowy();for(let i=0;i<3;i++)cekin(i);}catch(e){}},
    aura:[MAG,CYJ],wypelnienie:[BIEL,CYJ,MAG],iskry:{kolory:[BIEL,CYJ,MAG]},dym:false,
    scena:["255,63,164","51,228,242","122,76,255"],
    tlo:{promienie:[["255,63,164",.10],["51,228,242",.08]],swiatlo:["255,90,180","80,60,220"]}};

  Motywy.dodaj({id:ID,nazwa:"Synthwave",kolejnosc:7,kolor:"#ff3fa4",
    zasoby:["tlo.webp","zaba-0.webp","zaba-1.webp","fan-0.webp","fan-1.webp","fan-2.webp","fan-3.webp","fan-4.webp","fan-5.webp",
      "iskra-0.webp","iskra-1.webp","iskra-2.webp","iskra-3.webp","iskra-4.webp","iskra-5.webp"],zaba:true,przebranie:true,
    opis:"Neonowy haft na granatowym filcu: cekinowe słońce i haftowana siatka, nuty jak nici satynowym ściegiem, fani z lat 80. i naszywki lecące z głowy.",
    cechy:{tlo:"cekinowe słońce",klawisze:"ciemny filc i ścieg",streak:"haftowane obręcze",widownia:"fani z lat 80."},
    en:{nazwa:"Synthwave",
      opis:"Neon embroidery on navy felt: a sequin sun and an embroidered grid, notes like satin-stitch threads, 80s fans and patches flying off your head.",
      cechy:{tlo:"sequin sun",klawisze:"dark felt and stitching",streak:"embroidered hoops",widownia:"80s fans"}},
    karta:{papier:IND,cien:"rgba(0,0,0,.5)",czarne:"rgba(0,0,0,.2)",liniaC:"rgba(51,228,242,.28)",minione:"rgba(8,4,24,.3)",
      nazwy:"rgba(230,215,255,.78)",kreski:"rgba(255,63,164,.3)",nic:ZLOTO,szpilka:MAG,szpilkaBlask:"#ffe0f2",
      cienNuty:"rgba(0,0,0,.45)",scieg:"rgba(255,63,164,.6)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
