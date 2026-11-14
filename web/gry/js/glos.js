"use strict";
// ===== ŻABI CHÓR: dźwięk =====
// Własny mały silnik WebAudio gry. Silnik Syntha (rf-21-pad-audio.js) jest sprzęgnięty ze stanem
// modułu Synth (pady, bramki, sceny), więc gra go nie importuje: głos żaby to te same TRZY receptury
// z rf-17 PAD_PATCH (brass, ribbit, choir) zbudowane od nowa na kilku węzłach.
//
//   głosy żab ──┐
//   podkład ────┤
//   podpowiedź ─┼─► wyjście (głośność, wyciszenie) ─► kompresor ─► głośniki
//   efekty ─────┘
//
// AudioContext powstaje leniwie, a przeglądarka i tak pozwala mu grać dopiero po geście (klik,
// klawisz). Dopóki stoi, `gotowy()` mówi „nie” i NIC się nie planuje: inaczej nuty zaplanowane na
// zamrożonym zegarze zagrałyby wszystkie naraz w chwili odblokowania. To samo robi `wycisz(true)`,
// którego używają ZC.ff() (przewijanie piosenki bez dźwięku) i pauza.
//
// Poziomy NIE są zgadywane: tests/gry_zabi_chor_dzwiek.mjs buduje ten sam graf na OfflineAudioContext
// (`kontekst(gotowy)`), renderuje 10 s Ody w trzech składach i pilnuje liczb: szczyt wyjścia < −1 dBFS,
// żaby 4–10 dB nad podkładem, rechot nad żabami. Zmieniasz POZIOM albo receptury: uruchom go.

// ---------------------------------------------------------------------------------------------
// Podkład: 10 instrumentów, jedna nuta do węzła `g` (obwiednia ustawiana na g.gain).
// Przeniesione z Keyboard Trenera (ten sam autor), stan z 2026-10-02 16:55.
// [Żabi chór] instrument przychodzi argumentem `instr` (w trenerze to zmienna globalna z ustawień)
function voice(a,t,f,len,g,instr){ // build the sound of one note for the chosen instrument into gain node g
  const osc=(type,fr,amp,det)=>{const o=a.createOscillator();o.type=type;o.frequency.value=fr;if(det)o.detune.value=det;const og=a.createGain();og.gain.value=amp;o.connect(og);og.connect(g);o.start(t);o.stop(t+len+1.2);return o};
  const env=(att,peak,decTo,decT,rel)=>{g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+att);if(decT)g.gain.exponentialRampToValueAtTime(Math.max(.0005,decTo),t+att+decT);g.gain.setValueAtTime(Math.max(.0005,decTo),t+len);g.gain.exponentialRampToValueAtTime(.0005,t+len+rel)};
  const vib=(o,rate,cents)=>{const l=a.createOscillator(),lg=a.createGain();l.frequency.value=rate;lg.gain.value=cents;l.connect(lg);lg.connect(o.detune);l.start(t+.15);l.stop(t+len+1)};
  switch(instr){
    case 'epiano':env(.005,.32,.06,.9,.4);osc('sine',f,1);osc('sine',f*2,.35);osc('sine',f*7,.04);break;
    case 'organ':env(.02,.18,.18,0,.08);[1,2,3,4,6,8].forEach((h,i)=>osc('sine',f*h,[1,.6,.4,.25,.15,.1][i]));break;
    case 'guitar':{const lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(4000,t);lp.frequency.exponentialRampToValueAtTime(700,t+.6);lp.connect(g);
      const o=a.createOscillator();o.type='sawtooth';o.frequency.value=f;const og=a.createGain();og.gain.value=.5;o.connect(og);og.connect(lp);o.start(t);o.stop(t+len+1);
      osc('triangle',f,.6);env(.003,.35,.02,1.2,.3);break}
    case 'flute':env(.08,.22,.2,0,.15);vib(osc('sine',f,1),5,6);osc('sine',f*2,.12);osc('triangle',f*3,.03);break;
    case 'strings':{const lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2200;lp.connect(g);
      [-7,7].forEach(d=>{const o=a.createOscillator();o.type='sawtooth';o.frequency.value=f;o.detune.value=d;const og=a.createGain();og.gain.value=.3;o.connect(og);og.connect(lp);o.start(t);o.stop(t+len+1);vib(o,5.5,8)});
      env(.18,.2,.18,0,.35);break}
    case 'marimba':env(.002,.45,.0005,.7,.05);osc('sine',f,1);osc('sine',f*4,.25);break;
    case 'musicbox':env(.002,.3,.0005,1.4,.05);osc('sine',f*2,1);osc('sine',f*6,.15);osc('triangle',f*4,.08);break;
    case 'chip':env(.005,.11,.09,.1,.05);osc('square',f,1);break;
    case 'synth':{const lp=a.createBiquadFilter();lp.type='lowpass';lp.Q.value=6;lp.frequency.setValueAtTime(5000,t);lp.frequency.exponentialRampToValueAtTime(900,t+.4);lp.connect(g);
      const o=a.createOscillator();o.type='sawtooth';o.frequency.value=f;o.connect(lp);o.start(t);o.stop(t+len+1);env(.01,.16,.1,.3,.2);break}
    // [RibbitBeat 11-19] barwy zestawów „Silnik MIDI” (ZC_SILNIKI_MIDI w zabi-chor.js): basy, środki i góry.
    // Szczyty obwiedni dobrane tak, żeby zestaw grał podobnie głośno jak pianino (pomiar: C:/tmp/rb-start-261118/barwy.js).
    case 'bass':env(.006,.23,.09,.4,.12);osc('sine',f,1);osc('triangle',f,.45);osc('sine',f*2,.12);break;
    case 'synbass':{const lp=a.createBiquadFilter();lp.type='lowpass';lp.Q.value=7;lp.frequency.setValueAtTime(1400,t);lp.frequency.exponentialRampToValueAtTime(260,t+.22);lp.connect(g);
      const o=a.createOscillator();o.type='sawtooth';o.frequency.value=f;o.connect(lp);o.start(t);o.stop(t+len+1);osc('sine',f,.5);env(.004,.21,.105,.3,.1);break}
    case 'tribass':env(.004,.27,.19,.1,.04);osc('triangle',f,1);break;
    case 'pulse':env(.004,.105,.08,.12,.04);osc('square',f,1);osc('square',f*2,.22,6);break;
    case 'cello':{const lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1300;lp.connect(g);
      const o=a.createOscillator();o.type='sawtooth';o.frequency.value=f;const og=a.createGain();og.gain.value=.5;o.connect(og);og.connect(lp);o.start(t);o.stop(t+len+1);vib(o,5,7);
      osc('sine',f,.35);env(.09,.22,.22,0,.28);break}
    case 'brass':{const lp=a.createBiquadFilter();lp.type='lowpass';lp.Q.value=1.5;lp.frequency.setValueAtTime(500,t);lp.frequency.linearRampToValueAtTime(2600,t+.07);lp.frequency.exponentialRampToValueAtTime(1500,t+.4);lp.connect(g);
      [-4,4].forEach(d=>{const o=a.createOscillator();o.type='sawtooth';o.frequency.value=f;o.detune.value=d;const og=a.createGain();og.gain.value=.4;o.connect(og);og.connect(lp);o.start(t);o.stop(t+len+1)});
      env(.04,.34,.27,.25,.14);break}
    case 'tuba':{const lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.value=520;lp.connect(g);
      const o=a.createOscillator();o.type='sawtooth';o.frequency.value=f;const og=a.createGain();og.gain.value=.7;o.connect(og);og.connect(lp);o.start(t);o.stop(t+len+1);
      osc('sine',f,.6);env(.045,.22,.17,.2,.14);break}
    case 'pad':{const lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1500;lp.connect(g);
      [-9,0,9].forEach(d=>{const o=a.createOscillator();o.type='sawtooth';o.frequency.value=f;o.detune.value=d;const og=a.createGain();og.gain.value=.22;o.connect(og);og.connect(lp);o.start(t);o.stop(t+len+1)});
      env(.3,.3,.3,0,.5);break}
    case 'bells':env(.002,.15,.0005,1.9,.05);osc('sine',f*2,1);osc('sine',f*5.4,.28);osc('sine',f*8.2,.1);break;
    default:env(.01,.3,.1,.25,.3);osc('triangle',f,1);osc('sine',f*2,.25);osc('sine',f*3,.08);
  }
}

