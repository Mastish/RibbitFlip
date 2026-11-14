// Motyw „Zima” (runda 3, 10-10; do 10-17 „Sweter”, id zostaje): zimowy sweter z dzianiny. Tło to ilustracja (tlo.webp: kremowa dzianina z
// warkoczami, filcowe choinki, śnieżynki, pompony i rękawiczki na brzegach), karta toru to żurawinowa szyba
// z fakturą dzianiny (faktura.webp mnożona na czerwień, widać oczka V, nic nie jaśnieje). Nuty: kremowe pasy dzianiny
// z oczkami V (wzór z pamięci) i ściągaczem u góry w zieleni albo musztardzie, jak wzór norweski. Klawiatura: białe
// klawisze z kremowej dzianiny, czarne z butelkowej zieleni, ścieg kremową włóczką. Widownia: sześciu fanów
// w swetrach i sześć żabich bałwanów (fan-0..11.webp; bałwany od 10-17) na zaspie z filcu, kołyszą się jak przy kolędzie i podskakują w rytm.
// Streak (detal PODPISOWY): ślad to włóczka rozwijająca się z kłębka, który toczy się tuż za żabą (luźna, skręcona
// nitka krem i zieleń, w świeższej części pompony), zza głowy przy kombo opadają filcowe śnieżynki, a pompon czapki
// podskakuje w rytm ćwierćnut (iskra-1 nad głową). Z głowy sypią się zimowe drobiazgi (iskra-0..5). Wszystko z buforów.
(function(){
  "use strict";
  const ID="sweter",PI=Math.PI,TAU=2*PI;
  const ZURAW="#7c1b2d",ZURAW_C="#4f0f1b",ZIEL="#2f6b43",ZIEL_C="#1c4129",KREM="#EDE6DA",KREM_C="#cfc2a8",
    MUSZT="#DA9F2D",ROZ="#DA2F74",LIM="#B6D35A";
  const FANY=12,ISKRY=6;   // 10-17: fan-6..11 = żabie bałwany
  const ZASOBY=["tlo.webp","faktura.webp","zaba-0.webp","zaba-1.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const ul=x=>x-Math.floor(x);
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5],SKRET=[2.5,3.5];   // kreski bez nowych tablic w klatce
  const fazaCw=ts=>typeof R!=="undefined"&&R&&R.st&&Number.isFinite(R.st.faza)?R.st.faza:ul(ts*2);

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
  // Oczka dzianiny: kolumny „V” (dwie skośne pętelki z cieniem), kafel 8 × 8 px.
  function kafelekOczek(){
    const cv=document.createElement("canvas");cv.width=cv.height=8;const x=cv.getContext("2d");
    x.lineCap="round";x.lineWidth=1.3;
    x.strokeStyle="rgba(120,90,55,.34)";x.beginPath();x.moveTo(.5,1);x.lineTo(4,6.5);x.lineTo(7.5,1);x.stroke();
    x.strokeStyle="rgba(255,255,255,.4)";x.lineWidth=.8;x.beginPath();x.moveTo(1.2,.4);x.lineTo(4,4.8);x.moveTo(4.6,4.2);x.lineTo(7,.4);x.stroke();
    return cv;
  }
  const WZORY=new Map();
  function wzor(c,klucz,tworz,skala){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");if(skala&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix().scale(skala));WZORY.set(klucz,w);}
    return w;
  }
  const oczka=c=>wzor(c,"oczka",kafelekOczek);
  const filcJasny=c=>wzor(c,"jasny",()=>kafelekFilcu("rgba(255,255,255,.4)","rgba(120,100,70,.12)",360));
  // faktura motywu (kremowa dzianina, kafel 512 bez szwów); zanim się wczyta: oczka z kodu
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    if(!im)return oczka(c);
    return wzor(c,"faktura",()=>im,.6);
  }

  // =========================================================================================== sprite'y
  // Ciepła łuna jak od kominka (krem i musztarda, gradient raz, w buforze).
  const luna=()=>bufor("sw-luna",96,96,c=>{
    const g=c.createRadialGradient(48,48,0,48,48,48);
    g.addColorStop(0,"rgba(255,244,220,.55)");g.addColorStop(.45,"rgba(240,200,120,.25)");g.addColorStop(1,"rgba(218,159,45,0)");
    c.fillStyle=g;c.fillRect(0,0,96,96);
  });
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("sw-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.12,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["255,236,200",.10],["182,211,90",.05]],swiatlo:["255,236,200","124,27,45"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#e9dfcc";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(40,12,16,0)");g.addColorStop(1,"rgba(40,12,16,.26)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Żurawinowa szyba: kremowa dzianina mnożona na czerwień (oczka V widać jako ciemniejszy splot, karta nie jaśnieje),
  // ciepłe światło od góry i lekki cień ku dołowi.
  function fakturaKarty(c,L){
    c.globalCompositeOperation="multiply";c.fillStyle=fakturaWzor(c);c.fillRect(L.x,L.y,L.w,L.h);
    c.globalCompositeOperation="source-over";
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,226,190,.1)");g.addColorStop(.4,"rgba(255,226,190,0)");g.addColorStop(.7,"rgba(30,4,10,0)");g.addColorStop(1,"rgba(30,4,10,.22)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
  }

  // =========================================================================================== nuty
  // Kremowy pas dzianiny: oczka V (wzór z pamięci), cień walca, przy górnej krawędzi ściągacz w zieleni albo
  // musztardzie (z ziarna), jak pas we wzorze norweskim. Obrys ciemnożurawinowy odcina pas od karty.
  const SCIAGACZ=[ZIEL,MUSZT,ZIEL];
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,255,255,.2)");g.addColorStop(.35,"rgba(255,255,255,0)");g.addColorStop(.7,"rgba(90,60,30,.06)");g.addColorStop(1,"rgba(90,60,30,.3)");
      WALEC.set(k,g);}
    return g;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2;
      c.fillStyle=KREM;c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=oczka(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(nh>=7){c.fillStyle=SCIAGACZ[(o.ziarno|0)%3];c.fillRect(x0-2,y0-2,w+4,Math.max(2,nh*.2)+2);}
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
    },
    brzeg:()=>ZURAW_C,zapas:()=>0};

  // =========================================================================================== klawisze
  // Żurawinowa dzianina (faktura mnożona), białe klawisze z kremowej dzianiny, czarne z butelkowej zieleni,
  // kremowy ścieg wokół. Gracz: musztardowy pas z kremowym ściegiem.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(30,4,10,.45)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=ZURAW;c.fill();
      c.save();c.clip();c.globalCompositeOperation="multiply";c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.restore();
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,"#f4eee2");grad.addColorStop(.7,KREM);grad.addColorStop(1,KREM_C);
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,5));
      }
      c.fillStyle=grad;c.fill();c.save();c.clip();c.globalCompositeOperation="multiply";c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.restore();
      c.strokeStyle="rgba(79,15,27,.5)";c.lineWidth=1;c.stroke();
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,4,4,0]);}
      c.fillStyle=ZIEL;c.fill();c.save();c.clip();c.globalCompositeOperation="multiply";c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.restore();
      c.setLineDash(SCIEG);c.strokeStyle="rgba(237,230,218,.7)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=ZURAW_C;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(218,159,45,.9)":"rgba(218,159,45,.5)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?ZURAW_C:"rgba(79,15,27,.55)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Fani w swetrach z fan-*.webp na zaspie z białego filcu. Kolejność z ziarnem bez sąsiadów-bliźniaków, odbicia
  // i skala z ziarna. Przy śpiewie kołyszą się na boki jak przy kolędzie (pół taktu w jedną stronę) i podskakują
  // w rytm ćwierćnut, przy kombo wyżej. W spokoju stoją.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=59;
    while(r.length<n){
      const p=[];for(let i=0;i<FANY;i++)p.push(i);for(let i=FANY-1;i>0;i--){const j=Math.floor(los(z,i)*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}z++;
      if(p[0]===ost){const t=p[0];p[0]=p[FANY-1];p[FANY-1]=t;}
      for(const f of p){if(r.length>=n)break;const k=r.length;
        r.push({f,lustro:los(k,3)>.5,sk:.86+.14*los(k,4),faza:[0,.5,.25,.75][k%4]+.1*los(k,5),dx:(los(k,8)-.5)*.16});ost=f;}
    }
    RZAD.set(n,r);return r;
  }
  function fan(i,h,lustro){
    const im=obraz("fan-"+i+".webp");if(!im||!jest())return null;
    const s=h/im.naturalHeight,w=Math.max(1,Math.round(im.naturalWidth*s));
    return bufor("sw-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  // zaspa: falisty pas białego filcu z włóknami, kremowy ścieg wzdłuż grzbietu, cień od góry (raz na rozmiar)
  const zaspa=(W,h)=>bufor("sw-zaspa|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(40,12,16,0)");g.addColorStop(.6,"rgba(40,12,16,.2)");g.addColorStop(1,"rgba(40,12,16,.32)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
    const y=h*.74,fala=(o)=>{c.beginPath();c.moveTo(0,h);c.lineTo(0,y+o);
      for(let x=0;x<=W;x+=24)c.lineTo(x,y+o+Math.sin(x*.021)*h*.035+Math.sin(x*.0063+1)*h*.05);c.lineTo(W,h);c.closePath();};
    fala(2);c.fillStyle="rgba(60,30,30,.3)";c.fill();
    fala(0);c.fillStyle="#f4f1ec";c.fill();c.fillStyle=filcJasny(c);c.fill();
    c.beginPath();for(let x=0;x<=W;x+=24){const yy=y+6+Math.sin(x*.021)*h*.035+Math.sin(x*.0063+1)*h*.05;if(x)c.lineTo(x,yy);else c.moveTo(x,yy);}
    c.strokeStyle="rgba(124,27,45,.45)";c.lineWidth=1.2;c.setLineDash([4,3]);c.stroke();c.setLineDash(BRAK);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.95)),krok=W/n,R0=rzad(n);
      const ruch=!st.spokoj&&!st.bezRuchu,zywe=st.spiewaja||(st.zar||0)>.05||(st.ap||0)>.12;
      const moc=zywe?.04+.05*Math.min(1,st.skok||0)+.03*Math.min(3,st.zar||0)+.06*Math.min(1,(st.ap||0)*2):.015*Math.min(1,st.skok||0);
      const fz=st.faza||0,dno=Wd.y+h*1.02,kol=ruch&&zywe?Math.sin(PI*(st.beat!=null?st.beat:fz)*.5)*krok*.05:0;
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        const hop=ruch&&moc?Math.abs(Math.sin(PI*(fz+r.faza)))*fh*moc:0;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"koleda",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
      c.drawImage(zaspa(W,h).cv,0,Wd.y,W,h);   // zaspa na wierzchu: fani stoją w śniegu po kolana
    }};

  // =========================================================================================== streak
  // Za głową: ciepła łuna, opadające filcowe śnieżynki (bez stanu: pozycja z czasu, obrót, wejście i wyjście
  // krycia) i pompon czapki podskakujący w rytm ćwierćnut, ustawiony za pomponem z rysunku żaby.
  const streak={
    glowa(c,sc,og,ts,z,przod){
      if(przod||!jest())return;
      const cy=-sc*.37,rl=sc*(.85+.08*og);
      const l=luna();c.globalAlpha=.85;c.drawImage(l.cv,-rl,cy-rl,2*rl,2*rl);c.globalAlpha=1;
      const sn=iskra(0,48);
      if(sn){
        const n=og>=3?6:4;
        for(let j=0;j<n;j++){
          const u=ul(ts*.2+j/n+z*.07),x=(los(j+z,1)-.5)*sc*1.5+Math.sin(ts*1.2+j*2.1)*sc*.07,y=cy-sc*.7+u*sc*1.35;
          const s=sc*(.2+.07*(j%3)),a=Math.sin(PI*u);if(a<.05)continue;
          c.globalAlpha=a;c.save();c.translate(x,y);c.rotate(ts*.5*(j%2?1:-1)+j);c.drawImage(sn.cv,-s/2,-s/2,s,s);c.restore();
        }
        c.globalAlpha=1;
      }
      const po=iskra(1,48);
      if(po){const f=fazaCw(ts),sk=Math.sin(PI*f),s=sc*.27;
        c.drawImage(po.cv,-sc*.18-s/2,-sc*.64-s/2-sk*sc*.09,s,s*(1-.08*(1-sk)));}
    },
    // ślad: włóczka z kłębka. Ciemny cień, kremowa nitka i zielone pasemka skrętu (przerywana kreska), lekko falista
    // jak luźna nić; w świeższej części pompony, a tuż za żabą toczy się kłębek (iskra-5).
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),sz=k.og>=3?5:k.og>=2?4.2:3.4;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}const y=p.y+Math.sin(p.x*.07)*1.6;if(pi)c.lineTo(p.x,y);else{c.moveTo(p.x,y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+2.2;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=sz;c.stroke();
      c.setLineDash(SKRET);c.lineDashOffset=-k.ts*10;c.strokeStyle=g.c;c.lineWidth=sz*.8;c.stroke();c.setLineDash(BRAK);c.lineDashOffset=0;
      if(!jest()||k.og<1)return;
      if(k.og>=2){
        const po=iskra(1,32);let ost=-1e9,nr=0;
        if(po)for(const p of pts){
          if(!p.sp||p.x-ost<70||p.x<k.x0)continue;ost=p.x;
          const f=(p.x-k.x0)/k.dlug;if(f<.25||f>.82)continue;
          if(++nr>5)break;
          const s=10+6*f;c.drawImage(po.cv,p.x-s/2,p.y-s/2,s,s);
        }
      }
      const kl=iskra(5,48);if(!kl||k.pelna===false)return;
      const r=k.og>=3?11:9,x=k.xT-34,y=ySladu(pts,x);if(y==null)return;
      c.save();c.translate(x,y-r*.6);c.rotate(k.ts*3.2);c.drawImage(kl.cv,-r,-r,2*r,2*r);c.restore();
    },
    // płonąca nuta: zaśpiewana część ociepla się musztardą, na froncie mała śnieżynka
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(218,159,45,.3)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas>.05&&jest()){
        const im=iskra(0,48),s=nh*(aktywna?1.5:1.15);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.6,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)zimaToru(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{luna();for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(0,48);iskra(1,48);iskra(1,32);iskra(5,48);}catch(e){}},
    aura:["#fff1dc",MUSZT],wypelnienie:["#fff7ea","#f2dcb0",MUSZT],
    iskry:{kolory:["#ffffff","#fff1dc",LIM]},dym:false,
    scena:["255,236,200","182,211,90","218,159,45"],
    tlo:{promienie:[["255,236,200",.10],["182,211,90",.05]],swiatlo:["255,236,200","124,27,45"]}};

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
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(40,6,14,0)");a.addColorStop(.5,"rgba(40,6,14,.5)");a.addColorStop(1,"rgba(40,6,14,.75)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(237,230,218,0)");b.addColorStop(.5,"rgba(237,230,218,.85)");b.addColorStop(1,"rgba(245,240,230,1)");
    const d=c.createLinearGradient(x0,0,xT,0);d.addColorStop(0,"rgba(70,140,90,0)");d.addColorStop(.5,"rgba(70,140,90,.8)");d.addColorStop(1,"rgba(80,155,100,.95)");
    g={a,b,c:d};GRAD.set(kl,g);return g;
  }

  // ---- zimowe drobiazgi: pula na gracza, bez alokacji w klatce ----
  // Śnieżynka, pompon, rękawiczka, gwiazda, serduszko, kłębek (iskra-0..5) wyskakują lekko zza głowy i opadają
  // powoli jak śnieg, kołysząc się na boki; na progu kombo co 4 nuty trzy naraz.
  const PULE=new WeakMap(),MAKS_CZ=10,TEMPO=[0,1,2,3.4];
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,dos:0,cz:[]};
    for(let i=0;i<MAKS_CZ;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,k:0,r:20,fz:0,rot:0});
    PULE.set(g,p);return p;
  }
  function rzuc(P,L,g,sc,og){
    for(const p of P.cz)if(p.z<=0){
      const pz=pozycjaZaby(L,g);
      p.k=Math.floor(Math.random()*6);p.r=Math.round(sc*(.26+.05*og)*(.85+.3*Math.random()));
      p.x=pz.x-sc*.15+(Math.random()-.5)*sc*.4;p.y=pz.y-sc*.4;p.vx=-(20+35*Math.random());p.vy=-(50+40*Math.random());
      p.fz=Math.random()*TAU;p.rot=(Math.random()-.5)*.8;p.zy=1.8+.6*Math.random();p.z=p.zy;return;
    }
  }
  function zimaToru(c,L,g,st){
    if(typeof pozycjaZaby!=="function"||!jest())return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(og>0){
      P.dos+=dt*TEMPO[og];if(P.dos>=1){P.dos-=1;rzuc(P,L,g,sc,og);}
      if(k>P.k&&k>=4&&k%4===0)for(let j=0;j<3;j++)rzuc(P,L,g,sc,og);
    }else P.dos=0;
    P.k=k;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt+Math.sin(p.fz+p.z*2.4)*dt*22;p.y+=p.vy*dt;p.vy=Math.min(38,p.vy+90*dt);
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,s=p.r*(f<.15?.5+.5*f/.15:1);
      c.globalAlpha=f<.12?f/.12:p.z<.5?p.z/.5:1;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot+Math.sin(p.fz+p.z*2.4)*.25);c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Zima",kolejnosc:14,kolor:"#b8323f",zasoby:ZASOBY,zaba:true,przebranie:true,
    opis:"Zimowy sweter z dzianiny: warkocze, filcowe choinki, pompony i śnieżynki, a w widowni tańczą żabie bałwany. Karta jak żurawinowa dzianina, nuty to kremowe pasy z oczkami i zielonym ściągaczem, a przy kombo za żabą rozwija się włóczka z kłębka, zza głowy sypią się śnieżynki i podskakuje pompon czapki.",
    cechy:{tlo:"zimowy sweter",klawisze:"kremowa dzianina",streak:"włóczka i śnieżynki",widownia:"swetry i żabie bałwany"},
    en:{nazwa:"Winter",
      opis:"A cosy winter sweater: cable knit, felt Christmas trees, pom-poms and snowflakes, with frog snowmen dancing in the crowd. The card is cranberry knit, notes are cream knitted bands with a green rib, and on a combo yarn unrolls from a ball behind you, snowflakes drift down behind your head and the hat's pom-pom bounces.",
      cechy:{tlo:"winter sweater",klawisze:"cream knit",streak:"yarn and snowflakes",widownia:"sweaters and frog snowmen"}},
    karta:{papier:"#701024",cien:"rgba(40,6,14,.4)",czarne:"rgba(30,2,8,.18)",liniaC:"rgba(255,236,210,.24)",minione:"rgba(30,2,8,.22)",
      nazwy:"rgba(250,238,222,.85)",kreski:"rgba(255,236,210,.22)",nic:KREM,szpilka:MUSZT,szpilkaBlask:"#fff6dc",
      cienNuty:"rgba(30,2,8,.45)",scieg:"rgba(237,230,218,.6)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
