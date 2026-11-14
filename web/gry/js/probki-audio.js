"use strict";
// ===== Próbki audio: wspólny kawałek dla panelu RibbitFlip i gry RibbitBeat (2026-10-19 wieczór) =====
// Studio gry i panel RibbitFlip mają tę samą funkcję samplowania audio, nagrania i dogrania. „Tę samą” dosłownie: nagranie, dekodowanie, wycinek, poziom,
// wykrycie stroju i format WAV mają w obu programach działać IDENTYCZNIE, więc stoją w jednym pliku, a nie
// w dwóch kopiach, które po dwóch poprawkach brzmiałyby inaczej.
//
// 2026-10-20 (większa kontrola użytkownika nad samplowaniem w RibbitBeat i RibbitFlip): obróbka przeszła z NIEODWRACALNEJ na NASTAWĘ. Do dziś jedyne, co człowiek
// mógł zrobić z nagraniem, to zgodzić się na nie takie, jakie przyszło: cisza z brzegów była odcinana od bajtów,
// szczyt równany na siłę do 0,9, a próbka grała zawsze od zera do końca. Teraz BAJTY SĄ ŚWIĘTE, a wycinek
// (`od`, `koniec`), poziom, kierunek, pętla i zlepek jej szwu są liczbami w brzmieniu — więc da się je kręcić
// w tę i we w tę, cofnąć i mieć inne w kopii instrumentu, która dzieli te same bajty.
//
// Ten plik NIE WIE, w którym programie działa: nie dotyka DOM, nie zna ani `Glos` (silnik gry), ani `PadAudio`
// (silnik panelu), ani magazynu bajtów. AudioContext dostaje argumentem. Dzięki temu panel ładuje go jako
// `js/probki-audio.js`, a gra jako `../js/probki-audio.js` — ten sam plik, jedna kopia na dysku.
// Nad nim stoją dwie cienkie warstwy, każda ze swoim magazynem i swoim silnikiem:
//   • gra:   web/gry/js/studio-probki.js  (IndexedDB + Glos.ustawProbki),
//   • panel: web/js/rf-25f-sampler.js     (Library/Probki/ na serwerze + PadAudio).
//
// FORMAT: WAV PCM16 mono 32 kHz, najwyżej MAKS_SEK sekund — dokładnie to, czym są próbki instrumentu Krzyk
// w web/assets/krzyk/. Jeden format znaczy jeden parser do pilnowania i próbki, które przenoszą się między
// programami bez konwersji.
const ProbkiAudio=(function(){
  const SR=32000,MAKS_SEK=12,MIN_PROBEK=600;   // 600 próbek ≈ 19 ms: krócej to już nie dźwięk, tylko trzask
  const PLIK_MAKS=40e6;
  // SZCZYT: do tego poziomu wchodzą BAJTY (nie to, co słychać). PCM16 ma 16 bitów na całą skalę, więc cicho
  // nagrana próbka zapisana „jak jest” traciłaby rozdzielczość bezpowrotnie; zapis idzie na pełno, a o tym,
  // jak głośno ma GRAĆ, decyduje pokrętło poziomu (1,00× = tak, jak zapisane).
  const SZCZYT=.9;
  const ZJAZD=.004,ZAPAS=.008,MIN_PETLA=.005,MAKS_ZLEP=.2,MIN_WYCINEK=64;

  // ---- WAV PCM16 mono --------------------------------------------------------------------------
  function doWav(p){
    const d=p.dane,n=d.length,sr=+p.sr||SR,ab=new ArrayBuffer(44+n*2),v=new DataView(ab);
    const txt=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
    txt(0,"RIFF");v.setUint32(4,36+n*2,true);txt(8,"WAVE");
    txt(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
    v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);
    txt(36,"data");v.setUint32(40,n*2,true);
    for(let i=0;i<n;i++){const x=d[i]<-1?-1:(d[i]>1?1:d[i]);v.setInt16(44+i*2,Math.round(x*32767),true);}
    return ab;
  }
  // Kopia parsera z glos.js (`parsujWav`). Celowa: glos.js musi czytać próbki z web/assets/ sam, bez tego pliku
  // (pomiar dźwięku gry ładuje go w izolacji), a panel nie ładuje glos.js wcale. Że obie kopie czytają tak samo,
  // pilnuje test (tests/gry_probki_harness.mjs porównuje wynik obu na tych samych bajtach).
  function zWav(ab){
    if(!ab||!ab.byteLength)return null;
    const dv=new DataView(ab);let p=12,sr=22050,dane=null;
    while(p+8<=dv.byteLength){
      const id=String.fromCharCode(dv.getUint8(p),dv.getUint8(p+1),dv.getUint8(p+2),dv.getUint8(p+3)),n=dv.getUint32(p+4,true);
      if(id==="fmt ")sr=dv.getUint32(p+12,true);
      else if(id==="data"){const k=Math.min(n,dv.byteLength-p-8)>>1;dane=new Float32Array(k);for(let i=0;i<k;i++)dane[i]=dv.getInt16(p+8+i*2,true)/32768;break;}
      p+=8+n+(n&1);
    }
    return dane?{sr,dane}:null;
  }

  // ---- base64 (pliki do przeniesienia na inny komputer): porcjami, bo String.fromCharCode(...300k) przepełnia stos ----
  function b64(ab){
    const u=new Uint8Array(ab);let s="";
    for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));
    return btoa(s);
  }
  function zB64(t){
    try{const s=atob(String(t||"").replace(/\s+/g,""));const u=new Uint8Array(s.length);
      for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u.buffer;}catch(e){return null;}
  }

  // ---- co jest w bajtach: szczyt i granice ciszy -------------------------------------------------
  function szczyt(dane,od,koniec){
    const n=dane.length,a=Math.max(0,Math.min(n,od==null?0:od|0)),b=Math.max(a,Math.min(n,koniec==null?n:koniec|0));
    let pk=0;for(let i=a;i<b;i++){const v=Math.abs(dane[i]);if(v>pk)pk=v;}
    return pk;
  }
  // Bajty na pełną skalę. Szczyt ORYGINAŁU wraca osobno (`szczyt`), bo z niego liczy się poziom „zostaw jak jest”:
  // nagranie zrobione cicho ma dalej grać cicho, jeśli człowiek tak chce, ale zapisane jest na pełno.
  function normalizuj(dane,sr){
    const n=dane.length;if(n<MIN_PROBEK)return null;
    const pk=szczyt(dane,0,n);
    if(pk<.002)return null;                                        // sama cisza: nie ma czego zapisać
    const out=new Float32Array(n),sk=SZCZYT/pk;
    for(let i=0;i<n;i++)out[i]=dane[i]*sk;
    return {dane:out,sr:+sr||SR,szczyt:pk};
  }
  // Gdzie w nagraniu kończy się cisza: `od` i `koniec` (indeksy próbek, `koniec` wyłącznie — jak w slice).
  // Próg to 2 % szczytu, ale nie mniej niż −54 dBFS, żeby szum pokojowy nie udawał początku dźwięku; po obu
  // stronach zostaje 8 ms zapasu. To SUGESTIA dla znaczników wycinka, nie cięcie bajtów — stąd same indeksy.
  function granice(dane,sr){
    const n=dane.length;if(!n)return null;
    const pk=szczyt(dane,0,n);
    if(pk<.002)return null;
    const prog=Math.max(pk*.02,.002);
    let od=0,ost=n-1;
    while(od<n&&Math.abs(dane[od])<prog)od++;
    if(od>=n)return null;
    while(ost>od&&Math.abs(dane[ost])<prog)ost--;
    const zapas=Math.round((+sr||SR)*ZAPAS);
    od=Math.max(0,od-zapas);ost=Math.min(n-1,ost+zapas);
    if(ost-od+1<MIN_PROBEK)return null;
    return {od,koniec:ost+1};
  }

  // ---- BAJTY + NASTAWY → to, co gra silnik -------------------------------------------------------
  // Jedno miejsce, w którym wycinek, poziom, kierunek, pętla i zlepek zamieniają się w gotowe próbki. Oba
  // programy wołają to samo, więc ta sama próbka z tymi samymi nastawami brzmi w grze i w panelu identycznie.
  //
  // `e` = {od, koniec (sekundy od początku BAJTÓW), poziom (1 = jak zapisane), wstecz, petla:[od, do] w tych
  // samych sekundach, zlep (sekundy)}. Na wyjściu {dane, sr, petla} — i pętla jest już przeliczona NA WYCINEK,
  // bo to on jest buforem, który dostaje silnik.
  //
  // CZTERY RZECZY, BEZ KTÓRYCH TO TRZASKA ALBO GRA NIE TO, CO POKAZUJE PRZEBIEG:
  //   • wycinek krótszy niż 2 ms (znaczniki zjechały na siebie) → bierzemy CAŁOŚĆ, bo bufor o zerowej długości
  //     to źródło, które nigdy się nie kończy,
  //   • przy grze wstecz pętla też jest odbijana (koniec staje się początkiem) — inaczej zapętlony wycinek
  //     odtwarzany od tyłu łapie zupełnie inny kawałek dźwięku niż ten zacieniowany na przebiegu,
  //   • zlepek: koniec pętli przechodzi w to, co leży PRZED jej początkiem, więc skok z końca na początek nie
  //     jest cięciem w połowie fali. Bez tego zapętlona próbka klika raz na obrót,
  //   • zjazd 4 ms na brzegach wycinka. Zjazdu na końcu NIE MA przy pętli: ten kawałek bufora i tak nigdy nie
  //     zagra (źródło zawraca na `loopEnd`), a zjazd wszedłby w pętlę i słyszalnie ją ściszał.
  function wytnij(prob,e){
    if(!prob||!prob.dane||!prob.dane.length)return null;
    e=e||{};
    const d=prob.dane,n=d.length,sr=+prob.sr||SR,dl=n/sr;
    let a=Math.max(0,Math.min(dl,+e.od||0)),b=+e.koniec;
    if(!(b>a))b=dl;
    b=Math.min(dl,b);
    let i0=Math.round(a*sr),i1=Math.round(b*sr);
    if(i1-i0<MIN_WYCINEK){i0=0;i1=n;a=0;}
    const len=i1-i0,poz=Number.isFinite(+e.poziom)?Math.max(0,+e.poziom):1,L=len/sr;
    const out=new Float32Array(len);
    if(e.wstecz)for(let i=0;i<len;i++)out[i]=d[i1-1-i]*poz;
    else for(let i=0;i<len;i++)out[i]=d[i0+i]*poz;
    let pet=null;
    if(Array.isArray(e.petla)&&e.petla.length===2){
      let pa=+e.petla[0]-a,pb=+e.petla[1]-a;
      if(e.wstecz){const t=L-pb;pb=L-pa;pa=t;}
      pa=Math.max(0,Math.min(L,pa));pb=Math.max(0,Math.min(L,pb));
      if(pb-pa>=MIN_PETLA)pet=[pa,pb];
    }
    if(pet){
      const ia=Math.round(pet[0]*sr),ib=Math.round(pet[1]*sr);
      const iz=Math.max(0,Math.min(Math.round(Math.max(0,Math.min(MAKS_ZLEP,+e.zlep||0))*sr),ia,(ib-ia)>>1));
      for(let k=0;k<iz;k++){
        const w=(k+1)/(iz+1),j=ib-iz+k;
        if(j<0||j>=len)continue;
        out[j]=out[j]*(1-w)+out[ia-iz+k]*w;
      }
      pet=[ia/sr,ib/sr];
    }
    const zj=Math.min(Math.round(sr*ZJAZD),len>>2);
    for(let i=0;i<zj;i++)out[i]*=i/zj;
    if(!pet)for(let i=0;i<zj;i++)out[len-1-i]*=i/zj;
    return {dane:out,sr,petla:pet};
  }
  // „Przytnij na stałe”: z bajtów zostaje SAM WYCINEK. Poziom, kierunek, pętla i zlepek NIE wchodzą — to dalej
  // nastawy, które ma się dać kręcić; tu idzie tylko to, czego nie trzeba już trzymać, żeby plik nie puchł
  // (12-sekundowe nagranie to 768 kB, a w pliku instrumentów jeszcze o trzecią część więcej w base64).
  // null = nie ma czego przycinać (wycinek to całość) albo zostałoby za mało na dźwięk.
  function wycinek(prob,e){
    if(!prob||!prob.dane||!prob.dane.length)return null;
    e=e||{};
    const d=prob.dane,n=d.length,sr=+prob.sr||SR,dl=n/sr;
    let a=Math.max(0,Math.min(dl,+e.od||0)),b=+e.koniec;
    if(!(b>a))b=dl;
    b=Math.min(dl,b);
    const i0=Math.round(a*sr),i1=Math.round(b*sr);
    if(i1-i0<MIN_PROBEK||(i0===0&&i1===n))return null;
    return {dane:d.slice(i0,i1),sr};
  }

  // ---- strój próbki: autokorelacja najgłośniejszego fragmentu ------------------------------------
  // Potrzebne, bo bez stroju cała klawiatura gra nie tę nutę, co trzeba, a nikt nie wpisze „64,5 półtonu” z ucha.
  // Szukamy okresu od 50 do 1000 Hz w okienku 40 ms wokół szczytu energii; korelacja poniżej .3 znaczy
  // „to nie ma wysokości” (klaśnięcie, szum) i wtedy wraca null, a strój zostaje taki, jaki jest.
  //
  // DWA MIEJSCA, BEZ KTÓRYCH TO MYLI SIĘ O OKTAWĘ ALBO KWINTĘ (zmierzone na pile 880 Hz: wychodziło 293 Hz):
  //   • NIE bierzemy największej korelacji, tylko PIERWSZY wyraźny szczyt — przy okresie 2× i 3× dłuższym fala zgadza
  //     się ze sobą tak samo dobrze, a przy niecałkowitym okresie (880 Hz przy 32 kHz to 36,36 próbki) nawet lepiej,
  //     bo trzykrotność trafia bliżej pełnej próbki,
  //   • szczyt dociągamy parabolą przez trzy sąsiednie punkty, bo okres prawie nigdy nie wypada na całej próbce.
  function wykryjRoot(dane,sr){
    sr=+sr||SR;const n=dane.length;if(n<Math.round(sr*.05))return null;
    const ok=Math.min(n,Math.round(sr*.04));
    let naj=0,najE=-1;
    for(let s=0;s+ok<=n;s+=Math.max(1,ok>>1)){let e=0;for(let i=s;i<s+ok;i++)e+=dane[i]*dane[i];
      if(e>najE){najE=e;naj=s;}}
    const w=dane.subarray(naj,naj+ok);
    let e0=0;for(let i=0;i<ok;i++)e0+=w[i]*w[i];
    if(e0<1e-7)return null;
    const tMin=Math.max(2,Math.floor(sr/1000)),tMax=Math.min(ok-2,Math.floor(sr/50));
    if(tMax<=tMin)return null;
    const kor=new Float32Array(tMax+2);let best=0;
    for(let t=tMin;t<=tMax;t++){
      let s=0,e=0;const m=ok-t;
      for(let i=0;i<m;i++){s+=w[i]*w[i+t];e+=w[i+t]*w[i+t];}
      kor[t]=s/Math.sqrt(Math.max(1e-12,e0*e));
      if(kor[t]>best)best=kor[t];
    }
    if(best<.3)return null;
    const prog=best*.88;
    let bestT=0;
    for(let t=tMin+1;t<tMax;t++)if(kor[t]>=prog&&kor[t]>=kor[t-1]&&kor[t]>=kor[t+1]){bestT=t;break;}
    if(!bestT)return null;
    const a=kor[bestT-1],b=kor[bestT],c=kor[bestT+1],m2=a-2*b+c;
    const t2=bestT+(Math.abs(m2)>1e-9?Math.max(-.5,Math.min(.5,.5*(a-c)/m2)):0);
    const f=sr/t2;
    if(!(f>20&&f<2000))return null;
    // Setna część półtonu, czyli cent. Do 10-20 wracała dziesiąta (50 razy mniej, niż umie pokrętło stroju) —
    // odkąd resztę odchyłki bierze pokrętło „Dostrój”, zaokrąglenie samo dawałoby wynik skokami po 10 centów.
    return Math.round((69+12*Math.log2(f/440))*100)/100;
  }

  // ---- miks na mono i przepróbkowanie do SR (robi to przeglądarka) -------------------------------
  function zBufora(buf){
    const dl=Math.min(buf.duration,MAKS_SEK),n=Math.max(1,Math.round(dl*SR));
    const OC=typeof window!=="undefined"?(window.OfflineAudioContext||window.webkitOfflineAudioContext):null;
    if(OC){
      try{
        const oc=new OC(1,n,SR),s=oc.createBufferSource();
        s.buffer=buf;s.connect(oc.destination);s.start(0);
        return oc.startRendering().then(out=>({dane:out.getChannelData(0).slice(),sr:SR}));
      }catch(e){}
    }
    // Zapasowo (silnik bez OfflineAudioContext o zadanej częstotliwości): średnia kanałów i liniowa interpolacja.
    const kan=[];for(let k=0;k<buf.numberOfChannels;k++)kan.push(buf.getChannelData(k));
    const sr0=buf.sampleRate,out=new Float32Array(n);
    for(let i=0;i<n;i++){
      const x=i*sr0/SR,j=Math.min(kan[0].length-1,Math.floor(x)),u=x-j,j2=Math.min(kan[0].length-1,j+1);
      let s=0;for(const d of kan)s+=d[j]+(d[j2]-d[j])*u;
      out[i]=s/kan.length;
    }
    return Promise.resolve({dane:out,sr:SR});
  }

  // ---- plik z dysku ------------------------------------------------------------------------------
  // Bez sprawdzania rozszerzenia: decydują bajty. `decodeAudioData` odrzuci wszystko, czego przeglądarka nie
  // umie zagrać (również obrazek przebrany za .wav), i wtedy wraca kod „format”.
  const DZWIEK=/^(audio\/|video\/ogg$)/;
  const toDzwiek=f=>!!f&&(DZWIEK.test(f.type||"")||/\.(wav|mp3|ogg|oga|m4a|aac|flac|opus|weba|webm)$/i.test(f.name||""));
  function zPliku(plik,ac){
    return new Promise((ok,zle)=>{
      if(!plik)return zle("format");
      if(plik.size>PLIK_MAKS)return zle("duzy");
      if(!ac)return zle("blad");
      plik.arrayBuffer().then(ab=>new Promise((o,z)=>{
        const p=ac.decodeAudioData(ab,o,()=>z("format"));
        if(p&&p.then)p.then(o,()=>z("format"));
      })).then(buf=>{
        if(!buf||!buf.length)return zle("format");
        zBufora(buf).then(ok,()=>zle("blad"));
      }).catch(e=>zle(e==="format"||e==="duzy"?e:"format"));
    });
  }

  // ---- mikrofon ----------------------------------------------------------------------------------
  // O zgodę pytamy DOPIERO w obsłudze przycisku („Nagraj” albo „Podsłuch”) — nigdy przy starcie ani w tle.
  // W całym pliku jest JEDNO `getUserMedia`, w `otworz()`, a wołają je tylko te dwie drogi; pilnuje tego test.
  // Strumień zamyka `zamknij()` i jest wołany z KAŻDEJ drogi wyjścia (koniec nagrania, przerwanie, błąd,
  // wyjście z ekranu), bo niezamknięta ścieżka to zapalona dioda mikrofonu po wyjściu.
  let nagr=null,pods=null;
  const obslugiwane=()=>{try{return !!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder);}catch(e){return false;}};
  const maMikrofon=()=>{try{return !!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);}catch(e){return false;}};
  const nagrywa=()=>!!nagr;
  const podsluchuje=()=>!!pods;
  // Odmowa wraca KODEM, nie wyjątkiem: warstwa UI zamienia go na zdanie po polsku i po angielsku.
  // „zajetymik” to mikrofon trzymany przez inny program — inna rada niż „podłącz mikrofon”, więc inny kod.
  const KOD=n=>n==="NotAllowedError"||n==="SecurityError"?"zgoda"
    :(n==="NotFoundError"||n==="OverconstrainedError"?"brak"
    :(n==="NotReadableError"||n==="TrackStartError"?"zajetymik":"blad"));
  function otworz(urzadzenie){
    const a={echoCancellation:false,noiseSuppression:false,autoGainControl:false};
    if(urzadzenie)a.deviceId={exact:urzadzenie};   // wybrany mikrofon ZNIKNĄŁ → kod „brak”, nie cicha podmiana na inny
    return navigator.mediaDevices.getUserMedia({audio:a}).catch(e=>{throw KOD((e&&e.name)||"");});
  }
  // Lista mikrofonów do wyboru. Nazwy są PUSTE, dopóki przeglądarka nie dostała zgody na mikrofon (reguła
  // prywatności, nie błąd) — warstwa UI podpisuje je wtedy „Mikrofon 1, 2…”, a po pierwszym nagraniu pyta znowu.
  function urzadzenia(){
    try{
      if(!navigator.mediaDevices||!navigator.mediaDevices.enumerateDevices)return Promise.resolve([]);
      return navigator.mediaDevices.enumerateDevices()
        .then(l=>(l||[]).filter(d=>d&&d.kind==="audioinput").map(d=>({id:d.deviceId||"",nazwa:d.label||""})),()=>[]);
    }catch(e){return Promise.resolve([]);}
  }
  function naZmianeUrzadzen(fn){
    try{if(navigator.mediaDevices&&navigator.mediaDevices.addEventListener)navigator.mediaDevices.addEventListener("devicechange",fn);}catch(e){}
  }
  const teraz=()=>typeof performance!=="undefined"?performance.now():Date.now();
  // analizator na strumieniu: szczyt okienka 0..1, czytany zegarem co 50 ms
  function miernik(ac,strum){
    try{
      const zr=ac.createMediaStreamSource(strum),an=ac.createAnalyser();
      an.fftSize=1024;zr.connect(an);
      const okno=new Float32Array(an.fftSize);
      return {zr,czytaj(){let lv=0;try{an.getFloatTimeDomainData(okno);for(let i=0;i<okno.length;i++)lv=Math.max(lv,Math.abs(okno[i]));}catch(e){}return Math.min(1,lv);}};
    }catch(e){return {zr:null,czytaj:()=>0};}
  }
  function ubij(g){
    if(!g)return;
    if(g.timer)clearInterval(g.timer);
    if(g.odlicz)clearTimeout(g.odlicz);
    try{if(g.rec&&g.rec.state!=="inactive")g.rec.stop();}catch(e){}
    try{if(g.zr)g.zr.disconnect();}catch(e){}
    try{if(g.strum)for(const t of g.strum.getTracks())t.stop();}catch(e){}
  }
  function zamknij(){const g=nagr;nagr=null;ubij(g);stopPodsluch();}
  // PODSŁUCH: mikrofon otwarty tylko po to, żeby było widać poziom PRZED nagraniem („czy ja w ogóle wchodzę
  // w ten mikrofon i czy nie przesadzam”). Nie nagrywa niczego i nie zostawia bajtów.
  function podsluch(ac,cb,urzadzenie){
    cb=cb||{};
    if(nagr||pods){if(cb.blad)cb.blad("zajete");return;}
    if(!maMikrofon()){if(cb.blad)cb.blad("nieobslugiwane");return;}
    if(!ac){if(cb.blad)cb.blad("blad");return;}
    const g=pods={strum:null,zr:null,timer:0,odlicz:0,zerwany:false};
    otworz(urzadzenie).then(strum=>{
      if(g.zerwany||pods!==g){try{for(const t of strum.getTracks())t.stop();}catch(e){}return;}
      g.strum=strum;
      const m=miernik(ac,strum);g.zr=m.zr;
      g.timer=setInterval(()=>{if(pods===g&&cb.poziom)cb.poziom(m.czytaj());},50);
      if(cb.start)cb.start();
    },k=>{if(pods===g)pods=null;if(cb.blad)cb.blad(k);});
  }
  function stopPodsluch(){const g=pods;pods=null;if(!g)return;g.zerwany=true;ubij(g);}
  // cb.poziom(0..1, sekundy) co 50 ms, cb.odliczanie(n), cb.start(), cb.koniec({dane, sr}),
  // cb.blad(kod): zgoda | brak | zajetymik | nieobslugiwane | zajete | krotkie | blad
  // opcje: {urzadzenie: id z `urzadzenia()`, odliczanie: ile sekund „3… 2… 1…” PO zgodzie, przed startem}
  function nagraj(ac,cb,opcje){
    cb=cb||{};opcje=opcje||{};
    if(nagr){if(cb.blad)cb.blad("zajete");return;}   // trwające nagranie zostaje; „zajęte” go nie przerywa
    if(!obslugiwane()){if(cb.blad)cb.blad("nieobslugiwane");return;}
    if(!ac){if(cb.blad)cb.blad("blad");return;}
    stopPodsluch();                                   // dwa strumienie naraz to dwie diody i cichsze nagranie
    const g=nagr={strum:null,rec:null,zr:null,timer:0,odlicz:0,zerwany:false,gra:false};
    const blad=k=>{if(nagr===g)nagr=null;ubij(g);if(cb.blad)cb.blad(k);};
    otworz(opcje.urzadzenie).then(strum=>{
      if(g.zerwany||nagr!==g){try{for(const t of strum.getTracks())t.stop();}catch(e){}return;}
      g.strum=strum;
      let rec=null;
      try{rec=new MediaRecorder(strum);}catch(e){try{rec=new MediaRecorder(strum,{mimeType:"audio/webm"});}catch(e2){rec=null;}}
      if(!rec){blad("nieobslugiwane");return;}
      g.rec=rec;
      const czesci=[],m=miernik(ac,strum);g.zr=m.zr;
      let t0=teraz();
      rec.ondataavailable=e=>{if(e.data&&e.data.size)czesci.push(e.data);};
      rec.onstop=()=>{
        const sek=(teraz()-t0)/1000;
        if(nagr===g)nagr=null;
        ubij(g);     // najpierw gasną ścieżki strumienia, dopiero potem dekodowanie (dioda mikrofonu nie czeka na nie)
        if(!czesci.length||sek<.12){if(cb.blad)cb.blad("krotkie");return;}
        new Blob(czesci,{type:rec.mimeType||"audio/webm"}).arrayBuffer()
          .then(ab=>new Promise((o,z)=>{const p=ac.decodeAudioData(ab,o,()=>z("format"));if(p&&p.then)p.then(o,()=>z("format"));}))
          .then(zBufora)
          .then(w=>{if(cb.koniec)cb.koniec(w);},()=>{if(cb.blad)cb.blad("blad");});
      };
      // Odliczanie idzie PO zgodzie i PO otwarciu mikrofonu: inaczej „3… 2… 1…” leciałoby nad okienkiem
      // przeglądarki pytającym o pozwolenie, a nagranie startowało, kiedy człowiek jeszcze szuka przycisku.
      const ruszaj=()=>{
        if(g.zerwany||nagr!==g)return;
        t0=teraz();g.gra=true;
        try{rec.start();}catch(e){blad("blad");return;}
        g.timer=setInterval(()=>{
          if(nagr!==g)return;
          const sek=(teraz()-t0)/1000;
          if(cb.poziom)cb.poziom(m.czytaj(),Math.min(MAKS_SEK,sek));
          if(sek>=MAKS_SEK)stop();
        },50);
        if(cb.start)cb.start();
      };
      let ile=Math.max(0,Math.min(9,Math.round(+opcje.odliczanie||0)));
      if(!ile){ruszaj();return;}
      const tyk=()=>{
        if(g.zerwany||nagr!==g)return;
        if(cb.odliczanie)cb.odliczanie(ile);
        if(cb.poziom)cb.poziom(m.czytaj(),0);
        if(!ile--){ruszaj();return;}
        g.odlicz=setTimeout(tyk,1000);
      };
      tyk();
    },blad);
  }
  // Zatrzymanie: w odliczaniu to odwołanie całości (nie ma jeszcze czego zapisać), w nagraniu — koniec i zapis.
  function stop(){
    const g=nagr;if(!g)return;
    if(!g.gra){nagr=null;g.zerwany=true;ubij(g);return;}
    if(g.timer){clearInterval(g.timer);g.timer=0;}
    try{if(g.rec.state!=="inactive")g.rec.stop();else{nagr=null;ubij(g);}}catch(e){nagr=null;ubij(g);}
  }

  // id próbki: krótki, bez znaków, które cokolwiek znaczą w ścieżce albo w adresie (serwer panelu zapisuje go
  // jako nazwę pliku w Library/Probki/, więc wzorzec musi być ciasny i taki sam po obu stronach)
  const ID_WZOR=/^s-[a-z0-9]{1,16}$/;
  const nowyId=()=>"s-"+Math.random().toString(36).slice(2,8)+Math.random().toString(36).slice(2,4);
  const idOk=v=>typeof v==="string"&&ID_WZOR.test(v);

  return {SR,MAKS_SEK,MIN_PROBEK,PLIK_MAKS,SZCZYT,MAKS_ZLEP,ID_WZOR,nowyId,idOk,
    doWav,zWav,b64,zB64,szczyt,normalizuj,granice,wytnij,wycinek,wykryjRoot,zBufora,zPliku,toDzwiek,
    obslugiwane,maMikrofon,nagrywa,podsluchuje,urzadzenia,naZmianeUrzadzen,nagraj,podsluch,stopPodsluch,stop,zamknij};
})();
if(typeof window!=="undefined")window.ProbkiAudio=ProbkiAudio;
