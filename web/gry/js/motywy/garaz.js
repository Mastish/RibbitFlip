// Motyw „Garaż” (runda 3, 10-10): próba punkowej kapeli w garażu. Tło to ilustracja (tlo.webp: wzmacniacze z kartonu
// i filcu, wytłaczanki, plakaty sklejone srebrną taśmą, girlanda żarówek, perkusja), karta toru to kartonowa szyba
// w ciepłym brązie (faktura.webp: karton falisty przy niskim kryciu) w świetle żarówek od góry. Nuty: paski srebrnej
// taśmy klejącej (splot, połysk, poszarpane końce), co czwarta z musztardowej taśmy. Klawiatura: białe klawisze z kraftowego
// kartonu, czarne z czarnej taśmy, w rogach przyklejona srebrna taśma. Widownia: sześciu punkowców (fan-*.webp) skacze
// pogo w rytm. Streak (detal PODPISOWY): przy każdym trafieniu na śladzie za żabą przykleja się pasek srebrnej taśmy
// (krótka animacja naklejenia: plaśnięcie z góry, potem zostaje i jedzie ze śladem), nad kartą wisi girlanda żarówek,
// które przy kombo migają na zmianę w rytm ćwierćnut, za głową skrzyżowane paski taśmy, ślad to pas srebrnej taśmy,
// a z głowy wyskakują drobiazgi punka (iskra-1..5). Wszystko z buforów, w klatce drawImage i kilka obrysów.
(function(){
  "use strict";
  const ID="garaz",PI=Math.PI,TAU=2*PI;
  const BRAZ="#3a281a",BRAZ_C="#22170e",KRAFT="#C9A97A",KRAFT_J="#dcc39b",TASMA="#c7cacf",TASMA_C="#7b8088",
    ROZ="#DA2F74",ROZ_C="#912348",MUSZT="#DA9F2D",KREM="#EDE6DA",CZARNY="#1A1A1A";
  const FANY=6,ISKRY=6;
  const ZASOBY=["tlo.webp","faktura.webp","zaba-0.webp","zaba-1.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5];   // kreski bez nowych tablic w klatce

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
  // Splot taśmy klejącej: drobna kratka nitek pod folią (kafel 6 px), jaśniejsza i ciemniejsza nitka.
  function kafelekSplotu(){
    const cv=document.createElement("canvas");cv.width=cv.height=6;const x=cv.getContext("2d");
    x.fillStyle="rgba(40,44,52,.16)";x.fillRect(0,0,6,1);x.fillRect(0,3,6,1);
    x.fillStyle="rgba(255,255,255,.14)";x.fillRect(1,0,1,6);x.fillRect(4,0,1,6);
    return cv;
  }
  const WZORY=new Map();
  function wzor(c,klucz,tworz){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");WZORY.set(klucz,w);}
    return w;
  }
  const splot=c=>wzor(c,"splot",kafelekSplotu);
  const filcJasny=c=>wzor(c,"jasny",()=>kafelekFilcu("rgba(255,250,235,.3)","rgba(70,45,20,.14)",360));
  const filcCiemny=c=>wzor(c,"ciemny",()=>kafelekFilcu("rgba(200,200,200,.12)","rgba(0,0,0,.25)",360));
  // faktura motywu (karton falisty, kafel 512 bez szwów); zanim się wczyta: włókna z kodu
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    if(!im)return filcJasny(c);
    return wzor(c,"faktura",()=>im);
  }

  // =========================================================================================== sprite'y
  // Ciepła łuna żarówki (gradient raz, w buforze).
  const luna=()=>bufor("ga-luna",96,96,c=>{
    const g=c.createRadialGradient(48,48,0,48,48,48);
    g.addColorStop(0,"rgba(255,236,170,.75)");g.addColorStop(.3,"rgba(255,200,110,.38)");g.addColorStop(.65,"rgba(218,159,45,.12)");g.addColorStop(1,"rgba(218,159,45,0)");
    c.fillStyle=g;c.fillRect(0,0,96,96);
  });
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("ga-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};
  // Pasek taśmy (srebrnej albo musztardowej) z poszarpanymi końcami: kontur ząbków z ziarna, splot, połysk, cień.
  function ksztaltTasmy(c,w,h,z){
    c.beginPath();c.moveTo(0,0);
    for(let i=1;i<=4;i++)c.lineTo(w*.025+(i%2?w*.04:0)*los(z,i),h*i/4*(1-.02*los(z,i+9)));
    c.lineTo(w*(.96+.02*los(z,20)),h);
    for(let i=3;i>=0;i--)c.lineTo(w-(i%2?w*.05:w*.012)*(.5+los(z,i+30)),h*i/4);
    c.closePath();
  }
  const pasekTasmy=(roz,z)=>bufor("ga-pas|"+(roz?1:0)+"|"+z,64,20,c=>{
    c.translate(2,3);
    ksztaltTasmy(c,60,14,z);c.fillStyle="rgba(20,12,6,.35)";c.translate(1,1.5);c.fill();c.translate(-1,-1.5);
    ksztaltTasmy(c,60,14,z);
    const g=c.createLinearGradient(0,0,0,14);
    if(roz){g.addColorStop(0,"#f2c66a");g.addColorStop(.45,MUSZT);g.addColorStop(1,"#9a6a14");}
    else{g.addColorStop(0,"#eef0f3");g.addColorStop(.4,TASMA);g.addColorStop(1,"#959aa2");}
    c.fillStyle=g;c.fill();c.fillStyle=splot(c);c.fill();
    c.strokeStyle=roz?"rgba(70,42,6,.85)":"rgba(60,64,72,.5)";c.lineWidth=roz?1.1:.8;c.stroke();
    c.fillStyle="rgba(255,255,255,.35)";c.fillRect(6,2.5,48,1.4);
  });

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.15,rama:{bok:.085,gora:12,dol:6,odstep:12},
    tlo:{promienie:[["255,214,140",.10],["218,47,116",.05]],swiatlo:["255,214,140","90,60,30"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#a37b4f";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.45,Math.min(W,H)*.32,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(30,18,8,0)");g.addColorStop(1,"rgba(30,18,8,.34)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Kartonowa szyba: karton falisty przy niskim kryciu, ciepłe światło żarówek od góry, cień ku dołowi.
  function fakturaKarty(c,L){
    c.globalAlpha=.24;c.fillStyle=fakturaWzor(c);c.fillRect(L.x,L.y,L.w,L.h);c.globalAlpha=1;
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,214,140,.13)");g.addColorStop(.35,"rgba(255,214,140,0)");g.addColorStop(.75,"rgba(20,10,4,0)");g.addColorStop(1,"rgba(20,10,4,.22)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
  }

  // =========================================================================================== nuty
  // Pasek taśmy klejącej: srebrny (co czwarty musztardowy, z ziarna; nie różowy, bo główki nut są różowe), połysk folii z gradientu z pamięci, splot nitek
  // i poszarpane końce (ząbki w kolorze karty, deterministyczne z ziarna). Obrys ciemny odcina taśmę od kartonu.
  const POLYSK=new Map();
  function polysk(c,nh,roz){
    const k=Math.round(nh*2)*2+(roz?1:0);let g=POLYSK.get(k);
    if(!g){const h=Math.round(nh*2)/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      if(roz){g.addColorStop(0,"#f4cd78");g.addColorStop(.3,"#e6ad3f");g.addColorStop(.75,MUSZT);g.addColorStop(1,"#a8741a");}
      else{g.addColorStop(0,"#f4f5f7");g.addColorStop(.28,"#d3d6da");g.addColorStop(.62,TASMA);g.addColorStop(1,"#8c9199");}
      POLYSK.set(k,g);}
    return g;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2,z=o.ziarno|0,roz=z%4===3;
      c.fillStyle=polysk(c,nh,roz);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=splot(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(w<nh*1.5||nh<6)return;
      // poszarpane końce: trzy ząbki z każdej strony w kolorze kartonu pod szybą
      const d=Math.min(nh*.55,w*.12),a=los(z,1),b=los(z,2);
      c.beginPath();
      c.moveTo(x0-2,y0-2);c.lineTo(x0+d*(.4+.5*a),y0-2);c.lineTo(x0+d*.15,y0+nh*.3);c.lineTo(x0+d*(.5+.4*b),y0+nh*.55);c.lineTo(x0+d*.1,y0+nh*.8);c.lineTo(x0+d*.6,-y0+2);c.lineTo(x0-2,-y0+2);c.closePath();
      c.moveTo(-x0+2,y0-2);c.lineTo(-x0-d*(.5+.4*b),y0-2);c.lineTo(-x0-d*.12,y0+nh*.35);c.lineTo(-x0-d*(.45+.4*a),y0+nh*.6);c.lineTo(-x0-d*.2,-y0+2);c.lineTo(-x0+2,-y0+2);c.closePath();
      c.fillStyle="#3d2a1a";c.fill();
      if(nh>=9){c.fillStyle="rgba(255,255,255,.4)";c.fillRect(x0+d,y0+nh*.2,w-2*d,Math.max(1,nh*.1));}
    },
    brzeg:()=>"#2a1b10",zapas:()=>0};

  // =========================================================================================== klawisze
  // Kraftowy karton (faktura motywu) na ciemnym brązie, białe klawisze jako kartonowe paski, czarne z czarnej taśmy
  // ze splotem, w rogach przyklejona srebrna taśma. Gracz: różowa taśma na swoim rzędzie.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(20,10,4,.45)";c.beginPath();c.roundRect(x+2,y0+3,w,h,5);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,5);c.fillStyle=BRAZ;c.fill();
      c.save();c.clip();c.globalAlpha=.35;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.globalAlpha=1;c.restore();
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,KRAFT_J);grad.addColorStop(.7,"#d2b689");grad.addColorStop(1,"#b8996b");
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.rect(x+ins+1,yt+ins,w-2*ins-2,hh);
      }
      c.fillStyle=grad;c.fill();c.save();c.clip();c.globalAlpha=.5;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.globalAlpha=1;c.restore();
      c.strokeStyle="rgba(60,38,20,.6)";c.lineWidth=1;c.stroke();
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.rect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2));}
      c.fillStyle=CZARNY;c.fill();c.fillStyle=splot(c);c.fill();
      c.strokeStyle=BRAZ_C;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,5);c.stroke();
      if(jest()){   // srebrna taśma przyklejona na górnym i dolnym rogu klawiatury
        for(const [yy,a,z] of [[y0+4,-.5,11],[y0+h-4,.45,13]]){const b=pasekTasmy(false,z);c.save();c.translate(x+w*.5,yy);c.rotate(a);c.drawImage(b.cv,-w*.42,-6,w*.84,13);c.restore();}
      }
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(218,47,116,.88)":"rgba(218,47,116,.48)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.fillStyle=splot(c);c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      if(g.naNucie){c.fillStyle="rgba(255,255,255,.45)";c.fillRect(L.kx+3,y+1.5,L.kw-6,1);}
    }};

  // =========================================================================================== widownia
  // Punkowcy z fan-*.webp na kraftowej podłodze garażu, z cieniem pod stopami. Kolejność z ziarnem bez sąsiadów-
  // bliźniaków, odbicia i skala z ziarna. Przy śpiewie i kombo skaczą pogo: dwie grupy na zmianę (parzyści na raz,
  // nieparzyści na dwa), przy kombo wyżej. W spokoju stoją.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=41;
    while(r.length<n){
      const p=[0,1,2,3,4,5];for(let i=5;i>0;i--){const j=Math.floor(los(z,i)*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}z++;
      if(p[0]===ost){const t=p[0];p[0]=p[5];p[5]=t;}
      for(const f of p){if(r.length>=n)break;const k=r.length;
        r.push({f,lustro:los(k,3)>.5,sk:.86+.14*los(k,4),faza:(k%2)*.5+.08*los(k,5),dx:(los(k,8)-.5)*.2});ost=f;}
    }
    RZAD.set(n,r);return r;
  }
  function fan(i,h,lustro){
    const im=obraz("fan-"+i+".webp");if(!im||!jest())return null;
    const s=h/im.naturalHeight,w=Math.max(1,Math.round(im.naturalWidth*s));
    return bufor("ga-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  const podloga=(W,h)=>bufor("ga-podl|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(30,18,8,0)");g.addColorStop(.6,"rgba(30,18,8,.28)");g.addColorStop(1,"rgba(30,18,8,.48)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      c.drawImage(podloga(W,h).cv,0,Wd.y,W,h);
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.82)),krok=W/n,R0=rzad(n);
      const ruch=!st.spokoj&&!st.bezRuchu,zywe=st.spiewaja||(st.zar||0)>.05||(st.ap||0)>.12;
      const moc=zywe?.05+.06*Math.min(1,st.skok||0)+.04*Math.min(3,st.zar||0)+.06*Math.min(1,(st.ap||0)*2):.02*Math.min(1,st.skok||0);
      const fz=(st.faza||0)*.5,dno=Wd.y+h;
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        const hop=ruch&&moc?Math.pow(Math.abs(Math.sin(PI*(fz+r.faza))),1.6)*fh*moc*1.3:0;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno+hh*.03,st,"headbang",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
    }};

  // =========================================================================================== streak
  // Za głową: ciepła łuna żarówki i dwa skrzyżowane paski srebrnej taśmy (lekko drgają), przy og ≥ 3 trzeci pionowo
  // (gwiazdka z taśmy).
  const streak={
    glowa(c,sc,og,ts,z,przod){
      if(przod||!jest())return;
      const cy=-sc*.4,rl=sc*(.85+.1*og);
      const l=luna();c.globalAlpha=.8+.15*Math.sin(ts*2.3+z);c.drawImage(l.cv,-rl,cy-rl,2*rl,2*rl);c.globalAlpha=1;
      const n=og>=3?3:2,dl=sc*1.15,gr=sc*.3;
      for(let j=0;j<n;j++){
        const b=pasekTasmy(false,j*5+2),a=(j===2?PI/2:j?-.62:.62)+Math.sin(ts*1.6+j*2+z)*.05;
        c.save();c.translate(0,cy);c.rotate(a);c.drawImage(b.cv,-dl/2,-gr/2,dl,gr);c.restore();
      }
    },
    // ślad: pas srebrnej taśmy (ciemny rant, połysk gasnący ku przeszłości, jasna linia folii)
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),sz=k.og>=3?10:k.og>=2?8.5:6.5;
      c.lineCap="butt";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+2.5;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=sz;c.stroke();
      c.translate(0,-sz*.22);c.strokeStyle=g.c;c.lineWidth=1.3;c.stroke();c.translate(0,sz*.22);
    },
    // płonąca nuta: zaśpiewana część w ciepłym świetle żarówki, na froncie łuna i żarówka
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(255,206,120,.3)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas>.05&&jest()){
        const s=nh*(aktywna?1.6:1.2),l=luna();
        c.globalAlpha=Math.min(1,gas)*.85;c.drawImage(l.cv,fx-s,-s,2*s,2*s);c.globalAlpha=1;
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)garazToru(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{luna();for(let z=0;z<8;z++){pasekTasmy(false,z);pasekTasmy(true,z);}for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(5,44);}catch(e){}},
    aura:[MUSZT,ROZ],wypelnienie:["#fff3d6","#ffd58a",MUSZT],
    iskry:{kolory:["#fff3d6","#ffd58a",TASMA]},dym:false,
    scena:["255,214,140","218,47,116","199,202,207"],
    tlo:{promienie:[["255,214,140",.10],["218,47,116",.05]],swiatlo:["255,214,140","90,60,30"]}};

  const GRAD=new Map();
  function gradSladu(c,x0,xT){
    const kl=Math.round(x0)*16384+Math.round(xT);let g=GRAD.get(kl);if(g)return g;
    if(GRAD.size>24)GRAD.clear();
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(30,18,8,0)");a.addColorStop(.5,"rgba(30,18,8,.55)");a.addColorStop(1,"rgba(30,18,8,.8)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(190,194,200,0)");b.addColorStop(.5,"rgba(190,194,200,.85)");b.addColorStop(1,"rgba(214,217,222,1)");
    const d=c.createLinearGradient(x0,0,xT,0);d.addColorStop(0,"rgba(255,255,255,0)");d.addColorStop(.6,"rgba(255,255,255,.55)");d.addColorStop(1,"rgba(255,255,255,.85)");
    g={a,b,c:d};GRAD.set(kl,g);return g;
  }

  // ---- taśma przy trafieniu, girlanda żarówek i drobiazgi punka: pule na gracza, bez alokacji w klatce ----
  // Taśma: każde trafienie przy kombo ≥ 4 przykleja pasek na ostatnim punkcie śladu (współrzędne w beatach, więc
  // pasek jedzie razem ze śladem). Animacja: 0,14 s plaśnięcie z góry (skala 1,7 → 1, krycie 0 → 1), potem leży,
  // po 1,6 s gaśnie. Próg co 4 nuty = pasek musztardowy i większy.
  // Żarówki: girlanda wzdłuż górnej krawędzi karty (tylko lider toru), przy ogniu migają na zmianę w rytm ćwierćnut
  // (łuna gaśnie w ciągu ćwierćnuty), bez ognia świecą przygaszone.
  const PULE=new WeakMap(),MAKS_TA=5,MAKS_CZ=8,TEMPO=[0,.8,1.6,2.8],ZYCIE_TA=2;
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,dos:0,ta:[],cz:[],nr:0};
    for(let i=0;i<MAKS_TA;i++)p.ta.push({t:0,b:0,s:0,a:0,dy:0,roz:false,z:0});
    for(let i=0;i<MAKS_CZ;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,k:1,r:20,rot:0,vr:0});
    PULE.set(g,p);return p;
  }
  function zarowki(c,L,g,st){
    const im=iskra(5,44);if(!im)return;
    const x0=L.x+190,x1=L.x+L.w-40,n=Math.max(3,Math.min(12,Math.floor((x1-x0)/110)));if(x1-x0<120)return;
    const kr=(x1-x0)/(n-1),y=L.y+5,og=Math.min(3,g.ogien|0),bt=st.beat||0,nb=Math.floor(bt),f=bt-nb;
    c.beginPath();c.moveTo(x0-kr*.4,y-5);
    for(let j=0;j<n;j++){const x=x0+j*kr;c.quadraticCurveTo(x-kr*.5,y+7,x,y);}
    c.quadraticCurveTo(x1+kr*.2,y+6,x1+kr*.4,y-5);
    c.strokeStyle="rgba(26,26,26,.85)";c.lineWidth=1.4;c.stroke();
    const l=luna();
    for(let j=0;j<n;j++){
      const x=x0+j*kr;let sw=.18;
      if(og>0)sw=((nb+j)%2===0?(1-f)*(1-f):.12)*(.55+.15*og)+.1;
      const r=10+6*sw*og/3+8*sw;c.globalAlpha=Math.min(1,sw);c.drawImage(l.cv,x-r*1.4,y+12-r*1.4,r*2.8,r*2.8);
      c.globalAlpha=.7+.3*Math.min(1,sw*2);c.drawImage(im.cv,x-11,y-3,22,22);
    }
    c.globalAlpha=1;
  }
  function garazToru(c,L,g,st){
    if(!jest())return;
    if((g.nrWTorze|0)===0)zarowki(c,L,g,st);
    if(typeof pozycjaZaby!=="function")return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    const sl=g.slad;
    if(k>P.k&&k>=4&&sl&&sl.length&&typeof xBeat==="function"){   // trafienie: nowy pasek taśmy (najstarszy z puli)
      const o=sl[sl.length-1];let q=P.ta[0];
      for(const r of P.ta){if(r.t<=0){q=r;break;}if(r.t<q.t)q=r;}
      P.nr++;q.t=ZYCIE_TA;q.b=o.b;q.s=o.s;q.roz=k%4===0;q.a=(P.nr%2?.5:-.5)+(Math.random()-.5)*.35;q.dy=(Math.random()-.5)*6;q.z=P.nr%8;
    }
    P.k=k;
    if(og>0){
      P.dos+=dt*TEMPO[og];
      if(P.dos>=1){P.dos-=1;
        for(const p of P.cz)if(p.z<=0){
          const pz=pozycjaZaby(L,g);
          p.k=1+Math.floor(Math.random()*5);p.r=Math.round(sc*(.28+.05*og)*(.85+.3*Math.random()));
          p.x=pz.x-sc*.1+(Math.random()-.5)*sc*.3;p.y=pz.y-sc*.35;p.vx=-(25+45*Math.random());p.vy=-(110+60*Math.random());
          p.rot=(Math.random()-.5)*.6;p.vr=(Math.random()-.5)*3;p.zy=1.3+.4*Math.random();p.z=p.zy;break;
        }
      }
    }else P.dos=0;
    // paski taśmy na śladzie
    for(const q of P.ta){
      if(q.t<=0)continue;
      q.t-=dt;if(q.t<=0)continue;
      const wiek=ZYCIE_TA-q.t,u=Math.min(1,wiek/.14),sk=1+.7*(1-u)*(1-u),dl=sc*(q.roz?.62:.5),gr=dl*.3;
      const b=pasekTasmy(q.roz,q.z);
      c.globalAlpha=Math.min(u*1.4,1,q.t/.4);
      c.save();c.translate(xBeat(L,q.b),ySemi(L,q.s)+q.dy);c.rotate(q.a);c.scale(sk,sk);c.drawImage(b.cv,-dl/2,-gr/2,dl,gr);c.restore();
    }
    // drobiazgi: wyskakują pogo z głowy, obracają się i spadają
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=170*dt;p.rot+=p.vr*dt;
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,s=p.r*(f<.15?.5+.5*f/.15:1);
      c.globalAlpha=f<.12?f/.12:p.z<.4?p.z/.4:1;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Garaż",kolejnosc:12,kolor:"#b98a55",zasoby:ZASOBY,zaba:true,przebranie:true,
    opis:"Próba punkowej kapeli w garażu: wzmacniacze z kartonu, wytłaczanki, srebrna taśma i girlanda żarówek. Karta jak ciepły karton, nuty z paska taśmy klejącej, a przy kombo żarówki migają w rytm i każde trafienie przykleja na śladzie kawałek taśmy.",
    cechy:{tlo:"garaż z kartonu",klawisze:"karton i taśma",streak:"taśma i żarówki",widownia:"punkowe pogo"},
    en:{nazwa:"Garage",
      opis:"A punk band rehearsing in the garage: cardboard amps, egg-crate foam, silver tape and a string of bulbs. The card is warm cardboard, notes are strips of duct tape, and on a combo the bulbs blink to the beat while every hit slaps a piece of tape onto your trail.",
      cechy:{tlo:"cardboard garage",klawisze:"cardboard and tape",streak:"tape and bulbs",widownia:"punk pogo"}},
    karta:{papier:"#2c1d11",cien:"rgba(20,10,4,.42)",czarne:"rgba(15,8,2,.2)",liniaC:"rgba(230,210,180,.2)",minione:"rgba(15,8,2,.24)",
      nazwy:"rgba(240,226,204,.82)",kreski:"rgba(230,210,180,.2)",nic:ROZ,szpilka:TASMA,szpilkaBlask:"#ffffff",
      cienNuty:"rgba(15,8,2,.45)",scieg:"rgba(201,169,122,.6)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
