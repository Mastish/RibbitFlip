// Klawisze sceny RibbitBeat: drabinka 11 stopni klawiatury toru (kontrakt haków w README etapu A1a). Klasyczny skrypt
// ładowany przed zabi-chor.js, jeden global EfektyKlawisze = {DRABINKA, reset}. Globali gry (bufor, mocStopnia,
// nameOf) używa dopiero w chwili wywołania haka; FX (gl-fx.js) jest już zdefiniowany.
//
// Haki stopnia (gra woła je przez hakStopnia; wyjątek = jeden wpis w konsoli, w tlo dodatkowo domyślna klawiatura):
//   tlo(c, L, st)        materiał klawiatury do bufora kart, raz na tor przy każdym układzie (bez ruchu);
//   gracz(c, L, g, st)   2D na #scena co klatkę, po podświetleniu klawisza gracza, dla każdego gracza toru;
//   fx(L, g, st)         prymitywy silnika (FX.*) tylko wtedy, gdy rysuje WebGL2 (st.gl): warstwa #glFx leży pod
//                        #scena, więc światło nie zasłania podświetlonego klawisza ani żab.
// Bez WebGL2 (?gl=0, brak silnika) te same opisy światła rysuje hak gracz w 2D, z alfą ×0,6 i połową cząstek, bo na
// #scena leżą one NAD podświetlonym klawiszem; poświata w 2D jest obwódką z pustym środkiem i nie barwi klawisza.
//
// Każdy stopień ma jawny zestaw cech (ZESTAWY, klucz = id): własny materiał, własną paletę i własną reakcję, czyli
// sygnaturę z pola cecha. Stopnie nie dziedziczą reakcji po niższych numerach. Wspólna jest tylko skromna baza:
// delikatne wgłębienie śpiewanego klawisza i stała obwódka w barwie stopnia w wariancie spokojnym; nie ona odróżnia
// stopnie. Ogień kombo nie pali klawiszy: żar, światło, lód, złoto i kosmos, nigdy języki ognia.
// Blend: addytywne światło nad jasnym papierem karty bieleje, dlatego wszystko, co wychodzi w tor (pierścienie,
// ogony drobin, duchy), idzie blendem normal w barwie, a add tylko nad ciemnym podkładem klawiatury.
// Zdarzenia (start nuty, czysta, fałsz, koniec, zmiana wysokości) wynikają z różnic stanu gracza między klatkami.
// Cząstki: tablica toru, stały krok 1/120 s, grawitacja i tłumienie, limit 120 (2D: 60); reset() czyści stan.
// Żadna oscylacja nie przekracza 8 Hz. Bez filter i shadowBlur; gradienty i sprite'y z bufor(), lighter w save/restore.
const EfektyKlawisze=(function(){
  "use strict";
  const PI=Math.PI,TAU=2*PI,KROK=1/120,LIMIT_GL=120,LIMIT_2D=60,ALFA_2D=.6;
  const ROZ="#ec1a83",LIM="#a6d861",BURSZ="#eaa32b",ZOLTY="#ffd84a",NIEB="#294aa8",TUSZ="#211f1d",PAPIER="#faf6ee";
  const DYNIA="#ff7a1a",FIOLET="#4b2a7a",FIOLET_J="#8e6fe6";   // upiorna noc: pomarańcz dyni, fiolet nocy
  const DYM=["#8a8494","#6f6878","#a59fae"];

  // =========================================================================================== drobiazgi
  const los=k=>{const v=Math.sin(k*12.9898+78.233)*43758.5453;return v-Math.floor(v);};   // 0..1, powtarzalne
  const losuj=(a,b)=>a+Math.random()*(b-a);
  const przytnij=(v,a,b)=>v<a?a:v>b?b:v;
  const ulamek=v=>v-Math.floor(v);
  const ema=(a,b,dt,tau)=>a+(b-a)*(1-Math.exp(-Math.max(0,dt)/tau));   // wygładzanie w czasie, nie na klatkę
  const RGB=new Map();
  function rgb(k){
    let v=RGB.get(k);if(v)return v;
    const m=/^#([0-9a-f]{6})$/i.exec(k||""),n=m?parseInt(m[1],16):0xec1a83;
    v=[(n>>16)&255,(n>>8)&255,n&255];RGB.set(k,v);return v;
  }
  const kA=(k,a)=>{const v=rgb(k);return "rgba("+v[0]+","+v[1]+","+v[2]+","+przytnij(+a||0,0,1).toFixed(3)+")";};
  const MIESZ=new Map();   // mieszanki liczone raz (wołane także co klatkę, a kombinacji jest kilkanaście)
  function mieszaj(a,b,t){
    const kl=a+b+t;let v=MIESZ.get(kl);if(v)return v;
    const x=rgb(a),y=rgb(b);v="#";for(let i=0;i<3;i++)v+=Math.round(x[i]+(y[i]-x[i])*t).toString(16).padStart(2,"0");
    if(MIESZ.size<400)MIESZ.set(kl,v);return v;
  }
  function hsv(h,s,v){
    h=ulamek(h);const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);
    const c=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];
    return "#"+c.map(x=>Math.round(x*255).toString(16).padStart(2,"0")).join("");
  }
  const NIEB_J=mieszaj(NIEB,PAPIER,.45);                    // jasny błękit: lód
  const ELEKTR=mieszaj(NIEB,PAPIER,.72);                    // biel elektryczna
  const LIL=mieszaj(mieszaj(ROZ,NIEB,.45),PAPIER,.32);      // lila z różu i błękitu: kryształ, portal
  const TECZA=[0,1,2,3,4,5,6].map(i=>hsv(.95-i*.14,.36,1)); // tęcza hologramu: niskie nasycenie
  const PK=[];   // wspólna tablica punktów wstęg (silnik kopiuje punkty w chwili wywołania)
  const ile=(n,st)=>Math.max(1,Math.round(n*(st.gl?1:.5)));

  // =========================================================================================== geometria
  const czarny=s=>{const p=((s%12)+12)%12;return p===1||p===3||p===6||p===8||p===10;};
  const NAZWY=["C","Cis","D","Dis","E","F","Fis","G","Gis","A","B","H"];
  const nazwa=s=>typeof nameOf==="function"?nameOf(s):NAZWY[((s%12)+12)%12];
  const yRz=(L,s)=>L.gorna+(L.goraN-s+.5)*L.rh;   // środek rzędu półtonu (jak ySemi gry)
  const wysK=L=>L.rzedy*L.rh;
  const akcent=L=>(L.tor&&L.tor.styl&&L.tor.styl.akcent)||ROZ;
  function semiG(L,g){const p=+g.polton;return Number.isFinite(p)?Math.max(L.dolN,Math.min(L.goraN,Math.round(p))):L.dolN;}
  function rr(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,Math.max(0,w),Math.max(0,h),r);}
  // Prymitywy GPU nie są przycinane do karty toru (w 2D przycina gra), więc zasięgi w poziomie liczy się do lewego
  // brzegu karty, a cząstki pilnują jej krawędzi; inaczej światło wchodziłoby na sąsiedni tor.
  const brzegL=L=>Number.isFinite(L.x)?L.x:L.kx-9;
  const doBrzegu=(L,x)=>Math.max(4,x-brzegL(L)-2);

  // =========================================================================================== bufory sprite'ów
  // Gra czyści bufory przy każdym układzie (klucze żyją do R.wersja++), więc klucz zawiera kolor i ewentualnie rozmiar.
  const plama=k=>bufor("kl|plama|"+k,64,64,c=>{const g=c.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,kA(k,1));g.addColorStop(.3,kA(k,.55));g.addColorStop(.65,kA(k,.16));g.addColorStop(1,kA(k,0));c.fillStyle=g;c.fillRect(0,0,64,64);});
  // Obwódka: poświata z pustym środkiem. W 2D leży NAD podświetlonym klawiszem, więc nie może go zabarwić.
  const obwodka=k=>bufor("kl|obw|"+k,64,64,c=>{const g=c.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,kA(k,0));g.addColorStop(.32,kA(k,0));g.addColorStop(.47,kA(k,.6));g.addColorStop(.72,kA(k,.2));g.addColorStop(1,kA(k,0));
    c.fillStyle=g;c.fillRect(0,0,64,64);});
  // Kropka: jasny środek i miękka otoczka (drobiny, krople, dym w 2D).
  const kropka=k=>bufor("kl|kr|"+k,16,16,c=>{const g=c.createRadialGradient(8,8,0,8,8,8);
    g.addColorStop(0,kA(mieszaj(k,PAPIER,.65),1));g.addColorStop(.38,kA(k,.92));g.addColorStop(1,kA(k,0));c.fillStyle=g;c.fillRect(0,0,16,16);});
  // Gwiazdka czteroramienna (błysk czystej nuty, iskry złota): promienie gasnące ku czubkom i mała plama w środku.
  const gwiazdka=k=>bufor("kl|gw|"+k,48,48,c=>{
    const g=c.createRadialGradient(24,24,0,24,24,11);g.addColorStop(0,kA(PAPIER,.95));g.addColorStop(.45,kA(k,.55));g.addColorStop(1,kA(k,0));
    c.fillStyle=g;c.fillRect(0,0,48,48);
    const p=c.createLinearGradient(0,0,23,0);p.addColorStop(0,kA(mieszaj(k,PAPIER,.55),.95));p.addColorStop(1,kA(k,0));
    c.fillStyle=p;
    for(let i=0;i<4;i++){c.save();c.translate(24,24);c.rotate(i*PI/2);c.beginPath();c.moveTo(0,-1.7);c.lineTo(23,0);c.lineTo(0,1.7);c.closePath();c.fill();c.restore();}
  });

  // =========================================================================================== materiały
  // Materiał rysuje się raz na układ do własnego bufora (klucz: id stopnia, geometria, akcent partii), a tlo kładzie
  // go na buforze kart. Ten sam obraz służy hologramowi do zakłóceń (pasy przesunięte w bok).
  const PAD_L=10,PAD_R=6,PAD_G=8,PAD_D=11;
  // Ciemne szkło: wspólny podkład korektora, kryształu i hologramu; każdy z nich nadpisuje to, co go wyróżnia.
  const szklo=o=>Object.assign({jasny:false,cien:"rgba(60,45,25,.35)",plyta:["#191b25","#252836"],kreska:"rgba(250,246,238,.15)",
    czarny:["#06070b","#13151d"],czarnyBlik:"rgba(255,255,255,.22)",polysk:true,blikSzkla:true,bialy:["#2c3143","#383e55","#434a64"]},o);
  const kosmos=o=>Object.assign({jasny:false,cien:"rgba(40,30,30,.35)",bialy:["#20254a","#283060","#30386d"],kreska:"rgba(200,210,255,.15)",
    czarny:["#05060d","#0f1128"],czarnyBlik:"rgba(190,200,255,.25)",faktura:"gwiazdy"},o);
  const MATERIALY={
    neon:{jasny:true,cien:"rgba(120,90,40,.24)",bialy:["#d9ccb2","#e4d9c3","#eee5d3"],czarny:["#29251f","#3b342d"],
      czarnyBlik:"rgba(255,255,255,.09)",kreska:"rgba(33,31,29,.3)",faktura:"filc",neon:true},
    korektor:szklo({krawedzSzkla:"akcent"}),
    krysztal:szklo({plyta:["#17182b","#252843"],bialy:["#2f3557","#424b78","#56619b"],fasety:true,krawedzSzkla:LIL}),
    zar:{jasny:false,cien:"rgba(60,30,10,.4)",plyta:["#15100d","#251a13"],bialy:["#2b211c","#3a2b23","#47332a"],kreska:"rgba(255,180,120,.14)",
      czarny:["#0b0806","#1a120d"],czarnyBlik:"rgba(255,170,90,.2)",faktura:"zarzewie",krawedz:mieszaj(BURSZ,ROZ,.25)},
    hologram:szklo({bialy:["#2d2a44","#3a3759","#47436c"],faktura:"skan",teczowyRant:true}),
    lod:{jasny:true,cien:"rgba(60,45,25,.35)",plyta:["#122149","#1c316b"],bialy:["#c4d3ec","#d9e4f5","#eef3fb"],kreska:"rgba(41,74,168,.38)",
      czarny:["#10245c","#2a4ba6"],czarnyBlik:"rgba(255,255,255,.5)",faktura:"szron",krawedzSzkla:NIEB_J},
    zloto:{jasny:false,cien:"rgba(60,45,25,.35)",plyta:["#1c1915","#2b2620"],plytaRant:"rgba(234,163,43,.8)",bialy:["#9a6614","#d9952a","#ffd84a","#fff0c0","#e9a62f"],
      kreska:"rgba(64,36,4,.62)",czarny:["#12100d","#262019"],czarnyRant:"rgba(234,163,43,.85)",czarnyBlik:"rgba(255,216,74,.3)",grawer:true,zloto:true},
    portal:kosmos({gestosc:55,plyta:["#0d0e22","#1a1840"],krawedz:LIL}),
    galaktyka:kosmos({gestosc:13,mglawica:true,krawedz:ELEKTR,plyta:["#0c0e21","#1a1a3f"]}),
    upiorna:{jasny:false,cien:"rgba(20,10,30,.42)",plyta:["#151219","#24193a"],plytaRant:"rgba(142,111,230,.42)",bialy:["#2a2630","#332c3c","#3c3348"],
      kreska:"rgba(142,111,230,.24)",czarny:["#0c0a0e","#1a1520"],czarnyBlik:"rgba(166,216,97,.14)",faktura:"pekniecia",pajeczyna:true,krawedz:FIOLET_J}
  };
  // Faktury materiałów (statyczne, w buforze): filc pod czarnymi klawiszami, reszta na wierzchu wszystkich klawiszy.
  const FAKTURA={
    filc(c,x,y,w,h){   // cętki (miękkie jaśniejsze i ciemniejsze plamy), drobny szum i włókna pod różnymi kątami
      const m=Math.min(900,Math.round(w*h/45));
      for(let i=0;i<m;i++){c.fillStyle=i%2?"rgba(120,92,52,.07)":"rgba(255,255,255,.2)";c.beginPath();
        c.arc(x+los(i*3.71+.4)*w,y+los(i*1.93+.8)*h,1.4+los(i*.53+2.2)*2.6,0,TAU);c.fill();}
      const n=Math.min(5000,Math.round(w*h/5));
      c.fillStyle="rgba(110,86,52,.14)";for(let i=0;i<n;i+=2){const r=.6+los(i*.61+3.3)*.8;c.fillRect(x+los(i*1.31+.2)*w,y+los(i*2.77+.9)*h,r,r);}
      c.fillStyle="rgba(255,255,255,.42)";for(let i=1;i<n;i+=2){const r=.6+los(i*.61+3.3)*.7;c.fillRect(x+los(i*1.31+.2)*w,y+los(i*2.77+.9)*h,r,r);}
      c.lineWidth=.55;c.lineCap="round";
      for(const [kol,z] of [["rgba(255,255,255,.5)",0],["rgba(96,72,40,.2)",.5]]){c.strokeStyle=kol;c.beginPath();
        for(let i=0;i<Math.min(1600,w*h/14);i++){const px=x+los(i*2.13+z)*w,py=y+los(i*1.07+z+.3)*h,a=los(i*.77+z)*PI,d=1.2+los(i*4.9+z)*2.2;
          c.moveTo(px,py);c.lineTo(px+Math.cos(a)*d,py+Math.sin(a)*d);}c.stroke();}
    },
    szron(c,x,y,w,h){   // szron: krótkie białe kreski pod różnymi kątami i drobne gwiazdki lodu
      c.lineWidth=.6;c.strokeStyle="rgba(255,255,255,.5)";c.beginPath();
      const n=Math.round(w*h/26);
      for(let i=0;i<n;i++){const px=x+los(i*1.7)*w,py=y+los(i*3.1+.4)*h,a=los(i*.9)*PI,d=1+los(i*5.3)*2.6;c.moveTo(px,py);c.lineTo(px+Math.cos(a)*d,py+Math.sin(a)*d);}
      c.stroke();
      c.strokeStyle="rgba(41,74,168,.22)";c.beginPath();
      for(let i=0;i<n/3;i++){const px=x+los(i*2.3+7)*w,py=y+los(i*1.9+2)*h,d=.8+los(i*4.4)*1.4;
        for(let k=0;k<3;k++){const a=k*PI/3;c.moveTo(px-Math.cos(a)*d,py-Math.sin(a)*d);c.lineTo(px+Math.cos(a)*d,py+Math.sin(a)*d);}}
      c.stroke();
    },
    gwiazdy(c,x,y,w,h,M){   // pył gwiezdny: jasność z rozkładu potęgowego (mało jasnych, dużo słabych), kilka barwnych
      const n=Math.round(w*h/(M.gestosc||16)),barwy=[ZOLTY,ROZ,LIM,NIEB_J];
      for(let i=0;i<n;i++){
        const b=los(i*.77+1.9),a=.12+.88*b*b*b*b,k=los(i*4.1)<.8?PAPIER:barwy[Math.floor(los(i*7.3)*4)],r=b>.94?1.5:b>.72?1:.7;
        c.fillStyle=kA(k,a);c.fillRect(x+los(i*1.13+.7)*w,y+los(i*2.39+.1)*h,r,r);
        if(b>.975){c.fillStyle=kA(PAPIER,.5);c.fillRect(x+los(i*1.13+.7)*w-1.5,y+los(i*2.39+.1)*h+.25,4,.5);}
      }
    },
    skan(c,x,y,w,h){c.fillStyle="rgba(250,246,238,.07)";for(let yy=y+1;yy<y+h;yy+=3)c.fillRect(x,yy,w,1);},
    zarzewie(c,x,y,w,h){   // węgiel: rzadkie tlące się punkty (ciepłe, mało jasnych) i ciemne spękania bryły
      const n=Math.round(w*h/30);
      for(let i=0;i<n;i++){const b=los(i*.91+4.2),a=.06+.5*b*b*b;c.fillStyle=kA(los(i*3.7)<.75?BURSZ:ROZ,a);
        const r=b>.9?1.3:.8;c.fillRect(x+los(i*1.41+.3)*w,y+los(i*2.17+.6)*h,r,r);}
      c.strokeStyle="rgba(0,0,0,.4)";c.lineWidth=.7;c.beginPath();
      for(let i=0;i<Math.max(3,w*h/400);i++){let px=x+los(i*6.1)*w,py=y+los(i*2.9+.2)*h;c.moveTo(px,py);
        for(let j=0;j<3;j++){px+=(los(i*4.3+j)-.5)*6;py+=(los(i*1.7+j*2.1)-.5)*5;c.lineTo(px,py);}}
      c.stroke();
    },
    pekniecia(c,x,y,w,h){   // ciemne drewno: słoje wzdłuż klawiszy i zygzaki pęknięć z fioletowym brzegiem szczeliny
      c.lineWidth=.6;c.strokeStyle="rgba(255,255,255,.05)";c.beginPath();
      for(let yy=y+2;yy<y+h;yy+=2.6){c.moveTo(x,yy);c.quadraticCurveTo(x+w*.5,yy+(los(yy*.37)-.5)*2.2,x+w,yy+(los(yy*.91)-.5)*1.4);}
      c.stroke();
      const n=Math.max(4,Math.round(w*h/240));
      for(const [kol,dx,lw] of [["rgba(8,6,12,.72)",0,.8],["rgba(142,111,230,.24)",.7,.5]]){c.strokeStyle=kol;c.lineWidth=lw;c.beginPath();
        for(let i=0;i<n;i++){let px=x+los(i*2.71+.3)*w+dx,py=y+los(i*1.37+.9)*h;c.moveTo(px,py);
          for(let j=0;j<3;j++){px+=(los(i*5.1+j)-.3)*5;py+=(los(i*3.3+j*1.7)-.5)*4;c.lineTo(px,py);}}
        c.stroke();}
    }
  };
  // Pajęczyna w lewym górnym narożniku klawiatury: szprychy i trzy obwody z lekko obwisłych odcinków.
  function pajeczyna(c,x,y,w,h){
    const R=Math.min(w*.95,h*.3,24),n=5,kat=i=>i/(n-1)*PI/2;
    c.strokeStyle="rgba(214,208,230,.42)";c.lineWidth=.55;c.beginPath();
    for(let i=0;i<n;i++){c.moveTo(x,y);c.lineTo(x+Math.cos(kat(i))*R,y+Math.sin(kat(i))*R);}
    for(const f of [.35,.62,.88]){const r=R*f;
      for(let i=0;i<n-1;i++){const a0=kat(i),a1=kat(i+1),am=(a0+a1)/2,x0=x+Math.cos(a0)*r,y0=y+Math.sin(a0)*r;
        c.moveTo(x0,y0);c.quadraticCurveTo(x+Math.cos(am)*r*.86,y+Math.sin(am)*r*.86,x+Math.cos(a1)*r,y+Math.sin(a1)*r);}}
    c.stroke();
  }
  function klawiszCzarny(c,x,ky,w,rh,M){
    const bw=w*.62,by=ky+.5,bh=Math.max(1,rh-1);
    const g=c.createLinearGradient(x,0,x+bw,0);g.addColorStop(0,M.czarny[0]);g.addColorStop(1,M.czarny[1]);
    c.fillStyle=g;rr(c,x,by,bw,bh,[0,2,2,0]);c.fill();
    if(M.czarnyBlik){c.fillStyle=M.czarnyBlik;c.fillRect(x,by,bw-1.5,Math.max(.7,bh*.2));}
    if(M.czarnyRant){c.strokeStyle=M.czarnyRant;c.lineWidth=.9;rr(c,x+.45,by+.45,bw-.9,bh-.9,[0,1.6,1.6,0]);c.stroke();}
    if(M.faktura==="filc"){c.fillStyle="rgba(255,255,255,.08)";for(let i=0;i<bw*bh/6;i++)c.fillRect(x+los(ky*.37+i*1.9)*bw,by+los(ky*.71+i*2.3)*bh,.8,.8);}
  }
  // Neon: zgaszone rurki w materiale, zapalone w osobnym buforze (gracz kładzie je z alfą = jasność neonu).
  function rurki(c,G,akc,swieci){
    const x=G.kx,y=G.gorna,w=G.kw,h=G.h,rh=G.rh;
    for(const zew of [true,false]){
      c.beginPath();
      if(zew)c.roundRect(x-2,y-2,w+4,h+4,5.5);
      else{if(rh<7)continue;for(let s=G.dolN;s<=G.goraN;s++)if(czarny(s)){const ky=y+(G.goraN-s)*rh;c.roundRect(x+1.3,ky+1.4,w*.62-2.6,rh-2.8,[0,1.5,1.5,0]);}}
      const m=zew?1:.62;
      if(!swieci){c.strokeStyle=kA(akc,.38*m);c.lineWidth=zew?1.6:1.1;c.stroke();continue;}
      c.strokeStyle=kA(akc,.12*m);c.lineWidth=7.5*m;c.stroke();
      c.strokeStyle=kA(akc,.3*m);c.lineWidth=4.2*m;c.stroke();
      c.strokeStyle=kA(akc,.85*m);c.lineWidth=2.2*m;c.stroke();
      c.strokeStyle=kA(mieszaj(akc,PAPIER,.72),m);c.lineWidth=1*m+.2;c.stroke();
    }
  }
  function rysujMaterial(c,G,M,akc){
    const x=G.kx,y=G.gorna,w=G.kw,h=G.h,rh=G.rh;
    if(M.plyta){   // ciemny podkład szerszy od klawiszy: na nim światło dodawane świeci, zamiast bieleć
      c.fillStyle=M.cien;rr(c,x-3,y-2,w+8,h+10,6);c.fill();
      const g=c.createLinearGradient(0,y-5,0,y+h+5);g.addColorStop(0,M.plyta[0]);g.addColorStop(1,M.plyta[1]);
      c.fillStyle=g;rr(c,x-5,y-5,w+8,h+10,6);c.fill();
      if(M.plytaRant){c.strokeStyle=M.plytaRant;c.lineWidth=1;rr(c,x-3.5,y-3.5,w+5,h+7,5);c.stroke();}
      if(M.krawedzSzkla){const k=M.krawedzSzkla==="akcent"?akc:M.krawedzSzkla;   // szkło podświetlane od krawędzi
        c.strokeStyle=kA(k,.18);c.lineWidth=3;rr(c,x-3.6,y-3.6,w+5.2,h+7.2,5);c.stroke();
        c.strokeStyle=kA(mieszaj(k,PAPIER,.35),.75);c.lineWidth=1;rr(c,x-3.6,y-3.6,w+5.2,h+7.2,5);c.stroke();}
      c.strokeStyle=TUSZ;c.lineWidth=1.2;rr(c,x-5,y-5,w+8,h+10,6);c.stroke();
    }else{c.fillStyle=M.cien;rr(c,x+2,y+3,w,h,4);c.fill();}   // twardy cień jak pod domyślną klawiaturą
    const gb=c.createLinearGradient(x,0,x+w,0);M.bialy.forEach((k,i,a)=>gb.addColorStop(i/(a.length-1),k));
    c.fillStyle=gb;rr(c,x,y,w,h,4);c.fill();
    c.save();rr(c,x,y,w,h,4);c.clip();
    if(M.faktura==="filc")FAKTURA.filc(c,x,y,w,h,M);
    if(M.mglawica)for(let i=0;i<3;i++){   // przydymiona mgławica w głębi gwiezdnych klawiszy
      const cy=y+h*(.2+.3*i),r=Math.max(w*1.8,h*.24),k=[ROZ,NIEB_J,LIL][i],g=c.createRadialGradient(x+w*.5,cy,0,x+w*.5,cy,r);
      g.addColorStop(0,kA(k,.2));g.addColorStop(1,kA(k,0));c.fillStyle=g;c.fillRect(x,cy-r,w,2*r);
    }
    for(let s=G.dolN;s<=G.goraN;s++){
      if(czarny(s))continue;
      const ky=y+(G.goraN-s)*rh;
      c.fillStyle=M.kreska;c.fillRect(x,Math.round(ky)-.5,w,1);   // kreska między białymi (górna krawędź rzędu, jak w domyślnej)
      if(M.fasety&&rh>=6){   // szlif: jaśniejsza faseta z przodu klawisza i pryzmat przy krawędzi
        c.fillStyle="rgba(255,255,255,.09)";c.beginPath();c.moveTo(x+w*.42,ky+rh);c.lineTo(x+w,ky+.5);c.lineTo(x+w,ky+rh);c.closePath();c.fill();
        c.strokeStyle="rgba(214,224,255,.32)";c.lineWidth=.7;c.beginPath();c.moveTo(x+w*.42,ky+rh-.3);c.lineTo(x+w-.3,ky+.8);c.stroke();
        c.fillStyle=kA(ROZ,.3);c.fillRect(x+w-2.7,ky+1,.7,rh-2);c.fillStyle=kA(ZOLTY,.26);c.fillRect(x+w-2,ky+1,.7,rh-2);c.fillStyle=kA(NIEB_J,.32);c.fillRect(x+w-1.3,ky+1,.7,rh-2);
      }
      if(M.zloto){c.fillStyle="rgba(255,244,205,.6)";c.fillRect(x,Math.round(ky)+.5,w,.8);}
      if(M.blikSzkla&&rh>=5){c.fillStyle="rgba(255,255,255,.2)";c.fillRect(x+1,Math.round(ky)+.6,w-2,.8);   // błysk górnej krawędzi szkła
        const g=c.createLinearGradient(0,ky,0,ky+rh);g.addColorStop(0,"rgba(255,255,255,.07)");g.addColorStop(1,"rgba(255,255,255,0)");c.fillStyle=g;c.fillRect(x,ky,w,rh*.5);}
      if(M.grawer&&rh>=9&&w>=16){   // grawer nazwy dźwięku: ciemny ryt z jasną krawędzią
        const fs=Math.min(rh*.66,10.5),tx=x+w*.68,ty=ky+rh/2+.4,t=nazwa(s);
        c.font="700 "+fs.toFixed(1)+"px 'JetBrains Mono',monospace";c.textAlign="center";c.textBaseline="middle";
        c.fillStyle="rgba(255,246,214,.6)";c.fillText(t,tx+.6,ty+.6);
        c.fillStyle="rgba(74,42,6,.75)";c.fillText(t,tx,ty);
      }
    }
    for(let s=G.dolN;s<=G.goraN;s++)if(czarny(s))klawiszCzarny(c,x,y+(G.goraN-s)*rh,w,rh,M);
    if(M.faktura&&M.faktura!=="filc")FAKTURA[M.faktura](c,x,y,w,h,M);
    if(M.polysk){   // szkło: ukośne pasy połysku i jasna przednia krawędź
      c.fillStyle="rgba(255,255,255,.065)";
      for(let yy=y+18;yy<y+h+w;yy+=130){c.beginPath();c.moveTo(x,yy);c.lineTo(x+w,yy-w*.8);c.lineTo(x+w,yy-w*.8+16);c.lineTo(x,yy+16);c.closePath();c.fill();}
      c.fillStyle="rgba(255,255,255,.16)";c.fillRect(x+w-1.6,y+2,1,h-4);
    }
    c.restore();
    if(M.neon)rurki(c,G,akc,false);
    if(M.teczowyRant){const g=c.createLinearGradient(0,y,0,y+h);TECZA.forEach((k,i)=>g.addColorStop(i/6,kA(k,.75)));
      c.strokeStyle=g;c.lineWidth=1.6;rr(c,x-.8,y-.8,w+1.6,h+1.6,4.6);c.stroke();}
    if(M.krawedz){c.strokeStyle=kA(M.krawedz,.16);c.lineWidth=3.4;rr(c,x-.5,y-.5,w+1,h+1,4.4);c.stroke();
      c.strokeStyle=kA(M.krawedz,.7);c.lineWidth=1;rr(c,x-.5,y-.5,w+1,h+1,4.4);c.stroke();}
    else{c.strokeStyle=TUSZ;c.lineWidth=1.4;rr(c,x,y,w,h,4);c.stroke();}
    if(M.pajeczyna)pajeczyna(c,x-4,y-4,w,h);
  }
  const geoBufora=L=>({kx:PAD_L,kw:L.kw,gorna:PAD_G,h:wysK(L),rh:L.rh,dolN:L.dolN,goraN:L.goraN});
  const kluczGeo=L=>L.kw+"|"+L.rzedy+"|"+(+L.rh).toFixed(3)+"|"+L.dolN+"|"+akcent(L);
  function materialBuf(L,W){
    return bufor("kl|mat|"+W.id+"|"+kluczGeo(L),PAD_L+L.kw+PAD_R,PAD_G+wysK(L)+PAD_D,c=>rysujMaterial(c,geoBufora(L),W.M,akcent(L)));
  }
  function neonBuf(L,W){
    return bufor("kl|neon|"+W.id+"|"+kluczGeo(L),PAD_L+L.kw+PAD_R,PAD_G+wysK(L)+PAD_D,c=>rurki(c,geoBufora(L),akcent(L),true));
  }

  // =========================================================================================== stan toru i graczy
  // Stan żyje w mapie po obiekcie toru (L.tor; bez niego po samym L) i znika w reset(): gra woła go przy każdym
  // układzie (start piosenki, zmiana okna, zmiana układu torów), a cząstki są w px starego układu.
  let TORY=new Map();
  function stanToru(L){
    const kl=L.tor||L;let T=TORY.get(kl);
    if(!T){T={kl:-1,rysKl:-1,fxKl:-1,akum:0,og:0,cz:[],blyski:[],meteory:[],peki:[],pierscienie:[],duchy:[],
      eq:null,neon:.5,migot:1,glitch:null,gr:new Map(),K:null};TORY.set(kl,T);}
    return T;
  }
  function stanGracza(T,g){
    const kl=g.id!=null?g.id:g;let P=T.gr.get(kl);
    if(!P){P={kl:-1,sp:false,na:false,ko:+g.kombo||0,s:null,tNa:0,tPoza:0,czJuz:false,faJuz:false,ostCz:-9,ostFa:-9,
      moc:0,czysto:0,falsz:0,og:0,wib:0,trzyma:0,szron:0,portal:0,wir:los(T.gr.size+.71)*TAU,kap:0,dynia:0,zgas:0,nDuch:0,
      x:0,y:0,z:{start:false,koniec:false,czysta:false,falsz:false,zmiana:false}};T.gr.set(kl,P);}
    return P;
  }
  // Moc stopnia 0..1 (mocStopnia gry albo ?moc=): skaluje zasięg poświat i wielkość portalu.
  function mocW(W){const m=typeof mocStopnia==="function"?+mocStopnia(W):NaN;return Number.isFinite(m)?przytnij(m,0,1):W.stopien/DRABINKA.length;}
  // Krok toru: raz na klatkę (pierwszy hak toru w klatce), potem stan graczy, reakcje toru i cząstki na stałym kroku.
  function krokToru(L,st,W){
    const T=stanToru(L),K=T.K||(T.K={T,L,st,W,moc:1,akc:ROZ,dt:0});
    K.L=L;K.st=st;K.W=W;
    if(T.kl===st.teraz)return K;
    const dt=T.kl<0?0:przytnij(+st.dt||0,0,.1);T.kl=st.teraz;
    K.dt=dt;K.moc=mocW(W);K.akc=akcent(L);
    T.og=0;
    for(const g of (L.tor&&L.tor.gracze)||[]){const P=krokGr(K,g);if(P.og>T.og)T.og=P.og;}
    for(const r of W.reakcje)if(r.krokTor)r.krokTor(K,dt);
    T.akum=Math.min(T.akum+dt,.1);
    while(T.akum>=KROK){T.akum-=KROK;krokCzastek(T,L,KROK);}
    return K;
  }
  function krokGr(K,g){
    const P=stanGracza(K.T,g),st=K.st;
    if(P.kl===st.teraz)return P;
    const dt=P.kl<0?0:przytnij(+st.dt||0,0,.1);P.kl=st.teraz;
    krokGracza(K,P,g,dt);
    return P;
  }
  // Zdarzenia z różnic stanu gracza: start (śpiewa false→true), koniec, zmiana wysokości (zaokrąglony półton),
  // czysta (na nucie ≥ 0,15 s albo wzrost kombo), fałsz (obok nuty > 0,25 s albo spadek kombo); te same zdarzenia
  // z dwóch źródeł w odstępie < 0,3 s liczą się raz.
  function krokGracza(K,P,g,dt){
    const L=K.L,st=K.st,sp=!!g.spiewa,na=sp&&!!g.naNucie,ko=+g.kombo||0,s=semiG(L,g),ts=+st.ts||0,Z=P.z;
    Z.start=sp&&!P.sp;Z.koniec=!sp&&P.sp;Z.zmiana=sp&&P.sp&&s!==P.s;Z.czysta=false;Z.falsz=false;
    if(na){P.tNa+=dt;P.tPoza=0;}else{P.tNa=0;P.czJuz=false;P.tPoza=sp?P.tPoza+dt:0;}
    if(!sp||na)P.faJuz=false;
    if(Z.start||Z.zmiana){P.czJuz=false;P.trzyma=0;}
    if(na&&P.tNa>=.15&&!P.czJuz){P.czJuz=true;if(ts-P.ostCz>.3){Z.czysta=true;P.ostCz=ts;}}
    if(ko>P.ko&&ts-P.ostCz>.3){Z.czysta=true;P.ostCz=ts;}
    if(sp&&!na&&P.tPoza>.25&&!P.faJuz){P.faJuz=true;if(ts-P.ostFa>.3){Z.falsz=true;P.ostFa=ts;}}
    if(ko<P.ko&&ts-P.ostFa>.3){Z.falsz=true;P.ostFa=ts;}
    const sPop=P.s==null?s:P.s;
    if(sp||P.s==null)P.s=s;   // po puszczeniu efekty gasną na ostatnim śpiewanym klawiszu
    P.sp=sp;P.na=na;P.ko=ko;
    P.moc=sp?ema(P.moc,1,dt,.05):Math.max(0,P.moc-dt/.4);   // gaśnie liniowo 0,4 s po puszczeniu
    P.czysto=ema(P.czysto,na?1:0,dt,na?.06:.2);
    P.falsz=Math.max(0,P.falsz-dt/.7);if(Z.falsz)P.falsz=1;
    P.og=ema(P.og,+g.ogien||0,dt,.3);
    P.wib=Math.min(1,(+g.wib||0)/25);
    if(sp)P.trzyma+=dt;
    P.x=L.kx+L.kw*.5;P.y=yRz(L,P.s);
    if(!st.spokoj)for(const r of K.W.reakcje)if(r.krokGr)r.krokGr(K,P,g,dt,sPop);
  }

  // =========================================================================================== cząstki
  // Typy: 0 kropla (żar spływa w dół klawiatury), 1 odłamek (lód), 2 pył (złoto), 3 dym (zdmuchnięta świeczka
  // upiornej nocy: unosi się, rośnie i rzednie). Krok stały: grawitacja gy, tłumienie lepkie exp(−k·h).
  function emituj(K,o){
    const T=K.T;if(T.cz.length>=(K.st.gl?LIMIT_GL:LIMIT_2D))return;
    o.w=0;o.o=o.o||0;o.vo=o.vo||0;o.gy=o.gy||0;o.k=o.k||0;T.cz.push(o);
  }
  function krokCzastek(T,L,h){
    const cz=T.cz,xMin=L.kx+1.5,xMax=L.kx+L.kw-1.5,yDol=L.gorna+wysK(L)-1;let j=0;
    for(let i=0;i<cz.length;i++){
      const p=cz[i];p.w+=h;if(p.w>=p.zy)continue;
      p.vy+=p.gy*h;
      const t=Math.exp(-p.k*h);p.vx*=t;p.vy*=t;p.x+=p.vx*h;p.y+=p.vy*h;p.o+=p.vo*h;
      if(p.typ===0){if(p.x<xMin)p.x=xMin;else if(p.x>xMax)p.x=xMax;if(p.y>yDol)continue;}
      else if(Number.isFinite(L.h)&&(p.y<L.y+3||p.y>L.y+L.h-3||p.x<L.x+2||p.x>L.x+L.w-2))continue;
      cz[j++]=p;
    }
    cz.length=j;
  }
  function rysujCzastki(D,K){
    const L=K.L,T=K.T,x0=L.kx-5,x1=L.kx+L.kw+3,ciemny=!!K.W.M.plyta&&!K.W.M.jasny;
    for(const p of T.cz){
      const t=p.w/p.zy;let a,r,k=p.kol,ks="kolo";
      if(p.typ===0){a=(1-t)*.95;r=p.r*(1-.45*t);k=t<.3?p.kol[0]:t<.65?p.kol[1]:p.kol[2];}
      else if(p.typ===1){a=Math.min(1,(1-t)*1.7);r=p.r;ks="kwadrat";}
      else if(p.typ===2){a=(1-t)*(.62+.38*Math.sin(p.w*TAU*2.5+p.f));r=p.r;ks=p.r>1.8?"gwiazda":"kolo";}
      else{a=Math.min(1,p.w*6)*(1-t)*.5;r=p.r*(1+1.4*t);}
      const dT=Math.abs(p.x-L.teraz);if(dT<48)a*=dT<24?.25:.25+.75*(dT-24)/24;   // pas linii „teraz”: alfa ≤ 0,25
      const add=ciemny&&p.typ!==3&&p.x>x0&&p.x<x1;   // nad ciemnym podkładem światło, nad papierem barwa; dym nigdy nie świeci
      D.sprite(p.x,p.y,add?r:r*1.15,k,a*D.a,p.o,ks,add?"add":"normal");
    }
  }

  // =========================================================================================== cele rysowania
  // GPU: prymitywy silnika (hak fx, gdy st.gl). 2D: te same wywołania na płótnie #scena w haku gracz (gdy !st.gl),
  // z alfą ×0,6; sprite'y z buforów, lighter tylko nad ciemnym podkładem. Cały 2D jest w save/restore haka.
  const GPU={gl:true,a:1,
    blask:(x,y,rx,ry,k,a,b)=>FX.blask(x,y,rx,ry,k,a,b),
    sprite:(x,y,r,k,a,o,ks,b)=>FX.sprite(x,y,r,k,a,o,ks,b),
    wstega:(p,gr,k,a0,a1,b)=>FX.wstega(p,gr,k,a0,a1,b),
    aura:(x,y,rx,ry,k,a,b)=>FX.blask(x,y,rx,ry,k,a,b)};
  const D2={gl:false,a:ALFA_2D,c:null,
    tryb(b,a){const c=this.c;c.globalCompositeOperation=b==="add"?"lighter":"source-over";c.globalAlpha=przytnij(a,0,1);},
    blask(x,y,rx,ry,k,a,b){if(!(a>.004&&rx>0&&ry>0))return;this.tryb(b,a);this.c.drawImage(plama(k).cv,x-rx,y-ry,2*rx,2*ry);},
    aura(x,y,rx,ry,k,a,b){if(!(a>.004&&rx>0&&ry>0))return;this.tryb(b,a);this.c.drawImage(obwodka(k).cv,x-rx*1.3,y-ry*1.3,rx*2.6,ry*2.6);},
    sprite(x,y,r,k,a,o,ks,b){
      if(!(a>.004&&r>.05))return;const c=this.c;this.tryb(b,a);
      if(ks==="kwadrat"){const w=r*.9,h=r*.56;c.fillStyle=k;c.save();c.translate(x,y);c.rotate(o||0);c.fillRect(-w,-h,2*w,2*h);c.restore();}
      else if(ks==="gwiazda"){const B=gwiazdka(k).cv;if(o){c.save();c.translate(x,y);c.rotate(o);c.drawImage(B,-r,-r,2*r,2*r);c.restore();}else c.drawImage(B,x-r,y-r,2*r,2*r);}
      else c.drawImage(kropka(k).cv,x-r,y-r,2*r,2*r);
    },
    wstega(p,gr,k,a0,a1,b){
      const c=this.c,n=p.length>>1;if(n<2||(a0<.004&&a1<.004))return;
      this.tryb(b,1);c.lineWidth=gr;c.lineCap="round";c.lineJoin="round";
      if(n===2){const g=c.createLinearGradient(p[0],p[1],p[2],p[3]);g.addColorStop(0,kA(k,a0));g.addColorStop(1,kA(k,a1));
        c.strokeStyle=g;c.beginPath();c.moveTo(p[0],p[1]);c.lineTo(p[2],p[3]);c.stroke();return;}
      c.strokeStyle=k;const kaw=Math.abs(a1-a0)<.05?1:Math.min(4,n-1);
      for(let q=0;q<kaw;q++){
        const i0=Math.floor(q*(n-1)/kaw),i1=Math.floor((q+1)*(n-1)/kaw);
        c.globalAlpha=przytnij(a0+(a1-a0)*(i0+i1)/2/(n-1),0,1);
        c.beginPath();c.moveTo(p[2*i0],p[2*i0+1]);for(let i=i0+1;i<=i1;i++)c.lineTo(p[2*i],p[2*i+1]);c.stroke();
      }
    }};
  function elipsa(D,cx,cy,rx,ry,gr,k,a,b,obr){
    if(!(a>.004&&rx>.5&&ry>.5))return;
    const n=Math.max(12,Math.min(20,Math.round((rx+ry)/3)));PK.length=0;
    for(let j=0;j<=n;j++){const t=j/n*TAU+(obr||0);PK.push(cx+Math.cos(t)*rx,cy+Math.sin(t)*ry);}
    D.wstega(PK,gr,k,a,a,b);
  }

  // Nakładki 2D na klawiaturze omijają klawisze śpiewających graczy (ścieżka parzysto-nieparzysta): podświetlenie
  // gracza zostaje w jego kolorze, bez rozjaśnień i przebarwień od światła dodawanego.
  function klipBezGraczy(c,K,x,y,w,h){
    const L=K.L;c.beginPath();c.rect(x,y,w,h);
    for(const P of K.T.gr.values())if(P.moc>.05)c.rect(L.kx-1,yRz(L,P.s)-L.rh/2,L.kw+2,L.rh);
    c.clip("evenodd");
  }
  const zestarz=(Q,dt,dl)=>{let j=0;for(const e of Q){e.w+=dt;if(e.w<(dl?dl(e):e.zy))Q[j++]=e;}Q.length=j;};

  // =========================================================================================== reakcje
  // Reakcja = zestaw haków: krokGr(K,P,g,dt,sPop) i krokTor(K,dt) (stan, emisja na zdarzeniach), nakladkaTor(c,K)
  // i nakladkaGr(c,K,P,g) (2D zawsze, na #scena), swiatloTor(D,K) i swiatloGr(D,K,P,g) (GPU albo 2D), spokoj*(…)
  // (wariant spokojny: stała poświata, nic się nie rusza). Kolejność listy REAKCJE = kolejność rysowania.

  // Baza (stopnie 2–11): śpiewany klawisz delikatnie siada w klawiaturę. Cień tylko przy krawędziach rzędu, środek
  // (podświetlenie gracza) zostaje czysty.
  const R_WGLEB={nakladkaGr(c,K,P){
    if(P.moc<.03)return;
    const L=K.L,M=K.W.M,k=P.moc,y=yRz(L,P.s)-L.rh/2,x=L.kx,w=L.kw,rh=L.rh,cien=M.jasny&&!M.plyta?"52,34,12":"0,0,0";
    const hb=Math.min(rh*.45,3.6),wb=Math.min(w*.2,3);
    c.globalCompositeOperation="source-over";c.globalAlpha=1;
    const g=c.createLinearGradient(0,y,0,y+hb);g.addColorStop(0,"rgba("+cien+","+(.5*k).toFixed(3)+")");g.addColorStop(1,"rgba("+cien+",0)");
    c.fillStyle=g;c.fillRect(x+1,y+.5,w-2,hb);
    const g2=c.createLinearGradient(x,0,x+wb,0);g2.addColorStop(0,"rgba("+cien+","+(.4*k).toFixed(3)+")");g2.addColorStop(1,"rgba("+cien+",0)");
    c.fillStyle=g2;c.fillRect(x+1,y+.5,wb,rh-1);
    c.fillStyle="rgba(255,255,255,"+(.55*k).toFixed(3)+")";c.fillRect(x+1,y+rh-1.6,w-2,1.1);c.fillRect(x+w-2.2,y+1,1.1,rh-2);
  }};
  // Baza wariantu spokojnego: stała obwódka w barwie stopnia, póki gracz śpiewa (bez pulsu i bez wygaszania).
  const R_SPOKOJ={spokojGr(c,K,P,g){
    if(!g.spiewa)return;const L=K.L,k=K.W.pal.spokoj==="akcent"?K.akc:K.W.pal.spokoj,x=L.kx+L.kw*.5,y=yRz(L,semiG(L,g)),rx=L.kw*.75+12,ry=Math.max(L.rh*.9,6)+11;
    c.globalCompositeOperation="source-over";c.globalAlpha=.55;c.drawImage(obwodka(k).cv,x-rx*1.25,y-ry*1.25,rx*2.5,ry*2.5);
  }};
  // Neon: jasność rurek 0,5 w spoczynku, 1 przy czystej nucie; fałsz przygasza i mruga 6,5 Hz (poniżej 8 Hz), gasnąc 0,7 s.
  const R_NEON={
    krokTor(K,dt){
      const T=K.T;let cz=0,fa=0;for(const P of T.gr.values()){cz=Math.max(cz,P.czysto*P.moc);fa=Math.max(fa,P.falsz);}
      T.neon=ema(T.neon,(.5+.5*cz)*(1-.45*fa),dt,.07);T.migot=fa>.02?1-.55*fa*(.5+.5*Math.sin((+K.st.ts||0)*TAU*6.5)):1;
    },
    nakladkaTor(c,K){
      const L=K.L,B=neonBuf(L,K.W),j=przytnij(K.T.neon*K.T.migot,0,1),h=wysK(L);c.globalCompositeOperation="source-over";
      if(j>.55){c.save();klipBezGraczy(c,K,L.kx-16,L.gorna-14,L.kw+32,h+28);c.globalAlpha=(j-.55)*.5;
        c.drawImage(plama(K.akc).cv,L.kx-16,L.gorna-14,L.kw+32,h+28);c.restore();}   // światło rozlane na kartę
      c.globalAlpha=j;c.drawImage(B.cv,L.kx-PAD_L,L.gorna-PAD_G,B.w,B.h);},
    spokojTor(c,K){const L=K.L,B=neonBuf(L,K.W);c.globalCompositeOperation="source-over";c.globalAlpha=.75;c.drawImage(B.cv,L.kx-PAD_L,L.gorna-PAD_G,B.w,B.h);}};
  // Korektor: 12 pasm wzdłuż klawiatury (pasmo 0 na dole), cienkie słupki światła w szkle rosną od tylnej krawędzi.
  // Póki gracz śpiewa, wszystkie pasma tańczą (gładki szum ≤ 3 Hz), a widmo głosu dokłada szczyty przy śpiewanej
  // wysokości i jej harmonicznych (oktawa, kwinta nad oktawą, dwie oktawy); wibrato kołysze pasmami (4,5 Hz), beat
  // dokłada kopnięcie, szczyty trzymają się 0,35 s i opadają. Atak szybki (τ 0,045 s), opadanie stałą prędkością, jak
  // w prawdziwym analizatorze. Klawisze graczy są omijane.
  const HARM=[[0,1],[12,.5],[19,.32],[24,.24],[-12,.16]];
  const R_EQ={
    krokTor(K,dt){
      const L=K.L,T=K.T,E=T.eq||(T.eq={v:new Float32Array(12),pk:new Float32Array(12),pt:new Float32Array(12)});
      const sg=Math.max(1.3,L.rzedy/13),ts=+K.st.ts||0,kop=1-(+K.st.faza||0);
      for(let i=0;i<12;i++){
        const sc=L.dolN+(i+.5)*L.rzedy/12;let cel=.03+.02*Math.sin(ts*.9+i*.7);
        for(const P of T.gr.values()){
          if(P.moc<.02)continue;let v=0;
          for(const hm of HARM){const d=(sc-P.s-hm[0])/sg,e=hm[1]*Math.exp(-d*d);if(e>v)v=e;}
          const tan=.5+.25*Math.sin(ts*TAU*(1.7+.13*i)+i*2.3)+.25*Math.sin(ts*TAU*(2.9-.09*i)+i*.9);   // taniec pasma, gładko
          v=P.moc*(.22+.42*tan+.55*v)*(.82+.18*kop*kop)*(1+.2*P.wib*Math.sin(ts*TAU*4.5+i*1.3))+.06*P.og/3;
          if(v>cel)cel=v;
        }
        cel=przytnij(cel,0,1);const v0=E.v[i];
        E.v[i]=cel>v0?ema(v0,cel,dt,.045):Math.max(cel,v0-dt*1.5);
        if(E.v[i]>=E.pk[i]){E.pk[i]=E.v[i];E.pt[i]=.35;}else{E.pt[i]-=dt;if(E.pt[i]<0)E.pk[i]=Math.max(E.v[i],E.pk[i]-dt*.8);}
      }
    },
    nakladkaTor(c,K){
      const L=K.L,E=K.T.eq;if(!E)return;
      const pal=K.W.pal,jasny=K.W.M.jasny,h=wysK(L),bh=h/12,x0=L.kx+1.5,dl=L.kw-3,g=c.createLinearGradient(x0,0,x0+dl,0);
      g.addColorStop(0,mieszaj(K.akc,TUSZ,.25));g.addColorStop(.6,K.akc);g.addColorStop(1,mieszaj(K.akc,PAPIER,.65));
      const gr=Math.max(1.2,Math.min(bh*.46,7));
      c.save();klipBezGraczy(c,K,L.kx,L.gorna,L.kw,h);
      c.globalCompositeOperation=jasny?"source-over":"lighter";c.fillStyle=g;
      for(let i=0;i<12;i++){const v=E.v[i];if(v<.02)continue;c.globalAlpha=(jasny?.32:.28)+.42*v;c.fillRect(x0,L.gorna+h-(i+.5)*bh-gr/2,v*dl,gr);}
      c.fillStyle=pal.szczyt;c.globalAlpha=jasny?.7:.85;
      for(let i=0;i<12;i++){const pk=E.pk[i];if(pk<.04)continue;c.fillRect(x0+pk*dl-1.2,L.gorna+h-(i+.5)*bh-gr/2-1,1.4,gr+2);}
      c.restore();
    }};
  // Rytm korektora: krawędź ciemnego podkładu błyska na każdą ćwierćnutę i gaśnie do następnej; przy ogniu jaśniej
  // i szerzej. Obraz krawędzi w buforze (raz na układ), co klatkę jedno drawImage z alfą.
  function rantBuf(L,k){
    const h=wysK(L);
    return bufor("kl|rant|"+kluczGeo(L)+"|"+k,PAD_L+L.kw+PAD_R+6,PAD_G+h+PAD_D+6,c=>{
      const x=PAD_L+3,y=PAD_G+3,w=L.kw;
      const st=(a,lw,kk)=>{c.strokeStyle=kA(kk,a);c.lineWidth=lw;rr(c,x-5,y-5,w+8,h+10,6);c.stroke();};
      st(.16,7,k);st(.38,3.4,k);st(.95,1.2,mieszaj(k,PAPIER,.5));
    });
  }
  const R_RYTM={nakladkaTor(c,K){
    const L=K.L,k=K.W.pal.rytm==="akcent"?K.akc:K.W.pal.rytm,f=+K.st.faza||0,a=(.18+.3*K.T.og/3)+(.35+.25*K.T.og/3)*Math.pow(1-f,3);
    const B=rantBuf(L,k);c.globalCompositeOperation="source-over";c.globalAlpha=przytnij(a,0,1);
    c.drawImage(B.cv,L.kx-PAD_L-3,L.gorna-PAD_G-3,B.w,B.h);
  }};
  // Połysk: ukośny pas światła przebiega klawiaturę od dołu. Kryształ: błysk przez 60 % okresu 2 ćwierćnut, potem
  // spoczynek; hologram: szeroka tęcza płynie bez przerwy co 4 ćwierćnuty.
  function polysk(c,K,tecza){
    const L=K.L,h=wysK(L),x=L.kx,w=L.kw,pal=K.W.pal.polysk,f=ulamek((+K.st.beat||0)/(tecza?4:2)),p=tecza?f:Math.min(1,f/.6);
    if(p>=1)return;
    const e=tecza?p:p*p*(3-2*p),szer=tecza?Math.max(24,h*.22):Math.max(10,L.rh*1.4),yc=L.gorna+h+szer-(h+2*szer)*e;
    c.save();klipBezGraczy(c,K,x,L.gorna,w,h);
    c.globalCompositeOperation="lighter";c.globalAlpha=1;
    const g=c.createLinearGradient(0,yc-szer,0,yc+szer);
    if(tecza)TECZA.forEach((k,i)=>g.addColorStop(i/6,kA(k,Math.sin(i/6*PI)*.22)));
    else{g.addColorStop(0,kA(pal[0],0));g.addColorStop(.5,kA(pal[1],K.W.M.jasny?.36:.34));g.addColorStop(1,kA(pal[0],0));}
    c.fillStyle=g;c.beginPath();c.moveTo(x,yc-szer+w*.45);c.lineTo(x+w,yc-szer-w*.45);c.lineTo(x+w,yc+szer-w*.45);c.lineTo(x,yc+szer+w*.45);c.closePath();c.fill();
    c.restore();
  }
  // Kryształ: refleksy szkła w rytm i błysk czystej nuty, gwiazdka o czterech promieniach rośnie i gaśnie w 0,42 s.
  const R_REFL={
    krokGr(K,P){if(!P.z.czysta)return;const B=K.T.blyski;if(B.length>=6)B.shift();B.push({s:P.s,w:0,zy:.42});},
    krokTor(K,dt){zestarz(K.T.blyski,dt);},
    nakladkaTor(c,K){polysk(c,K,false);},
    swiatloTor(D,K){
      const L=K.L,k=K.W.pal.gwiazda,bl=K.W.M.jasny?"normal":"add";
      for(const b of K.T.blyski){const t=b.w/b.zy,r=L.kw*(.9+.8*(1-(1-t)*(1-t)))*(1+.12*K.T.og),a=Math.pow(1-t,1.3)*D.a;
        b.x=L.kx+L.kw*(D.gl?.5:.86);b.y=yRz(L,b.s)-(D.gl?0:L.rh*.3);
        if(D.gl)D.blask(b.x,b.y,r*.55,r*.55,k,.6*a,bl);D.sprite(b.x,b.y,r,k,a,0,"gwiazda",bl);D.sprite(b.x,b.y,r*.55,PAPIER,.8*a,PI/4,"gwiazda",bl);}
    }};
  // Żar: śpiewany klawisz żarzy się od środka (poświata w barwach palety, puls z beatem: na GPU pod podświetleniem
  // klawisza, w 2D jako obwódka), a krople żaru spływają w dół klawiatury i stygną. Spływa w dół, nigdy w górę jak płomień.
  const R_ZAR={
    krokGr(K,P,g,dt){
      if(!P.sp)return;const L=K.L;P.kap+=dt*(6+5*P.og/3)*(K.st.gl?1:.5);
      while(P.kap>=1){P.kap--;emituj(K,{typ:0,x:L.kx+L.kw*losuj(.2,.8),y:yRz(L,P.s)+L.rh*.45,vx:0,vy:losuj(6,18),gy:70,k:2.3,
        zy:losuj(1.1,2.1),r:losuj(1.7,2.7)*(1+.15*P.og/3),kol:K.W.pal.zar});}
    },
    swiatloGr(D,K,P){
      if(P.moc<.03)return;const L=K.L,pal=K.W.pal.zar,x=L.kx+L.kw*.5,y=yRz(L,P.s),puls=.84+.16*Math.pow(1-(+K.st.faza||0),2);
      const a=P.moc*(.6+.2*P.og/3)*puls*D.a,bl=K.W.M.jasny?"normal":"add";
      D.aura(x,y,L.kw*.95,Math.max(L.rh*1.5,10),pal[1],.75*a,bl);D.aura(x,y,L.kw*.62,Math.max(L.rh*.95,7),pal[0],.7*a,bl);
      if(bl==="add")D.aura(x,y,Math.min(L.kw*1.4,doBrzegu(L,x)),Math.max(L.rh*2.4,16),pal[2],.35*a,"normal");
    }};
  // Hologram: tęczowy połysk, linia skanowania co 4 ćwierćnuty, a czysta nuta zakłóca obraz: 3 pasy materiału
  // przesunięte w bok (nowe przesunięcie co 0,125 s = 8 Hz), z barwnymi krawędziami; pasy omijają klawisz gracza.
  const R_HOLO={
    krokGr(K,P){if(P.z.czysta)K.T.glitch={w:0,zy:.25,z:Math.random()*100};},
    krokTor(K,dt){const G=K.T.glitch;if(G){G.w+=dt;if(G.w>=G.zy)K.T.glitch=null;}},
    nakladkaTor(c,K){
      const L=K.L,T=K.T,h=wysK(L),pal=K.W.pal;
      polysk(c,K,true);
      const y=L.gorna+h*ulamek((+K.st.beat||0)/4),gh=Math.min(16,y-L.gorna);
      c.save();klipBezGraczy(c,K,L.kx,L.gorna,L.kw,h);
      c.globalCompositeOperation=K.W.M.jasny?"source-over":"lighter";c.globalAlpha=1;
      if(gh>0){const g=c.createLinearGradient(0,y-gh,0,y);g.addColorStop(0,kA(pal.skan,0));g.addColorStop(1,kA(pal.skan,.2));c.fillStyle=g;c.fillRect(L.kx+1,y-gh,L.kw-2,gh);}
      c.fillStyle=kA(pal.skan,.55);c.fillRect(L.kx+1,y-.75,L.kw-2,1.5);
      c.restore();
      const G=T.glitch;if(!G)return;
      const B=materialBuf(L,K.W),d=B.cv.width/B.w,krok=Math.floor(G.w/.125),zaj=[];
      for(const P of T.gr.values())if(P.moc>.05)zaj.push(yRz(L,P.s));
      for(let i=0;i<3;i++){
        const z=G.z+i*7.3+krok*3.1,wys=L.rh*(1+Math.floor(los(z)*3)),y0=L.gorna+Math.floor(los(z+1.7)*Math.max(1,(h-wys)/L.rh))*L.rh;
        if(zaj.some(yk=>yk>y0-L.rh&&yk<y0+wys+L.rh))continue;
        const dx=(los(z+3.3)<.5?-1:1)*(1.5+los(z+5.1)*2.5);
        c.globalCompositeOperation="source-over";c.globalAlpha=1;
        c.drawImage(B.cv,PAD_L*d,(PAD_G+y0-L.gorna)*d,L.kw*d,wys*d,L.kx+dx,y0,L.kw,wys);
        c.globalCompositeOperation="lighter";c.globalAlpha=.7;c.fillStyle=ROZ;c.fillRect(L.kx+dx,y0,L.kw,1);c.fillStyle=NIEB_J;c.fillRect(L.kx-dx,y0+wys-1,L.kw,1);
      }
    }};
  // Lód: na trzymanym klawiszu rosną kryształki (gałązki z narożników i środków krawędzi, odsłaniane rzędami w
  // 1,1 s); puszczenie albo zmiana klawisza przy szronie > 0,2 rozbija go na odłamki (≤ 12) i rysuje pęknięcie.
  const WZORY_SZRONU=new Map();
  function wzorSzronu(w,rh,war){
    const kl=w+"|"+rh.toFixed(2)+"|"+war;let wz=WZORY_SZRONU.get(kl);if(wz)return wz;
    const seg=[],kor=[[0,0,.6],[w,0,2.3],[0,rh,-.6],[w,rh,-2.3],[w*.55,0,1.57],[w*.45,rh,-1.57]],dl=Math.max(2.2,Math.min(w,rh*1.4)*.3);
    kor.forEach((k,i)=>{
      let x=k[0],y=k[1],a=k[2]+(los(war*3.1+i)-.5)*.6;
      for(let j=0;j<4;j++){
        const d=dl*(1-j*.18),nx=x+Math.cos(a)*d,ny=y+Math.sin(a)*d;seg.push(x,y,nx,ny,j+1);
        for(const sg of [-1,1]){const b=a+sg*1.05,bd=d*.5;seg.push(nx,ny,nx+Math.cos(b)*bd,ny+Math.sin(b)*bd,j+1.5);}
        x=nx;y=ny;a+=(los(war*7.7+i*3+j)-.5)*.5;
      }
    });
    wz={seg,maks:5};WZORY_SZRONU.set(kl,wz);return wz;
  }
  function pekniecie(K,s,moc){
    const L=K.L,T=K.T,y=yRz(L,s),pal=K.W.pal.odlamek,n=ile(4+8*moc,K.st);
    for(let i=0;i<n;i++)emituj(K,{typ:1,x:L.kx+losuj(2,L.kw-2),y:y+losuj(-.4,.4)*L.rh,vx:losuj(20,105),vy:losuj(-70,25),gy:260,k:.5,
      o:losuj(0,TAU),vo:losuj(-9,9),zy:losuj(.55,.95),r:losuj(1.3,3)*(1+.3*moc),kol:pal[i%pal.length]});
    if(T.peki.length>=4)T.peki.shift();T.peki.push({y,w:0,zy:.2,z:Math.random()*50});
  }
  const R_SZRON={
    krokGr(K,P,g,dt,sPop){const Z=P.z;if((Z.koniec||Z.zmiana)&&P.szron>.2)pekniecie(K,sPop,P.szron);P.szron=P.sp?Math.min(1,P.trzyma/1.1):0;},
    krokTor(K,dt){zestarz(K.T.peki,dt);},
    nakladkaGr(c,K,P){
      if(P.szron<.02)return;
      const L=K.L,pal=K.W.pal.szron,y0=yRz(L,P.s)-L.rh/2,x0=L.kx,wz=wzorSzronu(L.kw,L.rh,((P.s%5)+5)%5),gr=P.szron*wz.maks,S=wz.seg;
      c.globalCompositeOperation="source-over";c.globalAlpha=.16*P.szron;c.fillStyle=pal[0];c.fillRect(x0+1,y0+.5,L.kw-2,L.rh-1);   // szklisty nalot
      c.beginPath();for(let i=0;i<S.length;i+=5){if(S[i+4]>gr)continue;c.moveTo(x0+S[i],y0+S[i+1]);c.lineTo(x0+S[i+2],y0+S[i+3]);}
      c.lineCap="round";c.globalAlpha=.3+.3*P.szron;c.strokeStyle=pal[1];c.lineWidth=2;c.stroke();
      c.globalAlpha=.9;c.strokeStyle=pal[0];c.lineWidth=.75;c.stroke();
    },
    nakladkaTor(c,K){
      const L=K.L,pal=K.W.pal.szron;c.globalCompositeOperation="source-over";c.strokeStyle=pal[0];c.lineWidth=1;
      for(const p of K.T.peki){
        const y0=p.y-L.rh/2;c.globalAlpha=(1-p.w/p.zy)*.9;c.beginPath();
        for(let k=0;k<2;k++){let x=L.kx+L.kw*(.2+.5*los(p.z+k)),y=y0;c.moveTo(x,y);for(let j=1;j<=3;j++){x+=(los(p.z+k*3+j)-.5)*L.kw*.4;y+=L.rh/3;c.lineTo(x,y);}}
        c.stroke();
      }
    }};
  // Złoto: iskry wędrują po obwodzie klawiatury i mrugają (≤ 1 Hz), czysta nuta sypie złoty pył z grawitacją.
  const R_ZLOTO={
    krokGr(K,P){
      if(!P.z.czysta)return;const L=K.L,x=L.kx+L.kw*.6,y=yRz(L,P.s),n=ile(9+6*P.og/3,K.st);
      for(let i=0;i<n;i++)emituj(K,{typ:2,x,y:y+losuj(-.3,.3)*L.rh,vx:losuj(25,135),vy:losuj(-115,15),gy:150,k:1.5,zy:losuj(.9,1.5),
        r:losuj(1.1,2.3),f:losuj(0,TAU),kol:[ZOLTY,BURSZ,PAPIER,BURSZ][i%4]});
    },
    swiatloTor(D,K){
      const L=K.L,w=L.kw,h=wysK(L),obw=2*(w+h),ts=+K.st.ts||0,n=4+Math.round(2*K.T.og);
      for(let i=0;i<n;i++){
        let u=ulamek(i/n+ts*.03*(1+K.T.og/3))*obw,x,y;
        if(u<h){x=L.kx;y=L.gorna+h-u;}else if((u-=h)<w){x=L.kx+u;y=L.gorna;}else if((u-=w)<h){x=L.kx+w;y=L.gorna+u;}else{u-=h;x=L.kx+w-u;y=L.gorna+h;}
        const tw=Math.pow(Math.max(0,Math.sin(ts*TAU*.8+i*2.4)),3);D.sprite(x,y,3+3.5*tw,ZOLTY,(.25+.75*tw)*D.a,0,"gwiazda","add");
      }
    }};
  // Portal: wir otwiera się na śpiewanym klawiszu (τ 0,14 s), rośnie z kombo (do ×1,84 przy 24) i zamyka się po
  // puszczeniu. Elipsa pionowa nie szersza od klawiatury, więc wir siedzi na ciemnym podkładzie i nie wchodzi na
  // nazwy dźwięków. Trzy ramiona spirali obracają się (przy ogniu szybciej), obręcz i jasny rdzeń. Otwarcie portalu
  // wypuszcza jeden świetlny pierścień, czysta nuta dwa (drugi 0,12 s później): pierścień rośnie w pionie wzdłuż
  // klawiatury i rzednie w 0,7 s, w poziomie nie wychodzi poza podkład.
  function dodajPierscien(T,s,opoz,k){if(T.pierscienie.length>=6)T.pierscienie.shift();T.pierscienie.push({s,w:0,opoz,zy:.7,k});}
  const R_PORTAL={
    krokGr(K,P,g,dt){
      P.portal=ema(P.portal,P.sp?1:0,dt,P.sp?.14:.1);P.wir+=dt*(2.1+.9*P.og);
      const pal=K.W.pal;if(P.z.start)dodajPierscien(K.T,P.s,0,pal.obrecz);
      if(P.z.czysta){dodajPierscien(K.T,P.s,0,pal.portal[0]);dodajPierscien(K.T,P.s,.12,pal.obrecz);}
    },
    krokTor(K,dt){zestarz(K.T.pierscienie,dt,e=>e.opoz+e.zy);},
    swiatloTor(D,K){
      const L=K.L,rxm=L.kw*.5+3,h=wysK(L);
      for(const p of K.T.pierscienie){
        const t=(p.w-p.opoz)/p.zy;if(t<=0||t>=1)continue;
        const e=1-(1-t)*(1-t),ry0=Math.max(L.rh*1.5,9),ry=Math.min(ry0*(1+2.2*e),h*.5),a=.85*Math.pow(1-t,1.3)*D.a;
        elipsa(D,L.kx+L.kw*.5,yRz(L,p.s),Math.min(rxm,ry*.62),ry,1.6,p.k,a,"add");
      }
    },
    swiatloGr(D,K,P,g){
      const o=P.portal;if(o<.02)return;
      const L=K.L,pal=K.W.pal,cx=L.kx+L.kw*.5,cy=yRz(L,P.s),wzr=1+.035*Math.min(24,+g.kombo||0);
      const ry=(Math.max(L.rh*1.5,9)+5*K.moc)*wzr*o,rx=Math.min(L.kw*.5-1,ry*.62),a=o*D.a;
      for(let i=0;i<3;i++){PK.length=0;
        for(let j=0;j<=8;j++){const f=1-j/8*.82,t=P.wir+i*TAU/3+j*.42;PK.push(cx+Math.cos(t)*rx*f,cy+Math.sin(t)*ry*f);}
        D.wstega(PK,1.8,pal.portal[i%2],.05*a,.85*a,"add");}
      elipsa(D,cx,cy,rx,ry,1.3,pal.obrecz,.75*a,"add",P.wir*.3);
      D.aura(cx,cy,rx*.8,ry*.45,pal.obrecz,.55*a,"add");
    }};
  // Mgławica galaktyki: trzy obłoki dryfują wzdłuż klawiatury (okresy 8–14 s), dodawane, więc świecą na ciemnym
  // podkładzie; w 2D przycięte do podkładu.
  const R_MGLAWICA={swiatloTor(D,K){
    const L=K.L,h=wysK(L),ts=+K.st.ts||0,a=.24*(.85+.15*K.T.og/3)*D.a,k=[K.akc,NIEB_J,ROZ];
    if(!D.gl){D.c.save();rr(D.c,L.kx-5,L.gorna-5,L.kw+8,h+10,6);D.c.clip();}
    for(let i=0;i<3;i++){const y=L.gorna+h*(.2+.3*i)+Math.sin(ts*TAU/(8+3*i)+i)*h*.05,x=L.kx+L.kw*.5+Math.sin(ts*TAU/(11+2*i))*2;
      D.blask(x,y,L.kw*.95,h*.18,k[i],a,"add");}
    if(!D.gl)D.c.restore();
  }};
  // Galaktyka: czysta nuta posyła spadającą gwiazdę po klawiaturze (w dłuższą stronę), z ogonem.
  const R_GAL={
    krokGr(K,P){
      if(!P.z.czysta)return;const L=K.L,M=K.T.meteory,dol=yRz(L,P.s)<L.gorna+wysK(L)*.6;if(M.length>=4)M.shift();
      M.push({x:L.kx+L.kw*losuj(.3,.7),y:yRz(L,P.s),v:(dol?1:-1)*losuj(170,240),w:0,zy:.8});
    },
    krokTor(K,dt){zestarz(K.T.meteory,dt);},
    swiatloTor(D,K){
      const L=K.L,g0=L.gorna,g1=L.gorna+wysK(L);
      for(const m of K.T.meteory){
        const t=m.w/m.zy,a=Math.min(1,(1-t)*2)*D.a,yh=przytnij(m.y+m.v*m.w,g0,g1),dl=Math.min(90,Math.abs(m.v)*Math.min(m.w,.4)),zn=Math.sign(m.v);
        PK.length=0;PK.push(m.x,yh-zn*dl,m.x,yh);
        D.wstega(PK,2.6,PAPIER,0,.95*a,"add");D.wstega(PK,6,ZOLTY,0,.3*a,"add");
        D.sprite(m.x,yh,4.2,ZOLTY,a,0,"gwiazda","add");D.blask(m.x,yh,9,9,PAPIER,.5*a,"add");
      }
    }};
  // Upiorna noc, dynia: śpiewany klawisz świeci od środka jak wycięta dynia ze świeczką. Dwa trójkątne oczy i
  // ząbkowany uśmiech (przy wysokim rzędzie) w pomarańczu dyni z żółtym rdzeniem, płomyk świeczki migocze gładko
  // (2,3 Hz i 5,1 Hz). Poświata dyni: na GPU plama pod klawiszem i obwódka, w 2D sama obwódka. Fałsz zdmuchuje
  // świeczkę: światło gaśnie od razu, wraca liniowo przez 0,9 s, a z klawisza unosi się dymek.
  function dyniaSwiatlo(K,P){
    const ts=+K.st.ts||0;
    return P.dynia*(1-P.zgas)*(.84+.1*Math.sin(ts*TAU*2.3+P.s*1.7)+.06*Math.sin(ts*TAU*5.1+P.s));
  }
  function oczyDyni(c,L,s,a){
    const y=yRz(L,s),x=L.kx,w=L.kw,rh=L.rh;if(rh<6||a<.02)return;
    const e=Math.min(rh*.2,w*.11,3.4),ey=y-(rh>=12?rh*.1:0),usta=rh>=12;
    const sciezka=f=>{c.beginPath();
      for(const ex of [x+w*.34,x+w*.62]){c.moveTo(ex-e*f,ey+e*.8*f);c.lineTo(ex+e*f,ey+e*.8*f);c.lineTo(ex,ey-e*1.1*f);c.closePath();}
      if(usta){const uy=y+rh*.24,ux0=x+w*.26,ux1=x+w*.74,n=4,hz=rh*.12*f;c.moveTo(ux0,uy);
        for(let i=1;i<=n;i++){const xx=ux0+(ux1-ux0)*i/n;c.lineTo(xx-(ux1-ux0)/n*.5,uy+(i%2?hz:-hz*.4));c.lineTo(xx,uy);}
        for(let i=n;i>=0;i--)c.lineTo(ux0+(ux1-ux0)*i/n,uy+hz*1.2+(i%2?0:hz*.5));c.closePath();}};
    c.globalCompositeOperation="source-over";
    c.globalAlpha=przytnij(a,0,1);c.fillStyle=DYNIA;sciezka(1.25);c.fill();
    c.globalAlpha=przytnij(a*.95,0,1);c.fillStyle=ZOLTY;sciezka(.7);c.fill();
  }
  const R_DYNIA={
    krokGr(K,P,g,dt){
      P.dynia=ema(P.dynia,P.sp?1:0,dt,P.sp?.12:.25);P.zgas=Math.max(0,P.zgas-dt/.9);
      if(!P.z.falsz)return;P.zgas=1;
      const L=K.L,y=yRz(L,P.s),n=ile(7,K.st);
      for(let i=0;i<n;i++)emituj(K,{typ:3,x:L.kx+L.kw*losuj(.3,.7),y:y-L.rh*.2,vx:losuj(4,26),vy:losuj(-42,-18),gy:-12,k:1.4,
        zy:losuj(.9,1.4),r:losuj(2,3.2),kol:DYM[i%DYM.length]});
    },
    nakladkaGr(c,K,P){oczyDyni(c,K.L,P.s,dyniaSwiatlo(K,P));},
    swiatloGr(D,K,P){
      const s=dyniaSwiatlo(K,P);if(s<.03)return;
      const L=K.L,x=L.kx+L.kw*.5,y=yRz(L,P.s),a=s*D.a;
      if(D.gl)D.blask(x,y,L.kw*.7,Math.max(L.rh*1.1,8),DYNIA,.6*a,"add");   // światło świeczki pod klawiszem
      D.aura(x,y,L.kw*.9,Math.max(L.rh*1.4,10),DYNIA,.8*a,"add");
      D.aura(x,y,Math.min(L.kw*1.5,doBrzegu(L,x)),Math.max(L.rh*2.4,16),FIOLET_J,.22*a,"normal");
    },
    spokojGr(c,K,P,g){if(g.spiewa)oczyDyni(c,K.L,semiG(K.L,g),.9);}};
  // Upiorna noc, duchy: każda czysta nuta wypuszcza z klawisza na zmianę ducha i nietoperza. Odlatują w głąb toru
  // (do 70 % drogi do linii „teraz”), lekko w górę, kołysząc się 1,4 Hz (nietoperz macha skrzydłami 5 Hz), i znikają
  // w 1,6 s. Rysowane w 2D na #scena (blend normal, nad papierem karty), najwyżej 4 naraz; na GPU i w 2D za każdym
  // leci blada poświata ektoplazmy.
  function duch(c,x,y,r,f){
    c.beginPath();c.moveTo(x-r*.72,y+r*.72);c.lineTo(x-r*.72,y-r*.1);c.arc(x,y-r*.1,r*.72,PI,0);c.lineTo(x+r*.72,y+r*.72);
    for(let i=1;i<=4;i++){const xx=x+r*.72-i*r*.36;c.lineTo(xx+r*.18,y+r*(.46+.08*f));c.lineTo(xx,y+r*.72);}
    c.closePath();
  }
  function nietoperz(c,x,y,r,f){
    const P=[[0,-.3],[.13,-.56],[.22,-.3],[.42,-.28],[1.15,-.25-.45*f],[.92,.1],[.7,-.02],[.52,.22],[.3,.12],[0,.36]];
    c.beginPath();c.moveTo(x+P[0][0]*r,y+P[0][1]*r);
    for(let i=1;i<P.length;i++)c.lineTo(x+P[i][0]*r,y+P[i][1]*r);
    for(let i=P.length-2;i>=0;i--)c.lineTo(x-P[i][0]*r,y+P[i][1]*r);
    c.closePath();
  }
  function polozenieDucha(L,d){
    const t=d.w/d.zy,dist=Math.max(30,(L.teraz-d.x0)*.7),r=przytnij(L.rh*.62,5,9)*(d.typ?1.15:1);
    let y=d.y0-16*t+Math.sin(d.w*TAU*1.4+d.z)*3;if(Number.isFinite(L.h))y=przytnij(y,L.y+r+3,L.y+L.h-r-3);
    const a=Math.min(1,d.w/.15)*(t<.55?1:(1-t)/.45)*.92;
    return {x:d.x0+dist*t*(1.4-.4*t),y,r,a};   // start szybszy, hamuje ku końcowi
  }
  const R_DUCHY={
    krokGr(K,P){if(!P.z.czysta)return;const L=K.L,D=K.T.duchy;if(D.length>=4)D.shift();
      D.push({x0:L.kx+L.kw+2,y0:yRz(L,P.s),w:0,zy:1.6,typ:(P.nDuch++)%2,z:Math.random()*TAU});},
    krokTor(K,dt){zestarz(K.T.duchy,dt);},
    nakladkaTor(c,K){
      const L=K.L,ts=+K.st.ts||0;c.globalCompositeOperation="source-over";c.lineWidth=1;c.lineJoin="round";
      for(const d of K.T.duchy){
        const q=polozenieDucha(L,d);if(q.a<.02)continue;
        if(d.typ===0){
          duch(c,q.x,q.y,q.r,Math.sin(d.w*TAU*1.4+d.z));c.globalAlpha=q.a*.88;c.fillStyle="#f1eef8";c.fill();
          c.globalAlpha=q.a;c.strokeStyle=FIOLET_J;c.stroke();
          c.fillStyle=FIOLET;c.beginPath();c.ellipse(q.x-q.r*.26,q.y-q.r*.14,q.r*.12,q.r*.19,0,0,TAU);c.ellipse(q.x+q.r*.22,q.y-q.r*.14,q.r*.12,q.r*.19,0,0,TAU);c.fill();
        }else{
          nietoperz(c,q.x,q.y,q.r,Math.sin(ts*TAU*5+d.z));c.globalAlpha=q.a;c.fillStyle=TUSZ;c.fill();
          c.strokeStyle=FIOLET;c.stroke();
          c.fillStyle=LIM;c.fillRect(q.x-q.r*.16,q.y-q.r*.2,1.2,1.2);c.fillRect(q.x+q.r*.08,q.y-q.r*.2,1.2,1.2);
        }
      }
    },
    swiatloTor(D,K){
      const L=K.L;
      for(const d of K.T.duchy){const q=polozenieDucha(L,d);if(q.a<.02)continue;D.blask(q.x,q.y,q.r*2,q.r*1.8,LIM,.2*q.a*D.a,"normal");}
    }};
  const R_CZASTKI={swiatloTor:rysujCzastki};
  const REAKCJE={rytm:R_RYTM,korektor:R_EQ,refleksy:R_REFL,holo:R_HOLO,neon:R_NEON,szron:R_SZRON,wglebienie:R_WGLEB,zar:R_ZAR,
    dynia:R_DYNIA,mglawica:R_MGLAWICA,portal:R_PORTAL,galaktyka:R_GAL,zloto:R_ZLOTO,duchy:R_DUCHY,czastki:R_CZASTKI,spokoj:R_SPOKOJ};
  const KOLEJNOSC=Object.keys(REAKCJE);

  // Zestawy cech per id: reakcje własne stopnia (sygnatura) i jego paleta. Baza „wglebienie” i „spokoj” dochodzi do
  // każdego stopnia 2–11 w stopien(); „czastki” tylko tam, gdzie stopień emituje cząstki.
  const ZESTAWY={
    neon:     {cechy:["neon"],                     pal:{spokoj:"akcent"}},
    korektor: {cechy:["korektor","rytm"],          pal:{rytm:"akcent",szczyt:PAPIER,spokoj:"akcent"}},
    krysztal: {cechy:["refleksy"],                 pal:{polysk:[PAPIER,PAPIER],gwiazda:ELEKTR,spokoj:LIL}},
    zar:      {cechy:["zar","czastki"],            pal:{zar:[ZOLTY,BURSZ,ROZ],spokoj:BURSZ}},
    hologram: {cechy:["holo"],                     pal:{skan:PAPIER,spokoj:ELEKTR}},
    lod:      {cechy:["szron","czastki"],          pal:{szron:[PAPIER,NIEB],odlamek:[PAPIER,NIEB_J,mieszaj(NIEB_J,PAPIER,.5)],spokoj:NIEB_J}},
    zloto:    {cechy:["zloto","czastki"],          pal:{spokoj:ZOLTY}},
    portal:   {cechy:["portal"],                   pal:{portal:[LIL,ELEKTR],obrecz:ELEKTR,spokoj:LIL}},
    galaktyka:{cechy:["mglawica","galaktyka"],     pal:{spokoj:ELEKTR}},
    upiorna:  {cechy:["dynia","duchy","czastki"],  pal:{spokoj:DYNIA}}
  };

  // =========================================================================================== stopnie
  function stopien(n,id,nazwa,cecha,opis){
    const W={stopien:n,id,nazwa,cecha,opis,prog:n===1?0:Math.round(30*Math.pow(n-1,1.7))};   // próg jak prog(k) w postepy.js
    if(n===1)return W;   // papier: bez haków gra rysuje domyślną klawiaturę, jak przed progresją
    const Z=ZESTAWY[id],C={wglebienie:true,spokoj:true};for(const k of Z.cechy)C[k]=true;
    W.C=C;W.M=MATERIALY[id];W.pal=Z.pal;W.reakcje=KOLEJNOSC.filter(k=>C[k]).map(k=>REAKCJE[k]);
    W.tlo=function(c,L){const B=materialBuf(L,W);c.drawImage(B.cv,L.kx-PAD_L,L.gorna-PAD_G,B.w,B.h);};
    W.gracz=function(c,L,g,st){
      const K=krokToru(L,st,W),T=K.T,P=krokGr(K,g),pierwszy=T.rysKl!==st.teraz,R=W.reakcje;
      if(pierwszy)T.rysKl=st.teraz;
      c.save();
      try{
        if(st.spokoj){
          if(pierwszy)for(const r of R)if(r.spokojTor)r.spokojTor(c,K);
          for(const r of R)if(r.spokojGr)r.spokojGr(c,K,P,g);
          return;
        }
        if(pierwszy)for(const r of R)if(r.nakladkaTor)r.nakladkaTor(c,K);
        for(const r of R)if(r.nakladkaGr)r.nakladkaGr(c,K,P,g);
        if(!st.gl){
          D2.c=c;
          if(pierwszy)for(const r of R)if(r.swiatloTor)r.swiatloTor(D2,K);
          for(const r of R)if(r.swiatloGr)r.swiatloGr(D2,K,P,g);
        }
      }finally{D2.c=null;c.restore();}
    };
    // Hak fx: płótno #glFx nie ma przycięcia karty z płótna 2D, więc moduł zakłada je sam (FX.klip, ten sam prostokąt co
    // clip w rysujTor) i zdejmuje w finally, żeby nie obcinało prymitywów innych modułów w tej klatce.
    W.fx=function(L,g,st){
      if(st.spokoj||!st.gl||typeof FX==="undefined"||!FX)return;
      const K=krokToru(L,st,W),T=K.T,P=krokGr(K,g),R=W.reakcje,klip=typeof FX.klip==="function"&&Number.isFinite(L.x)&&Number.isFinite(L.h);
      if(klip)FX.klip(L.x+2,L.y+2,L.w-4,L.h-4,14);
      try{
        if(T.fxKl!==st.teraz){T.fxKl=st.teraz;for(const r of R)if(r.swiatloTor)r.swiatloTor(GPU,K);}
        for(const r of R)if(r.swiatloGr)r.swiatloGr(GPU,K,P,g);
      }finally{if(klip)FX.klip();}
    };
    // Bufory sprite'ów stopnia przed piosenką (gra woła rozgrzej po układzie, w pełnej grafice), nie w klatce kombo.
    W.rozgrzej=function(){
      for(const k of [PAPIER,ZOLTY,BURSZ,ROZ,NIEB_J,LIL,ELEKTR,...DYM])kropka(k);
      for(const k of [PAPIER,ZOLTY,BURSZ,ROZ,NIEB_J,LIL,ELEKTR,DYNIA,LIM])plama(k);
      if(C.refleksy)gwiazdka(W.pal.gwiazda);if(C.zloto||C.galaktyka)gwiazdka(ZOLTY);
      for(const k of [PAPIER,ZOLTY,BURSZ,ROZ,NIEB_J,LIL,ELEKTR,DYNIA,FIOLET_J])obwodka(k);
    };
    return W;
  }

  const DRABINKA=[
    stopien(1,"papier","Papier","kremowy papier","Klawiatura z kremowego papieru, taka jak od początku."),
    stopien(2,"neon","Neon","obrys neonem","Klawisze obrysowuje neon w kolorze partii: przy czystej nucie świeci pełnym światłem, przy fałszu mruga i przygasa."),
    stopien(3,"korektor","Korektor","słupki korektora","Klawiatura z ciemnego szkła, w której słupki korektora skaczą razem z Twoim śpiewem, a krawędź błyska w rytm."),
    stopien(4,"krysztal","Kryształ","szlifowane szkło","Szlifowane szklane klawisze łapią refleksy w rytm, a czysta nuta błyska gwiazdą o czterech promieniach."),
    stopien(5,"zar","Żar","żarzące krople","Klawisze z tlącego się węgla: śpiewany żarzy się od środka, a żar spływa kroplami w dół klawiatury i stygnie."),
    stopien(6,"hologram","Hologram","tęczowy skan","Po klawiszach płynie tęczowy połysk i linia skanowania, a czysta nuta zakłóca obraz."),
    stopien(7,"lod","Lód","szron i odłamki","Oszronione klawisze: na trzymanym rośnie szron, a puszczenie rozbija go na odłamki."),
    stopien(8,"zloto","Złoto","grawer i złoty pył","Pozłacane klawisze z grawerem nazw dźwięków, iskry na krawędziach i złoty pył przy czystej nucie."),
    stopien(9,"portal","Portal","wirujący portal","Śpiewany klawisz otwiera wirujący portal, który rośnie z kombo, a czysta nuta wypuszcza z niego świetlne pierścienie."),
    stopien(10,"galaktyka","Galaktyka","gwiezdne klawisze","Gwiezdne klawisze na tle mgławicy, a czysta nuta posyła spadającą gwiazdę po klawiaturze."),
    stopien(11,"upiorna","Upiorna noc","halloweenowa klawiatura","Klawisze z ciemnego, spękanego drewna. Śpiewany świeci jak dynia ze świeczką, czysta nuta wypuszcza ducha albo nietoperza, a fałsz gasi go z dymkiem.")
  ];
  function reset(){TORY=new Map();WZORY_SZRONU.clear();}
  return {DRABINKA,reset};
})();
