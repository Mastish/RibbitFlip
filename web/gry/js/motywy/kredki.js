// Motyw „Kredki” (runda 5, 10-17): CELOWE PRZEŁAMANIE STYLU FILCU. Wszystko jest narysowane niedbale przez dziecko kredkami
// na papierze i wycięte nożyczkami: zero filcu, zero ściegu, zero cekinów. Tło to rysunek na kartce (tlo.webp: słońce
// z buzią, tęcza, chmurki, domki, drzewa i trawa wycięte nożyczkami), karta toru to biały papier rysunkowy (faktura
// ledwo widoczna) z chwiejną ramką kredką, rysowaną raz na układ. Nuty: grube kreski kredek świecowych (woskowa
// faktura z nierównym kryciem i prześwitującym papierem), każda w innym kolorze z ziarna (zielony, różowy, żółty,
// niebieski, czerwony, fiolet), końce wydarte, zaśpiewana część zamazana mocniej. Klawiatura: białe klawisze to papier
// z ledwo widocznymi liniami ołówka, czarne zamazane czarną kredką, nierówno i poza linią. Widownia: sześć żab
// narysowanych przez dziecko (fan-0..5.webp) na trawie zamazanej zieloną kredką, ruch „szkic” (drżąca animacja
// rysunkowa). Streak (detal PODPISOWY): ślad to zygzak kredką, gruba chwiejna linia zmieniająca kolor w biegu, a z
// toru lecą bazgroły (spirala, gwiazdka, serce, słońce, zygzak; iskra-0..5). Głowa bez efektu: żabę ubiera przebranie.
// Czytelność nut ma pierwszeństwo przed niedbałością: ciemny obrys ołówkiem odcina każdą nutę od białej karty.
(function(){
  "use strict";
  const ID="kredki",PI=Math.PI,TAU=2*PI;
  // paleta kredek: [kolor krycia, ciemniejszy do krawędzi]
  const KR=[["#2eaa3e","#17702b"],["#ee4fa0","#b01a68"],["#f7d61e","#b98d00"],["#2f80e6","#1456a8"],["#e8392b","#a01c12"],["#8f4cc8","#5a2590"]];
  const POM="#f28c28",OLOWEK="#3c3350",PAPIER="#fffdf7",ZIEL="#58b84a";
  const FANY=6,ISKRY=6;
  const ZASOBY=["tlo.webp","faktura.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[];

  // =========================================================================================== wzory (raz)
  // Wosk kredki świecowej na kafelku 72 px (bez szwu: kreski zawinięte na brzegach): ciemniejsze skośne pociągnięcia
  // nierównego krycia, jasne prześwity papieru i białe ziarno. Nakładane na kolor kredki.
  function kafelekWosku(){
    const N=72,cv=document.createElement("canvas");cv.width=cv.height=N;const x=cv.getContext("2d");
    x.lineCap="round";
    const kreski=(ile,kol,sz,dl,seed)=>{
      for(let i=0;i<ile;i++){
        const px=los(i,seed)*N,py=los(i,seed+1)*N,a=-.45+(los(i,seed+2)-.5)*.5,l=dl[0]+los(i,seed+3)*dl[1],
          dx=Math.cos(a)*l,dy=Math.sin(a)*l;
        x.strokeStyle=kol(i);x.lineWidth=sz[0]+los(i,seed+4)*sz[1];x.beginPath();
        for(const [ox,oy] of [[0,0],[-N,0],[0,-N],[-N,-N]]){x.moveTo(px+ox,py+oy);x.lineTo(px+ox+dx,py+oy+dy);}
        x.stroke();
      }
    };
    kreski(30,i=>"rgba(40,20,60,"+(.09+.14*los(i,9)).toFixed(2)+")",[2,2.4],[10,16],10);
    kreski(60,i=>"rgba(255,255,255,"+(.4+.35*los(i,19)).toFixed(2)+")",[1.2,1.6],[3,7],20);
    x.fillStyle="rgba(255,255,255,.6)";
    for(let i=0;i<90;i++){const s=los(i,31)>.7?1.6:1;x.fillRect(los(i,32)*N,los(i,33)*N,s,s);}
    return cv;
  }
  // Zamazanie: gęsty zygzak w poziomie, rzędy co 6 px (kafel 48 px, okresowy), ciemny, półprzezroczysty.
  function kafelekMazania(){
    const N=48,cv=document.createElement("canvas");cv.width=cv.height=N;const x=cv.getContext("2d");
    x.lineCap="round";x.lineJoin="round";x.strokeStyle="rgba(30,15,50,.34)";x.lineWidth=2.4;
    x.beginPath();
    for(let r=0;r<8;r++){
      const y=r*6+3+(los(r,5)-.5)*1.5;x.moveTo(0,y+3);
      for(let s=0;s<8;s++){x.lineTo(s*6+3,y-3);x.lineTo(s*6+6,y+3);}
    }
    x.stroke();
    x.strokeStyle="rgba(255,255,255,.35)";x.lineWidth=1;x.beginPath();
    for(let i=0;i<14;i++){const y=los(i,41)*N,xx=los(i,42)*N;x.moveTo(xx,y);x.lineTo(xx+4+los(i,43)*6,y-2);}
    x.stroke();
    return cv;
  }
  const WZORY=new Map();
  function wzor(c,klucz,tworz,skala){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");if(skala&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix().scale(skala));WZORY.set(klucz,w);}
    return w;
  }
  const wosk=c=>wzor(c,"wosk",kafelekWosku);
  const mazanie=c=>wzor(c,"mazanie",kafelekMazania);
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    return im?wzor(c,"faktura",()=>im,.5):null;
  }
  // Drżąca linia (dodaje moveTo + lineTo do bieżącej ścieżki): odcinki ok. 14 px z przesunięciem w poprzek z ziarna.
  function drzy(c,x1,y1,x2,y2,amp,z){
    const dx=x2-x1,dy=y2-y1,d=Math.hypot(dx,dy)||1,n=Math.max(2,Math.round(d/14)),nx=-dy/d,ny=dx/d;
    c.moveTo(x1+nx*(los(z,0)-.5)*amp,y1+ny*(los(z,0)-.5)*amp);
    for(let i=1;i<=n;i++){const t=i/n,o=(los(z,i)-.5)*amp;c.lineTo(x1+dx*t+nx*o,y1+dy*t+ny*o);}
  }

  // =========================================================================================== sprite'y
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("kr-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.06,rama:{bok:.09,gora:12,dol:8,odstep:10},scieg:false,
    tlo:{promienie:[["255,205,90",.10],["80,160,240",.05]],swiatlo:["255,215,120","255,150,100"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#f6f3ea";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){   // delikatna winieta, żeby karty nie wisiały na białej plamie
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.4,W/2,H*.5,Math.hypot(W,H)*.62);
        g.addColorStop(0,"rgba(90,70,40,0)");g.addColorStop(1,"rgba(90,70,40,.14)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Biały papier rysunkowy: faktura z papieru i mazania ledwo widoczna (mnożona), dookoła chwiejna ramka kredką: każdy
  // bok w innym kolorze, linia podwójna (dwa przejazdy), końce wystają za rogi, wosk z prześwitami papieru.
  const BOKI=["#f28c28","#2f80e6","#2eaa3e","#ee4fa0"];
  function ramka(c,x,y,w,h){
    const m=7,xa=x+m,ya=y+m,xb=x+w-m,yb=y+h-m,e=5;
    const L=[[xa-e,ya,xb+e,ya],[xb,ya-e,xb,yb+e],[xb+e,yb,xa-e,yb],[xa,yb+e,xa,ya-e]];
    c.lineCap="round";c.lineJoin="round";
    for(let p=0;p<2;p++){
      c.lineWidth=p?2.6:4.4;c.globalAlpha=p?.8:.92;
      for(let i=0;i<4;i++){
        c.strokeStyle=BOKI[i];c.beginPath();const l=L[i];drzy(c,l[0],l[1],l[2],l[3],3.4,i*9+p*5+1);c.stroke();
      }
    }
    c.globalAlpha=.55;c.strokeStyle="#fff";c.lineWidth=1.3;c.setLineDash([2,7]);
    for(let i=0;i<4;i++){c.beginPath();const l=L[i];drzy(c,l[0],l[1],l[2],l[3],2.2,i*9+3);c.stroke();}
    c.setLineDash(BRAK);c.globalAlpha=1;
  }
  function fakturaKarty(c,L){
    const f=fakturaWzor(c);
    if(f){c.globalCompositeOperation="multiply";c.globalAlpha=.7;c.fillStyle=f;c.fillRect(L.x,L.y,L.w,L.h);
      c.globalCompositeOperation="source-over";c.globalAlpha=1;}
    ramka(c,L.x,L.y,L.w,L.h);
  }

  // =========================================================================================== nuty
  // Grube kreski kredek świecowych. Krycie: kolor kredki, wosk z wzoru (przesunięty z ziarna, każda nuta ma inne
  // pociągnięcia), jaśniejsze smugi prześwitującego papieru wzdłuż, ciemniejsze brzegi przy górze i dole, a końce
  // wydarte białymi nacięciami (zamazane). Obrys ołówkiem z `brzeg` odcina nutę od białej karty.
  function cialo(c,w,nh,o){
    const z=o.ziarno|0,K=KR[((z%6)+6)%6],x0=-w/2,y0=-nh/2,ox=Math.floor(los(z,1)*72),oy=Math.floor(los(z,2)*72);
    c.fillStyle=K[0];c.fillRect(x0-2,y0-2,w+4,nh+4);
    c.save();c.translate(ox,oy);c.fillStyle=wosk(c);c.fillRect(x0-2-ox,y0-2-oy,w+4,nh+4);c.restore();
    // smugi papieru wzdłuż pociągnięcia
    c.strokeStyle="rgba(255,255,255,.38)";c.lineWidth=Math.max(1,nh*.07);c.lineCap="round";c.beginPath();
    for(let k=0;k<3;k++){
      const yy=y0+nh*(.2+.3*k+.1*los(z,10+k)),xa=x0+w*los(z,20+k)*.5,xb=xa+w*(.25+.35*los(z,30+k));
      c.moveTo(xa,yy);c.lineTo(Math.min(xb,-x0),yy+(los(z,40+k)-.5)*2);
    }
    c.stroke();
    // ciemniejsze brzegi: nacisk kredki przy krawędzi
    c.strokeStyle=K[1];c.globalAlpha=.7;c.lineWidth=Math.max(1.4,nh*.11);c.beginPath();
    drzy(c,x0,y0+1.4,x0+w,y0+1.4,1.8,z*3+1);drzy(c,x0,y0+nh-1.4,x0+w,y0+nh-1.4,1.8,z*3+2);c.stroke();c.globalAlpha=1;
    // końce wydarte: białe nacięcia i zamazanie przy krawędzi
    c.fillStyle="rgba(255,253,247,.88)";
    const n=Math.max(2,Math.min(4,Math.round(nh/5)));
    for(let k=0;k<n;k++){
      const ya=y0+nh*(k+los(z,50+k)*.6)/n,hh=nh/n*(.3+.3*los(z,60+k)),a=2+los(z,70+k)*3,b=1.5+los(z,80+k)*3;
      c.fillRect(x0-1,ya,a,hh);c.fillRect(-x0-b+1,y0+nh*(k+los(z,90+k)*.6)/n,b,hh);
    }
  }
  const nuty={cialo,brzeg:()=>OLOWEK,zapas:()=>0};

  // =========================================================================================== klawisze
  // Papier z ledwo widocznymi liniami ołówka między białymi klawiszami; czarne klawisze zamazane czarną kredką
  // nierównym zygzakiem, wystającym poza linię. Wokół drżący ołówkowy obrys. Gracz: zamazana pomarańczowa kredka.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(60,50,80,.16)";c.fillRect(x+2,y0+3,w,h);
      c.fillStyle=PAPIER;c.fillRect(x,y0,w,h);
      const f=fakturaWzor(c);
      if(f){c.save();c.beginPath();c.rect(x,y0,w,h);c.clip();c.globalCompositeOperation="multiply";c.globalAlpha=.6;c.fillStyle=f;c.fillRect(x,y0,w,h);c.restore();}
      // granice białych klawiszy: cienkie, drżące linie ołówka
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      c.lineCap="round";c.strokeStyle="rgba(60,52,84,.34)";c.lineWidth=1.1;c.beginPath();
      for(let i=1;i<gr.length;i++)drzy(c,x+2,gr[i],x+w-2,gr[i],1.8,gr[i]);
      c.stroke();
      // czarne klawisze: nierówny zygzak kredką, wylewa się poza linię
      for(let s=L.dolN;s<=L.goraN;s++){
        if(!isBlack(s))continue;const k=prostokatKlawisza(L,s),kw=k.w*.62,ky=k.y+.6,kh=Math.max(2,k.h-1.2);
        c.fillStyle="rgba(40,34,52,.55)";c.fillRect(k.x+1,ky+1,kw-2,kh-2);
        c.strokeStyle="rgba(18,14,26,.88)";c.lineWidth=Math.max(2.2,Math.min(3.6,kh*.3));c.lineJoin="round";c.beginPath();
        const nr=Math.max(2,Math.round(kh/(c.lineWidth*.8))),z=s*7+3;
        for(let r=0;r<=nr;r++){   // zygzak: rzędy biegną na przemian w prawo i w lewo
          const yy=ky+kh*r/nr+(los(z,r)-.5)*1.6,xa=k.x-2-los(z,r+20)*4,xb=k.x+kw+1+los(z,r+40)*4.5;
          if(r===0)c.moveTo(xa,yy);
          c.lineTo(r%2?xa:xb,yy);if(r<nr)c.lineTo(r%2?xa:xb,yy+kh/nr);
        }
        c.stroke();
        c.fillStyle="rgba(255,255,255,.3)";
        for(let r=0;r<4;r++)c.fillRect(k.x+los(z,60+r)*kw,ky+los(z,70+r)*kh,1.6,1.2);
      }
      c.strokeStyle="rgba(60,52,84,.55)";c.lineWidth=1.3;c.beginPath();
      drzy(c,x,y0,x+w,y0,1.6,201);drzy(c,x+w,y0,x+w,y0+h,1.6,202);drzy(c,x+w,y0+h,x,y0+h,1.6,203);drzy(c,x,y0+h,x,y0,1.6,204);
      c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(2,L.rh-1),x=L.kx,w=L.kw;
      c.fillStyle=g.naNucie?"rgba(242,140,40,.5)":"rgba(242,140,40,.26)";c.fillRect(x+1,y+.5,w-2,hh);
      c.strokeStyle=g.naNucie?"rgba(242,140,40,.95)":"rgba(242,140,40,.6)";c.lineWidth=Math.max(2,Math.min(3.6,hh*.4));c.lineCap="round";c.lineJoin="round";
      c.beginPath();c.moveTo(x+3,y+hh*.25);
      const n=Math.max(4,Math.min(12,Math.round(w/9)));
      for(let i=0;i<=n;i++)c.lineTo(x+3+(w-6)*i/n,y+hh*(i%2?.78:.22));
      c.stroke();
    }};

  // =========================================================================================== widownia
  // Narysowane przez dziecko żaby (fan-*.webp, wycięte nożyczkami) stoją na trawie zamazanej zieloną kredką.
  // Kolejność z ziarnem bez sąsiadów-bliźniaków, odbicia i skala z ziarna. Ruch „szkic”: drżąca, 6-klatkowa animacja.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=53;
    while(r.length<n){
      const p=[];for(let i=0;i<FANY;i++)p.push(i);for(let i=FANY-1;i>0;i--){const j=Math.floor(los(z,i)*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}z++;
      if(p[0]===ost){const t=p[0];p[0]=p[FANY-1];p[FANY-1]=t;}
      for(const f of p){if(r.length>=n)break;const k=r.length;
        r.push({f,lustro:los(k,3)>.5,sk:.88+.12*los(k,4),dx:(los(k,8)-.5)*.18});ost=f;}
    }
    RZAD.set(n,r);return r;
  }
  function fan(i,h,lustro){
    const im=obraz("fan-"+i+".webp");if(!im||!jest())return null;
    const s=h/im.naturalHeight,w=Math.max(1,Math.round(im.naturalWidth*s));
    return bufor("kr-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  // trawa: pas wycięty nożyczkami (biały brzeg papieru, postrzępiona góra), wypełniony zygzakami trzech zieleni
  const trawa=(W,h)=>bufor("kr-trawa|"+W+"x"+h,W,h,c=>{
    const yb=h*.66,kr=10;
    const sciezka=()=>{c.beginPath();c.moveTo(0,h);c.lineTo(0,yb);
      for(let x=0;x<=W+kr;x+=kr){const i=x/kr;c.lineTo(Math.min(x,W),yb+(i%2?h*.03:-h*.045)-los(i,5)*h*.05);}
      c.lineTo(W,h);c.closePath();};
    sciezka();c.fillStyle="rgba(60,50,80,.28)";c.save();c.translate(0,-2);c.fill();c.restore();   // cień pod nożycowym brzegiem
    sciezka();c.lineJoin="miter";c.strokeStyle="#fffdf7";c.lineWidth=5;c.stroke();c.fillStyle=ZIEL;c.fill();
    c.save();sciezka();c.clip();
    c.lineCap="round";c.lineJoin="round";
    const zielenie=["rgba(32,140,52,.8)","rgba(130,208,70,.75)","rgba(20,100,40,.6)"];
    for(let g=0;g<3;g++){
      c.strokeStyle=zielenie[g];c.lineWidth=3.2+g*.6;c.beginPath();
      for(let r=0;yb-6+r*6+g*2<h+6;r++){
        const y=yb-6+r*6+g*2,off=los(r,g+9)*8;
        c.moveTo(-8+off,y);
        for(let x=-8+off;x<W+8;x+=11){c.lineTo(x+5.5,y-4-los(x,r+g)*3);c.lineTo(x+11,y+3);}
      }
      c.stroke();
    }
    c.fillStyle="rgba(255,255,255,.35)";for(let i=0;i<W/5;i++)c.fillRect(los(i,81)*W,yb+los(i,82)*(h-yb),1.6,1.2);
    c.restore();
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*1.0),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.72)),krok=W/n,R0=rzad(n),dno=Wd.y+h*.96;
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"szkic",i);   // ruch wg motywu (motywy.js ruchFana)
      }
      c.drawImage(trawa(W,h).cv,0,Wd.y,W,h);   // trawa na wierzchu: żaby stoją w niej po kostki
    }};

  // =========================================================================================== streak
  // Ślad: zygzak kredką. Gruba chwiejna linia, której zęby płyną ku żabie, a kolor zmienia się w biegu (sześć kredek).
  // Ciemniejsza obwódka daje wosk, od ognia 2 wzdłuż śladu fruwają serduszka i gwiazdki, od 3 przy żabie kręci się słońce.
  const streak={
    glowa(){},
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const og=k.og,ts=k.ts,sz=og>=3?7:og>=2?6:5,A=sz*.9+1.5,dl=k.dlug||1;
      c.lineCap="round";c.lineJoin="round";
      let run=false,cur=-1,px=0,py=0,mx=0;
      for(let i=0;i<=pts.length;i++){
        const p=i<pts.length?pts[i]:null;
        if(!p||!p.sp){
          if(run){kresk(c,cur,sz,(mx-k.x0)/dl);run=false;}
          continue;
        }
        const ci=(((Math.floor(p.x/84-ts*1.4))%6)+6)%6,ph=p.x*.075-ts*3,
          tr=Math.abs(ph-2*Math.floor(ph/2)-1)*2-1,   // trójkąt -1..1: zęby zygzaka
          y=p.y+tr*A+Math.sin(p.x*.031+ts*1.7)*1.4;
        if(run&&ci!==cur){kresk(c,cur,sz,(mx-k.x0)/dl);run=false;}
        if(!run){c.beginPath();c.moveTo(px&&i?px:p.x,px&&i?py:y);c.lineTo(p.x,y);run=true;cur=ci;}
        else c.lineTo(p.x,y);
        px=p.x;py=y;mx=p.x;
      }
      if(!jest()||og<1||k.pelna===false)return;
      if(og>=2){
        let ost=-1e9,nr=0,j=0;
        for(const p of pts){
          if(!p.sp||p.x-ost<84||p.x<k.x0)continue;ost=p.x;
          const f=(p.x-k.x0)/dl;if(f<.2||f>.86)continue;
          if(++nr>5)break;
          const im=iskra(j++%2?2:3,32);if(!im)continue;
          const s=10+8*f,y=p.y-sz-s*.5+Math.sin(ts*3+p.x*.04)*2;
          c.save();c.translate(p.x,y);c.rotate(Math.sin(ts*2+p.x*.03)*.45);c.drawImage(im.cv,-s/2,-s/2,s,s);c.restore();
        }
      }
      const so=og>=3?iskra(4,48):null;if(!so)return;
      const x=k.xT-30,y=ySladu(pts,x);if(y==null)return;
      const r=11;c.save();c.translate(x,y-sz-r*.7);c.rotate(ts*.8);c.drawImage(so.cv,-r,-r,2*r,2*r);c.restore();
    },
    // płonąca nuta: zaśpiewana część zamazana mocniej (krycie kredki, gęsty zygzak), na froncie gwiazdka
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){
        const K=KR[(((z|0)%6)+6)%6],ox=Math.floor(los(z|0,3)*48),dl=fx-x0;
        c.globalAlpha=Math.min(.85,.5+.12*(poziom||0));c.fillStyle=K[0];c.fillRect(x0,-nh/2,dl,nh);
        c.globalAlpha=1;c.save();c.translate(ox,0);c.fillStyle=mazanie(c);c.fillRect(x0-ox,-nh/2,dl,nh);c.restore();
        c.strokeStyle=K[1];c.globalAlpha=.8;c.lineWidth=Math.max(1.5,nh*.12);c.lineCap="round";
        c.beginPath();c.moveTo(fx,-nh/2+1);c.lineTo(fx+(los(z|0,5)-.5)*3,0);c.lineTo(fx,nh/2-1);c.stroke();c.globalAlpha=1;
      }
      if(gas>.05&&jest()){
        const im=iskra(2,48),s=nh*(aktywna?1.5:1.15);
        if(im){c.globalAlpha=Math.min(1,gas);c.save();c.translate(fx,-nh/2-s*.1);c.rotate(Math.sin(ts*5)*.3);c.drawImage(im.cv,-s/2,-s/2,s,s);c.restore();c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)bazgroly(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(2,48);iskra(2,32);iskra(3,32);iskra(4,48);}catch(e){}},
    aura:["#fff3c4",POM],wypelnienie:["#fff8dc","#ffc96b",POM],
    iskry:{kolory:["#f7d61e","#ee4fa0","#2f80e6"]},dym:false,
    scena:["255,205,90","80,160,240","238,79,160"],
    tlo:{promienie:[["255,205,90",.10],["80,160,240",.05]],swiatlo:["255,215,120","255,150,100"]}};

  // jeden odcinek zygzaka w kolorze kredki: wosk (szeroka, półprzezroczysta obwódka) i rdzeń; początek śladu blady
  function kresk(c,ci,sz,f){
    const K=KR[ci],a=Math.max(.25,Math.min(1,.2+f*1.1));
    c.globalAlpha=a*.4;c.strokeStyle=K[1];c.lineWidth=sz+3.2;c.stroke();
    c.globalAlpha=a;c.strokeStyle=K[0];c.lineWidth=sz;c.stroke();
    c.globalAlpha=a*.5;c.strokeStyle="#fff";c.lineWidth=Math.max(1,sz*.22);c.setLineDash([2,9]);c.stroke();c.setLineDash(BRAK);
    c.globalAlpha=1;
  }
  function ySladu(pts,x){
    let lo=0,hi=pts.length-1;if(hi<1||x<pts[0].x||x>pts[hi].x)return null;
    while(hi-lo>1){const m=(lo+hi)>>1;if(pts[m].x<=x)lo=m;else hi=m;}
    const a=pts[lo],b=pts[hi];if(!a.sp||!b.sp)return null;
    const t=b.x>a.x?(x-a.x)/(b.x-a.x):0;return a.y+(b.y-a.y)*t;
  }

  // ---- bazgroły z toru: pula na gracza, bez alokacji w klatce ----
  // Spirala, gwiazdka, serce, słońce i zygzaki (iskra-0..5) wylatują zza żaby w górę i do tyłu, wolno się kręcą i opadają
  // lekko jak kartka (mała grawitacja). Na progu kombo co 4 nuty trzy naraz.
  const PULE=new WeakMap(),MAKS_CZ=10,TEMPO=[0,1,2,3.4],LOSUJ=[0,1,2,3,4,5,2,3,1,4];
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,dos:0,cz:[]};
    for(let i=0;i<MAKS_CZ;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,k:0,r:20,rot:0,wir:0});
    PULE.set(g,p);return p;
  }
  function rzuc(P,L,g,sc,og){
    for(const p of P.cz)if(p.z<=0){
      const pz=pozycjaZaby(L,g);
      p.k=LOSUJ[Math.floor(Math.random()*LOSUJ.length)];p.r=Math.round(sc*(.26+.05*og)*(.85+.3*Math.random()));
      p.x=pz.x-sc*.2+(Math.random()-.5)*sc*.3;p.y=pz.y-sc*.35;p.vx=-(40+60*Math.random());p.vy=-(110+60*Math.random());
      p.rot=Math.random()*TAU;p.wir=(Math.random()<.5?-1:1)*(.8+1.4*Math.random());p.zy=1.6+.5*Math.random();p.z=p.zy;return;
    }
  }
  function bazgroly(c,L,g,st){
    if(typeof pozycjaZaby!=="function"||!jest())return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(og>0){
      P.dos+=dt*TEMPO[og];if(P.dos>=1){P.dos-=1;rzuc(P,L,g,sc,og);}
      if(k>P.k&&k>=4&&k%4===0)for(let j=0;j<3;j++)rzuc(P,L,g,sc,og);
    }else P.dos=0;
    P.k=k;
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
  }

  Motywy.dodaj({id:ID,nazwa:"Kredki",kolejnosc:28,kolor:"#f28c28",zasoby:ZASOBY,przebranie:true,
    opis:"Rysunek dziecka na kartce: słońce z buzią, tęcza, domki i trawa narysowane kredkami i wycięte nożyczkami. Karta to biały papier z chwiejną ramką, nuty to grube kredki świecowe w sześciu kolorach, klawisze zamazane czarną kredką, a w widowni tańczą narysowane żaby. Przy kombo za żabą ciągnie się kolorowy zygzak i lecą bazgroły: spirale, gwiazdki i serca.",
    cechy:{tlo:"rysunek na kartce",klawisze:"papier i czarna kredka",streak:"zygzak kredką",widownia:"żaby narysowane kredką"},
    en:{nazwa:"Crayons",
      opis:"A child's drawing on paper: a smiling sun, rainbow, little houses and grass, drawn in crayon and cut out with scissors. The card is white paper with a wobbly frame, notes are thick wax crayons in six colours, the keys are scribbled in black crayon, and hand-drawn frogs dance in the crowd. On a combo a colourful zigzag trails behind you and doodles fly out: spirals, stars and hearts.",
      cechy:{tlo:"drawing on paper",klawisze:"paper and black crayon",streak:"crayon zigzag",widownia:"crayon-drawn frogs"}},
    karta:{papier:PAPIER,cien:"rgba(60,50,80,.14)",czarne:"rgba(60,50,80,.05)",liniaC:"rgba(60,52,84,.22)",minione:"rgba(120,110,140,.16)",
      nazwy:"rgba(60,52,84,.72)",kreski:"rgba(60,52,84,.16)",nic:"#e8392b",szpilka:OLOWEK,szpilkaBlask:"#fff",
      cienNuty:"rgba(60,50,80,.22)",scieg:null,rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
