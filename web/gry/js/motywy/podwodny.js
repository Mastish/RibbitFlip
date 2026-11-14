// Motyw „Podwodny” (runda 2, 10-09 wieczór): rafa z turkusowego filcu. Ilustracja dna morza (tlo.webp) na cały ekran,
// karta toru to ciemniejsza turkusowa szyba z włóknami filcu i jasnym ściegiem. Nuty: pasy koralowego filcu z perłowym
// koralikiem na początku i przeszyciem kremową nicią. Klawiatura z filcu w kolorze morskiej piany, czarne klawisze z
// granatowego filcu z perełką. Widownia: sześciu nurków i plażowiczów (fan-*.webp) podskakuje w rytm. Streak: za głową
// unoszą się guziki i perły jak bąbelki, wylatują drobiazgi z iskra-*.webp (rybka, muszelka, rozgwiazda), za żabą
// zostaje sznur pereł na nici. Wszystko stałe w bufor(), w klatce tylko drawImage.
(function(){
  "use strict";
  const ID="podwodny",PI=Math.PI,TAU=2*PI;
  const GRANAT="#0b2a36",KORAL="#ff7a5c",KORAL_C="#8a2c20",PIANA="#e2f3ee",PERLA="#f6efe2",TURKUS="#2bb3c0";
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
    let s=192837465;const r=()=>(s=(Math.imul(s,1103515245)+12345)>>>0)/4294967296;
    x.lineCap="round";
    for(let i=0;i<ile;i++){
      const px=r()*96,py=r()*96,a=r()*TAU,l=2+r()*5,lw=.5+r()*.7;
      x.strokeStyle=i%2?jasne:ciemne;x.lineWidth=lw;x.beginPath();
      for(const [dx,dy] of [[0,0],[-96,0],[0,-96],[-96,-96]]){x.moveTo(px+dx,py+dy);x.lineTo(px+dx+Math.cos(a)*l,py+dy+Math.sin(a)*l);}
      x.stroke();
    }
    return cv;
  }
  const WZORY=new Map();
  function wzor(c,klucz,tworz){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");WZORY.set(klucz,w);}
    return w;
  }
  const filc=c=>wzor(c,"filc",()=>kafelekFilcu("rgba(255,255,255,.22)","rgba(20,30,40,.14)",260));
  const filcKarty=c=>wzor(c,"filcK",()=>kafelekFilcu("rgba(190,250,250,.16)","rgba(0,20,30,.16)",220));

  // =========================================================================================== sprite'y
  // Perła-koralik: kremowa kulka z perłowym odblaskiem i cieniem od dołu.
  const perla=()=>bufor("pw-perla",32,32,c=>{
    const g=c.createRadialGradient(12,11,1,16,16,15);g.addColorStop(0,"#ffffff");g.addColorStop(.45,PERLA);g.addColorStop(.85,"#d9cdb8");g.addColorStop(1,"#a99a80");
    c.fillStyle=g;c.beginPath();c.arc(16,16,14,0,TAU);c.fill();
    c.strokeStyle="rgba(11,42,54,.55)";c.lineWidth=1.2;c.stroke();
    c.fillStyle="rgba(255,190,220,.25)";c.beginPath();c.ellipse(19,21,7,4,-.6,0,TAU);c.fill();
    c.fillStyle="#ffffff";c.beginPath();c.arc(11,10,3,0,TAU);c.fill();
  });
  // Guzik z filcu: turkusowy krążek z obwódką, cztery dziurki i krzyżyk nici (zamiast szklanego bąbelka).
  const guzik=k=>bufor("pw-guzik|"+k,32,32,c=>{
    const kol=["#3fc1c9","#8fe0dc","#f2b8a8"][k%3];
    c.fillStyle=kol;c.beginPath();c.arc(16,16,14,0,TAU);c.fill();
    c.strokeStyle="rgba(11,42,54,.6)";c.lineWidth=1.4;c.stroke();
    c.strokeStyle="rgba(255,255,255,.55)";c.lineWidth=1.2;c.beginPath();c.arc(16,16,10.5,0,TAU);c.stroke();
    c.fillStyle="rgba(11,42,54,.75)";c.beginPath();for(const [x,y] of [[12.5,12.5],[19.5,12.5],[12.5,19.5],[19.5,19.5]]){c.moveTo(x+1.7,y);c.arc(x,y,1.7,0,TAU);}c.fill();
    c.strokeStyle=PERLA;c.lineWidth=1.3;c.beginPath();c.moveTo(12.5,12.5);c.lineTo(19.5,19.5);c.moveTo(19.5,12.5);c.lineTo(12.5,19.5);c.stroke();
  });
  const blask=()=>bufor("pw-blask",64,64,c=>{
    const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,"rgba(120,225,230,.4)");g.addColorStop(.5,"rgba(43,179,192,.2)");g.addColorStop(1,"rgba(43,179,192,0)");
    c.fillStyle=g;c.fillRect(0,0,64,64);
  });
  const iskra=i=>{const im=obraz("iskra-"+i+".webp");return im?bufor("pw-iskra|"+i,44,44,c=>c.drawImage(im,0,0,44,44)):null;};

  // =========================================================================================== tło
  const tlo={przeswit:.24,rama:{bok:.075,odstep:12},
    tlo:{promienie:[["170,240,255",.10],["120,230,200",.08]],swiatlo:["90,210,220","20,100,140"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#1a7f8c";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.55);
      const g=c.createRadialGradient(W/2,H*.42,Math.min(W,H)*.3,W/2,H*.42,Math.hypot(W,H)*.6);
      g.addColorStop(0,"rgba(4,30,40,0)");g.addColorStop(1,"rgba(4,30,40,.28)");
      c.fillStyle=g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Ciemniejsza turkusowa szyba (kontrast dla koralowych nut): sama faktura filcu, jaśniej u góry jak pod taflą.
  function fakturaKarty(c,L){
    c.fillStyle=filcKarty(c);c.fillRect(L.x,L.y,L.w,L.h);
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h*.6);g.addColorStop(0,"rgba(190,250,250,.10)");g.addColorStop(1,"rgba(190,250,250,0)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h*.6);
  }

  // =========================================================================================== nuty
  // Koralowy filc z ciemnym obrysem, kremowe przeszycie przy brzegach i perłowy koralik na początku taśmy.
  const KOLORY_NUT=[KORAL,"#ff8f5e","#f56a5e"];
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2;
      c.fillStyle=KOLORY_NUT[(o.ziarno|0)%3];c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=filc(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.strokeStyle=KORAL_C;c.lineWidth=Math.max(2.4,Math.min(4,nh*.22));c.stroke();
      const r=nh*.34,px=x0+Math.max(nh*.5,r+2);
      if(nh>=9&&w>=nh*2){const m=Math.max(3,nh*.22),xs=px+r+2;
        c.beginPath();c.moveTo(xs,y0+m);c.lineTo(w/2-m,y0+m);c.moveTo(xs,-y0-m);c.lineTo(w/2-m,-y0-m);
        c.setLineDash([3,2.5]);c.strokeStyle="rgba(255,244,230,.85)";c.lineWidth=1.1;c.stroke();c.setLineDash([]);}
      if(w>=nh*1.2&&jest()){const p=perla();c.drawImage(p.cv,px-r,-r,2*r,2*r);}
    },
    brzeg:()=>KORAL_C,zapas:()=>0};

  // =========================================================================================== klawisze
  // Filc w kolorze morskiej piany, czarne klawisze z granatowego filcu z perełką na końcu, ścieg przy brzegu.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(0,25,35,.4)";c.beginPath();c.roundRect(x+2,y0+3,w,h,5);c.fill();
      c.fillStyle=PIANA;c.beginPath();c.roundRect(x,y0,w,h,5);c.fill();c.fillStyle=filc(c);c.fill();
      c.fillStyle="#14495a";
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.beginPath();c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,3,3,0]);c.fill();}
      c.fillStyle=filc(c);
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.fillRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2));}
      c.fillStyle="rgba(11,42,54,.35)";
      for(let s=L.dolN;s<=L.goraN;s++){const pc=((s%12)+12)%12;if(isBlack(s)||!(isBlack(s+1)||pc===4||pc===11))continue;
        const k=prostokatKlawisza(L,s);c.fillRect(k.x,Math.round(k.y)-.5,k.w,1);}
      if(L.rh>=6){const p=perla();
        for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s),r=Math.min(k.h*.36,k.w*.1);c.drawImage(p.cv,k.x+k.w*.62-r*2.4,k.y+k.h/2-r,2*r,2*r);}}
      c.strokeStyle=GRANAT;c.lineWidth=1.8;c.beginPath();c.roundRect(x,y0,w,h,5);c.stroke();
      c.setLineDash([3,2.5]);c.strokeStyle="rgba(11,42,54,.4)";c.lineWidth=1;c.beginPath();c.roundRect(x+3,y0+3,w-6,h-6,3);c.stroke();c.setLineDash([]);
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2;
      c.fillStyle=g.naNucie?"rgba(255,122,92,.8)":"rgba(255,122,92,.45)";c.fillRect(L.kx+1,y+.5,L.kw-2,Math.max(1,L.rh-1));
      c.strokeStyle=KORAL_C;c.lineWidth=1.6;c.strokeRect(L.kx+1,y+.5,L.kw-2,Math.max(1,L.rh-1));
    }};

  // =========================================================================================== widownia
  // Fani z fan-*.webp: kolejność z ziarnem bez powtórzeń obok siebie, część odbita, lekko różna skala; skok |sin|
  // na ćwierćnuty z przesuniętymi fazami (jak unoszenie w wodzie), wyżej przy kombo i brawach, w spokoju stoją.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=11;
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
    return bufor("pw-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{if(lustro){c.translate(w,0);c.scale(-1,1);}c.drawImage(im,0,0,w,h);});
  }
  const podloga=(W,h)=>bufor("pw-podl|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(4,30,40,0)");g.addColorStop(1,"rgba(4,30,40,.4)");
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
        Motywy.fan(c,b,krok*(i+.5),Wd.y+h+hh*.1,st,"fala",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
    }};

  // =========================================================================================== streak
  // Głowa: poświata, guziki i perły unoszą się jak bąbelki, drobiazgi z iskra-*.webp wypływają wachlarzem
  // (tor z czasu i ziarna, bez alokacji). Ślad: nić z perłami w świeższej części, rybka z iskra-2 płynie za żabą.
  const GRAD=new Map();
  function gradSladu(c,x0,x1){
    const k=Math.round(x0)*1e5+Math.round(x1);let g=GRAD.get(k);
    if(!g){if(GRAD.size>32)GRAD.clear();g=c.createLinearGradient(x0,0,x1,0);g.addColorStop(0,"rgba(230,255,250,0)");g.addColorStop(1,"rgba(240,255,250,.85)");GRAD.set(k,g);}
    return g;
  }
  const streak={
    glowa(c,sc,og,ts,z,przod){
      if(przod||!jest())return;
      const bl=blask(),rb=sc*(.8+.12*og);
      c.globalAlpha=.5+.15*Math.sin(ts*4);c.drawImage(bl.cv,-rb,-sc*.35-rb,2*rb,2*rb);
      const nb=og>=3?7:5;
      for(let j=0;j<nb;j++){   // guziki i perły: w górę zza głowy, lekko się kołyszą
        const p=ul(ts*.5+j/nb+los(z,j)*.2),x=(los(z,j+3)-.5)*sc*.8+Math.sin(ts*2.4+j*2)*sc*.06,y=-sc*.6-p*sc*1.3,r=sc*(.06+.05*los(z,j+5))*(.7+.6*p);
        const b=j%2?perla():guzik(j>>1);
        c.globalAlpha=p<.12?p/.12:1-Math.pow((p-.12)/.88,2);c.drawImage(b.cv,x-r,y-r,2*r,2*r);
      }
      const n=og>=3?6:og>=2?4:2;
      for(let j=0;j<n;j++){
        const im=iskra((j+z)%ISKRY);if(!im)continue;
        const p=ul(ts*.42+j/n+los(z,j+20)*.25),a=-PI/2+(los(z,j+9)-.5)*2.4,d=sc*(.5+1*p);
        const s=sc*(.24+.07*los(z,j+13))*(og>=3?1.1:1)*(p<.15?.4+4*p:1);
        c.globalAlpha=p<.1?p*10:1-p*p;c.drawImage(im.cv,Math.cos(a)*d-s/2,-sc*.35+Math.sin(a)*d*.8-s/2,s,s);
      }
      c.globalAlpha=1;
    },
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      c.lineCap="round";c.lineJoin="round";c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.strokeStyle=gradSladu(c,k.x0,k.xT);c.lineWidth=k.og>=3?2.2:1.6;c.setLineDash([4,4]);c.stroke();c.setLineDash([]);
      if(!jest())return;
      const b=perla(),krok=k.og>=3?18:24;let ost=-1e9,nr=0;   // perły nawleczone na nić
      for(const p of pts){if(!p.sp||p.x-ost<krok||p.x<k.x0+k.dlug*.35)continue;ost=p.x;nr++;
        const f=(p.x-k.x0)/k.dlug,r=2.4+1.8*los(nr,k.ziarno)+1.2*f;c.globalAlpha=Math.min(1,f*1.4);
        c.drawImage(b.cv,p.x-r,p.y-r,2*r,2*r);}
      c.globalAlpha=1;
      if(k.og>=2&&k.pelna!==false){const im=iskra(2);   // rybka płynie tuż za żabą
        if(im){const s=k.og>=3?26:20,x=k.xT-38-Math.sin(k.ts*1.7)*6,y=k.pts[k.pts.length-1].y-10+Math.sin(k.ts*3.1)*4;c.drawImage(im.cv,x-s/2,y-s/2,s,s);}}
    },
    // płonąca nuta: zaśpiewana część zalewa się turkusową wodą z guzikami
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(18,120,140,.55)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas<=0||!jest())return;
      const b=guzik(1);
      for(let j=0;j<2;j++){const f=ul(ts*1.1+j/2+z*.13),r=nh*(.18+.12*f)*(aktywna?1:.8);c.globalAlpha=gas*(1-f);c.drawImage(b.cv,fx-r+Math.sin(f*5+j)*2,-nh/2-f*nh*1.6-r,2*r,2*r);}
      c.globalAlpha=1;
    },
    rozgrzej(){if(!jest())return;try{perla();blask();for(let k=0;k<3;k++)guzik(k);for(let i=0;i<ISKRY;i++)iskra(i);}catch(e){}},
    aura:[TURKUS,"#bff6f2"],wypelnienie:["#e9fffd","#7fe3e6",TURKUS],
    iskry:{kolory:["#7fdbe0","#3fb3c0","#1f7f8c"],ksztalt:"babel"},dym:false,
    scena:["150,240,245","43,179,192","255,122,92"],
    tlo:{promienie:[["170,240,255",.10],["120,230,200",.08]],swiatlo:["90,210,220","20,100,140"]}};

  Motywy.dodaj({id:"podwodny",nazwa:"Podwodny",kolejnosc:5,kolor:"#2bb3c0",zasoby:ZASOBY,zaba:true,przebranie:true,
    opis:"Rafa z turkusowego filcu: karta jak szyba akwarium, nuty z koralowego filcu z perłą, wodorosty z włóczki, nurkowie na widowni i perły unoszące się zza głowy przy kombo.",
    cechy:{tlo:"filcowa rafa",klawisze:"morska piana i perły",streak:"perły i guziki",widownia:"nurkowie"},
    en:{nazwa:"Underwater",
      opis:"A reef of turquoise felt: the card is an aquarium pane, notes of coral felt with a pearl, yarn seaweed, divers in the crowd and pearls rising from behind your head on a combo.",
      cechy:{tlo:"felt reef",klawisze:"sea foam and pearls",streak:"pearls and buttons",widownia:"divers"}},
    karta:{papier:"#0e5d69",cien:"rgba(0,20,30,.28)",czarne:"rgba(0,25,40,.18)",liniaC:"rgba(210,255,255,.22)",minione:"rgba(0,25,40,.2)",
      nazwy:"rgba(225,252,255,.82)",kreski:"rgba(210,250,255,.22)",nic:KORAL,szpilka:PERLA,szpilkaBlask:"#ffffff",
      cienNuty:"rgba(0,20,30,.4)",scieg:"rgba(220,252,255,.45)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
