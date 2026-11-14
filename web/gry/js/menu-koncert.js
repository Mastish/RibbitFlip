"use strict";
// RibbitBeat: scena koncertowa w menu głównym (menu z podglądu „koncert” przeniesione do gry).
// Tło sceny z kratownicą i kurtynami, dwie kolumny z membranami i sześć lamp na kablu namalowanym w tle; wszystko rusza
// w rytm muzyki menu: własny utwór „Dub Riot” (MIDI, 128 BPM) renderowany w grze, zapasowo syntezowany loop 96 BPM. Grafiki: web/assets/koncert/
// (generator obrazów Codexa, opis w ZRODLA.md tam). Wygląd: gry-menu-koncert.css.
//
// Dźwięk: jeden kontekst gry (Glos.kontekstUI, budzi go pierwszy gest przez Glos.odblokuj); muzyka idzie do kompresora
// gry (Glos.celUI), tak jak dźwięki interfejsu w dzwieki-ui.js, więc ikona Studia (studio-ikona.js) też ją słyszy.
// Gra tylko na widocznym menu (lobby, ekran „menu”, bez nakładki i bez koła nagród), cichnie przy wyjściu.
// Głośność = Głośność × Podkład z ustawień gry. Wyciszenie (#menuWycisz) zapamiętuje localStorage.
//
// Zanim przeglądarka wypuści dźwięk, scena bierze rytm z zegara tego samego podkładu (stopa na 1 i 3, werbel na 2 i 4,
// hi-hat na ósemkach), więc rusza od razu po wejściu do menu. Lampy to tłumione wahadła: każda stopa daje impuls na
// przemian w lewo i w prawo. Chwilę stopy podaje pozycja odtwarzania w utworze (czasy stóp z MIDI), a nie widmo:
// bas „Dub Riot” trzyma energię przy szczycie, więc próg energii łapał 2 uderzenia na 6 s i lampy prawie stały.
// Naklejka z nazwą gry (.menu-bohater) pulsuje na tę samą stopę co lampy: skok na uderzenie, potem wygaszenie (pulsLogo).
// Ruch stoi przy ograniczonym ruchu i grafice „wydajność” (klasa .statyczne na #menu z lobby-scena.js) i przy wyciszeniu.
//
// API dla smoke: MenuKoncert.stan() = {gra, wyciszone, rusza, kontekst, lampy, energia, logo}.
const MenuKoncert=(()=>{
  const L=(pl,en)=>typeof RBJezyk!=="undefined"&&RBJezyk.wybierz?RBJezyk.wybierz(pl,en):pl;
  const A="../assets/koncert/";
  const KLUCZ="ribbitbeat.menuWycisz";
  const menu=document.getElementById("menu"),lobby=document.getElementById("lobby"),warstwa=menu&&menu.querySelector(".menu-koncert");
  if(!menu||!lobby||!warstwa)return {stan:()=>null};
  const el=(tag,kl)=>{const e=document.createElement(tag);if(kl)e.className=kl;return e;};

  // ---- scena ----
  const tlo=el("div","mk-tlo");warstwa.append(tlo);
  const kolumny=[],membrany=[];
  for(let s=0;s<2;s++){
    const k=el("div","mk-kolumna mk-strona-"+s);const g=el("img");g.src=A+"kolumna.webp";g.alt="";g.draggable=false;k.append(g);
    for(let j=0;j<2;j++){const m=el("img","mk-membrana mk-membrana-"+j);m.src=A+"membrana.webp";m.alt="";m.draggable=false;k.append(m);membrany.push(m);}
    warstwa.append(k);kolumny.push(k);
  }
  const lampyWarstwa=el("div","mk-lampy");warstwa.append(lampyWarstwa);
  // punkty na kablu w pikselach grafiki tła (1672×941): y = spód oprawki albo oś kabla; k = wielkość, p = różowa.
  // Komputer: po trzy lampy z boków logo (dwie w oprawkach 492 i 1182); telefon: środkowe oprawki, bo tło jest przycięte.
  const TLO={w:1672,h:941};
  const LAMPY_SZEROKO=[{x:360,y:55,k:.85,p:1},{x:425,y:66,k:1,p:0},{x:492,y:82,k:1.1,p:1},{x:1182,y:84,k:1.1,p:0},{x:1250,y:74,k:1,p:1},{x:1315,y:61,k:.85,p:0}];
  const LAMPY_WASKO=[{x:649,y:76,k:1,p:1},{x:770,y:41,k:.9,p:0},{x:895,y:41,k:.9,p:1},{x:1017,y:79,k:1,p:0}];
  const lampy=[];let lampyWasko=null;
  function ulozLampy(){
    const wasko=innerWidth<650,lista=wasko?LAMPY_WASKO:LAMPY_SZEROKO;
    if(wasko!==lampyWasko){lampyWasko=wasko;lampyWarstwa.replaceChildren();lampy.length=0;
      for(const o of lista){const w=el("div","mk-lampa"+(o.p?" mk-roz":""));w.style.setProperty("--k",o.k);const i=el("img");i.src=A+"lampa.webp";i.alt="";i.draggable=false;w.append(i);
        lampyWarstwa.append(w);lampy.push({w,o,kat:0,pred:0,okres:2.5*Math.sqrt(o.k)});}}
    const r=tlo.getBoundingClientRect(),q=lampyWarstwa.getBoundingClientRect();if(!r.width)return;
    const sk=Math.max(r.width/TLO.w,r.height/TLO.h),ox=r.left+(r.width-TLO.w*sk)/2-q.left,oy=r.top+(r.height-TLO.h*sk)/2-q.top;
    lampyWarstwa.style.setProperty("--lampa",(64*sk).toFixed(1)+"px");
    for(const l of lampy){l.w.style.left=(ox+l.o.x*sk).toFixed(1)+"px";l.w.style.top=(oy+l.o.y*sk).toFixed(1)+"px";}
  }
  addEventListener("resize",ulozLampy);

  // ---- naklejka RibbitFlip i przycisk wyciszenia ----
  const rf=document.getElementById("menuRibbitFlip");
  // Naklejka z nazwą gry pulsuje w rytm muzyki. Skala idzie osobną właściwością `scale` na .menu-bohater: ten element
  // ma już własną warstwę (will-change) i punkt zaczepienia na dole, więc napis rośnie w górę, w stronę lamp, a jego
  // transform z CSS (podniesienie) i animacje wejścia zostają nietknięte.
  const bohater=menu.querySelector(".menu-bohater");let pulsLogo=0;
  if(rf)rf.setAttribute("aria-label",L("RibbitFlip: strona projektu (nowa karta)","RibbitFlip: project page (new tab)"));
  // Podpis POD naklejką mówi wprost, czym jest RibbitBeat względem RibbitFlipa. Wiersze wymuszone
  // podziałem, a nie zawijaniem: przy zawijaniu szerokość pudełka decydowała, ile wyjdzie linii, i w angielskim
  // łamało się w innym miejscu niż po polsku. Napis jest węższy, w TRZECH krótkich wierszach,
  // żeby etykieta była niewiele szersza od naklejki i żaba stała nad jej środkiem (gry-menu-koncert.css).
  {const o=document.getElementById("menuRibbitFlipOpis");
    if(o){o.replaceChildren();
      for(const linia of [L("Gra","Demo"),L("demonstracyjna","game"),L("projektu","of the project")]){
        const w=document.createElement("span");w.className="menu-ribbitflip-linia";w.textContent=linia;o.append(w);}}}
  const btn=document.getElementById("menuWycisz");
  let wyciszone=false;try{wyciszone=localStorage.getItem(KLUCZ)==="1";}catch(e){}
  function etykieta(){if(!btn)return;btn.setAttribute("aria-pressed",String(wyciszone));
    const t=wyciszone?L("Włącz muzykę menu","Unmute menu music"):L("Wycisz muzykę menu","Mute menu music");btn.setAttribute("aria-label",t);btn.title=t;}
  etykieta();
  // pełny ekran: klik przekazany do #menuEkran (menuPelnyEkran w zabi-chor.js: Fullscreen API, ten sam stan co F11)
  const pe=document.getElementById("menuPelny"),pp=document.getElementById("menuEkran");
  function pelnyNapis(){if(!pe)return;const p=!!(pp&&pp.classList.contains("pelny"));pe.classList.toggle("pelny",p);
    const t=p?L("Okno","Window"):L("Pełny ekran","Full screen");pe.querySelector(".menu-pelny-tekst").textContent=t;pe.title=t+" (F11)";}
  if(pe){pe.addEventListener("click",()=>{if(pp)pp.click();});if(pp)new MutationObserver(pelnyNapis).observe(pp,{attributes:true,attributeFilter:["class"]});pelnyNapis();}

  // ---- muzyka: własny utwór „Dub Riot” (assets/koncert/dub-riot.mid, 128 BPM, 16 taktów = 30 s, pętla bez szwu) ----
  // MIDI (GM, format 1) czyta czytajMidi, a wyrenderujUtwor składa z niego bufor: każda ścieżka ma własne syntezowane
  // brzmienie (bas, gitarowe chopy na off-beatach, przesterowane power chordy, riff, dubowe echo z odbiciami, perkusja GM:
  // stopa 36, werbel 38, hi-hat 42/46, crash 49, tomy 45/47). Bez plików audio. Gdy MIDI się nie wczyta, gra zapasowy
  // syntezowany loop 96 BPM (zbudujBufor). Uderzenia stopy z MIDI prowadzą też scenę, zanim przeglądarka wypuści dźwięk.
  const MIDI_PLIK=A+"dub-riot.mid";
  let utwor=null;
  function czytajMidi(buf){
    const d=new Uint8Array(buf),u16=i=>d[i]<<8|d[i+1],u32=i=>(d[i]<<24|d[i+1]<<16|d[i+2]<<8|d[i+3])>>>0;
    const tekst=(i,n)=>String.fromCharCode(...d.subarray(i,i+n));
    if(tekst(0,4)!=="MThd")throw new Error("to nie MIDI");
    const ntr=u16(10),tpq=u16(12);let usq=500000,i=14,koniecT=0;const surowe=[];
    const vlq=()=>{let v=0,c;do{c=d[i++];v=v<<7|c&127;}while(c&128);return v;};
    for(let t=0;t<ntr&&tekst(i,4)==="MTrk";t++){
      const dl=u32(i+4),end=i+8+dl;i+=8;let tick=0,run=0;const wl=new Map();
      while(i<end){
        tick+=vlq();let st=d[i];
        if(st===0xff){const typ=d[i+1];i+=2;const n=vlq();if(typ===0x51)usq=d[i]<<16|d[i+1]<<8|d[i+2];i+=n;continue;}
        if(st===0xf0||st===0xf7){i++;i+=vlq();continue;}
        if(st&0x80){run=st;i++;}
        const ch=run&15,ty=run&0xf0;
        if(ty===0xc0||ty===0xd0){i+=1;continue;}
        const a=d[i],b=d[i+1];i+=2;
        if(ty===0x90&&b>0)wl.set(ch*128+a,{s:tick,v:b});
        else if(ty===0x80||ty===0x90){const o=wl.get(ch*128+a);if(o){wl.delete(ch*128+a);surowe.push({ch,m:a,s:o.s,e:tick,v:o.v});koniecT=Math.max(koniecT,tick);}}
      }
      i=end;
    }
    const sek=usq/1e6/tpq,takt=tpq*4,dlT=Math.max(takt,Math.ceil(koniecT/takt-.05)*takt);
    const nuty=surowe.map(n=>({ch:n.ch,m:n.m,t:n.s*sek,d:Math.max(.02,(n.e-n.s)*sek),v:n.v/127})).sort((x,y)=>x.t-y.t);
    const czasy=m=>nuty.filter(n=>n.ch===9&&m.includes(n.m)).map(n=>n.t);
    return {nuty,dl:dlT*sek,beat:usq/1e6,stopy:czasy([36]),werble:czasy([38]),hihaty:czasy([42,46])};
  }
  // Render trwa ~1 s (Node, 48 kHz), więc idzie W TLE zaraz po wczytaniu MIDI, kawałkami po ~8 ms na klatkę, i kończy się
  // zwykle, zanim ktoś kliknie; bufor powstaje bez kontekstu (48 kHz, przeglądarka sama przelicza na kontekst gry).
  // Brzmienia: 0 bas, 1 chopy, 2 przesterowane power chordy, 3 riff, 4 dubowe echo (3 odbicia co 3/8), 9 perkusja GM.
  const MIDI_HZ=48000;
  function renderUtworu(u,rate){
    const N=Math.ceil(u.dl*rate),Lk=new Float32Array(N),Rk=new Float32Array(N);
    let seed=1234;const szum=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2147483648-1;};
    // ogon dźwięku za końcem pętli wraca na jej początek (k % N), więc pętla nie ma szwu
    const hit=(at,len,fn,pan=0)=>{const s0=Math.round(at*rate),n=Math.floor(len*rate);for(let i=0;i<n;i++){const v=fn(i/rate),k=(s0+i)%N;Lk[k]+=v*(1-pan*.35);Rk[k]+=v*(1+pan*.35);}};
    const hz=m=>440*Math.pow(2,(m-69)/12),beat=u.beat;
    const chop=(fr,amp)=>t=>{const ph=2*Math.PI*fr*t;return Math.tanh((Math.sin(ph)+.32*Math.sin(2*ph)+.14*Math.sin(3*ph))*.7)*Math.min(1,t*400)*Math.exp(-t*24)*amp;};
    const szumHP=()=>{let poprz=0;return ()=>{const a=szum(),r=a-poprz*.92;poprz=a;return r*.7;};};
    function nuta(n){
      const v=n.v,t0=n.t,d=n.d,fr=hz(n.m);
      if(n.ch===0)hit(t0,d+.12,t=>{const env=Math.min(1,t*200)*(t<d?Math.exp(-t*1.2):Math.exp(-d*1.2)*Math.exp(-(t-d)*30));
        return (Math.sin(2*Math.PI*fr*t)+.35*Math.sin(4*Math.PI*fr*t)+.12*Math.sin(6*Math.PI*fr*t))*env*.42*v;});
      else if(n.ch===1)hit(t0,Math.min(.22,d+.08),chop(fr,.13*v),-.5);
      else if(n.ch===2)hit(t0,d+.08,t=>{let x=0;for(let h=1;h<=6;h++)x+=Math.sin(2*Math.PI*h*fr*t+h)/h;x+=.5*Math.sin(2*Math.PI*fr*1.004*t);
        const env=Math.min(1,t*300)*(t<d?1-.3*t/Math.max(d,.01):.7*Math.exp(-(t-d)*25));return Math.tanh(x*2.2)*env*.07*v;},.45);
      else if(n.ch===3)hit(t0,d+.1,t=>{const f=fr*(1+.006*Math.sin(2*Math.PI*5.5*t)*Math.min(1,t*3)),ph=f*t%1;
        const env=Math.min(1,t*120)*(t<d?1:Math.exp(-(t-d)*18));return Math.tanh(((ph<.5?.6:-.6)+.4*Math.sin(2*Math.PI*f*t))*1.5)*env*.09*v;},.1);
      else if(n.ch===4)for(let k=0;k<4;k++)hit(t0+k*beat*.75,.2,chop(fr,.1*v*Math.pow(.5,k)),k%2?.6:-.6);
      else if(n.ch===9){
        if(n.m===36)hit(t0,.3,t=>Math.sin(2*Math.PI*(48*t+7*(1-Math.exp(-t*28))))*Math.exp(-t*18)*.7*v);
        else if(n.m===38)hit(t0,.2,t=>(szum()*.65+Math.sin(2*Math.PI*185*t)*.25)*Math.exp(-t*25)*.5*v);
        else if(n.m===42){const h=szumHP();hit(t0,.06,t=>h()*Math.exp(-t*70)*.16*v,-.3);}
        else if(n.m===46){const h=szumHP();hit(t0,.35,t=>h()*Math.exp(-t*9)*.12*v,-.3);}
        else if(n.m===49){const h=szumHP();hit(t0,1.5,t=>(h()+.15*Math.sin(2*Math.PI*5200*t)*Math.sin(2*Math.PI*3100*t))*Math.exp(-t*2.2)*.12*v,.3);}
        else if(n.m===45||n.m===47){const f0=n.m===47?130:100;hit(t0,.35,t=>Math.sin(2*Math.PI*(f0*t+3*(1-Math.exp(-t*20))))*Math.exp(-t*9)*.4*v,n.m===47?.3:-.3);}
      }
    }
    function koniec(){
      let szczyt=0;for(let i=0;i<N;i++)szczyt=Math.max(szczyt,Math.abs(Lk[i]),Math.abs(Rk[i]));
      const g=Math.min(4,1.15/Math.max(.01,szczyt));
      for(let i=0;i<N;i++){Lk[i]=Math.tanh(Lk[i]*g)*.8;Rk[i]=Math.tanh(Rk[i]*g)*.8;}
      return {L:Lk,R:Rk,N,rate};
    }
    return {nuta,koniec};
  }
  let midiBufor=null;
  function renderujWTle(u){
    if(typeof AudioBuffer==="undefined")return;
    const r=renderUtworu(u,MIDI_HZ);let i=0;
    const krok=()=>{const t=performance.now();while(i<u.nuty.length&&performance.now()-t<8)r.nuta(u.nuty[i++]);
      if(i<u.nuty.length){setTimeout(krok,0);return;}
      const w=r.koniec();try{const b=new AudioBuffer({length:w.N,numberOfChannels:2,sampleRate:w.rate});b.copyToChannel(w.L,0);b.copyToChannel(w.R,1);midiBufor=b;}catch(e){console.warn(e);return;}
      if(gra&&buforZ!=="midi"){cisza();stan();}};   // grał zapas (gest był szybszy niż render): ustępuje utworowi
    setTimeout(krok,0);
  }
  fetch(MIDI_PLIK).then(r=>r.ok?r.arrayBuffer():Promise.reject(r.status)).then(b=>{utwor=czytajMidi(b);renderujWTle(utwor);}).catch(e=>console.warn("RibbitBeat: muzyka menu z zapasu,",e));

  // ---- zapasowa muzyka: syntezowany loop 8 taktów (96 BPM), liczony raz na kontekst ----
  let bufor=null,buforKtx=null,buforZ=null,zrodlo=null,wzm=null,an=null,widmo=new Uint8Array(512),gra=false,offset=0,start=0;
  function zbudujBufor(c){
    const rate=c.sampleRate,beat=60/96,dl=32*beat,b=c.createBuffer(2,Math.ceil(dl*rate),rate),Lk=b.getChannelData(0),Rk=b.getChannelData(1);
    let seed=90210;const szum=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2147483648-1;};
    const hit=(at,len,fn,pan=0)=>{const s0=Math.round(at*rate),n=Math.floor(len*rate);for(let i=0;i<n;i++){const v=fn(i/rate),k=(s0+i)%Lk.length;Lk[k]+=v*(1-pan*.35);Rk[k]+=v*(1+pan*.35);}};
    const roots=[110,110,146.832,146.832,130.813,130.813,97.999,97.999];
    for(let bar=0;bar<8;bar++)for(let n=0;n<4;n++){
      const at=(bar*4+n)*beat,root=roots[bar];
      if(n===0||n===2)hit(at,.3,t=>Math.sin(2*Math.PI*(48*t+7*(1-Math.exp(-t*28))))*Math.exp(-t*18)*.65);
      if(n===1||n===3)hit(at,.18,t=>(szum()*.65+Math.sin(2*Math.PI*185*t)*.25)*Math.exp(-t*27)*.46);
      for(let h=0;h<2;h++)hit(at+h*beat/2,.065,t=>szum()*Math.exp(-t*75)*.09,h?.4:-.4);
      const f=root/2*(n===3?1.5:1);hit(at,.48,t=>(Math.sin(2*Math.PI*f*t)+.22*Math.sin(4*Math.PI*f*t))*Math.min(1,t*150)*Math.exp(-t*4)*.3);
      hit(at+beat/2,.16,t=>{let v=0;for(const r of [1,1.259921,1.498307]){const ph=2*Math.PI*root*2*r*t;v+=Math.sin(ph)+.32*Math.sin(ph*2)+.14*Math.sin(ph*3);}
        return Math.tanh(v*.7)*Math.min(1,t*400)*Math.exp(-t*26)*.22;},bar%2?.55:-.55);
      if(n===3)hit(at+beat*.75,.2,t=>Math.sin(2*Math.PI*root*4*t)*Math.exp(-t*20)*.1,.5);
    }
    for(let i=0;i<Lk.length;i++){Lk[i]=Math.tanh(Lk[i]*1.15)*.8;Rk[i]=Math.tanh(Rk[i]*1.15)*.8;}
    return b;
  }
  function glosnosc(){try{const u=S.ust;return .23*(u.glosnosc??1)*(u.glosnoscPodklad??1);}catch(e){return .23;}}
  function graj(){
    const c=typeof Glos!=="undefined"&&Glos.kontekstUI?Glos.kontekstUI():null,cel=c&&Glos.celUI?Glos.celUI():null;
    if(gra||!c||!cel||c.state!=="running")return;
    if(buforKtx!==c)an=null;
    if(midiBufor){if(buforZ!=="midi"){bufor=midiBufor;buforZ="midi";offset=0;}}
    else if(!bufor||buforKtx!==c||buforZ!=="zapas"){bufor=zbudujBufor(c);buforZ="zapas";offset=0;}
    buforKtx=c;
    if(!an){an=c.createAnalyser();an.fftSize=1024;an.smoothingTimeConstant=.35;widmo=new Uint8Array(an.frequencyBinCount);
      wzm=c.createGain();an.connect(wzm);wzm.connect(cel);}
    zrodlo=c.createBufferSource();zrodlo.buffer=bufor;zrodlo.loop=true;zrodlo.connect(an);start=c.currentTime;zrodlo.start(0,offset%bufor.duration);
    wzm.gain.cancelScheduledValues(c.currentTime);wzm.gain.setValueAtTime(0,c.currentTime);wzm.gain.linearRampToValueAtTime(glosnosc(),c.currentTime+.4);gra=true;
  }
  function cisza(){
    if(!gra)return;const c=buforKtx;gra=false;
    try{offset=(offset+c.currentTime-start)%bufor.duration;wzm.gain.cancelScheduledValues(c.currentTime);wzm.gain.setTargetAtTime(0,c.currentTime,.05);zrodlo.stop(c.currentTime+.25);}catch(e){}
    zrodlo=null;
  }

  // ---- kiedy gra i kiedy się rusza ----
  const widoczne=()=>!document.hidden&&lobby.dataset.ekran==="menu"&&!lobby.hidden&&!menu.hidden&&(typeof S==="undefined"||S.ekran==="lobby")
    &&!(typeof nakladkaLobby==="function"&&nakladkaLobby())&&!(typeof Nagrody!=="undefined"&&Nagrody.otwarte);
  const statyczne=()=>menu.classList.contains("statyczne")||matchMedia("(prefers-reduced-motion: reduce)").matches;
  function stan(){
    const w=widoczne();
    if(w&&!wyciszone)graj();else cisza();
    if(gra&&wzm){const c=buforKtx;wzm.gain.setTargetAtTime(glosnosc(),c.currentTime,.1);}
    const ruch=w&&!wyciszone&&!statyczne();
    if(ruch&&!raf){ulozLampy();tPop=0;raf=requestAnimationFrame(klatka);}
    if(!ruch&&raf){cancelAnimationFrame(raf);raf=0;spocznij();}
  }
  // pierwszy gest w menu budzi kontekst gry (jak inne miejsca: Glos.odblokuj), potem muzyka rusza sama
  const gest=()=>{if(!wyciszone&&widoczne()&&typeof Glos!=="undefined"&&Glos.odblokuj){Glos.odblokuj();setTimeout(stan,60);}};
  document.addEventListener("pointerdown",gest,true);document.addEventListener("keydown",gest,true);
  if(btn)btn.addEventListener("click",()=>{wyciszone=!wyciszone;try{localStorage.setItem(KLUCZ,wyciszone?"1":"0");}catch(e){}etykieta();
    if(!wyciszone&&typeof Glos!=="undefined"&&Glos.odblokuj)Glos.odblokuj();setTimeout(stan,60);});
  new MutationObserver(stan).observe(lobby,{attributes:true,attributeFilter:["data-ekran","hidden"]});
  new MutationObserver(stan).observe(menu,{attributes:true,attributeFilter:["class","hidden"]});
  document.addEventListener("visibilitychange",stan);
  setInterval(stan,500);   // nakładki, koło nagród i kontekst budzony gdzie indziej nie mają jednego zdarzenia

  // ---- klatka: widmo z muzyki albo z zegara podkładu ----
  let raf=0,tPop=0,poprzBas=0,poprzOd=0,kierunek=1,energia=0;
  // ile sekund od ostatniego uderzenia z listy (pętla utworu: przed pierwszym liczy od ostatniego w poprzednim obiegu)
  const odOstatniego=(lista,t,dl)=>{if(!lista.length)return 9;let o=-1;for(const x of lista){if(x<=t)o=x;else break;}return o<0?t+dl-lista[lista.length-1]:t-o;};
  const zMidi=()=>gra?buforZ==="midi":!!utwor,taktS=()=>zMidi()?utwor.beat:60/96;
  // wahadło w rezonansie ze stopą: Dub Riot ma stopę co ćwierćnutę → okres 2 ćwierćnuty, zapas co półnutę → 4 (symulacja
  // offline na uderzeniach z MIDI: 1 zmiana kierunku na uderzenie, wychylenie ok. 2,7°)
  const lampaRytm=()=>zMidi()?{okres:2,sila:3,silaE:3}:{okres:4,sila:9,silaE:10};
  function rytmZZegara(t){let stopa,werbel,hh;
    if(utwor){const tl=t%utwor.dl;stopa=Math.exp(-odOstatniego(utwor.stopy,tl,utwor.dl)*7);werbel=Math.exp(-odOstatniego(utwor.werble,tl,utwor.dl)*9);
      hh=Math.exp(-odOstatniego(utwor.hihaty,tl,utwor.dl)*15);}
    else{const u=t/(60/96),f=u-Math.floor(u),w=Math.floor(u)%4,o=u*2;
      stopa=w===0||w===2?Math.exp(-f*7):0;werbel=w===1||w===3?Math.exp(-f*9):0;hh=Math.exp(-(o-Math.floor(o))*15);}
    for(let i=0;i<widmo.length;i++){const v=i<6?.2+.75*stopa:i<48?.15+.5*werbel:i<160?.1+.4*hh:.04;widmo[i]=Math.round(255*Math.min(1,v));}}
  // ile sekund temu była stopa: z pozycji w granym buforze (z poprawką na opóźnienie wyjścia audio) albo z zegara, zanim
  // przeglądarka wypuści dźwięk; zapasowy loop ma stopę na 1 i 3 (co dwie ćwierćnuty 96 BPM)
  function odStopy(ms){
    const t=gra&&buforKtx?offset+buforKtx.currentTime-start-(buforKtx.outputLatency||0):ms/1000;
    if(zMidi()){const dl=utwor.dl;return odOstatniego(utwor.stopy,((t%dl)+dl)%dl,dl);}
    const co=2*60/96;return ((t%co)+co)%co;
  }
  function klatka(ms){
    raf=requestAnimationFrame(klatka);
    if(tPop&&ms-tPop<25)return;const dt=tPop?Math.min(100,ms-tPop):16;tPop=ms;
    if(gra&&an)an.getByteFrequencyData(widmo);else rytmZZegara(ms/1000);
    let bas=0;for(let i=1;i<6;i++)bas+=widmo[i]/(5*255);
    energia=Math.min(1,Math.max(0,(bas-.23)/.65));const atak=bas-poprzBas;poprzBas=bas;
    const od=odStopy(ms),uderzenie=od<poprzOd-.05;poprzOd=od;   // licznik „od stopy” cofnął się = nowa stopa (niezależne od tempa klatek)
    if(uderzenie)kierunek=-kierunek;
    const impuls=Math.min(1,energia*.4+Math.max(0,atak)*6);
    for(const m of membrany)m.style.transform="scale("+(1+impuls*.07).toFixed(3)+")";
    warstwa.style.setProperty("--uderzenie",impuls.toFixed(3));
    // Napis RibbitFlip reaguje na audio: naklejka w rogu z tego samego impulsu co membrany,
    // ale słabiej (to odnośnik, nie element sceny) — skala i lekki obrót, żeby odbijała bas zamiast pulsować w kółko
    if(rf)rf.style.setProperty("--uderzenie",impuls.toFixed(3));
    const s=dt/1000;
    // logo: skok na każdą stopę (równo co ćwierćnutę, a nie na każdy dźwięk basu) i wygaszenie przez ok. 0,16 s;
    // najwyżej +4,5 %
    pulsLogo=Math.exp(-od/.16);
    if(bohater)bohater.style.scale=(1+pulsLogo*.045).toFixed(4);
    const lr=lampaRytm();lampy.forEach((l,i)=>{const w=2*Math.PI/(lr.okres*taktS()*Math.sqrt(l.o.k));if(uderzenie)l.pred+=kierunek*(lr.sila+energia*lr.silaE)*(.8+.4*((i*7)%5)/4);
      l.pred+=(-w*w*l.kat-1.1*l.pred)*s;l.kat=Math.max(-5,Math.min(5,l.kat+l.pred*s));l.w.style.setProperty("--kat",l.kat.toFixed(2)+"deg");});
  }
  function spocznij(){for(const m of membrany)m.style.transform="";for(const l of lampy){l.kat=0;l.pred=0;l.w.style.setProperty("--kat","0deg");}
    warstwa.style.setProperty("--uderzenie","0");if(rf)rf.style.setProperty("--uderzenie","0");energia=0;poprzOd=0;pulsLogo=0;if(bohater)bohater.style.scale="";}

  requestAnimationFrame(()=>{ulozLampy();stan();});
  const api={stan:()=>({gra,wyciszone,rusza:!!raf,kontekst:buforKtx?buforKtx.state:(typeof Glos!=="undefined"&&Glos.kontekstUI&&Glos.kontekstUI()?Glos.kontekstUI().state:null),
    lampy:lampy.map(l=>+l.kat.toFixed(2)),energia:+energia.toFixed(2),logo:+pulsLogo.toFixed(2),muzyka:buforZ||(utwor?"midi":null),utwor:utwor?{nuty:utwor.nuty.length,dl:+utwor.dl.toFixed(2),gotowy:!!midiBufor}:null})};
  window.MenuKoncert=api;
  return api;
})();
