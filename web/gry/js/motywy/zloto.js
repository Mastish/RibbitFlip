// Motyw „Złoto” (runda 5, 10-17): góry złota z filcu. Tło to ilustracja (tlo.webp: hałdy sztabek, monet i klejnotów po
// bokach, łańcuchy, czerwony aksamit pośrodku), karta toru to głęboka czerwień aksamitu ze złotą lamą z cekinami
// (faktura.webp mnożona delikatnie) i statycznym złotym błyskiem u góry. Nuty: sztabki złota (jaśniejsza górna ściana
// w trapezie, ciemniejsza przednia, ściany boczne, drobny błysk z ziarna), zaśpiewana część jaśnieje do białego złota.
// Klawiatura: białe klawisze to złote sztabki, czarne to czerwony aksamit ze złotą nicią (ścieg). Widownia: sześć
// złotych żab (fan-0..5.webp) na pasie z monet, podskakują w rytm. Streak (detal PODPISOWY): ślad to migoczący złoty
// pył (kropki w dwóch odcieniach, wirujące za żabą), z toru sypią się sztabki (iskra-0..5) i spadają ciężko, dużo
// szybciej niż lei w tiki; aura od złota do bieli. Głowa bez efektu: żabę ubiera przebranie motywu. Wszystko z buforów.
(function(){
  "use strict";
  const ID="zloto",PI=Math.PI,TAU=2*PI;
  const CZERW="#560a18",CZERW_C="#2e0510",ZLOTO="#f0b429",ZLOTO_J="#ffd95a",ZLOTO_C="#a8731a",BIAL="#fff3c4",BRAZ="#3b1d04",
    KREM="#ffe9a0",AKSAMIT="#6a0c1e";
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
  // faktura motywu (złota lama z cekinami, kafel 512 bez szwów); zanim się wczyta: null (sam kolor)
  function fakturaWzor(c,skala){
    const im=obraz("faktura.webp");
    return im?wzor(c,"faktura|"+skala,()=>im,skala):null;
  }

  // =========================================================================================== sprite'y
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("zl-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};
  // Czteroramienna gwiazdka połysku: dwa smukłe romby w krzyż, rysowane w miejscu (kilka na klatkę)
  function blysk(c,x,y,r,kol){
    c.fillStyle=kol;
    c.beginPath();c.moveTo(x-r,y);c.lineTo(x,y-r*.16);c.lineTo(x+r,y);c.lineTo(x,y+r*.16);c.closePath();
    c.moveTo(x,y-r);c.lineTo(x+r*.16,y);c.lineTo(x,y+r);c.lineTo(x-r*.16,y);c.closePath();c.fill();
  }

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.16,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["255,210,110",.10],["200,30,50",.05]],swiatlo:["255,220,130","120,10,30"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle=CZERW;c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(40,2,10,0)");g.addColorStop(1,"rgba(40,2,10,.3)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Czerwony aksamit: złota lama mnożona delikatnie (widać cekiny jako ciemniejszy brokat, czerwień zostaje), po bokach
  // pogłębienie jak w fałdach kurtyny, u góry statyczny złoty błysk, ku dołowi ciemniej.
  function fakturaKarty(c,L){
    const f=fakturaWzor(c,.55);
    if(f){c.globalCompositeOperation="multiply";c.globalAlpha=.36;c.fillStyle=f;c.fillRect(L.x,L.y,L.w,L.h);c.globalCompositeOperation="source-over";c.globalAlpha=1;}
    const b=c.createLinearGradient(L.x,0,L.x+L.w,0);
    b.addColorStop(0,"rgba(30,2,8,.38)");b.addColorStop(.12,"rgba(30,2,8,0)");b.addColorStop(.88,"rgba(30,2,8,0)");b.addColorStop(1,"rgba(30,2,8,.38)");
    c.fillStyle=b;c.fillRect(L.x,L.y,L.w,L.h);
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,214,110,.22)");g.addColorStop(.22,"rgba(255,214,110,.04)");g.addColorStop(.4,"rgba(255,214,110,0)");
    g.addColorStop(.75,"rgba(30,2,8,0)");g.addColorStop(1,"rgba(30,2,8,.32)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
    // złoty błysk: ciepła plama na środku górnej krawędzi
    const r=c.createRadialGradient(L.x+L.w*.5,L.y,0,L.x+L.w*.5,L.y,Math.max(40,L.w*.45));
    r.addColorStop(0,"rgba(255,236,160,.3)");r.addColorStop(1,"rgba(255,236,160,0)");
    c.fillStyle=r;c.fillRect(L.x,L.y,L.w,Math.min(L.h,L.w*.45));
  }

  // =========================================================================================== nuty
  // Sztabka złota: przednia ściana ciemniejsza (gradient z cache wg wysokości), u góry jaśniejsza ściana w trapezie
  // (węższa z tyłu) z bocznymi ścianami w rogach, cienka linia załamania, jasna krawędź i lama z cekinami mnożona
  // delikatnie. Ziarno daje błysk (gwiazdka) na górnej ścianie, co trzecia sztabka ma go dwa razy.
  const GRAD=new Map();
  function grady(c,nh){
    const k=Math.round(nh*2);let g=GRAD.get(k);
    if(!g){
      const h=k/2,y0=-h/2-2,y1=h/2+2,tf=Math.max(3,h*.3);
      const prz=c.createLinearGradient(0,y0,0,y1);
      prz.addColorStop(0,"#f3bb30");prz.addColorStop(.55,"#e4a21f");prz.addColorStop(1,"#b27312");
      const gor=c.createLinearGradient(0,-h/2,0,-h/2+tf);
      gor.addColorStop(0,"#fffbd6");gor.addColorStop(1,"#ffd95a");
      g={prz,gor,tf};GRAD.set(k,g);
    }
    return g;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,x1=w/2,y0=-nh/2,z=o.ziarno|0,G=grady(c,nh),tf=G.tf;
      c.fillStyle=G.prz;c.fillRect(x0-2,y0-2,w+4,nh+4);
      const sl=Math.min(nh*.34,w*.18);
      c.fillStyle="rgba(120,66,4,.55)";c.fillRect(x0-2,y0-2,w+4,tf+2);   // ściany boczne w rogach
      c.beginPath();c.moveTo(x0-2,y0-2);c.lineTo(x0+sl,y0-2);c.lineTo(x0-2,y0+tf);c.closePath();   // trapez górnej ściany
      c.moveTo(x0+sl,y0-2);c.lineTo(x1-sl,y0-2);c.lineTo(x1+2,y0+tf);c.lineTo(x0-2,y0+tf);c.closePath();
      c.fillStyle=G.gor;c.fill();
      c.fillStyle="rgba(110,60,0,.5)";c.fillRect(x0-2,y0+tf,w+4,1);   // załamanie między ścianami
      c.fillStyle="rgba(255,244,190,.55)";c.fillRect(x0-2,y0+tf+1,w+4,1);   // jasna krawędź przedniej ściany
      const f=fakturaWzor(c,.3);
      if(f){c.globalCompositeOperation="multiply";c.globalAlpha=.3;c.fillStyle=f;c.fillRect(x0-2,y0-2,w+4,nh+4);c.globalCompositeOperation="source-over";c.globalAlpha=1;}
      if(w>=18&&nh>=8&&z%2===0)blysk(c,x0+w*(.22+.56*los(z,5)),y0+tf*.5,Math.max(3,nh*.3),"rgba(255,255,255,.95)");
      if(w>=60&&nh>=8&&z%3===0)blysk(c,x0+w*(.2+.6*los(z,9)),y0+tf*.5,Math.max(2.4,nh*.2),"rgba(255,255,255,.85)");
    },
    brzeg:()=>BRAZ,zapas:()=>0};

  // =========================================================================================== klawisze
  // Aksamitny panel (lama mnożona), białe klawisze to złote sztabki (gradient, jasny połysk wzdłuż góry, ciemny obrys),
  // czarne to czerwony aksamit z cienką złotą nicią (ścieg). Gracz: kremowo-złota poświata klawisza z ciemnym ściegiem.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(30,2,8,.5)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=CZERW;c.fill();
      const f=fakturaWzor(c,.55);
      if(f){c.save();c.clip();c.globalCompositeOperation="multiply";c.globalAlpha=.4;c.fillStyle=f;c.fillRect(x,y0,w,h);c.restore();}
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,"#ffe58a");grad.addColorStop(.55,ZLOTO);grad.addColorStop(1,"#c98a18");
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,4));
      }
      c.fillStyle=grad;c.fill();
      if(f){c.save();c.clip();c.globalCompositeOperation="multiply";c.globalAlpha=.22;c.fillStyle=fakturaWzor(c,.3);c.fillRect(x,y0,w,h);c.restore();}
      c.strokeStyle="rgba(70,35,0,.7)";c.lineWidth=1;c.stroke();
      // połysk sztabek: cienka jasna krawędź przy górze każdego klawisza
      c.fillStyle="rgba(255,250,215,.6)";
      for(let i=0;i+1<gr.length;i++){const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<3)continue;c.fillRect(x+ins+4,yt+ins+1,w*.62,1.2);}
      // czarne: czerwony aksamit ze złotą nicią
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,4,4,0]);}
      c.fillStyle=AKSAMIT;c.fill();
      c.strokeStyle="rgba(20,0,6,.85)";c.lineWidth=1.2;c.stroke();
      c.save();c.clip();c.globalCompositeOperation="screen";c.globalAlpha=.1;c.fillStyle=fakturaWzor(c,.4);c.fillRect(x,y0,w,h);c.restore();
      c.setLineDash(SCIEG);c.strokeStyle="rgba(255,217,90,.9)";c.lineWidth=1;c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);if(k.h>5)c.roundRect(k.x+2,k.y+2.6,Math.max(1,k.w*.62-5),Math.max(1,k.h-5.2),[0,3,3,0]);}
      c.stroke();
      c.strokeStyle="rgba(255,226,150,.55)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=CZERW_C;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(255,244,190,.94)":"rgba(255,235,150,.55)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?CZERW_C:"rgba(46,5,16,.6)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Złote żaby z fan-*.webp na pasie z monet. Kolejność z ziarnem bez sąsiadów-bliźniaków, odbicia i skala z ziarna.
  // Ruch widowni: zwykłe podskoki w rytm (styl „skok”, motywy.js ruchFana), w spokoju stoją.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=83;
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
    return bufor("zl-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  // pas z monet: falisty kopiec złotej lamy, na nim dwa rzędy monet (ukośnie widziane elipsy z grubością i obwódką),
  // cień od góry; raz na rozmiar
  const monety=(W,h)=>bufor("zl-monety|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(30,2,8,0)");g.addColorStop(.6,"rgba(30,2,8,.22)");g.addColorStop(1,"rgba(30,2,8,.36)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
    const y=h*.72,lin=x=>y+Math.sin(x*.021)*h*.03+Math.sin(x*.0063+2)*h*.04;
    c.beginPath();c.moveTo(0,h);c.lineTo(0,lin(0));for(let x=0;x<=W;x+=24)c.lineTo(x,lin(x));c.lineTo(W,h);c.closePath();
    c.fillStyle="#a8731a";c.fill();
    const f=fakturaWzor(c,.7);if(f){c.fillStyle=f;c.fill();}
    const rx=Math.max(10,h*.19),ry=rx*.4,dh=Math.max(2,ry*.55);
    const rzad1=(yy,off,ksk)=>{
      for(let x=-rx+off,i=0;x<W+rx;x+=rx*1.35,i++){
        const cx=x+(los(i,ksk)-.5)*rx*.4,cy=yy+(los(i,ksk+1)-.5)*ry*.6,k=los(i,ksk+2);
        c.fillStyle="#7d4f0a";c.beginPath();c.ellipse(cx,cy+dh,rx,ry,0,0,TAU);c.fill();
        c.fillStyle="#b97e14";c.fillRect(cx-rx,cy,2*rx,dh);c.beginPath();c.ellipse(cx,cy+dh,rx,ry,0,0,PI);c.fill();
        c.fillStyle=k>.5?"#f7c943":"#eab32c";c.beginPath();c.ellipse(cx,cy,rx,ry,0,0,TAU);c.fill();
        c.strokeStyle="rgba(120,70,5,.55)";c.lineWidth=1;c.beginPath();c.ellipse(cx,cy,rx*.72,ry*.68,0,0,TAU);c.stroke();
        c.fillStyle="rgba(255,248,200,.65)";c.beginPath();c.ellipse(cx-rx*.35,cy-ry*.35,rx*.18,ry*.14,0,0,TAU);c.fill();
      }
    };
    rzad1(h*.84,0,3);rzad1(h*.97,rx*.65,11);
    c.setLineDash([4,3]);c.strokeStyle="rgba(255,236,170,.5)";c.lineWidth=1.1;c.beginPath();
    for(let x=0;x<=W;x+=24){const yy=lin(x)+5;if(x)c.lineTo(x,yy);else c.moveTo(x,yy);}c.stroke();c.setLineDash(BRAK);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.95)),krok=W/n,R0=rzad(n),dno=Wd.y+h*1.02;
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"skok",i);
      }
      c.drawImage(monety(W,h).cv,0,Wd.y,W,h);   // monety na wierzchu: żaby stoją w nich po kostki
    }};

  // =========================================================================================== streak
  // Ślad: złoty pył. Pod spodem miękka złota wstęga, na niej kropki w dwóch odcieniach (jasne i głębokie złoto), które
  // wirują i migoczą w czasie (każda w swojej fazie), przy wyższym ogniu dochodzą gwiazdki połysku.
  const GRAD_S=new Map();
  function gradSladu(c,x0,xT){
    const kl=Math.round(x0)*16384+Math.round(xT);let g=GRAD_S.get(kl);if(g)return g;
    if(GRAD_S.size>24)GRAD_S.clear();
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(120,60,0,0)");a.addColorStop(.5,"rgba(150,80,5,.32)");a.addColorStop(1,"rgba(170,100,10,.5)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(255,217,90,0)");b.addColorStop(.5,"rgba(255,217,90,.4)");b.addColorStop(1,"rgba(255,240,170,.7)");
    g={a,b};GRAD_S.set(kl,g);return g;
  }
  const streak={
    glowa(){},
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),og=k.og|0,ts=k.ts,sz=og>=3?7:og>=2?6:5;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+3;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=sz;c.stroke();
      // pył: dwa odcienie, po jednej ścieżce na odcień (kwadratowe cekiny co kilka punktów śladu, nie więcej niż ~45)
      const dl=Math.max(1,k.dlug||(k.xT-k.x0)||1),n=pts.length,krok=Math.max(1,Math.floor(n/44));
      for(let t=0;t<2;t++){
        c.beginPath();
        for(let j=t;j<n;j+=krok+t){
          const p=pts[j];if(!p.sp)continue;
          const f=Math.max(0,Math.min(1,(p.x-k.x0)/dl));if(f<.04)continue;
          const ph=j*1.73,mig=.5+.5*Math.sin(ts*5+ph*3.1);
          const r=(1.2+2.2*los(j,2))*(.35+.65*f)*(.55+.6*mig)*(1+.18*og);
          const x=p.x+Math.sin(ts*2.3+ph)*3.5,y=p.y+Math.sin(ts*1.9+ph*2.1)*(2+sz*.7*f);
          c.rect(x-r,y-r,2*r,2*r);
        }
        c.fillStyle=t?"#f0b429":"#fff3c4";c.fill();
      }
      if(og<2)return;
      let ost=-1e9,nr=0;
      for(const p of pts){
        if(!p.sp||p.x-ost<56||p.x<k.x0)continue;const f=(p.x-k.x0)/dl;if(f<.25)continue;ost=p.x;
        if(++nr>6)break;
        const a=Math.sin(ts*4+p.x*.07);if(a<.1)continue;
        blysk(c,p.x,p.y-sz*.4,(3.5+3.5*f)*a,"rgba(255,255,255,.92)");
      }
    },
    // płonąca nuta: zaśpiewana część jaśnieje do białego złota, na froncie połysk
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){
        c.fillStyle=jasnosc(c,nh);c.fillRect(x0,-nh/2,fx-x0,nh);
        if(poziom>=2){c.fillStyle="rgba(255,255,255,.55)";c.fillRect(x0,-nh/2,fx-x0,Math.max(1.5,nh*.22));}
      }
      if(gas>.05){
        const r=nh*(aktywna?.95:.7)*(.75+.25*Math.sin(ts*9+z));
        c.globalAlpha=Math.min(1,gas);blysk(c,fx,-nh*.12,r,"#ffffff");c.globalAlpha=1;
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)sztabkiToru(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{for(let i=0;i<ISKRY;i++)iskra(i,40);}catch(e){}},
    aura:[BIAL,ZLOTO],wypelnienie:["#ffffff",KREM,ZLOTO],
    iskry:{kolory:["#ffffff",ZLOTO_J,ZLOTO]},dym:false,
    scena:["255,214,110","200,30,50","255,244,200"],
    tlo:{promienie:[["255,210,110",.10],["200,30,50",.05]],swiatlo:["255,220,130","120,10,30"]}};
  const JAS=new Map();
  function jasnosc(c,nh){
    const kl=Math.round(nh*2);let g=JAS.get(kl);if(g)return g;
    const h=kl/2;g=c.createLinearGradient(0,-h/2,0,h/2);g.addColorStop(0,"rgba(255,255,245,.78)");g.addColorStop(1,"rgba(255,232,150,.5)");
    JAS.set(kl,g);return g;
  }

  // ---- sztabki z toru: pula na gracza, bez alokacji w klatce ----
  // Sztabki (iskra-0..5) wylatują zza żaby w górę i do tyłu, wirują powoli i spadają CIĘŻKO (grawitacja ok. 3 razy
  // większa niż lei w tiki), więc krótki łuk i szybki upadek. Na progu kombo co 4 nuty trzy naraz.
  const PULE=new WeakMap(),MAKS_CZ=12,TEMPO=[0,1.4,2.4,3.6],GRAW=520;
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,dos:0,cz:[]};
    for(let i=0;i<MAKS_CZ;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,k:0,r:20,rot:0,wir:0});
    PULE.set(g,p);return p;
  }
  function rzuc(P,L,g,sc,og){
    for(const p of P.cz)if(p.z<=0){
      const pz=pozycjaZaby(L,g);
      p.k=Math.floor(Math.random()*ISKRY);p.r=Math.round(sc*(.26+.05*og)*(.85+.3*Math.random()));
      p.x=pz.x-sc*.2+(Math.random()-.5)*sc*.3;p.y=pz.y-sc*.35;p.vx=-(25+85*Math.random());p.vy=-(150+90*Math.random());
      p.rot=Math.random()*TAU;p.wir=(Math.random()<.5?-1:1)*(1+1.6*Math.random());p.zy=1+.35*Math.random();p.z=p.zy;return;
    }
  }
  function sztabkiToru(c,L,g,st){
    if(typeof pozycjaZaby!=="function"||!jest())return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(og>0){
      P.dos+=dt*TEMPO[og];if(P.dos>=1){P.dos-=1;rzuc(P,L,g,sc,og);}
      if(k>P.k&&k>=4&&k%4===0)for(let j=0;j<3;j++)rzuc(P,L,g,sc,og);
    }else P.dos=0;
    P.k=k;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=GRAW*dt;p.rot+=p.wir*dt;
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,s=p.r*(f<.12?.5+.5*f/.12:1);
      c.globalAlpha=f<.1?f/.1:p.z<.3?p.z/.3:1;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Złoto",kolejnosc:26,kolor:"#f0b429",zasoby:ZASOBY,przebranie:true,
    opis:"Góry złota z filcu: hałdy sztabek, monet i klejnotów po bokach i czerwony aksamit pośrodku. Karta to głęboka czerwień ze złotą lamą, nuty to sztabki, a w widowni tańczą złote żaby na monetach. Przy kombo za żabą migocze złoty pył i z toru sypią się ciężkie sztabki.",
    cechy:{tlo:"góry złota",klawisze:"sztabki i aksamit",streak:"złoty pył i sztabki",widownia:"złote żaby na monetach"},
    en:{nazwa:"Gold",
      opis:"A felt mountain of gold: heaps of ingots, coins and gems on the sides and red velvet in the middle. The card is deep red with golden lamé, notes are gold bars, and golden frogs dance on a bed of coins. On a combo, glittering gold dust trails behind you and heavy ingots rain from the track.",
      cechy:{tlo:"gold mountain",klawisze:"ingots and velvet",streak:"gold dust, ingots",widownia:"golden frogs on coins"}},
    karta:{papier:CZERW,cien:"rgba(30,2,8,.45)",czarne:"rgba(20,0,6,.22)",liniaC:"rgba(255,226,150,.24)",minione:"rgba(20,0,6,.26)",
      nazwy:"rgba(255,238,190,.88)",kreski:"rgba(255,226,150,.2)",nic:KREM,szpilka:ZLOTO,szpilkaBlask:"#fff6d8",
      cienNuty:"rgba(20,0,6,.5)",scieg:"rgba(255,226,150,.55)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
