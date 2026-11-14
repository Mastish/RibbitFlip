// Motyw „8-bit” (przebudowa 10-09 wieczór): piksele z koralików hama i haftu krzyżykowego na granatowym filcu, jak
// żaba z logo ułożona z koralików. Tło = haftowany świat platformówki (tlo.webp), karta toru = granatowa szyba z delikatną
// siatką koralików na stelażu, nuty = rzędy żółtych koralików z dziurką (sprite koralika raz na wysokość taśmy, wzór),
// klawiatura z białych i granatowych koralików. Widownia: sześć żab z koralików z fan-*.webp podskakuje w rytm. Streak:
// tęczowy wianek koralików krąży za głową żaby, ślad to sznurek koralików (kreska z okrągłymi końcami i dziurki),
// a z głowy wyskakują naszywki z iskra-*.webp (moneta, gwiazda, serce, płomień, grzybek, iskra).
(function(){
  "use strict";
  const ID="8bit",PI=Math.PI,TAU=2*PI;
  const GRANAT="#121735",GRANAT_C="#0a0d24",BIA="#f6f4ee",ZOL="#ffd040",ZOL_C="#c98f12",NIE="#5b8cff",ROZ="#ff5fa8",ZIE="#5ccf4a",POM="#ff8a3c";
  const TECZA=[ZOL,ROZ,NIE,ZIE,POM,"#b88cff"];
  const los=(a,b)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v);};   // 0..1, powtarzalne
  const ulamek=x=>x-Math.floor(x);
  const BRAK=[];
  const zasob=p=>Motywy.zasob(ID,p);
  const ZASOBY=["tlo.webp","zaba-0.webp","zaba-1.webp"];
  for(let i=0;i<6;i++)ZASOBY.push("fan-"+i+".webp","iskra-"+i+".webp");
  const dpr=()=>(typeof R!=="undefined"&&R&&R.dpr)||1;

  // Koralik hama w okręgu o promieniu r (środek x,y): krawędź w cieniu, połysk u góry, dziurka w środku.
  function koralik(c,x,y,r,kol,ciemny){
    c.fillStyle=ciemny;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();
    c.fillStyle=kol;c.beginPath();c.arc(x-r*.08,y-r*.1,r*.86,0,TAU);c.fill();
    c.fillStyle="rgba(255,255,255,.45)";c.beginPath();c.ellipse(x-r*.4,y-r*.45,r*.3,r*.18,-.6,0,TAU);c.fill();
    c.fillStyle="rgba(10,13,36,.8)";c.beginPath();c.arc(x,y,r*.32,0,TAU);c.fill();
  }
  // Sprite koralika (rozmiar css d, dpr wbudowany) raz na kolor i rozmiar.
  const SPR=new Map();
  function spriteKoralika(kol,ciemny,d){
    const D=Math.max(4,Math.round(d*dpr())),k=kol+"|"+D;let cv=SPR.get(k);if(cv)return cv;
    cv=document.createElement("canvas");cv.width=cv.height=D;
    koralik(cv.getContext("2d"),D/2,D/2,D/2-.5,kol,ciemny);SPR.set(k,cv);return cv;
  }

  // ---- tło: ilustracja na cały ekran + granatowa winieta ----
  let WIN=null;
  function rysujTlo(c,st){
    const W=st.W,H=st.H;
    if(!Motywy.cover(c,zasob("tlo.webp"),0,0,W,H,.5,.6)){c.fillStyle="#141a36";c.fillRect(0,0,W,H);}
    if(!WIN||WIN.W!==W||WIN.H!==H){
      const g=c.createRadialGradient(W/2,H*.45,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.62);
      g.addColorStop(0,"rgba(6,8,24,0)");g.addColorStop(1,"rgba(6,8,24,.4)");WIN={W,H,g};
    }
    c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
  }

  // ---- karta: granatowa szyba z delikatną siatką pustych koralików (stelaż do prasowania) ----
  let KAFEL=null;
  function kafelStelaza(){
    if(KAFEL)return KAFEL;
    const S=14;KAFEL=document.createElement("canvas");KAFEL.width=KAFEL.height=S;const c=KAFEL.getContext("2d");
    c.strokeStyle="rgba(150,175,255,.11)";c.lineWidth=1.2;c.beginPath();c.arc(S/2,S/2,4.2,0,TAU);c.stroke();
    c.fillStyle="rgba(150,175,255,.08)";c.beginPath();c.arc(S/2,S/2,1.4,0,TAU);c.fill();
    return KAFEL;
  }
  function rysujKarte(c,L){
    c.fillStyle=c.createPattern(kafelStelaza(),"repeat");c.fillRect(L.x,L.y,L.w,L.h);
    c.strokeStyle="rgba(4,6,20,.45)";c.lineWidth=6;c.beginPath();c.roundRect(L.x,L.y,L.w,L.h,16);c.stroke();
  }

  // ---- nuty: rząd żółtych koralików z dziurką nad paskiem partii (wzór z kafla koralika, raz na wysokość) ----
  const WZORY=new Map();
  function wzorKoralikow(c,nh){
    const d=dpr(),k=Math.round(nh*4)*8+d;let w=WZORY.get(k);if(w)return w;
    const r=nh*.45,tw=Math.max(4,Math.round(nh*.94*d)),th=Math.max(4,Math.round(nh*d));
    const cv=document.createElement("canvas");cv.width=tw;cv.height=th;
    koralik(cv.getContext("2d"),tw/2,nh*.47*d,r*d,ZOL,ZOL_C);
    w=c.createPattern(cv,"repeat");
    if(w&&w.setTransform&&typeof DOMMatrix!=="undefined")w.setTransform(new DOMMatrix([1/d,0,0,1/d,0,0]));
    WZORY.set(k,w);return w;
  }
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2;
      c.fillStyle="#7a560f";c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.save();c.translate(x0+((o.ziarno|0)%2)*nh*.2,y0);c.fillStyle=wzorKoralikow(c,nh);c.fillRect(-nh,0,w+2*nh,nh);c.restore();
    },
    brzeg:()=>GRANAT_C,zapas:()=>0};

  // ---- klawiatura: rzędy białych koralików, czarne klawisze z granatowych; wszystko jednym wypełnieniem na kolor ----
  function klawiatura(c,L){
    const x=L.kx,y0=L.gorna,w=L.kw,h=L.rzedy*L.rh;
    c.fillStyle="rgba(0,0,0,.45)";c.beginPath();c.roundRect(x+2,y0+3,w,h,4);c.fill();
    c.fillStyle="#cfcbe2";c.beginPath();c.roundRect(x,y0,w,h,4);c.fill();
    const r=Math.max(1.6,Math.min(L.rh*.46,w/4.4)),ile=Math.max(1,Math.floor((w-2)/(2*r+.6))),dx=(w-ile*2*r)/(ile+1);
    // koła wszystkich koralików danego rodzaju (czarny: krótszy rząd) w jednej ścieżce, z przesunięciem i promieniem
    const kolka=(czarny,rr,ox,oy)=>{c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(czarny!==null&&isBlack(s)!==czarny)continue;
        const k=prostokatKlawisza(L,s),cy=k.y+k.h/2+oy,n=isBlack(s)?Math.max(1,Math.round(ile*.62)):ile;
        for(let j=0;j<n;j++){const cx=x+dx+r+j*(2*r+dx)+ox;c.moveTo(cx+rr,cy);c.arc(cx,cy,rr,0,TAU);}}};
    for(const [czarny,kol,cien] of [[false,BIA,"#a9a4c4"],[true,"#2a3170",GRANAT_C]]){
      kolka(czarny,r,0,0);c.fillStyle=cien;c.fill();
      kolka(czarny,r*.84,-r*.08,-r*.1);c.fillStyle=kol;c.fill();
    }
    kolka(null,r*.3,0,0);c.fillStyle="rgba(10,13,36,.7)";c.fill();
    c.strokeStyle=GRANAT_C;c.lineWidth=1.4;c.beginPath();c.roundRect(x,y0,w,h,4);c.stroke();
  }
  const KRESKA_KL=[2,2];
  function klawiszGracza(c,L,g){
    if(!g.spiewa)return;
    const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),k=prostokatKlawisza(L,s);
    c.strokeStyle=g.naNucie?ZOL:BIA;c.lineWidth=2;c.setLineDash(KRESKA_KL);
    c.strokeRect(k.x-1,k.y,k.w+2,k.h);c.setLineDash(BRAK);
  }

  // ---- widownia: żaby z koralików z fan-*.webp, bez sąsiadów-bliźniaków, lustra, skok w rytm ----
  const CROP=[null,null,[11,246],null,null,null];   // fan-2 ma na lewym brzegu skrawek sąsiedniej postaci
  function fan(k,lustro,fh){
    const im=zasob("fan-"+k+".webp");if(!im)return null;
    const cr=CROP[k]||[0,im.naturalWidth],sw=cr[1]-cr[0],fw=Math.max(1,Math.round(fh*sw/im.naturalHeight));
    return bufor(ID+"-fan|"+k+"|"+(lustro?1:0)+"|"+fh,fw,fh,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(fw,0);c.scale(-1,1);}
      c.drawImage(im,cr[0],0,sw,im.naturalHeight,0,0,fw,fh);
    });
  }
  let KOLEJ=null;
  function kolejnosc(n){
    if(KOLEJ&&KOLEJ.length===n)return KOLEJ;
    const a=[];let p1=-1,p2=-1;
    for(let i=0;i<n;i++){
      let k=Math.floor(los(i,17)*6);for(let t=0;t<6&&(k===p1||k===p2);t++)k=(k+1)%6;
      a.push({k,lustro:los(i,18)<.5,sk:.88+.2*los(i,19),fa:los(i,20),dx:(los(i,21)-.5)*.3});p2=p1;p1=k;
    }
    KOLEJ=a;return a;
  }
  function rysujWidownie(c,Wd,st){
    const W=st.W,h=Wd.h*1.1,n=Math.max(3,Motywy.ileFanow(ID,W,h,.8)),q=kolejnosc(n),krok=W/n;
    const ruch=!st.bezRuchu&&!st.spokoj&&!st.mini,zywe=st.spiewaja||st.zar>.05||st.ap>.12;
    const amp=ruch?h*((zywe?.05+.035*Math.min(3,st.zar||0):.012)+.16*(st.skok||0)):0;
    for(let i=0;i<n;i++){
      const s=q[i],fh=Math.round(h*s.sk),b=fan(s.k,s.lustro,fh);if(!b)continue;
      // skok „schodkowy” co 1/4 wysokości jak w starych grach: |sin| zaokrąglony do czterech pięter
      const dy=amp?Math.round(4*amp*Math.abs(Math.sin(PI*(st.faza+s.fa))))/4:0;
      Motywy.fan(c,b,krok*(i+.5+s.dx),Wd.y+Wd.h+fh*.12,st,"poklatkowo",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
    }
  }

  // ---- streak: tęczowy wianek koralików za głową, sznurek koralików jako ślad, naszywki z iskra-*.webp ----
  function iskra(k){
    const im=zasob("iskra-"+k+".webp");if(!im)return null;
    return bufor(ID+"-isk|"+k,44,44,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,44,44);});
  }
  const kor=(k)=>bufor(ID+"-kor|"+k,24,24,c=>koralik(c,12,12,11,TECZA[k],"rgba(10,13,36,.85)"));
  const GR=new Map();
  function gradSladu(c,x0,xT){
    const kl=Math.round(x0)*16384+Math.round(xT);let g=GR.get(kl);if(g)return g;
    if(GR.size>24)GR.clear();
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(255,208,64,0)");a.addColorStop(.7,"rgba(255,208,64,.9)");a.addColorStop(1,"rgba(255,208,64,1)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(255,95,168,0)");b.addColorStop(.7,"rgba(255,95,168,.9)");b.addColorStop(1,"rgba(255,95,168,1)");
    const d=c.createLinearGradient(x0,0,xT,0);d.addColorStop(0,"rgba(10,13,36,0)");d.addColorStop(.7,"rgba(10,13,36,.7)");d.addColorStop(1,"rgba(10,13,36,.8)");
    g={a,b,d};GR.set(kl,g);return g;
  }
  const KROPKI=new Map();   // kreska „same kropki”: [~0, odstęp]; okrągłe końce dają koraliki
  const kropki=o=>{const k=Math.round(o*2);let a=KROPKI.get(k);if(!a){a=[.01,k/2];KROPKI.set(k,a);}return a;};
  const streak={
    // wianek: koraliki w kolorach tęczy krążą za głową (promień pulsuje w rytm), z góry wyskakują naszywki
    glowa(c,sc,og,ts,z,przod){
      if(przod)return;
      const n=og>=3?10:7,R0=sc*(.42+.04*og)*(1+.05*Math.sin(ts*PI*2)),s=sc*(og>=3?.17:.15),cy=-sc*.5,obr=ts*1.4+z;
      for(let j=0;j<n;j++){
        const a=obr+j*TAU/n;if(Math.sin(a)>.55)continue;   // dolny łuk chowa się za ciałem
        c.drawImage(kor(j%6).cv,Math.cos(a)*R0*1.12-s/2,cy+Math.sin(a)*R0*.8-s/2,s,s);
      }
      const m=og>=3?8:5;
      for(let j=0;j<m;j++){
        const u=ts*.6+j/m+z*.17,ph=ulamek(u),b=iskra((j*5+Math.floor(u))%6);if(!b)continue;
        const kier=j%3===0?-.45:1,sk=sc*(.2+.04*og)*(1-.3*ph);
        // tor „z bloku”: szybki skok w górę i opadanie po paraboli, pozycja w siatce 2 px
        const x=-kier*sc*(.15+.85*ph),y=-sc*(.55+2.1*ph-1.1*ph*ph);
        c.globalAlpha=ph<.08?ph/.08:Math.max(0,1-Math.pow((ph-.08)/.92,2));
        c.drawImage(b.cv,Math.round((x-sk/2)/2)*2,Math.round((y-sk/2)/2)*2,sk,sk);
      }
      c.globalAlpha=1;
    },
    // ślad: sznurek koralików (żółte i różowe na zmianę, z dziurkami) wzdłuż śpiewanej linii
    slad(c,k){
      const g=gradSladu(c,k.x0,k.xT),D=k.og>=3?9:k.og>=2?7.5:6,od=D*1.15;
      c.beginPath();let pi=false;
      for(const p of k.pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.lineCap="round";c.lineJoin="round";
      const kr=kropki(od*2);
      c.setLineDash(kr);c.lineWidth=D;
      c.lineDashOffset=0;c.strokeStyle=g.a;c.stroke();
      c.lineDashOffset=od;c.strokeStyle=g.b;c.stroke();
      c.lineDashOffset=0;c.lineWidth=D*.34;c.strokeStyle=g.d;c.setLineDash(kropki(od));c.stroke();
      c.setLineDash(BRAK);c.lineDashOffset=0;
    },
    // płonąca nuta: koraliki na przejechanej części jaśnieją, na froncie błyszczy iskra
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(255,246,200,.3)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas>.05&&fx>x0+nh){const b=iskra(5);if(b){const s=nh*(1.3+.25*Math.sin(ts*8+z));
        c.globalAlpha=Math.min(1,gas);c.drawImage(b.cv,Math.round(fx-s/2),Math.round(-nh/2-s*.7),s,s);c.globalAlpha=1;}}
    },
    rozgrzej(){for(let k=0;k<6;k++){iskra(k);kor(k);}},
    aura:[NIE,ZOL],wypelnienie:["#fff6c8",ZOL,POM],scena:["91,140,255","255,208,64","91,140,255"],
    iskry:{kolory:[ZOL,ROZ,NIE]},dym:false,
    tlo:{promienie:[["91,140,255",.22],["255,208,64",.16]],swiatlo:["255,216,120","91,140,255"]}};

  Motywy.dodaj({id:"8bit",nazwa:"8-bit",kolejnosc:2,kolor:"#5b8cff",zaba:true,przebranie:true,zasoby:ZASOBY,
    opis:"Platformówka z koralików i haftu krzyżykowego na granatowym filcu: nuty jak rzędy koralików, żaby z koralików na widowni, a przy kombo wianek koralików i wyskakujące monety, gwiazdki i serca.",
    cechy:{tlo:"haftowana platformówka",klawisze:"klawisze z koralików",streak:"wianek koralików",widownia:"żaby z koralików"},
    en:{nazwa:"8-bit",
      opis:"A platformer made of beads and cross-stitch on navy felt: notes like rows of beads, bead frogs in the crowd, and on a combo a ring of beads with coins, stars and hearts popping out.",
      cechy:{tlo:"cross-stitched platformer",klawisze:"bead keys",streak:"ring of beads",widownia:"bead frogs"}},
    karta:{papier:GRANAT,cien:"rgba(0,0,0,.5)",czarne:"rgba(0,0,0,.2)",liniaC:"rgba(130,160,255,.28)",minione:"rgba(0,0,0,.24)",
      nazwy:"rgba(214,226,255,.82)",kreski:"rgba(130,160,255,.24)",nic:ZOL,szpilka:BIA,szpilkaBlask:NIE,
      cienNuty:"rgba(0,0,0,.5)",scieg:"rgba(120,150,255,.5)",rysuj:rysujKarte},
    tlo:{rysuj2d:rysujTlo,przeswit:.3,rama:{bok:.06,gora:10,dol:6,odstep:10},tlo:streak.tlo},
    klawisze:{tlo(c,L){klawiatura(c,L);},gracz:klawiszGracza},
    nuty,
    streak,
    widownia:{rysuj:rysujWidownie}});
})();