const Glos=(function(){
  let ac=null,offline=false,wyjscie=null,komp=null,buforSzumu=null;
  let busZaby=null,busPodklad=null,busPodpowiedz=null,busEfekty=null;
  let wyciszony=false,koncowka=null;
  // Głośności gracza (10-10, „suwak głośności”): 0–1 z ustawień gry, krzywa kwadratowa (ucho słyszy logarytmicznie).
  // „ogolna” działa na węźle końcowym, więc ścisza wszystko: grę, dźwięki menu i nagrania pakietów (te idą do kompresora
  // z pominięciem wyjścia gry). Pozostałe mnożą swoje szyny; „podklad” czyta też odtwarzacz pakietów (mnoznik, poGlosnosci).
  const UZYT={ogolna:1,podklad:1,zaby:1,efekty:1},SLUCHACZE=[];
  const krzywa=v=>{v=Math.max(0,Math.min(1,+v));return Number.isFinite(v)?v*v:1;};
  const mnoznik=k=>krzywa(UZYT[k]==null?1:UZYT[k]);
  function zastosujGlosnosc(){
    if(!ac)return;
    const t=ac.currentTime,u=(g,v)=>{if(!g)return;g.gain.cancelScheduledValues(t);g.gain.setTargetAtTime(v,t,.02);};
    u(koncowka,POZIOM.koniec*mnoznik("ogolna"));u(busZaby,POZIOM.zaby*mnoznik("zaby"));
    u(busPodklad,POZIOM.podklad*mnoznik("podklad"));u(busEfekty,POZIOM.efekty*mnoznik("efekty"));
  }
  function ustawGlosnosc(o){
    for(const k of Object.keys(o||{}))if(k in UZYT&&Number.isFinite(+o[k]))UZYT[k]=Math.max(0,Math.min(1,+o[k]));
    zastosujGlosnosc();
    for(const f of SLUCHACZE)try{f();}catch(e){}
  }
  // Poziomy szyn i jednego głosu. Strojone pomiarem (patrz nagłówek pliku), nie na ucho.
  const POZIOM={wyjscie:.8,zaby:1,podklad:1,podpowiedz:.3,efekty:.9,glos:.55,koniec:.8};
  // Ile razy gra POPROSIŁA o dźwięk i ile z tego naprawdę zagrało (smoke i testy w przeglądarce:
  // bez gestu użytkownika kontekst stoi, więc „zadane” rośnie, a „zagrane” nie).
  const licznik={zadane:{},zagrane:{}};
  const zlicz=(co,zagrane)=>{licznik.zadane[co]=(licznik.zadane[co]||0)+1;if(zagrane)licznik.zagrane[co]=(licznik.zagrane[co]||0)+1;};

  // Graf szyn na kontekście `c`. `solo` służy tylko pomiarowi: wybrana szyna idzie prosto do wyjścia
  // kontekstu (bez głośności wyjścia i kompresora), pozostałe nie idą nigdzie.
  function zbuduj(c,solo){
    komp=c.createDynamicsCompressor();
    komp.threshold.value=-16;komp.knee.value=12;komp.ratio.value=4;komp.attack.value=.004;komp.release.value=.2;
    // Ogranicznik za kompresorem: osiem żab w tej samej fazie albo fanfara na pełnym chórze nie przebije
    // −1 dBFS (kompresor ma 4 ms ataku i dokłada własne wzmocnienie wyrównujące, więc sam tego nie gwarantuje).
    // Oba węzły dokładają wzmocnienie wyrównujące (makeup), więc na końcu stoi stałe ściszenie o 2 dB.
    const ogr=c.createDynamicsCompressor();
    ogr.threshold.value=-6;ogr.knee.value=0;ogr.ratio.value=20;ogr.attack.value=.002;ogr.release.value=.12;
    const koniec=c.createGain();koniec.gain.value=POZIOM.koniec*(solo?1:mnoznik("ogolna"));koncowka=koniec;
    komp.connect(ogr);ogr.connect(koniec);koniec.connect(c.destination);
    wyjscie=c.createGain();wyjscie.gain.value=wyciszony?0:POZIOM.wyjscie;wyjscie.connect(komp);
    const szyna=(v,nazwa)=>{const g=c.createGain();g.gain.value=v;
      if(!solo)g.connect(wyjscie);else if(solo===nazwa)g.connect(c.destination);
      return g;};
    const m=k=>solo?1:mnoznik(k);   // pomiar szyn (solo) zawsze na poziomach wzorcowych
    busZaby=szyna(POZIOM.zaby*m("zaby"),"zaby");busPodklad=szyna(POZIOM.podklad*m("podklad"),"podklad");
    busPodpowiedz=szyna(POZIOM.podpowiedz,"podpowiedz");busEfekty=szyna(POZIOM.efekty*m("efekty"),"efekty");
    // efekty żab: wysyłki z szyny żab do wyjścia (pomiar szyn w trybie solo idzie bez nich)
    wysylki=null;
    if(!solo){
      const pg=c.createConvolver();pg.buffer=odpowiedzSali(c,2.4);const pgG=c.createGain();pgG.gain.value=0;pg.connect(pgG);pgG.connect(wyjscie);
      const ed=c.createDelay(1);ed.delayTime.value=.34;const elp=c.createBiquadFilter();elp.type="lowpass";elp.frequency.value=2600;
      const efb=c.createGain();efb.gain.value=.38;ed.connect(elp);elp.connect(efb);efb.connect(ed);
      const eG=c.createGain();eG.gain.value=0;elp.connect(eG);eG.connect(wyjscie);
      wysylki={pg,pgG,ed,eG,naP:false,naE:false};zastosujEfekty();
    }
  }
  // Efekty żab (efekty na instrumentach ustawiane w ustawieniach, np. pogłos): pogłos = splot
  // z wygenerowaną odpowiedzią sali 2,4 s, echo = opóźnienie 0,34 s ze sprzężeniem przez przyciemniający filtr. Obie to
  // wysyłki z szyny żab, więc działają na każdy instrument (też własne ze Studia) i idą za suwakiem głośności żab.
  // 0 = wysyłka odłączona, więc wyłączony pogłos nic nie liczy (splot to najdroższy węzeł grafu).
  const EFEKTY={poglos:0,echo:0};let wysylki=null;
  function odpowiedzSali(c,dl){
    const sr=c.sampleRate,n=Math.round(sr*dl),b=c.createBuffer(2,n,sr);
    for(let k=0;k<2;k++){const d=b.getChannelData(k);for(let i=0;i<n;i++){const x=i/n;d[i]=(Math.random()*2-1)*Math.pow(1-x,2)*Math.exp(-x*4);}}
    return b;
  }
  function zastosujEfekty(){
    const W=wysylki;if(!W||!ac)return;
    const t=ac.currentTime,p=krzywa(EFEKTY.poglos),e=krzywa(EFEKTY.echo);
    const prz=(on,klucz,wezel)=>{if(on&&!W[klucz]){busZaby.connect(wezel);W[klucz]=true;}else if(!on&&W[klucz]){try{busZaby.disconnect(wezel);}catch(er){}W[klucz]=false;}};
    prz(p>0,"naP",W.pg);prz(e>0,"naE",W.ed);
    W.pgG.gain.cancelScheduledValues(t);W.pgG.gain.setTargetAtTime(p*.9,t,.03);
    W.eG.gain.cancelScheduledValues(t);W.eG.gain.setTargetAtTime(e*.55,t,.03);
  }
  function ustawEfekty(o){
    for(const k of Object.keys(o||{}))if(k in EFEKTY&&Number.isFinite(+o[k]))EFEKTY[k]=Math.max(0,Math.min(1,+o[k]));
    zastosujEfekty();
  }
  // Bez argumentu: własny AudioContext, tworzony przy pierwszej potrzebie. Z argumentem: gotowy,
  // cudzy kontekst (pomiar na OfflineAudioContext) dostaje DOKŁADNIE ten sam graf, co gra.
  function kontekst(gotowyKontekst,opcje){
    if(gotowyKontekst){
      ac=gotowyKontekst;buforSzumu=null;
      offline=typeof OfflineAudioContext!=="undefined"&&gotowyKontekst instanceof OfflineAudioContext;
      zbuduj(ac,(opcje&&opcje.solo)||null);
      return ac;
    }
    if(ac)return ac;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return null;
    try{ac=new AC();}catch(e){return null;}
    zbuduj(ac,null);
    // 10-19: próbki Krzyku; 10-21: każdy instrument z `probki` w recepturze (trąbka, flet, smyczki, …). Równolegle i
    // asynchronicznie; do czasu wczytania (albo gdy plików brak) każdy z nich gra głosem zastępczym z oscylatorów.
    for(const k of INSTRUMENTY_GRACZA)if(RECEPTURY[k].probki)zaladujProbki(RECEPTURY[k].probki);
    return ac;
  }
  // Wołane z każdego gestu: tworzy kontekst i budzi go, jeśli przeglądarka go uśpiła.
  function odblokuj(){
    const c=kontekst();
    if(c&&!offline&&c.state==="suspended")c.resume().catch(()=>{});
    return c;
  }
  // Kontekst offline stoi aż do startRendering(), a planować na nim trzeba właśnie wtedy.
  function gotowy(){return !!ac&&(offline||ac.state==="running")&&!wyciszony;}
  function zablokowany(){return !!ac&&!offline&&ac.state!=="running";}
  // Zegar dźwięku dla pętli gry: sekundy AudioContext, gdy ten naprawdę gra (nie offline, nie uśpiony),
  // inaczej null. Gra liczy krok czasu z TEGO zegara, bo nuty planuje na nim (planujDzwieki): dwa zegary
  // (performance.now i karta dźwiękowa) rozjeżdżały się przy każdym zacięciu klatki i dźwięk „czekał”.
  function czas(){return ac&&!offline&&ac.state==="running"?ac.currentTime:null;}
  function wycisz(tak){
    wyciszony=!!tak;
    if(!wyjscie)return;
    const t=ac.currentTime;
    wyjscie.gain.cancelScheduledValues(t);
    wyjscie.gain.setTargetAtTime(wyciszony?0:POZIOM.wyjscie,t,.015);
  }
  const hz=m=>440*Math.pow(2,(m-69)/12);
  const kiedy=za=>ac.currentTime+Math.max(0,za||0);

  // ---- głos żaby ------------------------------------------------------------------------------
  // Receptury z rf-17 PAD_PATCH, przepisane na nazwy gry: fala, oktawa, filtr (typ, fMin–fMax, Q),
  // atak, puszczenie, poziom i cecha znakowa każdej z nich: puchnięcie filtra trąbki (fSwell),
  // „rrr” ribbitu (kwadratowe AM 29 Hz, wzmocnienie 0,1…1,0) i rozstrojona para chóru (det 6 ct).
  // `glosnosc` wyrównuje receptury: wąski formant ribbitu (pasmo 430–1750 Hz, Q 6) i chóru zabiera
  // tyle energii, że przy tych samych poziomach co trąbka ribbit wychodził ok. 20 dB ciszej, a chór 10 dB.
  // Liczby z pomiaru offline (RMS jednej żaby na Odzie), nie z ucha.
  const RECEPTURY={
    trabka:{fala:"sawtooth",okt:0, filtr:"lowpass", fMin:250,fMax:3800,q:1.6,atak:.055,puszcz:.22,poziom:.5,puch:.12,glosnosc:1,probki:"trabka",probkiRec:{atak:.02,puszcz:.2,poziom:.5,glosnosc:4.5}},
    ribbit:{fala:"sawtooth",okt:-1,filtr:"bandpass",fMin:430,fMax:1750,q:6,  atak:.02, puszcz:.13,poziom:.52,am:29,glosnosc:9.5},
    chor:  {fala:"sawtooth",okt:0, filtr:"bandpass",fMin:480,fMax:1900,q:2.2,atak:.24, puszcz:.6, poziom:.34,rozstroj:6,glosnosc:3,legato:{czas:.1,swoboda:.2}},
    // Instrumenty gracza o ciągłej wysokości (2026-10-03): ten sam głos, inne ustawienia. `harm` = alikwoty
    // [krotność, głośność] zamiast jednej fali, `wib` = stałe wibrato w centach (smyczki, flet, theremin
    // wibrują same, obrót kapsla dokłada swoje), `glide` = stała czasu podjazdu wysokości w sekundach.
    smyczki:   {fala:"sawtooth",okt:0, filtr:"lowpass", fMin:700, fMax:2800,q:.8, atak:.16, puszcz:.35,poziom:.42,rozstroj:9,wib:7,glosnosc:1,probki:"smyczki",probkiRec:{atak:.08,puszcz:.35,poziom:.5,glosnosc:6.7,legato:{czas:.12,swoboda:.35},artyk:{od:0,zlep:.08}}},
    flet:      {fala:"sine",    okt:1, filtr:"lowpass", fMin:1800,fMax:5200,q:.5, atak:.07, puszcz:.14,poziom:.5,harm:[[1,1],[2,.14],[3,.04]],wib:6,glosnosc:.8,probki:"flet",probkiRec:{probkaOkt:1,atak:.03,puszcz:.14,wib:4,poziom:.5,glosnosc:4.75,legato:{czas:.06,swoboda:.25},artyk:{od:.02,zlep:.045}}},
    organy:    {fala:"sine",    okt:0, filtr:"lowpass", fMin:2200,fMax:6000,q:.5, atak:.02, puszcz:.08,poziom:.3,harm:[[1,1],[2,.6],[3,.4],[4,.25],[6,.15],[8,.1]],glosnosc:1.1,probki:"organy",probkiRec:{atak:.01,puszcz:.08,poziom:.5,glosnosc:5.4,legato:{czas:.015,swoboda:0},artyk:{od:0,zlep:.02}}},
    syntezator:{fala:"square",  okt:0, filtr:"lowpass", fMin:400, fMax:4500,q:7,  atak:.01, puszcz:.15,poziom:.32,rozstroj:5,puch:.2,glosnosc:.7},
    theremin:  {fala:"sine",    okt:1, filtr:"lowpass", fMin:3000,fMax:6000,q:.3, atak:.12, puszcz:.3, poziom:.55,wib:12,glide:.05,glosnosc:.75},
    // Instrumentów jest 2× więcej niż teł, czyli 40: 17 nowych ciągłych na tym samym głosie. `glosnosc`
    // wyrównana pomiarem RMS próbki offline do trąbki, nie na ucho.
    kazoo:      {fala:"sawtooth",okt:0, filtr:"bandpass",fMin:500, fMax:2400,q:5,  atak:.02, puszcz:.08,poziom:.5,am:22,glosnosc:8.48},
    harmonijka: {fala:"square",  okt:0, filtr:"bandpass",fMin:600, fMax:3600,q:1.8,atak:.04, puszcz:.12,poziom:.4,rozstroj:8,wib:4,glosnosc:2.48,legato:{czas:.05,swoboda:.25}},
    okaryna:    {fala:"sine",    okt:1, filtr:"lowpass", fMin:1500,fMax:4000,q:.5, atak:.06, puszcz:.12,poziom:.55,harm:[[1,1],[3,.05]],wib:4,glosnosc:0.72,legato:{czas:.06,swoboda:.25}},
    gwizdek:    {fala:"sine",    okt:2, filtr:"lowpass", fMin:3000,fMax:8000,q:.4, atak:.03, puszcz:.08,poziom:.45,harm:[[1,1],[2,.06]],wib:8,glide:.03,glosnosc:0.88,legato:{czas:.03,swoboda:.2}},
    klarnet:    {fala:"square",  okt:0, filtr:"lowpass", fMin:600, fMax:3000,q:1,  atak:.05, puszcz:.12,poziom:.4,wib:3,glosnosc:0.84,probki:"klarnet",probkiRec:{atak:.03,puszcz:.12,wib:3,poziom:.5,glosnosc:6.2,legato:{czas:.06,swoboda:.25},artyk:{od:.02,zlep:.045}}},
    oboj:       {fala:"sine",    okt:0, filtr:"bandpass",fMin:700, fMax:3000,q:1.4,atak:.05, puszcz:.12,poziom:.5,harm:[[1,1],[2,.8],[3,.6],[4,.4],[5,.3]],wib:4,glosnosc:1.44,probki:"oboj",probkiRec:{atak:.03,puszcz:.12,wib:4,poziom:.5,glosnosc:4.3,legato:{czas:.06,swoboda:.25},artyk:{od:.02,zlep:.045}}},
    puzon:      {fala:"sawtooth",okt:-1,filtr:"lowpass", fMin:200, fMax:2500,q:1.4,atak:.07, puszcz:.2, poziom:.5,puch:.15,glide:.06,glosnosc:1.14,probki:"puzon",probkiRec:{probkaOkt:-1,atak:.03,puszcz:.2,poziom:.5,glosnosc:6.2}},
    tuba:       {fala:"sawtooth",okt:-2,filtr:"lowpass", fMin:120, fMax:900, q:1.2,atak:.08, puszcz:.2, poziom:.55,puch:.1,glosnosc:1.05,probki:"tuba",probkiRec:{probkaOkt:-2,atak:.04,puszcz:.2,poziom:.5,glosnosc:5.0,legato:{czas:.09,swoboda:.25},artyk:{od:.015,zlep:.045}}},
    dudy:       {fala:"sawtooth",okt:0, filtr:"bandpass",fMin:800, fMax:3000,q:3,  atak:.03, puszcz:.1, poziom:.4,rozstroj:4,glosnosc:4.47,legato:{czas:.03,swoboda:.1}},
    wiolonczela:{fala:"sawtooth",okt:-1,filtr:"lowpass", fMin:400, fMax:2200,q:.9, atak:.14, puszcz:.35,poziom:.45,rozstroj:6,wib:6,glosnosc:0.92,probki:"wiolonczela",probkiRec:{probkaOkt:-1,atak:.08,puszcz:.35,poziom:.5,glosnosc:3.8,legato:{czas:.12,swoboda:.35},artyk:{od:0,zlep:.09}}},
    chiptune:   {fala:"square",  okt:0, filtr:"lowpass", fMin:5000,fMax:9000,q:.5, atak:.005,puszcz:.05,poziom:.28,glosnosc:1.21,legato:{czas:.005,swoboda:0}},
    robot:      {fala:"square",  okt:0, filtr:"bandpass",fMin:700, fMax:2600,q:7,  atak:.01, puszcz:.06,poziom:.4,am:60,glosnosc:9.33,legato:{czas:.005,swoboda:0}},
    // Instrumenty muszą grać ciągle, a nie gasnąć jak np. cymbałki, bo w grze trzyma się nutę:
    // dawne uderzane (pianino, gitara, el. pianino) też grają ciągłym głosem. `szarp` = [szczyt, czas]:
    // na początku nuty i przy każdej zmianie półtonu w trakcie śpiewu głośność skacze do szczytu × poziom i w `czas` s
    // opada do poziomu podtrzymania, a filtr startuje rozjaśniony (atak jak uderzenie), potem dźwięk trwa, dopóki trzymasz.
    piano:      {fala:"triangle",okt:0, filtr:"lowpass", fMin:1200,fMax:5000,q:.6, atak:.005,puszcz:.3, poziom:.35,harm:[[1,1],[2,.4],[3,.15],[5,.05]],szarp:[2.6,.45],glosnosc:0.78,probki:"piano",probkiRec:{atak:.005,puszcz:.3,poziom:.5,glosnosc:2.0,legato:{czas:.005,swoboda:0},artyk:{od:0,zlep:.01}}},
    epiano:     {fala:"sine",    okt:0, filtr:"lowpass", fMin:1500,fMax:6000,q:.5, atak:.005,puszcz:.3, poziom:.4,harm:[[1,1],[2,.3],[7,.05]],szarp:[2.2,.4],glosnosc:0.66,legato:{czas:.005,swoboda:0}},
    guitar:     {fala:"sawtooth",okt:0, filtr:"lowpass", fMin:600, fMax:3600,q:1.2,atak:.004,puszcz:.2, poziom:.35,rozstroj:4,szarp:[2.4,.35],glosnosc:0.81,legato:{czas:.01,swoboda:.15}},
    // Instrumenty, które po przytrzymaniu gasną i sztucznie wstają (jak cymbałki), nie mają tu
    // zastosowania: pomiar trzymania nuty (skrypt offline) wskazał Marimbę, Pozytywkę i Steel drum
    // (tremolo prostokątne `am`: 51–57 % drżenia, 22 ponowne „uderzenia” na 2 s) oraz Dzwon i Klawesyn (gasną po
    // uderzeniu o 4–6 dB). Zastąpiło je 5 instrumentów, które z natury grają jednostajnie, na tych samych miejscach
    // drogi i w tych samych rzadkościach (zapis przenosi stare id: Postepy.ZAMIANY_INSTRUMENTOW).
    // `oddech` = szum filtrowany na wysokości nuty DOKŁADANY do oscylatorów (duduk), w odróżnieniu od `szum`, który je zastępuje.
    bas:        {fala:"triangle",okt:-1,filtr:"lowpass", fMin:300, fMax:2000,q:6,  atak:.012,puszcz:.14,poziom:.45,harm:[[1,1],[2,.5],[3,.3],[4,.2]],fEnv:.6,fEnvT:.25,glide:.05,wib:3,glosnosc:0.8,legato:{czas:.02,swoboda:.1}},
    hawajska:   {fala:"triangle",okt:1, filtr:"lowpass", fMin:1400,fMax:5500,q:1.5,atak:.008,puszcz:.3, poziom:.45,harm:[[1,1],[2,.45],[3,.22],[4,.1]],fEnv:.35,fEnvT:.4,wib:10,glide:.1,glosnosc:0.83},
    duduk:      {fala:"sine",    okt:0, filtr:"bandpass",fMin:500, fMax:1700,q:1.1,atak:.1,  puszcz:.22,poziom:.5,harm:[[1,1],[2,.5],[3,.32],[4,.14],[5,.07]],oddech:{q:5,mnoz:1,poziom:.35},wib:5,glide:.06,glosnosc:1.33},
    didgeridoo: {fala:"sawtooth",okt:-2,filtr:"bandpass",fMin:150, fMax:900, q:4,  atak:.06, puszcz:.2, poziom:.5,puch:.1,wib:2,glosnosc:5.73},
    erhu:       {fala:"sawtooth",okt:0, filtr:"bandpass",fMin:700, fMax:3200,q:2,  atak:.1,  puszcz:.25,poziom:.45,wib:10,glide:.07,glosnosc:4.64},
    opera:      {fala:"sawtooth",okt:0, filtr:"bandpass",fMin:600, fMax:1400,q:3,  atak:.1,  puszcz:.3, poziom:.45,wib:22,glide:.04,glosnosc:4.16},
    // Instrumenty brzmiące zbyt podobnie zastąpiono nowymi: 11 receptur
    // z pomiaru odległości widmowo-czasowej (skrypt offline) zastąpiło 11 zbyt bliskich (Flet Pana, Szklana harfa,
    // Piła, Saksofon, Waltornia, Sitar, Trąbka z tłumikiem, Akordeon, Skrzypce, Bas syntezatorowy, Melodyka). Każda nowa jest
    // z innej rodziny brzmienia i korzysta z nowych opcji głosu: `szum` (szum filtrowany na wysokości nuty), `znieksz` (przester),
    // `pulse` (fala prostokątna o innej szerokości impulsu), `unison` (kilka rozstrojonych kopii), `wah` (falowanie filtra),
    // `formanty` (równoległe pasma samogłoski).
    przester:   {fala:"sawtooth",okt:0, filtr:"lowpass", fMin:900, fMax:3200,q:1.5,atak:.01, puszcz:.12,poziom:.3, znieksz:9,rozstroj:5,glosnosc:0.86},
    kwak:       {fala:"sawtooth",okt:0, filtr:"bandpass",fMin:600, fMax:1100,q:7,  atak:.03, puszcz:.1, poziom:.4, wah:{rate:4.5,gl:420},glosnosc:5.7},
    kot:        {fala:"sawtooth",okt:1, filtr:"lowpass", fMin:1200,fMax:5000,q:1,  atak:.05, puszcz:.2, poziom:.45, puch:.35,wib:18,glide:.05,formanty:[[750,8,1],[1650,9,.6],[2900,12,.25]],glosnosc:2.38},
    impuls:     {fala:"sine",    okt:0, filtr:"lowpass", fMin:1500,fMax:7000,q:3,  atak:.006,puszcz:.06,poziom:.3, pulse:.125,glosnosc:2.41,legato:{czas:.005,swoboda:0}},
    szept:      {fala:"sine",    okt:0, filtr:"lowpass", fMin:3000,fMax:8000,q:.5, atak:.05, puszcz:.12,poziom:.5, szum:{q:2.2,mnoz:2},glosnosc:5.91},
    trance:     {fala:"sawtooth",okt:0, filtr:"lowpass", fMin:1200,fMax:6000,q:1.2,atak:.03, puszcz:.2, poziom:.22,unison:[-24,-14,-6,0,6,14,24],glosnosc:0.88,legato:{czas:.01,swoboda:0}},
    wiatr:      {fala:"sine",    okt:0, filtr:"lowpass", fMin:4000,fMax:9000,q:.5, atak:.15, puszcz:.4, poziom:.5, szum:{q:22,mnoz:2},glide:.06,glosnosc:18.54},
    sub:        {fala:"sine",    okt:-1,filtr:"lowpass", fMin:500, fMax:1100,q:.5, atak:.015,puszcz:.2, poziom:.7, harm:[[1,1],[2,.3],[3,.12]],glide:.09,glosnosc:0.46,legato:{czas:.02,swoboda:0}},
    wobble:     {fala:"sawtooth",okt:-1,filtr:"lowpass", fMin:300, fMax:1200,q:8,  atak:.02, puszcz:.12,poziom:.4, rozstroj:6,wah:{rate:3,gl:700},glosnosc:0.77},
    hammond:    {fala:"sine",    okt:0, filtr:"lowpass", fMin:2500,fMax:7000,q:.4, atak:.006,puszcz:.06,poziom:.3, harm:[[.5,.6],[1,1],[1.5,.55],[2,.75],[3,.35],[4,.45],[8,.12]],wib:11,glosnosc:0.74,legato:{czas:.008,swoboda:0}},
    wokal:      {fala:"sawtooth",okt:0, filtr:"lowpass", fMin:3500,fMax:6000,q:.5, atak:.06, puszcz:.2, poziom:.5, wib:5.5,formanty:[[330,12,1],[640,10,.45],[2300,14,.08]],glosnosc:2.28},
    // Krzyk (legendarny): krzyczący mężczyzna z pakietu nagrań przesuwanych w wysokości, nie synteza (synteza nie brzmiała
    // jak krzyk): jedyny instrument z PRÓBEK. `probki` = zestaw WAV z
    // web/assets/krzyk/ (osiem prawdziwych nagrań męskiego krzyku z paczki „Aargh!”, tools/ribbitbeat_krzyk_probki.py, autorzy w
    // docs/CREDITS.md); nuta uruchamia próbkę (na zmianę kolejne), jej ustabilizowany odcinek gra w pętli, dopóki trzymasz, a
    // `playbackRate` goni wysokość (pitch shift razem z formantami: wysoko piszczy jak chomik, nisko ryczy jak olbrzym). Do czasu
    // wczytania próbek (albo gdy ich brak) gra to samo zastępczym głosem z oscylatorów: `formanty` i `znieksz` poniżej.
    // Krzyk domyślnie skokowo — nowy półton to nowy krzyk od początku (na zmianę kolejne nagranie)
    krzyk:      {fala:"sawtooth",okt:0, filtr:"lowpass", fMin:6000,fMax:12000,q:.5, atak:.01, puszcz:.12, poziom:.5, probki:"krzyk",znieksz:3,formanty:[[900,10,1],[1400,10,.7],[2800,12,.25]],glosnosc:1.18,legato:{czas:.06,swoboda:.3},artyk:{od:0,zlep:.03}}};
  // Instrumenty z NAGRAŃ: część istniejących instrumentów (nie nowe) gra próbkami z otwartych plików audio: receptura z `probki` + `probkiRec` gra zestawem STREF z
  // web/assets/<probki>/ (po jednej nucie co 7–12 półtonów z VSCO 2 Community Edition, CC0; tools/ribbitbeat_probki_instrumentow.py),
  // a jej oscylatory zostają głosem zastępczym, dopóki pliki nie dojadą. Po wczytaniu receptura = oryginał + Z_PROBEK + własne
  // `probkiRec` (glosZaby). Z_PROBEK zdejmuje to, co kształtowało oscylatory, a nagraniu by szkodziło: przester, tremolo, falowanie
  // filtra, puchnięcie i szarpnięcie (atak JEST w nagraniu), stałe wibrato (sekcje smyczków mają własne) — i otwiera filtr na
  // 2,5–9 kHz, żeby jasność z wysokości nuty została, ale nie tłumiła barwy. Każdy instrument dopisuje swoje: `probkaOkt` (oktawa
  // próbki wobec nuty, jak `okt` oscylatorów), `atak`, `puszcz`, `wib`, `glosnosc` (z pomiaru na Odzie, tests/gry_zabi_chor_dzwiek.mjs:
  // żaby 4–10 dB nad podkładem, nie na ucho) i przejścia między nutami (opis przy `legatoP` w glosZaby): `legato` (półtony z miękkim
  // wejściem; swoboda 0 = klawisz) i `artyk` (nowa nuta = nowe źródło: język dętych, smyczek, młoteczek, chiff). Trąbka i puzon celowo bez `legato`: ślizg suwaka to natura puzonu, a trąbka może mieć luźne przesunięcia.
  // Domyślny tryb przejść to ten, w którym instrument brzmi najlepiej
  // (np. krzyk skokowo): `legato` w recepturze = domyślnie skokowo. Poza nagraniami i Krzykiem dostały je instrumenty, które
  // z natury grają osobnymi nutami: klawisze (el. pianino, hammond: swoboda 0), szarpane (gitara, bas), dęte z palcami (okaryna,
  // gwizdek, harmonijka, dudy), chór (czysto na nucie), 8-bit i syntezy „krokowe” (chiptune, robot, impuls, trance, sub: swoboda 0, krok
  // jak arpeggiator). Płynnie zostają te, których urok to ślizg: puzon, trąbka, theremin, gitara hawajska, erhu, opera, wokal,
  // kot, kazoo, duduk, didgeridoo, ribbit, syntezator, przester, wobble, kwak, szept i wiatr.
  const Z_PROBEK={filtr:"lowpass",fMin:2500,fMax:9000,q:.5,puch:0,szarp:null,znieksz:0,am:0,wah:null,fEnv:0,wib:0,podtrzym:null,envC:null};
  // Przejścia skokowe dla instrumentu bez własnych nastaw (przełącznik na karcie gracza, glosZaby `opcje.przejscia`)
  const LEGATO_DOM={czas:.07,swoboda:.25},ARTYK_DOM={od:.012,zlep:.04};
  // Krok „skokowo” w grze (musi trafiać w nuty grane w grze): H = histereza zmiany nuty (półtony), R = zasięg
  // nut piosenki (śpiew bliżej niż R od nich staje na nich), ZWLOKA = ile sekund śpiew musi trwać na półtonie SPOZA piosenki,
  // zanim głos na niego wejdzie (glosZaby: kandydatP, krokP).
  const KROK={H:.15,R:.75,ZWLOKA:.07};
  // Własne instrumenty gracza (studio dźwięków, js/studio.js): receptury w tej samej postaci co wyżej, dopisywane w trakcie gry.
  // Klucz zaczyna się od „w-”, więc nie zderza się z instrumentami gry. Zapis trzyma studio, tu tylko żyją w pamięci.
  const WLASNE={};
  // Do 10-16 część instrumentów była uderzana (nuta z receptury podkładu, gasła sama); teraz wszystkie trzymają nutę,
  // więc lista uderzanych jest pusta (zostaje w API dla zgodności).
  const UDERZANE=[];
  const INSTRUMENTY_GRACZA=Object.keys(RECEPTURY);
  const jestInstrument=r=>INSTRUMENTY_GRACZA.includes(r)||Object.prototype.hasOwnProperty.call(WLASNE,r);
  const dodajWlasny=(id,rec)=>{if(typeof id==="string"&&/^w-/.test(id)&&rec&&typeof rec==="object")WLASNE[id]=rec;};
  const usunWlasny=id=>{delete WLASNE[id];};
  const wlasne=()=>Object.keys(WLASNE);
  // Studio dźwięków (funkcjonalność jak w Synthcie RibbitFlipa): receptura własna może nieść to, co brzmienie
  // Syntha (rf-21 _mkVoice, rf-20 sanitizePatch), przepisane na nazwy gry. Każdy klucz jest OPCJONALNY i bez niego graf
  // głosu buduje się bajt w bajt jak dotąd (zasada zgodności z panelu):
  //   `wt`        64 próbki jednego okresu (−1..1) → PeriodicWave zamiast `fala` (edytor Fala); pamięć podręczna per kontekst,
  //   `sub`       sinus oktawę niżej (połowa głośności), `osc2:{fala,polton,rozstroj,miks}` druga warstwa oscylatora,
  //   `eq`        ≤4 pasm peaking {f,g,q} za filtrem (korektor Barwa), `filtr:"notch"` jak każdy typ BiquadFilter,
  //   `fEnv`/`fEnvT` obwiednia filtra: ConstantSource dodany do częstotliwości, skok o fEnv·(fMax−fMin) i powrót w fEnvT/3,
  //   `zanik`/`podtrzym` ADSR: po ataku głośność opada do podtrzym·poziom w `zanik` s (bez klucza: płaskie trzymanie),
  //   `envC`      [atak, zanik, puszczenie] −1..1 (zgięcia odcinków): osobny węzeł `obw` przed vca gra krzywe
  //               setValueCurveAtTime (jak rf-21 _envPair), a przy puszczeniu cancelAndHoldAtTime + krzywa do zera;
  //               silnik bez tych metod dostaje zwykły setTargetAtTime. Szarpnięcie (`szarp`) ma własną obwiednię, więc
  //               `envC` działa tylko bez niego.
  // Instrumenty z próbek (10-19, `probki` w recepturze): WAV PCM16 mono z web/assets/<nazwa>/ + manifest <nazwa>.json
  // ({sr, probki:[{plik, root (półton MIDI, ułamkowy), petla:[od, do] w s}]}). Surowe próbki (Float32) żyją po jednym egzemplarzu,
  // a AudioBuffer powstaje leniwie osobno dla każdego kontekstu (gra i pomiar offline mają różne). Ładowanie rusza przy
  // utworzeniu kontekstu gry; test offline woła `await Glos.zaladujProbki()`. Błąd sieci = głos zastępczy z oscylatorów.
  //
  // Studio umożliwia samplowanie pliku audio, nagranie albo dogranie: ten sam tor gra też
  // PRÓBKI GRACZA, a zestaw nie musi być katalogiem w web/assets/. `ustawProbki(nazwa, lista)` wkłada gotowe, już
  // zdekodowane próbki wprost do tej samej tablicy (studio-probki.js: nagranie z mikrofonu albo plik z dysku, bajty
  // w IndexedDB), więc dalej wszystko jest wspólne: wybór próbki, pętla, pitch i wibrato. Dwie różnice są celowe:
  //   • `wersja` — podmiana próbki pod tą samą nazwą (ponowne nagranie) unieważnia AudioBuffery wyliczone dla kontekstów
  //     (BUFORY to WeakMap, nie da się jej przejść), więc pamięć podręczna ma klucz „nazwa#wersja”,
  //   • `probkaRoot`, `probkaPetla` i `probkaStaly` W RECEPTURZE — jeden zestaw bajtów obsługuje kilka instrumentów
  //     (kopia instrumentu dzieli próbkę), a strój, pętlę i „nie przestrajaj" każdy z nich ma własne. Bez tych kluczy
  //     liczy się to, co niesie sama próbka (Krzyk), więc instrumenty gry zostają bajt w bajt takie same.
  //
  // Większa kontrola użytkownika nad próbką: WYCINEK, POZIOM, KIERUNEK I ZLEPEK SZWU PĘTLI NIE
  // SĄ TUTAJ. Zestaw, który tu wchodzi, ma je już w bajtach — Studio przepuszcza nagranie przez `ProbkiAudio.wytnij`
  // i wkłada wynik pod nazwą, w której siedzi odcisk nastaw (studio-probki.js `zarejestrujEdycje`). Dzięki temu silnik
  // dalej robi jedną rzecz (źródło buforowe z pętlą), zlepek da się zrobić w ogóle (jedno źródło nie umie
  // przenikać się ze sobą), a dwa instrumenty o różnym wycinku nie nadpisują sobie buforów.
  // MAPY: te same obiekty, które siedzą w BUFORY, tylko w zwykłej tablicy. Potrzebne, bo WeakMap-y nie da się
  // przejść, a od 10-20 zestawy próbek gracza PRZYCHODZĄ I ODCHODZĄ — każda nastawa wycinka to osobna nazwa,
  // więc bez tego `usunProbki` zostawiałoby AudioBuffery (do 1,5 MB każdy) do końca życia strony.
  const PROBKI={},BUFORY=new WeakMap(),MAPY=[],PROBKI_URL="../assets/";
  function parsujWav(ab){
    const dv=new DataView(ab);let p=12,sr=22050,dane=null;
    while(p+8<=dv.byteLength){
      const id=String.fromCharCode(dv.getUint8(p),dv.getUint8(p+1),dv.getUint8(p+2),dv.getUint8(p+3)),n=dv.getUint32(p+4,true);
      if(id==="fmt ")sr=dv.getUint32(p+12,true);
      else if(id==="data"){const k=Math.min(n,dv.byteLength-p-8)>>1;dane=new Float32Array(k);for(let i=0;i<k;i++)dane[i]=dv.getInt16(p+8+i*2,true)/32768;break;}
      p+=8+n+(n&1);
    }
    return dane?{sr,dane}:null;
  }
  function zaladujProbki(nazwa){
    nazwa=nazwa||"krzyk";
    if(PROBKI[nazwa])return PROBKI[nazwa].obietnica;
    const wpis=PROBKI[nazwa]={lista:null,obietnica:null,wersja:1};
    // Bez fetch albo ze strony file:// (demo z tools/ribbitbeat_probki_demo.py wkłada próbki przez ustawProbki) nie ma czego pobierać.
    if(typeof fetch!=="function"||(typeof location!=="undefined"&&location.protocol==="file:")){delete PROBKI[nazwa];return Promise.resolve(null);}
    const baza=PROBKI_URL+nazwa+"/";
    // `strefy` w manifeście (10-21): próbki to STREFY klawiatury (C3, G3, D4…), nie warianty jednej nuty → gra zawsze najbliższą
    wpis.obietnica=fetch(baza+nazwa+".json").then(r=>r.json()).then(m=>{wpis.strefy=!!m.strefy;
        return Promise.all(m.probki.map(p=>fetch(baza+p.plik).then(r=>r.arrayBuffer()).then(parsujWav).then(w=>w&&{sr:w.sr,dane:w.dane,root:+p.root,petla:p.petla})));})
      .then(l=>{l=l.filter(Boolean);if(l.length)wpis.lista=l;else delete PROBKI[nazwa];return wpis.lista;})
      .catch(()=>{delete PROBKI[nazwa];return null;});   // przy błędzie następna prośba spróbuje jeszcze raz
    return wpis.obietnica;
  }
  // Zestaw próbek podany z zewnątrz (próbki gracza ze Studia): `lista` = [{sr, dane (Float32, mono), root, petla}].
  // Ta sama nazwa drugi raz = podmiana (ponowne nagranie), więc rośnie `wersja` i AudioBuffery liczą się od nowa.
  // `strefy` (opcjonalne, 10-21): zestaw stref klawiatury zamiast wariantów jednej nuty (demo instrumentów z nagrań wkłada
  // nim te same bajty, co leżą w web/assets/); Studio go nie podaje, więc próbki gracza działają jak dotąd.
  function ustawProbki(nazwa,lista,strefy){
    if(typeof nazwa!=="string"||!nazwa)return false;
    const L=(Array.isArray(lista)?lista:[]).filter(p=>p&&p.dane&&p.dane.length&&+p.sr>0)
      .map(p=>({sr:+p.sr,dane:p.dane,root:Number.isFinite(+p.root)?+p.root:60,petla:Array.isArray(p.petla)&&p.petla.length===2?[+p.petla[0],+p.petla[1]]:null}));
    if(!L.length){usunProbki(nazwa);return false;}
    const stara=PROBKI[nazwa];
    PROBKI[nazwa]={lista:L,obietnica:Promise.resolve(L),wersja:(stara?stara.wersja:0)+1,strefy:!!strefy};
    return true;
  }
  function usunProbki(nazwa){
    delete PROBKI[nazwa];
    const prz=nazwa+"#";
    for(const m of MAPY)for(const k of Object.keys(m))if(k.slice(0,prz.length)===prz)delete m[k];
  }
  function probkiDla(c,nazwa){
    const s=PROBKI[nazwa];if(!s||!s.lista)return null;
    let m=BUFORY.get(c);if(!m){m={};BUFORY.set(c,m);MAPY.push(m);}
    const k=nazwa+"#"+(s.wersja||1);
    if(!m[k]){m[k]=s.lista.map(p=>{const b=c.createBuffer(1,p.dane.length,p.sr);b.copyToChannel(p.dane,0);return {buf:b,root:p.root,petla:p.petla};});
      m[k].strefy=!!s.strefy;}   // cecha zestawu jedzie z tablicą buforów (wybierzProbke)
    return m[k];
  }
  // Co jest w tablicy próbek (diagnostyka i testy; samo pytanie nic nie ładuje).
  function probkiStan(){const o={};for(const k of Object.keys(PROBKI)){const s=PROBKI[k];o[k]={ile:s.lista?s.lista.length:0,wersja:s.wersja||1};}return o;}
  // Wybór próbki do nuty: wszystkie, których strój leży prawie tak blisko nuty jak najbliższy (do 2,5 półtonu różnicy), grają na
  // zmianę, żeby krzyki się nie powtarzały (nagrania mają zbliżony strój, więc zwykle są to wszystkie).
  // Zestaw ze STREFAMI (10-21, instrumenty orkiestrowe: po jednej nucie co 7–12 półtonów) gra zawsze najbliższą — rotacja
  // między dwiema równie odległymi (nuta w pół drogi) dawałaby inną barwę co drugą nutę.
  let rotacjaProbek=0;
  function wybierzProbke(L,polton){
    const d=L.map(p=>Math.abs(p.root-polton)),m=Math.min(...d),k=[];
    if(L.strefy)return L[d.indexOf(m)];
    d.forEach((v,i)=>{if(v-m<2.5)k.push(i);});
    return L[k[rotacjaProbek++%k.length]];
  }
  let faleWlasne=null;   // PeriodicWave z `wt` (klucz = próbki po przecinku), ginie z kontekstem (kontekst(gotowy))
  function falaZProbek(c,wt){
    if(!faleWlasne||faleWlasne.c!==c)faleWlasne={c,m:new Map()};
    const k=wt.join(",");let w=faleWlasne.m.get(k);if(w)return w;
    if(faleWlasne.m.size>=32)faleWlasne.m.clear();
    const N=64,re=new Float32Array(33),im=new Float32Array(33);let mx=0;
    for(let h=1;h<=32;h++){let a=0,b=0;
      for(let n=0;n<N;n++){const ang=2*Math.PI*h*n/N,v=+wt[n]||0;a+=v*Math.cos(ang);b+=v*Math.sin(ang);}
      const sc=(h===32?1:2)/N;re[h]=a*sc;im[h]=b*sc;mx=Math.max(mx,Math.abs(re[h]),Math.abs(im[h]));}
    w=c.createPeriodicWave(re,im,{disableNormalization:mx<1e-6});   // płaska linia zostaje cicha, nie NaN
    faleWlasne.m.set(k,w);return w;
  }
  // kształt odcinka obwiedni (kopia SoundScreens.envShape z rf-25c): s 0..1 → 0..1 przez zgięcie c (−1..1); c 0 = dzisiejszy
  // kształt wykładniczy (k 3, jak setTargetAtTime z tau = czas/3), c<0 ostrzej, 0<c≤.5 łagodniej do prostej, c>.5 wypukło
  function ksztaltObw(s,c){s=s<=0?0:(s>=1?1:s);c=+c||0;
    const k=c<=0?3*Math.pow(4,-c):(c<=.5?3*(1-2*c):-12*(c-.5));
    return k>1e-6?(1-Math.exp(-k*s))/(1-Math.exp(-k)):(k<-1e-6?(Math.exp(-k*s)-1)/(Math.exp(-k)-1):s);}
  const maObwC=r=>Array.isArray(r.envC)&&r.envC.length===3&&r.envC.every(x=>typeof x==="number"&&Number.isFinite(x))&&r.envC.some(x=>x!==0)&&!r.szarp;
  // Głośność jednego głosu, kiedy śpiewa ich `n` naraz. Głosy mają różne fazy i rozstrój, więc sumują
  // się mniej więcej jak szum (√n), stąd pierwiastek. Gra i pomiar biorą skalę z tego jednego miejsca.
  function skala(n){return POZIOM.glos/Math.sqrt(Math.max(1,n/2));}
  // Jeden ciągły głos na gracza: oscylatory chodzą cały czas, a śpiew to tylko obwiednia na wzmacniaczu.
  // Dzięki temu wysokość płynie bez przerw (glissando jak w puzonie), a start nuty nie kosztuje
  // budowania grafu. `nr` (1, 2, …) daje głosowi stały rozstrój ±8 ct i start przesunięty o kilka ms:
  // bez tego osiem żab na tej samej nucie startowało w tej samej fazie i zlewało się w jeden, ośmiokrotnie
  // głośniejszy ton z falującym „phasingiem” zamiast chóru. Metody biorą opcjonalny czas `t` (sekundy na
  // zegarze kontekstu), żeby pomiar offline mógł zaplanować całą piosenkę z góry; w grze to zawsze „teraz”.
  // `cel` (opcjonalny): węzeł zamiast szyny żab; podgląd piosenki w lobby wpina tu swoją szynę.
  function glosZaby(rodzaj,sk,nr,cel,opcje){
    const c=kontekst();let r=RECEPTURY[rodzaj]||WLASNE[rodzaj]||RECEPTURY.trabka;
    if(!c)return {ustaw(){},spiewaj(){},zniszcz(){},stan(){return null;}};
    const rOrg=r;   // receptura przed nastawami toru próbek: jej `probkiRec.legato` mówi o charakterze instrumentu także bez plików
    const P=r.probki?probkiDla(c,r.probki):null;   // instrument z próbek (Krzyk): null, dopóki się nie wczytały, wtedy głos zastępczy
    // Instrument z nagrań (10-21): DOPIERO gdy próbki są, receptura dostaje nastawy toru próbek (Z_PROBEK + własne `probkiRec`).
    // Bez nich (pliki w drodze albo ich brak) `r` zostaje recepturą oscylatorów bajt w bajt, czyli dawnym brzmieniem instrumentu.
    if(P&&r.probkiRec)r=Object.assign({},r,Z_PROBEK,r.probkiRec);
    const rozstroj=nr?((nr*37)%17)-8:0,start=c.currentTime+(nr?((nr*53)%29)/1000:0);
    const vca=c.createGain();vca.gain.value=0;vca.connect(cel||busZaby);
    const f=c.createBiquadFilter();f.type=r.filtr;f.Q.value=r.q;f.frequency.value=r.fMin*2;
    // `envC` (studio): węzeł kształtu obwiedni przed vca; vca trzyma wtedy sam poziom, a `obw` gra krzywe
    const obw=maObwC(r)?c.createGain():null;if(obw){obw.gain.value=0;obw.connect(vca);}
    const wyj=obw||vca;
    // `eq` (studio): korektor, pasma peaking jedno za drugim za filtrem (ta sama formuła co BiquadFilter „peaking” w Synthcie)
    let wyjF=f;
    if(Array.isArray(r.eq))for(const b of r.eq.slice(0,4)){if(!b||!(+b.f>0))continue;const n=c.createBiquadFilter();n.type="peaking";
      n.frequency.value=+b.f;n.gain.value=+b.g||0;n.Q.value=+b.q>0?+b.q:1;wyjF.connect(n);wyjF=n;}
    // `formanty`: [[Hz, Q, wzmocnienie], …] równoległe pasma za filtrem (samogłoska); bez nich filtr idzie prosto do głosu
    if(r.formanty&&!P)for(const [fr,q,a] of r.formanty){const bp=c.createBiquadFilter();bp.type="bandpass";bp.frequency.value=fr;bp.Q.value=q;
      const bg=c.createGain();bg.gain.value=a;wyjF.connect(bp);bp.connect(bg);bg.connect(wyj);}
    else wyjF.connect(wyj);
    let wejscie=f;const zrodla=[],oscy=[];
    // `fEnv` (studio): obwiednia filtra, źródło stałe dodane do częstotliwości filtra, wyzwalane przy każdej nucie (kopF)
    let fEnv=null;
    if(r.fEnv&&typeof c.createConstantSource==="function"){fEnv=c.createConstantSource();fEnv.offset.value=0;fEnv.connect(f.frequency);fEnv.start(start);zrodla.push(fEnv);}
    const kopF=t=>{if(!fEnv)return;const a=r.fEnv*(r.fMax-r.fMin),T=Math.max(.005,r.fEnvT||.2);
      fEnv.offset.cancelScheduledValues(t);fEnv.offset.setValueAtTime(a,t);fEnv.offset.setTargetAtTime(0,t,T/3);};
    // `znieksz`: przesterowanie (tanh) przed filtrem; amplituda oscylatorów jest 1, więc pierwiastek z wzmocnienia daje „zęby”
    if(r.znieksz){const sh=c.createWaveShaper(),n=1024,krzywa=new Float32Array(n);
      for(let i=0;i<n;i++){const x=i*2/(n-1)-1;krzywa[i]=Math.tanh(x*r.znieksz);}
      sh.curve=krzywa;sh.oversample="2x";sh.connect(f);wejscie=sh;}
    if(r.wah){   // falowanie filtra (kwak, wobble): LFO dodaje się do częstotliwości filtra
      const lfo=c.createOscillator(),lg=c.createGain();lfo.type="sine";lfo.frequency.value=r.wah.rate;lg.gain.value=r.wah.gl;
      lfo.connect(lg);lg.connect(f.frequency);lfo.start(start);zrodla.push(lfo);
    }
    if(r.am){
      const am=c.createGain();am.gain.value=.55;am.connect(wejscie);wejscie=am;
      const lfo=c.createOscillator();lfo.type="square";lfo.frequency.value=r.am;
      const gl=c.createGain();gl.gain.value=.45;lfo.connect(gl);gl.connect(am.gain);lfo.start(start);zrodla.push(lfo);
    }
    const krotnosc=[];let bpSzum=null;
    // `typ` (studio: sub, osc2): własny typ fali tego jednego oscylatora zamiast fali receptury
    const osc=(det,mnoz,glosn,typ)=>{const o=c.createOscillator();if(typ)o.type=typ;else if(fala)o.setPeriodicWave(fala);else o.type=r.fala;o.frequency.value=220;o.detune.value=det+rozstroj;
      if(glosn!=null&&glosn!==1){const g=c.createGain();g.gain.value=glosn;o.connect(g);g.connect(wejscie);}else o.connect(wejscie);
      o.start(start);oscy.push(o);zrodla.push(o);krotnosc.push(mnoz||1);};
    // `pulse`: fala prostokątna o szerokości impulsu 0..1 (PeriodicWave z szeregu Fouriera)
    let fala=null;
    if(r.pulse){const N=48,re=new Float32Array(N),im=new Float32Array(N),d=r.pulse;
      for(let n=1;n<N;n++){re[n]=Math.sin(2*Math.PI*n*d)/(n*Math.PI);im[n]=(1-Math.cos(2*Math.PI*n*d))/(n*Math.PI);}
      fala=c.createPeriodicWave(re,im);}
    else if(Array.isArray(r.wt)&&r.wt.length===64)fala=falaZProbek(c,r.wt);   // studio: własna fala z edytora
    if(P){}   // źródłem są próbki: każda nuta tworzy własne źródło (startProbki)
    else if(r.szum){   // szum filtrowany na wysokości nuty (szept, wiatr): zamiast oscylatorów
      const zr=c.createBufferSource();zr.buffer=szum();zr.loop=true;
      bpSzum=c.createBiquadFilter();bpSzum.type="bandpass";bpSzum.Q.value=r.szum.q;bpSzum.frequency.value=800;
      zr.connect(bpSzum);bpSzum.connect(wejscie);zr.start(start);zrodla.push(zr);
    }
    else{
      if(r.oddech){   // szum oddechu obok tonu (duduk): to samo pasmo na wysokości nuty co `szum`, ale ciszej i razem z oscylatorami
        const zr=c.createBufferSource();zr.buffer=szum();zr.loop=true;const og=c.createGain();og.gain.value=r.oddech.poziom==null?.3:+r.oddech.poziom;
        bpSzum=c.createBiquadFilter();bpSzum.type="bandpass";bpSzum.Q.value=r.oddech.q||4;bpSzum.frequency.value=800;
        zr.connect(bpSzum);bpSzum.connect(og);og.connect(wejscie);zr.start(start);zrodla.push(zr);
      }
      if(r.harm)for(const [m,a] of r.harm)osc(0,m,a);
      else if(r.unison)for(const d of r.unison)osc(d);
      else if(r.rozstroj){osc(r.rozstroj);osc(-r.rozstroj);}else osc(0);
      if(r.sub)osc(0,.5,.5,"sine");   // studio: sub-oktawa
      if(r.osc2&&typeof r.osc2==="object")osc(+r.osc2.rozstroj||0,Math.pow(2,(+r.osc2.polton||0)/12),r.osc2.miks==null?.5:+r.osc2.miks,r.osc2.fala||"sawtooth");   // studio: druga warstwa
    }
    // wibrato z obrotu kapsla: sinus 5,6 Hz na `detune` każdego oscylatora (ten sam wzór co w Synthcie)
    const wib=c.createOscillator();wib.frequency.value=5.6;
    const wibG=c.createGain();wibG.gain.value=r.wib||0;wib.connect(wibG);for(const o of oscy)wibG.connect(o.detune);
    wib.start(start);zrodla.push(wib);
    const okt=Math.pow(2,r.okt||0),glide=r.glide||.012;
    let spiewa=false,ciecie=r.fMin*2,puchDo=0,ostP=NaN,ostO=NaN,ostW=NaN,ostT=-1;   // ost*: ostatnio wysłane do ustaw()
    // Próbki (Krzyk): jedno źródło na nutę. Start od początku próbki (wejście krzyku), potem pętla ustabilizowanego odcinka;
    // `playbackRate` = 2^((wysokość − strój próbki)/12), więc ustaw() goni wysokość razem z formantami (pitch shift). Wibrato z
    // obrotu kapsla idzie na `detune` źródła. Poprzednie źródło gaśnie w 10 ms przy następnej nucie albo z obwiednią przy puszczeniu.
    // Próbka gracza (studio): strój i pętlę niesie receptura, nie próbka — `probkaRoot` zamiast p.root, `probkaPetla`
    // zamiast p.petla, a BRAK pętli (jedno słowo, klaśnięcie) znaczy „zagraj raz i ucichnij”, więc źródło nie zapętla się wcale.
    // 10-20: `probkaStaly` („Nie przestrajaj" w Studiu) znaczy strój NULL — klaśnięcie, bęben albo słowo ma
    // brzmieć tak samo na całej klawiaturze, więc ani start nuty, ani jej ruch nie rusza tempa odtwarzania.
    let zrP=null,zrStary=null,nutaP=NaN;
    // Przejścia „organiczne”: zamiast płynnego ślizgu wysokości przejście bardziej naturalne (np. słyszalne wejście na nutę,
    // u smyczków ruch smyczka), i tylko w instrumentach, w których ma to sens. Dwa klucze w probkiRec, każdy osobno i tylko tam, gdzie pasuje:
    //   `legato:{czas, swoboda}` — próbka gra PÓŁTONY: nowy półton (próg ±0,6, jak `szarp`) to skok z miękkim wejściem `czas` s, a
    //     odchyłka śpiewu w obrębie półtonu przechodzi tylko w `swoboda` (0 = klawisz, .25 = dęte, .35 = smyczki); wibrato kapsla
    //     idzie osobno na detune i zostaje. Bez tego klucza wysokość goni śpiew ciągle, jak dotąd (puzon: ślizg to jego natura; trąbka
    //     też, bo może mieć luźne przesunięcia),
    //   `artyk:{od, zlep}` — nowy półton w trakcie śpiewu to NOWE ŹRÓDŁO z właściwej strefy (barwa na miejscu, nie rozciągnięta
    //     strefa startowa), od `od` s w nagraniu (0 = cały atak: smyczek, młoteczek, chiff piszczałki; .01–.02 = miękki „język”
    //     dętych), przenikane ze starym przez `zlep` s. Źródło poprzedniej, puszczonej nuty gaśnie przy nowej w 10 ms, żeby jego
    //     ogon nie wracał przez otwieraną obwiednię.
    // Do 10-22 był trzeci, `smyk`: szum smyczka głośny od SZYBKOŚCI ruchu wysokości. Po teście w grze szum
    // przesunięcia przy smyczkach okazał się zbędny i został wywalony, bo prawdziwy smyczek nie szumi od przesuwania palca,
    // tylko przy zmianie smyczka, a tę niesie już samo nagranie (`artyk` od 0 = cały atak smyczka z próbki).
    // Tryb przejść (każdy instrument ma przełącznik brzmienia pod wyborem
    // instrumentu): `opcje.przejscia` "skok" | "plynne" nadpisuje domyślny z receptury (`legato` w recepturze = domyślnie
    // skokowo, przydział przy Z_PROBEK). Skokowo bez własnego `legato` bierze LEGATO_DOM, a głos z próbek także ARTYK_DOM
    // (nowa nuta = nowe źródło); oscylatory skaczą samą wysokością (`szarp` i tak uderza na nowo). Płynnie = wysokość goni śpiew.
    // Własne `legato` instrumentu: z receptury po nastawach próbek, a gdy plików jeszcze nie ma — z jej `probkiRec` (pianino gra
    // wtedy oscylatorami, ale dalej jak klawisz: swoboda 0). Domyślny tryb liczy się tak samo jak `domyslnePrzejscia`.
    const legatoRec=(r.legato&&typeof r.legato==="object"&&r.legato)||(rOrg.probkiRec&&rOrg.probkiRec.legato&&typeof rOrg.probkiRec.legato==="object"&&rOrg.probkiRec.legato)||null;
    const skokP=opcje&&opcje.przejscia==="skok"?true:opcje&&opcje.przejscia==="plynne"?false:!!legatoRec;
    const legatoP=skokP?(legatoRec||LEGATO_DOM):null;
    const artykP=skokP&&P?(r.artyk&&typeof r.artyk==="object"?r.artyk:ARTYK_DOM):null;
    const swobodaP=legatoP?Math.max(0,Math.min(1,+legatoP.swoboda||0)):1;
    // Swoboda intonacji działa w obrębie pół półtonu: dalej to już ruch do innej nuty (np. jazda za zjazdem w grze), a nie
    // intonacja — bez ograniczenia głos podjeżdżałby za śpiewem o ćwierć drogi do następnej nuty, zanim na nią wskoczy.
    const wysP=polton=>legatoP&&Number.isFinite(nutaP)?nutaP+swobodaP*Math.max(-.5,Math.min(.5,polton-nutaP)):polton;
    // Krok „skokowo” (musi trafiać w nuty grane w grze): na której nucie stoi głos. `cele` = nuty piosenki, które
    // gra podaje w tej chwili (zabi-chor.js `nutyGlosu`: na nucie ona sama, w jej zjeździe także nuta docelowa, w krótkiej
    // przerwie poprzednia i następna). Śpiew w ich zasięgu (od najniższej − R do najwyższej + R) staje na najbliższej z nich OD
    // RAZU, więc zjazd z E do G w trybie płynnym gry to jeden krok E→G w połowie drogi, a nie E-F-F#-G z atakiem na każdym
    // półtonie. Śpiew dalej niż R od nich (fałsz, improwizacja) staje na najbliższym półtonie, ale dopiero gdy trwa tam ZWLOKA:
    // przejazd przez obce półtony nie wybija na nich ataków, a trzymany fałsz słychać. Bez `cele` (podgląd piosenki, demo,
    // Studio) każdy półton od razu, jak dotąd. Nuta zmienia się tylko, gdy nowa jest bliżej śpiewu o H (bez „trzepotu” na granicy).
    let ostCele=null,kandN=NaN,kandT=0,nArtyk=0,nKrok=0,zNutP=false;
    const kandydatP=(p,S)=>{
      zNutP=false;
      if(S&&S.length){
        let lo=Infinity,hi=-Infinity,b=NaN,bd=Infinity;
        for(let i=0;i<S.length;i++){const q=+S[i];if(!Number.isFinite(q))continue;if(q<lo)lo=q;if(q>hi)hi=q;const d=Math.abs(p-q);if(d<bd){bd=d;b=q;}}
        if(Number.isFinite(b)&&p>=lo-KROK.R&&p<=hi+KROK.R){zNutP=true;return b;}
      }
      return Math.round(p);
    };
    const krokP=(p,S,t)=>{
      const k=kandydatP(p,S);
      if(!Number.isFinite(nutaP)){nutaP=k;kandN=NaN;return true;}
      if(k===nutaP||Math.abs(p-k)+KROK.H>=Math.abs(p-nutaP)){kandN=NaN;return false;}
      if(zNutP||!(S&&S.length)){nutaP=k;kandN=NaN;return true;}
      if(k!==kandN){kandN=k;kandT=t;return false;}
      if(t-kandT>=KROK.ZWLOKA){nutaP=k;kandN=NaN;return true;}
      return false;
    };
    const stalyP=r.probkaStaly===true;
    const rootP=p=>stalyP?null:(Number.isFinite(+r.probkaRoot)?+r.probkaRoot:p.root);
    const petlaP=p=>{const q=r.probkaPetla!==undefined?r.probkaPetla:p.petla;
      return Array.isArray(q)&&q.length===2&&+q[1]>+q[0]?[+q[0],+q[1]]:null;};
    // `probkaOkt` (10-21): o tyle oktaw próbka gra obok nuty śpiewanej — odpowiednik `okt` oscylatorów (wiolonczela −1, flet +1),
    // osobny klucz, żeby próbki gracza ze Studia (które `okt` nigdy nie czytały) brzmiały jak dotąd. Wybór strefy też po tej wysokości.
    const oktP=12*(r.probkaOkt||0);
    const tonP=(z,polton)=>z.root==null?1:Math.pow(2,(polton+oktP-z.root)/12);
    const startProbki=(t,art)=>{
      const zl=art?Math.max(.005,+art.zlep||.04):.01;
      if(zrP){const z=zrP;zrP=null;try{z.sg.gain.setTargetAtTime(0,t,zl/3);z.src.stop(t+zl*3+.08);}catch(e){}}
      if(zrStary){const z=zrStary;zrStary=null;try{z.sg.gain.setTargetAtTime(0,t,.01);z.src.stop(t+.08);}catch(e){}}
      const pt=Number.isFinite(ostP)?ostP:60,p=wybierzProbke(P,wysP(pt)+oktP),pet=petlaP(p),root=rootP(p);
      const src=c.createBufferSource(),sg=c.createGain();
      src.buffer=p.buf;
      // `loopEnd` przycięte do długości bufora: koniec pętli zapisany w manifeście jest zaokrąglony do 0,1 ms,
      // więc bez tego potrafi wypaść o próbkę czy dwie za ostatnią próbką i przeglądarka po cichu zmienia go
      // na coś swojego. (To samo robi rf-21 w panelu.)
      if(pet){src.loop=true;src.loopStart=pet[0];src.loopEnd=Math.min(pet[1],p.buf.duration);}
      src.playbackRate.value=tonP({root},wysP(pt));
      // Ten sam rozstrój ±8 ct i start o kilka ms później, co oscylatory (`nr`): osiem żab na tym samym nagraniu i tej samej
      // nucie startowało w idealnej fazie i sumowało się do +18 dB (pomiar D w tests/gry_zabi_chor_dzwiek.mjs: 19 dB nad
      // podkładem zamiast ≤ 10), bo jeden bufor to jedna fala; z rozstrojem i przesunięciem sumują się jak chór, nie jak jeden głośnik.
      src.detune.value=rozstroj;
      src.connect(sg);sg.connect(wejscie);wibG.connect(src.detune);
      src.onended=()=>{try{wibG.disconnect(src.detune);}catch(e){}try{sg.disconnect();}catch(e){}};
      // artykulacja: nowe źródło od `od` s w nagraniu, wchodzi przenikaniem `zlep` (stare gaśnie w tym samym czasie, wyżej)
      const odA=art?Math.max(0,Math.min(+art.od||0,Math.max(0,p.buf.duration-.05))):0;
      if(art){sg.gain.setValueAtTime(0,t);sg.gain.setTargetAtTime(1,t,zl/3);nArtyk++;}
      src.start(t+(nr?((nr*53)%29)/1000:0),odA);zrP={src,sg,root};
    };
    const stopProbki=t=>{const z=zrP;zrP=null;if(!z)return;zrStary=z;try{z.src.stop(t+Math.max(.05,r.puszcz*3)+.05);}catch(e){}};
    // szarpnięcie (r.szarp): skok głośności i jasności na początku nuty i przy zmianie półtonu, potem podtrzymanie
    let ostU=NaN;
    const uderz=t=>{
      const cel=r.poziom*(r.glosnosc||1)*sk,[szczyt,czas]=r.szarp;
      vca.gain.cancelScheduledValues(t);vca.gain.setTargetAtTime(cel*szczyt,t,Math.max(.002,r.atak/3));
      vca.gain.setTargetAtTime(cel,t+Math.max(.01,r.atak*2),czas/3);
      f.frequency.cancelScheduledValues(t);f.frequency.setValueAtTime(Math.min(16000,ciecie*2.2),t);
      f.frequency.setTargetAtTime(ciecie,t,czas/3);puchDo=t+czas;kopF(t);
    };
    // Krzywe obwiedni (`envC`, studio) na węźle `obw`: atak i zanik jako JEDNA krzywa (dwie położone obok siebie potrafią
    // na siebie najechać, gdy przeglądarka przesuwa start z przeszłości do „teraz” z zachowaniem długości; patrz rf-21
    // _envPair), puszczenie jako druga od wartości, na której krzywa stoi (odczyt z zapamiętanych odcinków, bo
    // AudioParam.value spóźnia się o kwant renderu). Co najwyżej 4096 punktów, co ≤ 5 ms.
    const odcinki=[];
    const krzywaObw=(od,do_,c,n)=>{const o=new Float32Array(n);for(let i=0;i<n;i++)o[i]=od+(do_-od)*ksztaltObw(i/(n-1),c);o[0]=od;o[n-1]=do_;return o;};
    const wartoscObw=t=>{for(let i=odcinki.length-1;i>=0;i--){const q=odcinki[i],n=q.k.length;if(t<q.t0)continue;
      if(t>=q.t0+q.d)return q.k[n-1];const x=(t-q.t0)/q.d*(n-1),j=Math.min(n-2,Math.floor(x));return q.k[j]+(q.k[j+1]-q.k[j])*(x-j);}return 0;};
    const obwStart=t=>{
      const a=Math.max(.002,r.atak),sus=r.podtrzym==null?1:Math.max(0,Math.min(1,r.podtrzym)),d=Math.max(.02,r.zanik||.2);
      try{
        obw.gain.cancelScheduledValues(t);obw.gain.setValueAtTime(0,t);
        let h=Math.min(.005,a/8,d/8),nA=Math.max(1,Math.round(a/h));h=a/nA;let nD=sus<1?Math.max(1,Math.round(d/h)):0;
        if(nA+nD>4096){h=(a+d)/4096;nA=Math.max(1,Math.round(a/h));nD=sus<1?Math.max(1,4096-nA):0;}
        const k=new Float32Array(nA+nD+1);
        for(let i=0;i<nA;i++)k[i]=ksztaltObw(i/nA,r.envC[0]);
        for(let i=0;i<=nD;i++)k[nA+i]=1+(sus-1)*ksztaltObw(i/nD,r.envC[1]);
        k[0]=0;k[nA]=1;k[nA+nD]=nD?sus:1;const dur=(nA+nD)*h;
        obw.gain.setValueCurveAtTime(k,t,dur);odcinki.push({t0:t,d:dur,k});if(odcinki.length>8)odcinki.shift();
      }catch(e){obw.gain.cancelScheduledValues(t);obw.gain.setTargetAtTime(1,t,a/3);odcinki.length=0;}
    };
    const obwKoniec=t=>{
      const od=Math.max(0,wartoscObw(t)),rel=Math.max(.01,r.puszcz),g=obw.gain;
      try{g.cancelAndHoldAtTime(t);const k=krzywaObw(od,0,r.envC[2],Math.max(8,Math.min(256,Math.round(rel*200))));g.setValueCurveAtTime(k,t,rel);odcinki.push({t0:t,d:rel,k});return;}catch(e){}
      try{g.cancelScheduledValues(t);g.setValueAtTime(od,t);g.setTargetAtTime(0,t,rel/3);}catch(e){vca.gain.cancelScheduledValues(t);vca.gain.setTargetAtTime(0,t,rel/3);}
    };
    return {
      // polton = wysokość (ułamkowa), otwarcie 0..1 = jasność filtra, wibrato w centach, `cele` (opcjonalne) = nuty piosenki,
      // na których przejścia „skokowo” mogą stanąć (krokP); gra podaje je co klatkę, reszta wywołań ich nie zna
      ustaw(polton,otwarcie,wibrato,t,cele){
        if(t==null)t=c.currentTime;
        if(cele!==undefined)ostCele=cele;
        // skokowo: decyzja o nucie przy KAŻDYM wywołaniu (to tylko kilka porównań), bo zwłoka na obcym półtonie musi dobiec
        // końca także wtedy, gdy wysokość już stoi i ogranicznik niżej odrzuca wywołanie jako „bez zmian”
        const krok=!!(legatoP&&spiewa&&krokP(polton,ostCele,t));
        // 10-10 (płynność): gra woła to w każdym kroku, na ekranie 240 Hz 240 razy na sekundę, a każde wywołanie to pięć
        // nowych zdarzeń na osi parametrów dla wątku audio. Bez zauważalnej zmiany (0,02 półtonu, 0,02 otwarcia, 1 cent
        // wibrata) albo częściej niż co 8 ms (chyba że wysokość skacze o ćwierć tonu) nic się nie dopisuje — chyba że głos
        // właśnie wszedł na nową nutę.
        const dp=Math.abs(polton-ostP);
        if(!krok&&((dp<.02&&Math.abs(otwarcie-ostO)<.02&&Math.abs((wibrato||0)-ostW)<1)||(t-ostT<.008&&dp<.25)))return;
        ostP=polton;ostO=otwarcie;ostW=wibrato||0;ostT=t;
        // skokowo: nowa nuta (krokP) to skok z miękkim wejściem `czas`, w obrębie nuty przechodzi `swoboda` odchyłki (do pół
        // półtonu); oscylatory i próbka liczą tę samą wysokość `wys`, a głos z próbek przy artykulacji startuje nowe źródło
        let wys=polton,tau=glide;
        if(legatoP&&spiewa){wys=wysP(polton);if(krok){tau=Math.max(.004,(+legatoP.czas||.08)/3);nKrok++;}}
        const fq=hz(wys)*okt;
        oscy.forEach((o,i)=>o.frequency.setTargetAtTime(fq*krotnosc[i],t,tau));
        if(zrP){if(krok&&artykP)startProbki(t,artykP);else zrP.src.playbackRate.setTargetAtTime(tonP(zrP,wys),t,tau);}
        if(bpSzum)bpSzum.frequency.setTargetAtTime(Math.min(16000,fq*((r.szum||r.oddech).mnoz||1)),t,glide);
        ciecie=r.fMin*Math.pow(r.fMax/r.fMin,Math.max(0,Math.min(1,otwarcie)));
        if(t>=puchDo)f.frequency.setTargetAtTime(ciecie,t,.04);
        wibG.gain.setTargetAtTime(Math.max(r.wib||0,wibrato||0),t,.06);
        // szarpnięcie (pianino, gitara, el. pianino z oscylatorów): skokowo uderza razem z krokiem na nową nutę (w zjeździe gry
        // raz, nie na każdym półtonie), płynnie jak dotąd na każdej zmianie półtonu
        if(r.szarp&&spiewa){if(legatoP){if(krok)uderz(t);}else if(Math.abs(polton-ostU)>.6){ostU=Math.round(polton);uderz(t);}}
      },
      // Obwiednia to łańcuch setTargetAtTime: każde zdarzenie rusza od wartości z chwili `t`, więc
      // nie trzeba niczego kasować ani czytać bieżącej wartości (i działa tak samo offline).
      spiewaj(tak,t){
        tak=!!tak;if(tak===spiewa)return;spiewa=tak;
        if(t==null)t=c.currentTime;
        if(!tak){if(P)stopProbki(t);
          if(obw)obwKoniec(t);else vca.gain.setTargetAtTime(0,t,Math.max(.01,r.puszcz/3));return;}
        nutaP=kandydatP(Number.isFinite(ostP)?ostP:60,ostCele);kandN=NaN;   // nowa nuta startuje od razu na nucie piosenki (albo półtonie)
        if(P)startProbki(t);
        else if(legatoP&&Number.isFinite(ostP)){const fq=hz(wysP(ostP))*okt;oscy.forEach((o,i)=>o.frequency.setTargetAtTime(fq*krotnosc[i],t,.005));}   // skokowo: nuta startuje na całym półtonie
        if(r.szarp){ostU=Number.isFinite(ostP)?Math.round(ostP):NaN;uderz(t);return;}
        const cel=r.poziom*(r.glosnosc||1)*sk;kopF(t);
        if(obw){vca.gain.cancelScheduledValues(t);vca.gain.setValueAtTime(cel,t);obwStart(t);}   // studio: krzywe na `obw`, vca = sam poziom
        else{
          vca.gain.setTargetAtTime(cel,t,Math.max(.005,r.atak/3));
          // studio: ADSR, po ataku głośność opada do podtrzymania (bez `podtrzym` = płaskie trzymanie jak dotąd)
          if(r.podtrzym!=null&&r.podtrzym<1)vca.gain.setTargetAtTime(cel*Math.max(0,r.podtrzym),t+r.atak+.005,Math.max(.01,(r.zanik||.2)/3));
        }
        if(r.puch){   // trąbka: filtr startuje przymknięty i „puchnie” do jasności, jak dęcie
          f.frequency.cancelScheduledValues(t);f.frequency.setValueAtTime(Math.max(90,ciecie*.28),t);
          f.frequency.setTargetAtTime(ciecie,t,r.puch/3);puchDo=t+r.puch*1.5;
        }
      },
      zniszcz(){
        const t=c.currentTime;
        vca.gain.cancelScheduledValues(t);vca.gain.setTargetAtTime(0,t,.03);
        for(const o of zrodla){try{o.stop(t+.3);}catch(e){}}
        if(zrP){try{zrP.src.stop(t+.3);}catch(e){}zrP=null;}
        setTimeout(()=>{try{vca.disconnect();}catch(e){}},700);
      },
      // diagnostyka i testy: na której nucie stoi głos (skokowo), ile było kroków i artykulacji (nowych źródeł próbek)
      stan(){return {nuta:nutaP,kroki:nKrok,artyk:nArtyk,skok:!!legatoP,probki:!!P};}};
  }

  // Głos gracza dla dowolnego instrumentu z listy (nieznana nazwa = trąbka).
  function glos(rodzaj,sk,nr,cel,opcje){
    return glosZaby(rodzaj,sk,nr,cel,opcje);
  }
  // Domyślny tryb przejść instrumentu (karta gracza pokazuje go, zanim gracz coś przełączy): "skok", gdy receptura (albo jej
  // nastawy toru próbek) ma `legato`, inaczej "plynne". Instrument własny ze Studia bez `legato` = płynnie.
  function domyslnePrzejscia(rodzaj){
    const r=RECEPTURY[rodzaj]||WLASNE[rodzaj]||RECEPTURY.trabka,q=(r.probkiRec&&r.probkiRec.legato)||r.legato;
    return q&&typeof q==="object"?"skok":"plynne";
  }
  // Odsłuch instrumentu przy wyborze w lobby: krótka fraza (kwinta w górę i z powrotem).
  // 10-10: po pierwszym kliknięciu kontekst bywa jeszcze uśpiony (resume jest asynchroniczne), więc próbka czeka na
  // jego start zamiast przepadać po cichu; nowa próbka ucina poprzednią (szybkie przełączanie nie robi kakofonii).
  let probkaGlos=null;
  function probka(rodzaj,ponowna,opcje){
    const c=odblokuj();if(!c||offline||wyciszony)return;
    if(c.state!=="running"){if(!ponowna)c.resume().then(()=>probka(rodzaj,true,opcje)).catch(()=>{});return;}
    if(probkaGlos){try{probkaGlos.zniszcz();}catch(e){}probkaGlos=null;}
    const g=glos(rodzaj,skala(1),0,null,opcje),t=c.currentTime+.02,m=[60,67,64];probkaGlos=g;
    g.ustaw(m[0],.7,0,t);g.spiewaj(true,t);
    g.ustaw(m[1],.7,0,t+.22);g.ustaw(m[2],.7,0,t+.44);
    g.spiewaj(false,t+.75);
    setTimeout(()=>{if(probkaGlos===g)probkaGlos=null;try{g.zniszcz();}catch(e){}},1400);
  }
  // Start podsłuchu utworu ucina trwającą próbkę instrumentu (dwa dźwięki naraz to szum).
  function stopProbka(){if(probkaGlos){try{probkaGlos.zniszcz();}catch(e){}probkaGlos=null;}}

  // ---- podkład i podpowiedź ------------------------------------------------------------------
  // `za` = za ile sekund od teraz, `dlugosc` w sekundach. Podpowiedź to ta sama nuta, cicho, na
  // osobnej szynie, żeby można ją było ściszyć niezależnie od podkładu.
  // `poziom` (opcjonalny, 0..1): ciszej, np. tło piosenki (środek akordów, reszta aranżacji).
  function nuta(instrument,polton,za,dlugosc,podpowiedz,poziom){
    const ok=gotowy();zlicz(podpowiedz?"podpowiedz":"nuta",ok);if(!ok)return;
    zagraj(instrument,polton,za,dlugosc,podpowiedz?busPodpowiedz:busPodklad,poziom);
  }
  function zagraj(instrument,polton,za,dlugosc,cel,poziom){
    const g=ac.createGain();let wyj=g;
    if(poziom!=null&&poziom<1){wyj=ac.createGain();wyj.gain.value=Math.max(0,poziom);g.connect(wyj);}
    wyj.connect(cel);
    voice(ac,kiedy(za),hz(polton),Math.max(.12,dlugosc),g,instrument);
    if(!offline)setTimeout(()=>{try{wyj.disconnect();g.disconnect();}catch(e){}},((za||0)+dlugosc+1.8)*1000);
  }
  // Podgląd piosenki w lobby („Posłuchaj”, „Oryginał”): własna szyna za wyjściem gry, którą „Stop”
  // wycisza od razu, razem z nutami zaplanowanymi już na kilkaset milisekund naprzód.
  function podglad(){
    const c=odblokuj();if(!c||offline)return null;
    const szyna=c.createGain();szyna.gain.value=1;szyna.connect(wyjscie);
    let zywy=true,an=null;const glosy=[];
    return {
      teraz:()=>c.currentTime,
      kontekst:()=>c,
      glos(rodzaj){const g=glosZaby(rodzaj,skala(1),0,szyna);glosy.push(g);return g;},
      // Studio dźwięków (10-16): podsłuch szyny podglądu dla lampy oscyloskopu i paneli (jak b._plateAn w rf-24b: fftSize
      // 2048, wygładzanie .55). Powstaje przy pierwszym pytaniu, ginie z szyną. Zwraca {an, fq, td, sampleRate} albo null.
      analizator(){
        if(!zywy)return null;
        if(!an){try{const a=c.createAnalyser();a.fftSize=2048;a.smoothingTimeConstant=.55;szyna.connect(a);
          an={an:a,fq:new Uint8Array(a.frequencyBinCount),td:new Float32Array(a.fftSize),sampleRate:c.sampleRate};}catch(e){an=null;return null;}}
        return c.state==="running"?an:null;},
      nuta(instrument,polton,za,dlugosc,poziom){
        if(!zywy||!gotowy())return;zlicz("podglad",true);zagraj(instrument,polton,za,dlugosc,szyna,poziom);},
      bebny(typ,za,poziom){if(zywy)bebny(typ,za,poziom,szyna);},   // 11-19: perkusja z pliku w podglądzie
      zatrzymaj(){
        if(!zywy)return;zywy=false;
        const t=c.currentTime;szyna.gain.cancelScheduledValues(t);szyna.gain.setTargetAtTime(0,t,.03);
        for(const g of glosy)g.zniszcz();
        setTimeout(()=>{try{szyna.disconnect();if(an)an.an.disconnect();}catch(e){}},600);
      },
      get zywy(){return zywy;}};
  }
  // Kliknięcie metronomu: wzorowane na click() z Keyboard Trenera (ten sam autor), z czasem startu.
  function klik(akcent,za){
    const ok=gotowy();zlicz("klik",ok);if(!ok)return;
    const t=kiedy(za),o=ac.createOscillator(),g=ac.createGain();o.type="square";o.frequency.value=akcent?1600:1000;
    g.gain.setValueAtTime(akcent?.22:.13,t);g.gain.exponentialRampToValueAtTime(.001,t+.05);
    o.connect(g);g.connect(busEfekty);o.start(t);o.stop(t+.06);
  }

  // ---- efekty ----------------------------------------------------------------------------------
  function szum(){
    if(buforSzumu)return buforSzumu;
    const n=Math.round(ac.sampleRate*.5);buforSzumu=ac.createBuffer(1,n,ac.sampleRate);
    const d=buforSzumu.getChannelData(0);let x=12345;
    for(let i=0;i<n;i++){x=(Math.imul(x,1103515245)+12345)>>>0;d[i]=(x>>>8)/8388608-1;}
    return buforSzumu;
  }
  // piła → wzmacniacz z kwadratowym AM → formant: to, co robi z żaby żabę (ribbit z Syntha)
  function skrzek(t,fqOd,fqDo,dl,amOd,amDo,fOd,fDo,poziom){
    const c=ac,o=c.createOscillator();o.type="sawtooth";
    o.frequency.setValueAtTime(fqOd,t);o.frequency.exponentialRampToValueAtTime(fqDo,t+dl);
    const am=c.createGain();am.gain.value=.5;
    const lfo=c.createOscillator();lfo.type="square";lfo.frequency.setValueAtTime(amOd,t);lfo.frequency.linearRampToValueAtTime(amDo,t+dl);
    const gl=c.createGain();gl.gain.value=.5;lfo.connect(gl);gl.connect(am.gain);
    const f=c.createBiquadFilter();f.type="bandpass";f.Q.value=4.5;
    f.frequency.setValueAtTime(fOd,t);f.frequency.exponentialRampToValueAtTime(fDo,t+dl);
    const g=c.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(poziom,t+.012);
    g.gain.setTargetAtTime(0,t+dl*.7,dl*.15);
    o.connect(am);am.connect(f);f.connect(g);g.connect(busEfekty);
    o.start(t);lfo.start(t);o.stop(t+dl+.4);lfo.stop(t+dl+.4);
  }
  // jedna nuta trąbki (receptura brass) na szynie efektów: fanfara i akord chóru
  function dmuch(t,m,dl,poz){
    const o=ac.createOscillator();o.type="sawtooth";o.frequency.value=hz(m);
    const f=ac.createBiquadFilter();f.type="lowpass";f.Q.value=1.6;f.frequency.setValueAtTime(700,t);f.frequency.setTargetAtTime(3000,t,.04);
    const g=ac.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(poz,t+.03);g.gain.setTargetAtTime(0,t+dl,.08);
    o.connect(f);f.connect(g);g.connect(busEfekty);o.start(t);o.stop(t+dl+.6);
  }
  // fałsz: rechot opadający, coraz wolniejsze „rrr” i ciemniejszy formant
  function rechot(za){
    const ok=gotowy();zlicz("rechot",ok);if(!ok)return;
    skrzek(kiedy(za),240,70,.45,26,13,1100,320,.55);
  }
  // kamień milowy kombo: krótkie „rri-bbit”, dwa skrzeki w górę
  function rribbit(za){
    const ok=gotowy();zlicz("rribbit",ok);if(!ok)return;
    const t=kiedy(za);
    skrzek(t,260,330,.08,34,34,1200,1500,.42);
    skrzek(t+.11,400,494,.1,34,30,1400,1800,.42);
  }
  // rechot w pauzie: krótki, niski „kum”, o `przes` Hz wyżej dla każdej żaby (słychać, która), a całość
  // przestrojona o `poltony` (runda 3: wysokość z przechyłu gracza, ±18) razem z formantem
  const ostatnieKum=[];
  function kum(za,przes,poltony){
    const p=przes||0,st=Number.isFinite(+poltony)?Math.max(-18,Math.min(18,+poltony)):0,m=Math.pow(2,st/12);
    ostatnieKum.push({przes:p,poltony:+st.toFixed(2)});if(ostatnieKum.length>8)ostatnieKum.shift();
    const ok=gotowy();zlicz("kum",ok);if(!ok)return;
    skrzek(kiedy(za),(150+p)*m,(115+p)*m,.1,31,27,850*Math.sqrt(m),620*Math.sqrt(m),.36);
  }
  // fanfara na koniec: C–E–G i akord C–E–G–C
  function fanfara(){
    const ok=gotowy();zlicz("fanfara",ok);if(!ok)return;
    const t0=ac.currentTime+.05;
    [[72,0],[76,.13],[79,.26]].forEach(([m,dt])=>dmuch(t0+dt,m,.11,.22));
    [72,76,79,84].forEach(m=>dmuch(t0+.42,m,.9,.13));
  }
  // „W jednym głosie!” cztery razy z rzędu: krótki akord dur trąbek
  function akord(za){
    const ok=gotowy();zlicz("akord",ok);if(!ok)return;
    const t=kiedy(za);
    [67,71,74,79].forEach((m,i)=>dmuch(t+i*.03,m,.32,.12));
  }
  // odchrząknięcie przed śpiewem: szum przez formant i krótki pomruk w dół
  function odchrzakniecie(za,przesuniecie){
    const ok=gotowy();zlicz("odchrzakniecie",ok);if(!ok)return;
    const t=kiedy(za),p=przesuniecie||0;
    const s=ac.createBufferSource();s.buffer=szum();
    const f=ac.createBiquadFilter();f.type="bandpass";f.frequency.value=900+p*8;f.Q.value=1.4;
    const g=ac.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.3,t+.015);g.gain.setTargetAtTime(0,t+.07,.035);
    s.connect(f);f.connect(g);g.connect(busEfekty);s.start(t);s.stop(t+.3);
    skrzek(t+.05,130+p,85,.16,22,18,700,450,.16);
  }
  // gwiazdka na wynikach (runda 2): krótki dzwonek, dwa sinusy (oktawa wyżej ciszej), wysokość rośnie z numerem
  // gwiazdki (n = 1…5 to G5, A5, H5, D6, E6); 60 ms, cicho, szyną efektów
  function gwiazdka(n,za){
    const ok=gotowy();zlicz("gwiazdka",ok);if(!ok)return;
    const t=kiedy(za),m=[79,81,83,86,88][Math.max(0,Math.min(4,(n|0)-1))];
    for(const [mn,poz] of [[m,.1],[m+12,.035]]){
      const o=ac.createOscillator(),g=ac.createGain();o.type="sine";o.frequency.value=hz(mn);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(poz,t+.004);g.gain.exponentialRampToValueAtTime(.0005,t+.06);
      o.connect(g);g.connect(busEfekty);o.start(t);o.stop(t+.08);
    }
  }
  // tik interfejsu (menu, przyciski): 25 ms trójkąta 2,4 kHz, ledwo słyszalny. Gdy grają punkowe dźwięki UI
  // (dzwieki-ui.js, włączone), to one mówią o ruchu po menu: tik milknie, żeby nie dublować „ruch”/„klik”.
  // Kasyno (koło nagród, 10-16: „wszystko ma ASMR jak w kasynie”): `cyk` = krótkie cyknięcie (trójkątny klik + trzask szumu), p 0..1 podnosi
  // ton (szybciej = wyżej), `wystrzal` = świst szumu w górę i uderzenie na starcie losowania, `dzwonek` = dźwięk monety/dzwonka.
  function cyk(p,glosn){
    const ok=gotowy();zlicz("cyk",ok);if(!ok)return;
    const t=kiedy(0),f=720+780*Math.max(0,Math.min(1,+p||0)),v=(glosn==null?1:glosn)*.8;   // 720–1500 Hz (wyższe piszczało)
    const o=ac.createOscillator(),g=ac.createGain();o.type="triangle";o.frequency.setValueAtTime(f*1.45,t);o.frequency.exponentialRampToValueAtTime(f,t+.012);
    g.gain.setValueAtTime(.1*v,t);g.gain.exponentialRampToValueAtTime(.0005,t+.05);o.connect(g);g.connect(busEfekty);o.start(t);o.stop(t+.06);
    const s=ac.createBufferSource();s.buffer=szum();const h=ac.createBiquadFilter();h.type="bandpass";h.frequency.value=2200;h.Q.value=.7;const g2=ac.createGain();
    g2.gain.setValueAtTime(.045*v,t);g2.gain.exponentialRampToValueAtTime(.0005,t+.02);s.connect(h);h.connect(g2);g2.connect(busEfekty);s.start(t,Math.random()*.4);s.stop(t+.035);
  }
  function wystrzal(){
    const ok=gotowy();zlicz("wystrzal",ok);if(!ok)return;
    const t=kiedy(0),s=ac.createBufferSource();s.buffer=szum();s.loop=true;
    const b=ac.createBiquadFilter();b.type="bandpass";b.Q.value=1.4;b.frequency.setValueAtTime(500,t);b.frequency.exponentialRampToValueAtTime(5200,t+.32);
    const g=ac.createGain();g.gain.setValueAtTime(.0005,t);g.gain.exponentialRampToValueAtTime(.28,t+.06);g.gain.exponentialRampToValueAtTime(.0005,t+.42);
    s.connect(b);b.connect(g);g.connect(busEfekty);s.start(t);s.stop(t+.45);
    const o=ac.createOscillator(),g2=ac.createGain();o.type="sine";o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(48,t+.16);
    g2.gain.setValueAtTime(.34,t);g2.gain.exponentialRampToValueAtTime(.0005,t+.2);o.connect(g2);g2.connect(busEfekty);o.start(t);o.stop(t+.22);
  }
  function dzwonek(wys,za){
    const ok=gotowy();zlicz("dzwonek",ok);if(!ok)return;
    const t=kiedy(za),f=hz(wys==null?88:wys);
    for(const [m,a,d] of [[1,.12,.5],[2.76,.05,.32],[5.4,.03,.2]]){
      const o=ac.createOscillator(),g=ac.createGain();o.type="sine";o.frequency.value=f*m;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(a,t+.004);g.gain.exponentialRampToValueAtTime(.0005,t+d);
      o.connect(g);g.connect(busEfekty);o.start(t);o.stop(t+d+.05);
    }
  }
  // Perkusja syntezowana (jingle zakończeń): k kopniak, s werbel, h hi-hat, o otwarty hi-hat, t tom, c klaśnięcie, x talerz, r rim. Idzie na szynę podkładu.
  // `cel` (11-19): inna szyna niż podkład gry, np. szyna podglądu piosenki, żeby „Stop” uciszał też bębny.
  function bebny(typ,za,poziom,cel){
    const ok=gotowy();zlicz("bebny",ok);if(!ok)return;
    const t=kiedy(za),v=poziom==null?1:poziom;cel=cel||busPodklad;
    const szumOdc=(dl,fHP,fLP,g)=>{const s=ac.createBufferSource();s.buffer=szum();s.loop=true;const hp=ac.createBiquadFilter();hp.type="highpass";hp.frequency.value=fHP;
      const lp=ac.createBiquadFilter();lp.type="lowpass";lp.frequency.value=fLP;const ga=ac.createGain();ga.gain.setValueAtTime(g*v,t);ga.gain.exponentialRampToValueAtTime(.0005,t+dl);
      s.connect(hp);hp.connect(lp);lp.connect(ga);ga.connect(cel);s.start(t,Math.random()*.3);s.stop(t+dl+.02);};
    const ton=(f0,f1,dl,g,fala)=>{const o=ac.createOscillator(),ga=ac.createGain();o.type=fala||"sine";o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dl*.8);
      ga.gain.setValueAtTime(g*v,t);ga.gain.exponentialRampToValueAtTime(.0005,t+dl);o.connect(ga);ga.connect(cel);o.start(t);o.stop(t+dl+.02);};
    switch(typ){
      case "k":ton(150,42,.3,.95);szumOdc(.02,200,2500,.12);break;
      case "s":szumOdc(.17,1400,9000,.5);ton(230,150,.12,.32,"triangle");break;
      case "h":szumOdc(.045,7000,16000,.2);break;
      case "o":szumOdc(.26,6000,16000,.18);break;
      case "t":ton(190,80,.3,.6);break;
      case "c":szumOdc(.1,900,5000,.45);break;
      case "x":szumOdc(1,4000,16000,.3);break;
      case "r":ton(820,700,.05,.28,"square");break;
    }
  }
  // Fraza instrumentu (odsłuch przy wylosowaniu): zapamiętywalny motyw zamiast „tu-ru-ru”, grany ciągłym głosem instrumentu.
  // Każdy instrument ma dopasowaną do siebie melodyjkę: każdy wbudowany instrument ma
  // własną frazę w FRAZY ([midi, start s, długość s, podjazd?]) w charakterze instrumentu (fanfara trąbki, skoki ribbita, chorał,
  // klezmer klarnetu, oom-pa tuby, calypso steel drumu, arpeggio chiptune…); własne instrumenty (studio) i nieznane biorą
  // domyślną. Niskie instrumenty (okt ≤ −1) dostają motyw oktawę wyżej, wysokie (okt ≥ 2) niżej. Zwraca czas trwania w sekundach.
  const FRAZA_DOM=[[60,0,.2],[64,.2,.2],[67,.4,.2],[72,.6,.34],[71,.98,.18],[67,1.16,.18],[69,1.34,.2],[64,1.56,.2],[62,1.8,.2],[67,2.02,.7]];
  const FRAZY={
    trabka:[[60,0,.18],[60,.2,.18],[64,.4,.2],[67,.6,.3],[72,1,.5],[67,1.55,.2],[72,1.8,.8]],                       // pobudka: fanfara
    ribbit:[[48,0,.15],[55,.25,.15],[48,.5,.15],[55,.75,.15],[60,1,.25],[57,1.35,.15],[55,1.55,.15],[48,1.8,.6]],   // żabie skoki
    chor:[[60,0,.6],[64,.6,.6],[67,1.2,.6],[72,1.8,.9]],                                                             // chorał w górę
    smyczki:[[64,0,.5],[67,.5,.3],[71,.8,.7],[69,1.5,.3],[67,1.8,.3],[64,2.1,.6]],                                   // romantyczna linia
    flet:[[72,0,.15],[74,.15,.15],[72,.3,.15],[74,.45,.15],[76,.6,.4],[79,1.05,.4],[76,1.5,.3],[74,1.8,.3],[72,2.1,.6]],   // tryl pasterski
    organy:[[69,0,.12],[67,.12,.12],[69,.24,.5],[67,.9,.1],[65,1,.1],[64,1.1,.1],[62,1.2,.1],[61,1.3,.5],[62,2,.7]], // toccata
    syntezator:[[57,0,.12],[60,.12,.12],[64,.24,.12],[69,.36,.12],[72,.48,.12],[76,.6,.12],[81,.72,.4],[76,1.2,.12],[72,1.32,.12],[69,1.44,.6]],   // arpeggio
    theremin:[[72,0,.8,3],[79,.8,.6,3],[75,1.4,.5,3],[84,1.9,.8,3]],                                                 // upiorne podjazdy
    kazoo:[[67,0,.2],[67,.2,.2],[69,.4,.2],[67,.6,.2],[72,.8,.4],[71,1.3,.7]],                                       // głupkowate „ta-ta-ta”
    harmonijka:[[64,0,.3],[67,.3,.3],[69,.6,.2],[70,.8,.2],[69,1,.3],[67,1.3,.3],[64,1.6,.8]],                        // blues
    okaryna:[[72,0,.3],[74,.3,.3],[76,.6,.3],[79,.9,.5],[76,1.4,.3],[74,1.7,.3],[72,2,.7]],                            // ludowa pentatonika
    gwizdek:[[84,0,.25],[84,.3,.25],[88,.6,.6],[84,1.3,.9]],                                                         // gwizdek sędziego
    klarnet:[[62,0,.25],[63,.25,.25],[66,.5,.25],[67,.75,.25],[69,1,.4],[70,1.4,.2],[69,1.6,.2],[66,1.8,.2],[62,2,.7]],   // klezmer
    oboj:[[64,0,.3],[65,.3,.2],[68,.5,.3],[65,.8,.2],[64,1,.3],[62,1.3,.3],[64,1.6,.9]],                              // orientalna skala
    puzon:[[60,0,.4,2],[59,.4,.3,2],[58,.7,.3,2],[57,1,.3,2],[55,1.3,.3,2],[53,1.6,.9,2]],                           // zjazd suwakiem
    tuba:[[48,0,.25],[55,.3,.2],[48,.6,.25],[55,.9,.2],[53,1.2,.25],[55,1.5,.2],[48,1.8,.8]],                         // oom-pa
    dudy:[[62,0,.3],[67,.3,.3],[69,.6,.2],[71,.8,.2],[69,1,.3],[67,1.3,.3],[62,1.6,.9]],                              // szkocka
    wiolonczela:[[55,0,.25],[62,.25,.25],[66,.5,.25],[69,.75,.25],[66,1,.25],[69,1.25,.25],[62,1.5,.25],[55,1.75,.8]],   // preludium
    chiptune:[[72,0,.1],[76,.1,.1],[79,.2,.1],[84,.3,.3],[79,.6,.1],[84,.7,.1],[88,.8,.5],[84,1.4,.1],[88,1.5,.1],[91,1.6,.6]],   // skok w platformówce
    robot:[[60,0,.18],[60,.2,.18],[66,.4,.18],[66,.6,.18],[60,.8,.18],[72,1,.18],[66,1.2,.18],[60,1.4,.8]],          // mechaniczne kroki
    piano:[[60,0,.3],[64,.3,.3],[67,.6,.3],[72,.9,.5],[71,1.4,.3],[67,1.7,.3],[64,2,.7]],                             // łagodny pasaż
    epiano:[[64,0,.3],[67,.3,.3],[71,.6,.4],[69,1,.3],[66,1.3,.3],[64,1.6,.8]],                                      // jazzowo
    guitar:[[52,0,.15],[56,.15,.15],[59,.3,.15],[64,.45,.3],[63,.8,.15],[59,.95,.15],[56,1.1,.15],[52,1.25,.8]],      // flamenco
    bas:[[40,0,.3],[40,.35,.15],[43,.55,.3],[45,.9,.3],[47,1.25,.15],[48,1.45,.3],[47,1.8,.2],[45,2,.7]],              // funk na basie
    hawajska:[[64,0,.5,1],[67,.5,.4,1],[69,.9,.6,1],[72,1.5,.4,1],[71,1.9,.9,1]],                                      // hawajski slide
    duduk:[[62,0,.6],[63,.6,.3],[66,.9,.5],[67,1.4,.3],[66,1.7,.3],[63,2,.3],[62,2.3,.9]],                           // ormiańska pieśń
    didgeridoo:[[36,0,.5],[36,.55,.3],[38,.9,.3],[36,1.25,.5],[36,1.8,.8]],                                           // pulsujący dron
    erhu:[[74,0,.4,1],[76,.4,.3,1],[79,.7,.5,1],[81,1.2,.3,1],[79,1.5,.3,1],[76,1.8,.3,1],[74,2.1,.6,1]],             // chińska pentatonika
    opera:[[64,0,.4],[67,.4,.4],[72,.8,.8],[71,1.6,.3],[69,1.9,.3],[67,2.2,.6]],                                      // aria
    przester:[[40,0,.2],[40,.25,.2],[43,.5,.2],[45,.75,.2],[46,1,.2],[45,1.25,.2],[43,1.5,.2],[40,1.75,.8]],          // riff
    kwak:[[62,0,.15],[62,.2,.15],[62,.4,.15],[60,.6,.25],[58,.9,.4],[62,1.4,.15],[62,1.6,.15],[57,1.8,.6]],          // kaczka
    kot:[[72,0,.45],[69,.5,.45],[72,1,.25],[76,1.3,.8]],                                                              // miau, miau
    impuls:[[60,0,.1],[60,.15,.1],[60,.3,.1],[67,.5,.1],[67,.65,.1],[72,.85,.1],[72,1,.1],[79,1.2,.5]],              // impulsy
    szept:[[60,0,.5],[62,.5,.5],[64,1,.5],[60,1.5,.9]],                                                              // szeptem
    trance:[[57,0,.15],[57,.2,.15],[64,.4,.15],[57,.6,.15],[62,.8,.15],[57,1,.15],[60,1.2,.15],[64,1.4,.15],[69,1.6,.8]],   // euforia
    wiatr:[[64,0,.9,3],[67,.8,.9,3],[62,1.6,1,3]],                                                                   // podmuchy
    sub:[[45,0,.4],[45,.5,.3],[43,.9,.3],[40,1.3,.8]],                                                               // zjazd basu
    wobble:[[40,0,.5],[43,.5,.5],[40,1,.5],[38,1.5,.9]],                                                             // wobble
    hammond:[[60,0,.3],[63,.3,.3],[65,.6,.2],[66,.8,.2],[67,1,.5],[70,1.5,.3],[67,1.8,.9]],                          // gospel na Hammondzie
    wokal:[[60,0,.3],[64,.3,.3],[67,.6,.3],[64,.9,.3],[60,1.2,.3],[57,1.5,.3],[60,1.8,.8]],                           // doo-wop
    krzyk:[[64,0,.3],[76,.35,.6],[69,1.05,.25],[57,1.35,.9,3]]                                                         // AAA! i jeszcze raz niżej
  };
  function fraza(rodzaj,opcje){
    const c=odblokuj();if(!c||offline||wyciszony||c.state!=="running")return 0;
    if(probkaGlos){try{probkaGlos.zniszcz();}catch(e){}probkaGlos=null;}
    const r=RECEPTURY[rodzaj]||WLASNE[rodzaj]||RECEPTURY.trabka,sh=(r.okt||0)<=-1?12:(r.okt||0)>=2?-12:0;
    const N=FRAZY[rodzaj]||FRAZA_DOM;let koniec=0;
    const g=glos(rodzaj,skala(1),0,null,opcje),t=c.currentTime+.03;probkaGlos=g;
    for(const [m,st,d,pod] of N){g.ustaw(m+sh,.72+Math.min(.2,st*.05),pod||(st>1.9?4:0),t+st);g.spiewaj(true,t+st);g.spiewaj(false,t+st+d*.88);koniec=Math.max(koniec,st+d);}
    setTimeout(()=>{if(probkaGlos===g)probkaGlos=null;try{g.zniszcz();}catch(e){}},Math.round(koniec*1000)+500);
    return +(koniec+.3).toFixed(2);
  }
  function tik(za){
    const zaUI=!offline&&typeof DzwiekiUI!=="undefined"&&DzwiekiUI&&typeof DzwiekiUI.wlaczone==="function"&&DzwiekiUI.wlaczone();
    const ok=gotowy()&&!zaUI;zlicz("tik",ok);if(!ok)return;
    const t=kiedy(za),o=ac.createOscillator(),g=ac.createGain();o.type="triangle";o.frequency.value=2400;
    g.gain.setValueAtTime(.045,t);g.gain.exponentialRampToValueAtTime(.0005,t+.025);
    o.connect(g);g.connect(busEfekty);o.start(t);o.stop(t+.04);
  }
  // Dźwięki UI (dzwieki-ui.js) grają na TYM SAMYM kontekście i wchodzą do tego samego kompresora i ogranicznika co
  // gra, ale omijają `wyjscie`, więc pauza (wycisz) ich nie ścisza. kontekstUI() NIE tworzy kontekstu: zwraca
  // istniejący, żywy (nie offline) albo null. celUI(): wejście kompresora bieżącego grafu (także offline, do pomiaru).
  function kontekstUI(){return ac&&!offline?ac:null;}
  function celUI(){return ac?komp:null;}
  return {kontekst,kontekstUI,celUI,zaladujProbki,ustawProbki,usunProbki,probkiDla,probkiStan,parsujWav,odblokuj,gotowy,zablokowany,czas,wycisz,glosZaby,glos,domyslnePrzejscia,probka,stopProbka,INSTRUMENTY_GRACZA,UDERZANE,jestInstrument,cyk,wystrzal,dzwonek,bebny,fraza,FRAZY,dodajWlasny,usunWlasny,wlasne,skala,nuta,podglad,klik,rechot,rribbit,kum,fanfara,akord,gwiazdka,tik,
    odchrzakniecie,licznik,ostatnieKum,RECEPTURY,POZIOM,get wyciszony(){return wyciszony;},
    ustawGlosnosc,mnoznik,glosnosc:()=>Object.assign({},UZYT),ustawEfekty,efekty:()=>Object.assign({},EFEKTY),poGlosnosci:f=>{SLUCHACZE.push(f);},
    stan:()=>ac?(offline?"offline":ac.state):"brak"};   // samo pytanie o stan nie może tworzyć kontekstu
})();
