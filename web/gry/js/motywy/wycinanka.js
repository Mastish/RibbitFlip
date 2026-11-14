// Motyw „Słowiańska” (runda 3, 10-10; do 10-17 „Wycinanka”, id zostaje): polska wycinanka łowicka i haft ludowy na czarnym filcu. Tło to ilustracja
// (tlo.webp: czarny filc obszyty kwiatami, kogutami i liśćmi), karta toru to czarna szyba z fakturą drobnego haftu
// (faktura.webp: kolorowe kropki ściegu). Nuty: pasy wycinanki, czyli kolorowy filc z drugą warstwą o ząbkowanym
// brzegu, kremowym ściegiem i drobnymi oczkami haftu. Klawiatura: białe klawisze to lniane paski haftu krzyżykowego,
// czarne z czarnego filcu z czerwonym ściegiem. Widownia: sześciu fanów w strojach ludowych i sześć tańczących kogucików (fan-0..11.webp; koguty od 10-17).
// Streak (detal PODPISOWY): za głową żaby rozkwita symetryczna rozeta wycinanki (warstwy płatków w kolorach,
// zewnętrzna obraca się powoli w prawo, wewnętrzna w lewo, osobny bufor na każdy poziom ognia), za żabą powiewają
// wstążki z wianka, a przy trafieniach z głowy sypią się listki, tulipany i serca (iskra-*). W klatce drawImage
// i kilka obrysów.
(function(){
  "use strict";
  const ID="wycinanka",PI=Math.PI,TAU=2*PI;
  const CZARNY="#151515",FILC="#1a1a1a",CZERW="#d8262e",CZERW_C="#8e1219",SZMARAGD="#1d8a4e",SZMARAGD_C="#0d4a28",
    KOBALT="#2a55c4",KOBALT_C="#132b6e",ZOLTY="#f2b51c",ZOLTY_C="#9a6a06",ROZ="#DA2F74",ROZ_C="#912348",
    LIMONKA="#B6D35A",KREM="#EDE6DA",LEN="#e9dfc8",LEN_C="#cdbf9f";
  const FANY=12,ISKRY=6;   // 10-17: fan-6..11 = tańczące koguciki z filcu
  const ZASOBY=["tlo.webp","faktura.webp","zaba-0.webp","zaba-1.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5],SCIEG_ROZ=[3,2.4];   // kreski bez nowych tablic w klatce

  // =========================================================================================== grafiki (raz)
  // Fani mają po kluczowaniu ciemnofioletową obwódkę (resztki magenty przy czarnym konturze naszywki).
  // Raz na obrazek przemalowujemy takie piksele blisko przezroczystości na czarny filc; różowe kwiaty w środku
  // postaci zostają, bo poprawka działa tylko w pasie 4 px od brzegu sylwetki.
  const CZYSTE=new Map();
  function czysty(f){
    const im=obraz(f);if(!im)return null;
    let cv=CZYSTE.get(f);if(cv)return cv;
    const w=im.naturalWidth,h=im.naturalHeight;
    cv=document.createElement("canvas");cv.width=w;cv.height=h;const x=cv.getContext("2d",{willReadFrequently:true});
    x.drawImage(im,0,0);
    try{
      const d=x.getImageData(0,0,w,h),p=d.data,n=w*h,R=4,a=new Uint8Array(n),b=new Uint8Array(n);
      for(let i=0;i<n;i++)a[i]=p[i*4+3]<128?1:0;
      for(let y=0;y<h;y++)for(let i=0;i<w;i++){let m=0;for(let k=Math.max(0,i-R);k<=Math.min(w-1,i+R)&&!m;k++)m=a[y*w+k];b[y*w+i]=m;}
      for(let y=0;y<h;y++)for(let i=0;i<w;i++){let m=0;for(let k=Math.max(0,y-R);k<=Math.min(h-1,y+R)&&!m;k++)m=b[k*w+i];a[y*w+i]=m;}
      for(let i=0;i<n;i++){
        if(!a[i])continue;const o=i*4,r=p[o],g=p[o+1],bl=p[o+2];
        if(bl>.6*r&&r>g+40&&bl>g+40){const v=Math.round(16+.12*(r+g+bl)/3);p[o]=p[o+1]=p[o+2]=v;}
      }
      x.putImageData(d,0,0);
    }catch(e){}   // płótno skażone (plik://): zostaje oryginał
    CZYSTE.set(f,cv);return cv;
  }

  // =========================================================================================== wzory (raz)
  const WZORY=new Map();
  function wzor(c,klucz,tworz){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");WZORY.set(klucz,w);}
    return w;
  }
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
  const filcNuty=c=>wzor(c,"nuta",()=>kafelekFilcu("rgba(255,250,235,.22)","rgba(0,0,0,.2)",420));
  const filcCzarny=c=>wzor(c,"czarny",()=>kafelekFilcu("rgba(255,255,255,.07)","rgba(0,0,0,.35)",380));
  // Len pod haft krzyżykowy: drobna kratka splotu i rzadkie czerwone krzyżyki (kafel 12 px).
  const krzyzyki=c=>wzor(c,"krzyz",()=>{
    const cv=document.createElement("canvas");cv.width=cv.height=12;const x=cv.getContext("2d");
    x.fillStyle="rgba(120,96,60,.16)";for(let i=0;i<12;i+=3){x.fillRect(i,0,1,12);x.fillRect(0,i,12,1);}
    x.strokeStyle="rgba(190,30,40,.8)";x.lineWidth=1.1;x.lineCap="round";
    x.beginPath();x.moveTo(3.5,3.5);x.lineTo(8.5,8.5);x.moveTo(8.5,3.5);x.lineTo(3.5,8.5);x.stroke();
    return cv;
  });
  // faktura motywu (kafel 512 bez szwów); zanim się wczyta: włókna z kodu
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    if(!im)return filcCzarny(c);
    return wzor(c,"faktura",()=>im);
  }

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.25,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["242,181,28",.09],["216,38,46",.07]],swiatlo:["255,214,120","216,38,46"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle=CZARNY;c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.32,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(8,8,8,0)");g.addColorStop(1,"rgba(8,8,8,.3)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Czarna szyba: faktura haftu (kolorowe oczka ściegu, niskie krycie), ciepłe światło od góry jak lampa nad
  // stołem z robótkami, ku dołowi lekkie przyciemnienie.
  function fakturaKarty(c,L){
    c.globalAlpha=.5;c.fillStyle=fakturaWzor(c);c.fillRect(L.x,L.y,L.w,L.h);c.globalAlpha=1;
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,226,170,.06)");g.addColorStop(.35,"rgba(255,226,170,0)");g.addColorStop(1,"rgba(0,0,0,.16)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
  }

  // =========================================================================================== nuty
  // Pas wycinanki: spodnia warstwa filcu w kolorze (cała taśma), na niej węższa warstwa w kolorze kontrastowym
  // z ząbkowanym brzegiem góra-dół i drobnym oczkiem haftu co ząbek (kafel wzoru z pamięci podręcznej, raz na
  // wysokość i zestaw), kremowy ścieg przy górnej krawędzi. Pięć zestawów z ziarna, obrys ciemny w kolorze spodu.
  const ZESTAWY=[
    [CZERW,ZOLTY,KOBALT,CZERW_C],[SZMARAGD,ROZ,ZOLTY,SZMARAGD_C],[KOBALT,ZOLTY,CZERW,KOBALT_C],
    [ZOLTY,CZERW,SZMARAGD,ZOLTY_C],[ROZ,LIMONKA,KOBALT,ROZ_C]];
  const PASY=new Map();
  function pas(c,z,nh){
    const h=Math.max(4,Math.round(nh)),k=z*1000+h;let p=PASY.get(k);if(p)return p;
    if(PASY.size>80)PASY.clear();
    const Z=ZESTAWY[z],t=Math.max(6,Math.round(h*.62)),cv=document.createElement("canvas");cv.width=t;cv.height=h+4;
    const x=cv.getContext("2d"),y0=2,gora=y0+h*.26,dol=y0+h*.74,zab=Math.max(1.5,h*.12);
    // druga warstwa: ząbki (wycięte nożyczkami trójkąty) na górze i na dole
    x.beginPath();x.moveTo(0,gora);x.lineTo(t/2,gora-zab);x.lineTo(t,gora);x.lineTo(t,dol);x.lineTo(t/2,dol+zab);x.lineTo(0,dol);x.closePath();
    x.fillStyle="rgba(0,0,0,.28)";x.save();x.translate(0,1);x.fill();x.restore();   // cień spodu (warstwa leży wyżej)
    x.fillStyle=Z[1];x.fill();
    // oczko haftu: romb w kolorze trzecim z kremową kropką
    if(h>=9){const cx=t/2,cy=y0+h/2,r=Math.max(1.6,h*.13);
      x.beginPath();x.moveTo(cx,cy-r);x.lineTo(cx+r,cy);x.lineTo(cx,cy+r);x.lineTo(cx-r,cy);x.closePath();x.fillStyle=Z[2];x.fill();
      x.fillStyle=KREM;x.beginPath();x.arc(cx,cy,Math.max(.6,r*.32),0,TAU);x.fill();}
    p=c.createPattern(cv,"repeat");PASY.set(k,p);return p;
  }
  const CIEN=new Map();
  function cienPasa(c,nh){
    const k=Math.round(nh*2);let g=CIEN.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,245,220,.18)");g.addColorStop(.3,"rgba(255,245,220,0)");g.addColorStop(.75,"rgba(0,0,0,.06)");g.addColorStop(1,"rgba(0,0,0,.3)");
      CIEN.set(k,g);}
    return g;
  }
  const KRESKI=new Map();
  function kreska(d){const k=Math.round(d*2);let a=KRESKI.get(k);if(!a){a=[Math.max(2,k*.9),Math.max(1.5,k*.55)];KRESKI.set(k,a);}return a;}
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2,z=(o.ziarno|0)%5,Z=ZESTAWY[z];
      c.fillStyle=Z[0];c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=filcNuty(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(nh>=6){c.save();c.translate(x0,y0-2);c.fillStyle=pas(c,z,nh);c.fillRect(0,0,w,nh+4);c.restore();}
      c.fillStyle=cienPasa(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(w<nh*1.2||nh<9)return;
      const m=Math.max(1.6,nh*.12);
      c.strokeStyle=KREM;c.lineWidth=Math.max(.9,nh*.07);c.setLineDash(kreska(Math.max(2,nh*.18)));c.lineDashOffset=(o.ziarno|0)%3;
      c.beginPath();c.moveTo(x0+m+1,y0+m);c.lineTo(-x0-m-1,y0+m);c.stroke();
      c.setLineDash(BRAK);c.lineDashOffset=0;
    },
    brzeg:ep=>"#0b0b0b",zapas:()=>0};

  // =========================================================================================== klawisze
  // Czarny filc z fakturą haftu; białe klawisze to lniane paski haftu krzyżykowego (od kreski do kreski), czarne
  // z czarnego filcu z czerwonym ściegiem; kremowy ścieg wokół. Gracz: słonecznikowy pasek i czerwony ścieg.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(0,0,0,.5)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=FILC;c.fill();
      c.save();c.clip();c.globalAlpha=.7;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.globalAlpha=1;c.restore();
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,LEN);grad.addColorStop(.75,"#e2d6bb");grad.addColorStop(1,LEN_C);
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.rect(x+ins+1,yt+ins,w-2*ins-2,hh);
      }
      c.fillStyle=grad;c.fill();c.fillStyle=krzyzyki(c);c.fill();
      c.strokeStyle="rgba(26,26,26,.7)";c.lineWidth=1;c.stroke();
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,3,3,0]);}
      c.fillStyle=FILC;c.fill();c.fillStyle=filcCzarny(c);c.fill();
      c.setLineDash([2,1.6]);c.strokeStyle="rgba(216,38,46,.85)";c.lineWidth=.9;c.stroke();c.setLineDash(BRAK);
      c.setLineDash(SCIEG);c.strokeStyle="rgba(237,230,218,.6)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle="#000";c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(242,181,28,.82)":"rgba(242,181,28,.42)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?CZERW_C:"rgba(142,18,25,.6)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2,y+1,L.kw-4,Math.max(1,hh-1));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Fani z fan-*.webp (oczyszczeni z fioletowej obwódki) stoją rzędem jak na festynie; podskakują w rytm ćwierćnut
  // przy śpiewie, kombo i brawach, w spokoju stoją. Kolejność z ziarnem bez sąsiadów-bliźniaków, odbicia i skala.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=23;
    while(r.length<n){
      const p=[];for(let i=0;i<FANY;i++)p.push(i);for(let i=FANY-1;i>0;i--){const j=Math.floor(los(z,i)*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}z++;
      if(p[0]===ost){const t=p[0];p[0]=p[FANY-1];p[FANY-1]=t;}
      for(const f of p){if(r.length>=n)break;const k=r.length;
        r.push({f,lustro:los(k,3)>.5,sk:.86+.14*los(k,4),faza:[0,.5,.25,.75][k%4]+.1*los(k,5),dx:(los(k,8)-.5)*.2});ost=f;}
    }
    RZAD.set(n,r);return r;
  }
  function fan(i,h,lustro){
    if(!jest())return null;const im=czysty("fan-"+i+".webp");if(!im)return null;
    const s=h/im.height,w=Math.max(1,Math.round(im.width*s));
    return bufor("wy-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  const podloga=(W,h)=>bufor("wy-podl|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(8,8,8,0)");g.addColorStop(.55,"rgba(8,8,8,.4)");g.addColorStop(1,"rgba(8,8,8,.62)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
  });
  const widownia={
    // czyszczenie obwódek przed piosenką (getImageData raz na plik), żeby nie kosztowało klatki gry
    rozgrzej(){if(!jest())return;try{for(let i=0;i<FANY;i++)czysty("fan-"+i+".webp");}catch(e){}},
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      c.drawImage(podloga(W,h).cv,0,Wd.y,W,h);
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.82)),krok=W/n,R=rzad(n);
      const ruch=!st.spokoj&&!st.bezRuchu,zywe=st.spiewaja||(st.zar||0)>.05||(st.ap||0)>.12;
      const moc=zywe?.05+.05*Math.min(1,st.skok||0)+.03*Math.min(3,st.zar||0)+.06*Math.min(1,(st.ap||0)*2):.02*Math.min(1,st.skok||0);
      const fz=st.faza||0,dno=Wd.y+h;
      for(let i=0;i<n;i++){
        const r=R[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        const hop=ruch&&moc?Math.abs(Math.sin(PI*(fz+r.faza)))*fh*moc:0;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno+hh*.04,st,"obrot",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
    }};

  // =========================================================================================== streak
  // Rozeta wycinanki: płatek to wycięty kształt w kolorze z czarnym konturem naszywki (najpierw gruby czarny obrys
  // wszystkich płatków, potem wypełnienie, więc warstwa wygląda jak jeden wycinek) i kremowym ściegiem wzdłuż osi.
  // ostry=false: płatek zaokrąglony jak kropla, true: spiczasty liść.
  function platki(c,n,r0,r1,szer,kol,obw,faza,scieg,ostry){
    c.beginPath();
    for(let i=0;i<n;i++){
      const a=faza+i*TAU/n,ca=Math.cos(a),sa=Math.sin(a),w=szer;
      const px=(r,t)=>r*ca-t*sa,py=(r,t)=>r*sa+t*ca,rm=r0+(r1-r0)*.45;
      c.moveTo(px(r0,0),py(r0,0));
      if(ostry){c.quadraticCurveTo(px(rm,w),py(rm,w),px(r1,0),py(r1,0));c.quadraticCurveTo(px(rm,-w),py(rm,-w),px(r0,0),py(r0,0));}
      else{c.bezierCurveTo(px(rm,w),py(rm,w),px(r1,w*.95),py(r1,w*.95),px(r1,0),py(r1,0));c.bezierCurveTo(px(r1,-w*.95),py(r1,-w*.95),px(rm,-w),py(rm,-w),px(r0,0),py(r0,0));}
    }
    c.lineJoin="round";c.strokeStyle="#0b0b0b";c.lineWidth=4;c.stroke();
    c.fillStyle=kol;c.fill();c.strokeStyle=obw;c.lineWidth=1;c.stroke();
    if(scieg){
      c.beginPath();
      for(let i=0;i<n;i++){const a=faza+i*TAU/n;c.moveTo(Math.cos(a)*(r0+5),Math.sin(a)*(r0+5));c.lineTo(Math.cos(a)*(r1-7),Math.sin(a)*(r1-7));}
      c.setLineDash(SCIEG_ROZ);c.strokeStyle="rgba(237,230,218,.9)";c.lineWidth=1.2;c.stroke();c.setLineDash(BRAK);
    }
  }
  // wianuszek kółek (falisty brzeg wycinanki): czarny obrys pod spodem, wypełnienie scala kółka w jeden wycinek
  function kolka(c,n,R,r,kol,faza){
    c.beginPath();
    for(let i=0;i<n;i++){const a=faza+i*TAU/n,x=Math.cos(a)*R,y=Math.sin(a)*R;c.moveTo(x+r,y);c.arc(x,y,r,0,TAU);}
    c.strokeStyle="#0b0b0b";c.lineWidth=4;c.stroke();c.fillStyle=kol;c.fill();
  }
  // Zewnętrzna część rozety (obraca się w prawo): czerwone płatki-krople ze ściegiem, między nimi zielone liście,
  // od og 2 słonecznikowe oczka na płatkach, przy og 3 z tyłu falisty wianuszek kobaltowych kółek. Liczba płatków
  // rośnie z ogniem (8/10/12). Bufor 200 px na poziom.
  const zewn=og=>bufor("wy-rz|"+og,200,200,c=>{
    c.translate(100,100);
    const n=og>=3?12:og>=2?10:8,r1=og>=2?86:78;
    if(og>=3){kolka(c,n*2,82,11,KOBALT,PI/(n*2));
      c.fillStyle=KREM;c.beginPath();for(let i=0;i<n*2;i++){const a=PI/(n*2)+i*TAU/(n*2),x=Math.cos(a)*86,y=Math.sin(a)*86;c.moveTo(x+2,y);c.arc(x,y,2,0,TAU);}c.fill();}
    platki(c,n,34,64,9,SZMARAGD,SZMARAGD_C,PI/n,true,true);
    platki(c,n,30,r1,og>=2?16:17,CZERW,CZERW_C,0,true,false);
    if(og>=2){c.beginPath();for(let i=0;i<n;i++){const a=i*TAU/n,x=Math.cos(a)*(r1-11),y=Math.sin(a)*(r1-11);c.moveTo(x+5,y);c.arc(x,y,5,0,TAU);}
      c.strokeStyle="#0b0b0b";c.lineWidth=2;c.stroke();c.fillStyle=ZOLTY;c.fill();}
  });
  // Wewnętrzna (w lewo): różowy falisty krąg wycinanki i słonecznikowe kółeczka na nim; środek zasłania głowa,
  // widać brzeg warstwy wokół głowy.
  const wewn=og=>bufor("wy-rw|"+og,120,120,c=>{
    c.translate(60,60);
    kolka(c,og>=3?16:12,46,9,ROZ,0);
    c.beginPath();c.arc(0,0,44,0,TAU);c.fillStyle=ROZ;c.fill();
    c.beginPath();c.arc(0,0,48,0,TAU);c.setLineDash(SCIEG_ROZ);c.strokeStyle="rgba(237,230,218,.9)";c.lineWidth=1.1;c.stroke();c.setLineDash(BRAK);
    const m=og>=3?16:12;c.fillStyle=ZOLTY;c.beginPath();for(let i=0;i<m;i++){const a=i*TAU/m,x=Math.cos(a)*46,y=Math.sin(a)*46;c.moveTo(x+2.6,y);c.arc(x,y,2.6,0,TAU);}c.fill();
  });
  const poswiata=()=>bufor("wy-posw",96,96,c=>{
    const g=c.createRadialGradient(48,48,0,48,48,48);
    g.addColorStop(0,"rgba(255,214,120,.5)");g.addColorStop(.45,"rgba(242,120,60,.2)");g.addColorStop(1,"rgba(216,38,46,0)");
    c.fillStyle=g;c.fillRect(0,0,96,96);
  });
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("wy-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};

  // rozkwit: na wzrost ognia rozeta otwiera się od 55 % do pełnej wielkości w ~0,45 s (stan per gracz z ziarna z)
  const KWIT=new Map();
  function kwit(z,og,ts){
    let s=KWIT.get(z);if(!s){s={og:0,t:-9};KWIT.set(z,s);}
    if(og>s.og)s.t=ts;s.og=og;
    const f=Math.min(1,Math.max(0,(ts-s.t)/.45));
    return .55+.45*(1-(1-f)*(1-f)*(1-f))+.05*Math.sin(f*PI);
  }

  const streak={
    glowa(c,sc,og,ts,z,przod){
      if(przod||!jest())return;
      const cy=-sc*.36,k=kwit(z,og,ts),r=sc*(.6+.06*og)*k,ri=sc*.46*k;
      const p=poswiata(),rp=r*1.3;c.globalAlpha=.75;c.drawImage(p.cv,-rp,cy-rp,2*rp,2*rp);c.globalAlpha=1;
      const a=ts*.22+z;
      c.save();c.translate(0,cy);c.rotate(a);const b=zewn(og);c.drawImage(b.cv,-r,-r,2*r,2*r);
      c.rotate(-2*a);const w=wewn(og);c.drawImage(w.cv,-ri,-ri,2*ri,2*ri);c.restore();
    },
    // ślad: wstążki z wianka (3/4/5 kolorów z ogniem), falują coraz mocniej ku ogonowi, wygasają gradientem
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const n=k.og>=3?5:k.og>=2?4:3,ts=k.ts,odst=k.og>=3?3.4:3,amp=k.og>=3?7:5;
      c.lineCap="round";c.lineJoin="round";c.lineWidth=k.og>=3?3:2.6;
      for(let j=0;j<n;j++){
        c.beginPath();let pi=false,ostX=-1e9;const off=(j-(n-1)/2)*odst,fz=j*1.3;
        for(let i=0;i<pts.length;i++){
          const p=pts[i];if(!p.sp){pi=false;continue;}
          if(i<pts.length-1&&p.x-ostX<4&&pi)continue;ostX=p.x;
          const f=Math.max(0,Math.min(1,(k.xT-p.x)/(k.dlug||1))),y=p.y+off*(1+f*1.4)+Math.sin(p.x*.06-ts*3.2+fz)*amp*f;
          if(pi)c.lineTo(p.x,y);else{c.moveTo(p.x,y);pi=true;}
        }
        c.strokeStyle=gradWstazki(c,k.x0,k.xT,j);c.stroke();
      }
    },
    // płonąca nuta: zaśpiewana część rozjaśnia się słonecznikiem, na froncie mała rozeta
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(255,214,120,.3)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas>.05&&jest()){
        const im=iskra(0,40),s=nh*(aktywna?1.5:1.2);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.55,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)sypanie(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{poswiata();for(let og=1;og<=3;og++){zewn(og);wewn(og);}for(let i=0;i<ISKRY;i++)iskra(i,40);}catch(e){}},
    aura:[ZOLTY,CZERW],wypelnienie:["#fff3c8",ZOLTY,CZERW],
    iskry:{kolory:[ZOLTY,CZERW,"#ff8fb8"]},dym:false,
    scena:["255,214,120","216,38,46","42,85,196"],
    tlo:{promienie:[["242,181,28",.09],["216,38,46",.07]],swiatlo:["255,214,120","216,38,46"]}};

  const KOL_WST=[CZERW,ZOLTY,KOBALT,SZMARAGD,ROZ],GRAD=new Map();
  function gradWstazki(c,x0,xT,j){
    const kl=(Math.round(x0)*16384+Math.round(xT))*8+j;let g=GRAD.get(kl);if(g)return g;
    if(GRAD.size>60)GRAD.clear();
    const kol=KOL_WST[j],a=c.createLinearGradient(x0,0,xT,0);
    a.addColorStop(0,kol+"00");a.addColorStop(.45,kol+"b0");a.addColorStop(1,kol);
    GRAD.set(kl,a);return a;
  }

  // ---- listki, tulipany i serca przy trafieniach: pula na gracza, bez alokacji w klatce ----
  // Trafienie przy kombo ≥ 4 wyrzuca z głowy jeden drobiazg (próg co 4 nuty: dwa), lecą w górę i do tyłu,
  // potem opadają, kołysząc się jak wycięty papier.
  const PULE=new WeakMap(),MAKS=10,RODZ=[2,3,2,3,5,0,2,4];
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,cz:[],nr:0};
    for(let i=0;i<MAKS;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,k:2,r:20,fz:0});
    PULE.set(g,p);return p;
  }
  function sypanie(c,L,g,st){
    if(typeof pozycjaZaby!=="function")return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(k>P.k&&k>=4){
      const pz=pozycjaZaby(L,g);let ile=k%4===0?2:1;
      for(const p of P.cz){if(ile<=0)break;if(p.z>0)continue;ile--;
        p.k=RODZ[P.nr++%RODZ.length];p.r=Math.round(sc*(.26+.04*og)*(.85+.3*Math.random()));
        p.x=pz.x-sc*.1+(Math.random()-.5)*sc*.4;p.y=pz.y-sc*.45;p.vx=-(30+50*Math.random());p.vy=-(70+50*Math.random());
        p.fz=Math.random()*TAU;p.zy=1.5+.5*Math.random();p.z=p.zy;}
    }
    P.k=k;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.vy+=120*dt;if(p.vy>45)p.vy=45;p.x+=p.vx*dt+Math.sin(p.fz+p.z*4)*dt*30;p.y+=p.vy*dt;
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,s=p.r*(f<.12?.5+.5*f/.12:1);
      c.globalAlpha=p.z<.4?p.z/.4:1;c.drawImage(b.cv,p.x-s/2,p.y-s/2,s,s);
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Słowiańska",kolejnosc:13,kolor:"#d8262e",zasoby:ZASOBY,zaba:true,przebranie:true,
    opis:"Łowicka wycinanka i haft ludowy na czarnym filcu: kwiaty, koguty i wstążki, a w widowni tańczą filcowe koguciki. Nuty to kolorowe pasy wycinanki z ząbkowanym brzegiem i ściegiem, klawisze jak paski haftu krzyżykowego, a przy kombo za głową żaby rozkwita symetryczna rozeta i powiewają wstążki z wianka.",
    cechy:{tlo:"haft ludowy na czarnym filcu",klawisze:"haft krzyżykowy",streak:"rozeta i wstążki",widownia:"fani ludowi i koguciki"},
    en:{nazwa:"Slavic",
      opis:"Polish folk papercut and embroidery on black felt: flowers, roosters and ribbons, with felt roosters dancing in the crowd. Notes are colourful papercut strips with zigzag edges and stitching, keys look like cross-stitch bands, and on a combo a symmetrical papercut rosette blooms behind your head while ribbons from the flower crown flutter behind you.",
      cechy:{tlo:"folk embroidery on black felt",klawisze:"cross-stitch bands",streak:"rosette and ribbons",widownia:"folk fans and roosters"}},
    karta:{papier:"#141414",cien:"rgba(0,0,0,.45)",czarne:"rgba(0,0,0,.22)",liniaC:"rgba(237,230,218,.2)",minione:"rgba(0,0,0,.28)",
      nazwy:"rgba(237,230,218,.8)",kreski:"rgba(237,230,218,.17)",nic:ZOLTY,szpilka:CZERW,szpilkaBlask:"#ffffff",
      cienNuty:"rgba(0,0,0,.5)",scieg:"rgba(237,230,218,.4)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
