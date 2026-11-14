// Motyw „Kuchnia” (runda 5, 10-17): włoska kuchnia restauracyjna z filcu. Tło to ilustracja (tlo.webp: piec do pizzy
// z ogniem, półki ze słoikami i oliwą, garnki, wiszące czosnki i papryczki, biała kafelkowa ściana, kraciasty obrus u
// góry). Karta toru to biała kafelkowa ściana kuchni: kremowa szyba z lekko mnożoną kratką obrusu (faktura.webp), fugi
// ze ściegu i ciepły blask pieca u góry. Nuty: wstęgi makaronu tagliatelle (żółte, z cieniem walca i mąką, końce
// falują z ziarna), zaśpiewana część oblana sosem pomidorowym. Klawiatura: białe kafle z fugami, czarne deski do krojenia
// z oliwnego drewna z otworem do zawieszenia, całość na kraciastym obrusie. Widownia: krewetka, papryczka, pomidor,
// marchewka i dwa noże (fan-0..5.webp) tańczą na pasie obrusu. Streak (detal PODPISOWY): ślad to strużka oliwy z
// bazylią pod parą z patelni; z toru lecą pizza, widelec ze spaghetti, pomidor, ser, papryczka i bazylia (iskra-0..5).
// Głowa bez efektu: żabę ubiera przebranie motywu. Wszystko z buforów.
(function(){
  "use strict";
  const ID="kuchnia",PI=Math.PI,TAU=2*PI;
  const POM="#d8362a",POM_C="#8f1d16",KAFEL="#f3e9cf",MAK="#f4c542",MAK_C="#7a4a10",
    DESKA="#4a3320",DESKA_C="#2b1c10",FUGA="rgba(150,108,66,.55)",PIEC="#ff8a2e";
  const FANY=6,ISKRY=6;
  const ZASOBY=["tlo.webp","faktura.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5],PARA=[4,3];   // kreski bez nowych tablic w klatce

  // =========================================================================================== wzory (raz)
  const WZORY=new Map();
  function wzor(c,klucz,tworz,skala){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");if(skala&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix().scale(skala));WZORY.set(klucz,w);}
    return w;
  }
  // Makaron: podłużne smużki ciasta, ziarenka mąki i żółtka (kafel 56 × 16, zawija się bez szwu).
  function kafelekMakaronu(){
    const cv=document.createElement("canvas");cv.width=56;cv.height=16;const x=cv.getContext("2d");
    x.strokeStyle="rgba(176,112,18,.3)";x.lineWidth=.9;
    for(const y of [3.5,8,12.5]){x.beginPath();x.moveTo(0,y);x.quadraticCurveTo(14,y-1.5,28,y);x.quadraticCurveTo(42,y+1.5,56,y);x.stroke();}
    x.fillStyle="rgba(255,248,222,.75)";for(let i=0;i<14;i++)x.fillRect(los(i,1)*55,los(i,2)*15,1.3,1.1);
    x.fillStyle="rgba(196,118,20,.4)";for(let i=0;i<6;i++)x.fillRect(los(i,5)*55,los(i,6)*15,1.4,1.2);
    return cv;
  }
  // Drewno oliwne: poziome słoje (kafel 64 × 24).
  function kafelekDrewna(){
    const cv=document.createElement("canvas");cv.width=64;cv.height=24;const x=cv.getContext("2d");
    x.strokeStyle="rgba(20,10,4,.5)";x.lineWidth=.9;
    for(const y of [3,8.5,14,20]){x.beginPath();x.moveTo(0,y);x.quadraticCurveTo(16,y-2.2,32,y+.6);x.quadraticCurveTo(48,y+3,64,y);x.stroke();}
    x.strokeStyle="rgba(190,140,80,.28)";x.lineWidth=.7;
    for(const y of [6,17]){x.beginPath();x.moveTo(0,y);x.quadraticCurveTo(20,y+2,40,y-1);x.quadraticCurveTo(52,y-2,64,y);x.stroke();}
    return cv;
  }
  const makaron=c=>wzor(c,"makaron",kafelekMakaronu);
  const drewno=c=>wzor(c,"drewno",kafelekDrewna);
  // kratka obrusu z faktura.webp (kafel 512), skala zależna od użycia; zanim się wczyta: null
  function obrus(c,klucz,skala){
    const im=obraz("faktura.webp");
    return im?wzor(c,klucz,()=>im,skala):null;
  }

  // =========================================================================================== sprite'y
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("ku-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.07,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["255,150,70",.10],["216,54,42",.05]],swiatlo:["255,200,140","216,70,50"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#efe2c2";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(60,20,8,0)");g.addColorStop(1,"rgba(60,20,8,.26)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Biała ściana kuchni: kratka obrusu mnożona lekko na krem, kafle 72 px z fugami ze ściegu (przerywana kreska
  // i jasna krawędź), u góry blask pieca, na dole cień. Rysowane RAZ na układ.
  const KAFLA=72;
  function fakturaKarty(c,L){
    const wz=obrus(c,"karta",.5);
    if(wz){c.globalCompositeOperation="multiply";c.globalAlpha=.09;c.fillStyle=wz;c.fillRect(L.x,L.y,L.w,L.h);c.globalCompositeOperation="source-over";c.globalAlpha=1;}
    c.lineWidth=1;c.beginPath();
    for(let x=L.x+KAFLA/2;x<L.x+L.w;x+=KAFLA){c.moveTo(Math.round(x)+.5,L.y);c.lineTo(Math.round(x)+.5,L.y+L.h);}
    for(let y=L.y+KAFLA/2;y<L.y+L.h;y+=KAFLA){c.moveTo(L.x,Math.round(y)+.5);c.lineTo(L.x+L.w,Math.round(y)+.5);}
    c.strokeStyle="rgba(255,252,240,.7)";c.stroke();
    c.setLineDash(SCIEG);c.strokeStyle=FUGA;c.stroke();c.setLineDash(BRAK);
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,130,40,.16)");g.addColorStop(.32,"rgba(255,130,40,0)");g.addColorStop(.75,"rgba(110,60,20,0)");g.addColorStop(1,"rgba(110,60,20,.16)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
  }

  // =========================================================================================== nuty
  // Wstęga tagliatelle: żółte ciasto (trzy odcienie z ziarna), smużki i mąka z wzoru, cień walca, końce falują
  // (faliste ciemniejsze brzegi z ziarna). Ciemnobrązowy obrys odcina żółć od kremowej karty.
  const CIASTO=[MAK,"#f0b52a","#f7d45e"];
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,252,225,.45)");g.addColorStop(.3,"rgba(255,252,225,0)");g.addColorStop(.62,"rgba(140,80,10,.1)");g.addColorStop(1,"rgba(120,64,6,.5)");
      WALEC.set(k,g);}
    return g;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2,z=o.ziarno|0;
      c.fillStyle=CIASTO[z%3];c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=makaron(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      // końce: faliste brzegi wstęgi (faza i częstość z ziarna)
      const ph=los(z,1)*TAU,ph2=los(z,2)*TAU,fq=.5+.25*los(z,3),a=Math.min(2.2,nh*.14),x1=-x0;
      c.beginPath();c.moveTo(x0-2,y0-2);
      for(let y=y0-2;y<=y0+nh+2;y+=3)c.lineTo(x0+3+Math.sin(y*fq+ph)*a,y);
      c.lineTo(x0-2,y0+nh+2);c.closePath();
      c.moveTo(x1+2,y0-2);
      for(let y=y0-2;y<=y0+nh+2;y+=3)c.lineTo(x1-3+Math.sin(y*fq+ph2)*a,y);
      c.lineTo(x1+2,y0+nh+2);c.closePath();
      c.fillStyle="rgba(160,92,8,.4)";c.fill();
    },
    brzeg:()=>MAK_C,zapas:()=>0};

  // =========================================================================================== klawisze
  // Kraciasty obrus pod spodem, białe klawisze to kafle (krem z fugami i ściegiem), czarne to deski do krojenia z
  // oliwnego drewna z otworem na zawieszenie. Gracz: pas sosu pomidorowego ze ściegiem.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(60,24,10,.4)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle="#e8c2b8";c.fill();
      const wz=obrus(c,"klaw",.36);
      if(wz){c.save();c.clip();c.fillStyle=wz;c.fillRect(x,y0,w,h);c.restore();}
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,"#fffaf0");grad.addColorStop(.65,"#f4e8cc");grad.addColorStop(1,"#dccba6");
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,4));
      }
      c.fillStyle=grad;c.fill();c.strokeStyle="rgba(120,84,48,.6)";c.lineWidth=1;c.stroke();
      // deski do krojenia
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,5,5,0]);}
      c.fillStyle=DESKA;c.fill();c.save();c.clip();c.fillStyle=drewno(c);c.fillRect(x,y0,w,h);c.restore();
      c.strokeStyle=DESKA_C;c.lineWidth=1.2;c.stroke();
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s),r=Math.max(1.2,Math.min(3,k.h*.2));c.moveTo(k.x+k.w*.62-r*2.4+r,k.y+k.h/2);c.arc(k.x+k.w*.62-r*2.4,k.y+k.h/2,r,0,TAU);}
      c.fillStyle="rgba(240,226,190,.8)";c.fill();
      c.setLineDash(SCIEG);c.strokeStyle="rgba(255,248,226,.85)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=POM_C;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(216,54,42,.92)":"rgba(216,54,42,.52)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?"#fff3d6":"rgba(143,29,22,.6)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Warzywa, krewetka i noże z fan-*.webp na pasie kraciastego obrusu. Kolejność z ziarnem bez sąsiadów-bliźniaków,
  // odbicia i skala z ziarna. Warzywa skaczą (`skok`), noże wbijają się w rytm jak w komiksie (`pop`).
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=53;
    while(r.length<n){
      const p=[];for(let i=0;i<FANY;i++)p.push(i);for(let i=FANY-1;i>0;i--){const j=Math.floor(los(z,i)*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}z++;
      if(p[0]===ost){const t=p[0];p[0]=p[FANY-1];p[FANY-1]=t;}
      for(const f of p){if(r.length>=n)break;const k=r.length;
        r.push({f,lustro:los(k,3)>.5,sk:.86+.14*los(k,4),dx:(los(k,8)-.5)*.16});ost=f;}
    }
    RZAD.set(n,r);return r;
  }
  function fan(i,h,lustro){
    const im=obraz("fan-"+i+".webp");if(!im||!jest())return null;
    const s=h/im.naturalHeight,w=Math.max(1,Math.round(im.naturalWidth*s));
    return bufor("ku-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  // pas obrusu: kraciasty materiał z falistą krawędzią z kremowego ściegu, cień od góry (raz na rozmiar)
  const pas=(W,h)=>bufor("ku-pas|"+W+"x"+h,W,h,c=>{
    const y=h*.74,lin=o=>x=>y+o+Math.sin(x*.021)*h*.025+Math.sin(x*.0061+1)*h*.035;
    const fala=o=>{const f=lin(o);c.beginPath();c.moveTo(0,h);c.lineTo(0,f(0));
      for(let x=0;x<=W;x+=20)c.lineTo(x,f(x));c.lineTo(W,h);c.closePath();};
    fala(-3);c.fillStyle="rgba(60,24,10,.3)";c.fill();
    fala(0);c.fillStyle="#f3dcd2";c.fill();
    const wz=obrus(c,"pas",.5);if(wz){c.fillStyle=wz;c.fill();}
    const g=c.createLinearGradient(0,y-6,0,h);g.addColorStop(0,"rgba(60,24,10,.18)");g.addColorStop(1,"rgba(60,24,10,.3)");c.fillStyle=g;c.fill();
    const f=lin(5);c.beginPath();for(let x=0;x<=W;x+=20){if(x)c.lineTo(x,f(x));else c.moveTo(x,f(x));}
    c.strokeStyle="rgba(255,248,226,.9)";c.lineWidth=1.3;c.setLineDash(SCIEG);c.stroke();c.setLineDash(BRAK);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.95)),krok=W/n,R0=rzad(n),dno=Wd.y+h*.98;
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,r.f>=4?"pop":"skok",i);
      }
      c.drawImage(pas(W,h).cv,0,Wd.y,W,h);   // obrus na wierzchu: tancerze stoją na nim po kostki
    }};

  // =========================================================================================== streak
  // Ślad: strużka oliwy z patelni (ciemny cień, oliwkowo-złoty pas falujący w czasie, jasny refleks) i para z patelni
  // unosząca się nad nią obrysowanymi obłoczkami; przy wyższym kombo na strużce leżą listki bazylii (iskra-5).
  const streak={
    glowa(){},
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),sz=k.og>=3?6:k.og>=2?5:4,ts=k.ts;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}const y=p.y+Math.sin(p.x*.05-ts*4)*2.2;if(pi)c.lineTo(p.x,y);else{c.moveTo(p.x,y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+2.8;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=sz;c.stroke();
      c.setLineDash(PARA);c.lineDashOffset=-ts*14;c.strokeStyle=g.c;c.lineWidth=Math.max(1.2,sz*.3);c.stroke();c.setLineDash(BRAK);c.lineDashOffset=0;
      // para: do ośmiu obłoczków unoszących się nad śladem, im bliżej żaby, tym większe
      let ost=-1e9,nr=0;
      c.strokeStyle="rgba(176,128,84,.55)";c.lineWidth=.9;
      for(const p of pts){
        if(!p.sp||p.x-ost<44||p.x<k.x0)continue;ost=p.x;
        const f=(p.x-k.x0)/k.dlug;if(f<.12||f>.97)continue;
        if(++nr>8)break;
        const t=(ts*.55+nr*.37)%1,r=(2.6+4*f)*(.6+.7*t);
        c.globalAlpha=.8*(1-t);c.fillStyle="#fffaf0";
        c.beginPath();c.arc(p.x+Math.sin(ts*2+nr)*3,p.y-5-t*(14+14*f),r,0,TAU);c.fill();c.stroke();
      }
      c.globalAlpha=1;
      if(!jest()||k.og<2)return;
      const li=iskra(5,32);let ol=-1e9,nl=0;
      if(li)for(const p of pts){
        if(!p.sp||p.x-ol<60||p.x<k.x0)continue;ol=p.x;
        const f=(p.x-k.x0)/k.dlug;if(f<.2||f>.86)continue;
        if(++nl>5)break;
        const s=9+7*f,y=p.y+Math.sin(p.x*.05-ts*4)*2.2;
        c.save();c.translate(p.x,y);c.rotate(Math.sin(ts*2+p.x*.03)*.5+nl);c.drawImage(li.cv,-s/2,-s/2,s,s);c.restore();
      }
      const pz=iskra(0,48);if(!pz||k.og<3||k.pelna===false)return;
      const r=11,x=k.xT-34,y=ySladu(pts,x);if(y==null)return;
      c.save();c.translate(x,y-r*.5);c.rotate(Math.sin(ts*3)*.3-.3);c.drawImage(pz.cv,-r,-r,2*r,2*r);c.restore();
    },
    // płonąca nuta: zaśpiewana część oblana sosem pomidorowym (gęste plamy i refleksy), na froncie pomidor
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){
        c.fillStyle="rgba(206,40,28,.7)";c.fillRect(x0,-nh/2,fx-x0,nh);
        const n=Math.min(7,Math.floor((fx-x0)/14));
        for(let i=0;i<n;i++){
          const x=x0+(i+.5)*(fx-x0)/n,y=-nh/2+nh*(.22+.56*los(z,i+3)),r=nh*(.1+.1*los(z,i+9));
          c.fillStyle="rgba(120,16,12,.5)";c.beginPath();c.arc(x,y,r,0,TAU);c.fill();
          c.fillStyle="rgba(255,206,180,.6)";c.beginPath();c.arc(x-r*.35,y-r*.4,r*.32,0,TAU);c.fill();
        }
        c.fillStyle="rgba(150,22,16,.9)";c.beginPath();c.arc(fx,0,nh*.28,-PI/2,PI/2);c.fill();
      }
      if(gas>.05&&jest()){
        const im=iskra(2,48),s=nh*(aktywna?1.5:1.15);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.6,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)przysmakiToru(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(0,48);iskra(2,48);iskra(5,32);}catch(e){}},
    aura:["#fff3d6",PIEC],wypelnienie:["#fff6e2","#ffcf8a",POM],
    iskry:{kolory:["#fff3d6",POM,MAK]},dym:false,
    scena:["216,54,42","255,236,200","240,150,60"],
    tlo:{promienie:[["255,150,70",.10],["216,54,42",.05]],swiatlo:["255,200,140","216,70,50"]}};

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
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(70,50,8,0)");a.addColorStop(.5,"rgba(70,50,8,.5)");a.addColorStop(1,"rgba(60,42,6,.85)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(200,169,42,0)");b.addColorStop(.5,"rgba(200,169,42,.9)");b.addColorStop(1,"rgba(222,190,50,1)");
    const d=c.createLinearGradient(x0,0,xT,0);d.addColorStop(0,"rgba(255,246,170,0)");d.addColorStop(.5,"rgba(255,246,170,.85)");d.addColorStop(1,"rgba(255,252,210,.95)");
    g={a,b,c:d};GRAD.set(kl,g);return g;
  }

  // ---- przysmaki z kuchni: pula na gracza, bez alokacji w klatce ----
  // Pizza, widelec ze spaghetti, pomidor, ser, papryczka i bazylia (iskra-0..5) wylatują zza żaby w górę i do tyłu,
  // wirując, i opadają łukiem jak podrzucone na patelni; pomidory i pizza częściej. Na progu kombo co 4 nuty trzy naraz.
  const PULE=new WeakMap(),MAKS_CZ=10,TEMPO=[0,1,2,3.4],LOSUJ=[0,0,1,2,2,3,4,4,5,2];
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
  function przysmakiToru(c,L,g,st){
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

  Motywy.dodaj({id:ID,nazwa:"Kuchnia",kolejnosc:21,kolor:"#d8362a",zasoby:ZASOBY,przebranie:true,
    opis:"Włoska kuchnia z filcu: piec do pizzy, półki ze słoikami i oliwą, garnki i kraciasty obrus, a w widowni tańczą krewetka, papryczka, pomidor, marchewka i noże. Karta to biała kafelkowa ściana, nuty to wstęgi makaronu oblewane sosem pomidorowym, a przy kombo za żabą płynie strużka oliwy z bazylią pod parą z patelni.",
    cechy:{tlo:"piec do pizzy",klawisze:"kafle i deski",streak:"oliwa, bazylia i para",widownia:"warzywa na obrusie"},
    en:{nazwa:"Kitchen",
      opis:"A felt Italian kitchen: a pizza oven, shelves of jars and olive oil, pots and a checked tablecloth, with a shrimp, a chili, a tomato, a carrot and two knives dancing in the crowd. The card is a white tiled wall, notes are tagliatelle ribbons covered in tomato sauce, and on a combo a trickle of olive oil with basil and pan steam trails behind you.",
      cechy:{tlo:"pizza oven",klawisze:"tiles and boards",streak:"oil, basil and steam",widownia:"veggies on a tablecloth"}},
    karta:{papier:KAFEL,cien:"rgba(90,50,20,.26)",czarne:"rgba(90,50,20,.1)",liniaC:"rgba(120,80,40,.3)",minione:"rgba(120,80,40,.16)",
      nazwy:"rgba(110,60,30,.85)",kreski:"rgba(120,80,40,.28)",nic:POM,szpilka:POM,szpilkaBlask:"#fff3d6",
      cienNuty:"rgba(90,50,20,.4)",scieg:"rgba(176,128,70,.65)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
