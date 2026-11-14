// Motyw „Kukiełki” (runda 6, 10-19): teatr kukiełkowy z filcu, ukłon w stronę wodewilowego show z kukiełkami (bez nazw
// własnych i bez napisów). Tło to ilustracja (tlo.webp: czerwona aksamitna kurtyna ze złotymi frędzlami, lambrekin ze
// złotym galonem, loże po bokach, drewniana scena i rampa z żarówkami), karta toru to głęboka czerwień aksamitu
// (faktura.webp z pionowymi fałdami mnożona na czerwień), u góry i u dołu cienki złoty galon ze ściegiem, od góry ciepły
// blask reflektora. Nuty: kudłate pasy filcu w kolorach kukiełek (niebieski, pomarańcz, róż, brąz, fiolet, żółty z
// ziarna), z futrzastą krawędzią z krótkich włosków wzdłuż brzegu i ciemnym obrysem. Klawiatura: białe klawisze z
// kremowego filcu jak w teatralnym pianinie, czarne z ciemnego aksamitu przeszyte złotą nicią. Widownia: dwanaście
// kukiełek (fan-0..11.webp) wygłupia się na brzegu sceny za rampą z żarówek, które przygasają i błyskają w rytm.
// Streak (detal PODPISOWY): ślad to czerwony aksamitny sznur ze złotą nicią i złotym frędzlem, wokół migocze złoty pył
// reflektora; z widowni lecą na scenę rekwizyty (gwiazda, ciasto z kremem, gumowy kurczak, banan, pomidor, frędzel;
// iskra-0..5), koziołkując, a od og 2 nad żabą zapala się stożek reflektora (jedna poświata z bufora, łagodnie, bez
// stroboskopu). Głowa bez efektu: żabę ubiera przebranie motywu. Wszystko z buforów i wzorów z pamięci.
(function(){
  "use strict";
  const ID="kukielki",PI=Math.PI,TAU=2*PI;
  const AKSAMIT="#6e101c",AKSAMIT_C="#3a0710",AKSAMIT_G="#22040a",ZLOTO="#f2c230",ZLOTO_C="#b8851f",KREM="#f6ecd2",
    KURTYNA="#b3202f";
  const FANY=12,ISKRY=6;   // fan-0..11: dwanaście różnych kukiełek; iskra-0..5: gwiazda, ciasto, kurczak, banan, pomidor, frędzel
  const ZASOBY=["tlo.webp","faktura.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5],NIC=[2,3],SKRET=[3,4];   // kreski bez nowych tablic w klatce

  // =========================================================================================== wzory (raz)
  // Włókna filcu: krótkie zakrzywione włoski w dwóch tonach na kafelku 96 px, zawinięte na brzegach (bez szwu).
  function kafelekFilcu(jasne,ciemne,ile,dl){
    const cv=document.createElement("canvas");cv.width=cv.height=96;const x=cv.getContext("2d");
    x.lineCap="round";
    for(const [kol,off] of [[ciemne,0],[jasne,1]]){
      x.strokeStyle=kol;x.lineWidth=off?.7:.9;x.beginPath();
      for(let i=off;i<ile;i+=2){
        const px=los(i,1)*96,py=los(i,2)*96,a=los(i,3)*TAU,l=2+los(i,4)*(dl||5),dx=Math.cos(a)*l,dy=Math.sin(a)*l;
        for(const [ox,oy] of [[0,0],[-96,0],[0,-96],[-96,-96]]){x.moveTo(px+ox,py+oy);x.quadraticCurveTo(px+ox+dx*.5+dy*.2,py+oy+dy*.5-dx*.2,px+ox+dx,py+oy+dy);}
      }
      x.stroke();
    }
    return cv;
  }
  // Pionowe fałdy aksamitu z kodu (zanim wczyta się faktura): ciemniejsze i jaśniejsze pasy na kafelku 64 × 8.
  function kafelekFald(){
    const cv=document.createElement("canvas");cv.width=64;cv.height=8;const x=cv.getContext("2d");
    const g=x.createLinearGradient(0,0,64,0);
    g.addColorStop(0,"rgba(0,0,0,.22)");g.addColorStop(.3,"rgba(255,120,120,.06)");g.addColorStop(.55,"rgba(0,0,0,.08)");
    g.addColorStop(.8,"rgba(255,120,120,.04)");g.addColorStop(1,"rgba(0,0,0,.22)");
    x.fillStyle=g;x.fillRect(0,0,64,8);return cv;
  }
  const WZORY=new Map();
  function wzor(c,klucz,tworz,skala){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");if(skala&&w&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix().scale(skala));WZORY.set(klucz,w);}
    return w;
  }
  const falda=c=>wzor(c,"falda",kafelekFald);
  const kudly=c=>wzor(c,"kudly",()=>kafelekFilcu("rgba(255,255,250,.3)","rgba(20,0,10,.24)",520,6));
  const filcKrem=c=>wzor(c,"krem",()=>kafelekFilcu("rgba(255,252,240,.55)","rgba(120,86,40,.2)",320));
  // faktura motywu (czerwony aksamit z fałdami, kafel 512 bez szwów, w skali 0,5); zanim się wczyta: fałdy z kodu
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    if(!im)return falda(c);
    return wzor(c,"faktura",()=>im,.5);
  }

  // =========================================================================================== sprite'y
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("ku-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};
  // złota plama światła (front zaśpiewanej nuty): radialny gradient raz do bufora
  const blask=r=>jest()?bufor("ku-blask|"+r,2*r,2*r,c=>{
    const g=c.createRadialGradient(r,r,0,r,r,r);g.addColorStop(0,"rgba(255,246,200,.9)");g.addColorStop(.35,"rgba(255,214,110,.45)");g.addColorStop(1,"rgba(255,190,70,0)");
    c.fillStyle=g;c.fillRect(0,0,2*r,2*r);}):null;
  // Stożek reflektora (128 × 256, rozciągany do wysokości żaby): dwa trapezy (szerszy i bledszy, węższy i jaśniejszy,
  // więc brzeg wychodzi miękki bez filtrów) i owalna plama światła u dołu, gdzie stoi żaba.
  const stozek=()=>jest()?bufor("ku-stozek",128,256,c=>{
    for(const [gora,dol,a0,a1] of [[16,60,.19,.08],[9,46,.25,.12]]){
      const g=c.createLinearGradient(0,0,0,256);
      g.addColorStop(0,"rgba(255,244,206,"+a0+")");g.addColorStop(.7,"rgba(255,232,170,"+a1+")");g.addColorStop(1,"rgba(255,226,150,"+a1*.6+")");
      c.fillStyle=g;c.beginPath();c.moveTo(64-gora,0);c.lineTo(64+gora,0);c.lineTo(64+dol,256);c.lineTo(64-dol,256);c.closePath();c.fill();
    }
    const r=c.createRadialGradient(64,220,0,64,220,60);
    r.addColorStop(0,"rgba(255,240,196,.32)");r.addColorStop(.6,"rgba(255,226,150,.12)");r.addColorStop(1,"rgba(255,226,150,0)");
    c.save();c.translate(0,220);c.scale(1,.55);c.translate(0,-220);c.fillStyle=r;c.fillRect(0,150,128,140);c.restore();
  }):null;

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.18,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["255,214,120",.09],["179,32,47",.06]],swiatlo:["255,222,150","90,10,20"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#7a1420";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.4);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.34,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(30,4,8,0)");g.addColorStop(1,"rgba(30,4,8,.34)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Głęboka czerwień aksamitu: faktura z fałdami mnożona ok. 0,4 (fałdy pionowe ledwie widać), ciemniejsze boki jak
  // zawinięta kurtyna, od góry ciepły, statyczny blask reflektora, ku dołowi cień. U góry i u dołu cienki złoty galon:
  // złoty pasek z ciemnym brzegiem i kremowym ściegiem pośrodku.
  function galon(c,x,y,w,gh){
    const g=c.createLinearGradient(0,y,0,y+gh);
    g.addColorStop(0,"#a8761f");g.addColorStop(.35,"#f4d272");g.addColorStop(.65,ZLOTO);g.addColorStop(1,"#8f611a");
    c.fillStyle=g;c.fillRect(x,y,w,gh);
    c.fillStyle="rgba(40,6,10,.5)";c.fillRect(x,y-1,w,1);c.fillRect(x,y+gh,w,1);
    c.setLineDash(SCIEG);c.strokeStyle="rgba(255,248,226,.8)";c.lineWidth=1;
    c.beginPath();c.moveTo(x+2,y+gh/2);c.lineTo(x+w-2,y+gh/2);c.stroke();c.setLineDash(BRAK);
  }
  function fakturaKarty(c,L){
    c.globalCompositeOperation="multiply";c.globalAlpha=.4;c.fillStyle=fakturaWzor(c);c.fillRect(L.x,L.y,L.w,L.h);
    c.globalCompositeOperation="source-over";c.globalAlpha=1;
    const b=c.createLinearGradient(L.x,0,L.x+L.w,0);
    b.addColorStop(0,"rgba(24,2,6,.36)");b.addColorStop(.1,"rgba(24,2,6,0)");b.addColorStop(.9,"rgba(24,2,6,0)");b.addColorStop(1,"rgba(24,2,6,.36)");
    c.fillStyle=b;c.fillRect(L.x,L.y,L.w,L.h);
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,206,120,.1)");g.addColorStop(.3,"rgba(255,206,120,0)");g.addColorStop(.75,"rgba(24,2,6,0)");g.addColorStop(1,"rgba(24,2,6,.3)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
    // blask reflektora: ciepła owalna plama przy górnej krawędzi
    const rr=Math.max(40,L.w*.42),r=c.createRadialGradient(L.x+L.w*.5,L.y,0,L.x+L.w*.5,L.y,rr);
    r.addColorStop(0,"rgba(255,226,160,.26)");r.addColorStop(.5,"rgba(255,214,140,.08)");r.addColorStop(1,"rgba(255,214,140,0)");
    c.save();c.translate(0,L.y);c.scale(1,.6);c.translate(0,-L.y);c.fillStyle=r;c.fillRect(L.x,L.y,L.w,rr);c.restore();
    const gh=Math.max(3,Math.min(5,Math.round(L.h*.012)));
    galon(c,L.x,L.y+2,L.w,gh);galon(c,L.x,L.y+L.h-2-gh,L.w,gh);
  }

  // =========================================================================================== nuty
  // Kudłaty pas filcu kukiełki: kolor z ziarna (sąsiednie nuty zawsze inne), włoski filcu z wzoru, cień walca dający
  // pluszową objętość. Poza obrysem krótkie włoski wzdłuż górnego i dolnego brzegu (ciemny podkład i jaśniejszy włos,
  // dwie kreski na całą sierść), ścieżki z pamięci podręcznej per szerokość, wysokość i ziarno.
  const KUKLY=["#3a7be0","#f5841f","#f39ac7","#c2884e","#9b62d9","#f4c430"];
  const SIERSC=["#79a9f2","#ffad5e","#ffc6e0","#e0b07c","#bd92ec","#ffe070"];
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,255,245,.3)");g.addColorStop(.3,"rgba(255,255,245,0)");g.addColorStop(.62,"rgba(30,0,10,.06)");g.addColorStop(1,"rgba(30,0,10,.38)");
      WALEC.set(k,g);}
    return g;
  }
  // włoski sierści: krótkie kreski wychodzące z brzegu, długość i przechył z ziarna
  function wloski(p,w,nh,z){
    const x0=-w/2+3,x1=w/2-3,hl=Math.max(2.4,nh*.3),krok=Math.max(2,nh*.16,w/110);   // długa nuta: najwyżej ok. 110 włosków na brzeg
    let i=0;
    for(let x=x0;x<=x1;x+=krok,i++){
      for(let s=-1;s<=1;s+=2){
        const k=i*2+(s>0?1:0),dx=(los(z,k)-.5)*krok*.7,l=hl*(.5+.75*los(z,k+97)),t=(los(z,k+191)-.5)*1.1,yb=s*(nh/2-1);
        p.moveTo(x+dx,yb);p.lineTo(x+dx+t*l,yb+s*l);
      }
    }
  }
  const SCIEZKI=new Map(),MA_P2D=typeof Path2D!=="undefined";
  function sierscPath(w,nh,z){
    const kl=(Math.round(w)*64+Math.round(nh))*8+(z&7);let p=SCIEZKI.get(kl);
    if(!p){if(SCIEZKI.size>240)SCIEZKI.clear();p=new Path2D();wloski(p,Math.round(w),Math.round(nh),z&7);SCIEZKI.set(kl,p);}
    return p;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2,z=o.ziarno|0;
      c.fillStyle=KUKLY[z%6];c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=kudly(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
    },
    poza(c,w,nh,o){
      if(w<8||nh<5)return;
      const z=o.ziarno|0;
      c.lineCap="round";
      if(MA_P2D){
        const p=sierscPath(w,nh,z);
        c.strokeStyle="rgba(34,6,12,.85)";c.lineWidth=2.3;c.stroke(p);
        c.strokeStyle=SIERSC[z%6];c.lineWidth=1.1;c.stroke(p);
      }else{
        c.beginPath();wloski(c,w,nh,z&7);
        c.strokeStyle="rgba(34,6,12,.85)";c.lineWidth=2.3;c.stroke();
        c.strokeStyle=SIERSC[z%6];c.lineWidth=1.1;c.stroke();
      }
    },
    brzeg:()=>"rgba(34,6,12,.9)",zapas:nh=>Math.ceil(nh*.42)+2};

  // =========================================================================================== klawisze
  // Podkład z ciemnego aksamitu (faktura mnożona), białe klawisze z kremowego filcu jak w teatralnym pianinie (od
  // kreski do kreski, z włóknami i cieniem u dołu), czarne z ciemnego aksamitu z połyskiem fałd i złotą nicią wzdłuż,
  // złoty ścieg wokół. Gracz: złoty pas z ciemnoczerwonym ściegiem.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(24,2,6,.5)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=AKSAMIT_C;c.fill();
      c.save();c.clip();c.globalCompositeOperation="multiply";c.globalAlpha=.5;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.restore();
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2,L.rh*.16)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,"#fbf4e2");grad.addColorStop(.65,KREM);grad.addColorStop(1,"#dccaa0");
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,4));
      }
      c.fillStyle=grad;c.fill();c.save();c.clip();c.fillStyle=filcKrem(c);c.fillRect(x,y0,w,h);
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){const yt=gr[i+1],hh=gr[i]-yt-2*ins;if(hh<1)continue;c.rect(x,yt+ins+hh*.62,w,hh*.38);}
      c.fillStyle="rgba(120,80,30,.18)";c.fill();c.restore();
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,4));}
      c.strokeStyle="rgba(90,40,20,.5)";c.lineWidth=1;c.stroke();
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,4,4,0]);}
      c.fillStyle=AKSAMIT_G;c.fill();c.save();c.clip();c.globalCompositeOperation="screen";c.globalAlpha=.3;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.restore();
      c.strokeStyle="rgba(10,0,2,.8)";c.lineWidth=1;c.stroke();
      // złota nić wzdłuż każdego czarnego klawisza
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s),yy=Math.round(k.y+k.h/2)+.5;if(k.h<3)continue;c.moveTo(k.x+3,yy);c.lineTo(k.x+k.w*.62-4,yy);}
      c.setLineDash(NIC);c.strokeStyle="rgba(242,194,48,.85)";c.lineWidth=1;c.stroke();
      c.setLineDash(SCIEG);c.strokeStyle="rgba(242,194,48,.75)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=AKSAMIT_G;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(242,194,48,.92)":"rgba(242,194,48,.5)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?AKSAMIT_C:"rgba(58,7,16,.55)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Kukiełki z fan-*.webp na brzegu drewnianej sceny, za rampą z żarówek. Kolejność z ziarnem bez sąsiadów-bliźniaków,
  // odbicia i skala z ziarna. Ruch `pop` (motywy.js): poza trzymana i nagły wodewilowy podskok z powiększeniem na
  // uderzeniu. Rampa na wierzchu chowa stopy; blask żarówek (jeden bufor) przygasa i błyska w rytm ćwierćnut.
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
  // tył: przyciemnienie od góry i pas jasnych desek sceny, na których stoją kukiełki
  const scena=(W,h,hd)=>bufor("ku-scena|"+W+"x"+h+"|"+hd,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(30,4,8,.1)");g.addColorStop(.5,"rgba(30,4,8,.36)");g.addColorStop(1,"rgba(30,4,8,.5)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
    const y=h-hd,d=c.createLinearGradient(0,y,0,h);d.addColorStop(0,"#c99a5e");d.addColorStop(1,"#9a6c38");
    c.fillStyle=d;c.fillRect(0,y,W,hd);
    c.beginPath();for(let x=0,j=0;x<W;x+=60+30*los(j,7),j++){c.moveTo(Math.round(x)+.5,y);c.lineTo(Math.round(x)+.5,h);}
    c.strokeStyle="rgba(90,56,22,.4)";c.lineWidth=1;c.stroke();
    c.fillStyle="rgba(40,14,4,.35)";c.fillRect(0,y,W,1.5);
  });
  // Rampa: czarny filcowy pas ze złotymi festonami ze ściegiem i rzędem żarówek (jasny środek, ciepła obwódka)
  const KROK_Z=46;
  const rampa=(W,hr)=>bufor("ku-rampa|"+W+"x"+hr,W,hr,c=>{
    c.fillStyle="#1c1013";c.fillRect(0,0,W,hr);
    c.fillStyle="rgba(255,255,255,.06)";c.fillRect(0,0,W,Math.max(1,hr*.08));
    c.fillStyle=ZLOTO_C;c.fillRect(0,0,W,Math.max(1.5,hr*.06));
    const fy=hr*.78,fr=KROK_Z/2;
    c.beginPath();for(let x=0;x<W+KROK_Z;x+=KROK_Z){c.moveTo(x,fy);c.quadraticCurveTo(x+fr,fy+hr*.2,x+KROK_Z,fy);}
    c.strokeStyle=ZLOTO_C;c.lineWidth=Math.max(1.5,hr*.07);c.stroke();
    c.setLineDash(SCIEG);c.strokeStyle="rgba(255,240,200,.6)";c.lineWidth=1;c.stroke();c.setLineDash(BRAK);
    const r=Math.max(2.5,Math.min(hr*.2,9)),by=hr*.4;
    for(let x=KROK_Z/2;x<W;x+=KROK_Z){
      const g=c.createRadialGradient(x,by,0,x,by,r*1.9);
      g.addColorStop(0,"#fffbe8");g.addColorStop(.42,"#ffe08a");g.addColorStop(.62,"rgba(214,150,40,.9)");g.addColorStop(1,"rgba(214,150,40,0)");
      c.fillStyle=g;c.fillRect(x-r*2,by-r*2,r*4,r*4);
    }
  });
  // blask rampy: ciepłe plamy nad każdą żarówką i łuna w górę, na nogi kukiełek
  const blaskRampy=(W,hb)=>bufor("ku-rblask|"+W+"x"+hb,W,hb,c=>{
    const g=c.createLinearGradient(0,0,0,hb);g.addColorStop(0,"rgba(255,214,120,0)");g.addColorStop(1,"rgba(255,214,120,.22)");
    c.fillStyle=g;c.fillRect(0,0,W,hb);
    const r=hb*.55;
    for(let x=KROK_Z/2;x<W;x+=KROK_Z){
      const q=c.createRadialGradient(x,hb,0,x,hb,r);q.addColorStop(0,"rgba(255,240,190,.5)");q.addColorStop(1,"rgba(255,220,140,0)");
      c.fillStyle=q;c.fillRect(x-r,hb-r,2*r,r);
    }
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const hr=Math.max(5,Math.round(h*.2)),hd=Math.max(3,Math.round(h*.12)),yr=Wd.y+h-hr;
      c.drawImage(scena(W,h,hd).cv,0,Wd.y,W,h);
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.92)),krok=W/n,R=rzad(n),dno=Wd.y+h*1.02;
      for(let i=0;i<n;i++){
        const r=R[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"pop",i);
      }
      const ruch=!st.spokoj&&!st.bezRuchu&&!st.mini,zywe=st.spiewaja||(st.zar||0)>.05||(st.ap||0)>.12;
      const f=+st.faza||0,uderz=ruch&&zywe?Math.pow(1-(f-Math.floor(f)),3):0,hb=Math.round(h*.45);
      c.globalAlpha=.45+.45*uderz;c.drawImage(blaskRampy(W,hb).cv,0,yr-hb,W,hb);c.globalAlpha=1;
      c.drawImage(rampa(W,hr).cv,0,yr,W,hr);   // rampa na wierzchu: kukiełki stoją za nią
    }};

  // =========================================================================================== streak
  // Ślad: czerwony aksamitny sznur. Ciemny cień, czerwony aksamit, jaśniejsze skręty sznura (kreska płynąca wolno ku
  // żabie) i cienka złota nić; wokół migocze złoty pył reflektora (romby w dwóch odcieniach, po jednej ścieżce na
  // odcień). Tuż za żabą ze sznura zwisa złoty frędzel (iskra-5) i kołysze się, od og 2 kolejne frędzle co ok. 90 px.
  const streak={
    glowa(){},
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const G=gradSladu(c,k.x0,k.xT),og=k.og|0,ts=k.ts||0,sz=og>=3?7:og>=2?6:5;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.strokeStyle=G.a;c.lineWidth=sz+3;c.stroke();
      c.strokeStyle=G.b;c.lineWidth=sz;c.stroke();
      c.lineCap="butt";c.setLineDash(SKRET);c.lineDashOffset=-ts*10;c.strokeStyle=G.c;c.lineWidth=sz*.45;c.stroke();
      c.setLineDash(NIC);c.lineDashOffset=ts*6;c.strokeStyle=G.d;c.lineWidth=1;c.stroke();
      c.setLineDash(BRAK);c.lineDashOffset=0;c.lineCap="round";
      // złoty pył reflektora: romby wokół sznura, migoczą i dryfują
      const dl=Math.max(1,k.dlug||(k.xT-k.x0)||1),n=pts.length,krok=Math.max(1,Math.floor(n/38));
      for(let t=0;t<2;t++){
        c.beginPath();
        for(let j=t;j<n;j+=krok+t){
          const p=pts[j];if(!p.sp)continue;
          const f=(p.x-k.x0)/dl;if(f<.05||f>1)continue;
          const ph=j*1.37,mig=.5+.5*Math.sin(ts*6+ph*2.3);if(mig<.25)continue;
          const r=(1.4+2.2*los(j,5))*(.4+.6*f)*mig*(1+.15*og);
          const x=p.x+Math.sin(ts*1.7+ph)*4,y=p.y+(los(j,9)-.5)*(sz*2.6+6)+Math.sin(ts*2.1+ph)*2;
          c.moveTo(x,y-r);c.lineTo(x+r*.6,y);c.lineTo(x,y+r);c.lineTo(x-r*.6,y);c.closePath();
        }
        c.fillStyle=t?ZLOTO:"#fff3c4";c.fill();
      }
      if(!jest()||k.pelna===false)return;
      const fr=iskra(5,48);if(!fr)return;
      const s=og>=3?27:og>=2?24:21,ile=og>=2?4:1;
      for(let j=0;j<ile;j++){
        const x=k.xT-30-j*90;if(x<k.x0+20)break;
        const y=ySladu(pts,x);if(y==null)continue;
        const f=Math.min(1,(x-k.x0)/dl*2.5);
        c.globalAlpha=f;c.save();c.translate(x,y+sz*.3);c.rotate(Math.sin(ts*2.6+j*1.9)*.32);c.drawImage(fr.cv,-s*.6,-s*.12,s,s);c.restore();
      }
      c.globalAlpha=1;
    },
    // płonąca nuta: zaśpiewana część rozbłyska złotem jak w świetle reflektora (złota warstwa, jasny pas u góry,
    // plama światła na froncie), na froncie gwiazdka (iskra-0)
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){
        const d=fx-x0;
        c.fillStyle="rgba(255,204,80,.5)";c.fillRect(x0,-nh/2,d,nh);
        c.fillStyle="rgba(255,248,214,.55)";c.fillRect(x0,-nh/2,d,Math.max(1,nh*.24));
        const b=jest()?blask(32):null;
        if(b){const R=nh*(aktywna?1.3:1);c.globalAlpha=.85;c.drawImage(b.cv,fx-R,-R,2*R,2*R);c.globalAlpha=1;}
      }
      if(gas>.05&&jest()){
        const im=iskra(0,48),s=nh*(aktywna?1.4:1.1);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.62,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)rekwizyty(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(0,48);iskra(5,48);blask(32);stozek();}catch(e){}},
    aura:["#fff0c4",KURTYNA],wypelnienie:["#fff6dc","#ffd86e",ZLOTO],
    iskry:{kolory:["#fff3c4",ZLOTO,KURTYNA]},dym:false,
    scena:["255,222,150","242,194,48","179,32,47"],
    tlo:{promienie:[["255,214,120",.09],["179,32,47",.06]],swiatlo:["255,222,150","90,10,20"]}};

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
    const lin=(k0,k1,k2)=>{const q=c.createLinearGradient(x0,0,xT,0);q.addColorStop(0,k0);q.addColorStop(.5,k1);q.addColorStop(1,k2);return q;};
    g={a:lin("rgba(34,4,10,0)","rgba(34,4,10,.55)","rgba(34,4,10,.85)"),
      b:lin("rgba(179,32,47,0)","rgba(179,32,47,.88)","rgba(200,40,56,1)"),
      c:lin("rgba(236,96,104,0)","rgba(236,96,104,.6)","rgba(246,120,124,.8)"),
      d:lin("rgba(242,194,48,0)","rgba(242,194,48,.75)","rgba(255,222,110,.95)")};
    GRAD.set(kl,g);return g;
  }

  // ---- rekwizyty z widowni i reflektor: pula na gracza, bez alokacji w klatce ----
  // Gwiazda, ciasto z kremem, gumowy kurczak, banan, pomidor i frędzel (iskra-0..5) lecą z dołu toru (z widowni) łukiem
  // w górę, mniej więcej do wysokości żaby za jej plecami, koziołkując, i spadają z powrotem; na progu kombo co 4 nuty
  // trzy naraz. Od og 2 nad żabą stoi stożek reflektora: rozjaśnia się przez ok. 0,4 s, oddycha bardzo wolno (bez
  // migania) i gaśnie, gdy ogień spadnie.
  const PULE=new WeakMap(),MAKS_CZ=8,TEMPO=[0,.9,1.5,2.4],LOSUJ=[0,1,2,3,4,5,1,2,4],GRAW=5;
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,dos:0,sw:0,cz:[]};
    for(let i=0;i<MAKS_CZ;i++)p.cz.push({z:0,x:0,y:0,vx:0,vy:0,k:0,r:20,rot:0,wir:0});
    PULE.set(g,p);return p;
  }
  function rzuc(P,L,g,sc,og,pz){
    for(const p of P.cz)if(p.z<=0){
      const dol=L.y+L.h,cel=Math.max(sc*.6,(dol-pz.y)*(.7+.4*Math.random())+sc*.2);
      p.k=LOSUJ[Math.floor(Math.random()*LOSUJ.length)];p.r=Math.round(sc*(.24+.04*og)*(.85+.3*Math.random()));
      p.x=pz.x-sc*(.35+1.1*Math.random());p.y=dol+p.r*.5;p.vx=-(15+45*Math.random());p.vy=-Math.sqrt(2*GRAW*sc*cel);
      p.rot=Math.random()*TAU;p.wir=(Math.random()<.5?-1:1)*(3+3.5*Math.random());p.z=3;return;
    }
  }
  function rekwizyty(c,L,g,st){
    if(typeof pozycjaZaby!=="function"||!jest())return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    P.sw=og>=2?Math.min(1,P.sw+dt*2.5):Math.max(0,P.sw-dt*1.6);
    let pz=null;
    if(og>0){
      P.dos+=dt*TEMPO[og];
      if(P.dos>=1){P.dos-=1;pz=pozycjaZaby(L,g);rzuc(P,L,g,sc,og,pz);}
      if(k>P.k&&k>=4&&k%4===0){pz=pz||pozycjaZaby(L,g);for(let j=0;j<3;j++)rzuc(P,L,g,sc,og,pz);}
    }else P.dos=0;
    P.k=k;
    // stożek reflektora pod rekwizytami
    if(P.sw>.01){
      const sz=stozek();
      if(sz){
        pz=pz||pozycjaZaby(L,g);
        const e=P.sw*P.sw*(3-2*P.sw),wb=sc*1.9,y0=L.y,hh=Math.max(sc,pz.y+sc*.5-y0);
        c.globalAlpha=e*(.9+.1*Math.sin((st.teraz||0)*.0012));c.drawImage(sz.cv,pz.x-wb/2,y0,wb,hh);c.globalAlpha=1;
      }
    }
    const dol=L.y+L.h;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=GRAW*sc*dt;p.rot+=p.wir*dt;
      if(p.vy>0&&p.y>dol+p.r)p.z=0;
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      c.globalAlpha=p.z<.3?p.z/.3:1;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.drawImage(b.cv,-p.r/2,-p.r/2,p.r,p.r);c.restore();
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Kukiełki",kolejnosc:31,kolor:"#b3202f",zasoby:ZASOBY,przebranie:true,
    opis:"Teatr kukiełkowy z filcu: czerwona aksamitna kurtyna ze złotymi frędzlami, loże po bokach i rampa z żarówkami, a na brzegu sceny wygłupia się dwanaście kudłatych kukiełek. Nuty to włochate pasy filcu w kolorach kukiełek, klawisze to kremowy filc i ciemny aksamit, a przy kombo za żabą ciągnie się aksamitny sznur ze złotym frędzlem, na scenę lecą rekwizyty i zapala się reflektor.",
    cechy:{tlo:"teatr kukiełkowy",klawisze:"kremowy filc i aksamit",streak:"sznur, rekwizyty i reflektor",widownia:"kudłate kukiełki"},
    en:{nazwa:"Puppets",
      opis:"A felt puppet theater: a red velvet curtain with gold tassels, side boxes and a row of footlights, with twelve shaggy puppets clowning around at the edge of the stage. Notes are furry felt strips in puppet colors, keys are cream felt and dark velvet, and on a combo a velvet cord with a gold tassel trails behind you while props fly onto the stage and a spotlight comes on.",
      cechy:{tlo:"puppet theater",klawisze:"cream felt and velvet",streak:"cord, props and spotlight",widownia:"shaggy puppets"}},
    karta:{papier:AKSAMIT,cien:"rgba(24,2,6,.45)",czarne:"rgba(20,0,6,.22)",liniaC:"rgba(255,226,170,.22)",minione:"rgba(20,0,6,.28)",
      nazwy:"rgba(255,238,200,.86)",kreski:"rgba(255,226,170,.18)",nic:ZLOTO,szpilka:ZLOTO,szpilkaBlask:"#fff6d8",
      cienNuty:"rgba(20,0,6,.5)",scieg:"rgba(242,194,48,.5)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
