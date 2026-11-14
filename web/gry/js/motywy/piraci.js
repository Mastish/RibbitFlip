// Motyw „Piraci” (runda 4, 10-16): statek piracki o zachodzie słońca z filcu. Tło to ilustracja (tlo.webp: deski
// pokładu, liny z włóczki, bandera z czaszką, skrzynia z guzikami-monetami, filcowe fale i złote słońce), karta toru
// to morsko-granatowa szyba z fakturą desek (faktura.webp rozjaśniona ekranem, widać szwy między deskami). Nuty: pasy
// skręconej liny z włóczki (wzór splotu z pamięci) z żaglowym pasem ze ściegiem u góry w złocie, czerwieni albo bieli.
// Klawiatura: białe klawisze to jasne deski pokładu z gwoździkami, czarne z ciemnego drewna i mosiężnym gwoździem.
// Widownia: sześciu piratów (fan-*.webp) kołysze się jak na fali, a przed nimi leży pas filcowych fal z ściegiem pian.
// Streak (detal PODPISOWY): ślad to kilwater z filcowej piany (granatowy cień, biała pianka, przerywany ścieg fali),
// na którym przy kombo lśnią monety-guziki, a na końcu unosi się kotwica; zza żaby sypią się skarby (iskra-0..5)
// po łuku i opadają na pokład. Wszystko z buforów i wzorów z pamięci podręcznej.
(function(){
  "use strict";
  const ID="piraci",PI=Math.PI,TAU=2*PI;
  const GRANAT="#10294a",GRANAT_C="#071629",MORZE="#1f4f8a",ZLOTO="#e0a526",ZLOTO_J="#f6d27a",LINA="#d8bc88",LINA_C="#7a5a30",
    DESKA="#c99a5e",DESKA_J="#e8c48a",DESKA_C="#4a2c14",CZERW="#a82a35",PIANA="#f4efe2";
  const FANY=6,ISKRY=6;
  const ZASOBY=["tlo.webp","faktura.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const ul=x=>x-Math.floor(x);
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5],SKRET=[2.5,3.5];   // kreski bez nowych tablic w klatce

  // =========================================================================================== wzory (raz)
  // Skręt liny: ukośne pasemka (ciemny rowek i jasny grzbiet) na kafelku 8 × 8 px, zawinięte bez szwu.
  function kafelekLiny(){
    const cv=document.createElement("canvas");cv.width=cv.height=8;const x=cv.getContext("2d");
    x.lineCap="butt";
    for(const [kol,sz,dy] of [["rgba(70,45,16,.55)",1.7,0],["rgba(255,244,214,.5)",1,2.4]])
      for(const o of [-8,0,8]){x.strokeStyle=kol;x.lineWidth=sz;x.beginPath();x.moveTo(o-1,8+dy+1);x.lineTo(o+9,-2+dy);x.stroke();}
    return cv;
  }
  // Włókna filcu: krótkie zakrzywione włoski w dwóch tonach na kafelku 96 px, zawinięte na brzegach.
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
  const lina=c=>wzor(c,"lina",kafelekLiny);
  const filcMorski=c=>wzor(c,"morski",()=>kafelekFilcu("rgba(190,215,255,.22)","rgba(0,10,40,.2)",320));
  // faktura motywu (deski, kafel 512 bez szwów); zanim się wczyta: wzór liny z kodu
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    if(!im)return lina(c);
    return wzor(c,"faktura",()=>im,.6);
  }

  // =========================================================================================== sprite'y
  // Złota łuna zachodu (gradient raz, w buforze).
  const luna=()=>bufor("pi-luna",96,96,c=>{
    const g=c.createRadialGradient(48,48,0,48,48,48);
    g.addColorStop(0,"rgba(255,226,150,.5)");g.addColorStop(.45,"rgba(240,170,60,.22)");g.addColorStop(1,"rgba(224,165,38,0)");
    c.fillStyle=g;c.fillRect(0,0,96,96);
  });
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("pi-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.12,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["255,214,140",.10],["60,110,170",.06]],swiatlo:["255,214,140","16,41,74"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#b98a52";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(7,22,41,0)");g.addColorStop(1,"rgba(7,22,41,.3)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Morsko-granatowa szyba: deski rozjaśnione ekranem (szwy między deskami lśnią jak ścieg), poświata zachodu od góry
  // i cień ku dołowi. Bez rekwizytów: karta ma zostać spokojna.
  function fakturaKarty(c,L){
    c.save();c.globalCompositeOperation="screen";c.globalAlpha=.3;c.fillStyle=fakturaWzor(c);c.fillRect(L.x,L.y,L.w,L.h);c.restore();
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,190,100,.12)");g.addColorStop(.4,"rgba(255,190,100,0)");g.addColorStop(.7,"rgba(2,8,24,0)");g.addColorStop(1,"rgba(2,8,24,.3)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
  }

  // =========================================================================================== nuty
  // Pas liny: jasna lina z włóczki, skręt (wzór z pamięci), cień walca, u góry pas żagla ze złotym, czerwonym
  // albo białym płótnem (z ziarna) i przerywanym ściegiem. Ciemnobrązowy obrys odcina pas od granatowej karty.
  const ZAGLE=[ZLOTO,CZERW,PIANA];
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,255,255,.22)");g.addColorStop(.35,"rgba(255,255,255,0)");g.addColorStop(.7,"rgba(60,36,10,.08)");g.addColorStop(1,"rgba(60,36,10,.34)");
      WALEC.set(k,g);}
    return g;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2;
      c.fillStyle=LINA;c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=lina(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(nh>=7){
        const hh=Math.max(2,nh*.2);
        c.fillStyle=ZAGLE[(o.ziarno|0)%3];c.fillRect(x0-2,y0-2,w+4,hh+2);
        c.strokeStyle="rgba(60,36,10,.55)";c.lineWidth=.8;c.setLineDash(SCIEG);c.beginPath();c.moveTo(x0,y0+hh*.55);c.lineTo(x0+w,y0+hh*.55);c.stroke();c.setLineDash(BRAK);
      }
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
    },
    brzeg:()=>LINA_C,zapas:()=>0};

  // =========================================================================================== klawisze
  // Tło klawiatury: granatowa szyba z deskami. Białe klawisze to jasne deski (faktura mnożona) z dwoma gwoździkami
  // na końcu, czarne z ciemnego drewna z mosiężnym gwoździem. Ścieg jasną nicią wokół. Gracz: złoty pas ze ściegiem.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(2,8,24,.5)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=GRANAT;c.fill();
      c.save();c.clip();c.globalCompositeOperation="screen";c.globalAlpha=.2;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.restore();
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,DESKA_J);grad.addColorStop(.7,DESKA);grad.addColorStop(1,"#a67a42");
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,4));
      }
      c.fillStyle=grad;c.fill();c.save();c.clip();c.globalCompositeOperation="multiply";c.globalAlpha=.8;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.restore();
      c.strokeStyle="rgba(74,44,20,.6)";c.lineWidth=1;c.stroke();
      // gwoździki na końcach desek (dwa na segment, dość duże segmenty)
      c.fillStyle="rgba(74,44,20,.75)";c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<7)continue;const ym=yt+ins+hh/2;
        c.moveTo(x+ins+7,ym);c.arc(x+ins+6,ym,1.2,0,TAU);c.moveTo(x+w-ins-5,ym);c.arc(x+w-ins-6,ym,1.2,0,TAU);
      }
      c.fill();
      // czarne klawisze: ciemne drewno z mosiężnym gwoździem
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,4,4,0]);}
      c.fillStyle="#2b1a10";c.fill();c.save();c.clip();c.globalCompositeOperation="multiply";c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.restore();
      c.strokeStyle="rgba(0,0,0,.6)";c.lineWidth=1;c.stroke();
      c.fillStyle=ZLOTO;c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);if(k.h<5)continue;c.moveTo(k.x+k.w*.5,k.y+k.h/2);c.arc(k.x+k.w*.5-.01,k.y+k.h/2,Math.min(1.6,k.h*.2),0,TAU);}
      c.fill();
      c.setLineDash(SCIEG);c.strokeStyle="rgba(244,239,226,.55)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=GRANAT_C;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(246,210,122,.92)":"rgba(224,165,38,.55)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?DESKA_C:"rgba(74,44,20,.6)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Sześciu piratów z fan-*.webp. Kolejność z ziarnem bez sąsiadów-bliźniaków, odbicia i skala z ziarna. Każdy
  // kołysze się na fali: obrót wokół stóp (przeciwne fazy sąsiadów), a przy śpiewie podskakuje w rytm ćwierćnut,
  // przy kombo wyżej. W spokoju stoi. Przed nimi pas filcowych fal ze ściegiem piany.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=47;
    while(r.length<n){
      const p=[0,1,2,3,4,5];for(let i=5;i>0;i--){const j=Math.floor(los(z,i)*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}z++;
      if(p[0]===ost){const t=p[0];p[0]=p[5];p[5]=t;}
      for(const f of p){if(r.length>=n)break;const k=r.length;
        r.push({f,lustro:los(k,3)>.5,sk:.86+.14*los(k,4),faza:[0,.5,.25,.75][k%4]+.1*los(k,5),dx:(los(k,8)-.5)*.16});ost=f;}
    }
    RZAD.set(n,r);return r;
  }
  function fan(i,h,lustro){
    const im=obraz("fan-"+i+".webp");if(!im||!jest())return null;
    const s=h/im.naturalHeight,w=Math.max(1,Math.round(im.naturalWidth*s));
    return bufor("pi-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  // pas fal: dwa grzbiety granatowego filcu z włóknami, ścieg piany wzdłuż grzbietu, cień od góry (raz na rozmiar)
  const fale=(W,h)=>bufor("pi-fale|"+W+"x"+h,W,h,c=>{
    const y=h*.74,fala=(o,a)=>{c.beginPath();c.moveTo(0,h);c.lineTo(0,y+o);
      for(let x=0;x<=W;x+=18)c.lineTo(x,y+o+Math.sin(x*.032+a)*h*.05+Math.sin(x*.0091+1+a)*h*.04);c.lineTo(W,h);c.closePath();};
    fala(-5,2);c.fillStyle="#2a62a6";c.fill();c.fillStyle=filcMorski(c);c.fill();
    fala(2,0);c.fillStyle=MORZE;c.fill();c.fillStyle=filcMorski(c);c.fill();
    const g=c.createLinearGradient(0,y-6,0,h);g.addColorStop(0,"rgba(2,8,24,0)");g.addColorStop(1,"rgba(2,8,24,.45)");
    c.fillStyle=g;c.fillRect(0,y-6,W,h-y+6);
    c.beginPath();for(let x=0;x<=W;x+=18){const yy=y+6+Math.sin(x*.032)*h*.05+Math.sin(x*.0091+1)*h*.04;if(x)c.lineTo(x,yy);else c.moveTo(x,yy);}
    c.strokeStyle="rgba(244,239,226,.8)";c.lineWidth=1.3;c.setLineDash([5,3]);c.stroke();c.setLineDash(BRAK);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.95)),krok=W/n,R0=rzad(n);
      const ruch=!st.spokoj&&!st.bezRuchu,zywe=st.spiewaja||(st.zar||0)>.05||(st.ap||0)>.12;
      const moc=zywe?.04+.05*Math.min(1,st.skok||0)+.03*Math.min(3,st.zar||0)+.06*Math.min(1,(st.ap||0)*2):.015*Math.min(1,st.skok||0);
      const fz=st.faza||0,dno=Wd.y+h*1.02,wych=zywe?.07:.03;
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        const hop=ruch&&moc?Math.abs(Math.sin(PI*(fz+r.faza)))*fh*moc:0;
        const kat=ruch?Math.sin(PI*(fz*.5+i*.37))*wych:0;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"poklad",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
      c.drawImage(fale(W,h).cv,0,Wd.y,W,h);   // fale na wierzchu: piraci stoją w łodziach po burtę
    }};

  // =========================================================================================== streak
  // Za głową tylko złota łuna zachodu (przebranie żaby robi silnik). Sygnatura jest w śladzie i skarbach.
  const streak={
    glowa(){},
    // ślad: kilwater. Granatowy cień, biała piana (lekko falista), przerywany ścieg grzbietu fali w jasnym błękicie;
    // przy kombo na kilwaterze lśnią monety-guziki, a tuż za żabą holowana jest kotwica (iskra-3).
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),sz=k.og>=3?5.4:k.og>=2?4.6:3.8;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}const y=p.y+Math.sin(p.x*.06-k.ts*2)*1.8;if(pi)c.lineTo(p.x,y);else{c.moveTo(p.x,y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+3;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=sz;c.stroke();
      c.setLineDash(SKRET);c.lineDashOffset=-k.ts*14;c.strokeStyle=g.c;c.lineWidth=sz*.6;c.stroke();c.setLineDash(BRAK);c.lineDashOffset=0;
      if(!jest()||k.og<1)return;
      if(k.og>=2){
        const mo=iskra(0,32);let ost=-1e9,nr=0;
        if(mo)for(const p of pts){
          if(!p.sp||p.x-ost<64||p.x<k.x0)continue;ost=p.x;
          const f=(p.x-k.x0)/k.dlug;if(f<.25||f>.85)continue;
          if(++nr>5)break;
          const s=10+6*f,bob=Math.sin(k.ts*3+p.x*.05)*1.5;c.drawImage(mo.cv,p.x-s/2,p.y-s/2+bob,s,s);
        }
      }
      const ko=iskra(3,48);if(!ko||k.pelna===false)return;
      const r=k.og>=3?12:10,x=k.xT-34,y=ySladu(pts,x);if(y==null)return;
      c.save();c.translate(x,y-r*.4);c.rotate(Math.sin(k.ts*2.4)*.35);c.drawImage(ko.cv,-r,-r,2*r,2*r);c.restore();
    },
    // płonąca nuta: zaśpiewana część rozbłyska złotem, na froncie moneta
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(246,210,122,.4)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas>.05&&jest()){
        const im=iskra(0,48),s=nh*(aktywna?1.5:1.15);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.6,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)skarby(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{luna();for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(0,32);iskra(0,48);iskra(3,48);}catch(e){}},
    aura:["#fff1c8",ZLOTO],wypelnienie:["#fff3d0",ZLOTO_J,ZLOTO],
    iskry:{kolory:["#ffffff","#fff1c8","#9cc8ff"]},dym:false,
    scena:["255,214,140","60,110,170","224,165,38"],
    tlo:{promienie:[["255,214,140",.10],["60,110,170",.06]],swiatlo:["255,214,140","16,41,74"]}};

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
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(7,22,41,0)");a.addColorStop(.5,"rgba(7,22,41,.55)");a.addColorStop(1,"rgba(7,22,41,.8)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(244,239,226,0)");b.addColorStop(.5,"rgba(244,239,226,.85)");b.addColorStop(1,"rgba(252,250,244,1)");
    const d=c.createLinearGradient(x0,0,xT,0);d.addColorStop(0,"rgba(120,175,235,0)");d.addColorStop(.5,"rgba(120,175,235,.8)");d.addColorStop(1,"rgba(140,190,245,.95)");
    g={a,b,c:d};GRAD.set(kl,g);return g;
  }

  // ---- skarby: pula na gracza, bez alokacji w klatce ----
  // Moneta, czaszka, mapa, kotwica, rubin i węzeł (iskra-0..5) wyskakują zza żaby, lecą łukiem wstecz i opadają
  // na pokład jak łup z abordażu; na progu kombo co 4 nuty trzy naraz.
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
      p.k=los(P.dos*91+P.k,og)<.4?0:Math.floor(Math.random()*6);p.r=Math.round(sc*(.24+.05*og)*(.85+.3*Math.random()));
      p.x=pz.x-sc*.15+(Math.random()-.5)*sc*.4;p.y=pz.y-sc*.4;p.vx=-(30+60*Math.random());p.vy=-(120+90*Math.random());
      p.fz=Math.random()*TAU;p.rot=(Math.random()-.5)*7;p.zy=1.1+.4*Math.random();p.z=p.zy;return;
    }
  }
  function skarby(c,L,g,st){
    if(typeof pozycjaZaby!=="function"||!jest())return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(og>0){
      P.dos+=dt*TEMPO[og];if(P.dos>=1){P.dos-=1;rzuc(P,L,g,sc,og);}
      if(k>P.k&&k>=4&&k%4===0)for(let j=0;j<3;j++)rzuc(P,L,g,sc,og);
    }else P.dos=0;
    P.k=k;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=420*dt;
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,s=p.r*(f<.12?.5+.5*f/.12:1);
      c.globalAlpha=f<.1?f/.1:p.z<.35?p.z/.35:1;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot*f);c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Piraci",kolejnosc:16,kolor:"#e0a526",zasoby:ZASOBY,przebranie:true,
    opis:"Statek piracki o zachodzie słońca z filcu: deski pokładu, liny z włóczki, skrzynia z guzikami-monetami i bandera z czaszką. Karta jak granatowa szyba z deskami, nuty to pasy liny z żaglowym ściegiem, a przy kombo za żabą ciągnie się kilwater z piany z monetami i kotwicą, zza głowy lecą skarby.",
    cechy:{tlo:"statek o zachodzie",klawisze:"deski z gwoździkami",streak:"kilwater i skarby",widownia:"piraci na fali"},
    en:{nazwa:"Pirates",
      opis:"A felt pirate ship at sunset: deck planks, yarn ropes, a chest of button coins and a skull flag. The card is a navy pane over planks, notes are rope bands with a sailcloth stitch, and on a combo a foamy wake with coins and an anchor trails behind you while treasure flies up from behind your head.",
      cechy:{tlo:"ship at sunset",klawisze:"planks with nails",streak:"wake and treasure",widownia:"pirates on waves"}},
    karta:{papier:"#10294a",cien:"rgba(2,8,24,.45)",czarne:"rgba(2,8,24,.22)",liniaC:"rgba(244,228,190,.26)",minione:"rgba(2,8,24,.26)",
      nazwy:"rgba(248,236,206,.88)",kreski:"rgba(244,228,190,.24)",nic:"#e8d4a0",szpilka:ZLOTO,szpilkaBlask:"#fff3d0",
      cienNuty:"rgba(2,8,24,.5)",scieg:"rgba(244,239,226,.6)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
