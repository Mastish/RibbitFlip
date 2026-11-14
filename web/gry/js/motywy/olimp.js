// Motyw „Olimp” (runda 5, 10-17): starożytne Ateny z filcu. Tło to ilustracja (tlo.webp: Partenon, oliwki, amfory,
// pas meandra u góry, Morze Egejskie), karta toru to biała marmurowa szyba (faktura.webp mnożona lekko, widać żyłki)
// z pasem greckiego meandra w egejskim błękicie u góry i u dołu (wzór z pamięci, rysowany raz na układ, z błękitnym
// ściegiem). Nuty: kolumny leżące poziomo, marmurowy trzon z żłobkowaniem (cienkie linie) i kapitelem za główką,
// ziarno daje porządek: dorycki, joński albo koryncki; zaśpiewana część błękitnieje. Klawiatura: białe klawisze to
// marmur, czarne to egejski błękit ze złotą nicią. Widownia: marmurowe posągi żab oraz cyklop, minotaur i centaur
// (fan-0..5.webp) na stopniach świątyni, dostojny ukłon na pierwszą ćwierćnutę taktu.
// Streak (detal PODPISOWY): ślad to wieniec laurowy (gałązka z parami liści idącymi ku żabie, złota nić), a przy
// wyższym ogniu uderza w nią błyskawica Zeusa (złoty zygzak, krótki błysk wygaszany łagodnie, bez stroboskopu);
// zza żaby lecą greckie symbole (iskra-0..5: meander, wieniec, piorun, amfora, kapitel, trójząb). Głowa bez efektu:
// żabę ubiera przebranie motywu. Wszystko z buforów.
(function(){
  "use strict";
  const ID="olimp",PI=Math.PI,TAU=2*PI;
  const EGEJ="#2f7fc1",EGEJ_C="#14416e",EGEJ_J="#8cc4ee",ZLOTO="#e0a92c",ZLOTO_J="#fff3c4",
    MARMUR="#f7f5ef",MARMUR_C="#a8a59a",LAUR="#6f9a3a",LAUR_C="#3f6322",OBRYS="#2f4560";
  const FANY=6,ISKRY=6;
  const ZASOBY=["tlo.webp","faktura.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5];   // kreski bez nowych tablic w klatce

  // =========================================================================================== wzory (raz)
  const WZORY=new Map();
  function wzor(c,klucz,tworz,skala){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");if(skala&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix().scale(skala));WZORY.set(klucz,w);}
    return w;
  }
  // faktura motywu (biały marmur, kafel 512 bez szwów); zanim się wczyta: null (rysuj bez żyłek)
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    return im?wzor(c,"faktura",()=>im,.42):null;
  }
  // Grecki meander (kafel 60 × 56, okres 6 jednostek): linia podstawy, zakręt w górę i prostokątna spirala.
  function kafelekMeandra(){
    const cv=document.createElement("canvas");cv.width=60;cv.height=56;const x=cv.getContext("2d");
    const u=10,oy=3;
    x.lineWidth=5;x.lineJoin="miter";x.lineCap="butt";x.strokeStyle=EGEJ;x.beginPath();
    x.moveTo(0,5*u+oy);x.lineTo(0,oy);x.lineTo(5*u,oy);x.lineTo(5*u,4*u+oy);x.lineTo(2*u,4*u+oy);x.lineTo(2*u,2*u+oy);x.lineTo(3*u,2*u+oy);
    x.moveTo(0,5*u+oy);x.lineTo(6*u,5*u+oy);x.moveTo(6*u,5*u+oy);x.lineTo(6*u,oy);   // krawędzie kafla zszywają się w całość
    x.stroke();
    return cv;
  }

  // =========================================================================================== sprite'y
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("ol-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.06,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["120,190,240",.10],["240,190,70",.07]],swiatlo:["255,226,150","47,127,193"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#e9dcc0";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(20,50,90,0)");g.addColorStop(1,"rgba(20,50,90,.22)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Marmurowa szyba: żyłki lekko mnożone, u góry i u dołu pas meandra w egejskim błękicie z błękitnym ściegiem.
  function pasMeandra(c,x,y,w,h){
    c.save();
    c.beginPath();c.roundRect(x,y,w,h,2);c.fillStyle="rgba(47,127,193,.10)";c.fill();c.clip();
    const p=c.createPattern(kafelekMeandra(),"repeat"),s=h/56;
    if(p.setTransform&&typeof DOMMatrix!=="undefined")p.setTransform(new DOMMatrix().translate(x,y).scale(s));
    c.fillStyle=p;c.fillRect(x,y,w,h);
    c.restore();
    c.setLineDash(SCIEG);c.strokeStyle="rgba(47,127,193,.6)";c.lineWidth=1;
    c.beginPath();c.moveTo(x,y-1.5);c.lineTo(x+w,y-1.5);c.moveTo(x,y+h+1.5);c.lineTo(x+w,y+h+1.5);c.stroke();c.setLineDash(BRAK);
  }
  function fakturaKarty(c,L){
    const f=fakturaWzor(c);
    if(f){c.globalCompositeOperation="multiply";c.globalAlpha=.55;c.fillStyle=f;c.fillRect(L.x,L.y,L.w,L.h);c.globalCompositeOperation="source-over";c.globalAlpha=1;}
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,226,150,.16)");g.addColorStop(.3,"rgba(255,226,150,0)");g.addColorStop(.75,"rgba(47,127,193,0)");g.addColorStop(1,"rgba(47,127,193,.10)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
    const mh=Math.max(7,Math.min(14,Math.round(L.h*.05))),m=Math.max(5,Math.round(L.w*.012)),mx=L.x+m+4,mw=L.w-2*(m+4);
    if(mw>40){pasMeandra(c,mx,L.y+m,mw,mh);pasMeandra(c,mx,L.y+L.h-m-mh,mw,mh);}
  }

  // =========================================================================================== nuty
  // Kolumna leżąca poziomo: marmurowy trzon z cieniem walca i żłobkami (gęściej przy brzegach, jak na obłym trzonie),
  // za główką kapitel (z ziarna: dorycki, joński, koryncki), przy prawym końcu cokół. Ciemny granatowy obrys odcina
  // białą kolumnę od białej karty. Zaśpiewana część błękitnieje (streak.nuty).
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"#ffffff");g.addColorStop(.3,"#f4f2ea");g.addColorStop(.7,"#d6d3c8");g.addColorStop(1,"#a4a195");
      WALEC.set(k,g);}
    return g;
  }
  const KAP="rgba(55,70,92,.6)";
  function kapitel(c,xa,cw,nh,typ){
    const y0=-nh/2;
    c.fillStyle="rgba(200,175,120,.38)";c.fillRect(xa,y0-1,cw,nh+2);   // kapitel w ciepłym piaskowcu, odcina się od trzonu
    c.strokeStyle=KAP;c.lineWidth=1;c.beginPath();
    c.moveTo(xa,y0);c.lineTo(xa,-y0);c.moveTo(xa+cw,y0);c.lineTo(xa+cw,-y0);   // brzegi kapitelu
    if(typ===0){   // dorycki: płaska plinta i wypukła poduszka
      c.moveTo(xa+cw*.34,y0);c.lineTo(xa+cw*.34,-y0);
      c.moveTo(xa+cw*.34,y0);c.quadraticCurveTo(xa+cw*.6,y0+nh*.16,xa+cw,y0+nh*.2);
      c.moveTo(xa+cw*.34,-y0);c.quadraticCurveTo(xa+cw*.6,-y0-nh*.16,xa+cw,-y0-nh*.2);
    }else if(typ===1){   // joński: dwie woluty i poprzeczna belka
      const r=nh*.27,cx=xa+cw*.58;
      c.moveTo(xa+cw*.18,y0);c.lineTo(xa+cw*.18,-y0);
      c.moveTo(cx+r,-nh*.2);c.arc(cx,-nh*.2,r,0,TAU);
      c.moveTo(cx+r,nh*.2);c.arc(cx,nh*.2,r,0,TAU);
      c.moveTo(cx+r*.4,-nh*.2);c.arc(cx,-nh*.2,r*.4,0,TAU);
      c.moveTo(cx+r*.4,nh*.2);c.arc(cx,nh*.2,r*.4,0,TAU);
    }else{   // koryncki: trzy liście akantu zwinięte ku górze
      for(let k=-1;k<=1;k++){
        const cy=k*nh*.3,bx=xa+cw*.12,tx=xa+cw*.9;
        c.moveTo(bx,cy);c.quadraticCurveTo(xa+cw*.45,cy-nh*.24,tx,cy-nh*.02);c.quadraticCurveTo(xa+cw*.45,cy+nh*.2,bx,cy);
      }
    }
    c.stroke();
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2,x1=w/2,z=o.ziarno|0;
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.beginPath();   // żyłki marmuru: dwie cienkie linie z ziarna (zamiast pełnej faktury co klatkę)
      for(let k=0;k<2;k++){const vx=x0+w*(.15+.6*los(z,k+9)),vy=y0+nh*(.2+.6*los(z,k+5));c.moveTo(vx,vy);c.quadraticCurveTo(vx+w*.08,vy+(k?-1:1)*nh*.35,vx+w*.17,vy+(los(z,k+2)-.5)*nh*.5);}
      c.strokeStyle="rgba(110,115,125,.35)";c.lineWidth=.8;c.stroke();
      const rs=Math.max(4,nh*.62),xa=x0+rs+2,cw=Math.max(9,nh*1.5),zk=nh>=9&&w>=cw+rs*2+nh*2.2;
      const xs=zk?xa+cw+2:x0+rs,xe=x1-Math.max(4,nh*.45)-2;
      if(nh>=7&&xe>xs+4){   // żłobkowanie trzonu: cienkie linie, gęściej przy górnej i dolnej krawędzi
        const n=Math.min(6,Math.floor(nh/3.4));
        c.beginPath();
        for(let k=1;k<=n;k++){const y=y0+nh*(.5-.5*Math.cos(PI*k/(n+1)));c.moveTo(xs,y);c.lineTo(xe,y);}
        c.strokeStyle="rgba(70,80,95,.3)";c.lineWidth=1;c.stroke();
        c.translate(0,1);c.strokeStyle="rgba(255,255,255,.55)";c.stroke();c.translate(0,-1);
      }
      if(zk){kapitel(c,xa,cw,nh,z%3);
        c.fillStyle="rgba(55,70,92,.45)";c.fillRect(xa+cw,y0,1.2,nh);c.fillRect(xa+cw+3,y0,1,nh);}   // pierścienie pod kapitelem
      if(w>=nh*2.6){c.fillStyle="rgba(55,70,92,.4)";c.fillRect(xe,y0,1.2,nh);}   // cokół przy końcu
    },
    brzeg:()=>OBRYS,zapas:()=>0};

  // =========================================================================================== klawisze
  // Egejska szyba z żyłkami marmuru, białe klawisze z marmuru, czarne w egejskim błękicie ze złotą nicią.
  // Gracz: złoty pas z granatowym ściegiem.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw,f=fakturaWzor(c);
      c.fillStyle="rgba(10,35,70,.4)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle="#1b5a93";c.fill();
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,"#fffffd");grad.addColorStop(.6,MARMUR);grad.addColorStop(1,"#d9d6cb");
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,5));
      }
      c.fillStyle=grad;c.fill();
      if(f){c.save();c.clip();c.globalCompositeOperation="multiply";c.globalAlpha=.6;c.fillStyle=f;c.fillRect(x,y0,w,h);c.restore();}
      c.strokeStyle="rgba(47,69,96,.6)";c.lineWidth=1;c.stroke();
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,4,4,0]);}
      c.fillStyle=EGEJ;c.fill();
      c.strokeStyle=EGEJ_C;c.lineWidth=1;c.stroke();
      c.save();c.clip();c.strokeStyle="rgba(224,169,44,.85)";c.lineWidth=1;c.setLineDash(SCIEG);   // złota nić wzdłuż czarnych klawiszy
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s),m=k.y+k.h/2;c.moveTo(k.x+2,m);c.lineTo(k.x+k.w*.62-2,m);}
      c.stroke();c.restore();c.setLineDash(BRAK);
      c.setLineDash(SCIEG);c.strokeStyle="rgba(224,169,44,.8)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=EGEJ_C;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(240,190,60,.95)":"rgba(240,190,60,.55)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?EGEJ_C:"rgba(20,65,110,.55)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Posągi i bohaterowie mitów z fan-*.webp na stopniach świątyni. Kolejność z ziarnem bez sąsiadów-bliźniaków,
  // odbicia i skala z ziarna. Ruch `uklon` (motywy.js): spokojne kołysanie i ukłon na pierwszą ćwierćnutę taktu.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=71;
    while(r.length<n){
      const p=[];for(let i=0;i<FANY;i++)p.push(i);for(let i=FANY-1;i>0;i--){const j=Math.floor(los(z,i)*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}z++;
      if(p[0]===ost){const t=p[0];p[0]=p[FANY-1];p[FANY-1]=t;}
      for(const f of p){if(r.length>=n)break;const k=r.length;
        r.push({f,lustro:los(k,3)>.5,sk:.88+.12*los(k,4),dx:(los(k,8)-.5)*.16});ost=f;}
    }
    RZAD.set(n,r);return r;
  }
  function fan(i,h,lustro){
    const im=obraz("fan-"+i+".webp");if(!im||!jest())return null;
    const s=h/im.naturalHeight,w=Math.max(1,Math.round(im.naturalWidth*s));
    return bufor("ol-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  // Stopnie świątyni, dwie warstwy (raz na rozmiar): `tyl` = posadzka za stopami (jasny marmur z cieniem u góry),
  // `przod` = dwa stopnie na wierzchu (czoło ciemniejsze, górna krawędź jasna, błękitny ścieg), fani stoją w nich po kostki.
  const marmurPas=(c,x,y,w,h,kol)=>{
    c.fillStyle=kol;c.fillRect(x,y,w,h);
    const f=fakturaWzor(c);if(f){c.save();c.globalCompositeOperation="multiply";c.globalAlpha=.6;c.fillStyle=f;c.fillRect(x,y,w,h);c.restore();}
  };
  const posadzka=(W,h)=>bufor("ol-pos|"+W+"x"+h,W,h,c=>{
    const y=h*.66;
    marmurPas(c,0,y,W,h-y,"#e8e4d8");
    const g=c.createLinearGradient(0,y,0,h*.84);g.addColorStop(0,"rgba(30,50,80,.28)");g.addColorStop(1,"rgba(30,50,80,0)");
    c.fillStyle=g;c.fillRect(0,y,W,h*.18);
    c.setLineDash(SCIEG);c.strokeStyle="rgba(47,127,193,.5)";c.lineWidth=1;c.beginPath();c.moveTo(0,y+2.5);c.lineTo(W,y+2.5);c.stroke();c.setLineDash(BRAK);
  });
  const stopnie=(W,h)=>bufor("ol-stop|"+W+"x"+h,W,h,c=>{
    const y1=h*.84,y2=h*.93;
    marmurPas(c,0,y1,W,y2-y1,"#d4d0c3");
    marmurPas(c,0,y2,W,h-y2,"#e6e2d6");
    c.fillStyle="rgba(255,255,255,.85)";c.fillRect(0,y1,W,1.6);c.fillRect(0,y2,W,1.6);
    c.fillStyle="rgba(30,50,80,.3)";c.fillRect(0,y2-1.2,W,1.2);c.fillRect(0,h-1.2,W,1.2);
    c.setLineDash(SCIEG);c.strokeStyle="rgba(47,127,193,.55)";c.lineWidth=1;c.beginPath();
    c.moveTo(0,y1+(y2-y1)*.55);c.lineTo(W,y1+(y2-y1)*.55);c.moveTo(0,y2+(h-y2)*.55);c.lineTo(W,y2+(h-y2)*.55);c.stroke();c.setLineDash(BRAK);
    // fugi pionowe co ~90 px
    c.fillStyle="rgba(30,50,80,.18)";
    for(let x=45,k=0;x<W;x+=90,k++){c.fillRect(x+los(k,1)*20,y1+1.6,1,y2-y1-1.6);c.fillRect(x+45+los(k,2)*20,y2+1.6,1,h-y2-1.6);}
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*.9),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.95)),krok=W/n,R0=rzad(n);
      const dno=Wd.y+h*.86;
      c.drawImage(posadzka(W,h).cv,0,Wd.y,W,h);
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"uklon",i);   // ruch wg motywu (motywy.js ruchFana)
      }
      c.drawImage(stopnie(W,h).cv,0,Wd.y,W,h);   // stopnie na wierzchu: posągi stoją na nich
    }};

  // =========================================================================================== streak
  // Ślad: wieniec laurowy. Gałązka (ciemny cień, oliwkowa łodyga, złota nić ze ściegu) z parami liści idącymi ku
  // żabie; liście rosną i jaśnieją ku niej. Przy ogniu ≥ 2 na końcu ślad zamyka wieniec (iskra-1), a co jakiś czas
  // uderza błyskawica Zeusa: złoty zygzak z góry w gałązkę, błysk trwa 0,28 s i narasta oraz gaśnie łagodnie.
  // para liści w kształcie litery V ku prawej (ku żabie): bufor 3r × 2,4r, środek podstawy w (r*.3, 1,2r)
  function lisc(r){
    const k=Math.round(r*2)/2;
    return bufor("ol-lisc|"+k,Math.ceil(k*3.2),Math.ceil(k*2.8),c=>{
      const ox=k*.3,oy=k*1.4,l=k*2.6,sz=k*.62;
      for(const s of [-1,1]){
        c.save();c.translate(ox,oy);c.rotate(s*.6);
        c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(l*.4,-sz,l,0);c.quadraticCurveTo(l*.4,sz,0,0);c.closePath();
        c.fillStyle=s<0?"#86b348":"#5f8a32";c.fill();c.lineWidth=.9;c.strokeStyle=LAUR_C;c.stroke();
        c.beginPath();c.moveTo(l*.08,0);c.lineTo(l*.85,0);c.strokeStyle="rgba(235,245,190,.7)";c.lineWidth=.8;c.stroke();
        c.restore();
      }
    });
  }
  const GRAD=new Map();
  function gradSladu(c,x0,xT){
    const kl=Math.round(x0)*16384+Math.round(xT);let g=GRAD.get(kl);if(g)return g;
    if(GRAD.size>24)GRAD.clear();
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(20,50,20,0)");a.addColorStop(.5,"rgba(20,50,20,.45)");a.addColorStop(1,"rgba(20,50,20,.75)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(111,154,58,0)");b.addColorStop(.5,"rgba(111,154,58,.9)");b.addColorStop(1,"rgba(150,190,80,1)");
    const d=c.createLinearGradient(x0,0,xT,0);d.addColorStop(0,"rgba(224,169,44,0)");d.addColorStop(.5,"rgba(224,169,44,.85)");d.addColorStop(1,"rgba(255,230,140,.95)");
    g={a,b,c:d};GRAD.set(kl,g);return g;
  }
  function ySladu(pts,x){
    let lo=0,hi=pts.length-1;if(hi<1||x<pts[0].x||x>pts[hi].x)return null;
    while(hi-lo>1){const m=(lo+hi)>>1;if(pts[m].x<=x)lo=m;else hi=m;}
    const a=pts[lo],b=pts[hi];if(!a.sp||!b.sp)return null;
    const t=b.x>a.x?(x-a.x)/(b.x-a.x):0;return a.y+(b.y-a.y)*t;
  }
  // Błyskawica Zeusa: zygzak złotem, położenie i kształt z numeru błysku (stałe), bez stroboskopu.
  function blyskawica(c,k,pts,ts){
    const okres=k.og>=3?.95:1.5,e=Math.floor(ts/okres),ph=ts-e*okres,dl=.28;
    if(ph>=dl||ph<0)return;
    const a=Math.sin(PI*ph/dl);
    const xb=k.x0+k.dlug*(.3+.55*los(e,1)),yb=ySladu(pts,xb);if(yb==null)return;
    const H=110,seg=6;
    c.lineCap="round";c.lineJoin="round";c.beginPath();c.moveTo(xb+(los(e,2)-.5)*30,yb-H);
    for(let i=1;i<seg;i++)c.lineTo(xb+(los(e,i+3)-.5)*(i%2?34:-34)*(1-i/seg*.5),yb-H+H*i/seg);
    c.lineTo(xb,yb);
    c.globalAlpha=a*.55;c.strokeStyle="#b97a0c";c.lineWidth=7;c.stroke();
    c.globalAlpha=a;c.strokeStyle="#f5c030";c.lineWidth=3.6;c.stroke();
    c.strokeStyle="#fffbe6";c.lineWidth=1.3;c.stroke();
    c.globalAlpha=1;
  }
  const streak={
    glowa(){},
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),sz=k.og>=3?5:k.og>=2?4:3,ts=k.ts;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+2.6;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=sz;c.stroke();
      c.setLineDash(SCIEG);c.lineDashOffset=-ts*12;c.strokeStyle=g.c;c.lineWidth=Math.max(1,sz*.3);c.stroke();c.setLineDash(BRAK);c.lineDashOffset=0;
      if(!jest()||k.pelna===false)return;
      // pary liści, od ogona ku żabie; odstęp zależny od długości śladu, najwyżej 16 par
      const odst=Math.max(15,k.dlug/12);let ost=-1e9,ly=0,lx=0,nr=0;
      for(const p of pts){
        if(!p.sp||p.x<k.x0||p.x-ost<odst)continue;
        const f=(p.x-k.x0)/k.dlug;if(f<.06||f>.97)continue;
        const sl=ost>-1e8?Math.atan2(p.y-ly,p.x-lx):0;
        ly=p.y;lx=p.x;ost=p.x;
        if(++nr>12)break;
        const r=4+3.6*f+k.og*.6,b=lisc(r);if(!b)continue;
        c.globalAlpha=Math.min(1,.25+f*1.1);
        c.save();c.translate(p.x,p.y);c.rotate(sl);c.drawImage(b.cv,-r*.3,-r*1.4,b.w,b.h);c.restore();
      }
      c.globalAlpha=1;
      if(k.og<1)return;
      if(k.og>=2){
        blyskawica(c,k,pts,ts);
        const wi=iskra(1,48);
        if(wi&&k.pelna!==false){const r=k.og>=3?12:10,x=k.xT-30,y=ySladu(pts,x);if(y!=null){c.save();c.translate(x,y);c.rotate(Math.sin(ts*2)*.15);c.drawImage(wi.cv,-r,-r,2*r,2*r);c.restore();}}
      }
    },
    // zaśpiewana część nuty błękitnieje jak Morze Egejskie, na froncie złoty błysk i piorun
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){
        c.fillStyle="rgba(47,127,193,.55)";c.fillRect(x0,-nh/2,fx-x0,nh);
        c.fillStyle="rgba(190,225,255,.5)";c.fillRect(x0,-nh/2,fx-x0,Math.max(1.5,nh*.22));
        c.fillStyle="rgba(240,190,60,.9)";c.fillRect(fx-1.2,-nh/2,2.4,nh);
      }
      if(gas>.05&&aktywna&&jest()){
        const im=iskra(2,48),s=nh*1.5;
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.6,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)symboleToru(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(1,48);iskra(2,48);for(let r=4;r<=10;r++)lisc(r);}catch(e){}},
    aura:["#d6ecff","#f0c24a"],wypelnienie:["#fff3c4","#6fb0e6","#1f6bb5"],
    iskry:{kolory:["#fff8e0",EGEJ_J,ZLOTO]},dym:"#9ec7ee",
    scena:["120,190,240","240,190,70","47,127,193"],
    tlo:{promienie:[["120,190,240",.10],["240,190,70",.07]],swiatlo:["255,226,150","47,127,193"]}};

  // ---- symbole z Olimpu: pula na gracza, bez alokacji w klatce ----
  // Meander, wieniec, piorun, amfora, kapitel, trójząb (iskra-0..5) wylatują zza żaby w górę i do tyłu, powoli się
  // obracając, i opadają łukiem; wieńce i pioruny częściej. Na progu kombo co 4 nuty trzy naraz.
  const PULE=new WeakMap(),MAKS_CZ=10,TEMPO=[0,1,2,3.4],LOSUJ=[1,2,1,0,3,4,5,2,1,5];
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
      p.rot=(Math.random()-.5)*.6;p.wir=(Math.random()<.5?-1:1)*(.5+1.2*Math.random());p.zy=1.5+.5*Math.random();p.z=p.zy;return;
    }
  }
  function symboleToru(c,L,g,st){
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

  Motywy.dodaj({id:ID,nazwa:"Olimp",kolejnosc:27,kolor:"#2f7fc1",zasoby:ZASOBY,przebranie:true,
    opis:"Starożytne Ateny z filcu: Partenon, oliwki, amfory i Morze Egejskie. Karta to biały marmur z greckim meandrem, nuty to leżące kolumny, a w widowni stoją posągi żab i bohaterowie mitów. Za żabą ciągnie się wieniec laurowy, a przy wyższym kombo uderza błyskawica Zeusa.",
    cechy:{tlo:"Partenon i morze",klawisze:"marmur i błękit",streak:"wieniec i błyskawice",widownia:"posągi i mity"},
    en:{nazwa:"Olympus",
      opis:"Ancient Athens made of felt: the Parthenon, olive trees, amphorae and the Aegean Sea. The card is white marble with a Greek meander, notes are fallen columns, and the crowd is statues of frogs and heroes from myths. A laurel wreath trails behind you, and on a higher combo Zeus strikes with lightning.",
      cechy:{tlo:"Parthenon and sea",klawisze:"marble and Aegean blue",streak:"laurel and lightning",widownia:"statues and myths"}},
    karta:{papier:"#f1f0eb",cien:"rgba(20,50,90,.22)",czarne:"rgba(47,127,193,.055)",liniaC:"rgba(47,127,193,.3)",minione:"rgba(30,60,100,.12)",
      nazwy:"rgba(30,70,115,.8)",kreski:"rgba(47,127,193,.28)",nic:"#d49a1a",szpilka:"#d49a1a",szpilkaBlask:"#fff3c4",
      cienNuty:"rgba(20,50,90,.32)",scieg:"rgba(47,127,193,.6)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
