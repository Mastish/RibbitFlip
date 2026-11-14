// Widownia RibbitBeat: drabinka 10 stopni toru „chórki na dole” (progresja).
// Klasyczny skrypt z jednym globalem EfektyWidownia; ładowany po gl-fx.js i efekty.js, a przed
// zabi-chor.js, więc globali gry (R, S, IMG, bufor, blask, obrazGotowy, mocStopnia) używa dopiero w chwili wywołania.
//
// Każdy stopień ma jedną sygnaturę (pole `cecha`, gra pokazuje ją w UI) i nic z sygnatur innych stopni: wyższy stopień
// to inny pomysł, nie poprzedni z dokładką. Stopnie 1–7 to wskaźniki {stopien, id, nazwa, cecha} na style z efekty.js
// (gra dobiera rysowanie z katalogu po id). Stopnie 8–10 (lasery, fajerwerki, stadion) rysuje ten moduł: wspólny jest
// tylko szkielet pasa (tło, dwa rzędy żab, żar przy ogniu), a sygnaturę włącza zestaw CECHY stopnia. Każda sygnatura
// ma własną reakcję na kombo, próg kombo i finał, żeby stopień nie był pusty bez cudzych warstw.
//
// Podział między 2D i silnikiem efektów (gl-fx.js, window.FX):
//  - rysuj(c, Wd, st): to, co stoi w pasie widowni (tło, trybuny, kratownica, flagi, race, tłum i cząstki, które
//    spadły do pasa), przycięte do pasa, bo tuż nad nim kończą się karty torów z nutami.
//  - fx(st): to, co wylatuje ponad pas (wiązki, rakiety, wybuchy, karteczki fali, dym rac). Z WebGL2 prymitywy leżą
//    pod #scena, czyli pod nutami („światło zza sceny”); w trybie 2D silnika rysują się od razu na #scena, NAD nutami,
//    więc wtedy emisja kończy się 1,5 wysokości pasa nad nim i cząstek jest o połowę mniej.
//  - Nad jasnym papierem kart światło addytywne bieleje: ponad pasem barwa idzie blendem normal (nasycone kolory
//    marki), a add dostają tylko rdzenie, które świecą tam, gdzie jest ciemno (filc, ciemne tło sceny).
//  - Czytelność: w pasie ±1,5 wysokości nuty wokół linii „teraz” każdego toru alfa prymitywu najwyżej 0,25.
// Cząstki: własna tablica i pula w module, fizyka na stałym kroku 1/120 s (grawitacja, opór, wiatr), limit 250
// (tryb 2D silnika: 120), osobny „świat” na każde płótno (gra, podgląd), reset() przy każdym układzie gry.
// Krok czasu = większy z prawdziwego (teraz) i z gry (beat i bpm): przewijanie ZC.ff (zegar prawie stoi, beat biegnie)
// daje wtedy ten sam obraz co gra na żywo, a ekran wyników (beat udawany) idzie czasem prawdziwym.
// Bez filter i shadowBlur; gradienty i sprite'y z buforów gry (bufor, klucze „ew-…” z rozmiarem i kolorem),
// „lighter” tylko w save/restore; migotanie najwyżej ok. 5 Hz (fotowrażliwość).
const EfektyWidownia=(function(){
  "use strict";
  const PI=Math.PI,TAU=2*PI;
  const ROZ="#ec1a83",LIM="#a6d861",ZIEL="#6cb33f",BURSZ="#eaa32b",ZOLTY="#ffd84a",NIEB="#294aa8",TUSZ="#211f1d",PAPIER="#faf6ee";
  const BLEKIT="#7fb6ff";   // jasny błękit wiązek, kałuż światła i irokezów (paleta „Niebieskiego płomienia” z efekty.js)
  const IROKEZY=[LIM,BURSZ,ROZ,BLEKIT],LASERY=[ROZ,LIM,BLEKIT,ZOLTY];
  const LASERY_PAPIER=[ROZ,ZIEL,NIEB,BURSZ];   // te same wiązki nad papierem kart: nasycone odpowiedniki (jasne giną)
  const KONFETTI=[ROZ,ZIEL,BURSZ,NIEB,ZOLTY,LIM];   // akcenty partii (ZC_TORY_STYL) i dwa jasne kolory marki
  const KROK=1/120,LIMIT=250,LIMIT_2D=120;

  // =========================================================================================== drobiazgi
  const przytnij=(v,a,b)=>v<a?a:v>b?b:v;
  const los=k=>{const v=Math.sin(k*12.9898+78.233)*43758.5453;return v-Math.floor(v);};   // 0..1, powtarzalne
  function szum(x){const i=Math.floor(x),f=x-i,u=f*f*(3-2*f);return los(i)*(1-u)+los(i+1)*u;}
  const kolorOk=k=>typeof k==="string"&&/^#[0-9a-f]{6}$/i.test(k);
  const RGB=new Map(),MIESZ=new Map();
  function rgbTab(hex){
    let t=RGB.get(hex);if(t)return t;
    const n=kolorOk(hex)?parseInt(hex.slice(1),16):0xec1a83;
    t=[(n>>16)&255,(n>>8)&255,n&255];RGB.set(hex,t);return t;
  }
  const rgbaK=(hex,a)=>{const t=rgbTab(hex);return "rgba("+t[0]+","+t[1]+","+t[2]+","+przytnij(+a||0,0,1).toFixed(3)+")";};
  function mieszaj(a,b,t){   // kolor pośredni (pamięć podręczna, bo wołane też w klatce)
    const k=a+b+t;let w=MIESZ.get(k);if(w)return w;
    const x=rgbTab(a),y=rgbTab(b),h=v=>Math.round(przytnij(v,0,255)).toString(16).padStart(2,"0");
    w="#"+h(x[0]+(y[0]-x[0])*t)+h(x[1]+(y[1]-x[1])*t)+h(x[2]+(y[2]-x[2])*t);
    if(MIESZ.size>500)MIESZ.clear();MIESZ.set(k,w);return w;
  }
  const ulamek=st=>st.faza-Math.floor(st.faza);
  const hop=st=>{const u=ulamek(st);return (1-u)*(1-u)*3;};
  const wyskok=(st,i)=>st.skok*(st.wyniki?18:12)*Math.abs(Math.sin(st.teraz/85+i*1.7));
  function fala(st,i){const tf=st.G?(st.teraz-st.fala0-i*35)/320:-1;return tf>0&&tf<1?16*Math.sin(PI*tf):0;}
  function klatkaTlumu(st,i,fl){
    return st.ap>.12?Math.min(4,1+Math.floor(st.ap*2.5)+((i+Math.floor(st.teraz/180))%2))
      :(st.spiewaja||fl>2)?1+((Math.floor(st.faza)+i)%3):0;
  }
  const kolys=(st,i)=>Math.sin(PI*st.faza+i)*.11*(i%2?1:-1);

  // ---- globale gry (dopiero w chwili wywołania; atrapa testu w Node ma tylko część z nich)
  const gR=()=>typeof R!=="undefined"&&R?R:null;
  const gS=()=>typeof S!=="undefined"&&S?S:null;
  function gFX(st){
    if(st&&st.FX&&typeof st.FX.sprite==="function")return st.FX;   // podgląd z własnym silnikiem (FX.podglad)
    return typeof FX!=="undefined"&&FX&&typeof FX.sprite==="function"?FX:null;
  }
  const gotowy=im=>!!im&&(typeof obrazGotowy==="function"?obrazGotowy(im):im.complete!==false&&(im.naturalWidth||im.width||0)>0);
  function zabaImg(k){const z=typeof IMG!=="undefined"&&IMG?IMG.zaby:null,im=z?z[k]:null;return gotowy(im)?im:null;}
  const buf=(k,w,h,fn)=>bufor("ew-"+k,Math.max(1,w),Math.max(1,h),fn);
  function gracze(){const s=gS();return s&&Array.isArray(s.gracze)?s.gracze:[];}
  // Lider sceny = najdłuższe kombo w składzie (remis: pierwszy z listy); jego kolor dostają rakiety fajerwerków.
  function lider(){let L=null;for(const g of gracze())if(!L||(g.kombo||0)>(L.kombo||0))L=g;return L;}
  let KG_KLUCZ="",KG=[];
  function koloryGraczy(st){   // kolory graczy (flagi, bukiety, szaliki), uzupełnione kolorami marki do czterech
    let klucz=st.kolor||"";for(const g of gracze())klucz+=g.kolor;
    if(klucz===KG_KLUCZ)return KG;
    const k=[];for(const g of gracze())if(kolorOk(g.kolor)&&!k.includes(g.kolor))k.push(g.kolor);
    for(const d of [kolorOk(st.kolor)?st.kolor:ROZ,LIM,BURSZ,BLEKIT])if(k.length<4&&!k.includes(d))k.push(d);
    KG_KLUCZ=klucz;KG=k;return k;
  }
  const zakonczone=()=>{const s=gS();return !!(s&&s.gra&&s.gra.koniecOd!=null);};

  // =========================================================================================== sprite'y tłumu
  // Kopia prywatnego pomocnika z efekty.js: żaba z irokezem przebarwionym na kolor, liczona raz na klatkę animacji
  // × kolor do bufora gry, potem jedno drawImage. getImageData tylko przy budowie bufora.
  function zabaIrokez(kl,kolor){
    const img=zabaImg(kl);if(!img)return null;
    if(kolor===ROZ)return img;
    return buf("irok|"+kl+"|"+kolor,96,96,c=>{
      c.drawImage(img,0,0,96,96);
      try{
        const d=c.getImageData(0,0,c.canvas.width,c.canvas.height),p=d.data,t=rgbTab(kolor);
        for(let i=0;i<p.length;i+=4){const r=p[i],g=p[i+1],b=p[i+2];
          if(p[i+3]>0&&r>120&&g<120&&b>50&&r>b&&r-g>90){const l=Math.min(1.25,r/236);
            p[i]=Math.min(255,t[0]*l);p[i+1]=Math.min(255,t[1]*l);p[i+2]=Math.min(255,t[2]*l);}}
        c.putImageData(d,0,0);
      }catch(e){/* płótno skażone albo atrapa: zostaje różowy irokez */}
    });
  }

  // =========================================================================================== układ pasa
  // Liczony raz na (szerokość, wysokość pasa, stopień, miniatura, liczba miejsc); współrzędne w układzie pasa
  // (0 = górna krawędź), a cząstki w układzie ekranu (silnik FX).
  const UKLADY=new Map();let generacja=0;
  // Liczba emiterów zależy od szerokości, nie od mocy stopnia: siatka laserów jest sygnaturą stopnia, więc ma być
  // gęsta od razu (mocą skalowały się wcześniej kolejne dokładki, a tych już nie ma).
  const liczbaEmiterow=(W,mini)=>mini?5:przytnij(Math.round(W/115),6,12);
  function uklad(W,Wd,st,id,K){
    const h=Wd.h,mini=!!st.mini,n=st.n;
    const klucz=Math.round(W)+"|"+Math.round(h)+"|"+id+"|"+(mini?1:0)+"|"+n;
    let L=UKLADY.get(klucz);if(L)return L;
    if(UKLADY.size>24)UKLADY.clear();
    L={klucz,W,h,id,K,mini,n,krok:W/n};
    // emitery laserów pod kratownicą u góry pasa
    L.emitery=[];if(K.lasery){const ne=liczbaEmiterow(W,mini);for(let i=0;i<ne;i++)L.emitery.push(W*(i+.5)/ne);}
    // trybuny: dwa rzędy głów na całej szerokości, flagi co jedenastą część pasa, race między flagami
    L.trybuny=[];L.flagi=[];L.race=[];
    if(K.trybuny){
      for(const [fy,fr,odst,j] of [[.13,.042,.105,0],[.235,.052,.125,1]]){
        const xs=[],d=odst*h;for(let x=d*.4,k=0;x<W;k++,x+=d*(.85+.3*los(k*.37+j*9)))xs.push(x);
        L.trybuny.push({y:fy*h,r:fr*h,xs});
      }
      const M=mini?4:11;for(let j=0;j<M;j++)L.flagi.push(W*(j+.5)/M);
      L.race=L.flagi.slice(0,-1).map((x,j)=>x+W/M/2+(j%2?1:-1)*h*.08);
    }
    L.tyl=[];for(let i=0;i<n-1;i++)L.tyl.push(L.krok*(i+1));   // tylny rząd: pół kroku przesunięty, mniejszy i przyciemniony
    UKLADY.set(klucz,L);
    return L;
  }

  // =========================================================================================== tło pasa (statyczne)
  // Jeden bufor na układ: niebo pasa, kałuże światła, a z sygnatury stopnia konstrukcja trybun albo kratownica
  // z emiterami; na koniec krawędź sceny. W klatce to jedno drawImage. Kolor nieba też mówi, który to stopień:
  // ciepła hala (lasery), nocne granatowe niebo (fajerwerki), zmierzch nad stadionem.
  function tloPasa(L,akcent){
    const {W,h,K}=L;
    return buf("tlo|"+L.klucz+"|"+akcent,W,h,c=>{
      const g=c.createLinearGradient(0,0,0,h),[g0,g1]=K.rakiety?["#1d2650","#16182a"]:K.trybuny?["#2c2a3a","#1d1b1e"]:["#2b2724","#1b1917"];
      g.addColorStop(0,g0);g.addColorStop(.6,g1);g.addColorStop(1,"#121110");
      c.fillStyle=g;c.fillRect(0,0,W,h);
      for(const [fx,kol,a] of [[.5,ROZ,.2],[.17,BLEKIT,.15],[.83,BLEKIT,.15]]){   // kałuże światła na podłodze
        const r=h*1.3,x=W*fx,gg=c.createRadialGradient(x,h,0,x,h,r);gg.addColorStop(0,rgbaK(kol,a));gg.addColorStop(1,rgbaK(kol,0));
        c.fillStyle=gg;c.fillRect(x-r,h-r,2*r,r);
      }
      if(K.trybuny){   // trybuny: dwa stopnie z przejściami
        c.fillStyle="#26221f";c.fillRect(0,h*.07,W,h*.14);
        c.fillStyle="#2e2925";c.fillRect(0,h*.21,W,h*.14);
        c.fillStyle="rgba(250,246,238,.08)";c.fillRect(0,h*.21,W,1);c.fillRect(0,h*.35,W,1);
        c.fillStyle="rgba(0,0,0,.25)";for(let x=W*.05;x<W;x+=W/(L.mini?3:9))c.fillRect(x,h*.07,Math.max(1.5,h*.04),h*.28);
      }
      if(K.lasery){   // kratownica laserów z emiterami
        const t=Math.max(3,h*.065);c.fillStyle="#141210";c.fillRect(0,0,W,t);
        c.strokeStyle="#3d3833";c.lineWidth=1;c.beginPath();
        for(let x=0;x<W;x+=t*1.4){c.moveTo(x,1);c.lineTo(x+t*.7,t-1);c.lineTo(x+t*1.4,1);}
        c.stroke();c.fillStyle="#4d463e";c.fillRect(0,t-1,W,1);
        for(const x of L.emitery){c.fillStyle="#1d1b19";c.fillRect(x-t*.6,t-1,t*1.2,t*.9);c.fillStyle="#5c554b";c.fillRect(x-t*.6,t-1,t*1.2,1);}
      }else{c.fillStyle=akcent;c.fillRect(0,0,W,2);}
      c.fillStyle="#0d0c0b";c.fillRect(0,h*.95,W,h*.05);c.fillStyle="rgba(250,246,238,.07)";c.fillRect(0,h*.95,W,1);
    });
  }
  // Rzędy kibiców na trybunach: koszulki i głowy, jedna ścieżka na kolor (bufor na układ).
  const KOSZULKI=["#5a4f45","#4a443d","#6b4a5a","#4f5a3f","#5f5338","#3f4a62"];
  function rzadTrybun(L,j){
    const T=L.trybuny[j];
    return buf("tryb|"+L.klucz+"|"+j,L.W,L.h*.42,c=>{
      const r=T.r,yk=i=>T.y+(los(i*1.3+j)-.5)*r*.4;
      for(let k=0;k<KOSZULKI.length;k++){c.beginPath();
        for(let i=0;i<T.xs.length;i++){if(Math.floor(los(i*2.7+j*5)*KOSZULKI.length)!==k)continue;const x=T.xs[i],y=yk(i)+r*1.5;
          c.moveTo(x+r*1.2,y);c.ellipse(x,y,r*1.2,r*.85,0,0,TAU);}
        c.fillStyle=KOSZULKI[k];c.fill();}
      c.beginPath();for(let i=0;i<T.xs.length;i++){const x=T.xs[i],y=yk(i);c.moveTo(x+r,y);c.arc(x,y,r,0,TAU);}
      c.fillStyle=j?"#55703d":"#465c35";c.fill();
    });
  }
  // Tylny rząd tłumu: co druga żaba w jednym buforze (dwa bufory podskakują na zmianę), przyciemniony.
  function rzadTylny(L,st,par){
    if(!zabaImg(0))return null;
    const zw=st.zw*.74;
    const hb=zw*1.25;   // bufor tylko na wysokość rzędu (pełny pas to dwa razy więcej pikseli do skopiowania co klatkę)
    return buf("tyl|"+L.klucz+"|"+par+"|"+st.zw.toFixed(1),L.W,hb,c=>{
      let j=0;
      for(const x of L.tyl){if((j++)%2!==par)continue;
        const kl=[0,1,0,2,0][Math.floor(los(x*.13)*5)],img=zabaIrokez(kl,IROKEZY[Math.floor(los(x*.71)*4)]);
        const im=img&&(img.cv||img);if(!im)continue;
        const s=zw*(img.cv?img.w/96:1);
        c.save();c.translate(x,hb/2);c.rotate((los(x*.29)-.5)*.3);c.drawImage(im,-s/2,-s/2,s,s);c.restore();
      }
      c.globalCompositeOperation="source-atop";c.fillStyle="rgba(24,21,19,.5)";c.fillRect(0,0,L.W,hb);
    });
  }
  function zarPasa(L){   // żar podłogi przy ogniu: dolne 70 % pasa (rysowany z przesunięciem o 0,3 wysokości)
    return buf("zar|"+L.W+"|"+L.h,L.W,L.h*.7,c=>{
      const g=c.createLinearGradient(0,0,0,L.h*.7);g.addColorStop(0,"rgba(234,163,43,0)");g.addColorStop(1,"rgba(234,163,43,.55)");
      c.fillStyle=g;c.fillRect(0,0,L.W,L.h*.7);
    });
  }

  // =========================================================================================== świat cząstek
  const SWIATY=new WeakMap();
  function swiatDla(c){
    let sw=SWIATY.get(c);
    if(!sw||sw.gen!==generacja){sw=nowySwiat();SWIATY.set(c,sw);}
    return sw;
  }
  function nowySwiat(){
    return {gen:generacja,ziarno:0x2f6b1d35,t:0,akum:0,dt:0,ostTeraz:null,ostFaza:null,ostWyn:false,ostSkok:0,ostOg:0,
      ostTakt:null,ostPol:null,ostFala:null,cz:[],pula:[],laserBlysk:0,fala:null,wiatr:.05,doRakiet:0,doDymu:0,doFali:0,
      lim:LIMIT,tryb2d:false,u:60,Wd:{y:0,h:60},W:0,ile:[0,0,0,0,0],moc:1,kolL:ROZ,kolory:[ROZ,LIM,BURSZ,BLEKIT],pasy:[],skY:1};
  }
  function losS(sw){let x=sw.ziarno|0;x^=x<<13;x^=x>>>17;x^=x<<5;sw.ziarno=x>>>0;return sw.ziarno/4294967296;}
  // Rodzaje cząstek i ich fizyka (w wysokościach pasa na sekundę, więc obraz skaluje się z rozdzielczością).
  // Konfetti zostało tylko jako karteczki podrzucane falą stadionu; rakieta, iskra i błysk to fajerwerki, dym to
  // race i wybuchy.
  const KONF=0,RAK=1,ISK=2,DYM=3,BLS=4;
  //            konfetti rakieta iskra  dym   błysk
  const GRAW=  [2.9,    0,      1.15,  -.3,  0];   // dym się wznosi
  const OPOR=  [2.4,    0,      2.1,   .9,   0];
  const WIATRU=[1,      .1,     .25,   .7,   0];
  const TLUM=OPOR.map(k=>Math.exp(-k*KROK));
  const TLUM_LOT=Math.exp(-1.1*KROK);   // karteczka przez pierwsze 0,45 s leci łukiem nad tłum, potem trzepocze (opór 2,4)
  const CIEMNE=new Map(KONFETTI.map(k=>[k,mieszaj(k,TUSZ,.38)]));   // spód paska konfetti przy obrocie
  // Budżet puli na rodzaj (ułamek limitu): bukiet potrafi zająć całą pulę iskrami, a dym rac i karteczki fali też muszą
  // dostać miejsce.
  //              konf rak  isk  dym  bls
  const UDZIAL=  [.42, .04, .6,  .14, .04];
  function nowa(sw,typ){
    if(sw.cz.length>=sw.lim||sw.ile[typ]>=Math.ceil(sw.lim*UDZIAL[typ]))return null;
    const p=sw.pula.pop()||{hs:[]};sw.ile[typ]++;
    p.t=typ;p.w=0;p.z=1;p.x=0;p.y=0;p.vx=0;p.vy=0;p.r=1;p.k=ROZ;p.k2=null;p.a=0;p.wa=0;p.f=0;p.fw=0;p.g=0;p.s=1;p.hs.length=0;p.hl=-1;
    sw.cz.push(p);return p;
  }
  function usun(sw,i){const cz=sw.cz,p=cz[i];cz[i]=cz[cz.length-1];cz.pop();sw.ile[p.t]--;if(sw.pula.length<LIMIT)sw.pula.push(p);}
  function slad(p,ile,hz){const n=Math.floor(p.w*hz);if(n===p.hl)return;p.hl=n;p.hs.push(p.x,p.y);if(p.hs.length>2*ile)p.hs.splice(0,2);}
  function fizyka(sw,dt){
    const u=sw.u,dol=sw.Wd.y+sw.Wd.h,W=sw.W,cz=sw.cz,wiatr=sw.wiatr;
    for(let i=cz.length-1;i>=0;i--){
      const p=cz[i];p.w+=dt;
      if(p.t===RAK){p.vy+=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;slad(p,7,30);if(p.w>=p.z){wybuch(sw,p);usun(sw,i);}continue;}
      if(p.t===BLS){if(p.w>=p.z)usun(sw,i);continue;}
      const t=p.t;
      p.vy+=GRAW[t]*u*dt;p.vx+=WIATRU[t]*wiatr*u*dt;
      if(t===KONF){p.f+=p.fw*dt;p.vx+=Math.cos(p.f)*2.2*u*dt;}   // trzepotanie: pasek opada wahadłem
      const k=t===KONF&&p.w<.45?TLUM_LOT:TLUM[t];p.vx*=k;p.vy*=k;
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.a+=p.wa*dt;
      if(t===ISK)slad(p,9,18);   // iskra: ogon z ostatnich 0,5 s (chryzantema)
      if(p.w>=p.z||p.y>dol+2||p.x<-.3*W||p.x>1.3*W)usun(sw,i);
    }
  }

  // ---- źródła cząstek
  // Rakieta: start zza tłumu, wznosi się dokładnie T s (opóźnienie ruchu = grawitacja), wybucha w szczycie lotu.
  function rakieta(sw,st,x,wys,T,kolor,pistil,sila){
    const p=nowa(sw,RAK);if(!p)return;
    const u=sw.u,y0=sw.Wd.y+u*.45,H=sw.Wd.y-wys-y0;
    p.x=x;p.y=y0;p.z=T;p.g=-2*H/(T*T);p.vy=2*H/T;p.vx=(losS(sw)-.5)*u*.3;
    p.k=kolor;p.k2=pistil;p.s=sila;p.r=u*(sw.tryb2d?.45+.15*losS(sw):(1.25+.5*losS(sw))*(.8+.2*st.moc))*Math.max(.35,sw.skY);
  }
  function wysRakiety(sw,st){const u=sw.u;return Math.min(sw.Wd.y*.8,sw.tryb2d?u*(.75+.35*losS(sw)):u*(1.7+1.5*losS(sw))*(.85+.15*st.moc)*sw.skY);}
  function xWolne(sw,od,doX,m){let x=0;for(let k=0;k<6;k++){x=sw.W*(od+(doX-od)*losS(sw));if(!blisko(sw,x,m))return x;}return x;}
  function blisko(sw,x,m){for(const q of sw.pasy)if(x>q.x0-m&&x<q.x1+m)return true;return false;}
  function rakietaTaktu(sw,st,T,nr){
    const pist=sw.kolL===ZOLTY?BURSZ:ZOLTY,kol=nr?(kolorOk(st.akcent)&&st.akcent!==sw.kolL?st.akcent:sw.kolory[1%sw.kolory.length]):sw.kolL;
    rakieta(sw,st,xWolne(sw,.16,.84,sw.u*.7),wysRakiety(sw,st),T,kol,pist,1);
  }
  // Bukiet: kilka rakiet naraz, wybuchy prawie razem na różnych wysokościach, w kolorach graczy.
  function bukiet(sw,st,ile,szybki){
    for(let k=0;k<ile;k++){
      const kol=sw.kolory[k%sw.kolory.length],T=(szybki?.42:.62)+k*.07+.08*losS(sw);
      rakieta(sw,st,xWolne(sw,.12+.76*k/Math.max(1,ile),.12+.76*(k+1)/Math.max(1,ile),sw.u*.5),wysRakiety(sw,st),T,kol,k%2?PAPIER:ZOLTY,.8);
    }
  }
  // Wybuch chryzantemy: płatki zewnętrzne w kolorze rakiety, środek („pistil”) w bursztynie; kierunki co złoty kąt,
  // prędkość = promień × opór (iskra hamuje na promieniu), potem opada wierzbą. Każda iskra ciągnie smugę z kilku
  // ostatnich położeń. Barwy idą blendem normal: nad papierem kart rdzenie add bielały i wybuch wychodził blady.
  function wybuch(sw,r){
    const u=sw.u,gl=!sw.tryb2d,Rw=r.r,maks=Math.round((34+56*sw.moc)*(gl?1:.5)*r.s);
    const ile=Math.max(0,Math.min(maks,sw.lim-sw.cz.length-3,Math.ceil(sw.lim*UDZIAL[ISK])-sw.ile[ISK])),zew=Math.round(ile*.72),f0=losS(sw)*TAU;
    const kz=naPapier(r.k),kw=naPapier(r.k2||BURSZ);
    const b=nowa(sw,BLS);if(b){b.x=r.x;b.y=r.y;b.z=.3;b.r=Rw*1.15;b.k=kz;b.s=.24;b.f=0;}
    for(let k=0;k<ile;k++){const p=nowa(sw,ISK);if(!p)break;
      const wew=k>=zew,a=f0+k*2.39996,v=Rw*OPOR[ISK]*(wew?.45:1)*(.93+.14*losS(sw));
      p.x=r.x;p.y=r.y;p.vx=Math.cos(a)*v;p.vy=Math.sin(a)*v;p.z=(wew?1.2:1.6)+.6*losS(sw);
      p.r=u*(wew?.032:.042);p.k=wew?kw:kz;p.f=losS(sw)*TAU;}
    const d=nowa(sw,DYM);if(d){d.x=r.x;d.y=r.y;d.vy=-u*.08;d.z=2.4;d.r=Rw*.7;d.k=mieszaj(kz,"#c9ad7c",.6);d.s=gl?.07:.05;}
  }
  // Jasne kolory (żółć, limonka, papier) na papierze kart giną: do fajerwerków przyciemnione o jedną trzecią.
  function naPapier(k){const t=rgbTab(k),L=(.2126*t[0]+.7152*t[1]+.0722*t[2])/255;return L>.55?mieszaj(k,TUSZ,.3):k;}

  // =========================================================================================== zdarzenia klatki
  // Strefy czytelności (liczone raz na układ gry): pas ±1,5 wysokości nuty wokół linii „teraz” (jak nh w rysujTor)
  // oraz klawiatura toru z nazwami dźwięków (leży w #tlo, pod warstwą prymitywów, więc wiązka albo dym by ją zakryły).
  let PASY_WERSJA=-1,PASY_LISTA=[],PASY_TORY=0;
  function pasyTeraz(){
    const Rg=gR();if(!Rg||!Array.isArray(Rg.tory))return PASY_LISTA=[];
    if(Rg.wersja===PASY_WERSJA&&PASY_TORY===Rg.tory.length)return PASY_LISTA;
    PASY_WERSJA=Rg.wersja;PASY_TORY=Rg.tory.length;PASY_LISTA=[];
    for(const T of Rg.tory){if(!T||!Number.isFinite(T.teraz))continue;
      const rh=T.rh||12,nh=Math.max(8,Math.min(30,Math.max(rh*.6,Math.min(rh*1.15,14))));
      PASY_LISTA.push({x0:T.teraz-1.5*nh,x1:T.teraz+1.5*nh,y0:T.y,y1:T.y+T.h});
      if(Number.isFinite(T.kx))PASY_LISTA.push({x0:T.x,x1:T.kx+(T.kw||24)+30,y0:T.y,y1:T.y+T.h});}
    return PASY_LISTA;
  }
  // Siła rac: ogień kombo w grze, a na finale brawa (race płoną do końca oklasków, a nie gasną razem z kombo).
  // Liczba zapalonych rac rośnie z ogniem (przy pełnym wszystkie), niezależnie od mocy stopnia: race to sygnatura.
  const ogienRac=st=>st.wyniki?Math.max(st.zar,3*st.ap):st.zar;
  const ileRac=(L,ar)=>ar<.3?0:Math.min(L.race.length,Math.ceil(ar/3*L.race.length));
  // Zdarzenia klatki. Każda sygnatura ma własne reakcje na trzy momenty gry: co 4. nutę kombo (st.skok), próg kombo
  // 4/8/12 (og rośnie) i finał (ekran wyników, brawa st.ap). Bez tego stopień po wycięciu cudzych warstw stałby pusty.
  function zyj(sw,L,Wd,st,K){
    const Rg=gR(),RS=Rg&&Rg.st,s=gS(),G=s&&s.gra;
    const bpm=(RS&&RS.bpm)||(G&&G.bpm)||120,metrum=(G&&G.metrum)||4,wGrze=!!st.G&&!st.wyniki&&!zakonczone();
    let dtR=sw.ostTeraz==null?0:(st.teraz-sw.ostTeraz)/1000,dtG=0;
    if(st.G&&!st.wyniki&&sw.ostFaza!=null&&!sw.ostWyn){const d=st.faza-sw.ostFaza;if(d>0&&d<2)dtG=d*60/bpm;}
    const dt=przytnij(Math.max(dtR,dtG),0,.1),start=sw.ostTeraz==null;
    sw.dt=dt;sw.u=Wd.h;sw.Wd=Wd;sw.W=st.W;sw.moc=st.moc;sw.tryb2d=!st.gl;sw.lim=st.gl?LIMIT:LIMIT_2D;sw.pasy=pasyTeraz();
    // ile miejsca nad pasem (w grze ok. 10 wysokości pasa, w podglądzie okna „Scena” mniej niż jedna): wysokości efektów
    // ponad pasem skalują się do niego, żeby fajerwerk nie wybuchał poza płótnem
    sw.skY=przytnij((Wd.y-6)/(3.4*Wd.h),.2,1);
    const og=RS&&Number.isFinite(RS.og)?RS.og:st.zar>=2.5?3:st.zar>=1.5?2:st.zar>=.5?1:0;
    const ld=lider();
    sw.kolL=ld&&kolorOk(ld.kolor)?ld.kolor:kolorOk(st.kolor)?st.kolor:ROZ;sw.kolory=koloryGraczy(st);
    sw.wiatr=K.flagi?.2+.08*szum(sw.t*.2):.05;
    sw.laserBlysk=Math.max(0,sw.laserBlysk-dt/.7);
    if(!start){
      if(wGrze){
        const prog=og>sw.ostOg,cwierc=!prog&&st.skok>sw.ostSkok+.12&&st.skok>.8;
        // lasery: próg kombo otwiera wachlarz i rozjaśnia całą siatkę, co 4. nuta kombo to krótszy błysk wiązek
        if(K.lasery){if(prog)sw.laserBlysk=1;else if(cwierc)sw.laserBlysk=Math.max(sw.laserBlysk,.45);}
        if(K.rakiety){
          if(prog)bukiet(sw,st,og>=3?3:2,true);   // próg kombo: mały bukiet od razu
          if(st.faza>=0){   // rakieta co takt, start 1,5 ćwierćnuty przed taktem: wybuch trafia w „raz”
            const T=przytnij(1.5*60/bpm,.5,1.1),wyp=T*bpm/60,takt=Math.floor((st.faza+wyp)/metrum),pol=Math.floor((st.faza+wyp)/(metrum/2));
            if(sw.ostTakt!=null&&takt>sw.ostTakt){if(st.spiewaja||og>0||takt%2===0)rakietaTaktu(sw,st,T,0);}
            else if(og>=3&&sw.ostPol!=null&&pol>sw.ostPol&&pol%2===1)rakietaTaktu(sw,st,T,1);   // ogień 3: drugi na pół taktu
            sw.ostTakt=takt;sw.ostPol=pol;
          }
        }
        if(K.fala){   // fala co dwa takty, a próg kombo puszcza ją od razu (nie czeka do końca dwutaktu)
          const f=Math.floor(st.faza/(2*metrum));
          if(prog||(sw.ostFala!=null&&f>sw.ostFala&&st.faza>=0))sw.fala={t0:sw.t};
          sw.ostFala=f;
        }
        if(K.race&&prog)dymRac(sw,L,st,2*ileRac(L,ogienRac(st)));   // próg kombo: zapalone race buchają dymem naraz
      }
      if(st.wyniki){   // finał: każda sygnatura gra po swojemu, dopóki trwają brawa
        const ap=st.ap;
        if(!sw.ostWyn){if(K.rakiety)bukiet(sw,st,4,false);if(K.lasery)sw.laserBlysk=1;if(K.fala)sw.fala={t0:sw.t};}
        if(K.rakiety){sw.doRakiet+=dt*(ap>.12?.8+1.4*ap:.3);while(sw.doRakiet>=1){sw.doRakiet--;if(ap>.45)bukiet(sw,st,3,false);else rakietaTaktu(sw,st,.7,0);}}
        if(K.fala&&(!sw.fala||sw.t-sw.fala.t0>2.4))sw.fala={t0:sw.t};
      }
      if(K.fala&&sw.fala&&!st.spokoj){   // grzbiet fali meksykańskiej podrzuca karteczki w kolorach graczy ponad pas
        const fx=-.12*sw.W+(sw.t-sw.fala.t0)/1.7*1.25*sw.W;
        if(fx>-.05*sw.W&&fx<1.05*sw.W){sw.doFali+=dt*22*st.moc*(sw.tryb2d?.5:1);
          while(sw.doFali>=1){sw.doFali--;const p=nowa(sw,KONF);if(!p)break;
            p.x=fx+(losS(sw)-.5)*sw.W*.05;p.y=Wd.y+sw.u*.2;p.vx=(losS(sw)-.5)*sw.u*.8;p.vy=-sw.u*(sw.tryb2d?2.2:3+1.6*losS(sw))*(.6+.4*sw.skY);
            p.z=2.4+losS(sw);p.r=sw.u*.036;p.k=sw.kolory[Math.floor(losS(sw)*sw.kolory.length)];p.a=losS(sw)*TAU;p.wa=(losS(sw)-.5)*10;p.f=losS(sw)*TAU;p.fw=4+3*losS(sw);}}
      }
      const ir=K.race?ileRac(L,ogienRac(st)):0;
      if(ir){   // dym rac w kolorze partii, gęstszy z ogniem
        sw.doDymu+=dt*2.5*ir;
        const n=Math.floor(sw.doDymu);sw.doDymu-=n;if(n)dymRac(sw,L,st,n);
      }
    }
    sw.ostOg=wGrze?og:0;sw.ostSkok=st.skok;
    // fizyka na stałym kroku
    sw.akum+=dt;let n=0;
    while(sw.akum>=KROK&&n<14){fizyka(sw,KROK);sw.akum-=KROK;n++;}
    if(n>=14)sw.akum=0;
    sw.t+=dt;
    sw.ostTeraz=st.teraz;sw.ostFaza=st.faza;sw.ostWyn=!!st.wyniki;
  }
  function dymRac(sw,L,st,ile){
    const m=ileRac(L,ogienRac(st)),u=sw.u;if(!m)return;
    for(let k=0;k<ile;k++){const p=nowa(sw,DYM);if(!p)break;const x=L.race[Math.floor(losS(sw)*m)];
      p.x=x+(losS(sw)-.5)*u*.1;p.y=sw.Wd.y+u*.2;p.vx=(losS(sw)-.5)*u*.3;p.vy=-u*(.55+.3*losS(sw));
      p.z=2.4+.6*losS(sw);p.r=u*.22;p.k=kolorOk(st.akcent)?st.akcent:ROZ;p.s=sw.tryb2d?.14:.24;p.g=1.5;}
  }

  // =========================================================================================== rysowanie 2D w pasie
  let glebia=0;
  function zapisz(c){c.save();glebia++;}
  function przywroc(c){c.restore();glebia--;}
  function rysujStopien(id,K,c,Wd,st){
    const L=uklad(st.W,Wd,st,id,K),stat=!!(st.spokoj||st.bezRuchu||st.mini);
    const sw=stat?null:swiatDla(c);
    if(sw)zyj(sw,L,Wd,st,K);
    OST={st,sw,L,Wd,K};
    const akcent=kolorOk(st.akcent)?st.akcent:ROZ;
    glebia=0;zapisz(c);
    try{
      c.beginPath();c.rect(0,Wd.y,st.W,Wd.h);c.clip();c.translate(0,Wd.y);
      c.drawImage(tloPasa(L,akcent).cv,0,0,L.W,L.h);
      if(K.trybuny){
        for(let j=0;j<2;j++){const b=rzadTrybun(L,j);c.drawImage(b.cv,0,0,b.w,b.h);}
        if(stat)falaTrybun(c,L,L.W*.6,koloryGraczy(st));   // spoczynek i miniatura: fala zatrzymana w pół drogi
        else if(sw.fala){const fx=-.12*L.W+(sw.t-sw.fala.t0)/1.7*1.25*L.W;if(fx>L.W*1.15)sw.fala=null;else falaTrybun(c,L,fx,sw.kolory);}
      }
      if(K.race)race(c,L,st,sw);
      if(K.flagi)flagi(c,L,st,sw);
      if(stat&&K.rakiety)rozety(c,L,st);
      if(K.lasery)laseryPasa(c,L,st,sw);
      rzadTylnyRysuj(c,L,st);
      if(st.zar>.05&&!st.mini){const z=zarPasa(L);zapisz(c);c.globalCompositeOperation="lighter";c.globalAlpha=Math.min(1,.5*st.zar/3);c.drawImage(z.cv,0,L.h*.3,z.w,z.h);przywroc(c);}
      rzadPrzedni(c,L,st);
      if(sw&&sw.cz.length)czastki2D(c,L,sw,Wd);
    }finally{while(glebia>0)przywroc(c);}
  }
  // Fala meksykańska: pas rąk w górę i szalików w kolorach graczy biegnie przez trybuny w 1,7 s (fx = grzbiet fali).
  function falaTrybun(c,L,fx,kk){
    const sz=L.W*.07;
    c.lineCap="round";
    const sz2=[];
    for(let j=0;j<2;j++){const T=L.trybuny[j];c.beginPath();
      for(const x of T.xs){const d=Math.abs(x-fx);if(d>sz)continue;const q=Math.cos(d/sz*PI/2),y=T.y-T.r*.4,ra=T.r*2.6*q;
        c.moveTo(x-T.r*.7,y+T.r*.6);c.lineTo(x-T.r*1.1,y-ra);c.moveTo(x+T.r*.7,y+T.r*.6);c.lineTo(x+T.r*1.1,y-ra);
        if(q>.35)sz2.push(x,y-ra-T.r*.2,T.r*(.7+.5*q));}
      c.strokeStyle=j?"rgba(216,205,184,.55)":"rgba(216,205,184,.4)";c.lineWidth=Math.max(1,T.r*.42);c.stroke();}
    for(let k=0;k<kk.length;k++){c.beginPath();let jest=false;
      for(let i=k*3;i<sz2.length;i+=3*kk.length){const x=sz2[i],y=sz2[i+1],r=sz2[i+2];c.rect(x-r*1.5,y-r*.55,r*3,r*1.1);jest=true;}
      if(jest){c.fillStyle=kk[k];c.fill();}}
  }
  // Race między flagami: płomień różowy z żółtym rdzeniem; w wariancie spokojnym bez płomieni (ruch i jasność).
  function race(c,L,st,sw){
    if(st.spokoj)return;
    const ile=ileRac(L,ogienRac(st)),h=L.h,t=sw?sw.t:0;if(!ile)return;
    zapisz(c);c.globalCompositeOperation="lighter";
    for(let j=0;j<ile;j++){const x=L.race[j],y=h*.22,pl=.82+.18*szum(t*4.5+j*3);   // płomień racy faluje wolno (≤ 5 Hz)
      const r=h*.3*pl;c.globalAlpha=.6;c.drawImage(blask(ROZ).cv,x-r,y-r,2*r,2*r);
      const r2=h*.09*pl;c.globalAlpha=.95;c.drawImage(blask(ZOLTY).cv,x-r2,y-r2,2*r2,2*r2);}
    przywroc(c);
  }
  // Flagi w kolorach graczy: łopoczą na lekkim wietrze (najwyżej ok. 2 Hz), w spoczynku wiszą nieruchomo.
  function flagi(c,L,st,sw){
    if(!L.flagi.length)return;
    const h=L.h,t=sw?sw.t:0,wiatr=sw?sw.wiatr:.2,fl=h*.3,fh=h*.16,top=h*.035,dol=h*.34,kk=sw?sw.kolory:koloryGraczy(st);
    c.strokeStyle="#b3a892";c.lineWidth=Math.max(1.2,h*.022);c.beginPath();
    for(const x of L.flagi){c.moveTo(x,dol);c.lineTo(x,top);}c.stroke();
    const kat=(1-wiatr)*.95,cs=Math.cos(kat),sn=Math.sin(kat),om=st.spokoj?0:5+7*wiatr,A=fh*(.16+.24*wiatr);
    const sciezka=(x,j)=>{
      for(let k=0;k<=5;k++){const s=k/5,o=A*s*Math.sin(om*t-s*4+j*1.7);c[k?"lineTo":"moveTo"](x+cs*s*fl-sn*o,top+sn*s*fl+cs*o);}
      for(let k=5;k>=0;k--){const s=k/5,o=A*s*Math.sin(om*t-s*4+j*1.7)+fh*(1-.18*s);c.lineTo(x+cs*s*fl-sn*o,top+sn*s*fl+cs*o);}
      c.closePath();
    };
    for(let k=0;k<kk.length;k++){c.beginPath();let jest=false;
      for(let j=k;j<L.flagi.length;j+=kk.length){sciezka(L.flagi[j],j);jest=true;}
      if(jest){c.fillStyle=kk[k];c.fill();}}
    c.beginPath();L.flagi.forEach((x,j)=>sciezka(x,j));c.strokeStyle=TUSZ;c.lineWidth=1;c.stroke();
  }
  // Fajerwerki w spoczynku, w wariancie spokojnym i w miniaturze: to, co w grze wybucha ponad pasem, jako trzy
  // nieruchome rozety w pasie (środkowa w kolorze lidera, boczne w kolorach graczy).
  function rozety(c,L,st){
    const {W,h}=L,kk=koloryGraczy(st);
    for(const [fx,fy,k,pk] of [[.5,.24,kk[0],ZOLTY],[.68,.2,kk[1],PAPIER],[.32,.21,kk[2],ZOLTY]]){
      const x=W*fx,y=h*fy,r=h*.18;c.beginPath();
      for(let i=0;i<14;i++){const a=i*TAU/14;for(const q of [1,.55]){const px=x+Math.cos(a+q)*r*q,py=y+Math.sin(a+q)*r*q,rr=Math.max(.6,h*.012*q*1.6);c.moveTo(px+rr,py);c.arc(px,py,rr,0,TAU);}}
      c.fillStyle=k;c.fill();
      c.beginPath();c.arc(x,y,Math.max(1,h*.02),0,TAU);c.fillStyle=pk;c.fill();
    }
  }
  // Lasery w pasie: soczewki pulsują na ćwierćnuty; wiązki skanują tłum (jedna ścieżka na kolor). Liczba wiązek rośnie
  // z ogniem, a błysk progu kombo zapala na chwilę całą siatkę. W spoczynku i w miniaturze siatka stoi nieruchomo.
  function laseryPasa(c,L,st,sw){
    const em=L.emitery;if(!em.length)return;
    const h=L.h,t0=Math.max(3,h*.065),yl=t0*1.45,fin=st.wyniki&&st.ap>.12,bl=sw?sw.laserBlysk:0;
    const ile=st.spokoj||!sw?em.length:fin?em.length:Math.min(em.length,Math.round(st.zar/3*em.length+bl*em.length)+(st.spiewaja?2:0));
    const pul=st.spokoj?.6:.5+.5*Math.pow(1-ulamek(st),2)+.4*bl;
    zapisz(c);c.globalCompositeOperation="lighter";
    for(let k=0;k<LASERY.length;k++){c.beginPath();const r=Math.max(1.1,h*.028);
      for(let i=k;i<em.length;i+=LASERY.length){c.moveTo(em[i]+r,yl);c.arc(em[i],yl,r,0,TAU);}
      c.fillStyle=rgbaK(LASERY[k],Math.min(1,pul));c.fill();}
    if(ile>0){
      c.lineCap="round";const krok=Math.max(1,Math.floor(em.length/ile)),t=sw?sw.t:0;
      for(let k=0;k<LASERY.length;k++){c.beginPath();let jest=false;
        for(let i=0,n=0;i<em.length&&n<ile;i+=krok,n++){if(i%LASERY.length!==k)continue;
          const kat=st.spokoj||!sw?.35*(i%2?1:-1):.62*Math.sin(PI*st.faza*.5+i*1.3)+(fin?.3*Math.sin(t*2+i):0);
          c.moveTo(em[i],yl);c.lineTo(em[i]+Math.tan(kat)*(h*.96-yl),h*.96);jest=true;}
        if(!jest)continue;
        const a=st.spokoj||!sw?.4:1;
        c.strokeStyle=rgbaK(LASERY[k],.28*a);c.lineWidth=Math.max(2,h*.05);c.stroke();
        c.strokeStyle=rgbaK(mieszaj(LASERY[k],PAPIER,.5),.85*a);c.lineWidth=1;c.stroke();}
    }
    przywroc(c);
  }
  function rzadTylnyRysuj(c,L,st){
    const ruch=st.spokoj?0:(st.spiewaja||st.ap>.05?1:.35)*(.6+.4*st.moc);
    for(let par=0;par<2;par++){const b=rzadTylny(L,st,par);if(!b)continue;
      c.drawImage(b.cv,0,L.h*.47-b.h/2-L.h*.045*ruch*Math.abs(Math.sin(PI*st.faza+par*PI/2)),b.w,b.h);}
  }
  // Tłum przedni: żaby w kolorowych irokezach, podskok na bit i wyskok co 4. nutę kombo. Ten sam szkielet na
  // każdym stopniu modułu; czaszki i mosh pit to sygnatury stylów z efekty.js, więc tu ich nie ma. Skoki przycięte miękko
  // (tanh) do górnej krawędzi pasa, bo 2D nie wychodzi ponad pas.
  function rzadPrzedni(c,L,st){
    const n=st.n,krok=st.krok,h=L.h,sk=h/64,zw=st.zw,podl=h-st.lw*.32,y0=podl-zw*.38;
    const stat=!!(st.spokoj||st.mini),maxUn=Math.max(2,y0-zw*.5-1);
    const ruch=stat?0:(st.spiewaja||st.ap>.05?9:3)*(.55+.45*st.moc)*sk,h0=stat?0:hop(st)*sk;
    for(let i=0;i<n;i++){
      const x=krok*(i+.5),fl=stat?0:fala(st,i),kl=klatkaTlumu(st,i,fl);
      const img=zabaIrokez(kl,IROKEZY[i%4]);if(!img)continue;
      let un=h0+(stat?0:(wyskok(st,i)+fl)*sk)+ruch*Math.abs(Math.sin(PI*st.faza+(i%2)*PI/2));
      un=maxUn*Math.tanh(un/maxUn);
      const k=stat?0:kolys(st,i),im=img.cv||img,s=img.cv?zw*img.w/96:zw;
      zapisz(c);c.translate(x,y0-un);c.rotate(k);c.drawImage(im,-s/2,-s/2,s,s);przywroc(c);
    }
  }
  const GRUPY=new Map(),KGRUPY=new Map();   // iskry i konfetti w pasie wg koloru (tablice używane co klatkę od nowa)
  // Cząstki, które spadły do pasa (karteczki fali, iskry, rakieta przy starcie), rysuje 2D: z WebGL2 pas zasłania
  // prymitywy silnika, więc bez tego karteczki znikałyby na krawędzi pasa.
  function czastki2D(c,L,sw,Wd){
    const y0=Wd.y,cz=sw.cz;
    for(const g of KGRUPY.values())g.length=0;   // konfetti: obrócone paski, jedna ścieżka na kolor
    for(const p of cz){if(p.t!==KONF)continue;const y=p.y-y0;if(y<-p.r*2)continue;
      let g=KGRUPY.get(p.k);if(!g){if(KGRUPY.size>24)KGRUPY.clear();KGRUPY.set(p.k,g=[]);}g.push(p);}
    for(const [k,g] of KGRUPY){if(!g.length)continue;c.beginPath();
      for(const p of g){const y=p.y-y0,s=.25+.75*Math.abs(Math.cos(p.f)),dx=Math.cos(p.a)*p.r,dy=Math.sin(p.a)*p.r,ex=-Math.sin(p.a)*p.r*.45*s,ey=Math.cos(p.a)*p.r*.45*s;
        c.moveTo(p.x-dx-ex,y-dy-ey);c.lineTo(p.x+dx-ex,y+dy-ey);c.lineTo(p.x+dx+ex,y+dy+ey);c.lineTo(p.x-dx+ex,y-dy+ey);c.closePath();}
      c.fillStyle=k;c.fill();}
    zapisz(c);c.globalCompositeOperation="lighter";
    for(const g of GRUPY.values())g.length=0;
    for(const p of cz){if(p.t!==ISK&&p.t!==RAK)continue;const y=p.y-y0;if(y<-2)continue;
      const k=p.t===RAK?BURSZ:p.k;let g=GRUPY.get(k);if(!g){if(GRUPY.size>24)GRUPY.clear();GRUPY.set(k,g=[]);}g.push(p.x,y,Math.max(1,sw.u*.025));}
    for(const [k,g] of GRUPY){if(!g.length)continue;c.beginPath();for(let i=0;i<g.length;i+=3){const r=g[i+2];c.rect(g[i]-r,g[i+1]-r,2*r,2*r);}c.fillStyle=k;c.fill();}
    przywroc(c);
  }

  // =========================================================================================== emisja FX (ponad pasem)
  let OST=null,GORA=-1e9,PASY=[];
  // Tablice robocze punktów dla FX.wstega: silnik kopiuje punkty od razu (wczytajPunkty), więc te same tablice
  // służą każdej wstędze w klatce; bez tego emisja tworzyła kilkaset małych tablic na klatkę (sprzątanie pamięci = skoki).
  const T4=[0,0,0,0],TS=[],TG=[{x:0,y:0,g:0},{x:0,y:0,g:0}];
  function odc(x0,y0,x1,y1){T4[0]=x0;T4[1]=y0;T4[2]=x1;T4[3]=y1;return T4;}
  function ogon(p,od){   // historia położeń cząstki + bieżące położenie
    const hs=p.hs,s0=Math.max(0,hs.length-(od||hs.length));TS.length=0;
    for(let i=s0;i<hs.length;i++)TS.push(hs[i]);TS.push(p.x,p.y);return TS;
  }
  function aT(x,y,a,r){   // czytelność przy linii „teraz”: tam najwyżej 0,25
    if(a<=.25)return a;
    for(let i=0;i<PASY.length;i++){const q=PASY[i];if(x>q.x0-r&&x<q.x1+r&&y>q.y0-r&&y<q.y1+r)return .25;}
    return a;
  }
  function fxStopien(K,st){
    const o=OST;if(!o||o.st!==st||!o.sw||st.spokoj||st.mini)return;
    const F=gFX(st);if(!F)return;
    if(typeof F.klip==="function")F.klip();   // przycięcie zostawione przez inny moduł w tej klatce nie może obcinać widowni
    const {sw,L,Wd}=o;
    GORA=st.gl?-1e9:Wd.y-1.5*Wd.h;PASY=sw.pasy;
    if(K.lasery)fxLasery(F,sw,L,Wd,st);
    fxCzastki(F,sw,Wd,st);
  }
  // Odcinki prostej (t ∈ 0..1) leżące w pasach czytelności wokół linii „teraz” (Liang–Barsky, scalone): tam wiązka
  // dostaje alfę ≤ 0,25, poza nimi może świecić mocniej.
  function przedzialyTeraz(x0,y0,x1,y1){
    const dx=x1-x0,dy=y1-y0,w=[];
    for(const q of PASY){
      let t0=0,t1=1,ok=true;const pp=[-dx,dx,-dy,dy],rr=[x0-q.x0,q.x1-x0,y0-q.y0,q.y1-y0];
      for(let i=0;i<4&&ok;i++){if(pp[i]===0){if(rr[i]<0)ok=false;continue;}const t=rr[i]/pp[i];
        if(pp[i]<0){if(t>t1)ok=false;else if(t>t0)t0=t;}else{if(t<t0)ok=false;else if(t<t1)t1=t;}}
      if(ok&&t1>t0)w.push([t0,t1]);
    }
    w.sort((a,b)=>a[0]-b[0]);
    const m=[];for(const p of w){const o=m[m.length-1];if(o&&p[0]<=o[1])o[1]=Math.max(o[1],p[1]);else m.push(p.slice());}
    return m;
  }
  function wiazka(F,x0,y0,x1,y1,gr,k,a0,a1,blend){
    const P=przedzialyTeraz(x0,y0,x1,y1);
    if(!P.length){F.wstega(odc(x0,y0,x1,y1),gr,k,a0,a1,blend);return;}
    const kawalek=(ta,tb,lim)=>{if(tb-ta<1e-3)return;const aa=a0+(a1-a0)*ta,ab=a0+(a1-a0)*tb;
      F.wstega(odc(x0+(x1-x0)*ta,y0+(y1-y0)*ta,x0+(x1-x0)*tb,y0+(y1-y0)*tb),gr,k,lim?Math.min(aa,.25):aa,lim?Math.min(ab,.25):ab,blend);};
    let t=0;for(const [ta,tb] of P){kawalek(t,ta,false);kawalek(ta,tb,true);t=tb;}kawalek(t,1,false);
  }
  // Wiązki z kratownicy w górę: wachlarz kołysany w rytm (pół taktu w lewo, pół w prawo), przy ogniu otwiera się
  // szerzej i skanuje; blend normal z alfą ≤ 0,25 nad kartami, rdzeń add świeci tylko nad ciemnym.
  function fxLasery(F,sw,L,Wd,st){
    const em=L.emitery,n=em.length;if(!n)return;
    const u=Wd.h,gl=!!st.gl,fin=st.wyniki&&st.ap>.12,ogn=Math.min(1,st.zar/2.5),bl=sw.laserBlysk;
    const rozp=1.05+1.25*Math.max(ogn,fin?st.ap:0)+.4*bl,dl=gl?Math.min(Wd.y-10,u*7.5)*(.75+.25*st.moc):u*1.45;
    const puls=.8+.12*hop(st)+.3*bl,y0=Wd.y+u*.09;
    for(let i=0;i<n;i++){
      const q=n>1?i/(n-1)-.5:0,kat=-PI/2+q*rozp+.2*Math.sin(PI*st.faza*.5+i*.9)+.35*ogn*Math.sin(PI*st.faza*.25);
      const x1=em[i]+Math.cos(kat)*dl,y1=y0+Math.sin(kat)*dl,k=LASERY_PAPIER[i%LASERY.length];
      // stożek światła: wstęga od 1 px przy emiterze do szerokiej plamy na końcu (jak snop reflektora, tylko cieńszy)
      TG[0].x=em[i];TG[0].y=y0;TG[0].g=1;TG[1].x=x1;TG[1].y=y1;TG[1].g=u*(.45+.7*ogn+.4*bl);TS.length=0;TS.push(TG[0],TG[1]);
      F.wstega(TS,u*.5,k,Math.min(.25,.11*puls),0,"normal");
      F.wstega(odc(em[i],y0,x1,y1),u*.09,k,Math.min(.25,.14*puls),0,"normal");
      wiazka(F,em[i],y0,x1,y1,Math.max(1.5,u*.03),k,Math.min(gl?.55:.25,.42*puls*(.7+.3*st.moc)),0,"normal");
      wiazka(F,em[i],y0,x1,y1,1,mieszaj(LASERY[i%LASERY.length],PAPIER,.6),gl?Math.min(.6,.45*puls):.22,0,"add");
      if(gl&&i%2===0)F.blask(em[i]+(x1-em[i])*.3,y0+(y1-y0)*.3,u*.9,u*.45,k,.04,"normal");   // dym laserowy
    }
    // wachlarz przy ogniu i na finale: dwa środkowe emitery rozkładają po pięć cienkich wiązek, które skanują razem
    const wach=Math.max(ogn>.3?ogn:0,fin?st.ap:0,bl*.8);
    if(wach>0)for(const i of [Math.floor(n/3),Math.ceil(2*n/3)-1]){
      const k=LASERY_PAPIER[(i+1)%LASERY.length],baza=-PI/2+.55*Math.sin(PI*st.faza*.25+i);
      for(let j=-2;j<=2;j++){const kat=baza+j*.17*(.6+.4*wach),x1=em[i]+Math.cos(kat)*dl*.92,y1=y0+Math.sin(kat)*dl*.92;
        wiazka(F,em[i],y0,x1,y1,Math.max(1.2,u*.022),k,Math.min(gl?.5:.25,.45*wach),0,"normal");
        if(gl)wiazka(F,em[i],y0,x1,y1,1,mieszaj(LASERY[(i+1)%LASERY.length],PAPIER,.6),.5*wach,0,"add");}
    }
  }
  function fxCzastki(F,sw,Wd,st){
    const cz=sw.cz,u=Wd.h,gr=Wd.y+u*.15,t=sw.t;
    for(const p of cz){   // najpierw dym i błyski wybuchów, pod iskrami (normal rysuje się w kolejności emisji)
      if(p.t===DYM){if(p.y-p.r>gr||p.y<GORA)continue;const f=p.w/p.z,r=p.r*(1+(p.g||.9)*f),a=p.s*Math.sin(PI*Math.min(1,f*1.15));
        F.sprite(p.x,p.y,r,p.k,aT(p.x,p.y,a,r),0,"kolo","normal");}
      else if(p.t===BLS){if(p.y<GORA)continue;const f=p.w/p.z;
        const a=p.s*(1-f);F.blask(p.x,p.y,p.r,p.r,p.k,aT(p.x,p.y,a,p.r),"normal");F.blask(p.x,p.y,p.r*.4,p.r*.4,mieszaj(p.k,PAPIER,.5),Math.min(1,a*1.4),"add");}
    }
    for(const p of cz){
      if(p.y>gr+u*.3||p.y<GORA)continue;
      switch(p.t){
        case ISK:{const f=p.w/p.z,a=(f<.45?1:Math.pow((1-f)/.55,1.3))*(.8+.2*sw.moc)*(f>.7?.7+.3*Math.sin(p.f+t*TAU*4):1);   // pod koniec mrugają (4 Hz)
          if(a<.02)break;const aa=aT(p.x,p.y,a,p.r*2);
          if(p.hs.length>=2)F.wstega(ogon(p,st.gl?0:8),p.r*1.2,p.k,0,aa*.9,"normal");
          F.sprite(p.x,p.y,p.r*1.5,p.k,aa,0,"kolo","normal");
          if(st.gl)F.sprite(p.x,p.y,p.r*1.6,p.k,a*.6,0,"iskra","add");break;}   // add świeci tylko nad ciemnym tłem
        case KONF:{const a=Math.min(1,(p.z-p.w)/.6);F.sprite(p.x,p.y,p.r,Math.cos(p.f)<0?CIEMNE.get(p.k)||p.k:p.k,aT(p.x,p.y,a,p.r),p.a,"pasek","normal");break;}
        case RAK:{if(p.hs.length>=4){const pts=ogon(p);F.wstega(pts,Math.max(1.5,u*.03),BURSZ,0,aT(p.x,p.y,.85,u*.2),"normal");F.wstega(pts,1,ZOLTY,0,.9,"add");}
          F.sprite(p.x,p.y,u*.06,ZOLTY,1,0,"iskra","add");F.sprite(p.x,p.y,u*.03,BURSZ,aT(p.x,p.y,.9,u*.05),0,"kolo","normal");break;}
      }
    }
  }

  // =========================================================================================== rozgrzewka
  // Przed piosenką (pełna grafika): bufory tła, trybun, irokezów tłumu (getImageData) i blasków, żeby nic nie
  // powstawało w klatce pierwszego kombo.
  function rozgrzejStopien(id,K,st,w){
    try{
      const Rg=gR(),Wd=(st&&st.widownia)||(Rg&&Rg.widownia);if(!Wd||!Wd.h||typeof Efekty==="undefined")return;
      const moc=typeof mocStopnia==="function"?mocStopnia(w):w.stopien/DRABINKA.length;
      const ss=Efekty.stan({W:(st&&st.W)||(Rg&&Rg.W)||1280,teraz:0,G:true,fala0:0,wyniki:false,ap:0,faza:0,spiewaja:false,skok:0,zar:0,
        bezRuchu:false,spokoj:false,kolor:st&&st.kolor,akcent:st&&st.akcent,moc,gl:!!(st&&st.gl)},Wd);
      const L=uklad(ss.W,Wd,ss,id,K),akcent=kolorOk(ss.akcent)?ss.akcent:ROZ;
      tloPasa(L,akcent);zarPasa(L);
      for(let k=0;k<5;k++)for(const kol of IROKEZY)zabaIrokez(k,kol);
      for(let par=0;par<2;par++)rzadTylny(L,ss,par);
      if(K.trybuny)for(let j=0;j<2;j++)rzadTrybun(L,j);
      for(const k of [ZOLTY,PAPIER,ROZ,BLEKIT,LIM,BURSZ])blask(k);
    }catch(e){console.warn("RibbitBeat: rozgrzewka widowni",e);}
  }

  // =========================================================================================== drabinka
  // Zestaw cech = sygnatura stopnia. Warunki w kodzie pytają o cechę (K.lasery), nie o numer stopnia, więc żaden
  // stopień nie dziedziczy warstw po niższym. Lasery: siatka laserów i nic więcej; fajerwerki: rakiety i bukiety
  // w kolorach lidera i graczy; stadion: trybuny, flagi graczy, meksykańska fala i race.
  const CECHY={
    lasery:{lasery:true},
    fajerwerki:{rakiety:true},
    stadion:{trybuny:true,flagi:true,fala:true,race:true}};
  function stopien(nr,id,nazwa,cecha,opis){
    const K=CECHY[id],w={stopien:nr,id,nazwa,cecha,prestiz:5,opis,
      rysuj(c,Wd,st){rysujStopien(id,K,c,Wd,st);},
      fx(st){fxStopien(K,st);},
      rozgrzej(st){rozgrzejStopien(id,K,st,w);}};
    return w;
  }
  const NOWE=[
    stopien(8,"lasery","Lasery","siatka laserów",
      "Nad sceną rozpina się siatka laserów kołysana w rytm; co czwarta nuta kombo błyska wiązkami, a próg kombo otwiera je w wachlarz."),
    stopien(9,"fajerwerki","Fajerwerki","rakiety na niebie",
      "Co takt nad sceną wybucha fajerwerk w kolorze lidera, przy pełnym ogniu dwa, próg kombo odpala mały bukiet, a finał cały."),
    stopien(10,"stadion","Stadion","trybuny i fala",
      "Pełne trybuny z flagami graczy, meksykańska fala co dwa takty i na każdym progu kombo, a przy ogniu i na finale płoną race.")];
  // Wskaźniki na style z efekty.js (rysowanie bierze gra z katalogu po id); `cecha` to sygnatura do pokazania w UI.
  const DRABINKA=[
    {stopien:1,id:"zaby",nazwa:"Żaby",cecha:"żaby na liściach"},
    {stopien:2,id:"zapalniczki",nazwa:"Zapalniczki",cecha:"płomyki w ciemnej sali"},
    {stopien:3,id:"transparenty",nazwa:"Transparenty",cecha:"napisy na tabliczkach"},
    {stopien:4,id:"pogo",nazwa:"Pogo",cecha:"tłum skacze"},
    {stopien:5,id:"sprej",nazwa:"Graffiti",cecha:"farba na ścianie"},
    {stopien:6,id:"crowdsurfing",nazwa:"Crowdsurfing",cecha:"żaba płynie po tłumie"},
    {stopien:7,id:"pirotechnika",nazwa:"Pirotechnika",cecha:"słupy ognia"},
    ...NOWE];
  if(typeof Efekty!=="undefined"&&Efekty&&typeof Efekty.zarejestrujWidownie==="function")Efekty.zarejestrujWidownie(NOWE);
  // Układ gry (start piosenki, zmiana okna lub układu torów): bufory i px się zmieniają, więc świat cząstek od nowa.
  function reset(){generacja++;UKLADY.clear();OST=null;PASY_WERSJA=-1;PASY_LISTA=[];PASY_TORY=0;}
  // Podgląd stanu do smoke testów: liczba cząstek wg rodzaju w świecie danego płótna.
  function diagnostyka(c,ile){
    const sw=c?SWIATY.get(c):null;if(!sw)return null;const r={},isk=[];
    const rak=[];for(const p of sw.cz){r[p.t]=(r[p.t]||0)+1;if(p.t===ISK)isk.push([Math.round(p.x),Math.round(p.y),+p.w.toFixed(2)]);if(p.t===RAK)rak.push([Math.round(p.r),+p.z.toFixed(2),sw.tryb2d]);}
    return {czastki:sw.cz.length,rodzaje:r,t:+sw.t.toFixed(2),u:sw.u,iskry:isk.slice(0,ile||12),rakiety:rak};
  }
  return {DRABINKA,reset,diagnostyka};
})();
