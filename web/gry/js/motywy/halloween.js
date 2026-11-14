// Motyw „Halloween” (przebudowa 10-09 wieczór): przytulny, nie straszny. Fioletowy filc, pomarańczowe dynie, pajęczyny
// z włóczki: tło = filcowa chatka, latarnie i dynie pod księżycem (tlo.webp), karta toru = fioletowa szyba z włóknami filcu,
// nuty = paski pomarańczowego filcu z kremowym ściegiem, klawiatura z kremowego i śliwkowego filcu z pomarańczową nicią.
// Widownia: sześć przebranych żab z fan-*.webp (dynia, duszek, wampir, czarownica, nietoperz, mumia) podskakuje w rytm.
// Streak: zielony „duchowy” płomyk z filcu za głową żaby, ślad to zielona włóczka ze ściegiem, a z głowy wylatują
// naszywki z iskra-*.webp (duszkowy płomyk, nietoperz, cukierek, duszek, pestka, świeczka).
(function(){
  "use strict";
  const ID="halloween",PI=Math.PI,TAU=2*PI;
  const FIOL="#2a1842",FIOL_C="#170c26",DYNIA="#f07a1e",DYNIA_C="#7a330a",KREM="#ffe6c2",EKTO="#9ed65a",EKTO_J="#e4f7c6",EKTO_C="#3f6e1e",TUSZ="#1d1230";
  const los=(a,b)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v);};   // 0..1, powtarzalne
  const ulamek=x=>x-Math.floor(x);
  const BRAK=[];
  const zasob=p=>Motywy.zasob(ID,p);
  const ZASOBY=["tlo.webp","zaba-0.webp","zaba-1.webp"];
  for(let i=0;i<6;i++)ZASOBY.push("fan-"+i+".webp","iskra-"+i+".webp");

  // ---- kafel włókien filcu (jak w motywie Filc): włoski w dwóch tonach, zawinięte na brzegach ----
  const KAF=new Map();
  function kafelWlokien(klucz,jasne,ciemne,n){
    let cv=KAF.get(klucz);if(cv)return cv;
    const R0=128;cv=document.createElement("canvas");cv.width=cv.height=R0;const c=cv.getContext("2d");
    c.lineCap="round";
    for(const [kol,off,gr] of [[ciemne,0,.7],[jasne,1,.6],[ciemne,2,1.1]]){
      c.strokeStyle=kol;c.lineWidth=gr;c.beginPath();
      for(let i=off;i<n;i+=3){
        const x=los(i,1)*R0,y=los(i,2)*R0,a=los(i,3)*TAU,l=2+los(i,4)*(off===2?3:6),dx=Math.cos(a)*l,dy=Math.sin(a)*l;
        for(const ox of [0,-R0])for(const oy of [0,-R0]){c.moveTo(x+ox,y+oy);c.quadraticCurveTo(x+ox+dx*.5+dy*.2,y+oy+dy*.5-dx*.2,x+ox+dx,y+oy+dy);}
      }
      c.stroke();
    }
    KAF.set(klucz,cv);return cv;
  }
  const kafelKarty=()=>kafelWlokien("hw-karta","rgba(190,150,255,.16)","rgba(0,0,0,.18)",1200);
  const kafelNuty=()=>kafelWlokien("hw-nuta","rgba(255,220,170,.3)","rgba(90,30,0,.22)",700);
  const kafelKlaw=()=>kafelWlokien("hw-klaw","rgba(255,255,255,.35)","rgba(120,80,40,.12)",900);
  let WZOR_NUTY=null;
  const wzorNuty=c=>WZOR_NUTY||(WZOR_NUTY=c.createPattern(kafelNuty(),"repeat"));
  const KRESKI=new Map();
  function kreska(d){const k=Math.round(d*2);let a=KRESKI.get(k);if(!a){a=[Math.max(2,k*.9),Math.max(1.5,k*.55)];KRESKI.set(k,a);}return a;}

  // ---- tło: ilustracja na cały ekran + fioletowa winieta ----
  let WIN=null;
  function rysujTlo(c,st){
    const W=st.W,H=st.H;
    if(!Motywy.cover(c,zasob("tlo.webp"),0,0,W,H,.5,.65)){c.fillStyle="#2b1844";c.fillRect(0,0,W,H);}
    if(!WIN||WIN.W!==W||WIN.H!==H){
      const g=c.createRadialGradient(W/2,H*.45,Math.min(W,H)*.35,W/2,H*.5,Math.hypot(W,H)*.62);
      g.addColorStop(0,"rgba(14,6,24,0)");g.addColorStop(1,"rgba(14,6,24,.38)");WIN={W,H,g};
    }
    c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
  }

  // ---- karta: fioletowa szyba z włóknami filcu i ciemniejszym rąbkiem ----
  function rysujKarte(c,L){
    c.fillStyle=c.createPattern(kafelKarty(),"repeat");c.fillRect(L.x,L.y,L.w,L.h);
    c.strokeStyle="rgba(10,4,20,.4)";c.lineWidth=6;c.beginPath();c.roundRect(L.x,L.y,L.w,L.h,16);c.stroke();
  }

  // ---- nuty: pasek pomarańczowego filcu z kremowym ściegiem wzdłuż górnej krawędzi ----
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2;
      c.fillStyle=DYNIA;c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=wzorNuty(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(w<nh*1.2)return;
      const m=Math.max(2.5,nh*.24);
      c.strokeStyle=KREM;c.lineWidth=Math.max(1,nh*.09);c.setLineDash(kreska(Math.max(2,nh*.22)));
      c.lineDashOffset=(o.ziarno|0)%3;
      c.beginPath();c.moveTo(x0+m,y0+m);c.lineTo(-x0-m,y0+m);c.stroke();
      c.setLineDash(BRAK);c.lineDashOffset=0;
    },
    brzeg:()=>DYNIA_C,zapas:()=>0};

  // ---- klawiatura: kremowy filc, czarne klawisze ze śliwkowego filcu, pomarańczowa nić wokół ----
  function klawiatura(c,L){
    const x=L.kx,y0=L.gorna,w=L.kw,h=L.rzedy*L.rh;
    c.fillStyle="rgba(0,0,0,.4)";c.beginPath();c.roundRect(x+2,y0+3,w,h,5);c.fill();
    c.beginPath();c.roundRect(x,y0,w,h,5);c.fillStyle="#efe0c4";c.fill();
    c.fillStyle=c.createPattern(kafelKlaw(),"repeat");c.fill();
    c.fillStyle="rgba(90,50,30,.3)";
    for(let s=L.dolN;s<=L.goraN;s++){
      if(isBlack(s))continue;
      const pc=((s%12)+12)%12;
      if(isBlack(s+1)||pc===4||pc===11){const k=prostokatKlawisza(L,s);c.fillRect(x+2,Math.round(k.y)-.5,w-4,1);}
    }
    c.fillStyle="#3a1f52";c.beginPath();
    for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.8,k.w*.62,Math.max(1,k.h-1.6),[0,3,3,0]);}
    c.fill();
    c.strokeStyle=DYNIA;c.lineWidth=1.3;c.setLineDash([3.5,2.5]);
    c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,3);c.stroke();c.setLineDash(BRAK);
    c.strokeStyle=FIOL_C;c.lineWidth=1.2;c.beginPath();c.roundRect(x,y0,w,h,5);c.stroke();
  }
  const SCIEG_KL=[3,2.5];
  function klawiszGracza(c,L,g){
    if(!g.spiewa)return;
    const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),k=prostokatKlawisza(L,s);
    c.strokeStyle=g.naNucie?DYNIA:"rgba(240,122,30,.55)";c.lineWidth=1.5;c.setLineDash(SCIEG_KL);
    c.strokeRect(k.x+2.5,k.y+1.5,k.w-5,Math.max(1,k.h-3));c.setLineDash(BRAK);
  }

  // ---- widownia: przebrane żaby z fan-*.webp, bez sąsiadów-bliźniaków, lustra, skok w rytm ----
  // fan-4 (nietoperz) ma na brzegach skrawki sąsiednich postaci z arkusza: lewy przycięty, prawy górny róg wymazany
  const CROP=[null,null,null,null,[12,270,[240,0,270,135]],null];
  function fan(k,lustro,fh){
    const im=zasob("fan-"+k+".webp");if(!im)return null;
    const cr=CROP[k]||[0,im.naturalWidth],sw=cr[1]-cr[0],fw=Math.max(1,Math.round(fh*sw/im.naturalHeight));
    return bufor(ID+"-fan|"+k+"|"+(lustro?1:0)+"|"+fh,fw,fh,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(fw,0);c.scale(-1,1);}
      c.drawImage(im,cr[0],0,sw,im.naturalHeight,0,0,fw,fh);
      const e=cr[2],k=fh/im.naturalHeight;if(e)c.clearRect((e[0]-cr[0])*k,e[1]*k,(e[2]-e[0])*k,(e[3]-e[1])*k);
    });
  }
  let KOLEJ=null;
  function kolejnosc(n){
    if(KOLEJ&&KOLEJ.length===n)return KOLEJ;
    const a=[];let p1=-1,p2=-1;
    for(let i=0;i<n;i++){
      let k=Math.floor(los(i,27)*6);for(let t=0;t<6&&(k===p1||k===p2);t++)k=(k+1)%6;
      a.push({k,lustro:los(i,28)<.5,sk:.88+.2*los(i,29),fa:los(i,30),dx:(los(i,31)-.5)*.3});p2=p1;p1=k;
    }
    KOLEJ=a;return a;
  }
  function rysujWidownie(c,Wd,st){
    const W=st.W,h=Wd.h*1.1,n=Math.max(3,Motywy.ileFanow(ID,W,h,.8)),q=kolejnosc(n),krok=W/n;
    const ruch=!st.bezRuchu&&!st.spokoj&&!st.mini,zywe=st.spiewaja||st.zar>.05||st.ap>.12;
    const amp=ruch?h*((zywe?.05+.035*Math.min(3,st.zar||0):.012)+.16*(st.skok||0)):0;
    for(let i=0;i<n;i++){
      const s=q[i],fh=Math.round(h*s.sk),b=fan(s.k,s.lustro,fh);if(!b)continue;
      const dy=amp?amp*Math.abs(Math.sin(PI*(st.faza+s.fa))):0;
      Motywy.fan(c,b,krok*(i+.5+s.dx),Wd.y+Wd.h+fh*.12,st,"upior",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
    }
  }

  // ---- streak: zielony duchowy płomyk z filcu, włóczka ze ściegiem, naszywki z iskra-*.webp ----
  const KSZT=[[0,.03],[.62,-.04],[.7,-.36],[.4,-.56],[.72,-.84],[.2,-.7],[.06,-1.08],[-.2,-.64],[-.6,-.76],[-.46,-.44],[-.7,-.24],[-.56,-.02]];
  function sciezkaPlomyka(c,cx,yb,w,h,lustro){
    const a=w/2*(lustro?-1:1),n=KSZT.length,X=i=>cx+KSZT[i%n][0]*a,Y=i=>yb+KSZT[i%n][1]*h;
    c.beginPath();c.moveTo((X(n-1)+X(0))/2,(Y(n-1)+Y(0))/2);
    for(let i=0;i<n;i++)c.quadraticCurveTo(X(i),Y(i),(X(i)+X(i+1))/2,(Y(i)+Y(i+1))/2);
    c.closePath();
  }
  // Płomyk 72×96: śliwkowy podkład naszywki, zielony filc, jasny środek, ciemniejszy ścieg, dwoje oczek (duszek, nie potwór).
  function rysujPlomyk(c,v){
    const l=v===1,sz=v===2?.86:1;
    c.lineJoin="round";
    sciezkaPlomyka(c,36,92,62*sz,88,l);c.strokeStyle=TUSZ;c.lineWidth=5;c.stroke();c.fillStyle=EKTO;c.fill();
    c.save();c.clip();c.fillStyle=c.createPattern(kafelNuty(),"repeat");c.globalAlpha=.6;c.fillRect(0,0,72,96);c.restore();
    sciezkaPlomyka(c,36,86,30*sz,46,!l);c.fillStyle=EKTO_J;c.fill();
    sciezkaPlomyka(c,36,88,50*sz,74,l);c.strokeStyle=EKTO_C;c.lineWidth=1.6;c.setLineDash([4,3]);c.stroke();c.setLineDash(BRAK);
    if(v===0){c.fillStyle=TUSZ;c.beginPath();c.ellipse(30,70,3,4,0,0,TAU);c.ellipse(42,70,3,4,0,0,TAU);c.fill();}
  }
  const plomyk=v=>bufor(ID+"-plom|"+v,72,96,c=>rysujPlomyk(c,v));
  // iskra-0 i iskra-2 mają skrawki skrzydła nietoperza z sąsiedniej naszywki: przycięte
  const CROP_ISK=[[0,70],null,[30,96],null,null,null];
  function iskra(k){
    const im=zasob("iskra-"+k+".webp");if(!im)return null;
    const cr=CROP_ISK[k];
    return bufor(ID+"-isk|"+k,44,44,c=>{c.imageSmoothingQuality="high";
      if(cr){const sw=cr[1]-cr[0],dw=44*sw/96;c.drawImage(im,cr[0],0,sw,96,(44-dw)/2,0,dw,44);}else c.drawImage(im,0,0,44,44);});
  }
  const GR=new Map();
  function gradSladu(c,x0,xT){
    const kl=Math.round(x0)*16384+Math.round(xT);let g=GR.get(kl);if(g)return g;
    if(GR.size>24)GR.clear();
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(158,214,90,0)");a.addColorStop(.75,"rgba(158,214,90,.85)");a.addColorStop(1,"rgba(158,214,90,.95)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(63,110,30,0)");b.addColorStop(.75,"rgba(63,110,30,.9)");b.addColorStop(1,"rgba(63,110,30,1)");
    g={a,b};GR.set(kl,g);return g;
  }
  const SCIEG_SLADU=[5,4];
  const streak={
    // za głową: duży duchowy płomyk z oczkami i dwa mniejsze, kołyszą się; z nich wylatują naszywki (≤ 9 naraz)
    glowa(c,sc,og,ts,z,przod){
      if(przod)return;
      for(const j of [0,2,1]){
        const b=plomyk(j===1?0:j===0?1:2),s=sc*(j===1?.66:.42)*(.86+.07*og),f=1+.08*Math.sin(ts*5.1+j*2.1+z);
        const hh=s*f,ww=s*.75/f,sw=Math.sin(ts*2.2+j)*sc*.03;
        c.drawImage(b.cv,(j-1)*sc*.27-ww/2+sw,-sc*(j===1?.42:.36)-hh,ww,hh);
      }
      const n=og>=3?9:5;
      for(let j=0;j<n;j++){
        const u=ts*.5+j/n+z*.17,ph=ulamek(u),b=iskra((j*5+Math.floor(u))%6);if(!b)continue;
        const kier=j%3===0?-.45:1,s=sc*(.21+.04*og)*(1-.3*ph);
        // unoszą się falując jak duszki
        const x=-kier*sc*(.12+.85*ph)+Math.sin(ts*2.6+j*1.9)*sc*.12,y=-sc*(.5+1.3*ph);
        c.globalAlpha=ph<.1?ph*10:Math.max(0,1-Math.pow((ph-.1)/.9,1.6));
        c.drawImage(b.cv,x-s/2,y-s/2,s,s);
      }
      c.globalAlpha=1;
    },
    // ślad: zielona włóczka z ciemniejszym ściegiem, przy ogniu ≥ 2 małe duchowe płomyki na świeżym końcu
    slad(c,k){
      const g=gradSladu(c,k.x0,k.xT);
      c.beginPath();let pi=false;
      for(const p of k.pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.lineCap="round";c.lineJoin="round";
      c.strokeStyle=g.a;c.lineWidth=k.og>=3?10:k.og>=2?8:6;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=1.4;c.setLineDash(SCIEG_SLADU);c.stroke();c.setLineDash(BRAK);
      if(!k.pelna||k.og<2)return;
      let ost=-1e9,nr=0;const krok=k.og>=3?24:32;
      for(const p of k.pts){
        if(!p.sp||p.x-ost<krok||p.x<k.x0)continue;ost=p.x;
        const f=(p.x-k.x0)/k.dlug;if(f<.4||f>.94)continue;
        if(++nr>8)break;
        const b=plomyk(1+nr%2),hh=(k.og>=3?22:16)*f*(.8+.2*Math.sin(k.ts*6+nr*1.7)),ww=hh*.75;
        c.drawImage(b.cv,p.x-ww/2,p.y-hh+3,ww,hh);
      }
    },
    // płonąca nuta: zielona poświata na przejechanej części, mały duchowy płomyk na froncie
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(158,214,90,.3)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas>.05&&fx>x0+nh){
        const b=plomyk(1+z%2),hh=nh*(1.3+.4*(poziom||1)/3)*(.9+.1*Math.sin(ts*7+z)),ww=hh*.75;
        c.globalAlpha=Math.min(1,gas);c.drawImage(b.cv,fx-ww/2,-nh/2-hh*.75,ww,hh);c.globalAlpha=1;
      }
    },
    rozgrzej(){for(let v=0;v<3;v++)plomyk(v);for(let k=0;k<6;k++)iskra(k);},
    aura:[EKTO,DYNIA],wypelnienie:[EKTO_J,EKTO,EKTO_C],scena:["158,214,90","240,122,30","110,70,170"],
    iskry:{kolory:[EKTO,DYNIA,EKTO_C]},dym:false,
    tlo:{promienie:[["240,122,30",.2],["158,214,90",.12]],swiatlo:["255,180,90","142,111,230"]}};

  Motywy.dodaj({id:"halloween",nazwa:"Halloween",kolejnosc:3,kolor:"#f07a1e",zaba:true,przebranie:true,zasoby:ZASOBY,
    opis:"Przytulne Halloween z filcu: fioletowa noc, chatka z latarniami i dynie, nuty z pomarańczowego filcu, przebrane żaby na widowni i zielony duchowy płomyk przy kombo.",
    cechy:{tlo:"filcowa noc z dyniami",klawisze:"filc i pomarańczowa nić",streak:"duchowy płomyk",widownia:"przebrane żaby"},
    en:{nazwa:"Halloween",
      opis:"A cosy felt Halloween: a purple night, a cottage with lanterns and pumpkins, notes of orange felt, frogs in costumes in the crowd and a green ghostly flame on a combo.",
      cechy:{tlo:"felt night with pumpkins",klawisze:"felt and orange thread",streak:"ghostly flame",widownia:"frogs in costumes"}},
    karta:{papier:FIOL,cien:"rgba(0,0,0,.45)",czarne:"rgba(0,0,0,.2)",liniaC:"rgba(240,122,30,.3)",minione:"rgba(8,4,18,.28)",
      nazwy:"rgba(255,226,196,.78)",kreski:"rgba(200,170,255,.22)",nic:DYNIA,szpilka:DYNIA,szpilkaBlask:KREM,
      cienNuty:"rgba(0,0,0,.45)",scieg:"rgba(240,122,30,.6)",rysuj:rysujKarte},
    tlo:{rysuj2d:rysujTlo,przeswit:.28,rama:{bok:.07,gora:10,dol:6,odstep:10},tlo:streak.tlo},
    klawisze:{tlo(c,L){klawiatura(c,L);},gracz:klawiszGracza},
    nuty,
    streak,
    widownia:{rysuj:rysujWidownie}});
})();
