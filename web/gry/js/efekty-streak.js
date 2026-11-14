// Streak RibbitBeat: drabinka 11 stopni (od 10-05, tylko wyraźnie różne) efektu kombo (głowa żaby, ślad za żabą, płonące nuty) dla toru „Streak”
// systemu progresji.
// Stopnie 1–13 to wskaźniki na style z efekty.js (Efekty.STREAKI po id), 14–20 są nowe i kumulatywne: każdy ma
// warstwy poprzedniego i dokłada swoją (Plazma → Smok → Fala uderzeniowa → Zorza → Czarna dziura → Supernowa →
// Wielki Wybuch). Klasyczny skrypt ładowany po gl-fx.js i efekty.js, przed zabi-chor.js: globali gry (R, S, bufor,
// blask, blysk, szum1, jezykOgnia, pozycjaZaby, mocStopnia, xBeat, ySemi) używa dopiero w chwili wywołania haka.
//
// Podział pracy w klatce:
//  - glowa/slad/nuty: czyste 2D, jak w efekty.js (gra woła je przy ogniu, miniatura stylu także w lobby). Bez emisji
//    FX, bo miniatura rysuje poza klatką gry i prymitywy trafiłyby na scenę poprzedniej piosenki.
//  - tor(c,L,g,st): co klatkę dla każdej żaby toru, po żabach, w przycięciu do karty: progi kombo, cząstki, emisja
//    FX.* (z WebGL2 pod #scena, czyli pod nutami i żabami = światło zza sceny; w trybie 2D silnika od razu na #scena,
//    więc wtedy połowa alfy i liczby, a to, co leży w pasie ±1,5 wysokości nuty wokół linii „teraz”, pomijamy)
//    oraz fala uderzeniowa, która podrzuca już narysowane taśmy nut (kopia ich prostokątów z płótna sceny; tylko
//    z WebGL2 i przy 1–2 torach). Prymitywy, które mogłyby wyjść poza kartę, są przycinane w JS (GPU nie przycina).
//  - zerwanie(L,g,st): raz, gdy kombo spadło do 0 (gra pamięta poprzednie kombo żaby).
// Chór: pełną głowę, ciało smoka i warstwy na całą kartę ma lider toru, reszta chóru sam rdzeń i wstęgę.
// Tryb lekki (≥ 3 tory): bez drobnych detali, które w tej skali giną (korona, grzywa, paciorki, łuski, połyski nut).
// Fizyka cząstek na stałym kroku 1/120 s z tłumieniem wykładniczym, limit 300 (tryb 2D: 150), cząstki należą do
// toru i giną na brzegu jego karty (nie przechodzą na sąsiednie tory). Migotanie ≤ 8 Hz: kształty losowe
// (zygzaki łuków i włókien) zmieniają się najwyżej 6–7 razy na sekundę i przenikają płynnie, jasność moduluje sinus
// ≤ 4 Hz. Bez filter i shadowBlur; gradienty stałe i sprite’y z bufor(), tryb „lighter” zawsze w save/restore.
const EfektyStreak=(function(){
  "use strict";
  const PI=Math.PI,TAU=2*PI;
  const ROZ="#ec1a83",LIM="#a6d861",ZIEL="#6cb33f",BURSZ="#eaa32b",ZOLTY="#ffd84a",TUSZ="#211f1d",PAPIER="#faf6ee";   // paleta marki
  const BLEK="#5b8cff",FIOL="#8e6fe6",KARM="#b8264a";   // jaśniejszy błękit (#294aa8 ginie na ciemnym szkle), fiolet, karmazyn: te same co w efekty.js
  const KROK=1/120,MAKS_KROKOW=12,LIMIT=300,LIMIT_2D=150,NADSWIETLNY=24;

  // =========================================================================================== drobiazgi
  const los=k=>{const v=Math.sin(k*12.9898+78.233)*43758.5453;return v-Math.floor(v);};   // 0..1, powtarzalne
  const ogr=(v,a,b)=>v<a?a:v>b?b:v;
  const gladko=(a,b,x)=>{const t=ogr((x-a)/(b-a),0,1);return t*t*(3-2*t);};
  const ulamek=x=>x-Math.floor(x);
  const szum=x=>typeof szum1==="function"?szum1(x):.5+.5*Math.sin(x*1.7)*Math.cos(x*.73);
  // Wygładzanie w czasie (nie na klatkę): stała czasowa tau w sekundach.
  const wygl=(v,cel,dt,tau)=>v+(cel-v)*(1-Math.exp(-Math.max(0,dt)/Math.max(1e-3,tau)));
  // Kolor z alfą bez globala gry rgba (moduł działa też w teście Node z atrapą); kanały liczone raz na kolor.
  const KANALY=new Map();
  function kanaly(hex){
    let k=KANALY.get(hex);if(k)return k;
    const m=/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex||"");
    k=m?parseInt(m[1],16)+","+parseInt(m[2],16)+","+parseInt(m[3],16):"255,255,255";KANALY.set(hex,k);return k;
  }
  // Napisy kolorów z alfą żyją w pamięci podręcznej (alfa co 1/200): bez nowego napisu na każde rysowanie w klatce,
  // bo kilkaset takich napisów na klatkę to kilka MB/s śmieci i częstsze sprzątanie pamięci (ścinki).
  const KOL=new Map();
  function kol(hex,a){
    let m=KOL.get(hex);if(!m){m=new Map();KOL.set(hex,m);}
    const k=Math.round(ogr(+a||0,0,1)*200);let s=m.get(k);
    if(s===undefined){s="rgba("+kanaly(hex)+","+(k/200).toFixed(3)+")";m.set(k,s);}
    return s;
  }
  // Gradient poziomy (ślad gaśnie ku przeszłości). Końce śladu są stałe w obrębie układu toru (linia „teraz” i długość
  // śladu z tempa), więc gradienty żyją w pamięci podręcznej do reset() zamiast powstawać kilkadziesiąt razy na klatkę;
  // alfa zaokrąglona do 0,05, żeby płynne wygasanie nie zapychało pamięci.
  // Klucz bez napisów: mapy zagnieżdżone po liczbach (x0, x1, para alf) i po napisie koloru (stałe, bez alokacji).
  const GRAD=new Map();let nGrad=0;
  function gradX(c,x0,x1,kolor,a0,a1){
    const k0=Math.round(x0),k1=Math.round(x1),ka=Math.round(ogr(a0,0,1)*20),kb=Math.round(ogr(a1,0,1)*20);
    let m=GRAD.get(k0);if(!m){if(nGrad>400){GRAD.clear();nGrad=0;}m=new Map();GRAD.set(k0,m);}
    let m2=m.get(k1);if(!m2){m2=new Map();m.set(k1,m2);}
    let m3=m2.get(kolor);if(!m3){m3=new Map();m2.set(kolor,m3);}
    let g=m3.get(ka*32+kb);
    if(!g){g=c.createLinearGradient(k0,0,k1,0);g.addColorStop(0,kol(kolor,ka/20));g.addColorStop(1,kol(kolor,kb/20));m3.set(ka*32+kb,g);nGrad++;}
    return g;
  }
  // Moc własnego stopnia (nie st.moc, to moc tła): ?moc= albo stopień/20; w teście bez gry stopień/20.
  const mocW=W=>typeof mocStopnia==="function"?mocStopnia(W):ogr(W.stopien/20,0,1);
  // Wysokość taśmy nuty dokładnie jak w rysujTor (pas czytelności wokół linii „teraz” = ±1,5 tej wysokości).
  const wysNuty=L=>Math.max(8,Math.min(30,Math.max(L.rh*.6,Math.min(L.rh*1.15,14))));
  const coKombo=()=>typeof ZC_PUNKTY!=="undefined"&&ZC_PUNKTY.KOMBO_CO>0?ZC_PUNKTY.KOMBO_CO:4;
  const stKlatki=()=>typeof R!=="undefined"&&R&&R.st?R.st:null;
  // Tryb lekki: trzy i więcej torów (małe żaby, a rysowania 2D cztery razy więcej). Zintegrowane GPU płaci za każdą
  // operację płótna, więc wtedy odpadają detale niewidoczne w tej skali (korona, paciorki, pasy łusek, połyski nut).
  const lekki=()=>typeof R!=="undefined"&&!!R&&Array.isArray(R.tory)&&R.tory.length>=3;
  // Faza ćwierćnuty do pulsu w 2D: z klatki gry, a bez niej (miniatura) z czasu.
  const fazaBeatu=ts=>{const s=stKlatki();return s&&Number.isFinite(s.faza)?s.faza:ulamek(ts*2);};
  // Zygzak przenikany: dwa kolejne ziarna z częstotliwością f (≤ 7 Hz) i waga drugiego; kształt płynie, nie miga.
  // Wynik w PT0 (ziarno) i PFR (waga), bez tablicy na każde wywołanie.
  let PT0=0,PFR=0;
  function przenik(ts,f){const t=ts*f;PT0=Math.floor(t);PFR=t-PT0;}
  const zyg=(t0,fr,k)=>los(t0*7.13+k)*(1-fr)+los((t0+1)*7.13+k)*fr-.5;

  // =========================================================================================== stan modułu
  // Cząstki: jedna lista na moduł (limit wspólny), każda należy do toru (t) i jego karty (kx..ky), rysuje się tylko
  // w haku swojego toru. Stan żaby: progi, zdarzenia i pozycja z ostatniej klatki (głowa i ślad szukają go po
  // pozycji albo kluczu, bo gra nie podaje im gracza).
  // Pula cząstek: obiekty wielokrotnego użytku, żywe w CZ[0..nCz); martwe zostają na końcu i wracają do obiegu, więc
  // wybuch supernowej (160 odłamków) nie tworzy obiektów w klatce progu.
  const CZ=[];let nCz=0,zapas=0,ostKlatka=-1,ostNowa=-1e9;
  let graczeSt=new Map(),poKluczu=new Map(),toryS=new WeakMap();
  function reset(){nCz=0;zapas=0;ostKlatka=-1;ostNowa=-1e9;graczeSt=new Map();poKluczu=new Map();toryS=new WeakMap();GRAD.clear();nGrad=0;SPR.clear();GRAD_N.clear();}
  function stanGracza(g){
    let s=graczeSt.get(g.id);
    if(!s){s={kombo:g.kombo|0,prog:-1e9,duzy:-1e9,ryk:-1e9,nowa:-1e9,zapad:-1e9,impl:-1e9,ciszaDo:-1e9,
      zx:0,zy:0,wyg:1,warp:0,iskr:0,fx:0,fy:0,sc:30,teraz:0,zyje:0};graczeSt.set(g.id,s);}
    return s;
  }
  function stanToru(L){let t=toryS.get(L.tor);if(!t){t={fale:[]};toryS.set(L.tor,t);}return t;}
  // Klucz liczbowy (kolor gracza → mały indeks), bez sklejania napisów co klatkę.
  const IDX_KOL=new Map();
  function kluczSladu(kolor,ziarno,xT){
    let i=IDX_KOL.get(kolor);if(i===undefined){i=IDX_KOL.size;IDX_KOL.set(kolor,i);}
    return (i*8192+Math.round(xT))*256+((ziarno|0)&255);
  }
  // Głowa nie zna gracza: szukamy żaby po pozycji środka (transformacja kontekstu), stan z poprzedniej klatki.
  function stanGlowy(c,sc){
    if(!c||typeof c.getTransform!=="function"||!graczeSt.size)return null;
    const m=c.getTransform();if(!m||!Number.isFinite(m.e))return null;
    // glowaZaGlowa (zabi-chor.js) przesuwa początek układu o DY·sc w dół i skaluje o SK: środek żaby leży w punkcie
    // (0, −DY·sc/SK) układu głowy, więc tam liczymy pozycję do porównania ze stanem żaby
    const zg=typeof ZC_GLOWA_ZA!=="undefined"&&ZC_GLOWA_ZA&&ZC_GLOWA_ZA.SK>0?ZC_GLOWA_ZA:null,oy=zg?-zg.DY*sc/zg.SK:0;
    const d=(typeof R!=="undefined"&&R&&R.dpr)||1,x=(m.e+m.c*oy)/d,y=(m.f+m.d*oy)/d,teraz=(stKlatki()||{}).teraz;
    let naj=null,dn=Math.max(8,sc*.6);
    for(const s of graczeSt.values()){if(s.teraz!==teraz&&teraz!=null&&Math.abs(s.teraz-teraz)>250)continue;
      const dd=Math.hypot(s.fx-x,s.fy-y);if(dd<dn){dn=dd;naj=s;}}
    return naj;
  }

  // ---- cząstki ----
  // Nowa cząstka z puli (null przy limicie): pola wspólne ustawia wołający przez czastka(), reszta ma wartości zerowe.
  function czastka(L,gl,x,y,vx,vy,ay,op,zycie,r,kolor,ks,blend,a0,typ){
    if(nCz>=(gl?LIMIT:LIMIT_2D))return null;
    let p=CZ[nCz];if(!p)p=CZ[nCz]={};
    nCz++;
    p.x=x;p.y=y;p.vx=vx;p.vy=vy;p.ax=0;p.ay=ay;p.op=op;p.tl=Math.exp(-op*KROK);p.wiek=0;p.zycie=zycie;p.r=r;p.kol=kolor;
    p.ks=ks;p.blend=blend;p.a0=a0;p.typ=typ;p.yc=null;p.spr=0;p.cx=null;p.cy=0;p.przyc=0;
    p.kx0=L.x;p.kx1=L.x+L.w;p.ky0=L.y;p.ky1=L.y+L.h;p.t=L.tor;
    return p;
  }
  function krokCzastek(dt){
    zapas=Math.min(zapas+Math.max(0,Math.min(.1,dt||0)),MAKS_KROKOW*KROK);
    let n=0;while(zapas>=KROK){zapas-=KROK;n++;}
    if(!n||!nCz)return;
    const h=KROK;
    for(let j=0;j<nCz;j++){const p=CZ[j];for(let i=0;i<n&&p.wiek<p.zycie;i++){
      let ax=p.ax||0,ay=p.ay||0;
      if(p.yc!=null)ay+=p.spr*(p.yc-p.y);                      // sprężyna ku linii toru (odłamki supernowej)
      if(p.cx!=null){const dx=p.cx-p.x,dy=p.cy-p.y,dd=Math.hypot(dx,dy)+1;   // przyciąganie do punktu (implozja)
        if(dd<5){p.wiek=p.zycie;break;}ax+=p.przyc*dx/dd;ay+=p.przyc*dy/dd;}
      p.vx=(p.vx+ax*h)*p.tl;p.vy=(p.vy+ay*h)*p.tl;p.x+=p.vx*h;p.y+=p.vy*h;p.wiek+=h;
      if(p.x<p.kx0||p.x>p.kx1||p.y<p.ky0||p.y>p.ky1)p.wiek=p.zycie;   // brzeg karty: cząstka ginie, nie wjeżdża na sąsiada
    }}
    // zbijanie w miejscu: żywe na początek, martwe (obiekty) na koniec puli
    let j=0;for(let i=0;i<nCz;i++){const p=CZ[i];if(p.wiek<p.zycie){if(i!==j){CZ[i]=CZ[j];CZ[j]=p;}j++;}}
    nCz=j;
  }
  // Sprite’y modułu z bufor() pod kluczem liczbowym (napis klucza bufor() powstaje tylko przy pierwszym rysowaniu);
  // gra czyści bufory przy układzie (R.wersja), wtedy i ta pamięć.
  const SPR=new Map();let sprWersja=-1;
  function spr(id,zrob){
    const w=typeof R!=="undefined"&&R?R.wersja:0;if(w!==sprWersja){SPR.clear();sprWersja=w;}
    let b=SPR.get(id);if(!b){b=zrob();SPR.set(id,b);}
    return b;
  }

  // ---- silnik efektów (gl-fx.js); brak = same 2D ----
  const fxJest=()=>typeof FX!=="undefined"&&!!FX&&typeof FX.sprite==="function";
  // Pas czytelności wokół linii „teraz” (tryb 2D silnika: prymityw nad nutami): połowa szerokości w px.
  const pasTeraz=L=>1.5*wysNuty(L)+2;

  // ---- ślad żaby w px ekranu (bufor wielokrotnego użytku, liczony raz na żabę i klatkę w haku tor) ----
  const PKT=[];let nPkt=0;
  function sladEkranu(L,g){
    nPkt=0;const sl=g.slad;if(!sl||sl.length<2||typeof xBeat!=="function")return 0;
    for(let i=0;i<sl.length;i++){const p=sl[i];let q=PKT[nPkt];if(!q)q=PKT[nPkt]={x:0,y:0,sp:false};
      q.x=xBeat(L,p.b);q.y=ySemi(L,p.s);q.sp=!!p.sp;nPkt++;}
    return nPkt;
  }
  // y śladu w punkcie x (punkty rosną w x); -1, gdy żaba tam nie śpiewała.
  function ySladu(pts,n,x){
    let lo=0,hi=n-1;if(n<2||x<pts[0].x||x>pts[hi].x)return null;
    while(hi-lo>1){const m=(lo+hi)>>1;if(pts[m].x<=x)lo=m;else hi=m;}
    const a=pts[lo],b=pts[hi];if(!a.sp||!b.sp)return null;
    const t=b.x>a.x?(x-a.x)/(b.x-a.x):0;return a.y+(b.y-a.y)*t;
  }

  // =========================================================================================== bufory (raz na układ)
  // Szkło kuli plazmy: ciemne, z granatowym wnętrzem; ciemne tło daje kontrast włóknom i żabie na jasnej karcie.
  function kulaSzkla(){
    return bufor("es-kula",128,128,c=>{
      const g=c.createRadialGradient(54,50,4,64,64,64);
      g.addColorStop(0,"rgba(91,140,255,.62)");g.addColorStop(.5,"rgba(52,44,110,.7)");
      g.addColorStop(.9,"rgba(33,31,29,.86)");g.addColorStop(1,"rgba(33,31,29,0)");
      c.fillStyle=g;c.fillRect(0,0,128,128);
    });
  }
  // Promień zorzy: jasna limonka u podstawy, zieleń, róż i fiolet ku górze, miękkie boki (24 × 96).
  function promienZorzy(){
    return bufor("es-promien",24,96,c=>{
      const g=c.createLinearGradient(0,96,0,0);
      g.addColorStop(0,kol(LIM,.95));g.addColorStop(.25,kol(ZIEL,.8));g.addColorStop(.6,kol(ROZ,.5));g.addColorStop(1,kol(FIOL,0));
      c.fillStyle=g;c.fillRect(0,0,24,96);
      c.globalCompositeOperation="destination-in";
      const b=c.createLinearGradient(0,0,24,0);b.addColorStop(0,"rgba(0,0,0,0)");b.addColorStop(.5,"rgba(0,0,0,1)");b.addColorStop(1,"rgba(0,0,0,0)");
      c.fillStyle=b;c.fillRect(0,0,24,96);
    });
  }
  // Tarcza słońca: biały środek, żółć, bursztynowy brzeg (128 × 128).
  function tarczaSlonca(){
    return bufor("es-slonce",128,128,c=>{
      const g=c.createRadialGradient(56,54,2,64,64,64);
      g.addColorStop(0,"rgba(255,255,246,1)");g.addColorStop(.45,"rgba(255,236,150,1)");g.addColorStop(.85,kol(ZOLTY,1));g.addColorStop(1,kol(BURSZ,1));
      c.fillStyle=g;c.beginPath();c.arc(64,64,64,0,TAU);c.fill();
    });
  }
  // Paleta ognia smoka (języki gry, rąbek spalenizny, smuga, ciemny dym): bursztyn, żółć, karmazyn.
  const PAL_SMOK={id:"es-smok",baza:["rgba(255,240,170,.95)","rgba(255,200,70,.9)","rgba(234,120,40,.72)","rgba(184,38,74,.32)","rgba(184,38,74,0)"],
    rdzen:["rgba(255,255,235,.95)","rgba(255,226,120,.6)","rgba(255,200,90,0)"],blask:[ZOLTY,BURSZ],
    rabek:["234,120,40","255,236,160"],smuga:["184,38,74","234,163,43","255,216,74"],dym:"#3a2a2a"};
  const jezyk=k=>typeof jezykOgnia==="function"?spr(6e6+(((k%6)+6)%6),()=>jezykOgnia(((k%6)+6)%6,PAL_SMOK)):null;
  // Język ognia: podstawa w (x,y), czubek w kierunku kąta a (0 = w górę), wysokość hh.
  function plomien(c,img,x,y,hh,a){
    if(!img)return;const ww=Math.max(4,hh*.42);
    c.save();c.translate(x,y);c.rotate(a);c.drawImage(img.cv,-ww/2,-hh*.95,ww,hh);c.restore();
  }
  // Czas „w rytm”: płynie jak zegar, a na każdą ćwierćnutę dostaje krótkie pchnięcie (obroty dysku i strug).
  function czasRytmu(ts){
    const s=stKlatki();if(!s||!Number.isFinite(s.beat))return ts;
    const f=s.faza,e=1-(1-f)*(1-f)*(1-f);return ts+.09*(Math.floor(s.beat)+e);
  }

  // =========================================================================================== głowa (2D)
  // Układ: środek żaby (0,0) z obrotem jej kołysania, u = sc = rozmiar naklejki żaby. Tylny rząd (przod=false) leży
  // pod obrazkiem żaby, przedni nad nim i rysuje tylko to, co nie zasłania pyska: obręcz szkła, łuk dysku pod
  // brodą, gwiazdkę i pętle protuberancji poza tarczą.
  const KATY=new Float64Array(12);
  function wlokna(c,cy,R,n,ts,z,alfa){
    przenik(ts,6);const t0=PT0,fr=PFR;
    for(let j=0;j<n;j++)KATY[j]=(j+.5)/n*TAU+(szum(ts*.35+j*3.7+z)-.5)*2.2;
    for(let gr=0;gr<2;gr++){
      c.beginPath();
      for(let j=gr;j<n;j+=2){
        const a=KATY[j],ex=Math.cos(a)*R,ey=cy+Math.sin(a)*R,nx=-Math.sin(a),ny=Math.cos(a);
        c.moveTo(0,cy);
        for(let s=1;s<5;s++){const t=s/5,o=zyg(t0,fr,j*13+s+z)*R*.36*Math.sin(PI*t);c.lineTo(ex*t+nx*o,cy+(ey-cy)*t+ny*o);}
        c.lineTo(ex,ey);
      }
      c.globalAlpha=.42*alfa;c.strokeStyle=gr?BLEK:ROZ;c.lineWidth=Math.max(1.6,R*.13);c.stroke();
      c.globalAlpha=alfa;c.strokeStyle=gr?"#dfe8ff":"#ffd6ee";c.lineWidth=Math.max(.7,R*.045);c.stroke();
    }
    c.beginPath();   // plamki styku włókien ze szkłem: jedna ścieżka kół
    for(let j=0;j<n;j++){const a=KATY[j],r=R*.075*(.7+.3*szum(ts*3+j*1.3)),x=Math.cos(a)*R,y=cy+Math.sin(a)*R;c.moveTo(x+r,y);c.arc(x,y,r,0,TAU);}
    c.globalAlpha=.9*alfa;c.fillStyle="#fff6fb";c.fill();
    c.globalAlpha=1;
  }
  function kulaPlazmy(c,R,cy,og,ts,z,alfa){
    const k=kulaSzkla();c.globalAlpha=alfa;c.drawImage(k.cv,-R,cy-R,2*R,2*R);c.globalAlpha=1;
    c.save();c.globalCompositeOperation="lighter";c.lineJoin="round";c.lineCap="round";
    wlokna(c,cy,R*.95,og>=3?7:5,ts,z,alfa);c.restore();
  }
  function obreczSzkla(c,R,cy,alfa){
    c.lineCap="round";
    c.lineWidth=Math.max(1,R*.05);c.strokeStyle=kol(PAPIER,.6*alfa);c.beginPath();c.arc(0,cy,R,0,TAU);c.stroke();
    c.lineWidth=Math.max(1.2,R*.09);c.strokeStyle=kol("#ffffff",.85*alfa);c.beginPath();c.arc(0,cy,R*.88,-PI*.9,-PI*.64);c.stroke();
  }
  // Czarna dziura: horyzont, pierścień fotonowy o odwróconych barwach (biały rdzeń, fiolet, róż), soczewkowany łuk
  // dalekiej strony dysku nad horyzontem: część stała jako sprite z bufora w dwóch wariantach (chłodny i gorący
  // pierścień przed wybuchem supernowej, przenikane wagą zar), na żywo tylko trzy strugi materii spadające po spirali.
  // Na tym GPU każda operacja ścieżki głowy kosztuje kilkadziesiąt µs rastra na żabę, więc stałe warstwy idą sprite’ami.
  function sprDziury(R,goraca){
    const q=Math.max(6,Math.round(R/3)*3),m=q*1.62;
    return spr(1e6+q*2+(goraca?1:0),()=>bufor("es-dziura|"+q+"|"+(goraca?1:0),2*m,2*m,c=>{
      c.translate(m,m);
      c.fillStyle="rgba(14,11,20,.96)";c.beginPath();c.arc(0,0,q,0,TAU);c.fill();
      c.lineWidth=q*.34;c.strokeStyle=kol(ROZ,.34);c.beginPath();c.arc(0,0,q*1.2,0,TAU);c.stroke();
      c.lineWidth=q*.16;c.strokeStyle=kol(goraca?ZOLTY:FIOL,goraca?.95:.7);c.beginPath();c.arc(0,0,q*1.07,0,TAU);c.stroke();
      c.lineWidth=Math.max(1.2,q*.065);c.strokeStyle=kol("#ffffff",.95);c.beginPath();c.arc(0,0,q,0,TAU);c.stroke();
      c.lineCap="round";c.beginPath();c.arc(0,0,q*1.34,-PI*.94,-PI*.06);
      c.lineWidth=q*.13;c.strokeStyle=kol(ROZ,.62);c.stroke();
      c.lineWidth=Math.max(.8,q*.045);c.strokeStyle=kol("#fff0fa",.9);c.stroke();
    }));
  }
  function dziura(c,R,cy,ts,alfa,zar){
    const q=Math.max(6,Math.round(R/3)*3),m=q*1.62,k=R/q,ch=sprDziury(R,false);
    c.save();c.translate(0,cy);c.scale(k,k);
    c.globalAlpha=alfa;c.drawImage(ch.cv,-m,-m,2*m,2*m);
    if(zar>.02){const go=sprDziury(R,true);c.globalAlpha=alfa*Math.min(1,zar);c.drawImage(go.cv,-m,-m,2*m,2*m);}
    c.restore();c.globalAlpha=1;
    const T=czasRytmu(ts);c.beginPath();
    for(let j=0;j<3;j++){const a0=j*TAU/3+T*1.3;
      for(let s=0;s<=8;s++){const t=s/8,a=a0+t*PI*1.1,r=R*(1.62-.6*t),x=Math.cos(a)*r,y=cy+Math.sin(a)*r*.62;
        if(s)c.lineTo(x,y);else c.moveTo(x,y);}}
    c.lineCap="round";c.lineJoin="round";c.lineWidth=Math.max(1.4,R*.09);c.strokeStyle=kol(ROZ,.6*alfa);c.stroke();
  }
  // Dysk akrecyjny (elipsa przechylona): tylna połowa za żabą, przednia pod brodą. Pierścień (różowa poświata,
  // fioletowe ciało, biała krawędź wewnętrzna) jest sprite’em z bufora na połowę i wariant barw; obrót w rytm
  // pokazują trzy jasne grudki materii biegnące po elipsie (jedna ścieżka na połowę). Skala osi y robi z okręgu
  // elipsę, więc pas jest gruby po bokach i cienki z przodu i z tyłu, jak płaski pierścień oglądany pod kątem.
  const DYSK_SK=.23,DYSK_RX=1.45;
  function sprDysku(u,zloty,przod){
    const q=Math.max(8,Math.round(u/4)*4),rx=q*DYSK_RX,mx=rx+q*.26,my=rx*DYSK_SK+q*.12,h=przod?my+q*.06:my+q*.06;
    return spr(2e6+q*4+(zloty?2:0)+(przod?1:0),()=>bufor("es-dysk|"+q+"|"+(zloty?1:0)+"|"+(przod?1:0),2*mx,h,c=>{
      c.translate(mx,przod?q*.06:my);c.scale(1,DYSK_SK);c.lineCap="butt";
      const a0=przod?0:PI,a1=przod?PI:TAU;
      c.lineWidth=q*.42;c.strokeStyle=kol(zloty?BURSZ:ROZ,.3);c.beginPath();c.arc(0,0,rx,a0,a1);c.stroke();
      c.lineWidth=q*.2;c.strokeStyle=kol(zloty?ZOLTY:FIOL,.72);c.beginPath();c.arc(0,0,rx,a0,a1);c.stroke();
      c.lineWidth=q*.05;c.strokeStyle=kol("#ffffff",.9);c.beginPath();c.arc(0,0,rx*.97,a0,a1);c.stroke();
    }));
  }
  function dysk(c,u,cy,ts,przod,alfa,zloty){
    const q=Math.max(8,Math.round(u/4)*4),rx=q*DYSK_RX,mx=rx+q*.26,my=rx*DYSK_SK+q*.12,k=u/q,b=sprDysku(u,zloty,przod),T=czasRytmu(ts);
    c.save();c.translate(0,cy+u*.05);c.rotate(-.2);c.scale(k,k);c.globalAlpha=alfa;
    c.drawImage(b.cv,-mx,przod?-q*.06:-my,b.w,b.h);
    // grudki materii: kąt maleje z czasem rytmu (jak dawny gradient stożkowy), każda na swojej połowie elipsy
    c.beginPath();
    for(let i=0;i<3;i++){const a=-T*1.5+i*TAU/3,s=Math.sin(a);if(przod!==(s>0))continue;
      const x=Math.cos(a)*rx,y=s*rx*DYSK_SK;c.moveTo(x+q*.13,y);c.ellipse(x,y,q*.13,q*.045,0,0,TAU);}
    c.fillStyle=zloty?"#fffbe6":"#ffffff";c.globalAlpha=.9*alfa;c.fill();
    c.restore();
  }
  // Słońce: korona z protuberancjami (obrys tarczy wypchnięty szumem 1D po kącie, ciągły na styku 0/2π) w sześciu
  // klatkach z bufora, przenikanych płynnie (korona „wrze” w ok. 2 s na klatkę), na wierzchu tarcza z brzegiem.
  const SLONCE_KLATKI=6;
  function sprKorony(R,i){
    const q=Math.max(6,Math.round(R/3)*3),m=q*1.9;
    return spr(3e6+q*8+i,()=>bufor("es-korona|"+q+"|"+i,2*m,2*m,c=>{
      c.translate(m,m);
      const n=44,p=x=>Math.pow(szum(x*1.7+i*1.37+.3),3)*.62+.2*szum(x*5.3+i*2.9);
      c.beginPath();
      for(let j=0;j<=n;j++){const a=j/n*TAU,k=a/TAU,r=q*(1.14+p(a)*(1-k)+p(a-TAU)*k);
        if(j)c.lineTo(Math.cos(a)*r,Math.sin(a)*r);else c.moveTo(r,0);}
      c.closePath();
      const g=c.createRadialGradient(0,0,q*.8,0,0,q*1.8);
      g.addColorStop(0,kol(ZOLTY,.95));g.addColorStop(.45,kol(BURSZ,.78));g.addColorStop(1,kol(ROZ,0));
      c.fillStyle=g;c.fill();
    }));
  }
  function sprTarczy(R){
    const q=Math.max(6,Math.round(R/3)*3);
    return spr(4e6+q,()=>bufor("es-tarcza|"+q,2*q+4,2*q+4,c=>{
      c.translate(q+2,q+2);c.drawImage(tarczaSlonca().cv,-q,-q,2*q,2*q);
      c.lineWidth=Math.max(1,q*.05);c.strokeStyle=kol(BURSZ,.9);c.beginPath();c.arc(0,0,q,0,TAU);c.stroke();
    }));
  }
  function slonce(c,R,cy,ts,z,alfa){
    const q=Math.max(6,Math.round(R/3)*3),m=q*1.9,k=R/q,f=ts*.5+z*.13,i0=Math.floor(f),fr=f-i0;
    const a=((i0%SLONCE_KLATKI)+SLONCE_KLATKI)%SLONCE_KLATKI,b=(a+1)%SLONCE_KLATKI,t=sprTarczy(R);
    c.save();c.translate(0,cy);c.scale(k,k);
    c.globalAlpha=alfa*(1-fr);c.drawImage(sprKorony(R,a).cv,-m,-m,2*m,2*m);
    c.globalAlpha=alfa*fr;c.drawImage(sprKorony(R,b).cv,-m,-m,2*m,2*m);
    c.globalAlpha=alfa;c.drawImage(t.cv,-q-2,-q-2,t.w,t.h);
    c.restore();c.globalAlpha=1;
  }
  // Gwiazda przed wybuchem (supernowa bez czarnej dziury pod spodem): tarcza z bufora i błękitna obręcz pulsująca
  // w rytm; po wybuchu obręcz rośnie i blednie.
  function gwiazdaNowa(c,R,cy,ts,alfa,nowa){
    const t=sprTarczy(R),q=Math.max(6,Math.round(R/3)*3),k=R/q,pu=1-fazaBeatu(ts);
    c.save();c.translate(0,cy);c.scale(k,k);c.globalAlpha=alfa;c.drawImage(t.cv,-q-2,-q-2,t.w,t.h);c.restore();c.globalAlpha=1;
    c.lineWidth=Math.max(1.2,R*.12);c.strokeStyle=kol(BLEK,(.55+.35*pu*pu)*alfa*(1-.5*nowa));
    c.beginPath();c.arc(0,cy,R*(1.14+.1*pu*pu+.7*nowa),0,TAU);c.stroke();
  }
  // Pętle protuberancji: trzy łuki z brzegu tarczy na zewnątrz, wszystkie jedną ścieżką (poświata róż, rdzeń żółć).
  function petleProtuberancji(c,R,cy,ts,z,alfa){
    c.lineCap="round";c.beginPath();
    for(let j=0;j<3;j++){
      const a=-PI*.75+j*.75+(szum(ts*.15+j*5+z)-.5)*.6,roz=.3,h=R*(.3+.45*szum(ts*.5+j*3.1+z));
      c.moveTo(Math.cos(a-roz)*R,cy+Math.sin(a-roz)*R);
      c.quadraticCurveTo(Math.cos(a)*(R+h*1.7),cy+Math.sin(a)*(R+h*1.7),Math.cos(a+roz)*R,cy+Math.sin(a+roz)*R);
    }
    c.globalAlpha=.6*alfa;c.strokeStyle=ROZ;c.lineWidth=Math.max(1.6,R*.13);c.stroke();
    c.globalAlpha=.95*alfa;c.strokeStyle=ZOLTY;c.lineWidth=Math.max(.8,R*.05);c.stroke();
    c.globalAlpha=1;
  }
  // Korona polarna: promienie zorzy wyrastają z łuku nad głową w dwóch skrzydłach (lewym i prawym), środek nad
  // głową zostaje wolny, bo tam przechodzą taśmy nut przy linii „teraz”. Długość płynie szumem, kołysanie powolne.
  function korona(c,u,cy,og,ts,z,alfa){
    const pr=promienZorzy(),n=og>=3?2:1,w=Math.max(5,u*.28);
    for(let s=0;s<2;s++)for(let j=0;j<n;j++){
      const t=(j+.5)/n,a=s?-PI*.36+t*PI*.3:-PI*.94+t*PI*.3,dl=u*(.6+.55*szum(ts*.7+j*1.9+s*7+z))*(og>=3?1.15:1),r0=u*.98;
      c.save();c.translate(Math.cos(a)*r0,cy+Math.sin(a)*r0);c.rotate(a+PI/2+Math.sin(ts*.9+j*1.3+s)*.08);
      c.globalAlpha=alfa*(.6+.4*szum(ts*1.3+j*2.1+s*3));c.drawImage(pr.cv,-w/2,-dl,w,dl);c.restore();
    }
    c.globalAlpha=1;
  }
  // Pierścień odłamków (19+): drobiny po przechylonej orbicie wokół głowy, tył za żabą, przód przed nią; każda
  // z krótką smugą ruchu. Gwiazda przed wybuchem gubi materię.
  function odlamkiOrbity(c,u,cy,ts,przod,alfa){
    const n=12,rx=u*1.22,ry=u*.42,cs=Math.cos(-.35),sn=Math.sin(-.35),K=[BURSZ,BLEK];
    c.lineCap="round";c.lineWidth=Math.max(1.4,u*.05);c.globalAlpha=alfa*(przod?1:.7);
    for(let k=0;k<2;k++){c.beginPath();
      for(let j=k;j<n;j+=2){
        const a=j/n*TAU+ts*(.55+.12*los(j))+los(j*3.3)*.4,z=Math.sin(a);if(przod!==(z>0))continue;
        const ex=Math.cos(a)*rx,ey=z*ry,a2=a-.22,ex2=Math.cos(a2)*rx,ey2=Math.sin(a2)*ry;
        c.moveTo(ex2*cs-ey2*sn,cy+ex2*sn+ey2*cs);c.lineTo(ex*cs-ey*sn,cy+ex*sn+ey*cs);}
      c.strokeStyle=K[k];c.stroke();}
    c.globalAlpha=1;
  }


  // Paszcza smoka wokół głowy żaby: żaba śpiewa z otwartego pyska smoka (gardło i szczęki leżą POD obrazkiem żaby,
  // więc pysk żaby zostaje czytelny). Szczęki obracają się wokół zawiasu za głową: ćwierćnuta uchyla je lekko, ryk
  // na progu kombo otwiera szeroko. Kontur tuszem, jak naklejki gry. Współrzędne kształtów w jednostkach u.
  const GRZYWA=[[-.98,-.42,-1.2],[-.9,-.68,-1],[-.72,-.9,-.7],[-1.02,-.18,-1.45]];
  const ZEBY_G=[[.62,-.42],[.44,-.45],[.26,-.49],[.07,-.52],[-.13,-.5]],ZEBY_D=[[.55,.44],[.34,.48],[.13,.5],[-.08,.47]];
  function gardlo(c,u,otw){
    c.fillStyle="rgba(42,13,26,.92)";c.beginPath();c.ellipse(.06*u,-.02*u,.8*u,.5*u*(1+.35*otw),0,0,TAU);c.fill();
  }
  // Szczęki jako sprite’y z bufora (rysowane raz na rozmiar i wariant barw, potem jedno drawImage z obrotem wokół
  // zawiasu): kilkadziesiąt operacji ścieżek na żabę i klatkę zjadało czas JS. Ruch zostaje: obrót szczęk w rytm
  // i ryk, płomienie grzywy i wąs liczone co klatkę. Pudełko sprite’a w jednostkach u: górna szczęka x −1.6…1.05,
  // y −1.25…−.05 (rogi, czaszka, zęby), dolna x −.75….9, y −.05….78.
  const SZG={x0:-1.6,y0:-1.25,w:2.65,h:1.2},SZD={x0:-.75,y0:-.05,w:1.65,h:.83};
  function sprSzczeki(u,zloty,gorna){
    const q=Math.max(8,Math.round(u/4)*4),B=gorna?SZG:SZD;
    return spr(5e6+q*4+(gorna?2:0)+(zloty?1:0),()=>bufor("es-szcz|"+(gorna?"g":"d")+"|"+q+"|"+(zloty?1:0),B.w*q,B.h*q,c=>{
      const L=1/q,skora=zloty?"#c9861a":KARM,jasna=zloty?ZOLTY:ROZ,spod=zloty?"#fff2b0":BURSZ;
      c.scale(q,q);c.translate(-B.x0,-B.y0);c.lineJoin="round";c.lineCap="round";
      if(!gorna){
        c.beginPath();c.moveTo(-.66,.02);c.quadraticCurveTo(-.66,.52,-.3,.6);c.quadraticCurveTo(.25,.72,.66,.5);
        c.quadraticCurveTo(.8,.46,.74,.38);c.quadraticCurveTo(.45,.4,.1,.5);c.quadraticCurveTo(-.18,.5,-.42,.3);
        c.quadraticCurveTo(-.6,.18,-.66,.02);c.closePath();
        c.fillStyle=spod;c.fill();c.lineWidth=1.5*L;c.strokeStyle=TUSZ;c.stroke();
        c.beginPath();for(const [x,y] of ZEBY_D){c.moveTo(x-.045,y+.02);c.lineTo(x,y-.1);c.lineTo(x+.045,y+.02);c.closePath();}
        c.fillStyle=PAPIER;c.fill();c.lineWidth=L;c.stroke();
        return;
      }
      c.beginPath();c.moveTo(-.62,-.9);c.quadraticCurveTo(-.95,-1.14,-1.3,-1.02);c.moveTo(-.82,-.78);c.quadraticCurveTo(-1.08,-.92,-1.36,-.8);
      c.lineWidth=Math.max(3,q*.12)*L;c.strokeStyle=TUSZ;c.stroke();c.lineWidth=Math.max(1.6,q*.075)*L;c.strokeStyle="#efe6d2";c.stroke();
      c.beginPath();c.moveTo(-1,-.28);c.quadraticCurveTo(-1.05,-.8,-.62,-.98);c.quadraticCurveTo(-.4,-1.04,-.2,-.86);
      c.quadraticCurveTo(.12,-.86,.42,-.72);c.quadraticCurveTo(.7,-.7,.86,-.56);c.quadraticCurveTo(.95,-.46,.8,-.4);
      c.quadraticCurveTo(.5,-.4,.2,-.5);c.quadraticCurveTo(-.1,-.56,-.4,-.44);c.quadraticCurveTo(-.62,-.36,-.66,-.1);
      c.quadraticCurveTo(-.86,-.1,-1,-.28);c.closePath();
      c.fillStyle=skora;c.fill();c.lineWidth=1.6*L;c.strokeStyle=TUSZ;c.stroke();
      c.beginPath();c.moveTo(-.5,-.9);c.quadraticCurveTo(.12,-.8,.7,-.62);c.lineWidth=Math.max(1.2,q*.05)*L;c.strokeStyle=kol(jasna,.85);c.stroke();
      c.beginPath();for(const [x,y] of ZEBY_G){c.moveTo(x-.045,y-.02);c.lineTo(x,y+.11);c.lineTo(x+.045,y-.02);c.closePath();}
      c.fillStyle=PAPIER;c.fill();c.lineWidth=L;c.strokeStyle=TUSZ;c.stroke();
      c.beginPath();c.ellipse(-.36,-.7,.1,.07,-.15,0,TAU);c.fillStyle=ZOLTY;c.fill();c.lineWidth=1.2*L;c.stroke();
      c.beginPath();c.ellipse(-.35,-.7,.022,.06,0,0,TAU);c.moveTo(.765,-.58);c.arc(.74,-.58,.025,0,TAU);c.fillStyle=TUSZ;c.fill();
      c.beginPath();c.moveTo(-.56,-.84);c.lineTo(-.2,-.77);c.lineWidth=Math.max(2,q*.07)*L;c.stroke();
    }));
  }
  function szczeki(c,u,ts,z,otw,zloty){
    const hx=-.64*u,hy=-.04*u,kg=-(.06+.34*otw),kd=.05+.3*otw;
    const d=sprSzczeki(u,zloty,false),g=sprSzczeki(u,zloty,true);
    c.save();c.translate(hx,hy);c.rotate(kd);c.translate(-hx,-hy);c.drawImage(d.cv,SZD.x0*u,SZD.y0*u,SZD.w*u,SZD.h*u);c.restore();
    c.save();c.translate(hx,hy);c.rotate(kg);c.translate(-hx,-hy);
    if(!lekki())for(let j=0;j<3;j++){const b=GRZYWA[j];plomien(c,jezyk(j+z),b[0]*u,b[1]*u,u*(.58+.32*szum(ts*4.5+j*2.3+z)),b[2]);}   // grzywa: przy 3+ torach wchodziła na klawiaturę
    c.drawImage(g.cv,SZG.x0*u,SZG.y0*u,SZG.w*u,SZG.h*u);
    const w1=Math.sin(ts*2.1+z)*.1,w2=Math.sin(ts*1.7+z+1.3)*.1;
    c.lineCap="round";c.beginPath();c.moveTo(.8*u,-.52*u);c.bezierCurveTo(.62*u,(-.95+w1)*u,.05*u,(-1.2+w2)*u,-.55*u,(-1.3+w1)*u);
    c.lineWidth=Math.max(2,u*.05);c.strokeStyle=kol(TUSZ,.8);c.stroke();c.lineWidth=Math.max(1,u*.026);c.strokeStyle=ZOLTY;c.stroke();
    c.restore();
  }

  // Głowa stopnia: warstwy według flag (kumulatywnie). Rdzeń ewoluuje zamiast się piętrzyć: kula plazmy (14),
  // w paszczy smoka same włókna plazmy (15–17) → czarna dziura (18–19) → słońce (20); paszcza smoka (15+), pierścień
  // ładunku w rytm (16+), korona polarna (17+), dysk akrecyjny (18+), odłamki na orbicie i gwiazdka (19+), pętle
  // protuberancji (20) dochodzą po kolei. Czas zdarzeń i obrotów z klatki gry (przedni rząd dostaje od gry ts + 0,37 s).
  function rysujGlowe(c,sc,og,ts,z,przod,fl,s,teraz){
    const u=sc,cy=-sc*.06;
    // chór: gra podaje ziarno nrWTorze·7 + 1 (tył) albo + 2 (przód); pełną głowę ma tylko lider, reszta sam rdzeń,
    // bo trzy paszcze smoka jedna na drugiej zasłaniały żaby chóru
    // rdzeń według własnych flag stopnia (nie zakłada niższych stopni): słońce, dziura, gwiazda supernowej, kula plazmy
    const kula=fl.plazma&&!fl.smok&&!fl.dziura&&!fl.wybuch&&!fl.nowa;
    // gra woła już tylko tylny przebieg (glowaZaGlowa), więc wszystko, co było w przednim, rysuje się tutaj
    if(przod)return;
    if(Math.floor((z-1)/7)>0){
      if(kula)obreczSzkla(c,u*.6,cy,.8);
      if(fl.wybuch)slonce(c,u*.52,cy,teraz,z,.9);else if(fl.dziura)dziura(c,u*.52,cy,teraz,.9,0);
      else if(fl.nowa)gwiazdaNowa(c,u*.42,cy,ts,.9,0);else if(fl.plazma)kulaPlazmy(c,u*.6,cy,og,ts,z,.85);
      return;
    }
    const ryk=s?ogr(1-(teraz-s.ryk)/.75,0,1):0,nowa=s?ogr(1-(teraz-s.nowa)/1.5,0,1):0;
    const lk=lekki();
    if(!przod){
      if(fl.zorza&&!lk)korona(c,u,cy,og,ts,z,.95);
      if(fl.dziura)dysk(c,u,cy,teraz,false,.9,fl.wybuch);
      if(fl.nowa&&!lk)odlamkiOrbity(c,u,cy,teraz,false,.9);
      if(fl.fala){const f=fazaBeatu(ts),r=u*(1.02+.42*f);c.lineWidth=Math.max(1,u*.05*(1-f)+.6);
        c.strokeStyle=kol(BLEK,.6*(1-f));c.beginPath();c.arc(0,cy,r,0,TAU);c.stroke();}
      const otw=Math.min(1,.12+.18*Math.pow(1-fazaBeatu(ts),2)+ryk);
      if(fl.smok)gardlo(c,u,otw);
      if(fl.wybuch)slonce(c,u*.6,cy,teraz,z,1);
      else if(fl.dziura)dziura(c,u*.6,cy,teraz,1,fl.nowa?Math.max(nowa,.45+.45*Math.pow(1-fazaBeatu(ts),2)):0);
      else if(fl.nowa)gwiazdaNowa(c,u*.5,cy,ts,1,nowa);
      else if(fl.smok){if(fl.plazma){c.save();c.globalCompositeOperation="lighter";c.lineJoin="round";c.lineCap="round";wlokna(c,cy,u*.6,og>=3?7:5,ts,z,1);c.restore();}}
      else if(fl.plazma)kulaPlazmy(c,u*.72,cy,og,ts,z,1);
      if(fl.smok)szczeki(c,u,ts,z,otw,fl.wybuch);
      // dawny przedni rząd (obręcz kuli, przód dysku, odłamki z przodu, gwiazdka, protuberancje)
      if(kula)obreczSzkla(c,u*.72,cy,1);
      if(fl.dziura)dysk(c,u,cy,teraz,true,.85,fl.wybuch);
      if(fl.nowa){if(!lk)odlamkiOrbity(c,u,cy,teraz,true,1);
        const b=blysk(),pb=fazaBeatu(ts),s2=u*(.3+.08*(1-pb)*(1-pb)+.25*nowa);
        c.save();c.translate(u*.4,cy-u*.44);c.rotate(teraz*.6);c.drawImage(b.cv,-s2/2,-s2/2,s2,s2);c.restore();}
      if(fl.wybuch&&!lk)petleProtuberancji(c,u*.6,cy,teraz,z,1);
    }
  }
  // Okna czytelności: taśmy nut, które przechodzą przez pas ±1,5 wysokości nuty wokół linii „teraz” w zasięgu głowy
  // (poza nutą schowaną za żabą). Prostokąty w px ekranu w OKNA (x, y, w, h).
  const OKNA=[];
  function oknaTasm(s,sc){
    OKNA.length=0;const L=s.L;
    if(!L||!L.tor||!L.tor.def||typeof S==="undefined"||!S||!S.gra||typeof xBeat!=="function")return 0;
    const p=pasTeraz(L),bl=L.teraz-p,br=L.teraz+p,nh=wysNuty(L),rs=Math.max(4,nh*.62),zas=sc*1.6,ry=sc*.45,G=S.gra;
    if(Math.abs(s.fx-L.teraz)>zas+p)return 0;
    const nuty=L.tor.def.nuty,bMax=G.beat+(p+rs)/L.pxNaBeat;
    for(let i=Math.max(0,L.tor.ptrRys|0);i<nuty.length;i++){const n=nuty[i];if(n.t>bMax)break;
      const x0=xBeat(L,n.t)-rs,x1=xBeat(L,n.t+n.d)+rs;if(x1<bl||x0>br)continue;
      const y=ySemi(L,n.m),ya=y-nh/2-3,yb=y+nh/2+5;if(yb<s.fy-zas||ya>s.fy+zas)continue;
      const xa=Math.max(x0,bl),xb=Math.min(x1,br);
      if(xa>=s.fx-ry&&xb<=s.fx+ry&&ya>=s.fy-ry&&yb<=s.fy+ry)continue;
      OKNA.push(xa,ya,xb-xa,yb-ya);
    }
    return OKNA.length;
  }
  // Głowa w grze: gdy przez pas „teraz” w zasięgu głowy przechodzi taśma nuty, warstwa rysuje się z przycięciem
  // „evenodd” (cały ekran minus okna taśm), więc taśma w pasie zostaje odsłonięta (alfa efektu 0 ≤ 0,25),
  // a reszta głowy rysuje się normalnie. Bez płócien roboczych: kopia płótna co klatkę dla każdej żaby dławiła GPU.
  function glowa(c,sc,og,ts,z,przod,W,fl){
    const st=stKlatki(),teraz=st&&Number.isFinite(st.ts)?st.ts:ts,s=stanGlowy(c,sc),n=s?oknaTasm(s,sc):0;
    c.save();
    if(n&&typeof c.getTransform==="function"&&typeof c.clip==="function"){
      const M=c.getTransform(),d=(typeof R!=="undefined"&&R&&R.dpr)||1;
      c.setTransform(d,0,0,d,0,0);c.beginPath();c.rect(-1e4,-1e4,2e4,2e4);
      for(let i=0;i<n;i+=4)c.rect(OKNA[i],OKNA[i+1],OKNA[i+2],OKNA[i+3]);
      c.clip("evenodd");c.setTransform(M);
    }
    rysujGlowe(c,sc,og,ts,z,przod,fl,s,teraz);
    c.restore();
  }

  // =========================================================================================== ślad (2D)
  // k = {pts:[{x,y,sp}], og, ts, x0, xT, dlug, ziarno, pelna, emituj, kolor}; punkty rosną w x, przerwy to sp:false.
  // Wstęga plazmy: dwie nici (róż i błękit) skręcone wokół śladu jak helisa; fala skrętu biegnie od żaby ku ogonowi,
  // amplituda rośnie ku żabie. Na skrzyżowaniach nici jasne paciorki; od fali uderzeniowej paciorki co ćwierćnutę
  // puszczają drobne kręgi. Nad jasną kartą kolory w zwykłym trybie (nie „lighter”), żeby nie bielały.
  const LAM=40,OM=3.2;
  function wstegaPlazmy(c,k,moc,dy,alfa,fl,paciorki){
    const pts=k.pts,x0=k.x0,xT=k.xT,dl=k.dlug||1,og=k.og,ts=k.ts;
    const amp=(og>=3?1.2:og>=2?1:.7)*(.8+.3*moc);
    c.lineJoin="round";c.lineCap="round";
    let pi=false;const st=stKlatki();
    if(!(k.emituj&&st&&st.gl)){   // szeroka poświata: w grze z WebGL2 robi ją wstęga GPU pod nutami (emituj), tu tylko 2D
      c.beginPath();let ost=-1e9;
      for(const p of pts){if(!p.sp||p.x<x0){pi=false;continue;}if(pi&&p.x-ost<5)continue;ost=p.x;if(pi)c.lineTo(p.x,p.y+dy);else{c.moveTo(p.x,p.y+dy);pi=true;}}
      c.lineWidth=og>=3?11:og>=2?9:6;c.strokeStyle=gradX(c,x0,xT,ROZ,0,.2*alfa);c.stroke();}
    // nici co ≥ 4 px (fala skrętu ma 40 px, więc 10 punktów na okres wystarcza); rdzenie obu nici jedną ścieżką
    const nic=n=>{let ost=-1e9;pi=false;
      for(let i=0;i<pts.length;i++){const p=pts[i];if(!p.sp||p.x<x0){pi=false;continue;}
        const kon=i===pts.length-1||!pts[i+1].sp;if(pi&&p.x-ost<4&&!kon)continue;ost=p.x;
        const f=(p.x-x0)/dl,A=(2+7*f)*amp,ph=(xT-p.x)/LAM*TAU-ts*OM,y=p.y+dy+(n?-A:A)*Math.sin(ph);
        if(pi)c.lineTo(p.x,y);else{c.moveTo(p.x,y);pi=true;}}};
    for(let n=0;n<2;n++){c.beginPath();nic(n);c.lineWidth=og>=3?3.6:2.8;c.strokeStyle=gradX(c,x0,xT,n?BLEK:ROZ,0,.6*alfa);c.stroke();}
    c.beginPath();nic(0);nic(1);c.lineWidth=1.2;c.strokeStyle=gradX(c,x0,xT,"#fff0fa",0,.95*alfa);c.stroke();
    if(!paciorki||og<2||lekki())return;
    // skrzyżowania: φ(x) = mπ, czyli x = xT − (mπ + ts·ω)·λ/2π
    // paciorki: wszystkie różowe obwódki jedną ścieżką i wszystkie jasne środki drugą (sprite’y z bufora po kolei
    // kosztowały na tym GPU kilka ms rastra na cztery tory); bliżej żaby większe, w głębi śladu mniejsze
    const fala=fl.fala?fazaBeatu(ts):-1,kr=[];
    for(let m=Math.ceil(-ts*OM/PI/2)*2;m<400;m+=2){   // co drugie skrzyżowanie: paciorki co pełny skręt
      const x=xT-(m*PI+ts*OM)*LAM/TAU;if(x>xT)continue;if(x<x0)break;
      const y=ySladu(pts,pts.length,x);if(y==null)continue;
      const f=(x-x0)/dl;if(f<.12)continue;kr.push(x,y+dy,(1.4+3*f)*amp,f);
    }
    if(kr.length){
      for(const [sk,kolor,a] of [[1.25,ROZ,.5],[.55,"#fff6fb",.95]]){c.beginPath();
        for(let i=0;i<kr.length;i+=4){const r=kr[i+2]*sk;c.moveTo(kr[i]+r,kr[i+1]);c.arc(kr[i],kr[i+1],r,0,TAU);}
        c.globalAlpha=a*alfa;c.fillStyle=kolor;c.fill();}
      c.globalAlpha=1;}
    if(fala>=0&&kr.length){c.beginPath();   // fala uderzeniowa (16+): paciorki puszczają kręgi co ćwierćnutę
      for(let i=0;i<kr.length;i+=4){if(kr[i+3]<.35)continue;const r=kr[i+2]*(1.6+3.6*fala);c.moveTo(kr[i]+r,kr[i+1]);c.arc(kr[i],kr[i+1],r,0,TAU);}
      c.lineWidth=1.2;c.strokeStyle=kol(BLEK,.55*(1-fala)*alfa);c.stroke();}
  }
  // Ciało smoka: wielokąt o zmiennej szerokości wzdłuż śladu (cienki ogon, gruba szyja przy żabie). Oś ciała to ślad
  // wygładzony dwukrotnym filtrem pudełkowym (skoki wysokości stają się łagodnym esem, a nie schodkiem), do tego
  // sinusoida pływania biegnąca od głowy do ogona; poprzeczne pasy łusek, kolce na grzbiecie, kontur tuszem.
  // Ryk (próg kombo) to garb rozdęcia, który płynie od szyi do ogona w 0,75 s. Głowę smoka rysuje glowa.
  const BOK_A_T=new Float64Array(1600),BOK_B_T=new Float64Array(1600),OS_X=new Float64Array(800),OS_Y=new Float64Array(800),OS_T=new Float64Array(800);
  function wygladzOs(n,r){
    for(let przejscie=0;przejscie<2;przejscie++){
      let suma=0,ile=0;
      for(let i=0;i<n;i++)OS_T[i]=OS_Y[i];
      for(let i=-r;i<n;i++){
        const we=i+r,wy=i-r-1;
        if(we<n){suma+=OS_T[we];ile++;}
        if(wy>=0){suma-=OS_T[wy];ile--;}
        if(i>=0)OS_Y[i]=suma/ile;
      }
    }
  }
  const PASY=[],KOLCE=[];
  function cialoSmoka(c,k,moc,ryk,zloty,wMax){
    const pts=k.pts,x0=k.x0,xT=k.xT,dl=k.dlug||1,og=k.og,ts=k.ts;
    const gr=(og>=3?1.15:og>=2?1:.72)*(.85+.2*moc),garbX=ryk>=0?1-ryk:-9,garbA=ryk>=0?.95*(1-ryk*.6):0;
    c.beginPath();const pasy=PASY,kolce=KOLCE;pasy.length=0;kolce.length=0;   // tablice wielokrotnego użytku
    let i=0;
    while(i<pts.length){
      // ciągły odcinek śpiewu, próbki co ≥ 3 px
      let m=0,ost=-1e9;
      while(i<pts.length&&!(pts[i].sp&&pts[i].x>=x0))i++;
      while(i<pts.length&&pts[i].sp&&m<800){const p=pts[i];
        if(p.x-ost>=5||(i+1<pts.length&&!pts[i+1].sp)||i===pts.length-1){OS_X[m]=p.x;OS_Y[m]=p.y;m++;ost=p.x;}i++;}
      if(m<2)continue;
      wygladzOs(m,Math.min(4,(m-1)>>1));
      for(let q=0;q<m;q++){const pa=q?q-1:q,pb=q<m-1?q+1:q,x=OS_X[q],f=(x-x0)/dl;
        const ph=(xT-x)/58*TAU-ts*2.6,y=OS_Y[q]+(1.2+3.2*f)*gr*Math.sin(ph);
        let tx=OS_X[pb]-OS_X[pa],ty=OS_Y[pb]-OS_Y[pa];const d=Math.hypot(tx,ty)||1;tx/=d;ty/=d;
        const garb=garbA*Math.exp(-Math.pow((f-garbX)/.12,2)),w=(2+(wMax-2)*Math.pow(Math.max(0,f),.85))*gr*(1+garb)/2,nx=-ty,ny=tx;
        BOK_A_T[q*2]=x+nx*w;BOK_A_T[q*2+1]=y+ny*w;BOK_B_T[q*2]=x-nx*w;BOK_B_T[q*2+1]=y-ny*w;
        if(q>0)pasy.push(x+nx*w*.8,y+ny*w*.8,x-nx*w*.8,y-ny*w*.8);
        if(q%3===1&&w>2.2){const bx=x-nx*w,by=y-ny*w,h=2+w*.9;kolce.push(bx+tx*2.2,by+ty*2.2,bx-tx*2.2,by-ty*2.2,bx-nx*h-tx*h*.6,by-ny*h-ty*h*.6);}}
      c.moveTo(BOK_A_T[0],BOK_A_T[1]);for(let q=1;q<m;q++)c.lineTo(BOK_A_T[q*2],BOK_A_T[q*2+1]);
      for(let q=m-1;q>=0;q--)c.lineTo(BOK_B_T[q*2],BOK_B_T[q*2+1]);c.closePath();
    }
    const g=c.createLinearGradient(x0,0,xT,0);
    g.addColorStop(0,kol(zloty?ZOLTY:BURSZ,0));g.addColorStop(.25,kol(zloty?ZOLTY:BURSZ,.8));g.addColorStop(.6,kol(zloty?BURSZ:KARM,.95));g.addColorStop(1,kol(zloty?"#c9861a":ROZ,1));
    c.fillStyle=g;c.fill();c.lineJoin="round";c.lineWidth=1.4;c.strokeStyle=gradX(c,x0,xT,TUSZ,0,.9);c.stroke();
    const lk=lekki();
    if(pasy.length&&!lk){c.beginPath();for(let q=0;q<pasy.length;q+=4){c.moveTo(pasy[q],pasy[q+1]);c.lineTo(pasy[q+2],pasy[q+3]);}
      c.lineWidth=1.1;c.strokeStyle=gradX(c,x0,xT,"#5a0f26",0,.5);c.stroke();}
    if(kolce.length&&!lk){c.beginPath();for(let q=0;q<kolce.length;q+=6){c.moveTo(kolce[q],kolce[q+1]);c.lineTo(kolce[q+4],kolce[q+5]);c.lineTo(kolce[q+2],kolce[q+3]);c.closePath();}
      c.fillStyle=gradX(c,x0,xT,ZOLTY,0,1);c.fill();c.lineWidth=1;c.strokeStyle=gradX(c,x0,xT,TUSZ,0,.85);c.stroke();}
  }
  // Koniec śladu wpada w dysk czarnej dziury: spirala od punktu śladu (ok. 0,8 długości) wokół głowy, spłaszczona
  // i przechylona jak dysk, zwija się do pierścienia fotonowego.
  function spiralaKonca(c,k,s,teraz,zloty){
    const u=s.sc,hx=s.fx,hy=s.fy-u*.06+u*.05,xs=k.x0+(k.dlug||1)*.8,ys=ySladu(k.pts,k.pts.length,xs);if(ys==null)return;
    const cs=Math.cos(.2),sn=Math.sin(.2),dx=xs-hx,dy=ys-hy,lx=dx*cs-dy*sn,ly=(dx*sn+dy*cs)/.3;
    const r0=Math.hypot(lx,ly),a0=Math.atan2(ly,lx),r1=u*.64,obr=-PI*2.3;
    c.beginPath();
    for(let i=0;i<=30;i++){const t=i/30,r=r0+(r1-r0)*(1-(1-t)*(1-t)),a=a0+t*obr+Math.sin(teraz*1.3)*.08*t,ex=Math.cos(a)*r,ey=Math.sin(a)*r*.3;
      const x=hx+ex*cs+ey*sn,y=hy-ex*sn+ey*cs;if(i)c.lineTo(x,y);else c.moveTo(x,y);}
    c.lineCap="round";c.lineJoin="round";
    c.lineWidth=Math.max(3,u*.16);c.strokeStyle=kol(zloty?BURSZ:ROZ,.35);c.stroke();
    c.lineWidth=Math.max(1.6,u*.07);c.strokeStyle=kol(zloty?ZOLTY:FIOL,.8);c.stroke();
    c.lineWidth=1;c.strokeStyle="rgba(255,255,255,.9)";c.stroke();
  }
  // Ślad stopnia bez plazmy (sygnatura sama): jedna smuga w barwie stopnia gasnąca ku przeszłości, przy fali kręgi
  // co ok. 40 px wzdłuż śladu rozchodzące się w rytm (jedna ścieżka).
  function smugaSladu(c,k,fl){
    const pts=k.pts,x0=k.x0,xT=k.xT,og=k.og,kolor=fl.dziura?FIOL:fl.nowa?BURSZ:fl.fala?BLEK:ROZ;
    c.lineJoin="round";c.lineCap="round";c.beginPath();let pi=false,ost=-1e9;
    for(let i=0;i<pts.length;i++){const p=pts[i];if(!p.sp||p.x<x0){pi=false;continue;}
      if(pi&&p.x-ost<5&&i<pts.length-1)continue;ost=p.x;if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
    c.lineWidth=og>=3?7:og>=2?5.5:4;c.strokeStyle=gradX(c,x0,xT,kolor,0,.55);c.stroke();
    c.lineWidth=1.4;c.strokeStyle=gradX(c,x0,xT,PAPIER,0,.9);c.stroke();
    if(fl.fala&&og>=2&&k.pelna){const f=fazaBeatu(k.ts);c.beginPath();
      for(let x=xT-24;x>x0+20;x-=40){const y=ySladu(pts,pts.length,x);if(y==null)continue;const r=(2+5*(x-x0)/(xT-x0))*(1+2.2*f);c.moveTo(x+r,y);c.arc(x,y,r,0,TAU);}
      c.lineWidth=1.2;c.strokeStyle=kol(BLEK,.55*(1-f));c.stroke();}
  }
  function slad(c,k,W,fl){
    if(!k||!k.pts||k.pts.length<2)return;
    const moc=mocW(W),s=poKluczu.get(kluczSladu(k.kolor,k.ziarno,k.xT))||null,st=stKlatki();
    const teraz=st&&Number.isFinite(st.ts)?st.ts:k.ts;
    c.save();
    const lider=(k.ziarno|0)<31;   // ziarno = nrWTorze·31: ciało smoka i podwójny ślad tylko u lidera chóru
    if(fl.smok&&lider){const e=s?(teraz-s.ryk)/.75:9;cialoSmoka(c,k,moc,e>=0&&e<1?e:-1,fl.wybuch,s&&s.sc>0?Math.max(10,s.sc*.36):13);}
    const wp=s&&fl.wybuch&&lider?s.warp:0;   // tryb nadświetlny: podwójny ślad (dwie bledsze kopie wstęgi nad i pod)
    if(wp>.03){const d=6*wp;wstegaPlazmy(c,k,moc,-d,.7*wp,fl,false);wstegaPlazmy(c,k,moc,d,.7*wp,fl,false);}
    // tryb lekki z WebGL2: nici rysuje GPU w haku tor (pod nutami), 2D zostaje ciało smoka i spirala
    if(fl.plazma){if(!(lekki()&&k.emituj&&st&&st.gl))wstegaPlazmy(c,k,moc,0,1,fl,!!k.pelna);}
    else if(!fl.smok||!lider)smugaSladu(c,k,fl);
    if(fl.dziura&&lider&&k.og>=2&&s&&s.sc>0)spiralaKonca(c,k,s,teraz,fl.wybuch);
    c.restore();
  }

  // =========================================================================================== nuty (2D)
  // Układ nuty: środek (0,0), taśma w × nh, fx = front spalenizny. Za frontem plazma stygnie do fioletowego żużlu
  // (czytelne tło dla naklejek ocen), na czynnej nucie żarzy się: od białego frontu w głąb (plazma: róż i fiolet;
  // czarna dziura odwrotnie: biały, fiolet, róż; słońce: złoto). Front to trzaskający pionowy łuk (zygzak przenikany
  // ≤ 6 Hz), od smoka z językami ognia, w słońcu z pętlą protuberancji.
  const NUTA_PLAZMA=["rgba(255,255,255,.92)","rgba(255,170,225,.8)","rgba(120,110,240,.66)","rgba(236,26,131,.6)"];
  const NUTA_DZIURA=["rgba(255,255,255,.94)","rgba(170,130,240,.82)","rgba(236,26,131,.66)","rgba(90,42,160,.65)"];
  const NUTA_SLONCE=["rgba(255,255,240,.94)","rgba(255,216,74,.85)","rgba(234,163,43,.72)","rgba(184,38,74,.55)"];
  // Gradient spalenizny w układzie frontu (x = 0 front, x = −dl w głąb), z pamięci po palecie i długości co 2 px.
  const GRAD_N=new Map();
  function gradNuty(c,P,dl){
    const k=(P===NUTA_SLONCE?2:P===NUTA_DZIURA?1:0)*4096+Math.round(dl/2);let g=GRAD_N.get(k);
    if(!g){if(GRAD_N.size>600)GRAD_N.clear();g=c.createLinearGradient(0,0,-Math.round(dl/2)*2,0);
      g.addColorStop(0,P[0]);g.addColorStop(.35,P[1]);g.addColorStop(1,P[2]);GRAD_N.set(k,g);}
    return g;
  }
  function nuty(c,w,nh,fx,poziom,ts,z,aktywna,gas,W,fl){
    const x0=-w/2,x1=w/2;fx=ogr(fx,x0,x1);
    const st=stKlatki(),teraz=st&&Number.isFinite(st.ts)?st.ts:ts,P=fl.wybuch?NUTA_SLONCE:fl.dziura?NUTA_DZIURA:NUTA_PLAZMA;
    const g0=gas==null?1:ogr(gas,0,1),nowa=fl.nowa?ogr(1-(teraz-ostNowa)/.6,0,1):0;
    if(fx>x0+1){
      const sz=fx-x0,kr=Math.max(1,nh*.12);
      c.fillStyle="rgba(46,34,74,.58)";c.fillRect(x0,-nh/2,sz,nh);
      // gradient od frontu w głąb: w układzie przesuniętym do frontu jest ten sam dla każdej klatki (z pamięci)
      c.globalAlpha=.25+.75*g0;c.translate(fx,0);
      c.fillStyle=gradNuty(c,P,Math.min(fx-x0,Math.max(24,w*.8)));c.fillRect(x0-fx,-nh/2,sz,nh);
      c.translate(-fx,0);
      c.beginPath();c.rect(x0,-nh/2,sz,kr);c.rect(x0,nh/2-kr,sz,kr);c.fillStyle=P[3];c.fill();
      c.globalAlpha=1;
      const lk=lekki()||g0<=0;   // minione nuty bez animowanych dodatków (stoją, a było ich na ekranie najwięcej)
      if(fl.zorza&&sz>8&&!lk){   // połysk zorzy: trzy pasma płyną powoli w lewo
        for(let j=0;j<3;j++){const xx=fx-ulamek(teraz*.22+j/3+z*.13)*sz;c.fillStyle=kol(j%2?LIM:ROZ,.4*(.4+.6*g0));c.fillRect(xx-1.5,-nh/2,3,nh);}
      }
      if(fl.nowa&&sz>6&&!lk){   // żarzące drobiny dryfują po stygnącym żużlu
        c.fillStyle=kol(ZOLTY,.85);
        for(let j=0;j<4;j++){const xx=x0+ulamek(los(j*3.1+z)+teraz*.05*(1+j*.3))*sz,yy=(los(j*5.7+z)-.5)*nh*.6+Math.sin(teraz*2+j)*nh*.12;c.fillRect(xx-1,yy-1,2,2);}
      }
      if(nowa>0){c.fillStyle=kol("#ffffff",.55*nowa);c.fillRect(x0,-nh/2,sz,nh);}
    }
    if(g0<=0)return;
    const h=nh*(aktywna?1.5:1.1)*(1+.25*Math.min(3,poziom||1)/3)*g0;przenik(ts,6);const t0=PT0,fr=PFR;
    c.save();c.lineJoin="round";c.lineCap="round";
    c.beginPath();c.moveTo(fx,-nh/2-h*.55);
    for(let i=1;i<6;i++)c.lineTo(fx+zyg(t0,fr,i*3+z)*nh*.7,-nh/2-h*.55+i/6*(nh+h*.55));
    c.lineTo(fx,nh/2+1);
    c.lineWidth=Math.max(2.4,nh*.24);c.strokeStyle=kol(fl.wybuch?BURSZ:ROZ,.6*g0);c.stroke();
    c.globalCompositeOperation="lighter";c.lineWidth=Math.max(1,nh*.08);c.strokeStyle=kol("#ffffff",.95*g0);c.stroke();
    c.fillStyle=kol(PAPIER,.9*g0);
    for(let j=0;j<3;j++){const ph=ulamek(ts*1.7+j/3+z*.3),xx=fx+(los(j+z)-.3)*nh*ph*1.6,yy=-nh/2-ph*h*.9;c.globalAlpha=1-ph;c.fillRect(xx-1,yy-1,2,2);}
    c.globalAlpha=1;
    if(fl.smok)for(let j=0;j<3;j++){const img=jezyk(j+(z|0));
      plomien(c,img,fx+(j-1)*nh*.32,-nh/2+1,h*(.55+.35*szum(ts*6+j*2.1+z))*(j===1?1.15:.8),(szum(ts*3+j*4.7+z)-.5)*.5-.1);}
    if(fl.wybuch){c.globalCompositeOperation="source-over";c.beginPath();c.moveTo(fx-nh*.7,-nh/2);
      c.quadraticCurveTo(fx-nh*.25,-nh/2-h*(1+.3*szum(ts*.8+z)),fx+nh*.2,-nh/2);
      c.lineWidth=Math.max(1.6,nh*.16);c.strokeStyle=kol(ROZ,.6*g0);c.stroke();c.lineWidth=Math.max(.8,nh*.06);c.strokeStyle=kol(ZOLTY,.95*g0);c.stroke();}
    c.restore();
  }

  // =========================================================================================== hak toru: zdarzenia i FX
  // Najbliższe nuty na prawo od linii „teraz” (początek po bieżącym beacie, najwyżej maxB ćwierćnut naprzód).
  const NAST=[];
  function nastepne(L,ile,maxB){
    NAST.length=0;const G=typeof S!=="undefined"&&S?S.gra:null;if(!G||!L.tor.def)return NAST;
    const nuty=L.tor.def.nuty;
    // tylko nuty, których główka jest w karcie (WebGL2 nie przycina, łuk do nuty za brzegiem wchodził na sąsiedni tor)
    for(let i=Math.max(0,L.tor.ptrRys|0);i<nuty.length&&NAST.length<ile;i++){const n=nuty[i];
      if(n.t<=G.beat)continue;if(n.t>G.beat+maxB||xBeat(L,n.t)>L.x+L.w-8)break;
      const y=ySemi(L,n.m);if(y<L.y+4||y>L.y+L.h-4)continue;NAST.push(n);}
    return NAST;
  }
  const dlugSladu=L=>{const G=typeof S!=="undefined"&&S?S.gra:null,sek=typeof ZC_SLAD_SEK!=="undefined"?ZC_SLAD_SEK:2.2;
    return G?sek*(G.bpm/60)*L.pxNaBeat:L.w*.3;};
  // ---- prymitywy zamknięte w karcie toru ----
  // Płótno WebGL2 (#glFx) nie ma przycięcia karty, więc to, co mogłoby wyjść poza kartę (pierścienie, poświaty,
  // wiązki), przycinamy tu: poświata zmniejsza promienie do brzegu karty, pierścień częściowo poza kartą idzie jako
  // łuki-wstęgi tylko z wnętrza karty, wiązka kończy się na brzegu. Dzięki temu efekty jednego toru nie wchodzą na
  // sąsiednie tory, widownię ani HUD.
  // KLIP: w tej chwili działa FX.klip karty (silnik przycina w shaderze), więc wystarczy zwykły prymityw.
  let KLIP=false;
  function kBlask(L,x,y,rx,ry,kolor,alfa,blend){
    if(KLIP){if(alfa>=.01)FX.blask(x,y,rx,ry,kolor,alfa,blend);return;}
    if(alfa<.01||x<=L.x||x>=L.x+L.w||y<=L.y||y>=L.y+L.h)return;
    rx=Math.min(rx,x-L.x,L.x+L.w-x);ry=Math.min(ry,y-L.y,L.y+L.h-y);
    if(rx>1&&ry>1)FX.blask(x,y,rx,ry,kolor,alfa,blend);
  }
  const wKarcie=(L,x,y,m)=>x>=L.x+m&&x<=L.x+L.w-m&&y>=L.y+m&&y<=L.y+L.h-m;
  // Tryb 2D silnika (C2D = płótno sceny w haku tor, z przycięciem karty): pierścienie i łuki rysujemy prosto, jednym
  // pociągnięciem; wstęga silnika w 2D to trzy pociągnięcia z save/restore, a pierścień SDF to wypełnienie gradientem.
  let C2D=null;
  function kolo2d(x,y,r,gr,kolor,alfa,blend){
    const c=C2D;c.save();c.globalCompositeOperation=blend==="add"?"lighter":"source-over";c.globalAlpha=Math.min(1,alfa);
    c.strokeStyle=kolor;c.lineWidth=Math.max(.6,gr);c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();c.restore();
  }
  function kPierscien(L,x,y,r,gr,kolor,alfa,blend,miekkosc){
    if(alfa<.01||r<1)return;
    if(C2D){kolo2d(x,y,r,gr,kolor,alfa,blend);return;}
    if(KLIP){FX.pierscien(x,y,r,gr,kolor,alfa,miekkosc||1.5,blend||"add");return;}
    const m=gr/2+1;
    if(blend!=="normal"&&x-r>=L.x+m&&x+r<=L.x+L.w-m&&y-r>=L.y+m&&y+r<=L.y+L.h-m){FX.pierscien(x,y,r,gr,kolor,alfa,1.5);return;}
    const n=Math.max(24,Math.min(120,Math.ceil(TAU*r/22))),biegi=[];let pk=null,od0=false;   // cięciwa ≤ 22 px: strzałka łuku < 0,4 px przy r ≥ 150
    for(let i=0;i<=n;i++){const a=i/n*TAU,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;
      if(wKarcie(L,px,py,m)){if(!pk){pk=[];if(i===0)od0=true;}pk.push(px,py);}else if(pk){biegi.push(pk);pk=null;}}
    if(pk){if(od0&&biegi.length){const p0=biegi.shift();for(let j=2;j<p0.length;j++)pk.push(p0[j]);}biegi.push(pk);}
    for(const q of biegi)if(q.length>=4)FX.wstega(q,gr,kolor,alfa,alfa,blend||"add");
  }
  // Parametr t ∈ [0,1], przy którym odcinek z wnętrza karty dochodzi do jej brzegu (margines 2 px).
  function tBrzegu(L,ax,ay,bx,by){
    let t=1;const dx=bx-ax,dy=by-ay;
    if(dx>0)t=Math.min(t,(L.x+L.w-2-ax)/dx);else if(dx<0)t=Math.min(t,(L.x+2-ax)/dx);
    if(dy>0)t=Math.min(t,(L.y+L.h-2-ay)/dy);else if(dy<0)t=Math.min(t,(L.y+2-ay)/dy);
    return Math.max(0,t);
  }
  // Stałe zestawy barw cząstek (bez nowych tablic w klatce).
  const K_ODL=["#ffffff",BURSZ,BLEK,ROZ,FIOL],K_GWI=[PAPIER,ZOLTY,BLEK,ROZ],K_WYL=[PAPIER,BLEK,ROZ],K_RYK=[ZOLTY,BURSZ,ROZ,PAPIER],
    K_CHOR=[BLEK,ROZ,FIOL],K_ODDECH=[BURSZ,ROZ,KARM,ZOLTY],K_IMPL=[PAPIER,ZOLTY,ROZ,BLEK],K_GAS=[BLEK,ROZ,PAPIER];
  // Iskry z punktu: kąt środkowy, rozrzut, prędkości, grawitacja, opór; kształt i tryb z silnika (add = jasne rdzenie).
  function iskry(L,x,y,n,gl,kolory,v0,v1,kat,rozrzut,ay,op,zycie,ks,blend,typ){
    for(let i=0;i<n;i++){const a=kat+(Math.random()-.5)*rozrzut,v=v0+(v1-v0)*Math.random();
      if(!czastka(L,gl,x,y,Math.cos(a)*v,Math.sin(a)*v,ay,op,zycie*(.7+.6*Math.random()),1.3+1.9*Math.random(),
        kolory[i%kolory.length],ks||"iskra",blend||"add",1,typ||0))break;}
  }
  // Próg kombo (co 4) i duży próg (co 12): ryk smoka, fala uderzeniowa, supernowa, narodziny gwiazd.
  function prog(L,g,s,st,fl,moc,T,duzy){
    const ts=st.ts,gl=!!st.gl,sc=s.sc,hx=s.fx,hy=s.fy-sc*.08;
    // chór: fale, supernowa i ryk tylko u lidera toru (żaby chóru śpiewają razem, więc ich progi wypadają razem)
    if((g.nrWTorze||0)>0){if(!duzy){s.prog=ts;iskry(L,hx,hy-sc*.1,Math.round((6+6*moc)*(gl?1:.5)),gl,K_CHOR,100,240,-PI/2,PI*1.2,260,1.8,.5);}return;}
    const Rm=Math.hypot(Math.max(hx-L.x,L.x+L.w-hx),Math.max(hy-L.y,L.y+L.h-hy));
    if(duzy){
      if(fl.nowa){s.nowa=ts;ostNowa=ts;
        T.fale.push({t0:ts,x:hx,y:hy,n:3,A:11+8*moc,Tr:.62,Rm:Rm*1.05,kol:BURSZ,duza:true});
        // odłamki: promieniście, opór i sprężyna ku linii śpiewu żaby, więc opadają na tor i gasną (≤ 160)
        const n=Math.round((gl?160:60)*moc);
        for(let i=0;i<n;i++){const a=Math.random()*TAU,v=160+520*Math.pow(Math.random(),.7),jasny=i%5===0;
          const q=czastka(L,gl,hx,hy,Math.cos(a)*v,Math.sin(a)*v*.8,0,1.6,1.2+.6*Math.random(),jasny?1.8+1.8*Math.random():2+2.6*Math.random(),
            K_ODL[i%5],jasny?"iskra":i%3?"kolo":"gwiazda",jasny?"add":"normal",1,2);
          if(!q)break;q.yc=hy;q.spr=7;}
      }
      if(fl.wybuch){   // narodziny gwiazd: spirala z głowy (prędkość styczna), powolne gaśnięcie
        for(let i=0,ni=gl?36:14;i<ni;i++){const a=i/ni*TAU+Math.random()*.2,vr=60+100*Math.random(),vt=200+120*Math.random();
          if(!czastka(L,gl,hx+Math.cos(a)*sc*.5,hy+Math.sin(a)*sc*.35,Math.cos(a)*vr-Math.sin(a)*vt,(Math.sin(a)*vr+Math.cos(a)*vt)*.6,0,1.3,
            1.4+.6*Math.random(),1.4+1.6*Math.random(),K_GWI[i%4],i%2?"gwiazda":"kolo",i%4<2?"add":"normal",1,2))break;}
      }
      return;
    }
    s.prog=ts;
    iskry(L,hx,hy-sc*.1,Math.round((8+10*moc)*(gl?1:.5)),gl,K_WYL,120,300,-PI/2,PI*1.2,260,1.8,.6);
    if(fl.smok){s.ryk=ts;   // ryk: chmura iskier z pyska smoka do przodu i w górę, grawitacja, opór
      iskry(L,hx+sc*.75,hy-sc*.42,Math.round((24+26*moc)*(gl?1:.4)),gl,K_RYK,180,470,-.45,1,420,2.2,.8);}
    if(fl.fala&&s.nowa!==ts)T.fale.push({t0:ts,x:hx,y:hy,n:2,A:7+6*moc,Tr:.5,Rm,kol:g.kolor||ROZ,duza:false});
  }
  // Cząstki i pierścienie fal toru (raz na tor i klatkę, w haku pierwszej żaby toru).
  function rysujToru(L,st,T){
    const gl=!!st.gl,pas=pasTeraz(L),ts=st.ts;
    for(let i=0;i<nCz;i++){const p=CZ[i];if(p.t!==L.tor||p.wiek>=p.zycie)continue;
      const f=p.wiek/p.zycie;
      // typ 0: iskra gaśnie, 1: dym rośnie i znika łukiem, 2: odłamek (szybko jasny, długo gaśnie), 3: płomień oddechu
      let a=p.a0*(p.typ===1?Math.sin(PI*f):p.typ===2?(f<.12?f/.12:1-(f-.12)/.88):p.typ===3?Math.min(1,f*6)*(1-f):(1-f)*(1-.5*f));
      if(!gl){a*=.5;if(Math.abs(p.x-L.teraz)<pas)continue;}
      if(a<.02)continue;
      FX.sprite(p.x,p.y,p.r*(p.typ===1?1+1.6*f:p.typ===3?1+1.8*f:1-.35*f),p.kol,a,p.ks==="gwiazda"?p.wiek*2:0,p.ks,p.blend);
    }
    for(const f of T.fale){const tau=ts-f.t0;
      for(let r=0;r<f.n;r++){const tr=tau-r*.07;if(tr<0||tr>f.Tr)continue;
        const u=tr/f.Tr,R=Math.max(1,f.Rm*(1-(1-u)*(1-u))),a=Math.pow(1-u,1.1)*(gl?1:.28),w=f.duza?1.4:1;
        kPierscien(L,f.x,f.y,R,(16*(1-u)+5)*w,f.kol,.3*a,"normal",6);
        kPierscien(L,f.x,f.y,R,(4.5*(1-u)+1.6)*w,f.kol,.85*a,"normal");
        kPierscien(L,f.x,f.y,R*.985,(2.2*(1-u)+1)*w,"#ffffff",.95*a,"add");}
    }
    {let j=0;for(let i=0;i<T.fale.length;i++){const f=T.fale[i];if(ts-f.t0<f.Tr+.07*f.n+.35)T.fale[j++]=f;}T.fale.length=j;}
  }
  // Fala uderzeniowa podrzuca nadjeżdżające nuty. Gra trzyma je jako gotowe bitmapy (L.tor.sprajty, sprajtNuty
  // w zabi-chor.js), więc rysujemy kopię bitmapy wyżej o dy (podskok ~0,3 s za frontem, amplituda maleje z odległością),
  // a miejsce, z którego taśma „wyskoczyła”, przygasa do bladego śladu; na początku fali dwie barwne krawędzie ±2 px
  // (róż i błękit) = krótkie rozdwojenie barw. Bez kopiowania płótna sceny: drawImage płótna na samo siebie
  // wymuszało synchronizację GPU i robiło ścinki. Pas czytelności wokół linii „teraz” i żaba źródła zostają nietknięte;
  // minione nuty (bez bitmapy) nie skaczą.
  const TH=.3;
  function podskok(f,xc,dmin){
    const d=Math.abs(xc-f.x);if(d<dmin)return 0;
    const ud=1-Math.sqrt(Math.max(0,1-d/f.Rm)),s=(f.tau-ud*f.Tr)/TH;
    if(s<=0||s>=1)return 0;
    return f.A*gladko(dmin,dmin+30,d)*(1-.6*d/f.Rm)*Math.sin(PI*s)*(1-.3*s);
  }
  function przesunNuty(c,L,st,T){
    const K=L.tor.sprajty;if(!K||!K.size||!T.fale.length||typeof S==="undefined"||!S||!S.gra||!L.tor.def)return;
    const ts=st.ts,pas=pasTeraz(L),dmin=pas+L.zaba*.55,nuty=L.tor.def.nuty,nh=wysNuty(L),xMax=L.x+L.w;let chrom=0;
    for(let i=0;i<T.fale.length;i++){const f=T.fale[i];f.tau=ts-f.t0;if(f.tau>=0)chrom=Math.max(chrom,1-f.tau/.35);}
    let zapis=false;
    for(let i=Math.max(0,L.tor.ptrRys|0);i<nuty.length;i++){const n=nuty[i],x0=xBeat(L,n.t)+1;if(x0>xMax)break;
      if(x0<L.teraz+pas)continue;const b=K.get(i);if(!b)continue;
      let dy=0;for(let k=0;k<T.fale.length;k++){const f=T.fale[k];if(f.tau>=0){const v=podskok(f,x0+Math.min(b.w*.5,30),dmin);if(v>dy)dy=v;}}
      if(dy<.5)continue;
      if(!zapis){c.save();zapis=true;}
      const y=ySemi(L,n.m),cx=x0+b.w/2;
      c.globalAlpha=1;c.fillStyle=SLAD_SKOKU;c.fillRect(x0-1,y-nh/2-1,b.w+2,nh+2);
      c.drawImage(b.cv,cx-b.cw/2,y-b.ch/2-dy,b.cw,b.ch);
      if(chrom>0){c.lineWidth=1.5;c.globalAlpha=.6*chrom;
        c.strokeStyle=ROZ;c.strokeRect(x0-2,y-nh/2-dy,b.w,nh);c.strokeStyle=BLEK;c.strokeRect(x0+2,y-nh/2-dy,b.w,nh);}
    }
    if(zapis)c.restore();
  }
  const SLAD_SKOKU="rgba(250,246,238,.55)";
  // Łuk elektryczny z własnego zygzaka (obwiednia sinus, końce w punktach): barwny trzon w zwykłym trybie i cienki
  // biały rdzeń „add” (FX.luk silnika jest cały addytywny, a nad jasną kartą biel bez barwy ginie). Zygzak płynie:
  // przesunięcia punktów są interpolowane między dwoma ziarnami (t0 i t0+1) wagą fr, więc kształt zmienia się płynnie
  // bez przenikania dwóch kopii (połowa wstęg).
  function lukKolorowy(ax,ay,bx,by,t0,fr,z,amp,alfa,kolor,gr){
    if(alfa<.02)return;
    const dx=bx-ax,dy=by-ay,d=Math.hypot(dx,dy)||1,nx=-dy/d,ny=dx/d,seg=Math.max(4,Math.min(12,Math.round(d/14))),pk=PKL;pk.length=0;
    for(let s=0;s<=seg;s++){const t=s/seg,o=s&&s<seg?zyg(t0,fr,z*3.1+s*1.7)*2*amp*Math.sin(PI*t):0;pk.push(ax+dx*t+nx*o,ay+dy*t+ny*o);}
    if(C2D){const c=C2D;c.save();c.lineJoin="round";c.lineCap="round";c.beginPath();c.moveTo(pk[0],pk[1]);
      for(let i=2;i<pk.length;i+=2)c.lineTo(pk[i],pk[i+1]);
      c.globalAlpha=Math.min(1,.85*alfa);c.strokeStyle=kolor;c.lineWidth=gr;c.stroke();
      c.globalAlpha=Math.min(1,alfa);c.strokeStyle=PAPIER;c.lineWidth=Math.max(.8,gr*.32);c.stroke();c.restore();return;}
    if(gr>=3)FX.wstega(pk,gr*2.6,kolor,.22*alfa,.22*alfa,"normal");
    FX.wstega(pk,gr,kolor,.85*alfa,.85*alfa,"normal");
    FX.wstega(pk,Math.max(.8,gr*.32),"#ffffff",alfa,alfa,"add");
  }
  // ---- wstęgi wzdłuż śladu bez domknięć i nowych tablic (silnik kopiuje punkty od razu w wywołaniu) ----
  const PKL=[],PKW=[],W4=[0,0,0,0],P3=[{x:0,y:0,g:0},{x:0,y:0,g:0},{x:0,y:0,g:0}];
  const K_PYL=[BLEK,FIOL,ROZ,BURSZ],K_WARK=[BURSZ,BLEK,ROZ,FIOL],K_WARP=[BLEK,FIOL,ROZ];
  function wypuscPKW(fa,x0,dl,s1,k1,a1,b1,s2,k2,a2,b2){
    if(PKW.length>=4){const fb=ogr((PKW[PKW.length-2]-x0)/dl,0,1);FX.wstega(PKW,s1,k1,a1*fa,a1*fb,b1);if(s2)FX.wstega(PKW,s2,k2,a2*fa,a2*fb,b2);}
    PKW.length=0;
  }
  // Wstęga wzdłuż śladu (punkty PKT co `co`, w przedziale xa..xb, przesunięte o dy): przerwy w śpiewie dzielą ją na
  // osobne wstęgi, alfa liniowo wg położenia na śladzie (gaśnie ku przeszłości); druga warstwa opcjonalna (s2 > 0).
  function wstegaSladu(n,co,xa,xb,x0,dl,dy,s1,k1,a1,b1,s2,k2,a2,b2){
    PKW.length=0;let fa=-1;
    for(let i=0;i<n;i+=co){const p=PKT[i];
      if(!p.sp||p.x<xa||p.x>xb){wypuscPKW(fa,x0,dl,s1,k1,a1,b1,s2,k2,a2,b2);fa=-1;continue;}
      if(fa<0)fa=ogr((p.x-x0)/dl,0,1);PKW.push(p.x,p.y+dy);}
    wypuscPKW(fa,x0,dl,s1,k1,a1,b1,s2,k2,a2,b2);
  }
  // Nić helisy plazmy jako wstęga GPU (tryb lekki): ten sam wzór co wstegaPlazmy w 2D.
  function nicGPU(n,w,x0,x0c,dl,xT,ts,amp,szer,kolor,a,A){
    PKW.length=0;let fa=-1,ost=-1e9;
    for(let i=0;i<n;i++){const p=PKT[i];
      if(!p.sp||p.x<x0c){wypuscPKW(fa,x0,dl,szer,kolor,a*A,"normal",1.1,"#ffffff",.8*A,"add");fa=-1;continue;}
      if(p.x-ost<4&&i<n-1)continue;ost=p.x;
      const f=(p.x-x0)/dl,Aw=(2+7*f)*amp,ph=(xT-p.x)/LAM*TAU-ts*OM;if(fa<0)fa=f;PKW.push(p.x,p.y+(w?-Aw:Aw)*Math.sin(ph));}
    wypuscPKW(fa,x0,dl,szer,kolor,a*A,"normal",1.1,"#ffffff",.8*A,"add");
  }
  function pkt3(i,x,y,g){const q=P3[i];q.x=x;q.y=y;q.g=g;}
  // Stałe warstwy przy ogniu i zdarzenia jednej żaby (emisja FX; tryb 2D: połowa alfy i liczby, bez pasa „teraz”).
  function emituj(L,g,s,st,fl,moc,gl){
    const og=g.ogien||0,ts=st.ts,sc=s.sc,hx=s.fx,hy=s.fy-sc*.08,A=s.wyg,pas=pasTeraz(L),ogf=(og>=3?1:og>=2?.8:.55)*(lekki()?.6:1),k2=gl?1:.4;
    // ---- zdarzenia (żyją także po zgaśnięciu ognia) ----
    if(fl.dziura){const t=ts-s.zapad;
      if(t>=0&&t<.75){const m=Math.pow(Math.max(0,1-t/.45),2);   // dysk zapada się do horyzontu i pęka błyskiem
        if(m>0){kPierscien(L,s.zx,s.zy,sc*(.6+.95*m),2+5*m,FIOL,.85*A*k2,"normal");kPierscien(L,s.zx,s.zy,sc*(.55+.8*m),1.5,"#ffffff",.8*A*k2,"add");}
        else{const u=(t-.45)/.3;kPierscien(L,s.zx,s.zy,sc*(.3+1.6*u),3*(1-u)+.6,"#ffffff",.9*(1-u)*A*k2,"add");
          kPierscien(L,s.zx,s.zy,sc*(.3+1.6*u),7*(1-u)+1,FIOL,.5*(1-u)*A*k2,"normal");}}}
    if(fl.wybuch){const t=ts-s.impl;
      if(t>=0&&t<.3){const u=t/.3,r=sc*2.8*(1-u)+1;   // ciemniejsze barwy: żółć i biel giną na jasnej karcie
        kPierscien(L,s.zx,s.zy,r,10*(1-u)+3,ROZ,.3*A*k2,"normal");kPierscien(L,s.zx,s.zy,r,3.5,BURSZ,.95*A*k2,"normal");
        kPierscien(L,s.zx,s.zy,r,1.2,"#ffffff",.9*A*k2,"add");
        if(gl)kBlask(L,s.zx,s.zy,sc*(.15+.8*(1-u)),sc*(.15+.8*(1-u)),"#ffffff",.9*A,"add");}}
    if(fl.nowa){const t=ts-s.nowa;
      if(t>=0&&t<1.5){const u=t/1.5;
        if(gl){kBlask(L,hx,hy,sc*2.8*(1+u),sc*2.8*(1+u),BURSZ,.55*(1-u)*A,"normal");kBlask(L,hx,hy,sc*1.4,sc*1.4,"#fff3c0",.7*(1-u)*(1-u)*A,"add");}
        if(t<.14)kBlask(L,L.x+L.w/2,L.y+L.h/2,L.w/2,L.h/2,PAPIER,(gl?.25:.1)*(1-t/.14)*A,"add");}}
    if(og<1)return;
    // x0c: początek śladu przycięty do karty (ślad bywa dłuższy niż część karty przed linią „teraz”, a GPU nie przycina)
    const n=sladEkranu(L,g),dl=dlugSladu(L),x0=L.teraz-dl,x0c=Math.max(x0,L.x+3),lider=(g.nrWTorze||0)===0;
    // ---- 14 plazma w trybie lekkim (≥ 3 tory): nici helisy jako wstęgi GPU, ten sam wzór co wstegaPlazmy w 2D ----
    if(fl.plazma&&gl&&n>1&&lekki()){const amp=(og>=3?1.2:og>=2?1:.7)*(.8+.3*moc);
      for(let w=0;w<2;w++)nicGPU(n,w,x0,x0c,dl,L.teraz,ts,amp,og>=3?3.6:2.8,w?BLEK:ROZ,.6,A);}
    // chór: reszta żab toru dostaje tylko poświatę własnej wstęgi; łuki, kurtyny, dysk, pulsar i pola ma lider
    if(!lider){if(gl&&n>1)wstegaSladu(n,4,x0c,1e9,x0,dl,0,10,ROZ,.3*A,"normal",0);
      return;}
    // ---- 18–19: ciemne halo grawitacji pod żabą i nutami (pierwsze w kolejności „normal”, więc pod resztą światła) ----
    if(fl.dziura&&!fl.wybuch&&gl&&og>=2){kBlask(L,hx,hy,sc*3.6,sc*2.6,"#1c1230",.46*A,"normal");kBlask(L,hx,hy,sc*1.8,sc*1.4,"#120c1e",.55*A,"normal");}
    // ---- 14 plazma: poświata wstęgi, kula wokół głowy, łuki do najbliższych nut ----
    if(fl.plazma&&gl&&n>1)wstegaSladu(n,3,x0c,1e9,x0,dl,0,(og>=3?20:og>=2?15:10),ROZ,.42*A,"normal",(og>=3?6:5),BLEK,.45*A,"add");
    if(fl.plazma&&gl&&og>=2){kBlask(L,hx,hy,sc*1.6,sc*1.6,ROZ,.3*A,"normal");kBlask(L,hx,hy,sc*.8,sc*.8,BLEK,.35*A,"add");}
    if(fl.plazma){const ile=og>=3?(moc>=.97?3:2):1,N=nastepne(L,ile+(og>=2?2:0),3.4);przenik(ts,7);const t0=PT0,fr=PFR;
      // łańcuch po kolejnych nutach naprzód (od drugiego ogniwa cieńszy i bledszy)
      for(let j=1;j<N.length&&og>=2&&gl;j++){const a=N[j-1],b=N[j],ax=xBeat(L,a.t),ay=ySemi(L,a.m),bx=xBeat(L,b.t),by=ySemi(L,b.m);
        if(!gl&&ax<L.teraz+pas*1.6)continue;const dd=Math.hypot(bx-ax,by-ay);if(dd<8||bx>L.x+L.w-4)continue;
        const k=A*(gl?.75:.4)*(1-.18*j),z=(g.nrWTorze||0)*31+j*29;
        lukKolorowy(ax,ay,bx,by,t0,fr,z,Math.min(20,dd*.14),.85*k,j%2?BLEK:ROZ,2.4);}
      for(let j=0;j<Math.min(ile,N.length);j++){const u=N[j],nx=xBeat(L,u.t),ny=ySemi(L,u.m);
        let ax=hx+sc*.22,ay=hy-sc*.12;const dd=Math.hypot(nx-ax,ny-ay);if(dd<wysNuty(L)*1.5)continue;
        if(!gl){if(nx<L.teraz+pas*1.6)continue;ay=ay+(ny-ay)*((L.teraz+pas-ax)/(nx-ax));ax=L.teraz+pas;}
        const amp=Math.min(26,dd*.16),k=A*(gl?1:.5),z=(g.nrWTorze||0)*31+j*13;
        lukKolorowy(ax,ay,nx,ny,t0,fr,z,amp,.9*k,ROZ,gl?3.6:3);
        if(gl)lukKolorowy(ax,ay,nx,ny,t0,fr,z+5,amp*.8,.85*k,BLEK,2.2);}}
    {const t=ts-s.prog;   // wyładowanie po progu: krótki snop łuków z głowy w trzech kierunkach (przycięty do karty)
      if(fl.plazma&&gl&&t>=0&&t<.3){const k=(1-t/.3)*A;przenik(ts,7);const t0w=PT0,frw=PFR;
        for(let j=0;j<3;j++){const a=-PI/2+(los(s.prog*7+j)-.5)*2.4,dd=sc*(1.6+1.1*los(s.prog*3+j*5)),
          tb=tBrzegu(L,hx,hy,hx+Math.cos(a)*dd,hy+Math.sin(a)*dd);
          lukKolorowy(hx,hy,hx+Math.cos(a)*dd*tb,hy+Math.sin(a)*dd*tb,t0w,frw,j*11,dd*tb*.18,.9*k,j%2?BLEK:ROZ,2.6);}}}
    // ---- 15 smok: żar sypie się z grzbietu (unosi się, gaśnie) ----
    if(fl.smok&&og>=2&&n>1){s.iskr+=12*moc*st.dt*(gl?1:.25);
      while(s.iskr>=1){s.iskr--;const p=PKT[Math.floor(n*(.3+.65*Math.random()))];if(!p||!p.sp)continue;
        if(!gl&&Math.abs(p.x-L.teraz)<pas)continue;
        czastka(L,gl,p.x,p.y-2,-10+20*Math.random(),-40-50*Math.random(),-25,1.5,.8+.5*Math.random(),1.2+1.1*Math.random(),
          Math.random()<.5?BURSZ:ZOLTY,"kolo","add",.9,0);}}
    if(fl.smok&&og>=2&&gl){s.oddech=(s.oddech||0)+60*moc*st.dt;
      while(s.oddech>=1){s.oddech--;const a=(Math.random()-.5)*.3,v=260+200*Math.random(),j=Math.random()*4|0;
        czastka(L,gl,hx+sc*.62,hy-sc*.05,Math.cos(a)*v,Math.sin(a)*v-10,-40,2.2,.4+.25*Math.random(),sc*(.07+.06*Math.random()),
          K_ODDECH[j],j===3?"iskra":"kolo",j===3?"add":"normal",.75,3);}}
    // ---- 16 fala: pierścień ładunku na każdą ćwierćnutę ----
    if(fl.fala){const u=st.faza,r=(.7+1.5*u)*sc*(.9+.2*moc),a=.5*Math.pow(1-u,1.5)*A*k2;
      kPierscien(L,hx,hy,r,6*(1-u)+2,BLEK,.35*a,"normal");kPierscien(L,hx,hy,r,1.6*(1-u)+.8,"#ffffff",a,"add");
      const u2=gl?ulamek(st.beat/2):1,r2=sc*.8+u2*Math.min(L.w*.48,sc*9),a2=gl?.3*Math.pow(1-u2,1.4)*A*k2:0;   // sonar tylko z WebGL2
      kPierscien(L,hx,hy,r2,10*(1-u2)+3,BLEK,.32*a2,"normal",4);kPierscien(L,hx,hy,r2,2.2*(1-u2)+.8,g.kolor||BLEK,.8*a2,"normal");}
    // ---- 17 zorza: kurtyny za śladem, przyklejone do siatki beatów (płyną razem ze śladem), gwiazdki w kurtynach ----
    if(fl.zorza&&n>1&&typeof S!=="undefined"&&S.gra){
      const G=S.gra,krok=gl?8:4,b0=Math.floor(G.beat*krok)/krok,xmax=L.teraz-sc*.7,kz=gl?1:.5,hMax=Math.min(110,L.h*.42);
      for(let j=1;j<400;j++){const b=b0-j/krok,x=xBeat(L,b);if(x>xmax)continue;if(x<Math.max(x0c+6,x0+dl*.08))break;
        const y=ySladu(PKT,n,x);if(y==null)continue;
        const f=(x-x0)/dl,idx=Math.round(b*krok),H=hMax*(.35+.65*szum(idx*.37+ts*.3))*(.45+.55*f)*ogf*(.8+.25*moc);
        const kk=(.3+.7*f)*A*kz,sw=Math.sin(ts*.8+idx*.5)*5;
        kBlask(L,x,y-H*.3,8.5,H*.36,ZIEL,.78*kk,"normal");if(gl)kBlask(L,x+sw,y-H*.8,10,H*.52,j%3?ROZ:FIOL,.48*kk,"normal");}
      if(gl)wstegaSladu(n,3,Math.max(x0c,x0+dl*.08),xmax,x0,dl,-1,3.2,LIM,.75*A,"add",0);
      const bz=Math.floor(G.beat*2)/2;
      for(let i=0;i<(gl?10:3);i++){const b=bz-i*.37-.2,x=xBeat(L,b);if(x>xmax||x<x0+dl*.1)continue;const y=ySladu(PKT,n,x);if(y==null)continue;
        const idx=Math.round(b*100),tw=.5+.5*Math.sin(ts*2.4+idx*1.9),sy=y-hMax*(.2+.6*los(idx*5.1))*ogf;if(!wKarcie(L,x,sy,4))continue;
        FX.sprite(x,sy,3+2*los(idx),ZOLTY,.95*tw*A*kz,0,"gwiazda","normal");FX.sprite(x,sy,1.5,"#ffffff",tw*A*kz,0,"kolo","add");}
    }
    // ---- 18 czarna dziura: dysk z cząstek na orbitach (spiralny opad, wewnątrz biel, dalej fiolet i róż),
    //      poświata nut ciągnięta ku głowie ----
    if(fl.dziura&&gl){
      const N=Math.round(54*moc*ogf),T=czasRytmu(ts),cs=Math.cos(-.2),sn=Math.sin(-.2),Rin=sc*.7,Rout=sc*1.9*(.9+.2*moc),dy=sc*.02;
      for(let i=0;i<N;i++){const q=ulamek(los(i*3.1)-T*.06),r=Rin+(Rout-Rin)*q,a=los(i*7.7)*TAU+T*(1.6/Math.pow(.35+q,1.5));
        const ex=Math.cos(a)*r,ey=Math.sin(a)*r*.3,x=hx+ex*cs-ey*sn,y=hy+dy+ex*sn+ey*cs;if(!wKarcie(L,x,y,3))continue;
        const al=gladko(0,.12,q)*(1-gladko(.85,1,q))*A,rr=(1.4+2.4*(1-q))*sc/36;
        if(q<.25)FX.sprite(x,y,rr*1.3,"#ffffff",.95*al,0,"kolo","add");
        else FX.sprite(x,y,rr,q<.6?FIOL:ROZ,(q<.6?.85:.7)*al,0,"kolo","normal");}
      kBlask(L,hx,hy+dy,Rout*1.05,Rout*.36,FIOL,.28*A,"normal");
      const Nn=nastepne(L,3,2.4);
      for(let j=0;j<Nn.length;j++){const u=Nn[j],nx=xBeat(L,u.t),ny=ySemi(L,u.m);
        pkt3(0,nx,ny,10);pkt3(1,(nx+hx)/2,(ny+hy)/2+(nx-hx)*.12,5);pkt3(2,hx+sc*.5,hy,1.5);FX.wstega(P3,6,FIOL,.55*A,0,"normal");}
    }
    // ---- 19 supernowa: pulsar, dwie wiązki obracają się raz na 8 ćwierćnut (przycięte do karty) ----
    if(fl.nowa&&gl&&og>=2){const fi=st.beat/8*TAU+(g.nrWTorze||0)*1.1,Lb=Math.hypot(L.w,L.h);
      for(let b=0;b<2;b++){const a=fi+b*PI,bx=hx+Math.cos(a)*Lb,by=hy+Math.sin(a)*Lb*.8,tb=tBrzegu(L,hx,hy,bx,by);
        if(tb<.15)continue;const ex=hx+(bx-hx)*tb,ey=hy+(by-hy)*tb;
        const dlw=Math.hypot(ex-hx,ey-hy),gk=Math.min(28,6+dlw*.04);
        pkt3(0,hx,hy,3);pkt3(1,(hx+ex)/2,(hy+ey)/2,gk*.55);pkt3(2,ex,ey,gk);FX.wstega(P3,6,BLEK,.32*A,0,"normal");
        pkt3(0,hx,hy,1.2);pkt3(1,(hx+ex)/2,(hy+ey)/2,2.4);pkt3(2,ex,ey,4);FX.wstega(P3,2,"#ffffff",.6*A,0,"add");}}
    // ---- 20 Wielki Wybuch: słońce, warkocz galaktyczny wzdłuż śladu, tryb nadświetlny ----
    if(fl.wybuch){
      if(gl&&og>=2){kBlask(L,hx,hy,sc*3,sc*3,ZOLTY,.38*A,"normal");kBlask(L,hx,hy,sc*1.2,sc*1.2,"#fff6d0",.55*A,"add");}
      if(gl&&g===L.tor.gracze[0]){const M=Math.round(40*moc*ogf),v=(typeof S!=="undefined"&&S.gra?S.gra.bpm:120)/120,KP=K_PYL;
        for(let i=0;i<M;i++){const x=L.x+4+ulamek(los(i*1.37)-ts*v*(.012+.02*los(i*4.1)))*(L.w-8),y=L.y+4+(L.h-8)*los(i*3.1+.7);
          const tw=.55+.45*Math.sin(ts*(.8+.9*los(i*2.3))+i);
          FX.sprite(x,y,1.2+1.8*los(i*5.9),KP[i%4],(.22+.3*tw)*A,ts*.3+i,i%5===0?"gwiazda":"kolo","normal");}}
      if(n>1){const N=Math.round(54*moc*ogf*(gl?1:.25)),K=K_WARK;
        for(let i=0;i<N;i++){const p=ulamek(los(i*5.3)+ts*.07),x=x0+p*dl;if(x<x0c||!gl&&Math.abs(x-L.teraz)<pas)continue;
          const y0=ySladu(PKT,n,x);if(y0==null)continue;
          const fi=(L.teraz-x)/46*TAU-ts*1.6+(i%3)*TAU/3,gl2=.5+.5*Math.cos(fi),y=y0+(4+13*p)*(.9+.2*moc)*Math.sin(fi);
          if(!wKarcie(L,x,y,3))continue;
          const a=(.5+.5*gl2)*(.65+.35*Math.sin(ts*2.2+i))*gladko(0,.15,p)*A*(gl?1:.5),k=K[i%4];
          FX.sprite(x,y,(1.5+3.4*p)*(.65+.35*gl2),k,a,i*.7,i%3===0?"gwiazda":"kolo","normal");
          if(gl2>.75&&i%2===0)FX.sprite(x,y,(.8+1.4*p),"#ffffff",a,0,"kolo","add");}}
      if(s.warp>.02){const M=Math.round(30*s.warp),bpm=(typeof S!=="undefined"&&S.gra?S.gra.bpm:120)/120,KW=[BLEK,FIOL,ROZ];
        for(let j=0;j<M;j++){const y=L.y+8+(L.h-16)*los(j*7.31+.5),v=(800+1000*los(j*3.7))*bpm,len=(100+260*los(j*1.9))*s.warp;
          const ph=ulamek(ts*v/(L.w+len)+los(j*9.1)),xa=Math.max(L.x+2,L.x+L.w-ph*(L.w+len)),xb=Math.min(L.x+L.w-2,xa+len);if(xb-xa<4)continue;
          const a=.34*A*(gl?1:.5);
          if(!gl&&xb>L.teraz-pas&&xa<L.teraz+pas){if(xa<L.teraz-pas)FX.wstega([xa,y,L.teraz-pas,y],1.8,KW[j%3],a,a*.3,"normal");
            if(xb>L.teraz+pas)FX.wstega([L.teraz+pas,y,xb,y],1.8,KW[j%3],a*.6,0,"normal");continue;}
          FX.wstega([xa,y,xb,y],1.8,KW[j%3],a,0,"normal");}}
    }
  }

  function tor(c,L,g,st,W,fl){
    if(!L||!g||!st||!L.tor)return;
    const s=stanGracza(g),ts=st.ts,gl=!!st.gl,fxOk=fxJest(),moc=mocW(W),T=stanToru(L);
    const pz=typeof pozycjaZaby==="function"?pozycjaZaby(L,g):{x:L.teraz,y:L.y+L.h/2};
    s.sc=L.zaba*(g.naNucie?1.15:g.spiewa?1.1:1)*110/96;s.fx=pz.x;s.fy=pz.y;s.teraz=st.teraz;s.L=L;
    poKluczu.set(kluczSladu(g.kolor,(g.nrWTorze||0)*31,L.teraz),s);
    if(ostKlatka!==st.teraz){ostKlatka=st.teraz;krokCzastek(st.dt);}
    s.wyg=wygl(s.wyg,st.wyniki?0:1,st.dt,.3);
    const k=g.kombo|0,co=coKombo(),prz=s.kombo;
    if(k>prz&&!st.wyniki){
      if(Math.floor(k/(3*co))>Math.floor(prz/(3*co)))prog(L,g,s,st,fl,moc,T,true);
      if(Math.floor(k/co)>Math.floor(prz/co))prog(L,g,s,st,fl,moc,T,false);
    }
    s.kombo=k;
    if(fl.wybuch)s.warp=wygl(s.warp,k>=NADSWIETLNY&&!st.wyniki?1:0,st.dt,.45);
    const gr=L.tor.gracze||[g],pierwszy=gr[0]===g,ostatni=gr[gr.length-1]===g;
    const cisza=fl.wybuch&&ts>=s.impl+.3&&ts<s.ciszaDo;   // po implozji 0,3 s ciszy: żaba bez efektów
    C2D=gl?null:c;KLIP=!!(gl&&fxOk&&typeof FX.klip==="function");
    if(KLIP)FX.klip(L.x+2,L.y+2,L.w-4,L.h-4,14);   // ten sam prostokąt co przycięcie karty w rysujTor
    try{
      if(fxOk&&s.wyg>.01&&!cisza)emituj(L,g,s,st,fl,moc,gl);
      if(pierwszy&&fxOk)rysujToru(L,st,T);
    }finally{if(KLIP)FX.klip();KLIP=false;C2D=null;}
    // kopia płótna sceny tylko z akceleracją (WebGL2 działa) i przy 1–2 torach: przy czterech torach cztery migawki
    // płótna na klatkę to za dużo dla zintegrowanego GPU, a fala i tak widać po pierścieniach
    if(ostatni&&fl.fala&&T.fale.length&&gl&&!lekki())przesunNuty(c,L,st,T);
  }
  // Zerwanie kombo: plazma gaśnie iskrami i ciemnym dymkiem (14–17), dysk zapada się do horyzontu (18–19),
  // Wielki Wybuch zapada się w punkt (cała materia śladu ściągnięta do głowy) i milknie na 0,3 s (20).
  function zerwanie(L,g,st,W,fl){
    if(!L||!g||!st||!L.tor||st.wyniki)return;
    const s=stanGracza(g),ts=st.ts,gl=!!st.gl,moc=mocW(W),sc=L.zaba*110/96;
    const pz=typeof pozycjaZaby==="function"?pozycjaZaby(L,g):{x:L.teraz,y:L.y+L.h/2},hx=pz.x,hy=pz.y-sc*.08;
    s.kombo=0;s.zx=hx;s.zy=hy;
    if(fl.wybuch){s.impl=ts;s.ciszaDo=ts+.6;
      // implozja zabiera wszystko: cząstki toru (odłamki, gwiazdy) też lecą do punktu i gasną w 0,5 s
      for(let i=0;i<nCz;i++){const p=CZ[i];if(p.t===L.tor){p.cx=hx;p.cy=hy;p.przyc=4200;p.op=3;p.tl=Math.exp(-3*KROK);p.yc=null;p.ax=0;p.ay=0;p.zycie=Math.min(p.zycie,p.wiek+.5);}}
      const n=sladEkranu(L,g),krok=Math.max(1,Math.floor(n/48));
      for(let i=0;i<n;i+=krok){const p=PKT[i];if(!p.sp)continue;
        const q=czastka(L,gl,p.x,p.y,0,0,0,3,.5,1.4+1.4*Math.random(),K_IMPL[i%4],"iskra","add",1,0);
        if(!q)break;q.cx=hx;q.cy=hy;q.przyc=5200*(.8+.4*moc);}
      return;}
    if(fl.dziura){s.zapad=ts;
      for(let i=0;i<30;i++){const a=i/30*TAU,r=sc*(1.1+.6*Math.random()),x=hx+Math.cos(a)*r,y=hy+Math.sin(a)*r*.3;
        const q=czastka(L,gl,x,y,-Math.sin(a)*160,Math.cos(a)*50,0,2,.55,1.3+1.2*Math.random(),i%3?FIOL:"#ffffff","kolo",i%3?"normal":"add",1,0);
        if(!q)break;q.cx=hx;q.cy=hy;q.przyc=2600;}
      return;}
    iskry(L,hx,hy-sc*.1,Math.round(10+8*moc),gl,K_GAS,60,200,-PI/2,PI*1.6,380,1.6,.7);
    for(let i=0;i<5;i++)czastka(L,gl,hx+(Math.random()-.5)*sc*.6,hy-sc*.3,-12+24*Math.random(),-30-30*Math.random(),-8,1.2,.9+.4*Math.random(),
      sc*(.18+.12*Math.random()),TUSZ,"kolo","normal",.32,1);
  }

  // =========================================================================================== stopnie i drabinka
  // Cięcie 10-05: każdy stopień ma tylko swoją sygnaturę (flaga z id, bez kumulacji niższych). Zorza i Wielki Wybuch
  // wypadły z drabinki (zorza = cecha tła, wybuch = „wszystko naraz”), ich gałęzie (fl.zorza, fl.wybuch) nie są już
  // włączane przez żaden wpis.
  const flagi=id=>({plazma:id==="plazma",smok:id==="smok",fala:id==="fala",zorza:false,dziura:id==="dziura",nowa:id==="supernowa",wybuch:false});
  // Bufory i języki ognia powstają przed piosenką (gra woła rozgrzej po układzie), nie w klatce
  // pierwszego kombo, kiedy gra planuje dźwięk.
  function rozgrzej(fl,W){
    if(typeof bufor!=="function")return;
    try{
      kulaSzkla();blysk();for(const k of [PAPIER,ROZ,BLEK,ZOLTY,...(W.aura||[])])blask(k);
      if(fl.smok)for(let k=0;k<6;k++)jezyk(k);
      if(fl.zorza)promienZorzy();
      if(fl.wybuch)tarczaSlonca();
    }catch(e){console.warn("RibbitBeat: rozgrzewka streaka",W.id,e);}
  }
  function stopien(n,id,nazwa,cecha,opis,kolory){
    const fl=flagi(id),W=Object.assign({stopien:n,id,nazwa,cecha,prestiz:5,opis,wypelnienie:null,scena:null,tlo:null},kolory);
    W.glowa=(c,sc,og,ts,z,przod)=>glowa(c,sc,og,ts,z,przod,W,fl);
    W.slad=(c,k)=>slad(c,k,W,fl);
    W.nuty=(c,w,nh,fx,p,ts,z,a,g)=>nuty(c,w,nh,fx,p,ts,z,a,g,W,fl);
    W.tor=(c,L,g,st)=>tor(c,L,g,st,W,fl);
    W.zerwanie=(L,g,st)=>zerwanie(L,g,st,W,fl);
    W.rozgrzej=()=>rozgrzej(fl,W);
    return W;
  }
  const NOWE=[
    stopien(7,"plazma","Plazma","kula plazmy i łuki","Głowa w kuli plazmy, łuki elektryczne skaczą do najbliższej nuty, a ślad to skręcona wstęga plazmy.",
      {aura:[ROZ,BLEK],wypelnienie:[PAPIER,"#ff9ad5",BLEK],iskry:{kolory:["#ff6ec7",BLEK,FIOL]},dym:false,
       scena:["236,26,131","91,140,255","142,111,230"],tlo:{promienie:[["236,26,131",.6],["91,140,255",.5]],swiatlo:["255,170,230","91,140,255"]}}),
    stopien(8,"smok","Smok","paszcza i ciało smoka","Śpiewasz z paszczy smoka. Jego ciało wije się za Tobą, a na każdym progu kombo smok ryczy iskrami.",
      {aura:[KARM,BURSZ],wypelnienie:[ZOLTY,BURSZ,KARM],iskry:{kolory:[ZOLTY,BURSZ,KARM]},dym:"#3a2a2a",
       scena:["255,190,60","236,90,40","184,38,74"],tlo:{promienie:[["234,163,43",.6],["184,38,74",.5]],swiatlo:["255,200,110","236,26,131"]}}),
    stopien(9,"fala","Fala uderzeniowa","fala podrzuca nuty","Na każdym progu kombo fala uderzeniowa przelatuje przez cały tor i podrzuca nuty.",
      {aura:[BLEK,ROZ],wypelnienie:[PAPIER,BLEK,ROZ],iskry:{kolory:[BLEK,ROZ,FIOL]},dym:"#2e2a3a",
       scena:["170,200,255","236,26,131","41,74,168"],tlo:{promienie:[["91,140,255",.6],["236,26,131",.45]],swiatlo:["210,225,255","236,26,131"]}}),
    stopien(10,"dziura","Czarna dziura","dysk akrecyjny","Głowa w czarnej dziurze z dyskiem akrecyjnym. Nuty ciągną ku niej poświatę, a po zerwaniu kombo dysk się zapada.",
      {aura:[FIOL,ROZ],wypelnienie:[PAPIER,FIOL,ROZ],iskry:{kolory:[FIOL,ROZ,"#5a2aa0"]},dym:"#1e1a2a",
       scena:["142,111,230","236,26,131","33,31,29"],tlo:{promienie:[["142,47,208",.6],["236,26,131",.45]],swiatlo:["220,200,255","90,40,160"]}}),
    stopien(11,"supernowa","Supernowa","wybuch gwiazdy","Co 12 nut kombo gwiazda wybucha: błysk, odłamki i potrójna fala. Między wybuchami wirują wiązki pulsara.",
      {aura:[ZOLTY,BLEK],wypelnienie:[PAPIER,ZOLTY,BLEK],iskry:{kolory:[ZOLTY,BLEK,ROZ],ksztalt:"gwiazda"},dym:"#1e1a2a",
       scena:["255,236,150","91,140,255","142,111,230"],tlo:{promienie:[["255,216,74",.6],["91,140,255",.5]],swiatlo:["255,250,225","91,140,255"]}})];
  // Stopnie 1–6: wskaźniki na style z efekty.js (gra dobiera rysowanie z Efekty.streak(id)). Cięcie 10-05: zostały
  // tylko style o własnej sygnaturze; niebieski, złoty i piekielny płomień (sam kolor ognia), gwiazdy, piorun, kometa
  // i laser (bliźniaki konfetti, plazmy, neonu i supernowej) zostają w katalogu, ale nie w drabince.
  const WSKAZNIKI=[["ogien","Ogień","płonąca głowa"],["pixel","Pixel","ogień z kwadratów"],["konfetti","Konfetti","fontanna konfetti"],
    ["raca","Raca","kolorowy dym"],["neon","Neon","smuga światła"],["kwas","Kwas","bąble i kapanie"]];
  const DRABINKA=[...WSKAZNIKI.map(([id,nazwa,cecha],i)=>({stopien:i+1,id,nazwa,cecha})),...NOWE];
  try{if(typeof Efekty!=="undefined"&&Efekty&&typeof Efekty.zarejestrujStreaki==="function")Efekty.zarejestrujStreaki(NOWE);}
  catch(e){console.error("RibbitBeat: rejestracja stopni streaka",e);}
  return {DRABINKA,reset};
})();
