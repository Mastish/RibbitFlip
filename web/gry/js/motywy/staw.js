// Motyw „Staw nocą” (runda 3, 10-10): magiczna, spokojna noc nad stawem z filcu. Tło to ilustracja (tlo.webp: księżyc
// z filcu, świetliki, lilie wodne i pałki), karta toru to ciemna granatowo-turkusowa szyba z fakturą filcu
// (faktura.webp, ledwo widoczne przeszyte kręgi) i chłodną łuną księżyca od góry. Nuty: paski limonkowego filcu jak
// łodygi, z cieniem walca i kremowym ściegiem. Klawiatura: filc w kolorze wody, białe klawisze to jasne kamyki,
// czarne z granatowego filcu. Widownia: sześciu fanów (fan-*.webp) stoi na liściach lilii i kołysze się jak na wodzie.
// Streak (detal PODPISOWY): świetliki (iskra-0) krążą za głową żaby w ciepłej poświacie wokół przeszytej aureoli,
// przy każdym trafieniu z głowy rozchodzą się po wodzie przeszyte kręgi (na progu kombo podwójne), z głowy wypływają
// drobiazgi stawu (iskra-1..5), a za żabą ciągnie się łodyga z filcowymi liśćmi. Wszystko z buforów, w klatce
// drawImage i kilka obrysów.
(function(){
  "use strict";
  const ID="staw",PI=Math.PI,TAU=2*PI;
  const NOC="#0b2430",WODA="#1b5360",WODA_C="#0d2f3a",LIM="#a6d64a",LIM_C="#2e5a16",KREM="#f6efd8",ZLOTO="#ffcf5a",
    KAMYK="#e9efe0",KAMYK_C="#bfd2c4",KSIEZYC="#f3dc8e";
  const FANY=6,ISKRY=6;
  const ZASOBY=["tlo.webp","faktura.webp","zaba-0.webp","zaba-1.webp"];
  for(let i=0;i<FANY;i++)ZASOBY.push("fan-"+i+".webp");
  for(let i=0;i<ISKRY;i++)ZASOBY.push("iskra-"+i+".webp");
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe
  const ul=x=>x-Math.floor(x);
  const jest=()=>typeof bufor==="function";
  // bez Image (testy w Node na atrapie) = jak grafika w trakcie wczytywania
  const obraz=f=>typeof Image!=="undefined"&&typeof Motywy!=="undefined"&&Motywy.zasob?Motywy.zasob(ID,f):null;
  const BRAK=[],SCIEG=[3,2.5],SCIEG_KRAG=[5,3.5],SCIEG_AUR=[4,3];   // kreski bez nowych tablic w klatce

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
  const WZORY=new Map();
  function wzor(c,klucz,tworz){
    let w=WZORY.get(klucz);
    if(!w){w=c.createPattern(tworz(),"repeat");WZORY.set(klucz,w);}
    return w;
  }
  const filcNuty=c=>wzor(c,"nuta",()=>kafelekFilcu("rgba(235,255,200,.3)","rgba(20,50,10,.24)",420));
  const filcJasny=c=>wzor(c,"jasny",()=>kafelekFilcu("rgba(255,255,255,.35)","rgba(30,70,70,.13)",360));
  const filcCiemny=c=>wzor(c,"ciemny",()=>kafelekFilcu("rgba(160,230,230,.16)","rgba(0,10,20,.22)",360));
  // faktura motywu (kafel 512 bez szwów); zanim się wczyta: włókna z kodu
  function fakturaWzor(c){
    const im=obraz("faktura.webp");
    if(!im)return filcCiemny(c);
    return wzor(c,"faktura",()=>im);
  }

  // =========================================================================================== sprite'y
  // Ciepła poświata świetlika i chłodna łuna księżyca (gradienty raz, w buforze).
  const poswiata=()=>bufor("st-posw",64,64,c=>{
    const g=c.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,"rgba(255,236,150,.85)");g.addColorStop(.25,"rgba(255,207,90,.45)");g.addColorStop(.6,"rgba(255,180,60,.12)");g.addColorStop(1,"rgba(255,180,60,0)");
    c.fillStyle=g;c.fillRect(0,0,64,64);
  });
  const luna=()=>bufor("st-luna",96,96,c=>{
    const g=c.createRadialGradient(48,48,0,48,48,48);
    g.addColorStop(0,"rgba(243,220,142,.38)");g.addColorStop(.5,"rgba(140,210,200,.16)");g.addColorStop(1,"rgba(60,140,150,0)");
    c.fillStyle=g;c.fillRect(0,0,96,96);
  });
  const iskra=(i,r)=>{const im=obraz("iskra-"+i+".webp");return im&&jest()?bufor("st-isk|"+i+"|"+r,r,r,c=>{c.imageSmoothingQuality="high";c.drawImage(im,0,0,r,r);}):null;};
  // Liść łodygi: filc limonkowy z ciemnym obrysem i kremowym nerwem ze ściegu; v=0 w górę, v=1 w dół.
  const lisc=v=>bufor("st-lisc|"+v,40,40,c=>{
    c.translate(6,20);c.rotate(v?.55:-.55);
    const ks=()=>{c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(14,-11,32,0);c.quadraticCurveTo(14,11,0,0);c.closePath();};
    ks();c.fillStyle="#8cc63f";c.fill();c.save();c.clip();c.fillStyle=filcNuty(c);c.fillRect(-4,-14,40,28);c.restore();
    ks();c.strokeStyle=LIM_C;c.lineWidth=1.4;c.stroke();
    c.beginPath();c.moveTo(3,0);c.lineTo(28,0);c.strokeStyle="rgba(246,239,216,.9)";c.lineWidth=1;c.setLineDash([2.5,2]);c.stroke();c.setLineDash(BRAK);
  });

  // =========================================================================================== tło
  let WIN=null;
  const tlo={przeswit:.3,rama:{bok:.085,gora:10,dol:6,odstep:10},
    tlo:{promienie:[["243,220,142",.10],["150,220,210",.07]],swiatlo:["255,226,150","40,120,130"]},
    rysuj2d(c,st){
      const W=st.W,H=st.H;if(!(W>0&&H>0))return false;
      c.fillStyle=NOC;c.fillRect(0,0,W,H);
      const im=obraz("tlo.webp");if(!im)return true;
      Motywy.cover(c,im,0,0,W,H,.5,.5);
      if(!WIN||WIN.W!==W||WIN.H!==H){
        const g=c.createRadialGradient(W/2,H*.5,Math.min(W,H)*.3,W/2,H*.5,Math.hypot(W,H)*.6);
        g.addColorStop(0,"rgba(4,16,24,0)");g.addColorStop(1,"rgba(4,16,24,.34)");WIN={W,H,g};
      }
      c.fillStyle=WIN.g;c.fillRect(0,0,W,H);
      return true;
    }};

  // =========================================================================================== karta
  // Ciemna szyba wody: faktura filcu z przeszytymi kręgami (niskie krycie), chłodna łuna księżyca od prawej góry
  // i lekkie przyciemnienie ku dołowi jak głębsza woda.
  function fakturaKarty(c,L){
    c.globalAlpha=.42;c.fillStyle=fakturaWzor(c);c.fillRect(L.x,L.y,L.w,L.h);c.globalAlpha=1;
    const r=Math.max(L.w,L.h)*.7,g=c.createRadialGradient(L.x+L.w*.82,L.y-L.h*.1,0,L.x+L.w*.82,L.y-L.h*.1,r);
    g.addColorStop(0,"rgba(243,220,142,.10)");g.addColorStop(.45,"rgba(150,220,210,.05)");g.addColorStop(1,"rgba(150,220,210,0)");
    c.fillStyle=g;c.fillRect(L.x,L.y,L.w,L.h);
    const d=c.createLinearGradient(0,L.y+L.h*.5,0,L.y+L.h);d.addColorStop(0,"rgba(3,14,20,0)");d.addColorStop(1,"rgba(3,14,20,.18)");
    c.fillStyle=d;c.fillRect(L.x,L.y+L.h*.5,L.w,L.h*.5);
  }

  // =========================================================================================== nuty
  // Łodyga z limonkowego filcu: kolor z ziarna, włókna, cień walca (gradient z pamięci po wysokości), kremowy ścieg
  // wzdłuż górnej krawędzi. Obrys ciemnozielony (brzeg) odcina łodygę od ciemnej karty.
  const KOLORY_NUT=[LIM,"#b3dc55","#98cf45"];
  const WALEC=new Map();
  function walec(c,nh){
    const k=Math.round(nh*2);let g=WALEC.get(k);
    if(!g){const h=k/2;g=c.createLinearGradient(0,-h/2-2,0,h/2+2);
      g.addColorStop(0,"rgba(255,255,220,.22)");g.addColorStop(.35,"rgba(255,255,220,0)");g.addColorStop(.7,"rgba(20,60,10,.08)");g.addColorStop(1,"rgba(20,60,10,.32)");
      WALEC.set(k,g);}
    return g;
  }
  const KRESKI=new Map();
  function kreska(d){const k=Math.round(d*2);let a=KRESKI.get(k);if(!a){a=[Math.max(2,k*.9),Math.max(1.5,k*.55)];KRESKI.set(k,a);}return a;}
  const nuty={
    cialo(c,w,nh,o){
      const x0=-w/2,y0=-nh/2;
      c.fillStyle=KOLORY_NUT[(o.ziarno|0)%3];c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=filcNuty(c);c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.fillStyle=walec(c,nh);c.fillRect(x0-2,y0-2,w+4,nh+4);
      if(w<nh*1.2||nh<7)return;
      const m=Math.max(2.5,nh*.24);
      c.strokeStyle=KREM;c.lineWidth=Math.max(1,nh*.09);c.setLineDash(kreska(Math.max(2,nh*.22)));c.lineDashOffset=(o.ziarno|0)%3;
      c.beginPath();c.moveTo(x0+m,y0+m);c.lineTo(-x0-m,y0+m);c.stroke();
      c.setLineDash(BRAK);c.lineDashOffset=0;
    },
    brzeg:()=>LIM_C,zapas:()=>0};

  // =========================================================================================== klawisze
  // Filc w kolorze wody (faktura motywu), białe klawisze jako jasne kamyki z filcu (od kreski do kreski), czarne
  // z granatowego filcu, kremowy ścieg wokół. Gracz: złota łuna świetlika na swoim rzędzie i ścieg.
  const klawisze={
    tlo(c,L){
      const y0=L.gorna,h=L.rzedy*L.rh,x=L.kx,w=L.kw;
      c.fillStyle="rgba(0,10,16,.45)";c.beginPath();c.roundRect(x+2,y0+3,w,h,6);c.fill();
      c.beginPath();c.roundRect(x,y0,w,h,6);c.fillStyle=WODA;c.fill();
      c.save();c.clip();c.globalAlpha=.6;c.fillStyle=fakturaWzor(c);c.fillRect(x,y0,w,h);c.globalAlpha=1;c.restore();
      // kamyki: granice białych klawiszy jak kreski klawiatury domyślnej (nad B/E i pod czarnym)
      const gr=[y0+h];
      for(let s=L.dolN;s<=L.goraN;s++){
        if(isBlack(s))continue;const pc=((s%12)+12)%12;
        if(isBlack(s+1)||pc===4||pc===11){const yy=Math.round(prostokatKlawisza(L,s).y);if(yy>y0+1&&yy<y0+h-1)gr.push(yy);}
      }
      gr.push(y0);gr.sort((a,b)=>b-a);
      const ins=Math.max(1,Math.min(2.2,L.rh*.18)),grad=c.createLinearGradient(x,0,x+w,0);
      grad.addColorStop(0,KAMYK);grad.addColorStop(.7,"#dfe9da");grad.addColorStop(1,KAMYK_C);
      c.beginPath();
      for(let i=0;i+1<gr.length;i++){
        const yb=gr[i],yt=gr[i+1],hh=yb-yt-2*ins;if(hh<1)continue;
        c.roundRect(x+ins+1,yt+ins,w-2*ins-2,hh,Math.min(hh/2,8));
      }
      c.fillStyle=grad;c.fill();c.fillStyle=filcJasny(c);c.fill();
      c.strokeStyle="rgba(13,47,58,.55)";c.lineWidth=1;c.stroke();
      // czarne klawisze: granatowy filc, zaokrąglony koniec
      c.beginPath();
      for(let s=L.dolN;s<=L.goraN;s++){if(!isBlack(s))continue;const k=prostokatKlawisza(L,s);c.roundRect(k.x,k.y+.6,k.w*.62,Math.max(1,k.h-1.2),[0,4,4,0]);}
      c.fillStyle=WODA_C;c.fill();c.fillStyle=filcCiemny(c);c.fill();
      c.strokeStyle="rgba(150,220,210,.35)";c.lineWidth=.8;c.stroke();
      c.setLineDash(SCIEG);c.strokeStyle="rgba(246,239,216,.55)";c.lineWidth=1.1;c.beginPath();c.roundRect(x+2.5,y0+2.5,w-5,h-5,4);c.stroke();c.setLineDash(BRAK);
      c.strokeStyle=NOC;c.lineWidth=1.6;c.beginPath();c.roundRect(x,y0,w,h,6);c.stroke();
      return true;
    },
    gracz(c,L,g){
      if(!g.spiewa)return;
      const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),y=ySemi(L,s)-L.rh/2,hh=Math.max(1,L.rh-1);
      c.fillStyle=g.naNucie?"rgba(255,207,90,.78)":"rgba(255,207,90,.4)";c.fillRect(L.kx+1,y+.5,L.kw-2,hh);
      c.strokeStyle=g.naNucie?"#7a4f0e":"rgba(122,79,14,.6)";c.lineWidth=1.2;c.setLineDash(SCIEG);
      c.strokeRect(L.kx+2,y+1,L.kw-4,Math.max(1,hh-1));c.setLineDash(BRAK);
    }};

  // =========================================================================================== widownia
  // Fani z fan-*.webp stoją na liściach lilii (iskra-1.webp spłaszczony w perspektywie, odbicia i skala z ziarna).
  // Liść z fanem kołysze się wolno jak na wodzie (sinus z przesuniętą fazą), a fan podskakuje w rytm ćwierćnut
  // dopiero przy śpiewie, kombo i brawach. W spokoju stoją. Kolejność z ziarnem bez sąsiadów-bliźniaków.
  const RZAD=new Map();
  function rzad(n){
    let r=RZAD.get(n);if(r)return r;
    r=[];let ost=-1,z=17;
    while(r.length<n){
      const p=[0,1,2,3,4,5];for(let i=5;i>0;i--){const j=Math.floor(los(z,i)*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}z++;
      if(p[0]===ost){const t=p[0];p[0]=p[5];p[5]=t;}
      for(const f of p){if(r.length>=n)break;const k=r.length;
        r.push({f,lustro:los(k,3)>.5,lp:los(k,6)>.5,sk:.86+.14*los(k,4),faza:[0,.5,.25,.75][k%4]+.1*los(k,5),fk:los(k,7)*TAU,dx:(los(k,8)-.5)*.2});ost=f;}
    }
    RZAD.set(n,r);return r;
  }
  // fan-4 ma przy prawym brzegu dłoń sąsiedniej postaci (pod własną uniesioną ręką): wycinamy ją w buforze
  const WYTNIJ=[null,null,null,null,[238,86,34,170],null];
  function fan(i,h,lustro){
    const im=obraz("fan-"+i+".webp");if(!im||!jest())return null;
    const s=h/im.naturalHeight,w=Math.max(1,Math.round(im.naturalWidth*s));
    return bufor("st-fan|"+i+"|"+(lustro?1:0)+"|"+h,w,h,c=>{
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,0,0,w,h);
      const q=WYTNIJ[i];if(q)c.clearRect(q[0]*s,q[1]*s,q[2]*s+2,q[3]*s);
    });
  }
  // liść lilii pod fanem: widziany z boku (spłaszczony), z cieniem na wodzie
  function lilia(w,lustro){
    const im=obraz("iskra-1.webp");if(!im||!jest())return null;
    const h=Math.max(4,Math.round(w*.34));
    return bufor("st-lil|"+w+"|"+(lustro?1:0),w,h+3,c=>{
      c.fillStyle="rgba(2,12,18,.35)";c.beginPath();c.ellipse(w/2,h/2+3,w*.47,h*.45,0,0,TAU);c.fill();
      c.imageSmoothingQuality="high";if(lustro){c.translate(w,0);c.scale(-1,1);}
      c.drawImage(im,4,4,88,88,0,0,w,h);
    });
  }
  const podloga=(W,h)=>bufor("st-podl|"+W+"x"+h,W,h,c=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(4,18,26,0)");g.addColorStop(.6,"rgba(4,18,26,.32)");g.addColorStop(1,"rgba(4,18,26,.5)");
    c.fillStyle=g;c.fillRect(0,0,W,h);
  });
  const widownia={
    rysuj(c,Wd,st){
      if(!jest())return;
      const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
      c.drawImage(podloga(W,h).cv,0,Wd.y,W,h);
      const fh=Math.round(h*1.02),n=Math.max(3,Motywy.ileFanow(ID,W,fh,.86)),krok=W/n,R=rzad(n);
      const ruch=!st.spokoj&&!st.bezRuchu,zywe=st.spiewaja||(st.zar||0)>.05||(st.ap||0)>.12;
      const moc=zywe?.045+.05*Math.min(1,st.skok||0)+.03*Math.min(3,st.zar||0)+.06*Math.min(1,(st.ap||0)*2):.02*Math.min(1,st.skok||0);
      const fz=st.faza||0,dno=Wd.y+h;
      for(let i=0;i<n;i++){
        const r=R[i],hh=Math.round(fh*r.sk),b=fan(r.f,hh,r.lustro);if(!b)continue;
        const kol=ruch?Math.sin(fz*PI*.5+r.fk)*h*.025:0,hop=ruch&&moc?Math.abs(Math.sin(PI*(fz+r.faza)))*fh*moc:0;
        const cx=krok*(i+.5+r.dx),lw=Math.round(Math.min(krok*1.15,hh*.95)),l=lilia(lw,r.lp);
        const ly=dno-h*.16+kol;
        if(l)c.drawImage(l.cv,cx-l.w/2,ly-l.h*.55,l.w,l.h);
        Motywy.fan(c,b,cx,ly+hh*.08,st,"zabi",i);   // 10-16: ruch wg motywu (motywy.js ruchFana)
      }
    }};

  // =========================================================================================== streak
  // Głowa (za głową): łuna księżyca, przeszyta aureola, która się wolno obraca, i świetliki krążące po elipsie
  // wokół głowy (te z przodu chowa sama żaba). Tor (co klatkę): kręgi na wodzie przy trafieniach i drobiazgi stawu.
  const streak={
    glowa(c,sc,og,ts,z,przod){
      if(przod||!jest())return;
      const cy=-sc*.37,rl=sc*(.8+.1*og);
      const l=luna();c.globalAlpha=.8+.1*Math.sin(ts*1.3+z);c.drawImage(l.cv,-rl,cy-rl,2*rl,2*rl);c.globalAlpha=1;
      // przeszyta aureola (złota nić), przy og ≥ 3 druga, odwrotnie
      c.lineCap="round";c.setLineDash(SCIEG_AUR);
      c.lineDashOffset=-ts*sc*.12;c.strokeStyle="rgba(243,220,142,.75)";c.lineWidth=Math.max(1,sc*.025);
      c.beginPath();c.arc(0,cy,sc*.47,0,TAU);c.stroke();
      if(og>=3){c.lineDashOffset=ts*sc*.09;c.strokeStyle="rgba(190,240,225,.5)";c.beginPath();c.arc(0,cy,sc*.6,0,TAU);c.stroke();}
      c.setLineDash(BRAK);c.lineDashOffset=0;
      // świetliki: krążą (połowa zgodnie, połowa przeciwnie), migoczą łagodnie (≤ 2 Hz)
      const n=og>=3?5:3,p=poswiata();
      for(let j=0;j<n;j++){
        const kier=j%2?-1:1,a=kier*ts*(.9+.15*j)+j*TAU/n+z,rx=sc*(.62+.08*(j%3)),ry=sc*(.3+.05*(j%2));
        const x=Math.cos(a)*rx,y=cy-sc*.06+Math.sin(a)*ry+Math.sin(ts*2.1+j*1.7)*sc*.05;
        const migot=.7+.3*Math.sin(ts*(1.4+.25*j)+j*2),s=sc*(.27+.035*og)*(.85+.15*migot),rp=s*.95;
        c.globalAlpha=migot;c.drawImage(p.cv,x-rp,y-rp,2*rp,2*rp);
        const im=iskra(0,40);if(im){c.globalAlpha=1;c.drawImage(im.cv,x-s/2,y-s/2,s,s);}
      }
      c.globalAlpha=1;
    },
    // ślad: łodyga z filcu (ciemny podkład i limonkowa nić), w świeższej części liście na przemian w górę i w dół;
    // przy pełnym ogniu na czubku łodygi siedzi świetlik
    slad(c,k){
      const pts=k.pts;if(!pts||pts.length<2)return;
      const g=gradSladu(c,k.x0,k.xT);
      c.lineCap="round";c.lineJoin="round";
      c.beginPath();let pi=false;
      for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
      c.strokeStyle=g.a;c.lineWidth=k.og>=3?6:k.og>=2?5:3.5;c.stroke();
      c.strokeStyle=g.b;c.lineWidth=k.og>=3?3:2.4;c.stroke();
      if(!jest()||k.og<2)return;
      let ost=-1e9,nr=0;const krok=k.og>=3?20:26;
      for(const p of pts){
        if(!p.sp||p.x-ost<krok||p.x<k.x0)continue;ost=p.x;
        const f=(p.x-k.x0)/k.dlug;if(f<.3||f>.95)continue;
        if(++nr>9)break;
        const b=lisc(nr&1),s=(k.og>=3?20:16)*(.55+.45*f);
        c.drawImage(b.cv,p.x-s*.15,p.y-s/2,s,s);
      }
      if(k.og>=3&&k.pelna!==false){
        const q=pts[pts.length-1],im=iskra(0,40),pw=poswiata(),x=k.xT-30+Math.sin(k.ts*1.3)*5,y=q.y-16+Math.sin(k.ts*1.9)*4;
        c.globalAlpha=.8;c.drawImage(pw.cv,x-16,y-16,32,32);c.globalAlpha=1;
        if(im)c.drawImage(im.cv,x-9,y-9,18,18);
      }
    },
    // płonąca nuta: zaśpiewana część rozjaśnia się światłem świetlika, na froncie świetlik
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(255,226,130,.32)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas>.05&&jest()){
        const im=iskra(0,40),pw=poswiata(),s=nh*(aktywna?1.5:1.15);
        c.globalAlpha=Math.min(1,gas)*.8;c.drawImage(pw.cv,fx-s,-s,2*s,2*s);
        if(im){c.globalAlpha=Math.min(1,gas);c.drawImage(im.cv,fx-s/2,-nh/2-s*.55,s,s);}
        c.globalAlpha=1;
      }
    },
    tor(c,L,g,st){if(st&&!st.spokoj&&!st.wyniki)wodaToru(c,L,g,st);},
    rozgrzej(){if(!jest())return;try{poswiata();luna();lisc(0);lisc(1);for(let i=0;i<ISKRY;i++)iskra(i,40);}catch(e){}},
    aura:[ZLOTO,"#bfe86a"],wypelnienie:["#fff6d0","#d8f08a","#7fd36b"],
    iskry:{kolory:["#ffe9a0",ZLOTO,"#d8f08a"]},dym:false,
    scena:["255,226,150","150,220,210","166,214,74"],
    tlo:{promienie:[["243,220,142",.10],["150,220,210",.07]],swiatlo:["255,226,150","40,120,130"]}};

  const GRAD=new Map();
  function gradSladu(c,x0,xT){
    const kl=Math.round(x0)*16384+Math.round(xT);let g=GRAD.get(kl);if(g)return g;
    if(GRAD.size>24)GRAD.clear();
    const a=c.createLinearGradient(x0,0,xT,0);a.addColorStop(0,"rgba(18,48,14,0)");a.addColorStop(.6,"rgba(30,70,20,.7)");a.addColorStop(1,"rgba(30,70,20,.9)");
    const b=c.createLinearGradient(x0,0,xT,0);b.addColorStop(0,"rgba(166,214,74,0)");b.addColorStop(.6,"rgba(166,214,74,.85)");b.addColorStop(1,"rgba(196,232,110,1)");
    g={a,b};GRAD.set(kl,g);return g;
  }

  // ---- kręgi na wodzie i drobiazgi stawu: pule na gracza, bez alokacji w klatce ----
  // Krąg: spłaszczona elipsa ze ściegu wokół linii wody pod głową, rośnie i gaśnie w ~1,3 s, płynie lekko w lewo
  // z nurtem; każde trafienie przy kombo ≥ 4 to jeden krąg, próg co 4 nuty to krąg podwójny i grubszy.
  // Drobiazgi (liść, lilia, ważka, kropla, rybka: iskra-1..5) wypływają zza głowy w tempie zależnym od ognia.
  const PULE=new WeakMap(),MAKS_KR=4,MAKS_CZ=10,TEMPO=[0,.9,1.8,3.2];
  function pula(g){
    let p=PULE.get(g);if(p)return p;
    p={k:g.kombo|0,dos:0,kr:[],cz:[],nk:0};
    for(let i=0;i<MAKS_KR;i++)p.kr.push({t:0,x:0,y:0,r0:0,mocny:false});
    for(let i=0;i<MAKS_CZ;i++)p.cz.push({z:0,zy:1,x:0,y:0,vx:0,vy:0,k:1,r:20,fz:0});
    PULE.set(g,p);return p;
  }
  const ZYCIE_KR=1.3;
  function wodaToru(c,L,g,st){
    if(typeof pozycjaZaby!=="function")return;
    const P=pula(g),dt=Math.min(.05,Math.max(0,st.dt||0)),k=g.kombo|0,og=Math.min(3,g.ogien|0),sc=L.zaba*110/96;
    if(k>P.k&&k>=4){   // trafienie: nowy krąg (najstarszy z puli)
      const pz=pozycjaZaby(L,g);let q=P.kr[0];
      for(const r of P.kr){if(r.t<=0){q=r;break;}if(r.t<q.t)q=r;}
      q.t=ZYCIE_KR;q.x=pz.x;q.y=pz.y+sc*.32;q.r0=sc*.42;q.mocny=k%4===0;
    }
    P.k=k;
    if(og>0){
      P.dos+=dt*TEMPO[og];
      if(P.dos>=1){P.dos-=1;
        for(const p of P.cz)if(p.z<=0){
          const pz=pozycjaZaby(L,g);
          p.k=1+Math.floor(Math.random()*5);p.r=Math.round(sc*(.3+.05*og)*(.85+.3*Math.random()));
          p.x=pz.x-sc*.1+(Math.random()-.5)*sc*.3;p.y=pz.y-sc*.35;p.vx=-(20+40*Math.random());p.vy=-(30+35*Math.random());
          p.fz=Math.random()*TAU;p.zy=1.6+.6*Math.random();p.z=p.zy;break;
        }
      }
    }else P.dos=0;
    // kręgi: jedna przerywana nić (ścieg), krąg mocny podwójny; bez podkładu, bo co klatkę liczy się każdy obrys
    c.lineCap="round";c.setLineDash(SCIEG_KRAG);
    for(const r of P.kr){
      if(r.t<=0)continue;
      r.t-=dt;r.x-=dt*18;if(r.t<=0)continue;
      const f=1-r.t/ZYCIE_KR,rx=r.r0+sc*(r.mocny?1.15:.8)*Math.sqrt(f),a=(1-f)*(1-f)*(r.mocny?1:.8);
      for(let d=0;d<(r.mocny?2:1);d++){
        const rr=rx*(d?.62:1);
        c.beginPath();c.ellipse(r.x,r.y,rr,rr*.34,0,0,TAU);
        c.globalAlpha=a;c.strokeStyle=d?"rgba(243,220,142,.95)":"rgba(205,245,235,.95)";c.lineWidth=r.mocny?2.2:1.7;c.stroke();
      }
    }
    c.setLineDash(BRAK);c.globalAlpha=1;
    // drobiazgi: płyną w górę i do tyłu, kołyszą się na boki jak niesione wodą
    for(const p of P.cz){
      if(p.z<=0)continue;
      p.z-=dt;p.x+=p.vx*dt+Math.sin(p.fz+p.z*3)*dt*14;p.y+=p.vy*dt;p.vy+=10*dt;
      if(p.z<=0)continue;
      const b=iskra(p.k,40);if(!b)continue;
      const f=1-p.z/p.zy,s=p.r*(f<.15?.5+.5*f/.15:1);
      c.globalAlpha=f<.12?f/.12:p.z<.45?p.z/.45:1;c.drawImage(b.cv,p.x-s/2,p.y-s/2,s,s);
    }
    c.globalAlpha=1;
  }

  Motywy.dodaj({id:ID,nazwa:"Staw nocą",kolejnosc:10,kolor:"#7fd36b",zasoby:ZASOBY,zaba:true,przebranie:true,
    opis:"Spokojna noc nad stawem z filcu: księżyc, świetliki i lilie wodne. Karta jak ciemna tafla wody, nuty z limonkowego filcu jak łodygi, klawisze jak jasne kamyki, a przy kombo świetliki krążą za głową i po wodzie rozchodzą się przeszyte kręgi.",
    cechy:{tlo:"staw w świetle księżyca",klawisze:"kamyki w wodzie",streak:"świetliki i kręgi",widownia:"żaby na liściach lilii"},
    en:{nazwa:"Night Pond",
      opis:"A calm night by a felt pond: the moon, fireflies and water lilies. The card is a dark sheet of water, notes are lime felt stems, keys are pale pebbles, and on a combo fireflies circle behind your head while stitched ripples spread across the water.",
      cechy:{tlo:"moonlit pond",klawisze:"pebbles in the water",streak:"fireflies and ripples",widownia:"frogs on lily pads"}},
    karta:{papier:"#0f3440",cien:"rgba(0,10,16,.4)",czarne:"rgba(0,12,20,.2)",liniaC:"rgba(190,240,230,.22)",minione:"rgba(0,12,20,.24)",
      nazwy:"rgba(225,245,238,.8)",kreski:"rgba(190,240,230,.22)",nic:ZLOTO,szpilka:KSIEZYC,szpilkaBlask:"#ffffff",
      cienNuty:"rgba(0,10,16,.45)",scieg:"rgba(205,240,228,.42)",rysuj:fakturaKarty},
    tlo,klawisze,nuty,streak,widownia});
})();
