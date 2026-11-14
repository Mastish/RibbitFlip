// Motyw „Prawdziwy staw” (runda 5, 10-17): CELOWE PRZEŁAMANIE STYLU filcu, fotorealizm bez ściegu i bez nici. Tło to zdjęcie
// stawu w słońcu (tlo.webp: trzciny, liście lilii, tafla z odbiciem brzegu), karta toru to ciemnozielono-niebieska szyba
// wody z fakturą fal (faktura.webp mnożona ok. 0,4), miękką winietą i odblaskiem słońca u góry. Nuty: mokre trzciny
// (zielone pasy z gładkim cieniem walca, jasnym refleksem, włóknami i kolankiem łodygi, ziarno daje odcień i krople),
// zaśpiewana część rozświetla się słońcem. Klawiatura: białe klawisze to gładkie kamyki z miękkim cieniem, czarne to mokre
// ciemne otoczaki z połyskiem. Widownia: prawdziwe żaby i ropuchy w czapeczkach (fan-0..5.webp) skaczą na błotnistym brzegu
// (gradient brązów z odbiciem wody, drobne kamyki). Streak (detal PODPISOWY): ślad to kręgi na wodzie rozchodzące się
// z punktów śladu za żabą (kilka naraz, spłaszczone elipsy bez filtrów) i skaczące krople; z toru lecą krople, lilie,
// ważki, liście, muchy i pałki wodne (iskra-0..5). Głowa bez efektu: żabę ubiera przebranie motywu. Wszystko z buforów.
(function(){
  "use strict";
  const ID="prawdziwy",PI=Math.PI,TAU=2*PI;
  const WODA="#1f5456",WODA_C="#0b2a2d",TRZ_C="#10361a",SLONCE="#fff3c0",NIEBO="#bfe6ff";
  const FANY=6,ISKRY=6;
  const ZASOBY=["tlo.webp","faktura.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;

  // =========================================================================================== wzory (raz)
  const WZORY=new Map();
  function wzor(c,klucz,tworz,skala){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");if(skala&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix().scale(skala));WZORY.set(klucz,w);}
    return w;
  }
  // Włókna trzciny: podłużne smugi w dwóch tonach i jedno kolanko łodygi (kafel 72 × 16, bez szwu w poziomie).
  function kafelekTrzciny(){
    const cv=document.createElement("canvas");cv.width=72;cv.height=16;const x=cv.getContext("2d");
    for(let i=0;i<16;i++){
      const a=.05+.09*los(i,1);
      x.fillStyle=i%2?"rgba(255,255,210,"+a+")":"rgba(5,40,12,"+a*1.2+")";
      x.fillRect(0,i,72,.8+los(i,2)*.7);
    }
    x.fillStyle="rgba(6,44,14,.34)";x.fillRect(50,0,3,16);
    x.fillStyle="rgba(235,250,190,.4)";x.fillRect(53,0,1.2,16);
    return cv;
  }
  const trzcina=c=>wzor(c,"trzcina",kafelekTrzciny);
  // faktura motywu (powierzchnia wody, kafel 512); zanim się wczyta: gładka szyba
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    return im?wzor(c,"faktura",()=>im,.5):null;
  }

  // =========================================================================================== sprite'y
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("pr-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.16,scieg:false,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["190,230,255",.08],["120,190,90",.05]],swiatlo:["200,235,255","40,110,120"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#7fa6b0";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(6,24,28,0)");g.addColorStop(1,"rgba(6,24,28,.32)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Tafla wody: ciemna szyba, fale z faktury mnożone na zielono-niebieski, miękka winieta do brzegów, u góry odblask
  // słońca (gradient i szeroka plama bez ostrych krawędzi). Statycznie, raz na układ.
  function fakturaKarty(c,L){
    const f=fakturaWzor(c);
    if(f){c.globalCompositeOperation="multiply";c.globalAlpha=.4;c.fillStyle=f;c.fillRect(L.x,L.y,L.w,L.h);c.globalCompositeOperation="source-over";c.globalAlpha=1;}
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,246,196,.2)");g.addColorStop(.32,"rgba(255,246,196,0)");g.addColorStop(.7,"rgba(2,20,24,0)");g.addColorStop(1,"rgba(2,20,24,.3)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
    const cx=L.x+L.w*.7,r=Math.max(40,L.w*.34),s=c.createRadialGradient(cx,L.y,0,cx,L.y,r);
    s.addColorStop(0,"rgba(255,248,205,.2)");s.addColorStop(1,"rgba(255,248,205,0)");
    c.fillStyle=s;c.fillRect(L.x,L.y,L.w,Math.min(L.h,r));
    const v=c.createRadialGradient(L.x+L.w/2,L.y+L.h/2,Math.min(L.w,L.h)*.3,L.x+L.w/2,L.y+L.h/2,Math.hypot(L.w,L.h)*.55);
    v.addColorStop(0,"rgba(2,20,24,0)");v.addColorStop(1,"rgba(2,20,24,.34)");
    c.fillStyle=v;c.fillRect(L.x,L.y,L.w,L.h);
  }

  // =========================================================================================== nuty
  // Mokra trzcina: zieleń z ziarna (trzy odcienie), włókna i kolanko z wzoru, cień walca od dołu i wąski jasny refleks
  // u góry, krople wody. Ciemnozielony obrys (brzeg) odcina łodygę od ciemnej wody karty. Bez nici i bez ściegu.
  const ZIEL=["#68ad45","#7cba4a","#55a05a"];
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,255,225,.42)");g.addColorStop(.28,"rgba(255,255,225,0)");g.addColorStop(.62,"rgba(8,44,16,.1)");g.addColorStop(1,"rgba(6,36,14,.55)");
      WALEC.set(k,g);}
    return g;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2,z=o.ziarno|0;
      c.fillStyle=ZIEL[z%3];c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=trzcina(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(w>=14&&nh>=6){
        // jasny refleks słońca (przerywany, nierówny) i dwie krople wody
        const l=Math.max(4,w*(.3+.25*los(z,3))),xs=x0+2+(w-l-6)*los(z,4);
        c.fillStyle="rgba(255,255,238,.62)";c.fillRect(xs,y0+nh*.2,l,Math.max(1,nh*.1));
        c.fillRect(xs+l+4<x0+w-3?xs+l+4:x0+2,y0+nh*.2,Math.min(5,w*.1),Math.max(1,nh*.1));
        if(w>=28){
          for(let i=0;i<2;i++){
            const dx=x0+4+(w-8)*los(z,10+i),dy=y0+nh*(.42+.2*los(z,20+i)),r=Math.max(.9,nh*.075);
            c.fillStyle="rgba(8,44,16,.5)";c.beginPath();c.arc(dx,dy+.6,r,0,TAU);c.fill();
            c.fillStyle="rgba(240,255,235,.8)";c.beginPath();c.arc(dx-r*.25,dy-r*.2,r*.55,0,TAU);c.fill();
          }
        }
      }
    },
    brzeg:()=>TRZ_C,zapas:()=>0};

  // =========================================================================================== klawisze
  // Ciemna woda (faktura mnożona), białe klawisze to gładkie jasnoszare kamyki z miękkim cieniem i kilkoma plamkami,
  // czarne to mokre ciemne otoczaki z połyskiem. Gracz: słoneczna poświata na klawiszu, bez ściegu.
  function kamyk(c,x,y,w,h,z,jasny){
    const r=Math.min(h/2.1,w/2.6,9);
    if(jasny){c.beginPath();c.roundRect(x+1.2,y+2,w,h,r);c.fillStyle="rgba(2,18,20,.38)";c.fill();}   // miękki cień pod jasnym kamykiem (ciemne: bryła z gradientu, budżet rysowań)
    c.beginPath();c.roundRect(x,y,w,h,r);
    const g=c.createLinearGradient(x,y,x+w*.35,y+h);
    if(jasny){g.addColorStop(0,"#f1f2ee");g.addColorStop(.55,"#d8dad4");g.addColorStop(1,"#a9aea8");}
    else{g.addColorStop(0,"#4a5a61");g.addColorStop(.35,"#243136");g.addColorStop(1,"#0b1215");}
    c.fillStyle=g;c.fill();
    c.save();c.clip();
    if(jasny){
      c.fillStyle="rgba(90,96,90,.2)";
      c.beginPath();for(let i=0;i<7;i++){const px=x+w*(.08+.84*los(z,i)),py=y+h*(.15+.7*los(z,i+9));c.moveTo(px,py);c.arc(px,py,.7+los(z,i+4)*.9,0,TAU);}c.fill();   // plamki jedną ścieżką (budżet rysowań)
    }
    if(jasny){const hl=c.createRadialGradient(x+w*.3,y+h*.28,0,x+w*.3,y+h*.28,Math.max(w*.55,h));
      hl.addColorStop(0,"rgba(255,255,255,.55)");hl.addColorStop(1,"rgba(255,255,255,0)");
      c.fillStyle=hl;c.fillRect(x,y,w,h);}
    c.restore();
    c.lineWidth=1;c.strokeStyle=jasny?"rgba(70,78,74,.5)":"rgba(0,0,0,.6)";c.stroke();
  }
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=WODA;c.fill();
      const f=fakturaWzor(c);
      if(f){c.save();c.clip();c.globalCompositeOperation="multiply";c.globalAlpha=.5;c.fillStyle=f;c.fillRect(x,y0,w,h);c.restore();}
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1.4,Math.min(2.6,L.rh*.2));
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<2)continue;
        kamyk(c,x+ins+1,yt+ins,w-2*ins-2,hh,i,true);
      }
      for(let s=L.dolN;s<=L.goraN;s++){
        if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);
        kamyk(c,k.x,k.y+.6,k.w*.62,Math.max(2,k.h-1.2),s+40,false);
      }
      c.strokeStyle=WODA_C;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(255,246,180,.82)":"rgba(255,246,180,.42)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?"rgba(255,255,255,.9)":"rgba(255,255,255,.5)";c.lineWidth=1.2;
      c.strokeRect(L.kx+2,y+1.2,L.kw-4,Math.max(1,hh-1.4));
    }};

  // =========================================================================================== widownia
  // Żaby i ropuchy z fan-*.webp na błotnistym brzegu. Sześć postaci, kolejność z ziarna bez sąsiadów-bliźniaków, odbicia
  // i skala z ziarna. Ruch `zabi`: żabi skok łukiem co dwa takty (motywy.js ruchFana), w spokoju stoją.
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
    return bufor("pr-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  // brzeg: falista linia wody z jasnym odbiciem nieba, pod nią mokre błoto (brązy), na nim kamyki i drobne źdźbła
  const brzeg=(W,h)=>bufor("pr-brzeg|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(20,14,8,0)");g.addColorStop(.6,"rgba(20,14,8,.22)");g.addColorStop(1,"rgba(20,14,8,.36)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
    const y=h*.74,lin=o=>x=>y+o+Math.sin(x*.017)*h*.03+Math.sin(x*.0061+2)*h*.04;
    const fala=o=>{const f=lin(o);c.beginPath();c.moveTo(0,h);c.lineTo(0,f(0));
      for(let x=0;x<=W;x+=20)c.lineTo(x,f(x));c.lineTo(W,h);c.closePath();};
    fala(-4);c.fillStyle="rgba(160,205,225,.55)";c.fill();   // płycizna z odbiciem nieba
    fala(-1.5);c.fillStyle="#2a1f14";c.fill();                  // mokry brzeg
    fala(0);
    const m=c.createLinearGradient(0,y-h*.1,0,h);m.addColorStop(0,"#6b5338");m.addColorStop(.35,"#4f3c27");m.addColorStop(1,"#2d2216");
    c.fillStyle=m;c.fill();
    const f=lin(1.2);c.beginPath();for(let x=0;x<=W;x+=20){if(x)c.lineTo(x,f(x));else c.moveTo(x,f(x));}
    c.strokeStyle="rgba(235,245,250,.55)";c.lineWidth=1.1;c.stroke();   // refleks na krawędzi wody
    const n=Math.round(W/9);
    for(let i=0;i<n;i++){   // drobne kamyki i grudki w błocie
      const px=los(i,41)*W,py=y+h*.04+los(i,42)*(h-y-h*.05),r=.8+los(i,43)*1.9,ja=los(i,44);
      c.fillStyle=ja>.5?"rgba(150,128,98,.5)":"rgba(20,14,8,.4)";c.beginPath();c.ellipse(px,py,r*1.4,r,0,0,TAU);c.fill();
      if(ja>.8){c.fillStyle="rgba(255,250,235,.35)";c.beginPath();c.ellipse(px-r*.3,py-r*.3,r*.6,r*.4,0,0,TAU);c.fill();}
    }
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.95)),krok=W/n,R0=rzad(n),dno=Wd.y+h*1.02;
      for(let i=0;i<n;i++){
        const r=R0[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"zabi",i);
      }
      c.drawImage(brzeg(W,h).cv,0,Wd.y,W,h);   // brzeg na wierzchu: zwierzaki stoją w nim po kostki
    }};

  // =========================================================================================== streak
  // Ślad: cienka, półprzezroczysta wstęga wody za żabą i kręgi na wodzie rozchodzące się z punktów śladu (spłaszczone
  // elipsy, im dalej za żabą, tym większe i bledsze; przy wyższym ogniu więcej kręgów i drugi, pulsujący krąg w środku),
  // nad śladem podskakują krople. Wszystkie kręgi jednym przebiegiem rysowania, wygasają gradientem po x.
  const KREGI=[3,4,6,8],KROPLE=[0,0,3,5];
  const GRAD=new Map();
  function gradSladu(c,x0,xT){
    const kl=Math.round(x0)*16384+Math.round(xT);let g=GRAD.get(kl);if(g)return g;
    if(GRAD.size>24)GRAD.clear();
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(2,24,30,0)");a.addColorStop(.6,"rgba(2,24,30,.28)");a.addColorStop(1,"rgba(2,24,30,.5)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(191,230,255,0)");b.addColorStop(.5,"rgba(191,230,255,.5)");b.addColorStop(1,"rgba(220,242,255,.85)");
    const d=c.createLinearGradient(x0,0,xT,0);d.addColorStop(0,"rgba(255,255,255,0)");d.addColorStop(.5,"rgba(255,255,255,.55)");d.addColorStop(1,"rgba(255,255,255,.95)");
    g={a,b,c:d};GRAD.set(kl,g);return g;
  }
  function ySladu(pts,x){
    let lo=0,hi=pts.length-1;if(hi<1||x<pts[0].x||x>pts[hi].x)return null;
    while(hi-lo>1){const m=(lo+hi)>>1;if(pts[m].x<=x)lo=m;else hi=m;}
    const a=pts[lo],b=pts[hi];if(!a.sp||!b.sp)return null;
    const t=b.x>a.x?(x-a.x)/(b.x-a.x):0;return a.y+(b.y-a.y)*t;
  }
  const streak={
    glowa(){},
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT),og=k.og|0,sz=og>=3?5:og>=2?4:3,ts=k.ts;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false,ost=-1e9;
      for(const p of pts){if(!p.sp||p.x<k.x0){pi=false;continue;}if(pi&&p.x-ost<4)continue;ost=p.x;if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=sz+2.4;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=sz;c.stroke();
      c.strokeStyle=g.c;c.lineWidth=Math.max(1,sz*.3);c.stroke();
      // kręgi na wodzie: punkty co 46 px od żaby wstecz, promień rośnie z wiekiem, wewnętrzny krąg pulsuje
      const nr=KREGI[Math.min(3,og)],tyl=og>=2;
      c.beginPath();let n=0;
      for(let x=k.xT-30;x>k.x0+16&&n<nr;x-=46,n++){
        const y=ySladu(pts,x);if(y==null)continue;
        const w=(k.xT-x)/Math.max(1,k.dlug),r=5+w*34*(1+.18*Math.sin(ts*3+n*1.7));
        c.moveTo(x+r,y);c.ellipse(x,y,r,r*.42,0,0,TAU);
        if(tyl){const ph=(ts*.9+n*.31)%1,r2=r*(.3+.5*ph);c.moveTo(x+r2,y);c.ellipse(x,y,r2,r2*.42,0,0,TAU);}
      }
      c.strokeStyle=g.c;c.lineWidth=1.6;c.stroke();
      // krople podskakujące nad śladem
      const nk=KROPLE[Math.min(3,og)];
      if(nk){
        c.fillStyle="rgba(235,248,255,.82)";c.beginPath();
        for(let i=0;i<nk;i++){
          const x=k.xT-50-i*52,y=ySladu(pts,x);if(y==null||x<k.x0+10)continue;
          const ph=(ts*1.3+i*.37)%1,up=Math.sin(ph*PI)*(8+5*og),r=1.5+.5*(i%2);
          c.moveTo(x+r,y-up-3);c.arc(x,y-up-3,r,0,TAU);
        }
        c.fill();
      }
    },
    // płonąca nuta: zaśpiewana część rozświetla się słońcem, na froncie błysk i kropla
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){
        c.fillStyle="rgba(255,244,170,.4)";c.fillRect(x0,-nh/2,fx-x0,nh);
        c.fillStyle="rgba(255,255,240,.32)";c.fillRect(x0,-nh/2,fx-x0,Math.max(1,nh*.22));
        if(aktywna){c.fillStyle="rgba(255,255,245,.85)";c.fillRect(fx-1.2,-nh/2,2.4,nh);}
      }
      if(gas>.05&&jest()){
        const im=iskra(0,48),s=nh*(aktywna?1.4:1.1);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.6,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)kropleToru(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(0,48);}catch(e){}},
    aura:["#f4fbff","#8fcdf0"],wypelnienie:["#f6fcff","#bfe6ff","#6fb8e8"],
    iskry:{kolory:["#ffffff",NIEBO,"#9fd27a"]},dym:false,
    scena:["190,230,255","120,190,90","63,138,78"],
    tlo:{promienie:[["190,230,255",.08],["120,190,90",.05]],swiatlo:["200,235,255","40,110,120"]}};

  // ---- z toru: pula na gracza, bez alokacji w klatce ----
  // Krople, lilie, ważki, liście, muchy i pałki (iskra-0..5) wylatują zza żaby w górę i do tyłu i opadają łukiem;
  // krople częściej, a na progu kombo co 4 nuty trzy naraz.
  const PULE=new WeakMap(),MAKS_CZ=10,TEMPO=[0,1,2,3.4],LOSUJ=[0,0,0,0,1,2,2,3,4,5];
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,dos:0,cz:[]};
    for(let i=0;i<MAKS_CZ;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,k:0,r:20,rot:0,wir:0});
    PULE.set(g,p);return p;
  }
  function rzuc(P,L,g,sc,og){
    for(const p of P.cz)if(p.z<=0){
      const pz=pozycjaZaby(L,g);
      p.k=LOSUJ[Math.floor(Math.random()*LOSUJ.length)];p.r=Math.round(sc*(.22+.05*og)*(.85+.3*Math.random())*(p.k===0?.8:1));
      p.x=pz.x-sc*.2+(Math.random()-.5)*sc*.3;p.y=pz.y-sc*.35;p.vx=-(40+60*Math.random());p.vy=-(110+60*Math.random());
      p.rot=Math.random()*TAU;p.wir=(Math.random()<.5?-1:1)*(1+1.6*Math.random());p.zy=1.5+.5*Math.random();p.z=p.zy;return;
    }
  }
  function kropleToru(c,L,g,st){
    if(typeof pozycjaZaby!=="function"||!jest())return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(og>0){
      P.dos+=dt*TEMPO[og];if(P.dos>=1){P.dos-=1;rzuc(P,L,g,sc,og);}
      if(k>P.k&&k>=4&&k%4===0)for(let j=0;j<3;j++)rzuc(P,L,g,sc,og);
    }else P.dos=0;
    P.k=k;
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=190*dt;p.rot+=p.wir*dt;
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,s=p.r*(f<.15?.5+.5*f/.15:1);
      c.globalAlpha=f<.1?f/.1:p.z<.45?p.z/.45:1;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Prawdziwy staw",kolejnosc:29,kolor:"#3f8a4e",zasoby:ZASOBY,przebranie:true,
    opis:"Zdjęcie prawdziwego stawu w słońcu: trzciny, liście lilii i spokojna tafla, a na błotnistym brzegu skaczą prawdziwe żaby i ropuchy w czapeczkach. Karta to ciemna woda, nuty to mokre trzciny, klawisze to kamyki znad wody, a przy kombo za żabą rozchodzą się kręgi na wodzie i lecą krople, lilie i ważki.",
    cechy:{tlo:"zdjęcie stawu",klawisze:"kamyki znad wody",streak:"kręgi na wodzie",widownia:"żaby w czapeczkach"},
    en:{nazwa:"Real Pond",
      opis:"A photo of a real pond in the sun: reeds, lily pads and a calm surface, with real frogs and toads in little hats hopping on the muddy bank. The card is dark water, notes are wet reeds, keys are pebbles from the shore, and on a combo rings spread on the water behind you while drops, lilies and dragonflies fly out.",
      cechy:{tlo:"real pond photo",klawisze:"pebbles and wet stones",streak:"rings on the water",widownia:"frogs in little hats"}},
    karta:{papier:WODA,cien:"rgba(2,20,24,.4)",czarne:"rgba(2,18,22,.22)",liniaC:"rgba(225,245,240,.22)",minione:"rgba(2,18,22,.26)",
      nazwy:"rgba(236,248,244,.85)",kreski:"rgba(225,245,240,.2)",nic:NIEBO,szpilka:"#f2c94c",szpilkaBlask:"#ffffff",
      cienNuty:"rgba(2,18,22,.5)",scieg:null,rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
