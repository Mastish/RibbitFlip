"use strict";
// RibbitBeat: ikona Studia instrumentów, czyli sekretu instrumentów z koła nagród (10-18).
// Pulpit z czarnego filcu w holograficznej obwódce sekretnej karty (.rz-sekretny w gry-nagrody.css) z naklejką „Sekret”:
// ekran kineskopu, na którym gra widmo (słupki z diod, szczyty opadają z opóźnieniem), dwie filcowe gałki ze Studia, trzy suwaki
// i klawiatura. Gałki, suwaki i klawisze chodzą razem z widmem, jakby ktoś właśnie kręcił brzmienie. Ekran zaczyna od „?”
// sekretnej karty: znak migocze, zapada się w kreskę i kineskop się włącza, dopiero wtedy rusza widmo.
//
// Skąd widmo: syntetyczny podkład liczony w czasie, nie na klatkę (stopa, werbel, hi-hat i melodia na 96 BPM, ten sam dla
// wszystkich ikon), zmieszany z prawdziwym dźwiękiem gry, kiedy kontekst gra: analizator wisi na wyjściu kompresora
// (Glos.celUI()), więc fanfara przy odkryciu karty i dźwięki menu podbijają słupki. Analizator nie tworzy kontekstu
// (Glos.kontekstUI() zwraca istniejący albo null) i nie jest podłączony do głośników.
//
// Wydajność: jedna pętla requestAnimationFrame na wszystkie ikony, rysuje najwyżej ~80 razy na sekundę (monitory 144–240 Hz),
// i tylko gdy któraś ikona jest widoczna (IntersectionObserver: ukryte menu, ekran gry i zamknięte koło = pętla stoi).
// Ograniczony ruch albo grafika „wydajność” = jedna nieruchoma klatka (klasa .stoi gasi też animacje CSS obwódki).
// Ruch wyłącznie płótnem i transformacjami, nic nie zmienia układu strony.
//
// API: StudioIkona.zbuduj({rozmiar:"duza"|"mala", czekaj}) → element div.sti (aria-hidden). `czekaj()` zwraca true, dopóki
// ekran ma stać zgaszony z przygaszonym „?” (karta koła jeszcze zakryta). el.wlacz() puszcza włączanie ekranu od nowa.
// StudioIkona.stan() = {ikony, widoczne, petla, analizator, msKlatki} dla smoke.
const StudioIkona=(()=>{
  const L=(pl,en)=>typeof RBJezyk!=="undefined"&&RBJezyk.wybierz?RBJezyk.wybierz(pl,en):pl;
  const GALKI="../assets/knobs/";
  const el=(tag,kl)=>{const e=document.createElement(tag);if(kl)e.className=kl;return e;};
  const B=24;                                      // pasma wspólnego widma; ikona próbkuje je do swojej liczby słupków
  const TAKT=60/96;                                // podkład: 96 BPM
  const RIFF=[4,6,8,6,9,8,6,4,3,4,6,4,8,9,11,9];   // melodia na białych klawiszach (0–13), pętla 16 ósemek
  const BIALE=14,CZARNE=[0,1,3,4,5,7,8,10,11,12];  // czarny klawisz stoi za białym o tym indeksie (dwie oktawy)
  const ROZMIARY={duza:{slupki:16,segmenty:11,suwaki:true,klawisze:true},mala:{slupki:10,segmenty:7,suwaki:false,klawisze:false}};
  const KOLORY_SUWAKOW=["var(--pink)","var(--lime)","#ffd84a"];
  // fazy włączania ekranu (sekundy od startu): „?” migocze, zapada się w kreskę, kreska rośnie w obraz
  const F_PYT=.5,F_ZGNIOT=.62,F_OBRAZ=.92;

  const instancje=new Set(),mapa=new WeakMap();
  const pasma=new Float32Array(B),syntP=new Float32Array(B),prawdP=new Float32Array(B);
  const takt={klawisz:-1,dzwiek:false};   // klawisz melodii podkładu; dzwiek = prawdziwy dźwięk gry przeważa nad podkładem
  let raf=0,tPop=0,poziomP=0,A=null,io=null,ro=null,msKlatki=0;   // msKlatki: średni czas JS jednej klatki (do smoke)
  const mq=typeof matchMedia==="function"?matchMedia("(prefers-reduced-motion: reduce)"):null;
  const statycznie=()=>{
    try{if(typeof ruchOgraniczony==="function"&&ruchOgraniczony())return true;}catch(e){}
    if(mq&&mq.matches)return true;
    try{return typeof S!=="undefined"&&!!S&&!!S.ust&&S.ust.grafika==="wydajnosc";}catch(e){return false;}
  };

  // ---- dźwięk: syntetyczny podkład + prawdziwe wyjście gry ----
  // wypełnia `wy` (domyślnie syntP) i zwraca klawisz melodii albo -1 (puszczony przed następną nutą)
  function podklad(t,wy){
    wy=wy||syntP;
    const tb=t/TAKT,ud=Math.floor(tb),f=tb-ud,w4=ud%4;
    const stopa=Math.exp(-f*6)*(w4===2?.85:1),werbel=(w4===1||w4===3)?Math.exp(-f*9):0;
    const o=tb*2,fo=o-Math.floor(o),hihat=Math.exp(-fo*15)*(Math.floor(o)%2?1:.6);
    const kl=RIFF[Math.floor(o)%RIFF.length],nuta=Math.min(1,fo*10)*Math.exp(-fo*1.4),mx=.3+kl/13*.48;
    // tło jak różowy szum (bas wyżej), na nim uderzenia i melodia; całość ×1,15, więc stopa i melodia dobijają do góry ekranu
    for(let i=0;i<B;i++){
      const x=i/(B-1);
      wy[i]=1.15*(.22+.18*(1-x)+stopa*.6*Math.exp(-x*x*30)+werbel*.45*Math.exp(-(x-.5)*(x-.5)*14)
        +hihat*.45*Math.exp(-(x-.86)*(x-.86)*60)+nuta*.5*Math.exp(-(x-mx)*(x-mx)*240)
        +nuta*.3*Math.exp(-(x-mx-.13)*(x-mx-.13)*280)+.07*Math.sin(i*1.9+t*4.7)*Math.sin(i*.7-t*2.9));
    }
    return fo<.72?kl:-1;
  }
  function odlacz(){if(A){try{A.n.disconnect(A.an);}catch(e){}A=null;}}
  function sluchaj(dt){
    let lv=0;
    try{
      const c=typeof Glos!=="undefined"&&Glos&&Glos.kontekstUI?Glos.kontekstUI():null;
      const n=c&&c.state==="running"&&Glos.celUI?Glos.celUI():null;
      if(n){
        if(!A||A.c!==c||A.n!==n){
          odlacz();const an=c.createAnalyser();an.fftSize=1024;an.smoothingTimeConstant=.45;n.connect(an);
          const K=an.frequencyBinCount,ny=c.sampleRate/2,zakresy=[];
          for(let i=0;i<B;i++){const f0=55*Math.pow(200,i/B),f1=55*Math.pow(200,(i+1)/B),lo=Math.min(K-1,Math.floor(f0/ny*K));
            zakresy.push([lo,Math.min(K,Math.max(lo+1,Math.ceil(f1/ny*K)))]);}
          A={c,n,an,buf:new Uint8Array(K),zakresy};
        }
        A.an.getByteFrequencyData(A.buf);
        for(let i=0;i<B;i++){const z=A.zakresy[i];let s=0;for(let k=z[0];k<z[1];k++)s+=A.buf[k];
          const v=Math.max(0,(s/(z[1]-z[0])/255-.32)/.68);prawdP[i]=Math.min(1,Math.pow(v,1.2)*1.15);lv+=prawdP[i];}
        lv/=B;
      }else prawdP.fill(0);
    }catch(e){prawdP.fill(0);}
    poziomP+=(Math.min(1,lv*3)-poziomP)*(1-Math.exp(-dt/(lv*3>poziomP?.05:.4)));
  }
  function miksuj(){
    const tl=1-.75*poziomP;
    for(let i=0;i<B;i++)pasma[i]=Math.min(1,Math.max(syntP[i]*tl,prawdP[i]));
    takt.dzwiek=poziomP>.2;
  }
  // klawisz z prawdziwego dźwięku: najmocniejsze pasmo powyżej basu
  function klawiszZDzwieku(){let m=0,mi=-1;for(let i=5;i<B-1;i++)if(prawdP[i]>m){m=prawdP[i];mi=i;}return m>.25?Math.round((mi-5)/(B-7)*(BIALE-1)):-1;}
  const srednia=(a,b)=>{let s=0;for(let i=a;i<=b;i++)s+=pasma[i];return s/(b-a+1);};

  // ---- budowa ----
  function zbuduj(o){
    o=o||{};
    const rodzaj=o.rozmiar==="mala"?"mala":"duza",R=ROZMIARY[rodzaj];
    const root=el("div","sti sti-"+rodzaj);root.setAttribute("aria-hidden","true");
    const pulpit=el("div","sti-pulpit"),ekran=el("div","sti-ekran"),cv=el("canvas","sti-widmo");
    ekran.append(cv,el("i","sti-szklo"));
    const kontrolki=el("div","sti-kontrolki"),galki=el("div","sti-galki"),galkiI=[];
    for(const n of ["knob-8","knob-4"]){const g=el("span","sti-galka"),i=el("i");i.style.backgroundImage="url("+GALKI+n+".png)";g.append(i);galki.append(g);galkiI.push(i);}
    kontrolki.append(galki);
    const suwakiI=[];
    if(R.suwaki){const s=el("div","sti-suwaki");
      for(const k of KOLORY_SUWAKOW){const t=el("span","sti-suwak"),i=el("i");i.style.setProperty("--k",k);t.append(i);s.append(t);suwakiI.push(i);}
      kontrolki.append(s);}
    pulpit.append(ekran,kontrolki);
    const biale=[];
    if(R.klawisze){const kw=el("div","sti-klawisze");
      for(let i=0;i<BIALE;i++){const k=el("i");kw.append(k);biale.push(k);}
      for(const x of CZARNE){const k=el("b");k.style.setProperty("--x",String(x+1));kw.append(k);}
      pulpit.append(kw);}
    const nakl=el("b","sti-naklejka");nakl.dataset.napis=L("Sekret","Secret");   // napis z ::before: nie wchodzi do textContent przycisku
    root.append(pulpit,nakl);
    const I={root,ekran,cv,ctx:cv.getContext("2d"),R,galki:galkiI,suwaki:suwakiI,biale,
      wart:new Float32Array(R.slupki),szczyt:new Float32Array(R.slupki),trzym:new Float32Array(R.slupki),
      galkiW:[0,0],galkiK:[null,null],suwakiW:[0,0,0],suwakiP:[null,null,null],klawisz:-1,klawiszT:0,
      czekaj:typeof o.czekaj==="function"?o.czekaj:null,stan:"start",t0:-1,ciemny:false,
      widoczna:false,byla:false,zamrozona:false,g:null,brudny:true,siatka:null,kolory:null,zakres:0,powstala:performance.now()};
    if(I.czekaj)I.stan="czeka";
    root.wlacz=()=>{I.stan="start";I.t0=-1;I.ciemny=false;budz();};
    instancje.add(I);mapa.set(root,I);obserwuj(I);
    return root;
  }
  function obserwuj(I){
    if(typeof IntersectionObserver==="undefined")I.widoczna=true;
    else{
      if(!io)io=new IntersectionObserver(wpisy=>{
        for(const w of wpisy){const J=mapa.get(w.target);if(!J)continue;J.widoczna=w.isIntersecting;if(J.root.isConnected)J.byla=true;else if(J.byla)usun(J);}
        budz();});
      io.observe(I.root);
    }
    if(typeof ResizeObserver!=="undefined"){
      if(!ro)ro=new ResizeObserver(wpisy=>{for(const w of wpisy){const J=mapa.get(w.target.closest(".sti"));if(J)J.brudny=true;}});
      ro.observe(I.ekran);
    }
    budz();
  }
  function usun(I){instancje.delete(I);try{if(io)io.unobserve(I.root);if(ro)ro.unobserve(I.ekran);}catch(e){}if(!instancje.size)odlacz();}

  // ---- rysowanie ----
  function geometria(I){
    const w=I.ekran.clientWidth,h=I.ekran.clientHeight;if(!w||!h)return false;
    const dpr=Math.min(2,Math.max(1,window.devicePixelRatio||1)),W=Math.round(w*dpr),H=Math.round(h*dpr);
    if(I.cv.width!==W||I.cv.height!==H){I.cv.width=W;I.cv.height=H;}
    const n=I.R.slupki,S=I.R.segmenty,px=W*.07,pyG=H*.12,pyD=H*.1,gx=Math.max(1,W*.014),gy=Math.max(1,H*.022);
    const bw=(W-2*px-gx*(n-1))/n,sh=(H-pyG-pyD-gy*(S-1))/S;
    I.g={W,H,n,S,px,pyD,gx,gy,bw,sh};
    I.kolory=[];for(let s=0;s<S;s++){const f=s/(S-1);I.kolory.push(f<.5?"#a6d861":f<.78?"#ffd84a":"#ff3d9a");}
    // siatka zgaszonych diod: raz na rozmiar, potem jedno drawImage na klatkę
    const sc=document.createElement("canvas");sc.width=W;sc.height=H;const c=sc.getContext("2d");
    c.fillStyle="rgba(140,220,160,.09)";
    for(let j=0;j<n;j++)for(let s=0;s<S;s++)c.fillRect(px+j*(bw+gx),H-pyD-(s+1)*sh-s*gy,bw,sh);
    I.siatka=sc;
    if(I.suwaki.length){const k=I.suwaki[0];I.zakres=Math.max(0,k.parentNode.clientHeight-k.offsetHeight);I.suwakiP=[null,null,null];}
    I.brudny=false;return true;
  }
  function rysujWidmo(I,jasnosc){
    const {H,n,S,px,pyD,gx,gy,bw,sh}=I.g,c=I.ctx,pelnaWys=S*sh+(S-1)*gy;
    c.globalCompositeOperation="lighter";   // poświata luminoforu pod słupkami
    for(let j=0;j<n;j++){const v=I.wart[j];if(v<.03)continue;const x=px+j*(bw+gx),wy=v*pelnaWys;
      c.fillStyle=v>.78?"rgba(255,61,154,"+(.16*jasnosc).toFixed(3)+")":"rgba(166,216,97,"+(.12*jasnosc).toFixed(3)+")";
      c.fillRect(x-gx*1.3,H-pyD-wy-sh*.4,bw+gx*2.6,wy+sh*.8);}
    c.globalCompositeOperation="source-over";
    for(let j=0;j<n;j++){
      const v=I.wart[j]*S,pelne=Math.floor(v),ul=v-pelne,x=px+j*(bw+gx);
      for(let s=0;s<Math.min(S,pelne+1);s++){const a=s<pelne?1:ul;if(a<.06)continue;
        c.globalAlpha=a*jasnosc;c.fillStyle=I.kolory[s];c.fillRect(x,H-pyD-(s+1)*sh-s*gy,bw,sh);}
      if(I.szczyt[j]>.05){const p=Math.min(S-1,Math.max(0,Math.round(I.szczyt[j]*S-.5)));
        c.globalAlpha=jasnosc;c.fillStyle="#c4ecff";c.fillRect(x,H-pyD-(p+1)*sh-p*gy,bw,Math.max(1,sh*.42));}
    }
    c.globalAlpha=1;
  }
  // „?” sekretnej karty: przygaszony, gdy karta jeszcze zakryta; migocze przed włączeniem
  function pytajnik(I,jasnosc,dx,sx,sy){
    const {W,H}=I.g,c=I.ctx;
    c.save();c.translate(W/2+dx,H*.53);c.scale(sx,sy);
    c.font="400 "+Math.round(H*.74)+"px 'Titan One','Baloo 2',system-ui,sans-serif";c.textAlign="center";c.textBaseline="middle";
    c.shadowColor="rgba(154,214,255,"+(.9*jasnosc).toFixed(3)+")";c.shadowBlur=H*.14;
    c.fillStyle="rgba(205,245,255,"+jasnosc.toFixed(3)+")";c.fillText("?",0,0);
    c.restore();
  }
  function aktualizuj(I,dt){
    const n=I.R.slupki,kA=1-Math.exp(-dt/.045),kR=1-Math.exp(-dt/.22);
    for(let j=0;j<n;j++){
      const x=j/(n-1)*(B-1),i0=Math.floor(x),f=x-i0,cel=pasma[i0]*(1-f)+pasma[Math.min(B-1,i0+1)]*f,v=I.wart[j];
      I.wart[j]=v+(cel-v)*(cel>v?kA:kR);
      if(I.wart[j]>=I.szczyt[j]){I.szczyt[j]=I.wart[j];I.trzym[j]=.45;}
      else if((I.trzym[j]-=dt)<0)I.szczyt[j]=Math.max(I.wart[j],I.szczyt[j]-dt*.75);
    }
  }
  // gałki (bas, góra) i suwaki (bas, środek, góra) idą za widmem; przed włączeniem ekranu stoją na zerze
  function kontrolki(I,t,dt,wlaczony){
    const nis=srednia(0,4),sr=srednia(6,13),gora=srednia(14,22);
    const cg=wlaczony?[.22+.62*nis+.08*Math.sin(t*.7),.18+.7*gora+.1*Math.sin(t*.53+1)]:[0,0];
    const kg=1-Math.exp(-dt/.3);
    for(let k=0;k<I.galki.length;k++){I.galkiW[k]+=(cg[k]-I.galkiW[k])*kg;
      const a=Math.round((-135+270*Math.min(1,Math.max(0,I.galkiW[k])))*2)/2;
      if(a!==I.galkiK[k]){I.galkiK[k]=a;I.galki[k].style.transform="rotate("+a+"deg)";}}
    if(I.suwaki.length){const cs=wlaczony?[nis,sr,gora]:[0,0,0],ks=1-Math.exp(-dt/.12);
      for(let k=0;k<I.suwaki.length;k++){I.suwakiW[k]+=(Math.min(1,Math.max(0,1.5*cs[k]-.2))-I.suwakiW[k])*ks;
        const y=Math.round((1-I.suwakiW[k])*I.zakres*2)/2;
        if(y!==I.suwakiP[k]){I.suwakiP[k]=y;I.suwaki[k].style.transform="translateY("+y+"px)";}}}
    if(I.biale.length){
      let k=-1;
      if(wlaczony){if(takt.dzwiek){if(t-I.klawiszT>.12){k=klawiszZDzwieku();I.klawiszT=t;}else k=I.klawisz;}else k=takt.klawisz;}
      if(k!==I.klawisz){if(I.klawisz>=0)I.biale[I.klawisz].classList.remove("on");if(k>=0)I.biale[k].classList.add("on");I.klawisz=k;}
    }
  }
  function krok(I,t,dt){
    if(I.brudny||!I.g){if(!geometria(I))return;I.ciemny=false;}
    const c=I.ctx,{W,H}=I.g;
    if(I.stan==="czeka"){
      if(I.czekaj&&I.czekaj()){if(!I.ciemny){c.clearRect(0,0,W,H);pytajnik(I,.22,0,1,1);I.ciemny=true;}kontrolki(I,t,dt,false);return;}
      I.stan="start";I.t0=-1;
    }
    if(I.stan==="start"&&I.t0<0)I.t0=t;
    const ts=I.stan==="start"?t-I.t0:9;
    aktualizuj(I,dt);
    c.clearRect(0,0,W,H);
    if(ts<F_PYT){   // „?” migocze i drży
      const mig=Math.sin(ts*47)>-.2?1:.45;pytajnik(I,(.35+.55*Math.min(1,ts/.2))*mig,Math.sin(ts*91)*W*.012,1,1);
    }else if(ts<F_ZGNIOT){   // „?” zapada się w jasną kreskę
      const q=(ts-F_PYT)/(F_ZGNIOT-F_PYT);pytajnik(I,1,0,1+.6*q,Math.max(.02,1-q));
    }else if(ts<F_OBRAZ){   // kreska rośnie w obraz: widmo w pasie, który się otwiera, i gasnący błysk
      const p=(ts-F_ZGNIOT)/(F_OBRAZ-F_ZGNIOT),e=1-Math.pow(1-p,3),pas=Math.max(2,H*e);
      c.save();c.beginPath();c.rect(0,H/2-pas/2,W,pas);c.clip();
      c.drawImage(I.siatka,0,0);rysujWidmo(I,.4+.6*p);
      c.fillStyle="rgba(225,250,255,"+(.85*(1-p)).toFixed(3)+")";c.fillRect(0,H/2-pas/2,W,pas);
      c.restore();
    }else{
      if(I.stan==="start")I.stan="gra";
      c.drawImage(I.siatka,0,0);rysujWidmo(I,1);
    }
    kontrolki(I,t,dt,ts>=F_ZGNIOT);
  }
  // nieruchoma klatka: ograniczony ruch albo grafika „wydajność”
  function zamroz(I){
    if(!geometria(I))return;
    const p=new Float32Array(B);podklad(1.37,p);   // własny bufor: wspólne `pasma` należą do żywych ikon
    const n=I.R.slupki;
    for(let j=0;j<n;j++){const x=j/(n-1)*(B-1),i0=Math.floor(x),f=x-i0;I.wart[j]=Math.min(1,p[i0]*(1-f)+p[Math.min(B-1,i0+1)]*f)*.95;I.szczyt[j]=Math.min(1,I.wart[j]+.12);}
    const c=I.ctx;c.clearRect(0,0,I.g.W,I.g.H);c.drawImage(I.siatka,0,0);rysujWidmo(I,1);
    I.galki.forEach((g,k)=>{g.style.transform="rotate("+(k?55:-35)+"deg)";I.galkiK[k]=null;});
    I.suwaki.forEach((s,k)=>{s.style.transform="translateY("+Math.round([.3,.55,.4][k]*I.zakres)+"px)";I.suwakiP[k]=null;});
    if(I.biale.length){if(I.klawisz>=0)I.biale[I.klawisz].classList.remove("on");I.klawisz=6;I.biale[6].classList.add("on");}
    I.root.classList.add("stoi");I.stan="gra";I.zamrozona=true;
  }

  // ---- pętla ----
  function petla(ms){
    raf=0;const t=ms/1000;
    if(tPop&&t-tPop<.012){raf=requestAnimationFrame(petla);return;}   // ponad ~80 kl./s nie rysujemy (monitory 144–240 Hz)
    const dt=tPop?Math.min(.1,t-tPop):1/60;tPop=t;
    const t0=performance.now();
    const st=statycznie();let aktywne=0;
    if(!st){takt.klawisz=podklad(t);sluchaj(dt);miksuj();}
    for(const I of instancje){
      if(!I.root.isConnected){if(I.byla||performance.now()-I.powstala>15000)usun(I);continue;}
      I.byla=true;if(!I.widoczna)continue;
      if(st||I.root.closest(".statyczne")){if(!I.zamrozona||I.brudny)zamroz(I);continue;}
      if(I.zamrozona){I.zamrozona=false;I.root.classList.remove("stoi");}
      aktywne++;krok(I,t,dt);
    }
    if(aktywne){msKlatki+=(performance.now()-t0-msKlatki)*.05;raf=requestAnimationFrame(petla);}else tPop=0;
  }
  function budz(){if(!raf&&instancje.size)raf=requestAnimationFrame(petla);}

  const api={zbuduj,stan:()=>({ikony:instancje.size,widoczne:[...instancje].filter(I=>I.widoczna).length,petla:!!raf,analizator:!!A,msKlatki:+msKlatki.toFixed(3)})};
  if(typeof window!=="undefined")window.StudioIkona=api;
  return api;
})();
