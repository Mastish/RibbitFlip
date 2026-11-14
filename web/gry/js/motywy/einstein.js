// Motyw „Einstein” (runda 5, 10-17): sala wykładowa z filcu. Tło to ilustracja (tlo.webp: zielone tablice ze wzorami
// z białego filcu, biurka z książkami, globus i teleskop), karta toru to ciemnozielona tablica (faktura.webp mnożona
// lekko, widać kredowy pył i smugi po gąbce) w cienkiej drewnianej ramie z jasnego brązu; w prawych rogach drobne kredowe
// bazgroły ze ściegu (wykres z osiami, trójkąt z kątem), bez napisów. Nuty: białe kredy, walec z kremową fakturą kredy,
// ciemniejszym, starym końcem i krótkimi kreskami pyłu z ziarna; zaśpiewana część rozjarza się limonkowo jak podświetlona
// tablica. Klawiatura: białe klawisze to kredowe pasy na tablicy, czarne to ciemna tablica z zieloną nicią.
// Widownia: Einstein, laboranci i profesor (fan-0..5.webp) przed drewnianą katedrą kiwają głowami jak przy „eureka”.
// Streak (detal PODPISOWY): ślad to kredowa linia wzoru (biała, z przerwami jak kreda na ziarnie tablicy i z pyłem),
// po której płyną symbole E=mc², π, Σ, √, ∞ i atom (iskra-0..5) jak zapisywany wzór; przy wyższym ogniu nad żabą zapala
// się żarówka pomysłu narysowana kredą, z jedną ciepłą poświatą (krótki błysk, bez stroboskopu). Zza żaby lecą
// symbole. Głowa bez efektu: żabę ubiera przebranie motywu. Wszystko z buforów.
(function(){
  "use strict";
  const ID="einstein",PI=Math.PI,TAU=2*PI;
  const TABL="#2c5c45",TABL_C="#13301f",TABL_G="#0b2118",KREDA="#f3efe1",KREDA_C="#d9d2bb",LIMON="#c6e84e",
    LIMON_C="#7fb52a",DREWNO="#bb8650",DREWNO_C="#6b4526",NIC_Z="#6fbf5a",ZAR="#ffd36a";
  const FANY=6,ISKRY=6;
  const ZASOBY=["tlo.webp","faktura.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5],DOODLE=[4,3],PRZERWY=[9,2,4,1.5,13,2.5,6,1.8];   // kreski bez nowych tablic w klatce

  // =========================================================================================== wzory (raz)
  // Kreda: drobne plamki tablicy prześwitujące przez kredę i krótkie podłużne kreski pyłu (kafel 48 × 16, zawinięty).
  // Wariant z ziarna zmienia rozkład kresek, więc kredy nie są identyczne.
  function kafelekKredy(z,plamki,kreski){
    const cv=document.createElement("canvas");cv.width=48;cv.height=16;const x=cv.getContext("2d");
    x.fillStyle=plamki;
    for(let i=0;i<46;i++){const px=los(z*13+i,1)*48,py=los(z*13+i,2)*16,r=.4+los(z*13+i,3)*.8;x.fillRect(px,py,r,r);}
    x.strokeStyle=kreski;x.lineWidth=.7;x.lineCap="round";x.beginPath();
    for(let i=0;i<7;i++){const px=los(z*7+i,4)*48,py=1.5+los(z*7+i,5)*13,l=3+los(z*7+i,6)*7;
      for(const ox of [0,-48]){x.moveTo(px+ox,py);x.lineTo(px+ox+l,py+(los(i,z)-.5)*.8);}}
    x.stroke();
    return cv;
  }
  // Włókna filcu na drewnie ramy i katedry (jak w tiki): krótkie zakrzywione włoski w dwóch tonach, kafel 96 px.
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
  const WZORY=new Map();
  function wzor(c,klucz,tworz,skala){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");if(skala&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix().scale(skala));WZORY.set(klucz,w);}
    return w;
  }
  const KREDY=["kreda0","kreda1","kreda2"];
  const kreda=(c,z)=>wzor(c,KREDY[z],()=>kafelekKredy(z+1,"rgba(40,70,50,.32)","rgba(150,140,110,.45)"));
  const kredaKlaw=c=>wzor(c,"kredaK",()=>kafelekKredy(9,"rgba(30,70,48,.45)","rgba(255,255,250,.5)"));
  const filcDrewno=c=>wzor(c,"drewno",()=>kafelekFilcu("rgba(255,236,200,.4)","rgba(70,40,15,.3)",360));
  // faktura motywu (tablica z kredowym pyłem, kafel 512 bez szwów); zanim się wczyta: sam kolor tablicy
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    return im?wzor(c,"faktura",()=>im,.5):null;
  }

  // =========================================================================================== sprite'y
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("ei-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};
  // limonkowa łuna (front zaśpiewanej kredy) i ciepła poświata żarówki: radialne gradienty raz do bufora
  const luna=(r,kol)=>jest()?bufor("ei-luna|"+r+"|"+kol,2*r,2*r,c=>{
    const g=c.createRadialGradient(r,r,0,r,r,r);g.addColorStop(0,"rgba("+kol+",.85)");g.addColorStop(.4,"rgba("+kol+",.35)");g.addColorStop(1,"rgba("+kol+",0)");
    c.fillStyle=g;c.fillRect(0,0,2*r,2*r);}):null;
  // pyłek kredy: mała kropka z miękkim brzegiem
  const pylek=()=>jest()?bufor("ei-pyl",8,8,c=>{
    const g=c.createRadialGradient(4,4,0,4,4,4);g.addColorStop(0,"rgba(246,243,230,.95)");g.addColorStop(.6,"rgba(246,243,230,.5)");g.addColorStop(1,"rgba(246,243,230,0)");
    c.fillStyle=g;c.fillRect(0,0,8,8);}):null;
  // żarówka pomysłu narysowana kredą na tablicy: bańka, gwint, żarnik i kreski promieni (linie, bez wypełnień)
  const zarowka=r=>jest()?bufor("ei-zar|"+r,Math.ceil(r*3.2),Math.ceil(r*3.6),c=>{
    const cx=r*1.6,cy=r*1.5;
    c.lineCap="round";c.lineJoin="round";
    c.beginPath();c.arc(cx,cy,r,PI*.78,PI*.22);c.quadraticCurveTo(cx+r*.42,cy+r*.95,cx+r*.36,cy+r*1.22);
    c.lineTo(cx-r*.36,cy+r*1.22);c.quadraticCurveTo(cx-r*.42,cy+r*.95,cx+Math.cos(PI*.78)*r,cy+Math.sin(PI*.78)*r);
    c.fillStyle="rgba(255,230,140,.22)";c.fill();
    c.strokeStyle="rgba(246,243,230,.95)";c.lineWidth=Math.max(1.4,r*.13);c.stroke();
    c.beginPath();for(let i=0;i<3;i++){const y=cy+r*(1.36+i*.22);c.moveTo(cx-r*.34,y);c.lineTo(cx+r*.34,y-r*.08);}
    c.moveTo(cx-r*.16,cy+r*2.04);c.lineTo(cx+r*.16,cy+r*2.04);
    c.lineWidth=Math.max(1.2,r*.1);c.stroke();
    c.beginPath();c.moveTo(cx-r*.22,cy+r*1.1);c.lineTo(cx-r*.22,cy+r*.2);
    for(let i=0;i<4;i++)c.lineTo(cx-r*.22+r*(i+.5)*.11,cy+(i%2?r*.2:-r*.05));
    c.lineTo(cx+r*.22,cy+r*.2);c.lineTo(cx+r*.22,cy+r*1.1);
    c.strokeStyle="rgba(255,214,100,.95)";c.lineWidth=Math.max(1,r*.08);c.stroke();
    c.beginPath();
    for(let i=0;i<5;i++){const a=PI*(1.1+i*.2),r1=r*1.22,r2=r*1.48;c.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);c.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);}
    c.strokeStyle="rgba(246,243,230,.85)";c.lineWidth=Math.max(1.2,r*.1);c.stroke();
  }):null;

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.16,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["242,238,223",.08],["198,232,78",.06]],swiatlo:["255,236,180","198,232,78"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#2a4a38";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(20,14,8,0)");g.addColorStop(1,"rgba(20,14,8,.32)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Ciemnozielona tablica: faktura mnożona lekko i rozjaśniona odrobinę (kredowy pył), dwie smugi po gąbce, w prawych
  // rogach bazgroły kredą ze ściegu, dookoła cienka rama z jasnego brązu (filc z włóknami, ciemna fuga od środka).
  function fakturaKarty(c,L){
    const f=fakturaWzor(c);
    if(f){
      c.globalCompositeOperation="multiply";c.globalAlpha=.5;c.fillStyle=f;c.fillRect(L.x,L.y,L.w,L.h);
      c.globalCompositeOperation="screen";c.globalAlpha=.12;c.fillRect(L.x,L.y,L.w,L.h);
      c.globalCompositeOperation="source-over";c.globalAlpha=1;
    }
    // smugi po gąbce: szerokie, prawie niewidoczne pociągnięcia
    c.lineCap="round";c.strokeStyle="rgba(240,238,225,.035)";c.lineWidth=Math.max(10,L.h*.12);
    for(let k=0;k<2;k++){
      const y=L.y+L.h*(.3+.38*k);c.beginPath();c.moveTo(L.x+L.w*(.28+.1*k),y);
      c.bezierCurveTo(L.x+L.w*.45,y-L.h*.05,L.x+L.w*.6,y+L.h*.06,L.x+L.w*(.78-.08*k),y-L.h*.02);c.stroke();
    }
    const fw=Math.round(Math.max(8,Math.min(11,L.h*.024)));
    if(L.w>200&&L.h>90){   // bazgroły kredą w prawych rogach (miniatura: bez nich)
      const s=Math.max(22,Math.min(46,L.h*.17)),xr=L.x+L.w-fw-12-s*1.3;
      c.setLineDash(DOODLE);c.strokeStyle="rgba(242,238,223,.34)";c.lineWidth=1.3;c.lineJoin="round";
      c.beginPath();   // wykres: osie ze strzałkami i parabola
      const ox=xr,oy=L.y+fw+12+s;
      c.moveTo(ox,oy-s);c.lineTo(ox,oy);c.lineTo(ox+s*1.2,oy);
      c.moveTo(ox-3,oy-s+4);c.lineTo(ox,oy-s);c.lineTo(ox+3,oy-s+4);
      c.moveTo(ox+s*1.2-4,oy-3);c.lineTo(ox+s*1.2,oy);c.lineTo(ox+s*1.2-4,oy+3);
      c.moveTo(ox+s*.12,oy-s*.85);c.quadraticCurveTo(ox+s*.55,oy+s*.6,ox+s*1.05,oy-s*.8);
      c.stroke();
      c.beginPath();   // trójkąt prostokątny z łukiem kąta
      const tx=xr,ty=L.y+L.h-fw-12;
      c.moveTo(tx,ty);c.lineTo(tx+s*1.15,ty);c.lineTo(tx,ty-s*.8);c.closePath();
      c.moveTo(tx+s*.95,ty);c.arc(tx+s*1.15,ty,s*.2,PI,PI+.6);
      c.moveTo(tx+s*.16,ty);c.lineTo(tx+s*.16,ty-s*.16);c.lineTo(tx,ty-s*.16);
      c.stroke();c.setLineDash(BRAK);
    }
    // rama tablicy: połowa grubej kreski po brzegu karty (reszta przycięta), filc z włóknami, ciemna fuga i blask
    c.beginPath();c.roundRect(L.x,L.y,L.w,L.h,16);
    c.lineWidth=fw*2;c.strokeStyle=DREWNO;c.stroke();c.strokeStyle=filcDrewno(c);c.stroke();
    c.lineWidth=1.4;c.strokeStyle="rgba(255,226,180,.45)";c.beginPath();c.roundRect(L.x+1,L.y+1,L.w-2,L.h-2,15);c.stroke();
    c.lineWidth=1.6;c.strokeStyle=DREWNO_C;c.beginPath();c.roundRect(L.x+fw,L.y+fw,L.w-2*fw,L.h-2*fw,Math.max(4,16-fw));c.stroke();
    c.lineWidth=2;c.strokeStyle="rgba(8,22,15,.35)";c.beginPath();c.roundRect(L.x+fw+1.6,L.y+fw+1.6,L.w-2*fw-3.2,L.h-2*fw-3.2,Math.max(3,14-fw));c.stroke();
  }

  // =========================================================================================== nuty
  // Biała kreda: kremowa (trzy odcienie z ziarna), faktura kredy z kreskami pyłu (wariant z ziarna), cień walca
  // i ciemniejszy, starty koniec. Ciemnozielony obrys odcina kredę od tablicy.
  const KOL=[KREDA,"#efe9d6","#f6f2e6"];
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,255,250,.5)");g.addColorStop(.3,"rgba(255,255,250,0)");g.addColorStop(.62,"rgba(120,110,80,.06)");g.addColorStop(1,"rgba(70,62,40,.4)");
      WALEC.set(k,g);}
    return g;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2,z=(o.ziarno|0)%3;
      c.fillStyle=KOL[z];c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=kreda(c,z);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(w>=18){const e=Math.min(9,w*.14);c.fillStyle="rgba(150,138,104,.38)";c.fillRect(x0+w-e,y0-2,e+2,nh+4);
        c.fillStyle="rgba(110,100,72,.35)";c.fillRect(x0+w-e,y0-2,1.2,nh+4);}
    },
    brzeg:()=>TABL_G,zapas:()=>0};

  // =========================================================================================== klawisze
  // Tablica (faktura mnożona), białe klawisze to kremowe kredowe pasy z ziarnem tablicy, czarne to ciemna tablica
  // przeszyta zieloną nicią, kremowy ścieg wokół, rama z drewna. Gracz: limonkowy pas z ciemnym ściegiem.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(6,18,12,.45)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=TABL;c.fill();
      const f=fakturaWzor(c);
      if(f){c.save();c.clip();c.globalCompositeOperation="multiply";c.globalAlpha=.5;c.fillStyle=f;c.fillRect(x,y0,w,h);c.restore();}
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,"#f8f5ea");grad.addColorStop(.65,KREDA);grad.addColorStop(1,KREDA_C);
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,3));
      }
      c.fillStyle=grad;c.fill();c.save();c.clip();c.fillStyle=kredaKlaw(c);c.fillRect(x,y0,w,h);c.restore();
      c.strokeStyle="rgba(11,33,24,.6)";c.lineWidth=1;c.stroke();
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,4,4,0]);}
      c.fillStyle=TABL_C;c.fill();
      if(f){c.save();c.clip();c.globalCompositeOperation="screen";c.globalAlpha=.16;c.fillStyle=f;c.fillRect(x,y0,w,h);c.restore();}
      c.beginPath();   // zielona nić wzdłuż każdego czarnego klawisza
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s),yy=k.y+k.h/2;c.moveTo(k.x+3,yy);c.lineTo(k.x+k.w*.62-4,yy);}
      c.setLineDash(SCIEG);c.strokeStyle=NIC_Z;c.lineWidth=1.1;c.stroke();
      c.strokeStyle="rgba(243,239,225,.7)";c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=DREWNO_C;c.lineWidth=1.8;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(198,232,78,.92)":"rgba(198,232,78,.5)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?TABL_G:"rgba(11,33,24,.55)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Naukowcy z fan-*.webp przed drewnianą katedrą (boazeria z filcu za nimi, deska podłogi z przodu). Kolejność
  // z ziarnem bez sąsiadów-bliźniaków, odbicia i skala z ziarna. Ruch `headbang`: kiwnięcie głową „eureka” na
  // każdą ćwierćnutę.
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
    return bufor("ei-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  // katedra za naukowcami: blat z ciemniejszą krawędzią i boazeria z płycin ze ściegiem (raz na rozmiar)
  const katedra=(W,h)=>bufor("ei-kat|"+W+"x"+h,W,h,c=>{
    const yb=Math.round(h*.42),hb=h-yb;
    const g=c.createLinearGradient(0,yb,0,h);g.addColorStop(0,"#9a6a3e");g.addColorStop(1,"#5c3a20");
    c.fillStyle=g;c.fillRect(0,yb,W,hb);c.fillStyle=filcDrewno(c);c.fillRect(0,yb,W,hb);
    c.fillStyle=DREWNO;c.fillRect(0,yb-4,W,7);c.fillStyle=filcDrewno(c);c.fillRect(0,yb-4,W,7);
    c.fillStyle="rgba(50,28,12,.55)";c.fillRect(0,yb+3,W,2);
    const pw=Math.max(60,Math.round(h*1.1)),m=6;
    c.setLineDash([5,4]);c.lineWidth=1.2;
    for(let x=m;x+pw-m<=W+pw;x+=pw){
      c.strokeStyle="rgba(40,22,10,.45)";c.strokeRect(x+.5,yb+10.5,pw-2*m,hb-16);
      c.strokeStyle="rgba(255,226,180,.35)";c.strokeRect(x+3.5,yb+13.5,pw-2*m-6,hb-22);
    }
    c.setLineDash(BRAK);
  });
  // deska podłogi z przodu: naukowcy stoją na niej, gra dokłada ciemny pas ziemi na stopach
  const deska=(W,h)=>bufor("ei-deska|"+W+"x"+h,W,Math.max(4,Math.round(h*.14)),c=>{
    const hd=Math.max(4,Math.round(h*.14));
    c.fillStyle="#7a4e2b";c.fillRect(0,0,W,hd);c.fillStyle=filcDrewno(c);c.fillRect(0,0,W,hd);
    c.fillStyle="rgba(255,226,180,.4)";c.fillRect(0,0,W,1.5);
    c.setLineDash([6,4]);c.strokeStyle="rgba(250,236,210,.55)";c.lineWidth=1.1;c.beginPath();c.moveTo(0,4.5);c.lineTo(W,4.5);c.stroke();c.setLineDash(BRAK);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*1.0),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.95)),krok=W/n,R0=rzad(n);
      const dno=Wd.y+h*.97;
      c.drawImage(katedra(W,h).cv,0,Wd.y,W,h);
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"headbang",i);   // ruch wg motywu (motywy.js ruchFana)
      }
      const d=deska(W,h);c.drawImage(d.cv,0,Wd.y+h-d.h,W,d.h);
    }};

  // =========================================================================================== streak
  // Ślad: kredowa linia wzoru. Szeroka mgiełka pyłu, kremowy rdzeń i przerwy w kolorze tablicy (kreda przeskakuje po
  // ziarnie), wokół opadające pyłki. Od ognia 1 po linii płyną symbole wzoru (iskra-0..5): rodzą się przy żabie
  // („zapisywane”), odpływają w lewo z zapisanym wzorem i gasną na końcu śladu.
  const PLYN=62,ODST=58,PYL_ODST=17;   // px/s płynięcia symboli, odstęp symboli i pyłków
  const streak={
    glowa(){},
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),sz=k.og>=3?5:k.og>=2?4.2:3.4,ts=k.ts;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+6;c.stroke();
      c.strokeStyle=g.d;c.lineWidth=sz+2.4;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=sz;c.stroke();
      c.setLineDash(PRZERWY);c.lineDashOffset=-ts*9;c.strokeStyle=g.c;c.lineWidth=sz*.55;c.stroke();c.setLineDash(BRAK);c.lineDashOffset=0;
      if(!jest()||k.pelna===false)return;
      const span=k.xT-k.x0;if(!(span>40))return;
      // pyłki kredy: opadają lekko pod linią i dryfują w lewo
      const py=pylek();
      if(py){
        const ile=Math.min(12,Math.floor(span/PYL_ODST));
        for(let j=0;j<ile;j++){
          const u=((ts*PLYN*.8+j*PYL_ODST)%span+span)%span,x=k.xT-u,y=ySladu(pts,x);if(y==null)continue;
          const f=u/span,s=2.2+2.2*los(j,1),yy=y+(los(j,2)-.5)*sz*2.4+f*7;
          c.globalAlpha=(1-f)*.85;c.drawImage(py.cv,x-s/2,yy-s/2,s,s);
        }
        c.globalAlpha=1;
      }
      if(k.og<1)return;
      // symbole wzoru płyną po linii (stała tożsamość: symbol j to zawsze iskra j % 6)
      const ile=Math.min(k.og>=2?8:4,Math.floor(span/ODST));
      for(let j=0;j<ile;j++){
        const u=((ts*PLYN+j*ODST)%(ile*ODST)),x=k.xT-14-u;if(x<k.x0)continue;
        const y=ySladu(pts,x);if(y==null)continue;
        const f=(x-k.x0)/span;if(f<.06)continue;
        const b=iskra(j%ISKRY,40);if(!b)continue;
        const wpis=Math.min(1,u/24),s=(14+6*f)*(.4+.6*wpis);
        c.globalAlpha=Math.min(1,f/.25,(ile*ODST-u)/30)*(.35+.65*wpis);
        c.drawImage(b.cv,x-s/2,y-sz-s*.62+Math.sin(ts*2.4+j*1.7)*1.6,s,s);
      }
      c.globalAlpha=1;
    },
    // płonąca nuta: zaśpiewana część rozjarza się limonką jak podświetlona tablica, front świeci łuną
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(198,232,78,.42)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas>.05&&jest()){
        const r=Math.max(8,Math.round(nh*(aktywna?1.1:.85))),b=luna(r,"198,232,78");
        if(b){c.globalAlpha=Math.min(1,gas)*(.75+.25*Math.sin(ts*5+z));c.drawImage(b.cv,fx-r,-r,2*r,2*r);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)symboleToru(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{for(let i=0;i<ISKRY;i++)iskra(i,40);pylek();zarowka(14);luna(48,"255,211,106");}catch(e){}},
    aura:["#f6f3e6",LIMON],wypelnienie:["#f6ffd8",LIMON,LIMON_C],
    iskry:{kolory:["#f6f3e6",LIMON,"#fff2b8"]},dym:"#e8e5d6",
    scena:["242,238,223","198,232,78","255,211,106"],
    tlo:{promienie:[["242,238,223",.08],["198,232,78",.06]],swiatlo:["255,236,180","198,232,78"]}};

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
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(242,238,223,0)");a.addColorStop(.5,"rgba(242,238,223,.1)");a.addColorStop(1,"rgba(230,245,200,.22)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(243,239,225,0)");b.addColorStop(.35,"rgba(243,239,225,.7)");b.addColorStop(1,"rgba(250,248,238,1)");
    const d=c.createLinearGradient(x0,0,xT,0);d.addColorStop(0,"rgba(31,74,54,0)");d.addColorStop(.4,"rgba(31,74,54,.55)");d.addColorStop(1,"rgba(31,74,54,.45)");
    const e=c.createLinearGradient(x0,0,xT,0);e.addColorStop(0,"rgba(8,26,18,0)");e.addColorStop(.4,"rgba(8,26,18,.45)");e.addColorStop(1,"rgba(8,26,18,.6)");
    g={a,b,c:d,d:e};GRAD.set(kl,g);return g;
  }

  // ---- symbole z toru i żarówka pomysłu: pula na gracza, bez alokacji w klatce ----
  // E=mc², π, Σ, √, ∞ i atom (iskra-0..5) wylatują zza żaby w górę i do tyłu, wolno wirując, i opadają łagodnym łukiem
  // jak kartki z notatkami; na progu kombo co 4 nuty trzy naraz. Żarówka: gdy ogień rośnie do 2 albo 3 i co 8 nut
  // kombo przy ogniu ≥ 2 (nie częściej niż co 2 s) nad żabą zapala się kredowa żarówka z ciepłą poświatą; jasność
  // rośnie przez 0,2 s i gaśnie łagodnie przez 0,7 s, bez migania.
  const PULE=new WeakMap(),MAKS_CZ=10,TEMPO=[0,1,1.8,3],LOSUJ=[0,1,2,3,4,5,0,5,1],ZAR_T=.9,ZAR_PRZERWA=2;
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,og:g.ogien|0,dos:0,zar:0,przerwa:0,cz:[]};
    for(let i=0;i<MAKS_CZ;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,k:0,r:20,rot:0,wir:0});
    PULE.set(g,p);return p;
  }
  function rzuc(P,L,g,sc,og){
    for(const p of P.cz)if(p.z<=0){
      const pz=pozycjaZaby(L,g);
      p.k=LOSUJ[Math.floor(Math.random()*LOSUJ.length)];p.r=Math.round(sc*(.22+.04*og)*(.85+.3*Math.random()));
      p.x=pz.x-sc*.2+(Math.random()-.5)*sc*.3;p.y=pz.y-sc*.35;p.vx=-(40+55*Math.random());p.vy=-(100+55*Math.random());
      p.rot=(Math.random()-.5)*.6;p.wir=(Math.random()<.5?-1:1)*(.6+.9*Math.random());p.zy=1.6+.5*Math.random();p.z=p.zy;return;
    }
  }
  function symboleToru(c,L,g,st){
    if(typeof pozycjaZaby!=="function"||!jest())return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(og>0){
      P.dos+=dt*TEMPO[og];if(P.dos>=1){P.dos-=1;rzuc(P,L,g,sc,og);}
      if(k>P.k&&k>=4&&k%4===0)for(let j=0;j<3;j++)rzuc(P,L,g,sc,og);
    }else P.dos=0;
    P.przerwa=Math.max(0,P.przerwa-dt);
    if(og>=2&&P.przerwa<=0&&(og>P.og||(k>P.k&&k%8===0))){P.zar=ZAR_T;P.przerwa=ZAR_PRZERWA;}
    P.k=k;P.og=og;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=120*dt;p.rot+=p.wir*dt;
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,s=p.r*(f<.15?.5+.5*f/.15:1);
      c.globalAlpha=f<.1?f/.1:p.z<.45?p.z/.45:1;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();
    }
    c.globalAlpha=1;
    if(P.zar>0){
      P.zar=Math.max(0,P.zar-dt);
      const f=1-P.zar/ZAR_T,jas=f<.22?f/.22:1-(f-.22)/.78,e=jas*jas*(3-2*jas);
      const pz=pozycjaZaby(L,g),r=Math.max(10,Math.round(sc*.15)),x=pz.x-sc*.42,y=Math.max(L.y+r*2.2,pz.y-sc*.78);
      const lu=luna(48,"255,211,106"),zw=zarowka(r);
      if(lu){const R=r*3.4*(.85+.15*e);c.globalAlpha=e*.8;c.drawImage(lu.cv,x-R,y-R,2*R,2*R);}
      if(zw){c.globalAlpha=Math.min(1,e*1.6);c.drawImage(zw.cv,x-r*1.6,y-r*1.5,zw.w,zw.h);}
      c.globalAlpha=1;
    }
  }

  Motywy.dodaj({id:ID,nazwa:"Einstein",kolejnosc:30,kolor:"#2f6b4f",zasoby:ZASOBY,przebranie:true,
    opis:"Sala wykładowa z filcu: zielone tablice pełne wzorów z białego filcu, biurka z książkami, globus i teleskop, a w widowni kiwają głowami żaby-naukowcy. Karta to tablica w drewnianej ramie, nuty to kawałki kredy, a przy kombo za żabą ciągnie się kredowy wzór z E=mc², π i atomem, a nad głową zapala się żarówka pomysłu.",
    cechy:{tlo:"sala wykładowa",klawisze:"kreda i tablica",streak:"kredowy wzór i żarówka",widownia:"naukowcy z eureką"},
    en:{nazwa:"Einstein",
      opis:"A felt lecture hall: green chalkboards full of white felt formulas, desks with books, a globe and a telescope, with frog scientists nodding in the crowd. The card is a chalkboard in a wooden frame, notes are sticks of chalk, and on a combo a chalk formula with E=mc², π and an atom trails behind you while a light bulb of an idea flashes overhead.",
      cechy:{tlo:"lecture hall",klawisze:"chalk and blackboard",streak:"chalk formula and bulb",widownia:"eureka scientists"}},
    karta:{papier:TABL,cien:"rgba(6,18,12,.42)",czarne:"rgba(4,14,10,.2)",liniaC:"rgba(240,236,220,.2)",minione:"rgba(4,14,10,.26)",
      nazwy:"rgba(242,238,223,.85)",kreski:"rgba(240,236,220,.2)",nic:LIMON,szpilka:DREWNO_C,szpilkaBlask:"#f6e3c0",
      cienNuty:"rgba(2,12,8,.5)",scieg:"rgba(250,240,215,.85)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
