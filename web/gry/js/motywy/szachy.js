// Motyw „Szachy” (runda 5, 10-17): królewska sala tronowa z filcu. Tło to ilustracja (tlo.webp: szachownica w podłodze,
// wielkie figury po bokach, czerwone kotary z chwostami, złote żyrandole, proporce z koronami), karta toru to królewski
// fiolet z fakturą szachownicy mnożoną subtelnie (faktura.webp), złotym obszyciem ze ściegu i blaskiem żyrandola u góry.
// Nuty: jasne fioletowe aksamitne wstęgi ze złotym galonem na brzegach i drobnym znakiem na początku (z ziarna: korona,
// wieża albo koń). Klawiatura: białe klawisze z kości słoniowej, czarne z ebonu, ścieg złotą nicią. Widownia: żabie
// figury szachowe (król, hetman, skoczek, goniec, wieża, pion; fan-0..5.webp) na pasie szachownicy, „stawiane” na pola
// ruchem pop. Streak (detal PODPISOWY): ślad to złota królewska wstęga z kremowych i hebanowych pól, które przesuwają
// się za żabą, a przy wyższym kombo stoją na niej pionki; z toru lecą figury (iskra-0..5). Zaśpiewana część nuty
// zalewa się złotem, a przy wyższym ogniu pola szachownicy pod nutą rozświetlają się jak przy szach-macie. Głowa bez
// efektu: żabę ubiera przebranie motywu. Wszystko z buforów i wzorów.
(function(){
  "use strict";
  const ID="szachy";
  const FIOL="#4a2478",FIOL_C="#2a1248",WELUR="#9a57dc",WELUR_C="#6a32a8",ZLOTO="#f0c441",
    KOSC="#f6edd2",KOSC_C="#dccb9c",HEBAN="#1a1315",KREM="#f6edd2",BRZEG="#1d0b33";
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
  // Kafel szachownicy z kodu (zanim wczyta się faktura): 2 × 2 pola po 16 px, kremowe i hebanowe.
  function kafelekPol(){
    const cv=document.createElement("canvas");cv.width=cv.height=32;const x=cv.getContext("2d");
    x.fillStyle=KREM;x.fillRect(0,0,32,32);x.fillStyle="#2b2227";x.fillRect(16,0,16,16);x.fillRect(0,16,16,16);
    return cv;
  }
  // Złote pola „szach-matu” pod płonącą nutą: kafel 16 × 16 (dwa jasne pola po przekątnej, dwa ciemniejsze).
  function kafelekZlotych(){
    const cv=document.createElement("canvas");cv.width=cv.height=16;const x=cv.getContext("2d");
    x.fillStyle="rgba(255,150,20,.5)";x.fillRect(0,0,16,16);
    x.fillStyle="rgba(255,238,150,.95)";x.fillRect(0,0,8,8);x.fillRect(8,8,8,8);
    return cv;
  }
  const zlotePola=c=>wzor(c,"zlote",kafelekZlotych);
  // faktura motywu (szachownica ze ściegiem, kafel 512 = 6 × 6 pól, bez szwów); zanim się wczyta: pola z kodu
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    if(!im)return wzor(c,"pola",kafelekPol,1);
    return wzor(c,"faktura",()=>im,.42);
  }

  // =========================================================================================== sprite'y
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("sz-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.16,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["255,214,120",.10],["170,90,220",.06]],swiatlo:["255,226,150","90,40,140"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#c9a56a";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(30,10,50,0)");g.addColorStop(1,"rgba(30,10,50,.3)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Królewski fiolet: szachownica mnożona subtelnie (pola widać jako ciemniejsze plamy), u góry blask żyrandola
  // (ciepłe złoto), ku dołowi głębszy fiolet; złote obszycie ze ściegiem wokół karty.
  function fakturaKarty(c,L){
    c.globalCompositeOperation="multiply";c.globalAlpha=.34;c.fillStyle=fakturaWzor(c);c.fillRect(L.x,L.y,L.w,L.h);
    c.globalCompositeOperation="source-over";c.globalAlpha=1;
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,214,120,.26)");g.addColorStop(.28,"rgba(255,214,120,0)");g.addColorStop(.7,"rgba(20,6,40,0)");g.addColorStop(1,"rgba(20,6,40,.28)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
    // obszycie: złoty galon z ciemną nitką i kremowy ścieg tuż wewnątrz
    c.lineWidth=3;c.strokeStyle=ZLOTO;c.strokeRect(L.x+1.5,L.y+1.5,L.w-3,L.h-3);
    c.lineWidth=1;c.strokeStyle="rgba(90,50,0,.55)";c.strokeRect(L.x+3.6,L.y+3.6,L.w-7.2,L.h-7.2);
    c.setLineDash(SCIEG);c.strokeStyle="rgba(255,244,210,.6)";c.lineWidth=1;c.strokeRect(L.x+6.5,L.y+6.5,L.w-13,L.h-13);c.setLineDash(BRAK);
  }

  // =========================================================================================== nuty
  // Aksamitna wstęga: jasny fiolet (kontrast do ciemnej karty), cień walca, złoty galon na obu brzegach z ciemną nitką
  // i na początku drobny złoty znak z ziarna (korona, wieża, koń). Obrys z głębokiego fioletu.
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,235,255,.34)");g.addColorStop(.32,"rgba(255,235,255,0)");g.addColorStop(.62,"rgba(30,6,60,.1)");g.addColorStop(1,"rgba(30,6,60,.5)");
      WALEC.set(k,g);}
    return g;
  }
  // Znaki w kwadracie −1..1 (korona, wieża, koń): ścieżki bez alokacji, skala przez c.scale
  function znak(c,t,m){
    c.save();c.scale(m,m);c.beginPath();
    if(t===0){c.moveTo(-1,.7);c.lineTo(-1,-.35);c.lineTo(-.5,.15);c.lineTo(0,-.85);c.lineTo(.5,.15);c.lineTo(1,-.35);c.lineTo(1,.7);}
    else if(t===1){c.moveTo(-.8,.8);c.lineTo(-.8,-.8);c.lineTo(-.45,-.8);c.lineTo(-.45,-.4);c.lineTo(-.15,-.4);c.lineTo(-.15,-.8);c.lineTo(.15,-.8);
      c.lineTo(.15,-.4);c.lineTo(.45,-.4);c.lineTo(.45,-.8);c.lineTo(.8,-.8);c.lineTo(.8,.8);}
    else{c.moveTo(-.8,.8);c.lineTo(-.45,-.1);c.lineTo(-.95,-.15);c.lineTo(-.1,-.9);c.lineTo(.35,-.8);c.lineTo(.85,.15);c.lineTo(.85,.8);}
    c.closePath();c.restore();
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2,z=o.ziarno|0,g=Math.max(2,Math.round(nh*.17));
      c.fillStyle=(z%5===4)?WELUR_C:WELUR;c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      // galon: złote pasy na brzegach, w nich ciemna nitka (przerywana)
      c.fillStyle=ZLOTO;c.fillRect(x0-2,y0-2,w+4,g+2);c.fillRect(x0-2,y0+nh-g,w+4,g+2);
      if(nh>=9){
        c.setLineDash(SCIEG);c.strokeStyle="rgba(100,55,0,.7)";c.lineWidth=.9;c.beginPath();
        c.moveTo(x0,y0+g*.5);c.lineTo(x0+w,y0+g*.5);c.moveTo(x0,y0+nh-g*.5);c.lineTo(x0+w,y0+nh-g*.5);c.stroke();c.setLineDash(BRAK);
      }
      const m=Math.min(nh*.3,7);
      if(w>=nh*1.5&&nh>=10){
        c.save();c.translate(x0+nh*.62,0);znak(c,z%3,m);c.fillStyle=ZLOTO;c.fill();c.strokeStyle="rgba(60,25,0,.85)";c.lineWidth=.9;c.stroke();c.restore();
      }
    },
    brzeg:()=>BRZEG,zapas:()=>0};

  // =========================================================================================== klawisze
  // Fioletowa szachownicowa podkładka (faktura mnożona), białe klawisze z kości słoniowej, czarne z ebonu, złoty ścieg.
  // Gracz: złota poświata klawisza z ciemnym ściegiem.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(20,6,40,.5)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=FIOL;c.fill();
      c.save();c.clip();c.globalCompositeOperation="multiply";c.globalAlpha=.5;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.restore();
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,"#fffaea");grad.addColorStop(.6,KOSC);grad.addColorStop(1,KOSC_C);
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,5));
      }
      c.fillStyle=grad;c.fill();
      c.strokeStyle="rgba(110,80,30,.55)";c.lineWidth=1;c.stroke();
      // ebon: ciemny, jaśniejszy przy lewej krawędzi
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,4,4,0]);}
      const eb=c.createLinearGradient(x,0,x+w*.62,0);eb.addColorStop(0,"#3a2d32");eb.addColorStop(.35,HEBAN);eb.addColorStop(1,"#0d090b");
      c.fillStyle=eb;c.fill();c.strokeStyle="rgba(255,214,110,.5)";c.lineWidth=.9;c.stroke();
      c.setLineDash(SCIEG);c.strokeStyle="rgba(240,196,65,.8)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=FIOL_C;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(240,196,65,.92)":"rgba(240,196,65,.5)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?FIOL_C:"rgba(42,18,72,.55)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2.5,y+1.5,L.kw-5,Math.max(1,hh-2));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Żabie figury szachowe z fan-*.webp na pasie szachownicy. Kolejność z ziarnem bez sąsiadów-bliźniaków, odbicia
  // i skala z ziarna. Ruch „pop” (figury stawiane na pola) przez Motywy.fan; w spokoju stoją.
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
    return bufor("sz-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  // pas szachownicy: dwa rzędy pól z filcu (krem i heban) pod złotym galonem ze ściegiem, cień od góry (raz na rozmiar)
  const pas=(W,h)=>bufor("sz-pas|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(30,10,50,0)");g.addColorStop(.7,"rgba(30,10,50,.2)");g.addColorStop(1,"rgba(30,10,50,.3)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
    const sh=Math.max(10,Math.round(h*.32)),y=h-sh,p=sh/2;
    for(let r=0;r<2;r++)for(let k=0,xx=0;xx<W;k++,xx+=p){c.fillStyle=(k+r)%2?"#2b2227":"#eadfbd";c.fillRect(xx,y+r*p,p+.5,p+.5);}
    c.fillStyle="rgba(20,6,40,.22)";c.fillRect(0,y,W,3);   // cień pod galonem
    c.fillStyle=ZLOTO;c.fillRect(0,y-3,W,4);
    c.setLineDash([4,3]);c.strokeStyle="rgba(100,55,0,.7)";c.lineWidth=1;c.beginPath();c.moveTo(0,y-1);c.lineTo(W,y-1);c.stroke();
    c.strokeStyle="rgba(240,226,190,.5)";c.beginPath();c.moveTo(0,y+p);c.lineTo(W,y+p);c.stroke();c.setLineDash(BRAK);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*1.0),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.95)),krok=W/n,R0=rzad(n);
      const dno=Wd.y+h*.96;
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"pop",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
      c.drawImage(pas(W,h).cv,0,Wd.y,W,h);   // pas na wierzchu: figury stoją na polach po cokół
    }};

  // =========================================================================================== streak
  // Ślad: złota królewska wstęga. Fioletowy cień, złoty brzeg, kremowe pole i ciemne pola przesuwające się ku żabie
  // (przerywana kreska = naprzemienne kwadraty szachownicy); przy wyższym kombo na wstędze stoją pionki (iskra-5),
  // a tuż za żabą hetman (iskra-1).
  const KR=[null,null,null,null,null,[5,5],[6,6],[7,7]];   // pola o boku szerokości wstęgi
  const streak={
    glowa(){},
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),sz=k.og>=3?7:k.og>=2?6:5,ts=k.ts;
      c.lineJoin="round";c.lineCap="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+5;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=sz+2.6;c.stroke();
      c.lineCap="butt";c.strokeStyle=g.c;c.lineWidth=sz;c.stroke();
      c.setLineDash(KR[sz]);c.lineDashOffset=-ts*16;c.strokeStyle=g.d;c.stroke();c.setLineDash(BRAK);c.lineDashOffset=0;c.lineCap="round";
      if(!jest()||k.og<1)return;
      if(k.og>=2){
        const pion=iskra(5,32);let ost=-1e9,nr=0;
        if(pion)for(const p of pts){
          if(!p.sp||p.x-ost<70||p.x<k.x0)continue;ost=p.x;
          const f=(p.x-k.x0)/k.dlug;if(f<.2||f>.84)continue;
          if(++nr>5)break;
          const s=11+8*f;
          c.drawImage(pion.cv,p.x-s/2,p.y-s*.82,s,s);   // pionek stoi na wstędze
        }
      }
      const hq=iskra(1,48);if(!hq||k.pelna===false)return;
      const r=k.og>=3?12:10,x=k.xT-34,y=ySladu(pts,x);if(y==null)return;
      c.save();c.translate(x,y-r*.35);c.rotate(Math.sin(ts*2.4)*.12);c.drawImage(hq.cv,-r,-r,2*r,2*r);c.restore();
    },
    // płonąca nuta: zaśpiewana część zalewa się złotem, przy ogniu ≥ 2 pola szachownicy pod nutą rozświetlają się
    // złotem (szach-mat); na froncie król
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){
        c.fillStyle="rgba(255,205,70,.34)";c.fillRect(x0,-nh/2,fx-x0,nh);
        if(poziom>=2){
          c.globalAlpha=(poziom>=3?.95:.72)*Math.min(1,.3+gas);c.fillStyle=zlotePola(c);c.fillRect(x0,-nh/2,fx-x0,nh);c.globalAlpha=1;
          c.fillStyle="rgba(255,248,215,.9)";c.fillRect(fx-1,-nh/2,2,nh);
        }
      }
      if(gas>.05&&jest()){
        const im=iskra(0,48),s=nh*(aktywna?1.5:1.15);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.6,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)figury(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(0,48);iskra(5,32);iskra(1,48);}catch(e){}},
    aura:["#fff3c4","#e6b422"],wypelnienie:["#fff6d0","#f6d66a","#e0a82a"],
    iskry:{kolory:["#fff3c4",ZLOTO,"#b47be8"]},dym:false,
    scena:["255,214,100","170,90,220","255,244,210"],
    tlo:{promienie:[["255,214,120",.10],["170,90,220",.06]],swiatlo:["255,226,150","90,40,140"]}};

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
    const mk=(r,gg,b,a1,a2)=>{const q=c.createLinearGradient(x0,0,xT,0);q.addColorStop(0,"rgba("+r+","+gg+","+b+",0)");q.addColorStop(.5,"rgba("+r+","+gg+","+b+","+a1+")");q.addColorStop(1,"rgba("+r+","+gg+","+b+","+a2+")");return q;};
    g={a:mk(30,8,52,.5,.8),b:mk(240,196,65,.9,1),c:mk(246,237,210,.9,1),d:mk(38,28,40,.85,.95)};GRAD.set(kl,g);return g;
  }

  // ---- figury z toru: pula na gracza, bez alokacji w klatce ----
  // Król, hetman, wieża, goniec, skoczek i pion (iskra-0..5) wylatują zza żaby w górę i do tyłu, kołyszą się i opadają
  // jak rzucone na szachownicę; hetman i skoczek częściej. Na progu kombo co 4 nuty trzy naraz.
  const PULE=new WeakMap(),MAKS_CZ=10,TEMPO=[0,1,2,3.4],LOSUJ=[0,0,1,1,2,3,4,4,5,5],TAU=2*Math.PI;
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
      p.rot=Math.random()*TAU;p.wir=(Math.random()<.5?-1:1)*(1.6+1.4*Math.random());p.zy=1.5+.5*Math.random();p.z=p.zy;return;
    }
  }
  function figury(c,L,g,st){
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
      c.save();c.translate(p.x,p.y);c.rotate(Math.sin(p.rot)*.7);c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();   // figura kołysze się, nie koziołkuje
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Szachy",kolejnosc:22,kolor:"#7b3fa0",zasoby:ZASOBY,przebranie:true,
    opis:"Królewska sala tronowa z filcu: szachownica w podłodze, wielkie figury, czerwone kotary i złote żyrandole, a w widowni tańczą żabie figury szachowe. Karta to królewski fiolet ze złotym obszyciem, nuty to aksamitne wstęgi ze złotym galonem, a przy kombo za żabą płynie złota wstęga z pól szachownicy i lecą figury.",
    cechy:{tlo:"sala tronowa",klawisze:"kość słoniowa i heban",streak:"złota wstęga szachowa",widownia:"figury szachowe"},
    en:{nazwa:"Chess",
      opis:"A felt royal throne room: a chessboard floor, giant pieces, red curtains and golden chandeliers, with frog chess pieces dancing in the crowd. The card is royal purple with gold trim, notes are velvet ribbons with a gold braid, and on a combo a golden checkered ribbon trails behind you while chess pieces fly out.",
      cechy:{tlo:"throne room",klawisze:"ivory and ebony",streak:"golden chess ribbon",widownia:"chess piece frogs"}},
    karta:{papier:FIOL,cien:"rgba(20,6,40,.4)",czarne:"rgba(14,4,30,.22)",liniaC:"rgba(255,236,190,.22)",minione:"rgba(14,4,30,.26)",
      nazwy:"rgba(250,240,214,.88)",kreski:"rgba(255,236,190,.2)",nic:KREM,szpilka:ZLOTO,szpilkaBlask:"#fff6d6",
      cienNuty:"rgba(14,4,30,.5)",scieg:"rgba(255,226,150,.6)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
