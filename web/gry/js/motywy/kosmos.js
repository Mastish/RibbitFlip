// Motyw „Kosmos” (runda 2, 10-09 wieczór): kosmos z filcu i włóczki. Tło to ilustracja (filcowe planety, gwiazdy
// z guzików i cekinów, mgławica z czesanki, gwiazdozbiory haftowane srebrną nicią), karta toru ciemna szyba
// z granatowo-fioletowego filcu z rzadkimi srebrnymi krzyżykami, taśmy nut jak włóczkowe komety (jasna główka
// z przodu, liliowy ogon i skręcone nitki), klawiatura z granatowego filcu ze srebrnym ściegiem. Widownia: sześciu
// kosmicznych fanów (fan-0..5) skacze w rytm. Streak: włóczkowa kometa za głową, ślad z trzech nitek, z głowy
// lecą naszywki (kometa, gwiazda, planeta, cekin, UFO, meteor: iskra-0..5).
(function(){
  "use strict";
  const ID="kosmos",PI=Math.PI,TAU=2*PI;
  const GRANAT="#151238",NOC="#0c0a24",FIOL="#6c4bd6",LIL="#b9a6ff",SREBRO="#dcd9ee",ZLOTO="#ffcf4a",TURK="#3fd0c9",ROZ="#ff6fae",KREM="#fff3d6";
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};
  const jest=()=>typeof bufor==="function";
  // Grafika motywu albo null (jeszcze się wczytuje).
  const zasob=plik=>Motywy.zasob(ID,plik);
  const KAN=new Map(),KOL=new Map();
  function ka(hex,a){
    const q=Math.round(Math.max(0,Math.min(1,a))*50),k=hex+"|"+q;let s=KOL.get(k);if(s)return s;
    let r=KAN.get(hex);if(!r){const m=/^#([0-9a-f]{6})$/i.exec(hex||""),n=m?parseInt(m[1],16):0x6c4bd6;r=((n>>16)&255)+","+((n>>8)&255)+","+(n&255);KAN.set(hex,r);}
    s="rgba("+r+","+(q/50)+")";KOL.set(k,s);return s;
  }
  const KRESKI_3=[3,2.4],KRESKI_5=[5,3],NITKA=[4,1.6],BEZ=[];

  // ============================================================================================ karta
  // Granatowo-fioletowy filc (szyba, prześwit 0,3): krótkie włókna w dwóch tonach i rzadkie srebrne krzyżyki
  // ściegu (jak haftowane gwiazdki), raz na układ.
  function fakturaKarty(c,L){
    const n=Math.min(1800,Math.round(L.w*L.h/85));c.lineWidth=1;
    for(const [kol,z0] of [["rgba(170,150,255,.07)",1],["rgba(0,0,10,.16)",5]]){
      c.strokeStyle=kol;c.beginPath();
      for(let i=0;i<n;i+=2){const x=L.x+los(i,z0)*L.w,y=L.y+los(i,z0+1)*L.h,a=los(i,z0+2)*TAU,d=2+4*los(i,z0+3);
        c.moveTo(x,y);c.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d);}
      c.stroke();
    }
    const m=Math.min(70,Math.round(L.w*L.h/9000));c.strokeStyle="rgba(220,217,238,.3)";c.lineWidth=1;c.beginPath();
    for(let i=0;i<m;i++){const x=L.x+los(i,21)*L.w,y=L.y+los(i,22)*L.h,r=1.5+1.5*los(i,23);
      c.moveTo(x-r,y-r);c.lineTo(x+r,y+r);c.moveTo(x+r,y-r);c.lineTo(x-r,y+r);}
    c.stroke();
  }

  // ============================================================================================ nuty
  // Włóczkowa kometa: liliowa przędza ze skrętem (skośne nitki z wzoru w pamięci), z przodu (po lewej) złota główka
  // z poszarpanym brzegiem jak rozczesana czesanka, wzdłuż dwie nitki krótkim ściegiem (krem i turkus). Obrys srebrny.
  const WZORY=new Map();
  function wzor(c,nazwa,T,rysuj){
    let p=WZORY.get(nazwa);if(p)return p;
    const cv=document.createElement("canvas");cv.width=cv.height=T*2;const x=cv.getContext("2d");x.scale(2,2);rysuj(x,T);
    p=c.createPattern(cv,"repeat");if(p&&p.setTransform&&typeof DOMMatrix!=="undefined")p.setTransform(new DOMMatrix().scale(.5));
    WZORY.set(nazwa,p);return p;
  }
  const skret=c=>wzor(c,"skret",7,(x,T)=>{
    x.strokeStyle="rgba(255,255,255,.3)";x.lineWidth=1.6;x.beginPath();
    for(const d of [-T,0,T]){x.moveTo(d,T);x.lineTo(d+T,0);}x.stroke();
    x.strokeStyle="rgba(30,10,80,.28)";x.lineWidth=1;x.beginPath();
    for(const d of [-T,0,T]){x.moveTo(d+T*.55,T);x.lineTo(d+T*1.55,0);}x.stroke();
  });
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2,gl=Math.min(w*.4,nh*2.2),z=(o&&o.ziarno)|0;
      c.fillStyle="#a48cf6";c.fillRect(x0-1,y0-1,w+2,nh+2);
      c.fillStyle=ZLOTO;c.beginPath();c.moveTo(x0-1,y0-1);
      for(let i=0;i<=4;i++)c.lineTo(x0+gl*(.75+.35*los(z,i)),y0+nh*i/4);
      c.lineTo(x0-1,y0+nh+1);c.closePath();c.fill();
      c.fillStyle=skret(c);c.fillRect(x0-1,y0-1,w+2,nh+2);
      c.lineCap="round";c.setLineDash(NITKA);c.lineWidth=Math.max(1,nh*.1);
      c.strokeStyle=ka(KREM,.85);c.beginPath();c.moveTo(x0+gl*.6,y0+nh*.24);c.lineTo(x0+w-2,y0+nh*.24);c.stroke();
      c.lineDashOffset=2.6;c.strokeStyle=ka(TURK,.9);c.beginPath();c.moveTo(x0+gl*.9,y0+nh*.5);c.lineTo(x0+w-2,y0+nh*.5);c.stroke();
      c.setLineDash(BEZ);c.lineDashOffset=0;
    },
    brzeg:()=>"#e6e2ff",zapas:()=>0};

  // ============================================================================================ klawisze
  // Granatowy filc: białe klawisze rozdzielone srebrnym ściegiem, czarne z fioletowego filcu obszyte srebrem,
  // klawiatura obszyta. Śpiewany klawisz: złota nić dookoła.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(0,0,0,.45)";c.beginPath();c.roundRect(x+2,y0+3,w,h,4);c.fill();
      c.fillStyle="#262163";c.beginPath();c.roundRect(x,y0,w,h,4);c.fill();
      c.setLineDash(KRESKI_3);c.strokeStyle=ka(SREBRO,.7);c.lineWidth=1;c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){
        const pc=((s%12)+12)%12;if(isBlack(s))continue;
        if(isBlack(s+1)||pc===4||pc===11){const k=prostokatKlawisza(L,s),y=Math.round(k.y)+.5;c.moveTo(x+2,y);c.lineTo(x+w-2,y);}
      }
      c.stroke();c.setLineDash(BEZ);
      for(let s=L.dolN;s<=L.goraN;s++){
        if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);
        c.fillStyle="#4a2f9a";c.beginPath();c.roundRect(k.x,k.y+.5,k.w*.62,Math.max(1,k.h-1),[0,2,2,0]);c.fill();
        c.strokeStyle=ka(SREBRO,.8);c.lineWidth=1;c.setLineDash(KRESKI_3);c.stroke();c.setLineDash(BEZ);
      }
      c.setLineDash(KRESKI_5);c.strokeStyle=ka(SREBRO,.85);c.lineWidth=1.3;c.beginPath();c.roundRect(x+2,y0+2,w-4,h-4,3);c.stroke();c.setLineDash(BEZ);
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),k=prostokatKlawisza(L,s);
      c.setLineDash(KRESKI_3);c.strokeStyle=g.naNucie?ZLOTO:ka(ZLOTO,.6);c.lineWidth=1.4;
      c.beginPath();c.roundRect(k.x+2,k.y+1,k.w-4,Math.max(1,k.h-2),2);c.stroke();c.setLineDash(BEZ);
    }};

  // ============================================================================================ tło
  const tlo={przeswit:.3,rama:{bok:.075,gora:10,dol:8,odstep:6},
    tlo:{promienie:[["185,166,255",.10],["63,208,201",.07]],swiatlo:["170,140,255","60,50,160"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      const im=zasob("tlo.webp");
      c.fillStyle=GRANAT;c.fillRect(0,0,W,H);
      if(!im)return;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      const g=c.createLinearGradient(0,H*.75,0,H);g.addColorStop(0,"rgba(12,10,36,0)");g.addColorStop(1,"rgba(12,10,36,.4)");c.fillStyle=g;c.fillRect(0,H*.75,W,H*.25);
    }};

  // ============================================================================================ widownia
  // Kosmiczni fani: kolejność bez powtórzeń w sąsiedztwie, lustrzane odbicia, lekko różna skala, skok |sin| na
  // ćwierćnuty z przesuniętą fazą (lekko, jak w niskiej grawitacji: wolniejszy, dłuższy łuk), wyżej przy kombo.
  const KOLEJ=new Map();
  function kolejnosc(n){
    let a=KOLEJ.get(n);if(a)return a;a=[];
    for(let i=0;i<n;i++){let k=Math.floor(los(i,7)*6);
      while((i>0&&k===a[i-1].k)||(i>1&&k===a[i-2].k))k=(k+1)%6;
      a.push({k,lustro:(i+(los(i,3)>.7?1:0))%2===1,sk:.9+.15*los(i,5),fz:los(i,9),dx:(los(i,11)-.5)*.2});}
    KOLEJ.set(n,a);return a;
  }
  function fan(k,lustro,h){
    const im=zasob("fan-"+k+".webp");if(!im||!jest())return null;
    const w=Math.max(1,Math.round(h*im.naturalWidth/im.naturalHeight));
    return bufor("mw2-"+ID+"-fan|"+k+"|"+(lustro?1:0)+"|"+h,w,h,c=>{if(lustro){c.translate(w,0);c.scale(-1,1);}c.drawImage(im,0,0,w,h);});
  }
  const pas=(W,h)=>bufor("mw2-"+ID+"-pas|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(12,10,36,0)");g.addColorStop(.6,"rgba(12,10,36,.35)");g.addColorStop(1,"rgba(12,10,36,.65)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.max(8,Math.round(Wd.h*1.04)),mini=!!st.mini;
      if(!mini)c.drawImage(pas(W,Math.round(Wd.h)).cv,0,Wd.y,W,Wd.h);
      const n=mini?(st.n||3):Math.max(4,Motywy.ileFanow(ID,W,h,.86)),krok=W/n,ko=kolejnosc(n);
      const ruch=!st.spokoj&&!st.bezRuchu&&!mini,faza=st.faza||0;
      const amp=ruch?h*(.035+.065*Math.min(1,st.skok||0)+.025*Math.min(3,st.zar||0)+(st.spiewaja?.012:0)):0,dol=Wd.y+Wd.h+h*.03;
      for(let i=0;i<n;i++){
        const o=ko[i],fh=Math.round(h*o.sk),b=fan(o.k,o.lustro,fh);if(!b)continue;
        const sk=amp?Math.sin(PI*((faza*.5+o.fz)%1)):0,x=krok*(i+.5+o.dx)-b.w/2;   // łuk na dwie ćwierćnuty
        Motywy.fan(c,b,x+b.w/2,dol,st,"niewazkosc",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
    }};

  // ============================================================================================ streak
  // Głowa: włóczkowa kometa za głową: pęk nitek (krem, złoto, turkus, róż, liliowy) wygina się do tyłu i lekko
  // faluje, przy ogniu 3 srebrna orbita ściegiem. Ślad: trzy nitki (turkus, róż, złoto) przesunięte w pionie na
  // miękkiej liliowej łunie z gradientu w pamięci. Płonąca nuta: przędza jaśnieje do frontu, front to cekin-gwiazdka.
  const NITKI=[KREM,ZLOTO,TURK,ROZ,LIL,ZLOTO,TURK];
  const lunaGlowy=()=>bufor("mw2-"+ID+"-luna",64,64,c=>{
    const g=c.createRadialGradient(32,32,4,32,32,32);g.addColorStop(0,"rgba(255,240,196,.5)");g.addColorStop(.45,"rgba(185,166,255,.25)");g.addColorStop(1,"rgba(108,75,214,0)");
    c.fillStyle=g;c.fillRect(0,0,64,64);
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
          p.k=Math.floor(Math.random()*6);p.r=Math.round(sc*(.36+.07*og)*(.85+.3*Math.random())/4)*4;
          p.x=pz.x-sc*.12+(Math.random()-.5)*sc*.3;p.y=pz.y-sc*.3;p.vx=-(25+50*Math.random());p.vy=-(40+50*Math.random())*(1+.15*og);
          p.a=(Math.random()-.5)*.6;p.va=(Math.random()-.5)*1.6;p.zy=1.2+.6*Math.random();p.z=p.zy;break;
        }
      }
    }else P.dos=0;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=18*dt;p.a+=p.va*dt;   // niska grawitacja
      const b=iskra(p.k,Math.max(8,p.r));if(!b||p.z<=0)continue;
      const f=1-p.z/p.zy,al=f<.12?f/.12:p.z<.4?p.z/.4:1,s=f<.15?.6+.4*f/.15:1;
      c.globalAlpha=al;c.save();c.translate(p.x,p.y);c.rotate(p.a);c.drawImage(b.cv,-b.w*s/2,-b.h*s/2,b.w*s,b.h*s);c.restore();
    }
    c.globalAlpha=1;
  }
  const streak={
    glowa(c,sc,og,ts,z,przod){
      if(przod)return;
      const cy=-sc*.44,r=sc*(.5+.05*og),n=3+og+(og>=3?1:0);
      c.save();c.translate(0,cy);
      const l=lunaGlowy();c.globalAlpha=.6+.13*og;c.drawImage(l.cv,-r*1.4,-r*1.4,r*2.8,r*2.8);c.globalAlpha=1;
      c.lineCap="round";c.setLineDash([sc*.07,sc*.025]);
      for(let i=0;i<n;i++){   // nitki ogona: od głowy do tyłu (w lewo) i w górę, falują wolno
        const t=(i/(n-1||1))-.5,fal=Math.sin(ts*1.6+i*1.3+z)*sc*.06,dl=sc*(.62+.12*og)*(.8+.3*los(i,z+1));
        c.beginPath();c.moveTo(r*.2,t*r*.5);
        c.bezierCurveTo(-dl*.2,t*r*1.4-sc*.35+fal,-dl*.75,t*r*.6-sc*.05-fal,-dl,t*r*1.2-sc*.3+fal*1.5);
        c.strokeStyle=ka(NOC,.55);c.lineWidth=sc*.075;c.stroke();
        c.strokeStyle=NITKI[i%NITKI.length];c.lineWidth=sc*.05;c.stroke();
      }
      if(og>=3){c.setLineDash(KRESKI_3);c.lineDashOffset=-ts*sc*.25;c.strokeStyle=ka(SREBRO,.9);c.lineWidth=sc*.03;
        c.beginPath();c.ellipse(0,0,r*1.35,r*.55,-.35,0,TAU);c.stroke();c.lineDashOffset=0;}
      c.setLineDash(BEZ);
      c.restore();
    },
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const gr=k.og>=3?2.8:k.og>=2?2.3:1.8;
      c.save();c.lineCap="round";c.lineJoin="round";
      sciezka(c,pts,0);c.strokeStyle=gradX(c,k.x0,k.xT,LIL,.22);c.lineWidth=gr*5;c.stroke();
      c.setLineDash(NITKA);
      sciezka(c,pts,-gr);c.strokeStyle=gradX(c,k.x0,k.xT,TURK,.95);c.lineWidth=gr;c.stroke();
      c.lineDashOffset=2;sciezka(c,pts,0);c.strokeStyle=gradX(c,k.x0,k.xT,ZLOTO,.95);c.stroke();
      c.lineDashOffset=4;sciezka(c,pts,gr);c.strokeStyle=gradX(c,k.x0,k.xT,ROZ,.9);c.stroke();
      c.restore();
    },
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+2){c.fillStyle=ka(ZLOTO,.35);c.fillRect(x0,-nh/2,fx-x0,nh);
        c.setLineDash(NITKA);c.strokeStyle=ka(KREM,.9);c.lineWidth=1.2;c.beginPath();c.moveTo(x0+2,0);c.lineTo(fx,0);c.stroke();c.setLineDash(BEZ);}
      if(gas>0){const b=iskra(3,24);if(b){const s=nh*(aktywna?1.5:1.1);c.globalAlpha=gas;c.drawImage(b.cv,fx-s/2,-s/2,s,s);c.globalAlpha=1;}}
    },
    tor(c,L,g,st){if(st&&!st.spokoj)czastki(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{lunaGlowy();}catch(e){}},
    aura:[LIL,TURK],wypelnienie:[KREM,ZLOTO,LIL],iskry:{kolory:[KREM,ZLOTO,TURK]},dym:false,
    scena:["185,166,255","63,208,201","255,207,74"],
    tlo:{promienie:[["185,166,255",.10],["63,208,201",.07]],swiatlo:["170,140,255","60,50,160"]}};

  Motywy.dodaj({id:ID,nazwa:"Kosmos",kolejnosc:9,kolor:"#6c4bd6",
    zasoby:["tlo.webp","zaba-0.webp","zaba-1.webp","fan-0.webp","fan-1.webp","fan-2.webp","fan-3.webp","fan-4.webp","fan-5.webp",
      "iskra-0.webp","iskra-1.webp","iskra-2.webp","iskra-3.webp","iskra-4.webp","iskra-5.webp"],zaba:true,przebranie:true,
    opis:"Finał: kosmos z filcu i włóczki. Planety, gwiazdy z guzików i cekinów, gwiazdozbiory haftowane srebrną nicią, nuty jak włóczkowe komety i kosmiczni fani w skafandrach.",
    cechy:{tlo:"filcowe planety",klawisze:"srebrny ścieg",streak:"włóczkowa kometa",widownia:"kosmiczni fani"},
    en:{nazwa:"Space",
      opis:"The finale: space made of felt and yarn. Planets, stars of buttons and sequins, constellations embroidered in silver thread, notes like yarn comets and space fans in spacesuits.",
      cechy:{tlo:"felt planets",klawisze:"silver stitching",streak:"yarn comet",widownia:"space fans"}},
    karta:{papier:GRANAT,cien:"rgba(0,0,0,.45)",czarne:"rgba(0,0,20,.22)",liniaC:"rgba(185,175,255,.26)",minione:"rgba(0,0,15,.3)",
      nazwy:"rgba(225,225,255,.8)",kreski:"rgba(185,166,255,.28)",nic:ZLOTO,szpilka:ZLOTO,szpilkaBlask:"#ffffff",
      cienNuty:"rgba(0,0,10,.45)",scieg:"rgba(220,217,238,.5)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
