// Motyw „Sushi” (id „sashiko”, 10-18; do 10-17 „Sashiko” z rundy 3). Wizualnie: sushi master i tańczące
// sushi, całość w knajpie sushi. Id, pliki i klucze zapisu zostają (odblokowania graczy, skrót
// osiągnięcia „Perfekcja”), zmienia się wszystko, co widać. Tło to ilustracja (tlo.webp: knajpa sushi z filcu, indygo
// noreny z falą, czerwone lampiony, gablota z łososiem i tuńczykiem, półki z sake i kotem szczęścia, lada z taśmą kaiten),
// karta toru to arkusz nori (faktura.webp na ciemnej zieleni) z ciepłym światłem lampionów od góry. Nuty: plastry łososia
// (trzy odcienie z ziarna) z białymi pasmami tłuszczu, u początku przepasane paskiem nori jak nigiri. Klawiatura: bambusowa
// mata do zwijania (białe klawisze to listewki bambusa przeszyte sznurkiem, czarne to paski nori). Widownia: dwanaście
// tańczących kawałków sushi (fan-0..11.webp: nigiri, maki, onigiri, gunkan, temaki, inari i inne) na taśmie za ladą;
// podskakują jak podrzucone przez mistrza i co dwa takty obracają się w miejscu.
// Streak (detal PODPISOWY): ślad to taśma kaiten (stalowy pas z listewkami zakotwiczonymi w siatce taktu, więc jedzie razem
// z nutami), od og 2 z talerzykami sushi; na progach kombo z głowy wylatują łukiem nigiri i maki, przy pełnym ogniu opada
// różowy imbir; płonąca nuta to łosoś opalany palnikiem (aburi) z ikrą na froncie. Głowa bez efektu: żabę ubiera
// przebranie sushi mastera (kucharz itamae w opasce). W klatce drawImage i kilka obrysów.
(function(){
  "use strict";
  const ID="sashiko",PI=Math.PI,TAU=2*PI;
  const NORI="#18231b",NORI_C="#0f1811",NORI_G="#09100b",RYZ="#f7f2e7",LOSOS="#f2834e",WASABI="#9ac43f",
    LAMPION="#d7262e",SZNUREK="#f3ead2";
  const FANY=12,ISKRY=6;   // fan-0..5: nigiri, maki, onigiri; fan-6..11: gunkan, kalifornia, temaki, inari, unagi, futomaki
  const ZASOBY=["tlo.webp","faktura.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5],SZNUR=[2.4,1.6];   // kreski bez nowych tablic w klatce

  // =========================================================================================== wzory (raz)
  const WZORY=new Map();
  function wzor(c,klucz,tworz,skala){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");if(skala&&w&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix().scale(skala));WZORY.set(klucz,w);}
    return w;
  }
  // Pasma tłuszczu łososia: ukośne białe pasy (grube i cienkie na przemian, linie x+y=k) na kafelku 24 px, bez szwu.
  function kafelekPasm(){
    const cv=document.createElement("canvas");cv.width=cv.height=24;const x=cv.getContext("2d");
    for(const [k,szer,al] of [[0,2.6,.6],[12,1.1,.32],[24,2.6,.6],[36,1.1,.32],[48,2.6,.6]]){
      x.strokeStyle="rgba(255,244,236,"+al+")";x.lineWidth=szer;x.beginPath();x.moveTo(k+2,-2);x.lineTo(k-26,26);x.stroke();
    }
    return cv;
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
  const pasma=c=>wzor(c,"pasma",kafelekPasm);
  const filcNori=c=>wzor(c,"nori",()=>kafelekFilcu("rgba(170,205,150,.16)","rgba(0,8,2,.3)",360));
  // faktura motywu (nori z filcu, kafel 512 bez szwów, w skali 0,5); zanim się wczyta: włókna z kodu
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    if(!im)return filcNori(c);
    return wzor(c,"faktura",()=>im,.5);
  }

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.2,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["255,176,120",.08],["215,38,46",.05]],swiatlo:["255,214,160","60,36,18"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle="#d9b98a";c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.15);   // kadr od góry: noreny całe, a duże sushi z taśmy na dole ilustracji chowa się za widownią
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.34,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(30,16,6,0)");g.addColorStop(1,"rgba(30,16,6,.3)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Arkusz nori: faktura z włóknami na ciemnej zieleni (nuty z łososia mają na niej największy kontrast), od góry ledwie
  // ciepłe światło lampionów, ku dołowi głębszy cień.
  function fakturaKarty(c,L){
    c.globalAlpha=.55;c.fillStyle=fakturaWzor(c);c.fillRect(L.x,L.y,L.w,L.h);c.globalAlpha=1;
    const g=c.createLinearGradient(0,L.y,0,L.y+L.h);
    g.addColorStop(0,"rgba(255,170,110,.08)");g.addColorStop(.35,"rgba(255,170,110,0)");g.addColorStop(1,"rgba(0,6,2,.24)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
  }

  // =========================================================================================== nuty
  // Plaster łososia (trzy odcienie z ziarna) z ukośnymi pasmami tłuszczu i cieniem walca; u początku przepaska nori jak
  // na nigiri. Kremowy obrys przy niskim kryciu odcina plaster od ciemnej karty.
  const MIESO=["#f2834e","#f69467","#eb7443"];
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,240,226,.3)");g.addColorStop(.32,"rgba(255,240,226,0)");g.addColorStop(.7,"rgba(120,36,10,.08)");g.addColorStop(1,"rgba(110,30,8,.36)");
      WALEC.set(k,g);}
    return g;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2;
      c.fillStyle=MIESO[(o.ziarno|0)%3];c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=pasma(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(w<nh*1.4||nh<6)return;
      const pw=Math.max(3,Math.min(nh*.62,w*.16)),px=x0+Math.max(2,nh*.32);
      c.fillStyle=NORI;c.fillRect(px,y0-2,pw,nh+4);
      c.fillStyle=filcNori(c);c.fillRect(px,y0-2,pw,nh+4);
      c.fillStyle="rgba(190,220,170,.2)";c.fillRect(px+pw*.2,y0-2,Math.max(1,pw*.16),nh+4);
    },
    brzeg:()=>"rgba(255,236,222,.6)",zapas:()=>0};

  // =========================================================================================== klawisze
  // Bambusowa mata do zwijania (makisu): podkład z ciemnego nori, białe klawisze to listewki bambusa (od kreski do kreski,
  // odcień z kolejności) z połyskiem u góry, cieniem walca u dołu i kolankiem z ziarna, przeszyte dwoma rzędami kremowego
  // sznurka; czarne to paski nori. Gracz: łososiowy pasek z kremowym ściegiem.
  const LISTWY=["#ead9a0","#e2cf8f","#efdfac","#dccb8b"];
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(0,8,2,.45)";c.beginPath();c.roundRect(x+2,y0+3,w,h,5);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,5);c.fillStyle=NORI_C;c.fill();
      c.save();c.clip();c.globalAlpha=.6;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.globalAlpha=1;c.restore();
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(.8,Math.min(1.8,L.rh*.14)),px=x+ins+1,pw=w-2*ins-2;
      for(let i=0;i+1<gr.length;i++){
        const yt=gr[i+1],hh=gr[i]-yt-2*ins;if(hh<1)continue;
        c.fillStyle=LISTWY[(i*3+1)%LISTWY.length];c.fillRect(px,yt+ins,pw,hh);
      }
      // cień walca i połysk listewek, kolanka i obrys: każde jedną ścieżką na wszystkie listewki
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){const yt=gr[i+1],hh=gr[i]-yt-2*ins;if(hh<1)continue;c.rect(px,yt+ins+hh*.6,pw,hh*.4);}
      c.fillStyle="rgba(120,88,28,.24)";c.fill();
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){const yt=gr[i+1],hh=gr[i]-yt-2*ins;if(hh<1)continue;c.rect(px,yt+ins,pw,Math.max(.8,hh*.2));}
      c.fillStyle="rgba(255,250,228,.45)";c.fill();
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){const yt=gr[i+1],hh=gr[i]-yt-2*ins;if(hh<3)continue;const kx=px+pw*(.3+.5*los(i,4));c.moveTo(kx,yt+ins+.5);c.lineTo(kx,yt+ins+hh-.5);}
      c.strokeStyle="rgba(116,84,26,.5)";c.lineWidth=1.3;c.stroke();
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){const yt=gr[i+1],hh=gr[i]-yt-2*ins;if(hh<1)continue;c.rect(px,yt+ins,pw,hh);}
      c.strokeStyle="rgba(92,66,22,.55)";c.lineWidth=.9;c.stroke();
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,3,3,0]);}
      c.fillStyle=NORI_G;c.fill();c.save();c.clip();c.fillStyle=filcNori(c);c.fillRect(x,y0,w,h);c.restore();
      c.strokeStyle="rgba(190,220,170,.3)";c.lineWidth=.8;c.stroke();
      // sznurek maty: dwa pionowe rzędy przez wszystkie listewki (ciemny cień i kremowa nić)
      c.setLineDash(SZNUR);c.beginPath();
      for(const f of [.22,.78]){const sx=Math.round(x+w*f)+.5;c.moveTo(sx,y0+3);c.lineTo(sx,y0+h-3);}
      c.strokeStyle="rgba(40,30,12,.5)";c.lineWidth=2.4;c.stroke();
      c.strokeStyle=SZNUREK;c.lineWidth=1.2;c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=NORI_G;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,5);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(242,131,78,.9)":"rgba(242,131,78,.48)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?RYZ:"rgba(247,242,231,.6)";c.lineWidth=1.1;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2,y+1,L.kw-4,Math.max(1,hh-1));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Tańczące sushi z fan-*.webp stoi na taśmie kaiten za ladą z jasnego drewna. Taśma za tancerzami jedzie w rytm (listewki
  // przesuwają się o pół odstępu na ćwierćnutę), lada na wierzchu chowa stopy. Ruch `podrzut` (motywy.js): podskok jak
  // podrzucone przez mistrza, miękkie spłaszczenie ryżu przy lądowaniu, co dwa takty obrót. Kolejność z ziarnem bez
  // sąsiadów-bliźniaków, odbicia i skala z ziarna.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=37;
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
    return bufor("su-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
    });
  }
  const KROK_T=16;   // odstęp listewek taśmy w px
  const podloga=(W,h)=>bufor("su-podl|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(30,16,6,.12)");g.addColorStop(.5,"rgba(30,16,6,.4)");g.addColorStop(1,"rgba(30,16,6,.58)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
  });
  // taśma kaiten: stalowa listwa z połyskiem, szary pas z ciemnymi szczelinami listewek (szerszy o dwa odstępy na przesuw)
  const tasma=(W,hb)=>bufor("su-tasma|"+W+"x"+hb,W+2*KROK_T,hb,c=>{
    const ww=W+2*KROK_T;
    c.fillStyle="#9ea3ab";c.fillRect(0,0,ww,hb);
    c.fillStyle="rgba(255,255,255,.35)";c.fillRect(0,0,ww,Math.max(1,hb*.18));
    c.fillStyle="rgba(20,22,26,.35)";c.fillRect(0,hb*.78,ww,hb*.22);
    c.beginPath();for(let x=KROK_T/2;x<ww;x+=KROK_T){c.moveTo(x,hb*.2);c.lineTo(x,hb*.8);}
    c.strokeStyle="rgba(40,44,50,.6)";c.lineWidth=1.4;c.stroke();
  });
  // lada z jasnego drewna hinoki: gradient, słoje z ziarna, kremowy ścieg u góry, cień taśmy na krawędzi
  const lada=(W,hl)=>bufor("su-lada|"+W+"x"+hl,W,hl,c=>{
    const g=c.createLinearGradient(0,0,0,hl);g.addColorStop(0,"#ecd0a2");g.addColorStop(.45,"#d9b07a");g.addColorStop(1,"#b98a52");
    c.fillStyle=g;c.fillRect(0,0,W,hl);
    c.beginPath();
    for(let j=0;j<3;j++){const yy=hl*(.38+.2*j);c.moveTo(0,yy);for(let x=40;x<=W+40;x+=40)c.lineTo(x,yy+Math.sin(x*.011+j*2.1)*hl*.04);}
    c.strokeStyle="rgba(122,82,38,.26)";c.lineWidth=1;c.stroke();
    c.fillStyle="rgba(40,22,8,.4)";c.fillRect(0,0,W,Math.max(1.5,hl*.07));
    c.setLineDash([4,3]);c.beginPath();c.moveTo(0,hl*.2);c.lineTo(W,hl*.2);c.strokeStyle="rgba(255,246,228,.75)";c.lineWidth=1.1;c.stroke();c.setLineDash(BRAK);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      c.drawImage(podloga(W,h).cv,0,Wd.y,W,h);
      const hb=Math.max(4,Math.round(h*.13)),hl=Math.max(4,Math.round(h*.15)),yl=Wd.y+h-hl,ruch=!st.spokoj&&!st.bezRuchu&&!st.mini;
      const t=tasma(W,hb),off=ruch?((+st.faza||0)*KROK_T*.5)%KROK_T:0;
      c.drawImage(t.cv,-KROK_T+off,yl-hb,W+2*KROK_T,hb);
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.84)),krok=W/n,R=rzad(n),dno=Wd.y+h*1.02;
      for(let i=0;i<n;i++){
        const r=R[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        Motywy.fan(c,b,krok*(i+.5+r.dx),dno,st,"podrzut",i);
      }
      c.drawImage(lada(W,hl).cv,0,yl,W,hl);   // lada na wierzchu: sushi stoi na taśmie, stopy za krawędzią
    }};

  // =========================================================================================== streak
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("su-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};
  const SIATKA=new Map();   // teraz (px) → px na beat, z toru: listewki i talerzyki śladu kotwiczą się w siatce taktu
  const streak={
    glowa(){},
    // Ślad: taśma kaiten. Ciemny brzeg i stalowy pas wzdłuż śladu, w poprzek listewki co ~10 px w siatce taktu (stały
    // odstęp w beatach, więc taśma jedzie razem z nutami); od og 2 na taśmie talerzyki z nigiri i maki (iskra-2/3, na
    // przemian po numerze beatu, więc talerzyk nie zmienia się w drodze), przy og 3 większe. Bez siatki (podgląd w
    // oknie) taśma płynie z zegara. Talerzyki tylko za żabą.
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const og=k.og|0,sz=og>=3?9:og>=2?8:7,G=gradSladu(c,k.x0,k.xT),ts=k.ts||0;
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.strokeStyle=G.a;c.lineWidth=sz+3;c.stroke();
      c.strokeStyle=G.b;c.lineWidth=sz;c.stroke();
      const pxb=SIATKA.get(Math.round(k.xT)),beat=typeof S!=="undefined"&&S&&S.gra&&typeof S.gra.beat==="number"?S.gra.beat:null;
      let kl=10,xl,kt=70,xt,b0;   // odstęp listewek i talerzyków w px, pozycja najbliższa żabie, numer beatu talerzyka
      if(pxb>0&&beat!=null){
        let a=1/16;for(const b of [1/8,1/4])if(Math.abs(b*pxb-10)<Math.abs(a*pxb-10))a=b;
        kl=a*pxb;xl=k.xT-(beat-Math.floor(beat/a)*a)*pxb;
        let d=.5;for(const b of [1,2])if(Math.abs(b*pxb-70)<Math.abs(d*pxb-70))d=b;
        kt=d*pxb;b0=Math.floor(beat/d);xt=k.xT-(beat-b0*d)*pxb;
      }else{const p=ts*36;xl=k.xT-p%kl;xt=k.xT-p%kt;b0=Math.floor(p/kt);}
      if(kl>3){
        c.beginPath();let n=0;
        for(let x=xl;x>=k.x0&&n<90;x-=kl,n++){const y=ySladu(pts,x);if(y==null)continue;c.moveTo(x,y-sz*.42);c.lineTo(x,y+sz*.42);}
        c.lineCap="butt";c.strokeStyle=G.c;c.lineWidth=1.2;c.stroke();
      }
      if(og<2||!jest()||!(kt>12))return;
      const t2=iskra(2,48),t3=iskra(3,48);if(!t2||!t3)return;
      const s=og>=3?26:22;
      for(let x=xt,j=0;x>=k.x0&&j<12;x-=kt,j++){
        if(k.xT-x<s*.9)continue;
        const y=ySladu(pts,x);if(y==null)continue;
        const f=(x-k.x0)/Math.max(1,k.dlug||k.xT-k.x0);if(f<.08)continue;
        c.globalAlpha=Math.min(1,f*2.5);c.drawImage(((b0-j)&1?t3:t2).cv,x-s/2,y-s*.78,s,s);
      }
      c.globalAlpha=1;
    },
    // płonąca nuta: łosoś opalany palnikiem (aburi): zaśpiewana część karmelizuje się, przypalenia z ziarna, złoty
    // połysk u góry; na froncie ikra (iskra-4)
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){
        const d=fx-x0,n=Math.min(6,Math.floor(d/16));
        c.fillStyle="rgba(190,84,26,.45)";c.fillRect(x0,-nh/2,d,nh);
        if(n>0){
          c.fillStyle="rgba(84,34,10,.38)";c.beginPath();
          for(let i=0;i<n;i++){const x=x0+(i+.5)*d/n,y=-nh/2+nh*(.3+.4*los(z,i+3)),rx=Math.min(d/n*.4,nh*(.3+.14*los(z,i+9))),ry=Math.max(1,nh*.13);c.moveTo(x+rx,y);c.ellipse(x,y,rx,ry,-.35,0,TAU);}
          c.fill();
        }
        c.fillStyle="rgba(255,214,150,.5)";c.fillRect(x0,-nh/2,d,Math.max(1,nh*.18));
      }
      if(gas>.05&&jest()){
        const im=iskra(4,48),s=nh*(aktywna?1.5:1.15);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.6,s,s);c.globalAlpha=1;}
      }
    },
    tor(c,L,g,st){
      if(L&&L.pxNaBeat>0)SIATKA.set(Math.round(L.teraz),L.pxNaBeat);
      if(st&&!st.spokoj&&!st.wyniki)podrzuty(c,L,g,st);
    },
    rozgrzej(){if(!jest())return;try{for(let i=0;i<ISKRY;i++)iskra(i,40);iskra(2,48);iskra(3,48);iskra(4,48);}catch(e){}},
    aura:[RYZ,LOSOS],wypelnienie:["#fff6ee","#ffc6a4",LOSOS],
    iskry:{kolory:[RYZ,LOSOS,WASABI],ksztalt:"pasek"},dym:false,
    scena:["255,236,214","242,131,78","215,38,46"],
    tlo:{promienie:[["255,176,120",.08],["215,38,46",.05]],swiatlo:["255,214,160","60,36,18"]}};

  // y śladu w punkcie x (punkty rosną w x); null, gdy żaba tam nie śpiewała
  function ySladu(pts,x){
    const n=pts.length;let lo=0,hi=n-1;if(n<2||x<pts[0].x||x>pts[hi].x)return null;
    while(hi-lo>1){const m=(lo+hi)>>1;if(pts[m].x<=x)lo=m;else hi=m;}
    const a=pts[lo],b=pts[hi];if(!a.sp||!b.sp)return null;
    const t=b.x>a.x?(x-a.x)/(b.x-a.x):0;return a.y+(b.y-a.y)*t;
  }
  const GRAD=new Map();
  function gradSladu(c,x0,xT){
    const kl=Math.round(x0)*16384+Math.round(xT);let g=GRAD.get(kl);if(g)return g;
    if(GRAD.size>24)GRAD.clear();
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(8,10,12,0)");a.addColorStop(.5,"rgba(8,10,12,.55)");a.addColorStop(1,"rgba(8,10,12,.8)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(172,178,188,0)");b.addColorStop(.5,"rgba(172,178,188,.85)");b.addColorStop(1,"rgba(196,202,210,1)");
    const d=c.createLinearGradient(x0,0,xT,0);d.addColorStop(0,"rgba(52,56,64,0)");d.addColorStop(.5,"rgba(52,56,64,.75)");d.addColorStop(1,"rgba(52,56,64,.9)");
    g={a,b,c:d};GRAD.set(kl,g);return g;
  }

  // ---- sushi z ręki mistrza i imbir: pule na gracza, bez alokacji w klatce ----
  // Próg kombo (co 4 nuty od 4) wyrzuca z głowy kawałek sushi (nigiri i maki na zmianę, przy og 3 dwa naraz), który leci
  // łukiem w górę i do tyłu, obracając się jak podrzucony, i spada za żabą; przy pełnym ogniu co trzecie trafienie
  // opada kołysząc się plaster różowego imbiru (iskra-1).
  const PULE=new WeakMap(),MAKS_S=4,MAKS_I=4,ZYCIE_S=1.5;
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,nr:0,ns:0,su:[],im:[]};
    for(let i=0;i<MAKS_S;i++)p.su.push({t:0,x:0,y:0,vx:0,vy:0,r:30,rot:0,wir:0,k:0});
    for(let i=0;i<MAKS_I;i++)p.im.push({z:0,zy:1,x:0,y:0,r:16,fz:0});
    PULE.set(g,p);return p;
  }
  function podrzuty(c,L,g,st){
    if(typeof pozycjaZaby!=="function"||!jest())return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(k>P.k&&k>=4){
      const pz=pozycjaZaby(L,g);
      if(k%4===0){let ile=og>=3?2:1;
        for(const q of P.su){if(ile<=0)break;if(q.t>0)continue;
          q.k=(P.ns++)%2?5:0;q.t=ZYCIE_S;q.x=pz.x-sc*.1;q.y=pz.y-sc*.5;q.vx=-sc*(1.1+.5*Math.random())*(ile===2?1.3:1);
          q.vy=-sc*(3.2+.6*Math.random());q.r=sc*(.5+.04*og);q.rot=(Math.random()-.5)*.6;q.wir=-(5+3*Math.random());ile--;}}
      else if(og>=3&&(P.nr++%3===0)){
        for(const q of P.im){if(q.z>0)continue;
          q.zy=2+.4*Math.random();q.z=q.zy;q.x=pz.x-sc*.2+(Math.random()-.5)*sc*.4;q.y=pz.y-sc*.65;q.r=Math.round(sc*.26);q.fz=Math.random()*TAU;break;}
      }
    }
    P.k=k;
    for(const q of P.su){
      if(q.t<=0)continue;
      q.t-=dt;if(q.t<=0)continue;
      q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=sc*5.2*dt;q.rot+=q.wir*dt;
      const b=iskra(q.k,40);if(!b)continue;
      const f=1-q.t/ZYCIE_S,s=q.r*(f<.12?.6+.4*f/.12:1);
      c.globalAlpha=f<.08?f/.08:q.t<.35?q.t/.35:1;
      c.save();c.translate(q.x,q.y);c.rotate(q.rot);c.drawImage(b.cv,-s/2,-s/2,s,s);c.restore();
    }
    for(const q of P.im){
      if(q.z<=0)continue;
      q.z-=dt;q.y+=dt*sc*.35;q.x+=Math.sin(q.fz+q.z*2.2)*dt*sc*.3-dt*sc*.2;
      if(q.z<=0)continue;
      const b=iskra(1,40);if(!b)continue;
      c.globalAlpha=q.z<.5?q.z/.5:Math.min(1,(q.zy-q.z)/.2);
      c.save();c.translate(q.x,q.y);c.rotate(Math.sin(q.fz+q.z*1.7)*.6);c.drawImage(b.cv,-q.r/2,-q.r/2,q.r,q.r);c.restore();
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Sushi",kolejnosc:15,kolor:"#f07c5a",zasoby:ZASOBY,przebranie:true,
    opis:"Knajpa sushi z filcu: drewniana lada z taśmą, noreny, czerwone lampiony i kot szczęścia, a w widowni tańczą nigiri, maki i onigiri. Nuty to plastry łososia na arkuszu nori, klawisze to bambusowa mata, a przy kombo za żabą jedzie taśma z talerzykami, z głowy wylatują kawałki sushi i sypie się imbir.",
    cechy:{tlo:"knajpa sushi",klawisze:"bambusowa mata",streak:"taśma i nigiri",widownia:"tańczące sushi"},
    en:{nazwa:"Sushi",
      opis:"A felt sushi bar: a wooden counter with a conveyor belt, noren curtains, red paper lanterns and a lucky cat, with nigiri, maki and onigiri dancing in the crowd. Notes are salmon slices on a nori sheet, keys are a bamboo rolling mat, and on a combo a sushi conveyor trails behind you while sushi flies off your head and pickled ginger falls.",
      cechy:{tlo:"sushi bar",klawisze:"bamboo rolling mat",streak:"conveyor belt and nigiri",widownia:"dancing sushi"}},
    karta:{papier:NORI,cien:"rgba(0,8,2,.45)",czarne:"rgba(0,10,4,.22)",liniaC:"rgba(230,240,220,.2)",minione:"rgba(0,10,4,.28)",
      nazwy:"rgba(244,238,224,.82)",kreski:"rgba(230,240,220,.18)",nic:LOSOS,szpilka:LAMPION,szpilkaBlask:"#ffffff",
      cienNuty:"rgba(0,8,2,.45)",scieg:"rgba(247,242,231,.42)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
