// Style sceny RibbitBeat: warianty widowni (pasek na dole) i efektów kombo (streak). Katalog + rysowanie.
// Ładowany PRZED zabi-chor.js; globali gry (R, IMG, bufor, blask, blysk, szum1, obrazGotowy, rgba, napisNa,
// zabaNaklejka, funkcje ognia) używa dopiero w chwili wywołania, więc kolejność skryptów nie przeszkadza.
//
// Widownia: {id, nazwa, opis, prestiz 0–5, rysuj(c, Wd, st)}. Wd = {y, h} pasa, st = Efekty.stan(...): szerokość W,
//   liczba miejsc n i krok, faza beatu, czy ktoś śpiewa, skok (kombo co 4 nuty, brawa), ap (aplauz na wynikach),
//   zar (wygładzony ogień 0–3), fala „W jednym głosie!”, bezRuchu (prefers-reduced-motion), spokoj (grafika
//   uproszczona albo ograniczony ruch: bez błysków i cząstek), kolor właściciela sceny i akcent jego partii.
// Streak: {id, nazwa, opis, prestiz, glowa(c,sc,og,ts,ziarno,przod), slad(c,k), nuty(c,w,nh,fx,poziom,ts,ziarno,aktywna,gas),
//   aura [2 kolory], wypelnienie [3 kolory], scena [3×"r,g,b"], iskry {kolory, ksztalt, ruch}, dym (false = bez dymu,
//   kolor = barwiony), tlo {promienie, swiatlo}}. Progi ognia 4/8/12 kombo są wspólne (og 1–3 liczy gra).
// Budżet klatki: kilka rysowań na żabę, sprite'y z buforów (bufor), bez filtrów CSS i bez shadowBlur w pętli.
const Efekty=(function(){
  "use strict";
  const PI=Math.PI,TAU=2*PI;
  const ROZ="#ec1a83",LIM="#a6d861",ZIEL="#6cb33f",BURSZ="#eaa32b",ZOLTY="#ffd84a",NIEB="#294aa8",TUSZ="#211f1d",PAPIER="#faf6ee";
  const KOLORY=[ROZ,LIM,BURSZ,NIEB];

  // =========================================================================================== stan
  function stan(o,Wd){
    const st=Object.assign({},o);
    st.n=o.n||Math.max(8,Math.floor(o.W/58));st.krok=o.W/st.n;
    st.lw=Math.min(52,Wd.h*.72);st.zw=Math.min(40,Wd.h*.56);st.ts=o.teraz/1000;
    st.kolor=o.kolor||ROZ;st.akcent=o.akcent||ROZ;
    // moc stopnia 0..1 (stopień/20 z drabinki albo ?moc=) i czy silnik WebGL2 działa w tej klatce (gl-fx.js);
    // style 1–13 ich nie używają, stopnie z modułów drabinek skalują nimi gęstość i zasięg
    st.moc=o.moc!=null&&Number.isFinite(+o.moc)?Math.max(0,Math.min(1,+o.moc)):1;st.gl=!!o.gl;
    return st;
  }
  // Miniatura w karcie gracza: stan spoczynku (nikt nie śpiewa, bez kombo i braw, bez ruchu).
  function stanSpoczynku(W,h){
    return stan({W,teraz:260,G:false,fala0:0,wyniki:false,ap:0,faza:.37,spiewaja:false,skok:0,zar:0,
      bezRuchu:true,spokoj:true,n:3,kolor:ROZ,akcent:ROZ,mini:true},{y:0,h});
  }
  const ulamek=st=>st.faza-Math.floor(st.faza);
  const hop=st=>{const u=ulamek(st);return (1-u)*(1-u)*3;};
  const wyskok=(st,i)=>st.skok*(st.wyniki?18:12)*Math.abs(Math.sin(st.teraz/85+i*1.7));
  function fala(st,i){const tf=st.G?(st.teraz-st.fala0-i*35)/320:-1;return tf>0&&tf<1?16*Math.sin(PI*tf):0;}
  function klatka(st,i,fl){
    return st.ap>.12?Math.min(4,1+Math.floor(st.ap*2.5)+((i+Math.floor(st.teraz/180))%2))
      :(st.spiewaja||fl>2)?1+((Math.floor(st.faza)+i)%3):0;
  }
  const kolys=(st,i)=>Math.sin(PI*st.faza+i)*.11*(i%2?1:-1);
  const zabaImg=k=>{const im=IMG.zaby[k];return obrazGotowy(im)?im:null;};
  const los=k=>{const v=Math.sin(k*12.9898+78.233)*43758.5453;return v-Math.floor(v);};   // 0..1, powtarzalne

  // ---- bufory stylów (liczone raz na kolor/rozmiar, potem jedno drawImage) ----
  function sylwetka(kl,kolor){
    const img=zabaImg(kl);if(!img)return null;
    return bufor("ef-syl|"+kl+"|"+kolor,96,96,c=>{c.drawImage(img,0,0,96,96);c.globalCompositeOperation="source-in";
      c.fillStyle=kolor;c.fillRect(0,0,96,96);});
  }
  // Neonowa żaba: świecący obrys w kolorze (dwa pierścienie: miękki i ostry) wokół ciemnej sylwetki.
  function neonZaba(kl,kolor){
    const img=zabaImg(kl);if(!img)return null;
    return bufor("ef-neon|"+kl+"|"+kolor,110,110,c=>{
      const s=document.createElement("canvas");s.width=s.height=96;const x=s.getContext("2d");
      x.drawImage(img,0,0,96,96);x.globalCompositeOperation="source-in";x.fillStyle=kolor;x.fillRect(0,0,96,96);
      c.globalAlpha=.3;for(let k=0;k<12;k++){const a=k*PI/6;c.drawImage(s,7+Math.cos(a)*6,7+Math.sin(a)*6,96,96);}
      c.globalAlpha=1;for(let k=0;k<12;k++){const a=k*PI/6;c.drawImage(s,7+Math.cos(a)*3,7+Math.sin(a)*3,96,96);}
      x.fillStyle="#1b1917";x.fillRect(0,0,96,96);c.drawImage(s,7,7,96,96);
    });
  }
  // Irokez: pięć kolców (środkowy najwyższy) z obrysem atramentem; rysowany nad głową żaby.
  function irokez(kolor){
    return bufor("ef-irokez|"+kolor,40,24,c=>{
      c.beginPath();
      for(let j=0;j<5;j++){const x=6+j*7,top=j===2?2:j%2?5:9;c.moveTo(x-4.5,22);c.lineTo(x,top);c.lineTo(x+4.5,22);c.closePath();}
      c.fillStyle=kolor;c.fill();c.strokeStyle=TUSZ;c.lineWidth=1.4;c.lineJoin="round";c.stroke();
    });
  }
  // Obroża z kolcami i agrafka (styl „Kolce”, mosh pit „Pogo”).
  function obroza(){
    return bufor("ef-obroza",64,22,c=>{
      c.fillStyle=TUSZ;c.beginPath();c.roundRect(2,9,60,10,5);c.fill();
      c.beginPath();for(let j=0;j<5;j++){const x=10+j*11;c.moveTo(x-4,10);c.lineTo(x,1);c.lineTo(x+4,10);c.closePath();}
      c.fillStyle="#d8cdb8";c.fill();c.strokeStyle=TUSZ;c.lineWidth=1;c.stroke();
      for(let j=0;j<6;j++){c.fillStyle="#d8cdb8";c.beginPath();c.arc(7+j*10,14,1.3,0,TAU);c.fill();}
    });
  }
  function agrafka(){
    return bufor("ef-agrafka",14,24,c=>{
      c.strokeStyle="#d8cdb8";c.lineWidth=1.6;c.lineCap="round";
      c.beginPath();c.moveTo(7,3);c.lineTo(4,19);c.arc(7,19,3,PI,0,true);c.lineTo(8,6);c.stroke();
      c.fillStyle=BURSZ;c.beginPath();c.arc(7,3,2.2,0,TAU);c.fill();
    });
  }
  function plomyk(){
    return bufor("ef-plomyk",12,22,c=>{
      const g=c.createLinearGradient(0,22,0,0);g.addColorStop(0,"#ffffff");g.addColorStop(.3,ZOLTY);
      g.addColorStop(.7,BURSZ);g.addColorStop(1,"rgba(236,26,131,0)");
      c.fillStyle=g;c.beginPath();c.moveTo(6,0);c.bezierCurveTo(10,8,11,14,11,16);c.arc(6,16,5,0,PI);c.bezierCurveTo(1,14,2,8,6,0);c.fill();
    });
  }
  function stozekSwiatla(){
    return bufor("ef-stozek",30,40,c=>{
      const g=c.createLinearGradient(0,40,0,0);g.addColorStop(0,"rgba(250,246,238,.7)");g.addColorStop(1,"rgba(250,246,238,0)");
      c.fillStyle=g;c.beginPath();c.moveTo(12,40);c.lineTo(18,40);c.lineTo(30,0);c.lineTo(0,0);c.closePath();c.fill();
    });
  }
  function snop(kolor){
    return bufor("ef-snop|"+kolor,64,200,c=>{
      const g=c.createLinearGradient(0,200,0,0);g.addColorStop(0,rgba(kolor,.6));g.addColorStop(.6,rgba(kolor,.18));g.addColorStop(1,rgba(kolor,0));
      c.fillStyle=g;c.beginPath();c.moveTo(29,200);c.lineTo(35,200);c.lineTo(64,0);c.lineTo(0,0);c.closePath();c.fill();
    });
  }
  function dymekKolor(kolor){
    return bufor("ef-dym|"+kolor,64,64,c=>{
      const g=c.createRadialGradient(32,32,0,32,32,32);
      g.addColorStop(0,rgba(kolor,.6));g.addColorStop(.5,rgba(kolor,.24));g.addColorStop(1,rgba(kolor,0));
      c.fillStyle=g;c.fillRect(0,0,64,64);
    });
  }
  let miara=null;
  function szerTekstu(t,font){if(!miara)miara=document.createElement("canvas").getContext("2d");miara.font=font;return miara.measureText(t).width;}
  function tabliczka(tekst,tlo,fs){
    const font="400 "+fs+"px 'Titan One','Baloo 2',sans-serif",w=Math.ceil(szerTekstu(tekst,font))+fs+4,h=fs+8;
    return bufor("ef-tab|"+tekst+"|"+tlo+"|"+fs,w+4,h+4,c=>{
      c.fillStyle="rgba(33,31,29,.35)";c.fillRect(3,4,w,h);
      c.fillStyle=tlo;c.fillRect(1,1,w,h);c.strokeStyle=TUSZ;c.lineWidth=1.5;c.strokeRect(1,1,w,h);
      c.font=font;c.fillStyle=napisNa(tlo);c.textAlign="center";c.textBaseline="middle";c.fillText(tekst,1+w/2,1+h/2+1);
    });
  }
  // Ściana z graffiti za widownią „Graffiti”: beton, cegły, tagi w kolorach marki z zaciekami.
  function sciana(W,h){
    W=Math.max(8,Math.round(W));h=Math.max(8,Math.round(h));
    return bufor("ef-sciana|"+W+"|"+h,W,h,c=>{
      c.fillStyle="#46413b";c.fillRect(0,0,W,h);
      const bh=Math.max(7,h/5),bw=bh*2.6;c.strokeStyle="rgba(20,18,16,.5)";c.lineWidth=1;c.beginPath();
      for(let r=0,y=0;y<h;r++,y+=bh){c.moveTo(0,Math.round(y)+.5);c.lineTo(W,Math.round(y)+.5);
        for(let x=(r%2)*bw/2;x<W;x+=bw){c.moveTo(Math.round(x)+.5,y);c.lineTo(Math.round(x)+.5,y+bh);}}
      c.stroke();
      const tagi=["RIBBIT","KUM!","PUNK","ŻABY","BIS!","RECHOT"],fs=Math.round(h*.3);
      c.font="400 "+fs+"px 'Titan One','Baloo 2',sans-serif";c.textBaseline="middle";c.lineJoin="round";
      for(let k=0,x=20;x<W;k++,x+=Math.max(120,fs*4.6)){
        const t=tagi[k%tagi.length],kol=KOLORY[k%3],y=h*(.24+.12*los(k*3.1)),kat=(los(k*7.7)-.5)*.16;
        c.save();c.translate(x,y);c.rotate(kat);
        c.strokeStyle=TUSZ;c.lineWidth=3;c.strokeText(t,0,0);c.fillStyle=kol;c.fillText(t,0,0);
        const sz=c.measureText(t).width;c.fillStyle=kol;
        for(let d=0;d<3;d++){const dx=sz*(.15+.3*d+.1*los(k+d)),dl=fs*(.3+.6*los(k*5+d));c.fillRect(dx,fs*.32,1.6,dl);c.beginPath();c.arc(dx+.8,fs*.32+dl,1.6,0,TAU);c.fill();}
        c.restore();
      }
    });
  }
  function plama(kolor){
    return bufor("ef-plama|"+kolor,64,64,c=>{
      c.fillStyle=kolor;c.beginPath();c.arc(32,30,13,0,TAU);c.fill();
      for(let k=0;k<8;k++){const a=k*TAU/8+los(k)*.5,r=15+los(k*3)*12;c.beginPath();c.arc(32+Math.cos(a)*r,30+Math.sin(a)*r*.8,1.5+los(k*5)*3.5,0,TAU);c.fill();}
      c.fillRect(27,38,2.4,18);c.fillRect(36,38,2,12);
    });
  }
  function krata(W,h){
    W=Math.max(8,Math.round(W));h=Math.max(8,Math.round(h));
    return bufor("ef-krata|"+W+"|"+h,W,h,c=>{
      c.fillStyle="#b8264a";c.fillRect(0,0,W,h);
      c.fillStyle="rgba(33,31,29,.5)";
      for(let x=0;x<W;x+=26)c.fillRect(x,0,10,h);
      for(let y=4;y<h;y+=26)c.fillRect(0,y,W,10);
      c.fillStyle="rgba(234,163,43,.65)";for(let x=17;x<W;x+=26)c.fillRect(x,0,1.2,h);for(let y=21;y<h;y+=26)c.fillRect(0,y,W,1.2);
      c.fillStyle="rgba(250,246,238,.25)";for(let x=21;x<W;x+=26)c.fillRect(x,0,.8,h);
    });
  }
  // Czaszka z irokezem (96×96 jak sprite żaby; czaszka w środku), szczęka otwarta, gdy widownia śpiewa.
  function czaszka(otwarta,kolor){
    return bufor("ef-czaszka|"+(otwarta?1:0)+"|"+kolor,96,96,c=>{
      c.drawImage(irokez(kolor).cv,20,-2,56,42);
      c.lineWidth=3;c.strokeStyle=TUSZ;c.fillStyle="#efe6d2";c.lineJoin="round";
      const jy=otwarta?6:0;
      c.beginPath();c.roundRect(31,70+jy,34,16,6);c.fill();c.stroke();   // szczęka
      c.beginPath();for(let k=1;k<5;k++){c.moveTo(31+k*6.8,71+jy);c.lineTo(31+k*6.8,80+jy);}c.lineWidth=1.8;c.stroke();
      c.lineWidth=3;c.beginPath();c.arc(48,52,28,0,TAU);c.fill();c.stroke();
      c.fillStyle=TUSZ;c.beginPath();c.ellipse(37,54,7.5,9,0,0,TAU);c.ellipse(59,54,7.5,9,0,0,TAU);c.fill();
      c.beginPath();c.moveTo(48,63);c.lineTo(44,70);c.lineTo(52,70);c.closePath();c.fill();
    });
  }
  function oczy(kolor){
    return bufor("ef-oczy|"+kolor,96,96,c=>{
      for(const x of [37,59]){const g=c.createRadialGradient(x,57,0,x,55,9);g.addColorStop(0,"rgba(255,236,150,1)");
        g.addColorStop(.3,rgba(kolor,1));g.addColorStop(1,"rgba(110,10,40,.95)");
        c.fillStyle=g;c.beginPath();c.ellipse(x,54,6.5,8,0,0,TAU);c.fill();}
    });
  }
  // Żaba z irokezem w innym kolorze (sprite ma różowy): piksele irokezu przemalowane raz na kolor, z zachowaniem jasności.
  function zabaIrokez(kl,kolor){
    const img=zabaImg(kl);if(!img)return null;
    if(kolor===ROZ)return img;
    return bufor("ef-irok|"+kl+"|"+kolor,96,96,c=>{
      c.drawImage(img,0,0,96,96);
      try{
        const d=c.getImageData(0,0,c.canvas.width,c.canvas.height),p=d.data,m=/^#(..)(..)(..)$/.exec(kolor),
          t=[parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)];
        for(let i=0;i<p.length;i+=4){const r=p[i],g=p[i+1],b=p[i+2];
          if(p[i+3]>0&&r>120&&g<120&&b>50&&r>b&&r-g>90){const l=Math.min(1.25,r/236);p[i]=Math.min(255,t[0]*l);p[i+1]=Math.min(255,t[1]*l);p[i+2]=Math.min(255,t[2]*l);}}
        c.putImageData(d,0,0);
      }catch(e){}
    });
  }

  // ---- wspólne kawałki rysowania ----
  function pasDomyslny(c,Wd,st,linia){
    c.fillStyle="rgba(108,179,63,.14)";c.fillRect(0,Wd.y,st.W,Wd.h);
    c.strokeStyle=linia||"rgba(70,120,31,.5)";c.lineWidth=1.6;c.setLineDash([7,5]);
    c.beginPath();c.moveTo(0,Wd.y+5);c.lineTo(st.W,Wd.y+5);c.stroke();c.setLineDash([]);
  }
  function pasCiemny(c,Wd,st,linia){
    c.fillStyle="rgba(33,31,29,.92)";c.fillRect(0,Wd.y,st.W,Wd.h);
    c.fillStyle=linia||BURSZ;c.fillRect(0,Wd.y,st.W,2);
  }
  // Rząd żab jak w domyślnej widowni (podskok w rytm, fala „W jednym głosie!”, brawa) z haczykami stylu:
  // obraz(kl,i) bitmapa żaby, lisc:false bez liści, unies(i) dodatkowe px w górę, kat(i,k), alfa(i),
  // pod(c,i,x,y) przed żabą, na(c,i,zw,kl) w układzie żaby po niej, po(c,i,x,y) po żabie (bez obrotu).
  function rzadZab(c,Wd,st,o){
    o=o||{};
    const n=st.n,krok=st.krok,lw=st.lw,zw=st.zw,h0=hop(st),podl=Wd.y+Wd.h-lw*.32;
    for(let i=0;i<n;i++){
      const x=krok*(i+.5);
      if(o.lisc!==false&&obrazGotowy(IMG.lisc))c.drawImage(IMG.lisc,x-lw/2,podl-lw*.22,lw,lw*.5);
      const fl=fala(st,i),kl=klatka(st,i,fl),img=o.obraz?o.obraz(kl,i):zabaImg(kl);
      const y=podl-zw*.38-h0-wyskok(st,i)-fl-(o.unies?o.unies(i):0);
      if(o.pod)o.pod(c,i,x,y);
      if(img){
        const k=o.kat?o.kat(i,kolys(st,i)):kolys(st,i),s=img.cv?zw*img.w/96:zw;
        const a=o.alfa?o.alfa(i):1;
        c.save();c.translate(x,y);c.rotate(k);if(a<1)c.globalAlpha=a;
        c.drawImage(img.cv||img,-s/2,-s/2,s,s);c.globalAlpha=1;
        if(o.na)o.na(c,i,zw,kl);
        c.restore();
      }
      if(o.po)o.po(c,i,x,y);
    }
  }

  // =========================================================================================== widownie
  // Domyślna: DOKŁADNIE dawne rysujWidownie (zielony pas, liście, żaby w rytm, przy kombo blask i błyski).
  function rysujZaby(c,Wd,st){
    const n=st.n,krok=st.krok,W=st.W;
    c.fillStyle="rgba(108,179,63,.14)";c.fillRect(0,Wd.y,W,Wd.h);
    c.strokeStyle="rgba(70,120,31,.5)";c.lineWidth=1.6;c.setLineDash([7,5]);
    c.beginPath();c.moveTo(0,Wd.y+5);c.lineTo(W,Wd.y+5);c.stroke();c.setLineDash([]);
    const wyniki=st.wyniki,ap=st.ap,faza=st.faza,spiewaja=st.spiewaja,skok=st.skok,teraz=st.teraz;
    const lw=st.lw,zw=st.zw,zarW=st.zar,ts=st.ts,bezRuchu=st.bezRuchu;
    if(zarW>.05){
      const sw=c.createLinearGradient(0,Wd.y,0,Wd.y+Wd.h);
      sw.addColorStop(0,"rgba(255,216,74,0)");sw.addColorStop(1,"rgba(234,163,43,"+(.22*zarW/3).toFixed(3)+")");
      c.fillStyle=sw;c.fillRect(0,Wd.y,W,Wd.h);
    }
    for(let i=0;i<n;i++){
      const x=krok*(i+.5),podl=Wd.y+Wd.h-lw*.32;
      if(zarW>.05){
        const pul=bezRuchu?1:.75+.25*Math.sin(ts*4+i*1.3),r=zw*(.75+.25*zarW)*pul;
        c.globalAlpha=Math.min(.85,.3*zarW);c.drawImage(blask(i%2?"#ec1a83":"#eaa32b").cv,x-r,podl-zw*.4-r,2*r,2*r);c.globalAlpha=1;
      }
      if(obrazGotowy(IMG.lisc))c.drawImage(IMG.lisc,x-lw/2,podl-lw*.22,lw,lw*.5);
      const ul=faza-Math.floor(faza),hp=(1-ul)*(1-ul)*3;
      const wysk=skok*(wyniki?18:12)*Math.abs(Math.sin(teraz/85+i*1.7));
      const tf=st.G?(teraz-st.fala0-i*35)/320:-1,fl=tf>0&&tf<1?16*Math.sin(Math.PI*tf):0;
      const kl=ap>.12?Math.min(4,1+Math.floor(ap*2.5)+((i+Math.floor(teraz/180))%2))
        :(spiewaja||fl>2)?1+((Math.floor(faza)+i)%3):0,img=IMG.zaby[kl];
      if(!obrazGotowy(img))continue;
      c.save();c.translate(x,podl-zw*.38-hp-wysk-fl);c.rotate(Math.sin(Math.PI*faza+i)*.11*(i%2?1:-1));
      c.drawImage(img,-zw/2,-zw/2,zw,zw);c.restore();
      if(zarW>.4&&!bezRuchu){   // błyski: dwa na żabę, migają na zmianę, więcej i większe przy większym ogniu
        const b=blysk();
        for(let j=0;j<(zarW>2?2:1);j++){
          const ph=Math.sin(ts*(3.1+j*1.7)+i*2.3+j*4),al=Math.pow(Math.max(0,ph),3)*Math.min(1,zarW/2);
          if(al<.05)continue;
          const bx=x+(j?.55:-.5)*zw+Math.sin(i*7.1+j)*4,by=podl-zw*(.95+.35*j)-hp-wysk-fl,bs=(9+5*zarW/3)*(.6+.4*al);
          c.save();c.globalAlpha=al;c.translate(bx,by);c.rotate(ts*1.5+i);c.drawImage(b.cv,-bs/2,-bs/2,bs,bs);c.restore();
        }
      }
    }
  }
  // Zapalniczki: ciemna widownia, co druga żaba (przy kombo i brawach każda) trzyma płomyk kołyszący się w rytm.
  function rysujZapalniczki(c,Wd,st){
    pasCiemny(c,Wd,st,BURSZ);
    const zw=st.zw,mocne=st.zar>.05||st.ap>.1,pl=plomyk(),bl=blask(ZOLTY);
    rzadZab(c,Wd,st,{lisc:false,obraz:kl=>sylwetka(kl,"#6b6150"),po:(c,i,x,y)=>{
      if(!mocne&&i%2)return;
      const hx=x+zw*(i%2?-.36:.36),hy=y-zw*.5;
      c.fillStyle=KOLORY[i%4];c.fillRect(hx-zw*.06,hy,zw*.12,zw*.2);
      c.strokeStyle=TUSZ;c.lineWidth=1;c.strokeRect(hx-zw*.06,hy,zw*.12,zw*.2);
      const migot=st.bezRuchu?1:.85+.15*szum1(st.ts*8+i*3),sk=st.bezRuchu?0:Math.sin(PI*st.faza*.5+i*.4)*.3;
      const fh=zw*(mocne?.56:.44)*migot,fw=fh*.55,r=zw*(mocne?.6:.42);
      c.globalAlpha=mocne?.55:.35;c.drawImage(bl.cv,hx-r,hy-fh*.6-r,2*r,2*r);c.globalAlpha=1;
      c.save();c.translate(hx,hy);c.rotate(sk);c.drawImage(pl.cv,-fw/2,-fh,fw,fh);c.restore();
    }});
  }
  // Głośniki: ściana kolumn za widownią, membrany pulsują na każdą ćwierćnutę, przy kombo żarzą się bursztynem.
  function rysujGlosniki(c,Wd,st){
    pasDomyslny(c,Wd,st);
    const puls=st.G&&!st.wyniki?Math.pow(1-ulamek(st),2):st.ap,h=Wd.h*.84,w=Math.min(st.krok*1.15,h*.62);
    const drga=!st.bezRuchu&&st.zar>.3?Math.min(1.5,st.zar*.5):0;
    for(let i=1;i<st.n;i+=5){
      const x=st.krok*i+(drga?Math.sin(st.ts*40+i)*drga:0),y=Wd.y+Wd.h-h-2;
      c.fillStyle=TUSZ;c.beginPath();c.roundRect(x-w/2,y,w,h,4);c.fill();
      c.strokeStyle="#57503f";c.lineWidth=1;c.strokeRect(x-w/2+2.5,y+2.5,w-5,h-5);
      for(const [cy,rr,mn] of [[y+h*.64,w*.3,.12],[y+h*.24,w*.15,.06]]){
        const r=rr*(1+mn*puls);
        c.fillStyle="#57503f";c.beginPath();c.arc(x,cy,r,0,TAU);c.fill();
        c.fillStyle=TUSZ;c.beginPath();c.arc(x,cy,r*.38,0,TAU);c.fill();
        if(st.zar>.05){c.strokeStyle=rgba(BURSZ,Math.min(1,st.zar/2));c.lineWidth=2;c.beginPath();c.arc(x,cy,r,0,TAU);c.stroke();}
      }
    }
    rzadZab(c,Wd,st);
  }
  // Transparenty: co trzecia żaba trzyma tabliczkę („RIBBIT!”, „BIS!”…); przy kombo „KOMBO!”, na wynikach „BIS!”.
  const NAPISY=["RIBBIT!","BIS!","KUM KUM","PUNK!","ŻABY!","RECHOT!"];
  function rysujTransparenty(c,Wd,st){
    pasDomyslny(c,Wd,st);
    const zw=st.zw,fs=Math.max(7,Math.round(zw*.26));
    rzadZab(c,Wd,st,{po:(c,i,x,y)=>{
      if(i%3!==1)return;
      const nr=(i/3|0),tekst=st.ap>.15?"BIS!":st.zar>=1.5?(nr%2?"OGIEŃ!":"KOMBO!"):NAPISY[nr%NAPISY.length];
      const t=tabliczka(tekst,[ROZ,LIM,BURSZ,PAPIER][nr%4],fs),sx=x+zw*(nr%2?-.12:.12),sy=y-zw*.78;
      c.strokeStyle=TUSZ;c.lineWidth=1.6;c.beginPath();c.moveTo(sx,sy);c.lineTo(sx,y-zw*.1);c.stroke();
      const kat=st.bezRuchu?0:Math.sin(st.ts*2.4+i)*.1+(st.zar>=1.5?Math.sin(st.ts*12+i)*.08:0);
      c.save();c.translate(sx,sy);c.rotate(kat);c.drawImage(t.cv,-t.w/2,-t.h/2,t.w,t.h);c.restore();
    }});
  }
  // Pogo: żaby w irokezach skaczą na zmianę; przy kombo środek widowni robi mosh pit w obrożach z kolcami.
  function rysujPogo(c,Wd,st){
    pasDomyslny(c,Wd,st,"rgba(236,26,131,.55)");
    const n=st.n,ruch=st.mini?0:(st.spiewaja||st.ap>.05?9:3),mosh=st.zar>.5;
    const wSrodku=i=>Math.abs(i-(n-1)/2)<n/6;
    const kol=[LIM,BURSZ,ROZ,"#5b8cff","#8e6fe6"];
    rzadZab(c,Wd,st,{obraz:(kl,i)=>zabaIrokez(kl,kol[i%kol.length]),
      unies:i=>ruch*Math.abs(Math.sin(PI*st.faza+(i%2)*PI/2))+(mosh&&wSrodku(i)&&!st.bezRuchu?st.zar*3*Math.abs(Math.sin(st.ts*7+i)):0),
      kat:(i,k)=>k+(mosh&&wSrodku(i)&&!st.bezRuchu?Math.sin(st.ts*6+i)*.3*Math.min(1,st.zar/2):0),
      na:(c,i,zw)=>{if(mosh&&wSrodku(i))c.drawImage(obroza().cv,-zw*.32,zw*.2,zw*.64,zw*.22);}});
  }
  // Telefony: ciemna widownia z ekranami w górze, jasność płynie falą; przy kombo ekrany migają kolorami.
  function rysujTelefony(c,Wd,st){
    pasCiemny(c,Wd,st,LIM);
    const zw=st.zw,mocne=st.zar>.05||st.ap>.1,sto=stozekSwiatla();
    rzadZab(c,Wd,st,{lisc:false,obraz:kl=>sylwetka(kl,"#6b6150"),po:(c,i,x,y)=>{
      if(!mocne&&i%2)return;
      const b=st.bezRuchu?.8:.55+.45*Math.sin(st.ts*2.5-i*.55),pw=zw*.28,ph=zw*.44,px=x+zw*(i%2?-.32:.32)-pw/2,py=y-zw*.42-ph;
      c.globalAlpha=(mocne?.5:.28)*b;c.drawImage(sto.cv,px+pw/2-zw*.38,py-zw*.75,zw*.76,zw*.8);c.globalAlpha=1;
      c.fillStyle=TUSZ;c.beginPath();c.roundRect(px,py,pw,ph,2);c.fill();
      c.fillStyle=mocne&&!st.bezRuchu?KOLORY[(i+Math.floor(st.ts*4))%4]:rgba(PAPIER,.45+.55*b);
      c.fillRect(px+1.5,py+2,pw-3,ph-4);
    }});
  }
  // Neon: ciemna scena, żaby jako świecące obrysy w kolorze partii; przy kombo neony migoczą.
  function rysujNeon(c,Wd,st){
    pasCiemny(c,Wd,st,st.akcent);
    c.fillStyle=rgba(st.akcent,.35);c.fillRect(0,Wd.y+2,st.W,3);
    const kol=[st.akcent,LIM,ROZ,BURSZ].filter((k,j,a)=>a.indexOf(k)===j),mig=st.zar>.4&&!st.spokoj;
    rzadZab(c,Wd,st,{lisc:false,obraz:(kl,i)=>neonZaba(kl,kol[i%kol.length]),
      alfa:i=>mig?(szum1(st.ts*14+i*3.7)>.18?1:.35):1,
      pod:(c,i,x,y)=>{const r=st.zw*(.7+.25*Math.min(3,st.zar)/3);c.globalAlpha=.18+.12*Math.min(3,st.zar);
        c.drawImage(blask(kol[i%kol.length]).cv,x-r,y-r,2*r,2*r);c.globalAlpha=1;}});
  }
  // Graffiti: ściana z graffiti za widownią; przy kombo i brawach na ścianę lecą bryzgi farby.
  const splaty=[];let ostSplat=0;
  function rysujSprej(c,Wd,st){
    const sc=sciana(st.W,Wd.h);c.drawImage(sc.cv,0,Wd.y,st.W,Wd.h);
    c.fillStyle=TUSZ;c.fillRect(0,Wd.y+Wd.h-4,st.W,4);
    if(!st.spokoj&&!st.mini){
      const t=st.teraz;
      if((st.skok>.85||st.ap>.2)&&t-ostSplat>(st.ap>.2?170:300)){
        ostSplat=t;splaty.push({x:Math.random()*st.W,y:Wd.y+Wd.h*(.15+Math.random()*.4),k:KOLORY[Math.random()*3|0],
          r:Wd.h*(.2+Math.random()*.18),od:t,rot:(Math.random()-.5)*.8});
        if(splaty.length>14)splaty.shift();
      }
      for(let j=splaty.length-1;j>=0;j--){
        const s=splaty[j],wiek=t-s.od;if(wiek>5000||wiek<0){splaty.splice(j,1);continue;}
        const r=s.r*Math.min(1,.4+wiek/80),pl=plama(s.k);
        c.globalAlpha=Math.min(1,(5000-wiek)/1500);c.save();c.translate(s.x,s.y);c.rotate(s.rot);
        c.drawImage(pl.cv,-r,-r,2*r,2*r);c.restore();c.globalAlpha=1;
      }
    }
    rzadZab(c,Wd,st,{lisc:false});
  }
  // Reflektory: ciemna scena, snopy światła z dołu przeczesują widownię; przy kombo szybciej i więcej snopów.
  function rysujReflektory(c,Wd,st){
    pasCiemny(c,Wd,st,ROZ);
    const nb=st.mini?2:(st.zar>1?6:4),kol=[ROZ,BURSZ,LIM,NIEB,ROZ,LIM],hg=Wd.h*1.8,szyb=.5+.35*Math.min(3,st.zar);
    c.save();c.globalCompositeOperation="lighter";
    for(let k=0;k<nb;k++){
      const bx=st.W*(k+.5)/nb,by=Wd.y+Wd.h,kat=st.bezRuchu?.3*(k%2?1:-1):Math.sin(st.ts*szyb+k*1.9)*.55;
      c.save();c.translate(bx,by);c.rotate(kat);c.globalAlpha=.5+.4*Math.min(1,st.zar/2);
      c.drawImage(snop(kol[k%kol.length]).cv,-hg*.17,-hg,hg*.34,hg);c.restore();
    }
    c.restore();
    rzadZab(c,Wd,st,{lisc:false});
  }
  // Pirotechnika: dysze między żabami; przy kombo i brawach strzelają słupami ognia z iskrami.
  function rysujPirotechnike(c,Wd,st){
    pasDomyslny(c,Wd,st,"rgba(234,163,43,.6)");
    const moc=Math.max(Math.min(1,st.zar/3),Math.min(1,st.ap)),dol=Wd.y+Wd.h-3;
    for(let i=3;i<st.n;i+=6){
      const x=st.krok*i;
      if(!st.spokoj){
        const h=moc>.08?Wd.h*(.6+1.2*moc)*(.75+.25*szum1(st.ts*9+i)):Wd.h*.16*(.8+.2*szum1(st.ts*6+i));
        c.save();c.globalCompositeOperation="lighter";
        for(let j=0;j<3;j++)rysujJezyk(c,jezykOgnia((j+i)%6).cv,x+(j-1)*4,dol-6,h*(1-.25*Math.abs(j-1)),(szum1(st.ts*3+j+i)-.5)*.3,j%2===1);
        if(moc>.08){
          c.fillStyle=ZOLTY;
          for(let k=0;k<6;k++){const ph=(st.ts*1.4+k*.17+i*.07)%1,sx=x+(k-2.5)*ph*9,sy=dol-6-ph*h*1.15+ph*ph*h*.6;
            c.globalAlpha=1-ph;c.fillRect(sx-1,sy-1,2,2);}
          c.globalAlpha=1;
        }
        c.restore();
      }
      c.fillStyle=TUSZ;c.fillRect(x-6,dol-8,12,9);c.fillStyle="#57503f";c.fillRect(x-4,dol-8,8,2);
    }
    rzadZab(c,Wd,st);
  }
  // Crowdsurfing: żaba w kolorze właściciela sceny płynie po głowach widowni; przy śpiewie i kombo dołączają kolejne.
  function rysujCrowdsurfing(c,Wd,st){
    pasDomyslny(c,Wd,st);
    const zw=st.zw,ns=st.mini?1:1+(st.spiewaja?1:0)+(st.zar>1.5?1:0)+(st.ap>.2?1:0),xs=[],okres=st.W+zw*3;
    for(let k=0;k<ns;k++)xs.push(st.mini?st.W*.5:((st.bezRuchu?0:st.ts*(k%2?52:42))+k*okres/ns+k*37)%okres-zw*1.5);
    const blisko=x=>xs.some(s=>Math.abs(s-x)<st.krok*1.3);
    rzadZab(c,Wd,st,{unies:i=>blisko(st.krok*(i+.5))?4:0,po:(c,i,x,y)=>{
      if(!blisko(x))return;
      c.fillStyle=ZIEL;c.strokeStyle=TUSZ;c.lineWidth=1.1;
      for(const s of [-1,1]){c.beginPath();c.ellipse(x+s*zw*.28,y-zw*.48,zw*.08,zw*.12,s*.3,0,TAU);c.fill();c.stroke();}
    }});
    const podl=Wd.y+Wd.h-st.lw*.32,sy=podl-zw*.38-hop(st)-zw*.72;
    for(let k=0;k<ns;k++){
      const im=zabaNaklejka(k%2?4:3,k?KOLORY[k%4]:st.kolor,true);if(!im)continue;
      const s=zw*1.1*im.w/96,kat=-.55+(st.bezRuchu?0:Math.sin(st.ts*5+k)*.18);
      c.save();c.translate(xs[k],sy+(st.bezRuchu?0:Math.sin(st.ts*6+k*2)*2));c.rotate(kat);c.drawImage(im.cv,-s/2,-s/2,s,s);c.restore();
    }
  }
  // Kolce: szkocka krata w tle, żaby w obrożach z kolcami i agrafkach; przy kombo headbanging i błyski na kolcach.
  function rysujKolce(c,Wd,st){
    const kr=krata(st.W,Wd.h);c.drawImage(kr.cv,0,Wd.y,st.W,Wd.h);
    c.fillStyle=TUSZ;c.fillRect(0,Wd.y,st.W,2);
    const bang=st.zar>.3&&!st.bezRuchu,ob=obroza(),ag=agrafka();
    rzadZab(c,Wd,st,{lisc:false,
      kat:(i,k)=>k+(bang?Math.sin(st.ts*9+i*.5)*.28*Math.min(1,st.zar/2):0),
      na:(c,i,zw)=>{
        c.drawImage(ob.cv,-zw*.32,zw*.24,zw*.64,zw*.22);
        if(i%2===0)c.drawImage(ag.cv,-zw*.47,-zw*.18,zw*.15,zw*.26);
        if(st.zar>.4&&!st.spokoj&&i%3===0){const al=Math.pow(Math.max(0,Math.sin(st.ts*3.3+i*2.1)),3);
          if(al>.05){const b=blysk(),bs=zw*.32*(.6+.4*al);c.globalAlpha=al;c.drawImage(b.cv,zw*.1-bs/2,zw*.27-bs/2,bs,bs);c.globalAlpha=1;}}
      }});
  }
  // Czaszki: ciemna scena, czaszki w irokezach z płonącymi oczami; przy kombo między irokezami strzelają błyskawice.
  function rysujCzaszki(c,Wd,st){
    pasCiemny(c,Wd,st,"#b8264a");
    const g=c.createLinearGradient(0,Wd.y+Wd.h*.4,0,Wd.y+Wd.h);
    g.addColorStop(0,"rgba(184,38,74,0)");g.addColorStop(1,"rgba(184,38,74,"+(.25+.1*Math.min(3,st.zar)).toFixed(3)+")");
    c.fillStyle=g;c.fillRect(0,Wd.y,st.W,Wd.h);
    const ocz=oczy(st.zar>1.5?"#ff4060":ROZ),pozycje=[];
    rzadZab(c,Wd,st,{lisc:false,obraz:(kl,i)=>czaszka(kl>0,KOLORY[i%3]),
      na:(c,i,zw)=>{c.globalAlpha=Math.min(1,(st.bezRuchu?.85:.6+.4*szum1(st.ts*6+i*2.3))*(.8+.1*Math.min(2,st.zar)));
        c.drawImage(ocz.cv,-zw/2,-zw/2,zw,zw);c.globalAlpha=1;},
      po:(c,i,x,y)=>pozycje.push([x,y-st.zw*.42])});
    if(st.zar>.6&&!st.spokoj){
      c.save();c.globalCompositeOperation="lighter";c.lineJoin="round";
      const ile=st.zar>2?3:st.zar>1.2?2:1,klatkaT=Math.floor(st.ts*12);
      for(let k=0;k<ile;k++){
        if(szum1(st.ts*3+k*7.3)<.45)continue;
        const a=Math.floor(los(Math.floor(st.ts*4)+k*13)*(pozycje.length-1)),p=pozycje[a],q=pozycje[a+1];if(!p||!q)continue;
        piorun(c,p[0],p[1]-st.zw*.08,q[0],q[1]-st.zw*.08,7,st.zw*.35,klatkaT*3+k*17,"rgba(166,216,97,.5)");
      }
      c.restore();
    }
  }

  // =========================================================================================== streaki
  // Zygzak błyskawicy z (x0,y0) do (x1,y1): poświata i jasny rdzeń (wołać w trybie „lighter”).
  function piorun(c,x0,y0,x1,y1,seg,amp,ziarno,poswiata){
    const dx=x1-x0,dy=y1-y0,d=Math.hypot(dx,dy)||1,nx=-dy/d,ny=dx/d;
    c.beginPath();c.moveTo(x0,y0);
    for(let s=1;s<seg;s++){const t=s/seg,o=(los(ziarno+s*1.7)-.5)*2*amp*Math.sin(PI*t);c.lineTo(x0+dx*t+nx*o,y0+dy*t+ny*o);}
    c.lineTo(x1,y1);
    c.strokeStyle=poswiata||"rgba(91,140,255,.5)";c.lineWidth=4.5;c.stroke();
    c.strokeStyle=PAPIER;c.lineWidth=1.5;c.stroke();
  }
  function sciezka(c,pts){
    c.beginPath();let pi=false;
    for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
  }
  const gradX=(c,x0,x1,kolor,a0,a1)=>{const g=c.createLinearGradient(x0,0,x1,0);g.addColorStop(0,rgba(kolor,a0));g.addColorStop(1,rgba(kolor,a1));return g;};

  // Palety ognia (ten sam sprite języka, inne barwy): niebieski, złoty, piekielny.
  const PAL={
    niebieski:{id:"nieb",baza:["rgba(235,250,255,.95)","rgba(150,215,255,.88)","rgba(60,130,255,.7)","rgba(90,60,230,.3)","rgba(90,60,230,0)"],
      rdzen:["rgba(255,255,255,.95)","rgba(200,235,255,.6)","rgba(160,215,255,0)"],blask:["#7fb6ff","#3f78ff"],
      rabek:["80,150,255","210,240,255"],smuga:["90,60,230","60,130,255","170,220,255"]},
    zloto:{id:"zloto",baza:["rgba(255,252,220,.95)","rgba(255,226,100,.9)","rgba(240,175,30,.72)","rgba(200,120,0,.3)","rgba(200,120,0,0)"],
      rdzen:["rgba(255,255,245,.95)","rgba(255,240,170,.6)","rgba(255,220,120,0)"],blask:["#ffe066","#f0b020"],
      rabek:["240,175,30","255,245,190"],smuga:["200,120,0","240,175,30","255,226,100"]},
    piekielny:{id:"piek",baza:["rgba(255,190,150,.92)","rgba(245,60,70,.88)","rgba(180,20,90,.7)","rgba(110,20,170,.32)","rgba(110,20,170,0)"],
      rdzen:["rgba(255,235,220,.95)","rgba(255,120,110,.6)","rgba(255,80,90,0)"],blask:["#ff4060","#8e2fd0"],
      rabek:["245,60,70","255,200,170"],smuga:["110,20,170","180,20,90","245,60,70"],dym:"#4a1028"}};
  function ogienZPaleta(pal){
    return {
      glowa:(c,sc,og,ts,z,przod)=>rysujOgienGlowy(c,sc,og,ts,z,przod,pal),
      slad:(c,k)=>rysujSladPlonacyPkt(c,k.pts,k.og,k.ts,k.x0,k.xT,k.dlug,k.ziarno,pal,k.pelna,k.emituj),
      nuty:(c,w,nh,fx,p,ts,z,a,g)=>rysujSpalenizneNuty(c,w,nh,fx,p,ts,z,a,g,pal),
      pal,
      rozgrzej:()=>{for(let k=0;k<6;k++)jezykOgnia(k,pal);for(const b of pal?pal.blask:[])blask(b);}};
  }

  // ---- pixel: ogień 8-bit z grubych kwadratów, ślad schodkowy ----
  function kwadratyOgnia(c,kols,x,y,ile,q){   // słupek kwadratów od (x,y) w górę, kolory od dołu
    for(let b=0;b<ile;b++){c.fillStyle=kols[b<ile*.4?0:b<ile*.75?1:2];c.fillRect(Math.round(x-q/2),Math.round(y-(b+1)*q),q,q);}
  }
  const PIX=[ZOLTY,BURSZ,ROZ];
  const pixel={
    glowa(c,sc,og,ts,z,przod){
      const q=Math.max(2,Math.round(sc*.075)),duzy=og>=3,top=-sc*.4,tk=Math.floor(ts*10);
      if(przod){c.fillStyle=ZOLTY;for(let j=-1;j<=1;j++)c.fillRect(Math.round(j*q-q/2),Math.round(top-q*.5),q,q);return;}
      const n=duzy?7:5;
      for(let j=0;j<n;j++){const u=n>1?j/(n-1)-.5:0,hb=Math.max(1,Math.round((duzy?6:4)*(.45+.55*los(tk+j*3.1+z))*(1-.55*Math.abs(u)*2)));
        kwadratyOgnia(c,PIX,u*sc*.75,top+q,hb,q);}
    },
    slad(c,k){
      const q=4;c.lineJoin="miter";c.lineCap="butt";
      c.beginPath();let pi=false,py=0;
      for(const p of k.pts){if(!p.sp){pi=false;continue;}const X=Math.round(p.x/q)*q,Y=Math.round(p.y/q)*q;
        if(pi){c.lineTo(X,py);c.lineTo(X,Y);}else{c.moveTo(X,Y);pi=true;}py=Y;}
      c.strokeStyle=gradX(c,k.x0,k.xT,BURSZ,0,.9);c.lineWidth=k.og>=3?8:k.og>=2?6:4;c.stroke();
      c.strokeStyle=gradX(c,k.x0,k.xT,ZOLTY,0,1);c.lineWidth=2;c.stroke();
      if(!k.pelna||k.og<2)return;
      let ost=-1e9,nr=0;const tk=Math.floor(k.ts*10);
      for(const p of k.pts){if(!p.sp||p.x-ost<q*4||p.x<k.x0)continue;ost=p.x;nr++;
        const f=(p.x-k.x0)/k.dlug;if(f<.3)continue;
        kwadratyOgnia(c,PIX,Math.round(p.x/q)*q,Math.round(p.y/q)*q-q,Math.max(1,Math.round((k.og>=3?4:2)*f*(.5+.5*los(tk+nr)))),q);}
    },
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const q=3,x0=-w/2,x1=w/2;fx=Math.max(x0,Math.min(x1,fx));
      if(fx>x0+1){c.fillStyle="rgba(58,36,26,.72)";c.beginPath();
        for(let y=-nh/2;y<nh/2;y+=q){const xq=Math.min(x1,Math.round((fx+(los(Math.round(y)*.3+z*9+Math.floor(ts*6))-.5)*6)/q)*q);c.rect(x0,y,Math.max(0,xq-x0),q);}
        c.fill();c.fillStyle=BURSZ;for(let y=-nh/2;y<nh/2;y+=q*2)c.fillRect(Math.round(fx/q)*q-q,y,q,q);}
      if(gas<=0)return;
      const hb=Math.max(1,Math.round((aktywna?4:2)*gas*(.6+.4*los(Math.floor(ts*10)+z))));
      for(let j=-1;j<=1;j++)kwadratyOgnia(c,PIX,fx+j*q,-nh/2+1,Math.max(1,hb-Math.abs(j)),q);
    },
    iskry:{kolory:PIX,ksztalt:"kwadrat"},dym:false};

  // ---- konfetti: fontanna konfetti z głowy, ślad to serpentyna ----
  const konfetti={
    glowa(c,sc,og,ts,z,przod){
      if(przod)return;
      const n=og>=3?14:9;
      for(let j=0;j<n;j++){
        const ph=(ts*1.1+j*.618+z*.1)%1,s=j%2?1:-1,x=s*(sc*.08+sc*.55*ph*(.6+.4*los(j*3.3+z))),y=-sc*.42-sc*1.3*ph+sc*1.1*ph*ph;
        const ww=sc*.15*(.3+.7*Math.abs(Math.cos(ts*6+j))),hh=sc*.075;
        c.globalAlpha=1-ph*ph*ph;c.fillStyle=KOLORY[j%4];c.fillRect(x-ww/2,y-hh/2,ww,hh);
      }
      c.globalAlpha=1;
    },
    slad(c,k){
      sciezka(c,k.pts);c.lineCap="butt";c.lineJoin="round";c.lineWidth=k.og>=3?6:k.og>=2?5:3;
      c.setLineDash([9,7]);c.lineDashOffset=0;c.strokeStyle=gradX(c,k.x0,k.xT,ROZ,0,1);c.stroke();
      c.lineDashOffset=8;c.strokeStyle=gradX(c,k.x0,k.xT,LIM,0,1);c.stroke();c.setLineDash([]);c.lineDashOffset=0;
      if(!k.pelna||k.og<2)return;
      let ost=-1e9,nr=0;
      for(const p of k.pts){if(!p.sp||p.x-ost<16||p.x<k.x0)continue;ost=p.x;nr++;
        const f=(p.x-k.x0)/k.dlug,dy=(los(nr*2.3+k.ziarno)-.5)*22+(1-f)*10;
        c.globalAlpha=Math.min(1,f*1.6);c.fillStyle=KOLORY[nr%4];c.fillRect(p.x-2,p.y+dy-1.2,4*Math.abs(Math.cos(k.ts*5+nr))+1,2.4);}
      c.globalAlpha=1;
    },
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      const ile=Math.min(14,Math.floor((fx-x0)/5));
      for(let k=0;k<ile;k++){c.fillStyle=KOLORY[k%4];c.fillRect(x0+los(k*3.7+z)*(fx-x0)-1.5,-nh/2+los(k*5.3+z)*nh-1,3,2);}
      if(gas<=0||!aktywna)return;
      for(let j=0;j<4;j++){const ph=(ts*1.6+j*.25)%1;c.globalAlpha=gas*(1-ph);c.fillStyle=KOLORY[j];
        c.fillRect(fx+(j-1.5)*ph*8-1.5,-nh/2-ph*nh*1.4,3,2);}
      c.globalAlpha=1;
    },
    aura:[LIM,ROZ],iskry:{kolory:[ROZ,LIM,BURSZ],ksztalt:"pasek"},dym:false,
    tlo:{promienie:[["236,26,131",.5],["166,216,97",.45]]}};

  // ---- gwiazdy: korona migoczących gwiazdek nad głową, ślad ze złotego pyłu ----
  const gwiazdy={
    glowa(c,sc,og,ts,z,przod){
      if(przod)return;
      const n=og>=3?7:5,b=blysk().cv;
      c.globalAlpha=.35;const r0=sc*.7;c.drawImage(blask(ZOLTY).cv,-r0,-sc*.55-r0,2*r0,2*r0);
      for(let j=0;j<n;j++){
        const a=-PI/2+(j/(n-1)-.5)*PI*.8+Math.sin(ts*.6)*.15,tw=.5+.5*Math.sin(ts*5+j*2.1+z);
        const s=sc*(.17+.09*tw)*(og>=3?1.2:1),x=Math.cos(a)*sc*.62,y=-sc*.15+Math.sin(a)*sc*.62;
        c.globalAlpha=.65+.35*tw;c.save();c.translate(x,y);c.rotate(ts*.8+j);c.drawImage(b,-s/2,-s/2,s,s);c.restore();
      }
      c.globalAlpha=1;
    },
    slad(c,k){
      sciezka(c,k.pts);c.lineCap="round";c.lineJoin="round";
      c.strokeStyle=gradX(c,k.x0,k.xT,BURSZ,0,.9);c.lineWidth=k.og>=3?4:3;c.stroke();
      c.strokeStyle=gradX(c,k.x0,k.xT,ZOLTY,0,1);c.lineWidth=1.3;c.stroke();
      if(!k.pelna||k.og<2)return;
      const b=blysk().cv;let ost=-1e9,nr=0;
      for(const p of k.pts){if(!p.sp||p.x-ost<22||p.x<k.x0)continue;ost=p.x;nr++;
        const f=(p.x-k.x0)/k.dlug,tw=.5+.5*Math.sin(k.ts*6+nr*1.7),s=(5+(k.og>=3?8:5)*f)*(.6+.4*tw);
        c.globalAlpha=f*(.6+.4*tw);c.drawImage(b,p.x-s/2,p.y-s/2-4*(1-f),s,s);}
      c.globalAlpha=1;
    },
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(255,216,74,.32)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas<=0)return;
      const b=blysk().cv,ile=poziom>=2?3:1;
      for(let j=0;j<ile;j++){const tw=.5+.5*Math.sin(ts*7+j*2+z),s=nh*(.8+.5*tw);
        c.globalAlpha=gas*(.6+.4*tw);c.drawImage(b,fx-s/2+(j?(j===1?-6:5):0),-nh/2-s*.3-j*4,s,s);}
      c.globalAlpha=1;
    },
    aura:[ZOLTY,BURSZ],wypelnienie:[ZOLTY,"#ffe9a0",BURSZ],iskry:{kolory:[ZOLTY,PAPIER,BURSZ],ksztalt:"gwiazda"},dym:false,
    tlo:{promienie:[["255,216,74",.5],["234,163,43",.45]]}};

  // ---- neon: świecąca rurka neonu na głowie i smuga światła zamiast śladu ----
  function neonKreska(c,kolor,szer,mig){
    c.globalAlpha=.22*mig;c.strokeStyle=kolor;c.lineWidth=szer*3.2;c.stroke();
    c.globalAlpha=.85*mig;c.lineWidth=szer;c.stroke();
    c.globalAlpha=mig;c.strokeStyle=PAPIER;c.lineWidth=Math.max(1,szer*.35);c.stroke();c.globalAlpha=1;
  }
  const neon={
    glowa(c,sc,og,ts,z,przod){
      const mig=.82+.18*szum1(ts*13+z),hh=sc*(og>=3?.62:.45);
      c.save();c.globalCompositeOperation="lighter";c.lineJoin="round";c.lineCap="round";
      if(przod){c.beginPath();c.arc(0,-sc*.05,sc*.5,-PI*.82,-PI*.18);neonKreska(c,LIM,sc*.035,mig);c.restore();return;}
      c.beginPath();c.moveTo(-sc*.28,-sc*.36);
      for(let j=0;j<5;j++){const x=-sc*.28+sc*.112*(j+.5),top=-sc*.38-hh*(j===2?1:j%2?.8:.6);c.lineTo(x,top);c.lineTo(-sc*.28+sc*.112*(j+1),-sc*.38);}
      neonKreska(c,ROZ,sc*.045,mig);c.restore();
    },
    slad(c,k){
      c.save();c.globalCompositeOperation="lighter";c.lineCap="round";c.lineJoin="round";sciezka(c,k.pts);
      c.strokeStyle=gradX(c,k.x0,k.xT,ROZ,0,.22);c.lineWidth=k.og>=3?14:10;c.stroke();
      c.strokeStyle=gradX(c,k.x0,k.xT,ROZ,0,.8);c.lineWidth=k.og>=3?5:4;c.stroke();
      c.strokeStyle=gradX(c,k.x0,k.xT,PAPIER,0,1);c.lineWidth=1.6;c.stroke();
      c.restore();
    },
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      c.save();c.globalCompositeOperation="lighter";
      if(fx>x0+2){c.beginPath();c.rect(x0+1,-nh/2+1,fx-x0-2,nh-2);neonKreska(c,LIM,1.6,1);}
      if(gas>0){c.globalAlpha=gas;c.fillStyle=ROZ;c.fillRect(fx-1.5,-nh/2-3,3,nh+6);c.fillStyle=PAPIER;c.fillRect(fx-.5,-nh/2-2,1,nh+4);}
      c.restore();
    },
    aura:[ROZ,LIM],wypelnienie:[ROZ,"#ff5ab0",LIM],iskry:{kolory:[ROZ,LIM,PAPIER]},dym:false,
    scena:["236,26,131","166,216,97","236,26,131"],tlo:{promienie:[["236,26,131",.55],["166,216,97",.4]],swiatlo:["236,26,131","166,216,97"]}};

  // ---- raca: kolorowy dym jak z racy na koncercie ----
  const raca={
    glowa(c,sc,og,ts,z,przod){
      if(przod){c.save();c.globalCompositeOperation="lighter";const r=sc*.35;c.drawImage(blask(ROZ).cv,-r,-sc*.48-r,2*r,2*r);
        const r2=sc*.14;c.drawImage(blask(ZOLTY).cv,-r2,-sc*.48-r2,2*r2,2*r2);c.restore();return;}
      for(let j=0;j<(og>=3?5:4);j++){const ph=(ts*.8+j*.25+z*.07)%1,r=sc*(.25+.45*ph),kol=j%2?LIM:ROZ;
        c.globalAlpha=.6*(1-ph);c.drawImage(dymekKolor(kol).cv,(los(j+z)-.5)*sc*.3-r,-sc*.5-sc*1.2*ph-r,2*r,2*r);}
      c.globalAlpha=1;
    },
    slad(c,k){
      let ost=-1e9,nr=0;
      if(k.pelna)for(const p of k.pts){if(!p.sp||p.x-ost<14||p.x<k.x0)continue;ost=p.x;nr++;
        const f=(p.x-k.x0)/k.dlug,r=(5+11*(1-f))*(k.og>=3?1.3:1);
        c.globalAlpha=.55*Math.min(1,f*2);c.drawImage(dymekKolor(nr%2?LIM:ROZ).cv,p.x-r,p.y-r-(1-f)*8,2*r,2*r);}
      c.globalAlpha=1;sciezka(c,k.pts);c.lineCap="round";c.lineJoin="round";
      c.strokeStyle=gradX(c,k.x0,k.xT,ROZ,0,.9);c.lineWidth=k.og>=2?4:3;c.stroke();
    },
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(40,28,22,.5)";c.fillRect(x0,-nh/2,fx-x0,nh);}
      if(gas<=0)return;
      const r=nh*(aktywna?1.1:.8)*(.85+.15*szum1(ts*5+z));c.globalAlpha=.6*gas;
      c.drawImage(dymekKolor(ROZ).cv,fx-r,-nh/2-r*.9,2*r,2*r);c.globalAlpha=1;
    },
    aura:[ROZ,"#b8264a"],iskry:{kolory:[ROZ,BURSZ,ZOLTY]},dym:ROZ,
    tlo:{promienie:[["236,26,131",.6],["184,38,74",.45]]}};

  // ---- piorun: wyładowania zygzakiem z głowy, ślad to iskrzący kabel ----
  const piorunStyl={
    glowa(c,sc,og,ts,z,przod){
      const tk=Math.floor(ts*14);
      c.save();c.globalCompositeOperation="lighter";c.lineJoin="round";c.lineCap="round";
      if(przod){if(og>=3)piorun(c,-sc*.38,-sc*.25,sc*.38,-sc*.25,6,sc*.1,tk*7+z);c.restore();return;}
      const r0=sc*.6;c.globalAlpha=.35;c.drawImage(blask("#5b8cff").cv,-r0,-sc*.45-r0,2*r0,2*r0);c.globalAlpha=1;
      const n=og>=3?5:3;
      for(let j=0;j<n;j++){const a=-PI/2+(j/(n-1)-.5)*1.6+(los(tk+j)-.5)*.3,d=sc*(.85+.5*los(tk*3+j+z));
        piorun(c,Math.cos(a)*sc*.3,-sc*.2+Math.sin(a)*sc*.3,Math.cos(a)*d,-sc*.2+Math.sin(a)*d,6,sc*.12,tk*11+j*5+z);}
      c.restore();
    },
    slad(c,k){
      sciezka(c,k.pts);c.lineCap="round";c.lineJoin="round";
      c.strokeStyle=TUSZ;c.lineWidth=k.og>=3?5:4;c.stroke();c.strokeStyle="#6b6450";c.lineWidth=1.3;c.stroke();
      if(!k.pelna||k.og<2)return;
      const tk=Math.floor(k.ts*16),pocz=k.xT-k.dlug*.38,wyb=[];
      for(const p of k.pts)if(p.sp&&p.x>=pocz)wyb.push(p);
      if(wyb.length<3)return;
      c.save();c.globalCompositeOperation="lighter";c.beginPath();
      wyb.forEach((p,i)=>{if(i%3)return;const o=(los(tk+i*1.3)-.5)*(k.og>=3?12:8);if(i)c.lineTo(p.x,p.y+o);else c.moveTo(p.x,p.y+o);});
      c.strokeStyle="rgba(91,140,255,.55)";c.lineWidth=4;c.stroke();c.strokeStyle=PAPIER;c.lineWidth=1.3;c.stroke();
      c.fillStyle=PAPIER;for(let j=0;j<2;j++){const p=wyb[Math.floor(los(tk*2+j)*wyb.length)];c.fillRect(p.x-1,p.y-1+(los(tk+j*9)-.5)*10,2,2);}
      c.restore();
    },
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(33,31,40,.55)";c.fillRect(x0,-nh/2,fx-x0,nh);
        if(fx-x0>12){c.save();c.globalCompositeOperation="lighter";c.globalAlpha=.6;piorun(c,x0+2,0,fx-2,0,Math.max(3,Math.round((fx-x0)/10)),nh*.35,z*31,"rgba(91,140,255,.35)");c.restore();}}
      if(gas<=0)return;
      c.save();c.globalCompositeOperation="lighter";c.globalAlpha=gas;
      piorun(c,fx,-nh/2-nh*.6,fx,nh/2+2,5,nh*.3,Math.floor(ts*16)+z*7);c.restore();
    },
    aura:[NIEB,"#5b8cff"],wypelnienie:[PAPIER,"#5b8cff",NIEB],iskry:{kolory:[PAPIER,"#5b8cff",ZOLTY]},dym:false,
    scena:["120,170,255","41,74,168","41,74,168"],tlo:{promienie:[["41,74,168",.6],["255,216,74",.35]],swiatlo:["170,200,255","41,74,168"]}};

  // ---- kwas: zielony glut na głowie, kapiący ślad, dziury wypalone w taśmie ----
  const kwas={
    glowa(c,sc,og,ts,z,przod){
      if(przod){c.fillStyle=PAPIER;c.globalAlpha=.8;c.beginPath();c.arc(-sc*.08,-sc*.46,sc*.03,0,TAU);c.arc(sc*.12,-sc*.43,sc*.02,0,TAU);c.fill();c.globalAlpha=1;return;}
      c.fillStyle=ZIEL;c.strokeStyle=TUSZ;c.lineWidth=1.2;c.beginPath();
      const n=og>=3?5:4;
      for(let j=0;j<n;j++){const u=j/(n-1)-.5,r=sc*(.13+.05*Math.sin(ts*4+j*2+z));c.moveTo(u*sc*.55+r,-sc*.4);c.arc(u*sc*.55,-sc*.4,r,0,TAU);}
      c.fill();c.fillStyle=LIM;c.beginPath();
      for(const s of [-1,1]){const ph=(ts*.7+(s>0?.5:0)+z*.1)%1,x=s*sc*.33,y=-sc*.3+ph*sc*.45;c.moveTo(x+sc*.05,y);c.ellipse(x,y,sc*.05,sc*.08+ph*sc*.05,0,0,TAU);}
      c.fill();
      c.strokeStyle=LIM;c.lineWidth=1.2;c.beginPath();
      for(let j=0;j<3;j++){const ph=(ts*.9+j*.33)%1,x=(los(j+z)-.5)*sc*.5,y=-sc*.55-ph*sc*.7,r=sc*.04*(1+ph);c.moveTo(x+r,y);c.arc(x,y,r,0,TAU);}
      c.globalAlpha=.8;c.stroke();c.globalAlpha=1;
    },
    slad(c,k){
      sciezka(c,k.pts);c.lineCap="round";c.lineJoin="round";
      c.strokeStyle=gradX(c,k.x0,k.xT,LIM,0,.95);c.lineWidth=k.og>=3?6:4;c.stroke();
      c.strokeStyle=gradX(c,k.x0,k.xT,"#46781f",0,.9);c.lineWidth=1.4;c.stroke();
      if(!k.pelna||k.og<2)return;
      let ost=-1e9,nr=0;c.fillStyle=LIM;
      for(const p of k.pts){if(!p.sp||p.x-ost<18||p.x<k.x0)continue;ost=p.x;nr++;
        const f=(p.x-k.x0)/k.dlug,L=3+(k.og>=3?14:9)*(1-f)*(.5+.5*los(nr*2.1+k.ziarno));
        c.globalAlpha=Math.min(1,f*1.8);c.fillRect(p.x-1,p.y,2,L);c.beginPath();c.arc(p.x,p.y+L,2.1,0,TAU);c.fill();}
      c.globalAlpha=1;
    },
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      const ile=Math.min(6,Math.floor((fx-x0)/10));
      for(let k=0;k<ile;k++){
        const hx=x0+(k+.5)/ile*(fx-x0)+(los(k*1.9+z)-.5)*4,hy=(los(k*2.7+z)-.5)*nh*.45,r=nh*(.16+.14*los(k*1.3+z));
        c.fillStyle="#2a2a20";c.beginPath();c.ellipse(hx,hy,r*1.2,r,0,0,TAU);c.fill();c.strokeStyle=LIM;c.lineWidth=1.3;c.stroke();
      }
      if(gas<=0)return;
      c.fillStyle=LIM;c.globalAlpha=gas;c.beginPath();
      for(let j=0;j<3;j++){const r=nh*(.14+.08*Math.sin(ts*6+j*2+z));c.moveTo(fx+r,-nh/2+j*nh/2);c.arc(fx,-nh/2+j*nh/2,r,0,TAU);}
      c.fill();c.globalAlpha=1;
    },
    aura:[ZIEL,LIM],wypelnienie:[LIM,ZIEL,"#46781f"],iskry:{kolory:[LIM,ZIEL,"#46781f"],ksztalt:"babel",ruch:"opad"},dym:false,
    scena:["166,216,97","108,179,63","70,120,31"],tlo:{promienie:[["108,179,63",.55],["166,216,97",.45]],swiatlo:["166,216,97","108,179,63"]}};

  // ---- kometa: jasne jądro na głowie i zwężający się warkocz ----
  const kometa={
    glowa(c,sc,og,ts,z,przod){
      if(przod){c.fillStyle=PAPIER;for(let j=0;j<2;j++){const a=ts*4+j*PI;c.beginPath();c.arc(Math.cos(a)*sc*.55,-sc*.1+Math.sin(a)*sc*.2,sc*.035,0,TAU);c.fill();}return;}
      c.save();c.globalCompositeOperation="lighter";
      let r=sc*(og>=3?.95:.75);c.globalAlpha=.55;c.drawImage(blask(ZOLTY).cv,-r,-sc*.1-r,2*r,2*r);
      r=sc*.45;c.globalAlpha=.55;c.drawImage(blask(PAPIER).cv,-r,-sc*.1-r,2*r,2*r);c.restore();
    },
    slad(c,k){
      const wMax=k.og>=3?13:k.og>=2?10:6,kub=8,pts=k.pts;c.lineCap="round";c.lineJoin="round";
      for(let b=1;b<=kub;b++){   // warkocz: 8 grubości od cienkiego końca do głowy, każda jedną ścieżką
        c.beginPath();let pi=false,ost=null;
        for(let i=0;i<pts.length;i+=2){const p=pts[i];
          const f=Math.max(0,Math.min(1,(p.x-k.x0)/k.dlug)),wb=Math.max(1,Math.ceil(f*kub));
          if(!p.sp||wb!==b){if(pi&&p.sp)c.lineTo(p.x,p.y);pi=false;ost=p;continue;}
          if(!pi){if(ost&&ost.sp)c.moveTo(ost.x,ost.y);else c.moveTo(p.x,p.y);pi=true;}c.lineTo(p.x,p.y);ost=p;}
        const f=b/kub;c.lineWidth=Math.max(1,wMax*Math.pow(f,1.3));c.strokeStyle=f>.66?PAPIER:f>.33?ZOLTY:BURSZ;c.globalAlpha=Math.min(1,.25+f);c.stroke();
      }
      c.globalAlpha=1;
      if(!k.pelna)return;
      let ost=-1e9,nr=0;c.fillStyle=PAPIER;
      for(const p of pts){if(!p.sp||p.x-ost<12||p.x<k.x0)continue;ost=p.x;nr++;
        const f=(p.x-k.x0)/k.dlug,tw=.5+.5*Math.sin(k.ts*7+nr*2.3);c.globalAlpha=f*tw;
        c.fillRect(p.x-1,p.y+(los(nr+k.ziarno)-.5)*14,2,2);}
      c.globalAlpha=1;
    },
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      const ile=Math.min(16,Math.floor((fx-x0)/4));c.fillStyle=PAPIER;
      for(let k=0;k<ile;k++){c.globalAlpha=.5+.5*Math.sin(ts*5+k*2.1);c.fillRect(x0+los(k*3.1+z)*(fx-x0)-1,-nh/2+los(k*4.7+z)*nh-1,2,2);}
      c.globalAlpha=1;
      if(gas<=0)return;
      const r=nh*.9;c.save();c.globalCompositeOperation="lighter";c.globalAlpha=gas*.8;c.drawImage(blask(ZOLTY).cv,fx-r,-r,2*r,2*r);c.restore();
    },
    aura:[ZOLTY,BURSZ],wypelnienie:[PAPIER,ZOLTY,BURSZ],iskry:{kolory:[PAPIER,ZOLTY,BURSZ],ksztalt:"gwiazda"},dym:false,
    tlo:{promienie:[["250,246,238",.45],["255,216,74",.45]],swiatlo:["255,246,220","255,216,74"]}};

  // ---- laser: wiązki z głowy (w górę i do tyłu, nie na nadjeżdżające nuty) i soczewkowe rozbłyski ----
  const laser={
    glowa(c,sc,og,ts,z,przod){
      c.save();c.globalCompositeOperation="lighter";c.lineCap="round";
      if(przod){
        c.globalAlpha=.75;c.drawImage(blask(PAPIER).cv,-sc*1.3,-sc*.47-sc*.07,sc*2.6,sc*.14);
        c.globalAlpha=.5;c.strokeStyle=ROZ;c.lineWidth=1.2;c.beginPath();c.arc(0,-sc*.47,sc*.22,0,TAU);c.stroke();
        for(const [d,r,k] of [[.7,.1,LIM],[1.15,.06,"#5b8cff"]]){c.globalAlpha=.6;const R2=sc*r;c.drawImage(blask(k).cv,-sc*d-R2,-sc*.47+sc*d*.5-R2,2*R2,2*R2);}
        c.restore();return;}
      const n=og>=3?3:2,kol=[ROZ,LIM,"#5b8cff"],dl=sc*(og>=3?4.2:3.2);
      for(let j=0;j<n;j++){
        const a=-2.25+j*.32+Math.sin(ts*1.3+j*2.1+z)*.22,x1=Math.cos(a)*dl,y1=-sc*.2+Math.sin(a)*dl;
        c.beginPath();c.moveTo(0,-sc*.2);c.lineTo(x1,y1);
        c.globalAlpha=.2;c.strokeStyle=kol[j];c.lineWidth=6;c.stroke();c.globalAlpha=.9;c.lineWidth=1.5;c.stroke();
      }
      c.restore();
    },
    slad(c,k){
      c.save();c.globalCompositeOperation="lighter";c.lineCap="round";c.lineJoin="round";sciezka(c,k.pts);
      c.strokeStyle=gradX(c,k.x0,k.xT,ROZ,0,.3);c.lineWidth=k.og>=3?8:6;c.stroke();
      c.strokeStyle=gradX(c,k.x0,k.xT,PAPIER,0,1);c.lineWidth=1.8;c.stroke();
      if(k.pelna&&k.og>=2){const b=blask(ROZ).cv;let ost=-1e9,nr=0;
        for(const p of k.pts){if(!p.sp||p.x-ost<20||p.x<k.x0)continue;ost=p.x;nr++;const f=(p.x-k.x0)/k.dlug,r=4+4*f;
          c.globalAlpha=f*.8;c.drawImage(b,p.x-r,p.y-r,2*r,2*r);}}
      c.restore();
    },
    nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas){
      const x0=-w/2;fx=Math.max(x0,Math.min(w/2,fx));
      if(fx>x0+1){c.fillStyle="rgba(33,31,29,.5)";c.fillRect(x0,-2.5,fx-x0,5);
        c.save();c.globalCompositeOperation="lighter";c.fillStyle="rgba(236,26,131,.4)";c.fillRect(x0,-2,fx-x0,4);
        c.fillStyle=PAPIER;c.fillRect(x0,-.6,fx-x0,1.2);c.restore();}
      if(gas<=0)return;
      c.save();c.globalCompositeOperation="lighter";c.globalAlpha=gas;let r=nh*.95;c.drawImage(blask(ROZ).cv,fx-r,-r,2*r,2*r);
      r=nh*.35;c.drawImage(blask(PAPIER).cv,fx-r,-r,2*r,2*r);c.drawImage(blask(PAPIER).cv,fx-nh*1.4,-1.5,nh*2.8,3);c.restore();
    },
    aura:[ROZ,"#5b8cff"],wypelnienie:[PAPIER,ROZ,"#5b8cff"],iskry:{kolory:[PAPIER,ROZ,LIM]},dym:false,
    scena:["236,26,131","91,140,255","236,26,131"],tlo:{promienie:[["236,26,131",.6],["91,140,255",.45]],swiatlo:["255,120,200","91,140,255"]}};

  // =========================================================================================== katalogi
  const WIDOWNIE=[
    {id:"zaby",nazwa:"Żaby",prestiz:0,opis:"Klasyczna widownia na liściach. Przy kombo błyszczy.",rysuj:rysujZaby},
    {id:"zapalniczki",nazwa:"Zapalniczki",prestiz:1,opis:"Ciemna sala i płomyki zapalniczek kołyszące się w rytm.",rysuj:rysujZapalniczki},
    {id:"glosniki",nazwa:"Ściana głośników",prestiz:1,opis:"Kolumny za widownią pulsują na każdą ćwierćnutę.",rysuj:rysujGlosniki},
    {id:"transparenty",nazwa:"Transparenty",prestiz:2,opis:"Żaby z tabliczkami. Przy kombo krzyczą „KOMBO!”, na koniec „BIS!”.",rysuj:rysujTransparenty},
    {id:"pogo",nazwa:"Pogo",prestiz:2,opis:"Żaby w kolorowych irokezach skaczą pogo. Przy kombo środek robi mosh pit w kolcach.",rysuj:rysujPogo},
    {id:"telefony",nazwa:"Telefony w górze",prestiz:2,opis:"Ekrany telefonów falują światłem, przy kombo migają kolorami.",rysuj:rysujTelefony},
    {id:"neon",nazwa:"Neon",prestiz:3,opis:"Żaby jak neonowe szyldy w kolorze Twojej partii. Przy kombo migoczą.",rysuj:rysujNeon},
    {id:"sprej",nazwa:"Graffiti",prestiz:3,opis:"Ściana z graffiti. Przy kombo i brawach lecą na nią bryzgi farby.",rysuj:rysujSprej},
    {id:"reflektory",nazwa:"Reflektory",prestiz:3,opis:"Snopy światła przeczesują ciemną salę, przy kombo szybciej.",rysuj:rysujReflektory},
    {id:"pirotechnika",nazwa:"Pirotechnika",prestiz:4,opis:"Dysze między żabami. Przy kombo strzelają słupami ognia.",rysuj:rysujPirotechnike},
    {id:"kolce",nazwa:"Kolce i krata",prestiz:4,opis:"Szkocka krata, obroże z kolcami, agrafki. Przy kombo headbanging.",rysuj:rysujKolce},
    {id:"crowdsurfing",nazwa:"Crowdsurfing",prestiz:4,opis:"Twoja żaba płynie po głowach widowni. Przy kombo dołączają kolejne.",rysuj:rysujCrowdsurfing},
    {id:"czaszki",nazwa:"Czaszki",prestiz:5,opis:"Czaszki w irokezach z płonącymi oczami. Przy kombo strzelają błyskawice.",rysuj:rysujCzaszki}];
  const zKolorami=(s,d)=>Object.assign({aura:["#ec1a83","#eaa32b"],wypelnienie:null,scena:null,iskry:null,tlo:null},s,d);
  const STREAKI=[
    zKolorami(ogienZPaleta(null),{id:"ogien",nazwa:"Ogień",prestiz:0,opis:"Płonąca głowa, ślad w ogniu i zwęglone nuty."}),
    zKolorami(pixel,{id:"pixel",nazwa:"Pixel",prestiz:1,opis:"Ogień jak z automatu: grube kwadraty i schodkowy ślad."}),
    zKolorami(konfetti,{id:"konfetti",nazwa:"Konfetti",prestiz:1,opis:"Z głowy tryska konfetti, ślad to serpentyna."}),
    zKolorami(gwiazdy,{id:"gwiazdy",nazwa:"Gwiazdy",prestiz:2,opis:"Korona migoczących gwiazdek i ślad ze złotego pyłu."}),
    zKolorami(neon,{id:"neon",nazwa:"Neon",prestiz:2,opis:"Neonowy irokez i smuga światła zamiast śladu."}),
    zKolorami(raca,{id:"raca",nazwa:"Raca",prestiz:2,opis:"Kolorowy dym jak z racy na koncercie."}),
    zKolorami(ogienZPaleta(PAL.niebieski),{id:"niebieski",nazwa:"Niebieski płomień",prestiz:3,opis:"Ogień tak gorący, że aż niebieski.",
      aura:[NIEB,"#5b8cff"],wypelnienie:[PAPIER,"#5b8cff",NIEB],iskry:{kolory:[PAPIER,"#7fb6ff",NIEB]},
      scena:["150,215,255","60,130,255","90,60,230"],tlo:{promienie:[["60,130,255",.55],["90,60,230",.45]],swiatlo:["180,225,255","60,130,255"]}}),
    zKolorami(piorunStyl,{id:"piorun",nazwa:"Piorun",prestiz:3,opis:"Wyładowania zygzakiem zamiast płomieni, ślad to iskrzący kabel."}),
    zKolorami(kwas,{id:"kwas",nazwa:"Kwas",prestiz:3,opis:"Zielone bąble i kapiący kwas, który wypala dziury w taśmie."}),
    zKolorami(ogienZPaleta(PAL.zloto),{id:"zloto",nazwa:"Złoty płomień",prestiz:4,opis:"Ogień ze złota i złote gwiazdki zamiast iskier.",
      aura:[ZOLTY,BURSZ],wypelnienie:["#fff2b0",ZOLTY,BURSZ],iskry:{kolory:[ZOLTY,"#fff2b0",BURSZ],ksztalt:"gwiazda"},
      scena:["255,226,100","240,175,30","200,120,0"],tlo:{promienie:[["255,216,74",.6],["240,175,30",.5]],swiatlo:["255,236,150","240,175,30"]}}),
    zKolorami(kometa,{id:"kometa",nazwa:"Kometa",prestiz:4,opis:"Głowa świeci jak jądro komety, ślad to zwężający się warkocz."}),
    zKolorami(ogienZPaleta(PAL.piekielny),{id:"piekielny",nazwa:"Piekielny ogień",prestiz:4,opis:"Karmazynowy ogień z fioletem i ciemny dym.",
      aura:["#b8264a","#8e6fe6"],wypelnienie:["#ff4060","#b8264a","#8e6fe6"],iskry:{kolory:["#ff4060","#b8264a","#8e6fe6"]},dym:"#4a1028",
      scena:["245,60,70","180,20,90","110,20,170"],tlo:{promienie:[["184,38,74",.6],["142,111,230",.45]],swiatlo:["255,100,110","142,47,208"]}}),
    zKolorami(laser,{id:"laser",nazwa:"Laser",prestiz:5,opis:"Wiązki laserów z głowy i soczewkowe rozbłyski."})];
  const MAPA_W=new Map(WIDOWNIE.map(w=>[w.id,w])),MAPA_S=new Map(STREAKI.map(s=>[s.id,s]));
  const widownia=id=>MAPA_W.get(id)||WIDOWNIE[0];
  const streak=id=>MAPA_S.get(id)||STREAKI[0];
  // Rejestracja stopni z modułów drabinek (efekty-widownia.js, efekty-streak.js; ładowane PO tym pliku, wołają to
  // przy wczytaniu): wpis z nowym id dochodzi na koniec katalogu, wpis z istniejącym id zastępuje stary na jego
  // miejscu (kolejność i domyślny styl na pozycji 0 zostają). Mapy id → styl odświeżają się od razu, więc
  // widownia(id), streak(id), miniatury i okno „Scena” znają nowe stopnie. Niepełny wpis (widownia bez rysuj,
  // streak bez glowa/slad/nuty, np. sam wskaźnik {stopien, id} na istniejący styl) nie psuje katalogu: jest pomijany.
  // Zwraca liczbę przyjętych wpisów.
  function zarejestruj(lista,katalog,mapa,pelny){
    let n=0;
    for(const w of Array.isArray(lista)?lista:[]){
      if(!w||typeof w.id!=="string"||!w.id||!pelny(w))continue;
      const i=katalog.findIndex(x=>x.id===w.id);
      if(i>=0)katalog[i]=w;else katalog.push(w);
      mapa.set(w.id,w);n++;
    }
    return n;
  }
  const zarejestrujWidownie=lista=>zarejestruj(lista,WIDOWNIE,MAPA_W,w=>typeof w.rysuj==="function");
  const zarejestrujStreaki=lista=>zarejestruj(lista,STREAKI,MAPA_S,s=>["glowa","slad","nuty"].every(k=>typeof s[k]==="function"));

  // Bufory stylów przed grą (nie w klatce pierwszego kombo, wtedy gra planuje dźwięk).
  function rozgrzej(widId,streakIds){
    try{
      for(const id of streakIds||[]){const s=streak(id);if(s.rozgrzej)s.rozgrzej();for(const k of s.aura||[])blask(k);}
      blysk();blask(ZOLTY);blask(PAPIER);
      if(widId==="zapalniczki")plomyk();
      if(widId==="kolce"||widId==="pogo"){obroza();agrafka();}
    }catch(e){console.warn("RibbitBeat: rozgrzewka stylów",e);}
  }

  // Miniatura stylu (64×32, stan spoczynku): widownia rysuje się sama na pasie 32 px, streak dostaje kawałek
  // taśmy (spalona do połowy), ślad i żabę z głową w stylu na poziomie ognia 3.
  function miniatura(cv,typ,id){
    const d=2,c=cv.getContext("2d");cv.width=64*d;cv.height=32*d;
    c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,64,32);
    try{
      if(typ==="widownia"){widownia(id).rysuj(c,{y:0,h:32},stanSpoczynku(64,32));return;}
      const s=streak(id),ts=1.3;
      c.fillStyle="#2b2825";c.beginPath();c.roundRect(0,0,64,32,5);c.fill();
      c.save();c.translate(16,25);c.fillStyle="#e9d4ae";c.fillRect(-13,-4,26,8);s.nuty(c,26,8,4,3,ts,3,true,1);c.restore();
      const pts=[];for(let x=3;x<=46;x+=1.5)pts.push({x,y:14+Math.sin(x*.16)*4,sp:true});
      s.slad(c,{pts,og:3,ts,x0:3,xT:47,dlug:44,ziarno:3,pelna:true,emituj:false,kolor:ROZ});
      const img=zabaImg(2),sc=19;
      // efekt za głową, jak w grze (zabi-chor.js: glowaZaGlowa): podstawa w środku głowy, bez przedniego przebiegu
      c.save();c.translate(51,17);
      if(typeof glowaZaGlowa==="function")glowaZaGlowa(c,s,sc,3,ts,3);else{c.save();c.translate(0,sc*.36);c.scale(.92,.92);s.glowa(c,sc,3,ts,3,false);c.restore();}
      if(img)c.drawImage(img,-sc/2,-sc/2,sc,sc);c.restore();
    }catch(e){console.warn("RibbitBeat: miniatura stylu",id,e);}
  }

  return {WIDOWNIE,STREAKI,PAL,widownia,streak,stan,stanSpoczynku,rozgrzej,miniatura,zarejestrujWidownie,zarejestrujStreaki,
    DOMYSLNA_WIDOWNIA:"zaby",DOMYSLNY_STREAK:"ogien"};
})();
