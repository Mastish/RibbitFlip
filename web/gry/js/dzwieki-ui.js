"use strict";
// ===== RibbitBeat: punkowe odgłosy interfejsu =====
// Menu, kafelki, suwaki, rozwijanie, wyniki (2026-10-03): punkowe odgłosy UI na klikanie, ocenę końcową,
// przesuwanie i rozwijanie, w klimacie skejterskiego menu: deska, gitara i dzwonek kasy.
// 2026-10-10 przebudowa „większy impakt, bardziej skate”: odgłosy deski + „bum” w dole pasma + crash na nagrodach.
// Wyłącznie synteza WebAudio: zero plików dźwiękowych, zero licencji, zero sampli.
//
//   recepta ─► głos (GainNode) ─► master (głośność) ─► ogranicznik ─► koniec ─┬─► kompresor gry (Glos.celUI)
//                                                                              └─► albo wyjście kontekstu (pomiar)
//
// Zasady:
//  · kontekst jest JEDEN, ten z glos.js (Glos.kontekstUI). Tu nie powstaje żaden AudioContext; dopóki gra nie ma
//    żywego kontekstu (pierwszy gest go budzi), UI milczy bez błędów,
//  · dźwięki UI są podrzędne wobec muzyki gry: domyślnie 0,6 skali, krótkie, mono, bez pogłosu; w trakcie
//    rozgrywki (S.ekran gra/odliczanie bez pauzy) milczą, poza „start”,
//  · wchodzą do kompresora gry ZA jej wyjściem, więc pauza (Glos.wycisz) ich nie ścisza, a wspólny ogranicznik
//    pilnuje sumy z muzyką,
//  · podpięcie bez dotykania zabi-chor.js: delegacja zdarzeń na `document` i obserwator atrybutów `hidden`,
//    `aria-expanded`, `data-ekran`; pad zgłasza się sam z wejscie.js (DzwiekiUI.zglos, oznaczWejscie).
//
// Jedno działanie użytkownika potrafi wywołać kilka zdarzeń naraz (Enter na „Zagraj” = klik + przejście ekranu +
// ruch fokusu). Zgłoszenia z jednej chwili (SKUPIENIE_MS) rozstrzyga PRIORYTET: gra tylko najważniejsze.
//
// Pomiar: DzwiekiUI.renderuj(nazwa, kontekst, opcje) buduje ten sam łańcuch na dowolnym kontekście
// (OfflineAudioContext w smoke poza repozytorium: szczyt ≤ 0,9, długość w zakresie, RMS > 0).
const DzwiekiUI=(function(){
  const KLUCZ="ribbitflip.zabiChor";
  // master przy głośności 1 (przed ogranicznikiem) i stałe ściszenie za nim: ogranicznik (DynamicsCompressor)
  // dokłada własne wzmocnienie wyrównujące, więc dopiero `KONIEC` ustawia poziom końcowy. Strojone pomiarem.
  const POZIOM=.6,KONIEC=.62;
  const SKUPIENIE_MS=16,TLUMIENIE_MS=50,PRZESUN_CO_MS=60,PUNKT_CO_MS=80,PUNKT_PO_WYNIKU_MS=160;
  const PRIORYTET={ruch:1,klik:2,przesun:3,przelacz:4,wstecz:5,rozwin:6,zwin:6,blad:7,start:8,wynik:9,odblokowanie:10};
  const ogr01=v=>Math.max(0,Math.min(1,v));
  let wl=true,gl=.6;
  try{
    const z=JSON.parse(localStorage.getItem(KLUCZ)||"null"),u=z&&z.ust;
    if(u&&typeof u.dzwiekiUI==="boolean")wl=u.dzwiekiUI;
    if(u&&typeof u.dzwiekiUIGlosnosc==="number"&&Number.isFinite(u.dzwiekiUIGlosnosc))gl=ogr01(u.dzwiekiUIGlosnosc);
  }catch(e){}

  // ---- łańcuch: master → ogranicznik → koniec, osobno na każdy kontekst ----------------------------------
  const lancuchy=new WeakMap();
  let zywy=null;   // łańcuch na żywym kontekście gry (ustaw() zmienia jego głośność)
  function lancuch(c,cel,glosnosc){
    let L=lancuchy.get(c);
    if(L&&L.cel===cel)return L;
    const master=c.createGain();master.gain.value=POZIOM*(glosnosc==null?gl:glosnosc);
    const lim=c.createDynamicsCompressor();
    lim.threshold.value=-8;lim.knee.value=0;lim.ratio.value=20;lim.attack.value=.003;   // 3 ms: atak uderzenia przechodzi, ogranicznik łapie dopiero ciałolim.release.value=.06;
    const kon=c.createGain();kon.gain.value=KONIEC;
    master.connect(lim);lim.connect(kon);kon.connect(cel||c.destination);
    L={master,cel,szum:null,krzywe:{}};lancuchy.set(c,L);
    return L;
  }

  // ---- klocki syntezy ----------------------------------------------------------------------------------
  const hz=m=>440*Math.pow(2,(m-69)/12);
  function buforSzumu(c,L){
    if(L.szum)return L.szum;
    const n=Math.round(c.sampleRate*.8),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);let x=987654321;
    for(let i=0;i<n;i++){x=(Math.imul(x,1103515245)+12345)>>>0;d[i]=(x>>>8)/8388608-1;}
    return L.szum=b;
  }
  // przester: tanh o twardości k, znormalizowany do ±1 (symetryczny, bez składowej stałej = bez stuku obwiedni)
  function przester(c,L,k){
    let k1=L.krzywe[k];
    if(!k1){k1=new Float32Array(1025);const n=Math.tanh(k);for(let i=0;i<1025;i++)k1[i]=Math.tanh(k*(i/512-1))/n;L.krzywe[k]=k1;}
    const w=c.createWaveShaper();w.curve=k1;w.oversample="2x";return w;
  }
  // obwiednia „uderzenie”: 0 → szczyt w `atak`, wykładniczo do ciszy w `dl`, potem twarde zero
  function uderzenie(c,dest,t,atak,szczyt,dl){
    const g=c.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(szczyt,t+atak);
    g.gain.exponentialRampToValueAtTime(Math.max(1e-4,szczyt*4e-4),t+dl);g.gain.setValueAtTime(0,t+dl+.001);
    g.connect(dest);return g;
  }
  // obwiednia „pęcznienie”: narasta przez `narost`, trzyma, opada liniowo do zera na końcu `dl`
  function puchnie(c,dest,t,narost,szczyt,dl){
    const g=c.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(szczyt,t+narost);
    g.gain.setValueAtTime(szczyt,t+dl*.7);g.gain.linearRampToValueAtTime(0,t+dl);g.connect(dest);return g;
  }
  function filtr(c,typ,f,q,t,fDo,dl){
    const b=c.createBiquadFilter();b.type=typ;b.Q.value=q||.7;b.frequency.setValueAtTime(f,t);
    if(fDo)b.frequency.exponentialRampToValueAtTime(fDo,t+dl);return b;
  }
  // szum przez filtr (typ, f → fDo) z obwiednią uderzenia
  function szum(c,L,dest,t,o){
    const s=c.createBufferSource();s.buffer=buforSzumu(c,L);
    const f=filtr(c,o.typ||"bandpass",o.f,o.q,t,o.fDo,o.dl);
    const g=o.puchnie?puchnie(c,dest,t,o.atak||.01,o.poz,o.dl):uderzenie(c,dest,t,o.atak||.001,o.poz,o.dl);
    let wy=f;
    if(o.k){const w=przester(c,L,o.k);f.connect(w);wy=w;}
    if(o.am){   // chropowatość (zgrzyt kostki, grind): kwadratowa modulacja amplitudy
      const am=c.createGain();am.gain.value=1-o.am.glebia/2;
      const lfo=c.createOscillator();lfo.type="square";lfo.frequency.setValueAtTime(o.am.od,t);
      if(o.am.do)lfo.frequency.exponentialRampToValueAtTime(o.am.do,t+o.dl);
      const lg=c.createGain();lg.gain.value=o.am.glebia/2;lfo.connect(lg);lg.connect(am.gain);
      wy.connect(am);wy=am;lfo.start(t);lfo.stop(t+o.dl+.02);
    }
    wy.connect(g);s.connect(f);s.start(t,o.offset||0);s.stop(t+o.dl+.02);
  }
  // ton (sinus/trójkąt/kwadrat) z przejazdem wysokości i obwiednią uderzenia
  function ton(c,dest,t,o){
    const os=c.createOscillator();os.type=o.fala||"sine";os.frequency.setValueAtTime(o.f,t);
    if(o.fDo)os.frequency.exponentialRampToValueAtTime(o.fDo,t+(o.jazda||o.dl));
    const g=uderzenie(c,dest,t,o.atak||.001,o.poz,o.dl);
    os.connect(g);os.start(t);os.stop(t+o.dl+.02);
  }
  // brudna gitara: piły (każda struna w parze rozstrojonej ±8 ct) → przester → dolnoprzepustowy → obwiednia.
  // `strum`: kolejne struny startują co tyle sekund (szarpnięcie kostką), `jazda`: wysokość z `zJazdy`× w dół/górę.
  function gitara(c,L,dest,t,o){
    const pre=c.createGain();pre.gain.value=.9/o.nuty.length;
    const sh=przester(c,L,o.k||6);
    const lp=filtr(c,"lowpass",o.lp||2800,o.q||.9,t,o.lpDo,o.dl);
    const g=uderzenie(c,dest,t,o.atak||.002,o.poz,o.dl);
    pre.connect(sh);sh.connect(lp);lp.connect(g);
    o.nuty.forEach((m,i)=>{
      const t0=t+i*(o.strum||0),f=hz(m);
      for(const det of [-8,8]){
        const os=c.createOscillator();os.type="sawtooth";os.detune.value=det;
        if(o.zJazdy){os.frequency.setValueAtTime(f*o.zJazdy,t0);os.frequency.exponentialRampToValueAtTime(f,t0+o.jazda);}
        else os.frequency.setValueAtTime(f,t0);
        os.connect(pre);os.start(t0);os.stop(t+o.dl+.02);
      }
    });
  }
  // okrzyk tłumu „hej!”: cztery gardła (piły) i przydech przez formanty e → j, lekki przester (krzyk)
  function hej(c,L,dest,t,poz){
    const dl=.17,mix=c.createGain();mix.gain.value=1;
    [176,203,231,262].forEach((f,i)=>{
      const os=c.createOscillator();os.type="sawtooth";const t0=t+i*.007;
      os.frequency.setValueAtTime(f*1.12,t0);os.frequency.exponentialRampToValueAtTime(f,t0+.05);
      os.frequency.exponentialRampToValueAtTime(f*.86,t+dl);
      const og=c.createGain();og.gain.value=.22;os.connect(og);og.connect(mix);os.start(t0);os.stop(t+dl+.02);
    });
    const s=c.createBufferSource();s.buffer=buforSzumu(c,L);s.start(t,.3);s.stop(t+dl+.02);
    const hp=filtr(c,"highpass",900,.7,t);const hg=uderzenie(c,mix,t,.003,.9,.06);s.connect(hp);hp.connect(hg);
    const suma=c.createGain();suma.gain.value=1;
    for(const [f,q,a,fDo] of [[560,4,1,null],[1850,6,.7,2350],[2600,8,.3,null]]){
      const b=filtr(c,"bandpass",f,q,t,fDo,dl);const bg=c.createGain();bg.gain.value=a;mix.connect(b);b.connect(bg);bg.connect(suma);
    }
    const sh=przester(c,L,2.5);suma.connect(sh);
    sh.connect(puchnie(c,dest,t,.012,poz,dl));
  }
  // dzwonek kasy („ching”): niecharmoniczne alikwoty jak w dzwonku, szybki atak, wybrzmienie `dl`
  function dzwonek(c,dest,t,f,poz,dl){
    for(const [m,a] of [[1,1],[2.76,.5],[5.4,.28],[8.93,.12]])ton(c,dest,t,{f:f*m,poz:poz*a,dl:dl/Math.sqrt(m),atak:.002});
  }
  // „bum”: sinus z szybkim zjazdem wysokości (stopa perkusji / uderzenie deski o beton). Obwiednia PRZED przesterem,
  // więc przester gniecie tylko atak (mięso uderzenia), a wybrzmienie zostaje czystym dołem.
  function bum(c,L,dest,t,o){
    const os=c.createOscillator();os.type="sine";os.frequency.setValueAtTime(o.f,t);
    os.frequency.exponentialRampToValueAtTime(o.fDo,t+(o.jazda||.05));
    const wy=c.createGain();wy.gain.value=o.poz;wy.connect(dest);
    const sh=przester(c,L,o.k||1.6);sh.connect(wy);
    os.connect(uderzenie(c,sh,t,o.atak||.001,1,o.dl));os.start(t);os.stop(t+o.dl+.02);
  }
  // „klak” deski: suchy trzask drewna (szum przez rezonans klonu, lekko przesterowany), twardy klik na wierzchu
  // i krótkie ciało sklejki. `f` rezonans, `cialo` wysokość ciała, `offset` inny kawałek szumu = inny klak.
  function deska(c,L,dest,t,o){
    const dl=o.dl||.025,cialo=o.cialo||230;
    szum(c,L,dest,t,{typ:"bandpass",f:o.f||1400,q:o.q||4,k:2.2,poz:o.poz,dl,offset:o.offset||0});
    szum(c,L,dest,t,{typ:"highpass",f:4500,q:.7,poz:o.poz*.45,dl:.006,offset:(o.offset||0)+.31});
    ton(c,dest,t,{fala:"triangle",f:cialo,fDo:cialo*.6,poz:o.poz*.85,dl:dl*1.8});
  }
  // talerz crash: sześć kwadratów o niecharmonicznych częstotliwościach (metal jak w 808) przez górnoprzepustowy
  // i szum w górze pasma; ostry atak, długie wybrzmienie `dl`
  function talerz(c,L,dest,t,poz,dl){
    const mix=c.createGain();mix.gain.value=.16;
    for(const f of [205.3,304.4,369.6,522.7,540,800]){
      const os=c.createOscillator();os.type="square";os.frequency.value=f*2.3;os.connect(mix);os.start(t);os.stop(t+dl+.02);
    }
    const hp=filtr(c,"highpass",6200,.8,t);mix.connect(hp);hp.connect(uderzenie(c,dest,t,.0015,poz,dl));
    szum(c,L,dest,t,{typ:"highpass",f:5200,q:.7,poz:poz*.9,dl:dl*.75,offset:.05});
  }
  // świst deski w powietrzu (kickflip): szum przez pasmo jadące `f` → `fDo`, narasta i gaśnie
  function swist(c,L,dest,t,o){
    szum(c,L,dest,t,{typ:"bandpass",f:o.f,fDo:o.fDo,q:o.q||1.6,poz:o.poz,dl:o.dl,puchnie:true,atak:o.dl*.6,offset:o.offset||.12});
  }

  // ---- recepty: nazwa → {dl: długość w s, wzm: dB, graj(c, L, wy, t, wariant)} ----------------------------
  // 2026-10-10 (większy impakt, bardziej skate): każda recepta to odgłos deski, nie instrumentu (kółka na
  // fudze chodnika, pop ollie z lądowaniem, grind po rurze, kickflip, bail), a pod każdą siedzi „bum” w dole pasma.
  // `wzm` wyrównuje głośność zestawu: RMS przez łańcuch gry przy głośności 0,6 ok. −27 dBFS dla nawigacji, −21 dla
  // wyborów i −19 dla nagród (nagrody dociska ogranicznik), przy muzyce gry ok. −13 dBFS RMS (pomiar skryptem offline, nie ucho).
  // Trzy poziomy wagi (zasada UI audio): nawigacja (ruch, przesun) najlżejsza i najkrótsza, wybór (klik, przelacz,
  // rozwin/zwin, wstecz) większy i warstwowy, potwierdzenie i nagroda (start, wynik) największe, z talerzem.
  // Sweep w górę = zysk/otwarcie, w dół = strata/powrót.
  let nrRuchu=0;
  const WARIANTY_RUCHU=[{f:1500,cialo:260,od:.05},{f:1300,cialo:235,od:.21},{f:1700,cialo:285,od:.37}];
  const RECEPTY={
    // kółka deski przejeżdżają przez fugę chodnika: „tk-tk” (przednia i tylna oś), pod spodem krótki stuk w dół.
    // Trzy warianty po kolei i losowe ±3 % wysokości, żeby setki powtórzeń w menu nie męczyły.
    ruch:{dl:.034,wzm:-1.5,graj(c,L,wy,t){
      const v=WARIANTY_RUCHU[nrRuchu++%3],p=1+(Math.random()*2-1)*.03;
      deska(c,L,wy,t,{f:v.f*p,q:3,cialo:v.cialo*p,poz:.32,dl:.012,offset:v.od});
      deska(c,L,wy,t+.017,{f:v.f*p*.9,q:3,cialo:v.cialo*p*.92,poz:.22,dl:.012,offset:v.od+.07});
      bum(c,L,wy,t,{f:150,fDo:85,jazda:.02,poz:.2,dl:.03,k:1.2});
    }},
    // ollie: trzask ogona o beton (pop) z ciężkim „bum” i przesterowanym E5, a po chwili lądowanie czterech kółek.
    klik:{dl:.115,wzm:-2,graj(c,L,wy,t){
      deska(c,L,wy,t,{f:1250,q:5,cialo:210,poz:.5,dl:.022,offset:.02});
      bum(c,L,wy,t,{f:170,fDo:48,jazda:.04,poz:.55,dl:.09,k:2.2});
      gitara(c,L,wy,t+.004,{nuty:[40,47,52],k:10,zJazdy:.94,jazda:.02,lp:2600,lpDo:900,poz:.26,dl:.1});
      deska(c,L,wy,t+.072,{f:950,q:3,cialo:170,poz:.3,dl:.018,offset:.44});
      bum(c,L,wy,t+.072,{f:110,fDo:45,jazda:.03,poz:.3,dl:.04,k:1.4});
    }},
    // grind po rurze: metaliczny „klank” wejścia na rurę, potem zgrzyt trucka (dwa rezonanse stali, chropowaty)
    // i dudnienie rury pod spodem.
    przesun:{dl:.058,wzm:1.5,graj(c,L,wy,t){
      for(const [f,a] of [[1180,1],[1760,.7],[2630,.5]])ton(c,wy,t,{fala:"triangle",f,poz:.12*a,dl:.03});
      szum(c,L,wy,t,{typ:"bandpass",f:1900,fDo:2600,q:10,k:4,poz:.36,dl:.055,atak:.003,am:{od:170,do:260,glebia:.7}});
      szum(c,L,wy,t,{typ:"bandpass",f:3300,q:12,k:3,poz:.2,dl:.05,atak:.003,am:{od:230,glebia:.6},offset:.3});
      szum(c,L,wy,t,{typ:"lowpass",f:280,q:1,poz:.3,dl:.055,atak:.003,offset:.5});
      bum(c,L,wy,t,{f:130,fDo:70,jazda:.03,poz:.22,dl:.045,k:1.3});
    }},
    // kickflip na otwarcie: świst deski w górę, riff basowy jadący z dołu i łapanie deski nogami („klak” + „bum”).
    rozwin:{dl:.19,wzm:1,graj(c,L,wy,t){
      swist(c,L,wy,t,{f:700,fDo:4200,poz:.32,dl:.13});
      gitara(c,L,wy,t+.02,{nuty:[40,47],k:8,zJazdy:.5,jazda:.11,lp:1300,lpDo:3400,poz:.2,dl:.16,atak:.02});
      deska(c,L,wy,t+.13,{f:1150,q:4,cialo:200,poz:.42,dl:.02,offset:.26});
      bum(c,L,wy,t+.13,{f:150,fDo:45,jazda:.04,poz:.48,dl:.06,k:2});
    }},
    // zamknięcie: świst w dół, struna zjeżdżająca od oktawy do dna i ciężkie lądowanie.
    zwin:{dl:.17,wzm:1.5,graj(c,L,wy,t){
      swist(c,L,wy,t,{f:3800,fDo:600,poz:.28,dl:.11,offset:.2});
      gitara(c,L,wy,t+.01,{nuty:[40,47],k:8,zJazdy:2,jazda:.11,lp:3000,lpDo:700,poz:.18,dl:.15,atak:.008});
      deska(c,L,wy,t+.11,{f:900,q:3,cialo:160,poz:.36,dl:.02,offset:.6});
      bum(c,L,wy,t+.11,{f:120,fDo:38,jazda:.04,poz:.5,dl:.055,k:2});
    }},
    // „record scratch, DJ”: scratch płyty tam i z powrotem („wikka”), zakończony zjazdem w dół
    // (= powrót), z uderzeniem na początku.
    wstecz:{dl:.09,wzm:-4,graj(c,L,wy,t){
      const os=c.createOscillator();os.type="sawtooth";
      os.frequency.setValueAtTime(260,t);os.frequency.exponentialRampToValueAtTime(820,t+.022);
      os.frequency.exponentialRampToValueAtTime(150,t+.08);
      const bp=c.createBiquadFilter();bp.type="bandpass";bp.Q.value=2.4;
      bp.frequency.setValueAtTime(1200,t);bp.frequency.exponentialRampToValueAtTime(3000,t+.022);
      bp.frequency.exponentialRampToValueAtTime(600,t+.08);
      const sh=przester(c,L,5);const g=puchnie(c,wy,t,.004,.42,.085);
      os.connect(bp);bp.connect(sh);sh.connect(g);os.start(t);os.stop(t+.1);
      szum(c,L,wy,t+.02,{typ:"bandpass",f:3000,fDo:900,q:2,poz:.18,dl:.065,puchnie:true,atak:.006,offset:.4});
      bum(c,L,wy,t,{f:140,fDo:50,jazda:.03,poz:.42,dl:.05,k:1.8});
    }},
    // klank trucka (metal o metal) i stuk deski; włączenie wyżej, wyłączenie niżej (wariant "wl" / "wyl").
    przelacz:{dl:.08,wzm:.5,graj(c,L,wy,t,wariant){
      const p=wariant==="wyl"?.74:1;
      deska(c,L,wy,t,{f:1600*p,q:4,cialo:300*p,poz:.34,dl:.014,offset:.15});
      for(const [f,a] of [[1430,1],[2170,.75],[3390,.5],[4710,.3]])ton(c,wy,t+.002,{fala:"triangle",f:f*p,poz:.15*a,dl:.07});
      bum(c,L,wy,t,{f:160*p,fDo:70*p,jazda:.025,poz:.36,dl:.045,k:1.6});
    }},
    // bail: deska wylatuje spod nóg, ciało ląduje na betonie (ciężkie, przesterowane „bum”), a deska koziołkuje
    // trzema coraz cichszymi klakami.
    blad:{dl:.22,wzm:-5.5,graj(c,L,wy,t){
      bum(c,L,wy,t,{f:110,fDo:32,jazda:.09,poz:.7,dl:.16,k:3});
      szum(c,L,wy,t,{typ:"lowpass",f:520,q:.8,k:2,poz:.45,dl:.08,offset:.5});
      [[.06,1200,.3],[.11,1450,.22],[.16,1050,.15]].forEach(([dt,f,a],i)=>
        deska(c,L,wy,t+dt,{f,q:4,cialo:190+i*30,poz:a,dl:.016,offset:.1+i*.13}));
    }},
    // drop in („go!” po skejtersku): trzy szybkie piknięcia w górę, potem uderzenie ogona o rampę, crash
    // i przesterowany akord E5 jadący w górę.
    start:{dl:.45,wzm:3,graj(c,L,wy,t){
      [[81,0],[85,.05],[88,.1]].forEach(([m,dt])=>ton(c,wy,t+dt,{fala:"square",f:hz(m),poz:.08,dl:.035,atak:.002}));
      const t1=t+.15;
      deska(c,L,wy,t1,{f:1300,q:5,cialo:220,poz:.45,dl:.022,offset:.33});
      bum(c,L,wy,t1,{f:180,fDo:42,jazda:.06,poz:.65,dl:.17,k:2.5});
      gitara(c,L,wy,t1,{nuty:[40,47,52,59],strum:.008,k:10,zJazdy:.94,jazda:.03,lp:1800,lpDo:5200,poz:.26,dl:.28,atak:.004});
      talerz(c,L,wy,t1,.13,.3);
    }},
    // lądowanie z wynikiem: „bum”, crash, rozerwany akord E5, kasa „cha-ching” (zgrzyt mechanizmu + dzwonek)
    // i okrzyk tłumu „hej!”.
    wynik:{dl:.66,wzm:3,graj(c,L,wy,t){
      deska(c,L,wy,t,{f:1200,q:4,cialo:210,poz:.42,dl:.022,offset:.71});
      bum(c,L,wy,t,{f:170,fDo:40,jazda:.07,poz:.65,dl:.2,k:2.5});
      talerz(c,L,wy,t,.13,.55);
      gitara(c,L,wy,t,{nuty:[40,47,52,59],strum:.012,k:10,lp:3200,lpDo:900,poz:.24,dl:.58});
      szum(c,L,wy,t+.07,{typ:"bandpass",f:3300,q:2.5,poz:.2,dl:.045,am:{od:90,glebia:.8},offset:.25});   // „cha”
      dzwonek(c,wy,t+.12,2093,.12,.45);                                                               // „ching”
      hej(c,L,wy,t+.28,.17);
    }},
    // Awans stopnia / odblokowanie osiągnięcia (tor C woła DzwiekiUI.graj("odblokowanie"), bez haka DOM): dwa
    // lądowania, rozerwany akord w górę o kwintę (E5 → B5, sweep w górę = zysk), crash i dzwonek kasy na szczycie, „hej!”.
    odblokowanie:{dl:.8,wzm:3.5,graj(c,L,wy,t){
      const t1=t+.18;
      bum(c,L,wy,t,{f:160,fDo:45,jazda:.06,poz:.5,dl:.14,k:2.2});
      deska(c,L,wy,t,{f:1200,q:4,cialo:210,poz:.36,dl:.02,offset:.12});
      gitara(c,L,wy,t,{nuty:[40,47,52],strum:.01,k:10,lp:2600,lpDo:1400,poz:.22,dl:.22});
      deska(c,L,wy,t1,{f:1350,q:5,cialo:230,poz:.45,dl:.022,offset:.55});
      bum(c,L,wy,t1,{f:180,fDo:40,jazda:.07,poz:.7,dl:.2,k:2.6});
      talerz(c,L,wy,t1,.14,.58);
      gitara(c,L,wy,t1,{nuty:[47,54,59,66],strum:.01,k:10,zJazdy:.94,jazda:.03,lp:3600,lpDo:1000,poz:.24,dl:.58});
      szum(c,L,wy,t1+.06,{typ:"bandpass",f:3300,q:2.5,poz:.18,dl:.04,am:{od:90,glebia:.8},offset:.25});   // „cha”
      dzwonek(c,wy,t1+.1,3136,.12,.45);                                                               // „ching” na szczycie
      hej(c,L,wy,t1+.2,.18);
    }},
    // dzwonek napiwku przy nabijaniu punktów na karcie wyników, co kilka klatek coraz wyżej (wariant = numer
    // tyknięcia); „coin” z sfxr: natychmiastowy atak, krótki zanik, zero podtrzymania.
    dzwonekPunkt:{dl:.035,wzm:8,graj(c,L,wy,t,wariant){
      const n=Math.max(0,Math.min(12,wariant|0)),f=hz(84+n);
      ton(c,wy,t,{fala:"triangle",f,poz:.07,dl:.03,atak:.001});ton(c,wy,t,{f:f*2.76,poz:.025,dl:.02,atak:.001});
    }}};
  const NAZWY=Object.keys(PRIORYTET);

  // ---- granie --------------------------------------------------------------------------------------------
  function ekranGry(){try{return typeof S!=="undefined"&&S?S.ekran:null;}catch(e){return null;}}
  function pauza(){try{return typeof S!=="undefined"&&S&&!!S.pauza;}catch(e){return false;}}
  // rozgrywka bez pauzy: UI milczy (muzyka ma pierwszeństwo), wyjątkiem jest „start”
  function wGrze(){const e=ekranGry();return (e==="gra"||e==="odliczanie")&&!pauza();}
  function kontekstZywy(){
    const c=typeof Glos!=="undefined"&&Glos&&Glos.kontekstUI?Glos.kontekstUI():null;
    return c&&c.state==="running"?c:null;
  }
  const licznik={zadane:{},zagrane:{}},ostatnie=[];
  function graj(nazwa,wariant){
    const r=RECEPTY[nazwa];if(!r)return false;
    licznik.zadane[nazwa]=(licznik.zadane[nazwa]||0)+1;
    let ok=wl&&gl>0&&(nazwa==="start"||!wGrze())&&!(typeof S!=="undefined"&&S&&S.probaEkranow);   // próba ekranów pod zasłoną startu: cisza
    const c=ok?kontekstZywy():null;ok=!!c;
    ostatnie.push({nazwa,ok});if(ostatnie.length>40)ostatnie.shift();
    if(!ok)return false;
    try{
      const L=lancuch(c,Glos.celUI?Glos.celUI():null);zywy=L;
      const wy=c.createGain();wy.gain.value=Math.pow(10,(r.wzm||0)/20);wy.connect(L.master);
      r.graj(c,L,wy,c.currentTime+.002,wariant);
      setTimeout(()=>{try{wy.disconnect();}catch(e){}},(r.dl+.4)*1000);
    }catch(e){return false;}
    licznik.zagrane[nazwa]=(licznik.zagrane[nazwa]||0)+1;
    return true;
  }
  // Render na dowolnym kontekście (pomiar offline): opcje.glosnosc (domyślnie bieżąca), opcje.cel (węzeł zamiast
  // wyjścia kontekstu, np. Glos.celUI() po Glos.kontekst(offline), żeby usłyszeć dokładnie to, co w grze), opcje.t.
  function renderuj(nazwa,c,opcje){
    const r=RECEPTY[nazwa],o=opcje||{};if(!r||!c)return null;
    const L=lancuch(c,o.cel||null,o.glosnosc);
    L.master.gain.value=POZIOM*(o.glosnosc==null?gl:ogr01(+o.glosnosc));
    const wy=c.createGain();wy.gain.value=Math.pow(10,(r.wzm||0)/20);wy.connect(L.master);
    r.graj(c,L,wy,o.t||0,o.wariant);
    return r.dl;
  }
  function ustaw(o){
    o=o||{};
    if(typeof o.wlaczone==="boolean")wl=o.wlaczone;
    if(o.glosnosc!=null&&Number.isFinite(+o.glosnosc))gl=ogr01(+o.glosnosc);
    if(zywy){try{const g=zywy.master.gain,c=g.context||null,t=c?c.currentTime:0;g.cancelScheduledValues(t);g.setTargetAtTime(POZIOM*gl,t,.02);}catch(e){}}
    return {wlaczone:wl,glosnosc:gl};
  }

  // ---- rozstrzyganie: z kilku zgłoszeń jednej chwili gra jedno, najważniejsze ------------------------------
  let kolejka=[],czasomierz=0,ostatni={t:-1e9,p:0},ostPrzesun=-1e9,ostPunkt=-1e9,nrPunktu=0,wynikiOd=0;
  function zglos(nazwa,wariant){
    if(!PRIORYTET[nazwa])return;
    kolejka.push([nazwa,wariant]);
    if(!czasomierz)czasomierz=setTimeout(rozstrzygnij,SKUPIENIE_MS);
  }
  function rozstrzygnij(){
    czasomierz=0;const lista=kolejka;kolejka=[];
    let naj=null;for(const z of lista)if(!naj||PRIORYTET[z[0]]>PRIORYTET[naj[0]])naj=z;
    if(!naj)return;
    const [n,w]=naj;
    if(n!=="start"&&wGrze())return;
    const teraz=Date.now();
    if(n==="przesun"&&teraz-ostPrzesun<PRZESUN_CO_MS)return;
    if(teraz-ostatni.t<TLUMIENIE_MS&&PRIORYTET[n]<=ostatni.p)return;
    if(n==="przesun")ostPrzesun=teraz;
    ostatni={t:teraz,p:PRIORYTET[n]};
    api.graj(n,w);
  }

  // ---- podpięcie: delegacja zdarzeń i obserwator atrybutów ----------------------------------------------
  let wejscie="brak";   // ostatnie wejście: "mysz" | "klawiatura" | "pad"; "brak" = jeszcze żadnego gestu
  const STREFY="#lobby,#wyniki,#pauza,#tablica,#okno,#wyborGracza,.szuflada,#kontoOkno,#profileOkno,#smPytanie";   // okna z konta.js, profile.js, jak-grac.js (A-09)
  const KLIKALNE="button,a[href],[role=button],[role=tab],[role=radio],[role=switch],[role=checkbox],summary,label,input,select";
  const NAJAZD="button,a[href],[role=tab],[role=radio],[role=switch],select,input[type=range]";
  const GLEBOKOSC={menu:0,utwory:1,wybor:1,konfiguracja:2};
  // okna: pokazanie → dźwięk; schowanie → „zwin” (poza wynikami i pauzą: z nich wychodzi się ekranem albo grą)
  const OKNA={szuflada:"rozwin",okno:"rozwin",wyborGracza:"rozwin",pauza:"rozwin",tablica:"wynik",wyniki:"wynik",kontoOkno:"rozwin",profileOkno:"rozwin",smPytanie:"rozwin"};
  const BEZ_ZWIN={wyniki:1,pauza:1};
  // Gest budzi kontekst gry i od razu stawia łańcuch UI: kompresor na świeżym kontekście startuje ze ściszeniem
  // i rozkręca się przez ułamek sekundy, więc pierwszy dźwięk na nowo zbudowanym łańcuchu byłby o kilkanaście dB za cichy.
  function gest(){
    if(!wl||typeof Glos==="undefined"||!Glos||!Glos.odblokuj)return;
    try{Glos.odblokuj();const c=Glos.kontekstUI&&Glos.kontekstUI();if(c)zywy=lancuch(c,Glos.celUI?Glos.celUI():null);}catch(e){}
  }
  function wKontrolce(el){return !!(el&&(el.tagName==="INPUT"||el.tagName==="SELECT"||el.tagName==="TEXTAREA"||el.isContentEditable));}
  function menuAktywne(){try{return ekranGry()==="lobby"&&S.lobbyEkran!=="konfiguracja";}catch(e){return false;}}
  function cosOtwarte(){return !!document.querySelector("#tablica:not([hidden]),#okno:not([hidden]),#wyborGracza:not([hidden]),#szuflada:not([hidden]),#kontoOkno:not([hidden]),#profileOkno:not([hidden]),#smPytanie:not([hidden])");}
  function moznaWstecz(){
    const e=ekranGry();if(e==="wyniki")return true;if(e!=="lobby")return false;
    try{if(S.lobbyEkran!=="menu")return true;}catch(er){}
    return cosOtwarte();
  }
  // przełącznik po kliknięciu: stan już nowy (onclick elementu biegnie przed delegacją na document)
  function wariantPrzelacznika(t){
    const v=t.getAttribute("aria-checked")!=null?t.getAttribute("aria-checked"):t.getAttribute("aria-pressed");
    return v==="false"?"wyl":"wl";
  }
  function rodzajKliku(t){
    const tag=t.tagName,typ=String(t.type||"").toLowerCase(),rola=t.getAttribute("role");
    if(tag==="SUMMARY")return null;   // rozwinięcie <details> łapie „toggle”
    if(tag==="INPUT")return typ==="file"||typ==="button"||typ==="submit"?"klik":null;   // reszta: change / input
    if(tag==="SELECT"||tag==="TEXTAREA")return null;
    if(tag==="LABEL"){const k=t.control;return k&&k.type==="file"?"klik":null;}
    if(t.getAttribute("aria-disabled")==="true")return "blad";
    if(rola==="switch"||rola==="checkbox"||t.hasAttribute("aria-pressed"))return "przelacz";
    if(rola==="radio"||rola==="tab"||t.closest("[role=radiogroup],[role=tablist],.segment"))return "przesun";
    if(t.matches("[data-wstecz],.wstecz,.tablica-zamknij,.zamknij,.sm-pytanie-x,#btnInnaPiosenka,#btnWyjdz"))return "wstecz";
    return "klik";
  }
  let pilnujeStartu=false;
  // odliczanie → gra: S.ekran zmienia się w pętli gry, bez zmiany DOM, więc pilnuje go klatka po klatce
  function pilnujStartu(){
    if(pilnujeStartu||ekranGry()!=="odliczanie"||typeof requestAnimationFrame!=="function")return;
    pilnujeStartu=true;
    const krok=()=>{const e=ekranGry();if(e==="odliczanie"){requestAnimationFrame(krok);return;}
      pilnujeStartu=false;if(e==="gra")zglos("start");};
    requestAnimationFrame(krok);
  }
  function podlacz(){
    if(typeof document==="undefined"||!document.addEventListener)return;
    const d=document;
    d.addEventListener("pointerdown",e=>{
      wejscie="mysz";gest();
      const t=e.target&&e.target.closest?e.target.closest("button,[role=button]"):null;
      if(t&&(t.disabled||t.getAttribute("aria-disabled")==="true")&&t.closest(STREFY))zglos("blad");
    },true);
    d.addEventListener("keydown",e=>{
      if(e.key==="Shift"||e.key==="Control"||e.key==="Alt"||e.key==="Meta")return;
      wejscie="klawiatura";gest();
      if(e.key==="Escape"){if(moznaWstecz())zglos("wstecz");return;}
      const strzalka=e.key==="ArrowUp"||e.key==="ArrowDown"||e.key==="ArrowLeft"||e.key==="ArrowRight";
      if(strzalka&&!e.repeat&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&menuAktywne()&&!wKontrolce(d.activeElement)){
        const przed=d.activeElement;   // strzałka w ścianę: gra obsłużyła klawisz, a fokus nie drgnął
        setTimeout(()=>{if(e.defaultPrevented&&przed&&przed!==d.body&&d.activeElement===przed)zglos("blad");},0);
      }
    },true);
    // strefa sprawdzana też w fazie przechwytywania: onclick, który przerysowuje okno (konta.js, profile.js), odpina
    // przycisk z DOM, zanim klik dojdzie do document
    let klikWStrefie=null;
    d.addEventListener("click",e=>{const t=e.target;klikWStrefie=t&&t.closest&&t.closest(STREFY)?e:null;},true);
    d.addEventListener("click",e=>{
      const t=e.target&&e.target.closest?e.target.closest(KLIKALNE):null;
      if(!t||!(klikWStrefie===e||t.closest(STREFY)))return;
      const n=rodzajKliku(t);
      if(n)zglos(n,n==="przelacz"?wariantPrzelacznika(t):undefined);
    });
    // fokus przesunięty klawiaturą, padem albo kapslem (pilot); po kliknięciu myszą NIE (to już jest „klik”)
    d.addEventListener("focusin",e=>{
      const t=e.target;if(!t||t===d.body||!t.closest||!t.closest(STREFY))return;
      const b=d.body.classList;
      if(wejscie!=="klawiatura"&&wejscie!=="pad"&&!b.contains("nawigacja")&&!b.contains("pilot"))return;
      zglos("ruch");
    });
    let najechany=null;
    d.addEventListener("pointerover",e=>{
      if(e.pointerType&&e.pointerType!=="mouse")return;
      const t=e.target&&e.target.closest?e.target.closest(NAJAZD):null;
      if(t===najechany)return;najechany=t;
      if(!t||t.disabled||!t.closest(STREFY))return;
      zglos("ruch");
    },{passive:true});
    d.addEventListener("input",e=>{const t=e.target;if(t&&t.type==="range")zglos("przesun");},true);
    d.addEventListener("change",e=>{
      const t=e.target;if(!t)return;
      if(t.tagName==="SELECT"||t.type==="radio")zglos("przesun");
      else if(t.type==="checkbox")zglos("przelacz",t.checked?"wl":"wyl");
    },true);
    d.addEventListener("toggle",e=>{const t=e.target;if(t&&t.tagName==="DETAILS")zglos(t.open?"rozwin":"zwin");},true);
    // przewijanie listy kart kółkiem myszy: grzechotka co 140 px (przewinięcie od klawiatury to już „ruch”)
    let kolko=-1e9;const przewiniete=new WeakMap();
    d.addEventListener("wheel",()=>{kolko=Date.now();},{passive:true,capture:true});
    d.addEventListener("scroll",e=>{
      const t=e.target;if(!t||t===d||!t.closest||!t.closest(STREFY)||Date.now()-kolko>250)return;
      const y=t.scrollTop,x=t.scrollLeft,p=przewiniete.get(t)||{y,x,suma:0};
      p.suma+=Math.abs(y-p.y)+Math.abs(x-p.x);p.y=y;p.x=x;przewiniete.set(t,p);
      if(p.suma>=140){p.suma=0;zglos("przesun");}
    },{passive:true,capture:true});
    if(typeof MutationObserver!=="function")return;
    // punkty nabijające się na karcie wyników (zabi-chor.js nabijPunkty: textContent co klatkę przez 900 ms);
    // osobny obserwator tylko na #wyniki, bo HUD gry zmienia teksty w każdej klatce
    const wyniki=d.getElementById("wyniki");
    if(wyniki)new MutationObserver(lista=>{
      if(!wl||ekranGry()!=="wyniki")return;
      if(!lista.some(m=>m.target.closest&&m.target.closest(".punkty")))return;
      // najpierw „cha-ching”: ten obserwator dostaje zmiany PRZED obserwatorem atrybutów (powstał pierwszy), więc
      // pilnuje czasu od pokazania wyników sam (wynikiOd ustawia obserwator `hidden`, 0 = jeszcze nie widział)
      const teraz=Date.now();if(!wynikiOd||teraz-wynikiOd<PUNKT_PO_WYNIKU_MS||teraz-ostPunkt<PUNKT_CO_MS)return;ostPunkt=teraz;
      api.graj("dzwonekPunkt",nrPunktu++);
    }).observe(wyniki,{subtree:true,childList:true});
    new MutationObserver(lista=>{
      for(const m of lista){
        const t=m.target,a=m.attributeName;
        if(a==="aria-expanded"){
          const nowa=t.getAttribute("aria-expanded"),stara=m.oldValue;
          if((stara==="true"||stara==="false")&&(nowa==="true"||nowa==="false")&&nowa!==stara)zglos(nowa==="true"?"rozwin":"zwin");
        }else if(a==="data-ekran"&&t.id==="lobby"){
          const przed=m.oldValue,po=t.getAttribute("data-ekran");
          if(przed&&po&&przed!==po&&przed in GLEBOKOSC&&po in GLEBOKOSC)zglos(GLEBOKOSC[po]<GLEBOKOSC[przed]?"wstecz":"klik");
        }else if(a==="hidden"){
          const byl=m.oldValue!==null,jest=t.hasAttribute("hidden");if(byl===jest)continue;
          const id=t.id;
          if(id==="gra"||id==="wyniki"||id==="lobby")pilnujStartu();
          if(id==="wyniki"){nrPunktu=0;wynikiOd=jest?0:Date.now();}
          if(!(id in OKNA))continue;
          if(!jest)zglos(OKNA[id]);else if(!BEZ_ZWIN[id])zglos("zwin");
        }
      }
    }).observe(d.documentElement,{subtree:true,attributes:true,attributeOldValue:true,
      attributeFilter:["hidden","aria-expanded","data-ekran"]});
  }

  const api={graj,ustaw,renderuj,zglos,
    wlaczone:()=>wl,glosnosc:()=>gl,
    oznaczWejscie:r=>{if(r==="pad"||r==="klawiatura"||r==="mysz")wejscie=r;},
    NAZWY,RECEPTY,PRIORYTET,licznik,ostatnie};
  podlacz();
  return api;
})();
// także jako właściwość okna (window.DzwiekiUI&&DzwiekiUI.graj(…) w innych plikach, podmiana w smoke'ach)
if(typeof window!=="undefined")window.DzwiekiUI=DzwiekiUI;
