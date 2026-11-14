// RibbitBeat: maszyna losująca nagród. Dwa mechanizmy o wspólnym API (wymagania: poziomy pasek zamiast koła,
// bez wielu takich samych rzeczy obok siebie, moc losowania narasta wizualnie i dźwiękiem podczas trzymania;
// w klimacie aplikacji, spójnie, satysfakcjonująco, płynnie, bez rezygnacji z grafik):
//   • Kolo.utworz(rodzic): POZIOMY PASEK kart rzeczy pod stałym złotym znacznikiem. Spoczynek = karty płyną powoli w pętli; moc (trzymany
//     przycisk) naciąga pasek w prawo jak procę, trzęsie ramą i rozświetla; puszczenie = wystrzał w lewo, długie hamowanie, pstryknięcie grotu
//     o każdą kartę, zatrzask na wylosowanej (sprężyna z przeregulowania). Im większa moc, tym dłuższy przejazd; wynik zapada WCZEŚNIEJ w
//     Postepy.losuj, pasek go tylko pokazuje. Kolejność kart: ta sama karta nigdy obok siebie (okno kilku sąsiadów).
//   • Kolo.utworzKolo(rodzic, rozmiar): OKRĄGŁE koło kategorii (canvas) z samymi ikonami w segmentach, strzałką wyłaniającą się spod czarnej
//     obręczy po prawej i oknem odczytu (pionowa lista nazw przewijana razem z tarczą). Kręci się zgodnie ze wskazówkami, moc naciąga je w
//     drugą stronę.
// Wydajność (runda 8, „żeby się nie cięło”): pasek rusza wyłącznie transform-em toru (kompozytor), bez wymuszonego układu (offsetWidth) i bez
// przełączania klas kart w czasie jazdy (światło pod znacznikiem to stały element); pstryk grotu przez WAAPI; drżenie ramy jedną animacją CSS
// dobraną progiem mocy (data-moc), nie losowym transform-em co klatkę. Koło: tarcza (segmenty, kreski) narysowana raz do bufora, co klatkę tylko
// obrót bufora i 2–3 ikony stojące prosto; żarówki z gotowych sprite'ów (bez shadowBlur); w spoczynku 30 kl/s, po wygranej 8 kl/s przez 3 s,
// potem stop. Obrazki kart dekodowane przed jazdą (img.decode), żeby nie było przycięcia w połowie przejazdu.
// Ładowany przed nagrody.js. Segment: {etykieta, rodzaj? („skin” / „scena” pod nazwą karty paska), obraz (url|null), obrazKlasa?, rzadkosc (zwykly|rzadki|epicki|legendarny|null), kolor, id}.
// API paska: ustawSegmenty(seg) → Promise (obrazki gotowe), dolacz(seg1) → indeks (bez przebudowy), krec(indeks,{czas,dystans}) → Promise, bezczynnie(tak), moc(p 0..1), wejscie(),
//   zatrzymajOdRazu(), zniszcz(), wygranaKarta() (element karty po zatrzasku, do „otwierania”), segmentow, ramka.
// API koła: ustawSegmenty, moc, krec(indeks,{czas,obroty}), bezczynnie, zatrzymajOdRazu, zniszcz, segmentow.
const Kolo=(function(){
  "use strict";
  const KOLORY={zwykly:"#b8a88a",rzadki:"#3d8fd6",epicki:"#8c5bd6",legendarny:"#eaa32b"};
  const SZER=116,ODSTEP=10,KROK=SZER+ODSTEP;
  // Wibracja („haptic feedback”): telefon przez navigator.vibrate, pad przez vibrationActuator; nie częściej niż co 40 ms.
  let ostWib=0;
  function wibruj(ms,sila){
    const t=performance.now();if(t-ostWib<40)return;ostWib=t;
    try{if(navigator.vibrate)navigator.vibrate(Math.round(ms));}catch(e){}
    try{const pady=navigator.getGamepads?navigator.getGamepads():[];
      for(const g of pady)if(g&&g.vibrationActuator&&g.vibrationActuator.playEffect)g.vibrationActuator.playEffect("dual-rumble",{duration:Math.round(ms),strongMagnitude:Math.min(1,sila),weakMagnitude:Math.min(1,sila*.6)}).catch(()=>{});}catch(e){}
  }
  const spokoj=()=>{try{return typeof ruchOgraniczony==="function"&&ruchOgraniczony();}catch(e){return false;}};
  const el=(t,k,x)=>{const e=document.createElement(t);if(k)e.className=k;if(x!=null)e.textContent=x;return e;};
  const cykaj=(p,g)=>{try{if(typeof Glos!=="undefined"&&Glos.cyk)Glos.cyk(p,g);}catch(e){}};
  const dzwonek=w=>{try{if(typeof Glos!=="undefined"&&Glos.dzwonek)Glos.dzwonek(w);}catch(e){}};
  // Obrazki zdekodowane z góry (najdłużej `ms`): dekodowanie w środku jazdy to widoczne przycięcie.
  function dekoduj(imgs,ms){
    const ps=[];for(const i of imgs)if(i.decode&&!i.complete)ps.push(i.decode().catch(()=>{}));
    if(!ps.length)return Promise.resolve();
    return Promise.race([Promise.all(ps),new Promise(r=>setTimeout(r,ms||600))]);
  }
  const poziomMocy=m=>m>=1?"max":m>.82?"mocno":m>0?"rosnie":"0";

  // Ciąg indeksów kart długości n: bez powtórzeń w oknie `okno` sąsiadów; karta `indeks` stoi na miejscu `cel` i nie sąsiaduje ze sobą.
  function sekwencja(ile,n,indeks,cel,stale){
    const wyn=[],okno=Math.min(4,Math.max(0,ile-1)),st=stale||{};
    let worek=[];
    const losuj=zakaz=>{
      if(!worek.length)worek=[...Array(ile).keys()].sort(()=>Math.random()-.5);
      for(let i=0;i<worek.length;i++)if(!zakaz.has(worek[i]))return worek.splice(i,1)[0];
      const dozw=[...Array(ile).keys()].filter(k=>!zakaz.has(k));
      return dozw.length?dozw[Math.floor(Math.random()*dozw.length)]:Math.floor(Math.random()*ile);
    };
    for(let i=0;i<n;i++){
      if(i===cel){wyn.push(indeks);continue;}
      if(st[i]!=null&&(i===0||st[i]!==wyn[i-1])){wyn.push(st[i]);continue;}   // karta, która już jest na ekranie (płynny start)
      const zakaz=new Set(wyn.slice(Math.max(0,i-okno)));
      if(Math.abs(i-cel)<=okno)zakaz.add(indeks);   // zwycięzca ma w okolicy tylko inne karty
      wyn.push(losuj(zakaz));
    }
    return wyn;
  }

  const CEL=6;   // numer karty, na której staje wylosowana (z lewej zostaje kilka kart, z prawej cała jazda)
  function utworz(rodzic){
    const rama=el("div","kolo-h"),okno=el("div","kolo-h-okno"),tor=el("div","kolo-h-tor"),swiatlo=el("i","kolo-h-swiatlo");
    const znacznik=el("div","kolo-h-znacznik"),grot=el("i","kolo-h-grot");znacznik.append(grot,el("i","kolo-h-kolek"));
    okno.append(tor,swiatlo,znacznik);rama.append(okno);rodzic.append(rama);   // lampki ma szafka (nagrody.js), nie każde okno osobno
    rama.setAttribute("aria-hidden","true");rama.dataset.stan="idle";rama.dataset.moc="0";
    let seg=[],ciag=[],zywe=true,aktywna=null,xb=0,xd=0,raf=0,idle=false,mocW=0,tl=0,ostPod=null,gotowe=Promise.resolve(),animGrot=null,celIdx=-1;
    const wzorce=new Map();   // karta każdego segmentu zbudowana raz, do toru idą klony (tańsze niż budowa od zera przy 40–70 kartach)
    const szerOkna=()=>okno.clientWidth||520;
    const srodek=i=>i*KROK+SZER/2;
    const ustawX=v=>{xd=v;tor.style.transform="translate3d("+(-v)+"px,0,0)";};
    const stan=s=>{rama.dataset.stan=s;};
    function karta(s,idx){
      const w=wzorce.get(idx);if(w)return w.cloneNode(true);
      const k=zbudujKarte(s,idx);wzorce.set(idx,k);return k.cloneNode(true);
    }
    function zbudujKarte(s,idx){
      const k=el("div","kolo-h-karta rz-"+(s.rzadkosc||"kat"));k.dataset.i=String(idx);
      if(s.kolor)k.style.setProperty("--kolor",s.kolor);
      const tresc=el("div","kolo-h-tresc");
      if(s.obraz){const im=el("img","kolo-h-obraz"+(s.obrazKlasa?" "+s.obrazKlasa:""));im.src=s.obraz;im.alt="";im.draggable=false;im.decoding="async";tresc.append(im);}
      if(s.etykieta)tresc.append(el("span","kolo-h-etykieta"+(s.obraz?" maly":"")+(s.sekret?" pyt":""),s.etykieta));   // sekret: wielki „?” (10-17)
      if(s.rodzaj&&!s.sekret)tresc.append(el("span","kolo-h-rodzaj","· "+s.rodzaj));   // 10-18: „Sushi” + „· skin” / „· scena” (para nazw skina i sceny)
      k.append(tresc);
      if(s.rzadkosc){   // spód karty w kolorze rzadkości, na nim 1–4 iskierki (zwykły … legendarny)
        const n={zwykly:1,rzadki:2,epicki:3,legendarny:4,sekretny:5}[s.rzadkosc]||1,pas=el("span","kolo-h-pasek");
        for(let i=0;i<n;i++)pas.append(el("i","kolo-h-iskra"));
        k.append(pas);
      }
      return k;
    }
    function zbudujTor(c){ciag=c;tor.replaceChildren(...c.map(j=>karta(seg[j],j)));ostPod=null;gotowe=dekoduj(tor.querySelectorAll("img"),600);}
    function wyczyscMoc(){idle=false;mocW=0;rama.style.removeProperty("--moc");rama.style.removeProperty("--tempo");rama.dataset.moc="0";}
    function ustawSegmenty(s){
      seg=s||[];wyczyscMoc();stan("idle");celIdx=-1;rama.classList.remove("wygrana");rama.dataset.rz="";wzorce.clear();
      const ile=seg.length;if(!ile){tor.replaceChildren();gotowe=Promise.resolve();return gotowe;}
      // spoczynek: pętla kilku kopii puli (każda w losowej kolejności, bez tej samej karty na styku kopii)
      const kopie=Math.max(2,Math.ceil(12/ile)),c=[];
      for(let k=0;k<kopie;k++){const perm=[...Array(ile).keys()].sort(()=>Math.random()-.5);
        if(k&&ile>1&&perm[0]===c[c.length-1])perm.push(perm.shift());c.push(...perm);}
      zbudujTor(c);tor.dataset.kopie=String(kopie);
      xb=srodek(ile)-szerOkna()/2;ustawX(xb);
      return gotowe;
    }
    // ---- spoczynek i moc: naciąg w prawo (jak proca), drżenie toru przy końcu; drżenie ramy robi CSS wg data-moc ----
    const pod=x=>Math.round((x+szerOkna()/2-SZER/2)/KROK);
    function petla(now){
      if(!zywe)return;
      const dt=Math.min(.05,(now-tl)/1000||0);tl=now;
      if(aktywna){raf=0;return;}
      if(idle&&mocW===0){   // powolny dryf w lewo, zawinięty co jedną kopię
        const kopie=+tor.dataset.kopie||1,pol=ciag.length/kopie*KROK,start=srodek(seg.length)-szerOkna()/2;
        xb+=20*dt;if(xb>start+pol)xb-=pol;
      }
      let x=xb;
      if(mocW>0){const pull=Math.pow(mocW,1.6)*210,drz=Math.pow(mocW,4)*18;x=xb-pull+(Math.random()-.5)*drz;}
      ustawX(x);
      const i=pod(x);if(i!==ostPod){ostPod=i;if((idle||mocW>0)&&mocW>.05){cykaj(.2+mocW*.6,.7);pstryk(1,.5+mocW*.5);wibruj(10+mocW*14,.2+mocW*.5);}}
      if(idle||mocW>0)raf=requestAnimationFrame(petla);else raf=0;
    }
    function start(){if(!raf&&zywe){tl=performance.now();raf=requestAnimationFrame(petla);}}
    function bezczynnie(tak){idle=!!tak;if(idle)start();}
    let ostMocCss="";
    function moc(p){
      mocW=Math.max(0,Math.min(1,+p||0));
      const q=mocW.toFixed(2);   // zmienne CSS tylko przy zmianie o 1/100: każdy zapis to przeliczenie stylów całej ramy (40 żarówek z animacją)
      if(q!==ostMocCss){ostMocCss=q;rama.style.setProperty("--moc",q);rama.style.setProperty("--tempo",(.8-.68*mocW).toFixed(2)+"s");rama.dataset.moc=poziomMocy(mocW);}
      stan(mocW>0?"laduje":"idle");
      if(mocW>0)start();
    }
    // pstryk grotu: karta trąca grot i odchyla go w stronę swojego ruchu (jazda w lewo = w lewo, naciąg w prawo = w prawo), sprężyna wraca
    function pstryk(kier,sila){const k=(kier||-1)*(sila==null?1:sila);if(animGrot)animGrot.cancel();
      try{animGrot=grot.animate([{transform:"rotate("+(-16*k).toFixed(1)+"deg)"},{transform:"rotate("+(5*k).toFixed(1)+"deg)",offset:.62},{transform:"none"}],{duration:190,easing:"ease-out"});}catch(e){animGrot=null;}}
    // ---- losowanie: wystrzał w lewo z miejsca, do którego naciągnęła moc ----
    function krec(indeks,op){
      const opc=op||{};
      if(aktywna)aktywna.koniec();
      return new Promise(res=>{
        if(!seg.length){res(indeks);return;}
        cancelAnimationFrame(raf);raf=0;
        const sz=szerOkna(),dystans=Math.max(14,opc.dystans||34),cel=CEL+dystans,dlugosc=cel+8;
        // karty widoczne w chwili puszczenia zostają na ekranie, więc start jest płynny (bez przeskoku paska)
        const stale={};let off=0;
        if(ciag.length){const c=pod(xd);off=(xd+sz/2)-srodek(c);
          for(let d=-4;d<=4;d++){const j=ciag[c+d];if(j!=null&&CEL+d>=0)stale[CEL+d]=j;}}
        wyczyscMoc();zbudujTor(sekwencja(seg.length,dlugosc,indeks,cel,stale));celIdx=cel;
        rama.classList.remove("wygrana");rama.dataset.rz="";stan("krec");
        const x0=srodek(CEL)-sz/2+off,docel=srodek(cel)-sz/2,przereg=docel+KROK*.14;   // koniec zawsze dokładnie na środku karty
        const dl=spokoj()?1:(opc.czas||5200);
        let skonczone=false,ostTik=0,ost=null,t0=0;
        ustawX(x0);
        const koniec=()=>{
          if(skonczone)return;skonczone=true;aktywna=null;cancelAnimationFrame(raf);raf=0;ustawX(docel);xb=docel;ostPod=null;
          const k=tor.children[cel];if(k){k.classList.add("wygrana");k.classList.remove("wskok");void k.offsetWidth;k.classList.add("wskok");}   // 10-18: karta wskakuje na miejsce (uderzenie zatrzasku)
          rama.classList.add("wygrana");rama.dataset.rz=seg[indeks].rzadkosc||"";stan("wygrana");
          res(indeks);
        };
        // zatrzask: po głównym przejeździe pasek wraca z przeregulowania na środek karty (sprężyna 280 ms) i cyka
        const zatrzask=now0=>{
          const a=xd,t1=now0;let sg=Math.sign(a-docel);
          const krokZ=now=>{
            if(skonczone||!zywe)return;
            const f=Math.min(1,(now-t1)/520),m=Math.exp(-6.5*f),x=f>=1?docel:docel+(a-docel)*m*Math.cos(2*Math.PI*2.4*f);
            ustawX(x);
            const s2=Math.sign(x-docel);if(s2&&s2!==sg){sg=s2;pstryk(-1,.35+.5*m);cykaj(.25+.5*m,.9);}   // każde odbicie sprężyny = klik zapadki
            if(f>=1){cykaj(.5,1);dzwonek(84);wibruj(70,1);koniec();return;}
            raf=requestAnimationFrame(krokZ);};
          cykaj(.4,1);pstryk(1,.8);wibruj(40,.8);raf=requestAnimationFrame(krokZ);};
        aktywna={koniec};
        const krokAnim=now=>{
          if(skonczone||!zywe)return;
          if(!t0)t0=now;
          const tA=now-t0;   // 10-18: krótkie cofnięcie paska przed strzałem (napięcie sprężyny)
          if(tA<190){const u=tA/190;ustawX(x0-22*Math.sin(Math.PI*u)*(1-.3*u));raf=requestAnimationFrame(krokAnim);return;}
          const f=Math.min(1,(now-t0-190)/dl),e=1-Math.pow(1-f,4);   // wystrzał i długie hamowanie (do przeregulowania)
          ustawX(x0+(przereg-x0)*e);
          const i=pod(xd);
          if(i!==ost){
            ost=i;
            if(now-ostTik>30){ostTik=now;const v=Math.min(1,Math.abs(docel-x0)*4*Math.pow(1-f,3)/dl*1000/3600);cykaj(v,.9);pstryk(-1,.6+.4*v);wibruj(12+18*v,.25+.6*v);}
          }
          if(f>=1){zatrzask(now);return;}
          raf=requestAnimationFrame(krokAnim);
        };
        if(spokoj()){koniec();return;}
        gotowe.then(()=>{if(!skonczone&&zywe)raf=requestAnimationFrame(krokAnim);});   // obrazki gotowe → jazda bez przycięć
      });
    }
    function wejscie(){rama.classList.add("wchodzi");setTimeout(()=>rama.classList.remove("wchodzi"),1400);}   // karty wlatują z prawej, jedna po drugiej
    function zatrzymajOdRazu(){if(aktywna)aktywna.koniec();}
    function zniszcz(){zywe=false;cancelAnimationFrame(raf);rama.remove();}
    const wygranaKarta=()=>celIdx>=0?tor.children[celIdx]||null:null;
    // Żeby taśma nie podmieniała się po puszczeniu ② (wyglądało to, jakby losowanie było ustawione), wynik spoza taśmy dochodzi jako
    // nowy segment BEZ przebudowy toru; krec stawia go poza ekranem, a karty widoczne zostają (płynny start).
    function dolacz(s){seg.push(s);if(s&&s.obraz){const im=new Image();im.decoding="async";im.src=s.obraz;}return seg.length-1;}
    return {ustawSegmenty,dolacz,krec,bezczynnie,moc,wejscie,zatrzymajOdRazu,zniszcz,wygranaKarta,get segmentow(){return seg.length;},get ramka(){return rama;}};
  }

  // ---- okrągłe koło kategorii (canvas) ----
  // utworzKolo(rodzicKola, rodzicListy, rozmiar): płótno koła (czarna obręcz z 24 żarówkami, segmenty z ikonami, strzałka po PRAWEJ) trafia do
  // rodzicKola, a okno odczytu (pionowa lista nazw przewijana razem z tarczą, złote linie wokół środkowego wiersza) do rodzicListy; układ i
  // wymiary nadaje CSS szafki (nagrody.js). Strzałka siedzi na sprężynie (położenie + prędkość, trącenie = impuls, odbicie i powrót w ~0,3 s;
  // strzałka na górze zachowywała się źle, ta na dole dobrze): obrót zgodnie ze wskazówkami trąca ją W DÓŁ, naciąg w górę.
  // API: ustawSegmenty, moc(p), krec(indeks,{czas,obroty}), bezczynnie, zatrzymajOdRazu, zniszcz, segmentow.
  function spriteZarowki(on,dpr){
    const r=on?11:5,S=Math.ceil(r*2+2),cv=document.createElement("canvas");cv.width=cv.height=Math.round(S*dpr);
    const c=cv.getContext("2d");c.scale(dpr,dpr);const m=S/2;
    if(on){const g=c.createRadialGradient(m,m,0,m,m,r);g.addColorStop(0,"rgba(255,246,200,1)");g.addColorStop(.3,"rgba(255,216,74,.95)");g.addColorStop(.55,"rgba(255,216,74,.35)");g.addColorStop(1,"rgba(255,216,74,0)");
      c.fillStyle=g;c.beginPath();c.arc(m,m,r,0,Math.PI*2);c.fill();}
    else{c.fillStyle="#5a5247";c.beginPath();c.arc(m,m,r,0,Math.PI*2);c.fill();c.fillStyle="rgba(255,255,255,.12)";c.beginPath();c.arc(m-1.5,m-1.5,1.6,0,Math.PI*2);c.fill();}
    return {cv,S};
  }
  function utworzKolo(rodzic,rodzicListy,rozmiar){
    const rozm=rozmiar||184,dpr=Math.min(2,window.devicePixelRatio||1),WIERSZ=44,SZ=rozm+22;
    const wrap=el("div","kolo-o");wrap.dataset.stan="idle";wrap.dataset.moc="0";
    const cv=el("canvas","kolo-o-plotno");cv.width=Math.round(SZ*dpr);cv.height=Math.round(rozm*dpr);cv.style.width=SZ+"px";cv.style.height=rozm+"px";cv.setAttribute("aria-hidden","true");
    wrap.append(cv);rodzic.append(wrap);
    const okno=el("div","kolo-o-lista");okno.setAttribute("aria-hidden","true");
    const tor=el("div","kolo-o-tor");okno.append(tor,el("i","kolo-o-linia kolo-o-linia-g"),el("i","kolo-o-linia kolo-o-linia-d"));
    (rodzicListy||rodzic).append(okno);
    const R=rozm/2,rObr=R-4,rTar=R-30,INK="#211f1d",PANEL="#faf6ee";
    const c=cv.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);
    const ZAR_ON=spriteZarowki(true,dpr),ZAR_OFF=spriteZarowki(false,dpr);
    let seg=[],kat=0,mocW=0,zywe=true,raf=0,aktywna=null,wsk=0,wv=0,swiec=0,ostSeg=-1,ostTik=0,idle=true,A=0,nastepna=0,wysL=0;
    const obrazy=new Map();
    const obraz=u=>{if(!u)return null;let i=obrazy.get(u);if(!i){i=new Image();i.decoding="async";i.src=u;obrazy.set(u,i);i.onload=start;}return i.complete&&i.naturalWidth>0?i:null;};
    const n=()=>seg.length||1;
    const uPoz=a=>-a/(2*Math.PI/n());
    const segPod=a=>{const k=n(),u=((uPoz(a)%k)+k)%k;return Math.floor(u)%k;};
    const celKat=i=>-(i+.5)*2*Math.PI/n();
    const tracenie=imp=>{wv+=imp;start();};   // impuls dla sprężyny strzałki (rad/s): dodatni = grot w dół (zgodnie ze wskazówkami)
    const buf=document.createElement("canvas");buf.width=buf.height=Math.round(rTar*2*dpr);const cb=buf.getContext("2d");
    function rysujTarcze(){
      cb.setTransform(dpr,0,0,dpr,0,0);cb.clearRect(0,0,rTar*2,rTar*2);cb.translate(rTar,rTar);const k=n();
      for(let i=0;i<seg.length;i++){
        const a0=i*2*Math.PI/k,a1=(i+1)*2*Math.PI/k,s=seg[i];
        // `wyl` (w kategorii nie ma już nic do wylosowania, więc jest wygaszona): szare, przekreślone pole, na którym koło nie staje
        cb.beginPath();cb.moveTo(0,0);cb.arc(0,0,rTar,a0,a1);cb.closePath();cb.fillStyle=s.wyl?"#b9b1a4":(s.kolor||"#ec1a83");cb.fill();cb.lineWidth=3;cb.strokeStyle=INK;cb.stroke();
        if(s.wyl){const am=(a0+a1)/2,r0=rTar*.3,r1=rTar*.86;cb.save();cb.lineWidth=5;cb.lineCap="round";cb.strokeStyle="rgba(33,31,29,.45)";
          for(const d of [-.22,.22]){cb.beginPath();cb.moveTo(Math.cos(am+d)*r0,Math.sin(am+d)*r0);cb.lineTo(Math.cos(am-d)*r1,Math.sin(am-d)*r1);cb.stroke();}cb.restore();}
        cb.save();cb.beginPath();cb.arc(0,0,rTar-9,a0+.05,a1-.05);cb.lineWidth=2;cb.setLineDash([5,5]);cb.strokeStyle="rgba(250,246,238,.85)";cb.stroke();cb.restore();
      }
    }
    function zbudujListe(){
      tor.replaceChildren();const k=seg.length;if(!k)return;
      const ile=k*40;A=k*20;
      for(let j=0;j<ile;j++){
        const s=seg[j%k],w=el("div","kolo-o-wiersz"+(s.wyl?" wyl":""));w.style.setProperty("--kolor",s.wyl?"#b9b1a4":(s.kolor||"#ec1a83"));w.style.height=WIERSZ+"px";
        w.append(el("b","kolo-o-wiersz-et",s.etykieta||""));tor.append(w);
      }
      wysL=0;
    }
    function ustawListe(a){
      if(!wysL)wysL=okno.clientHeight||110;   // wysokość okna z CSS, czytana raz po zbudowaniu
      const k=n(),t=(((uPoz(a))%k)+k)%k,jc=A+t;
      tor.style.transform="translate3d(0,"+(wysL/2-jc*WIERSZ)+"px,0)";
    }
    function rys(t){
      c.clearRect(0,0,SZ,rozm);c.save();c.translate(R,R);
      c.save();c.translate(rObr-16,0);c.rotate(wsk);c.beginPath();c.moveTo(0,-17);c.lineTo(36,0);c.lineTo(0,17);c.closePath();
      c.fillStyle="#eaa32b";c.fill();c.lineWidth=4;c.strokeStyle=INK;c.lineJoin="round";c.stroke();
      c.beginPath();c.moveTo(6,-8);c.lineTo(23,0);c.lineTo(6,8);c.closePath();c.fillStyle="rgba(255,255,255,.4)";c.fill();c.restore();
      c.beginPath();c.arc(0,0,rObr,0,Math.PI*2);c.fillStyle=INK;c.fill();
      const zar=24,tempo=mocW>0||aktywna?70:520;
      for(let i=0;i<zar;i++){const a=i/zar*Math.PI*2,on=((i+Math.floor(t/tempo))%2===0)||(swiec>t&&Math.floor(t/110)%2===0),sp=on?ZAR_ON:ZAR_OFF;
        c.drawImage(sp.cv,Math.cos(a)*(rObr-9)-sp.S/2,Math.sin(a)*(rObr-9)-sp.S/2,sp.S,sp.S);}
      const pull=Math.pow(mocW,1.5)*.9,drz=Math.pow(mocW,4)*.07*(Math.random()-.5),ang=kat-pull+drz;
      c.save();c.rotate(ang);c.drawImage(buf,-rTar,-rTar,rTar*2,rTar*2);c.restore();
      const k=n();
      for(let i=0;i<seg.length;i++){
        const im=obraz(seg[i].obraz);if(!im)continue;
        const mid=(i+.5)*2*Math.PI/k+ang,w=Math.min(rTar*.52,rTar*(k<=3?.52:1.6/k)),h=w*(im.naturalHeight/im.naturalWidth),r=rTar*.58;
        if(seg[i].wyl)c.globalAlpha=.3;
        c.drawImage(im,Math.cos(mid)*r-w/2,Math.sin(mid)*r-h/2,w,h);c.globalAlpha=1;
      }
      c.beginPath();c.arc(0,0,15,0,Math.PI*2);c.fillStyle=PANEL;c.fill();c.lineWidth=4;c.strokeStyle=INK;c.stroke();
      c.beginPath();c.arc(0,0,5,0,Math.PI*2);c.fillStyle="#ec1a83";c.fill();
      c.restore();
      ustawListe(ang);
    }
    let tl=performance.now();
    function sprezyna(dt){const K=420,D=24;wv+=(-K*wsk-D*wv)*dt;wsk+=wv*dt;if(Math.abs(wsk)<.004&&Math.abs(wv)<.04){wsk=0;wv=0;}}
    function petla(now){
      raf=0;if(!zywe)return;
      const aktyw=mocW>0||!!aktywna||wsk!==0||wv!==0,odstep=aktyw?0:idle?33:swiec>now?125:-1;
      if(odstep<0){tl=now;return;}
      if(now<nastepna){raf=requestAnimationFrame(petla);return;}
      nastepna=now+odstep;
      const dt=Math.min(.05,(now-tl)/1000||0);tl=now;
      sprezyna(dt);
      if(idle&&!aktywna&&mocW===0)kat+=.12*dt;
      if(mocW>0&&!aktywna){const s=segPod(kat-Math.pow(mocW,1.5)*.9);if(s!==ostSeg){ostSeg=s;if(mocW>.05){cykaj(.2+mocW*.6,.7);wibruj(10+mocW*14,.2+mocW*.5);}wv-=5;}}   // naciąg: segment trąca grot w górę
      rys(now);raf=requestAnimationFrame(petla);
    }
    function start(){if(!raf&&zywe){tl=performance.now();nastepna=0;raf=requestAnimationFrame(petla);}}
    function ustawSegmenty(s){seg=s||[];kat=0;mocW=0;swiec=0;idle=true;wsk=0;wv=0;wrap.dataset.stan="idle";wrap.dataset.moc="0";rysujTarcze();zbudujListe();for(const q of seg)obraz(q.obraz);start();}
    let ostMocCss="";
    function moc(p){mocW=Math.max(0,Math.min(1,+p||0));const q=mocW.toFixed(2);
      if(q!==ostMocCss){ostMocCss=q;wrap.style.setProperty("--moc",q);wrap.dataset.moc=poziomMocy(mocW);wrap.dataset.stan=mocW>0?"laduje":"idle";}
      start();}
    function krec(indeks,op){
      const opc=op||{};if(aktywna)aktywna.koniec();
      return new Promise(res=>{
        idle=false;const pull=Math.pow(mocW,1.5)*.9;kat-=pull;mocW=0;wrap.dataset.moc="0";wrap.dataset.stan="krec";swiec=0;
        const k=n(),startK=kat,obroty=Math.max(3,opc.obroty||5),seg1=2*Math.PI/k;
        let cel=celKat(indeks);
        while(cel<startK+obroty*2*Math.PI)cel+=2*Math.PI;
        const przereg=cel+seg1*.14;
        const dl=spokoj()?1:(opc.czas||4200);let skonczone=false,t0=0,tp=0;ostSeg=segPod(startK);
        const koniec=()=>{if(skonczone)return;skonczone=true;aktywna=null;kat=cel;swiec=performance.now()+3000;wrap.dataset.stan="wygrana";start();res(indeks);};
        aktywna={koniec};
        const zatrzask=t1=>{
          const a=kat,krokZ=now=>{
            if(skonczone||!zywe)return;
            const f=Math.min(1,(now-t1)/480),m=Math.exp(-6.5*f);kat=f>=1?cel:cel+(a-cel)*m*Math.cos(2*Math.PI*2.4*f);sprezyna(Math.min(.05,(now-tp)/1000||0));tp=now;rys(now);
            if(f>=1){cykaj(.5,1);dzwonek(84);wibruj(70,1);koniec();return;}
            requestAnimationFrame(krokZ);};
          cykaj(.4,1);wv-=6;wibruj(40,.8);requestAnimationFrame(krokZ);};
        const krok=now=>{
          if(skonczone||!zywe)return;
          if(!t0){t0=now;tp=now;}
          const tA=now-t0;   // 10-18: krótkie cofnięcie koła przed strzałem
          if(tA<190){const u=tA/190;kat=startK-.09*Math.sin(Math.PI*u);sprezyna(Math.min(.05,(now-tp)/1000||0));tp=now;rys(now);requestAnimationFrame(krok);return;}
          const f=Math.min(1,(now-t0-190)/dl),e=1-Math.pow(1-f,4);kat=startK+(przereg-startK)*e;
          const s=segPod(kat);
          if(s!==ostSeg){ostSeg=s;const v=Math.min(1,Math.pow(1-f,3));if(now-ostTik>28){ostTik=now;cykaj(v,.9);wibruj(12+18*v,.25+.6*v);}wv+=5+5*v;}   // segment trąca grot w dół, mocniej przy szybkiej jeździe
          sprezyna(Math.min(.05,(now-tp)/1000||0));tp=now;rys(now);
          if(f>=1){zatrzask(now);return;}
          requestAnimationFrame(krok);
        };
        if(spokoj()){koniec();return;}
        cancelAnimationFrame(raf);raf=0;requestAnimationFrame(krok);
      });
    }
    function zatrzymajOdRazu(){if(aktywna)aktywna.koniec();}
    function zniszcz(){zywe=false;cancelAnimationFrame(raf);wrap.remove();okno.remove();}
    return {ustawSegmenty,moc,krec,bezczynnie:t=>{idle=!!t;if(idle)start();},zatrzymajOdRazu,zniszcz,get segmentow(){return seg.length;}};
  }
  return {utworz,utworzKolo,KOLORY,sekwencja};
})();
