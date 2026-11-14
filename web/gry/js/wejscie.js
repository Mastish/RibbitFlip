"use strict";
// ===== ŻABI CHÓR: wejście (kapsle żywe i udawane) =====
// Każde źródło gracza daje TEN SAM obiekt, czyli kontrakt gry:
//   {id, nazwa, kolor, obrazekKapsla, pitch, roll, twist, przycisk, zywy}
// i kilka pól pomocniczych: zrodlo ("mysz"|"ws"|"strzalki"|"bot"|"kapsel"), slot, swiezy, wyciszony.
// pitch i roll to stopnie ze znakiem, twist to °/s, czyli dokładnie `pose` ze strumienia aplikacji.
// Kierunek pitch jest ten z aplikacji: DODATNI pitch spycha kursor W DÓŁ (padPoseXY w rf-22), więc
// mysz u góry okna daje ujemny pitch, a gra zamienia ujemny pitch na wysokie nuty.
//
// Źródła:
//   · mysz: Y okna = przechył (środek okna = 0°), lewy przycisk = śpiew. Istnieje od startu, a o tym,
//     czy gra, decyduje gra (dołącza kliknięciem w lobby),
//   · klawiatura: gracz „W/S” (W/S = przechył przód/tył, A/D = w bok, Spacja = śpiew) i gracz
//     „Strzałki” (↑/↓, ←/→, Enter). Źródło powstaje przy pierwszym naciśnięciu jego klawisza i to
//     naciśnięcie JEST dołączeniem (nie liczy się jeszcze jako „wciśnięcie”),
//   · boty (?boty=N, poziom z lobby albo ?luz=0.3): śpiewają swoją partię z rozstrojeniem, spóźnieniem
//     i drżeniem ręki zależnymi od poziomu trudności (POZIOMY_BOTOW),
//   · pad (Gamepad API): lewa gałka w przód i w tył = przechył, w bok = zmiana partii, A albo RT = śpiew,
//     prawa gałka wychylona = wibrato, Start = pauza. Pad powstaje przy pierwszym naciśnięciu przycisku
//     i to naciśnięcie JEST dołączeniem (jak klawiatura),
//   · żywe kapsle (?zywe=1): EventSource('/stream') aplikacji. Slot wprowadza wyłącznie `devmeta`;
//     `s` niesie pozę (50 Hz), `b` pakiet statusu z przyciskiem.
// Zdarzenia dla gry: nowe, zmiana, znika, wcisniecie, puszczenie, klawisz (każde naciśnięcie klawisza
// gracza klawiaturowego albo przycisku pada, po ewentualnym „wcisniecie”: lobby dołącza po nim gracza,
// który wcześniej odszedł) oraz start (przycisk Start pada: pauza).
// naZdarzenie(fn) → fn({typ, gracz}).
// MENU (ekrany przed grą bez graczy: menu, Utwory, wybór piosenki): gdy ustawMenu(czyMenu, akcja) mówi „menu”,
// klawiatura NIE tworzy graczy (strzałki, Enter i Spacja należą do przycisków strony), a pad zamiast śpiewać
// nawiguje: krzyżak albo lewa gałka = akcja("gora"|"dol"|"lewo"|"prawo") z powtarzaniem, A i Start = "ok",
// B = "wstecz". Przycisk Back/Select (8) to "wstecz" także poza menu. Gracze dołączają w kroku Rozgrywka.
const Wejscie=(function(){
  const KAPSLE="../assets/caps/";
  const kapsel=n=>KAPSLE+n+"-96.png";
  // Kolory botów: barwy marki i dwie farby z teł Syntha (atrament, kraft), wszystkie czytelne na papierze.
  const KOLORY_BOTOW=["#294aa8","#b8264a","#8e6fe6","#2aa198","#c7a373","#4f8a2a","#d81678","#c98a14"];
  const KAPSLE_BOTOW=["5","6","7","4","1","2","3","6"];
  // Dwóch graczy klawiaturowych. `spiew` może mieć kilka klawiszy (Enter i Enter z klawiatury numerycznej).
  const KLAWIATURA={
    ws:{gora:"KeyW",dol:"KeyS",lewo:"KeyA",prawo:"KeyD",spiew:["Space"],wolno:"ShiftLeft",wibrato:["KeyQ","KeyE"],kolor:"#46781f",kapsel:"3"},
    strzalki:{gora:"ArrowUp",dol:"ArrowDown",lewo:"ArrowLeft",prawo:"ArrowRight",spiew:["Enter","NumpadEnter"],wolno:"ShiftRight",wibrato:["Period","Slash"],
      kolor:"#c98a14",kapsel:"1"}};
  // Klawisz precyzji (spowalnia ruch w górę i w dół): trzymany Shift po
  // stronie gracza mnoży prędkość przechyłu przez WOLNO. Sam Shift nie dołącza gracza i nie blokuje przeglądarki.
  const WOLNO=.33,KLAWISZE_WOLNO=new Set(Object.values(KLAWIATURA).map(s=>s.wolno));
  // Wibrato każdym sterowaniem, bo gracze nie wiedzieli, jak je robić (prawy przycisk myszy odpadł jako nieintuicyjny):
  // mysz ruchem w lewo/prawo, kapsel wychyleniem w lewo/prawo, klawiatura Q i E na przemian.
  // Gra liczy wibrato z `twist` (°/s, próg ZC_PUNKTY.WIB_PROG 150), więc każde wejście zamienia swój ruch na °/s:
  //   klawiatura: Q i E (W/S) albo . i / (strzałki) na przemian; każda zmiana klawisza w WIB_ODSTEP_MS podtrzymuje
  //               wibrato przez WIB_TRWA_MS (twist WIBRATO_KLAWISZ). Jak Shift: same nie dołączają gracza,
  //   mysz:       szybki ruch w lewo i w prawo (prędkość pozioma px/s × WIB_MYSZ); pion dalej prowadzi wysokość,
  //   kapsel:     bujanie na boki (prędkość przechyłu w bok °/s × WIB_KAPSEL) albo jak dotąd obrót,
  //   pad:        prawa gałka (bez zmian).
  const WIBRATO_KLAWISZ=220,WIB_ODSTEP_MS=350,WIB_TRWA_MS=320,WIB_MYSZ=.5,WIB_KAPSEL=1.2;
  const KLAWISZE_WIBRATO=new Set(Object.values(KLAWIATURA).flatMap(s=>s.wibrato));
  const PRZECHYL_KLAWISZA=45;      // ° przechyłu w bok, gdy trzymasz A/D albo ←/→
  const zrodla=new Map(),sluchacze=[];
  const wcisniete=new Set();
  const mysz={y:.5};
  let zakres=40,celBotow=null,licznikBotow=0;
  let nazwy={mysz:"Mysz",ws:"W/S",strzalki:"Strzałki",boty:["Bot"]};
  let losuj=mulberry32(7);
  let czyMenu=()=>false,akcjaMenu=()=>{};

  // Powtarzalny los (boty mają śpiewać tak samo przy każdym uruchomieniu tego samego adresu).
  function mulberry32(a){
    return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
      t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
  }
  function gauss(){const u=Math.max(1e-9,losuj()),v=losuj();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
  const ogranicz=(v,a,b)=>Math.max(a,Math.min(b,v));

  // `dod`: dodatkowe pola zdarzenia (10-18: kierunek `kier` w „pion” i „bok”)
  function emituj(typ,g,dod){
    for(const fn of sluchacze){try{fn(Object.assign({typ,gracz:g},dod));}catch(e){console.error(e);}}
  }
  function nowyGracz(id,pola){
    return Object.assign({id,nazwa:"",kolor:"#6cb33f",obrazekKapsla:kapsel("1"),pitch:0,roll:0,twist:0,
      przycisk:false,zywy:false,zrodlo:"",slot:-1,swiezy:true,wyciszony:false},pola);
  }
  // Jedyne miejsce, które zmienia `przycisk`: zbocze = zmiana względem poprzedniego stanu.
  function ustawPrzycisk(g,stan,cicho){
    stan=!!stan;
    if(stan===g.przycisk)return;
    g.przycisk=stan;
    if(!cicho)emituj(stan?"wcisniecie":"puszczenie",g);
  }

  // ---- mysz --------------------------------------------------------------------------------
  // Klik w przycisk, suwak albo listę to obsługa ekranu, nie śpiew.
  function klikWKontrolke(e){
    const el=e.target;
    return !!(el&&el.closest&&el.closest("button,input,select,label,a,textarea,[data-bez-spiewu]"));
  }
  function podlaczMysz(){
    zrodla.set("mysz",nowyGracz("mysz",{nazwa:nazwy.mysz,kolor:"#d81678",obrazekKapsla:kapsel("2"),zrodlo:"mysz"}));
    addEventListener("pointermove",e=>{
      mysz.y=e.clientY/Math.max(1,innerHeight);
      const t=performance.now(),dt=(t-(mysz.t||0))/1000;   // prędkość pozioma (wibrato myszą), wygładzona
      if(dt>0&&dt<.15)mysz.vx=.6*(mysz.vx||0)+.4*Math.abs(e.clientX-(mysz.x||e.clientX))/dt;
      mysz.x=e.clientX;mysz.t=t;
    },{passive:true});
    addEventListener("pointerdown",e=>{
      mysz.y=e.clientY/Math.max(1,innerHeight);
      if(e.button===0&&!klikWKontrolke(e))ustawPrzycisk(zrodla.get("mysz"),true);
    });
    addEventListener("pointerup",e=>{if(e.button===0)ustawPrzycisk(zrodla.get("mysz"),false);});
    addEventListener("pointercancel",()=>ustawPrzycisk(zrodla.get("mysz"),false));
  }

  // ---- klawiatura --------------------------------------------------------------------------
  function schematWibrata(kod){for(const k in KLAWIATURA)if(KLAWIATURA[k].wibrato.includes(kod))return k;return null;}
  function schematKlawisza(kod){
    for(const k in KLAWIATURA){const s=KLAWIATURA[k];
      if(kod===s.gora||kod===s.dol||kod===s.lewo||kod===s.prawo||s.spiew.includes(kod))return k;}
    return null;
  }
  // Pole tekstowe, suwak albo lista z fokusem dostaje swoje klawisze (strzałki przesuwają suwak).
  // 10-15 (przejście „gospodarz na kanapie”): w Rozgrywce Enter i Spacja na przycisku tylko dołączały graczy, więc
  // żadnego przycisku nie dało się użyć z klawiatury. Teraz przycisk dostaje Enter i Spację, gdy fokus przyszedł z Taba
  // (fokus ustawiony przez grę albo myszą dalej oddaje te klawisze graczom: Spacja dołącza jak dotąd), a w oknach
  // oznaczonych [data-klawisze-natywne] (pauza) zawsze.
  let fokusZTaba=false,ostTab=0;
  addEventListener("keydown",e=>{if(e.key==="Tab")ostTab=performance.now();},true);
  addEventListener("focusin",()=>{fokusZTaba=performance.now()-ostTab<300;},true);
  function fokusWKontrolce(kod){
    const el=document.activeElement;
    if(el&&(el.tagName==="INPUT"||el.tagName==="SELECT"||el.tagName==="TEXTAREA"||el.isContentEditable))return true;
    if(!el||!el.closest)return false;
    if(el.closest("[data-klawisze-natywne]"))return true;
    const przycisk=el.tagName==="BUTTON"||el.tagName==="A"||el.getAttribute("role")==="button";
    return przycisk&&fokusZTaba&&(kod==="Enter"||kod==="NumpadEnter"||kod==="Space");
  }
  function podlaczKlawiature(){
    addEventListener("keydown",e=>{
      if(KLAWISZE_WOLNO.has(e.code)){wcisniete.add(e.code);return;}
      if(KLAWISZE_WIBRATO.has(e.code)&&!fokusWKontrolce(e.code)&&!czyMenu()){
        const gw=zrodla.get(schematWibrata(e.code));if(!gw||e.repeat)return;
        e.preventDefault();const t=performance.now(),w=gw._wib||(gw._wib={ost:null,t:0,do:0});
        if(w.ost&&w.ost!==e.code&&t-w.t<WIB_ODSTEP_MS)w.do=t+WIB_TRWA_MS;   // druga strona naprzemiennego stukania
        w.ost=e.code;w.t=t;return;
      }
      const klucz=schematKlawisza(e.code);
      if(!klucz||fokusWKontrolce(e.code)||e.ctrlKey||e.altKey||e.metaKey||czyMenu())return;
      e.preventDefault();
      if(e.repeat)return;
      wcisniete.add(e.code);
      const sch=KLAWIATURA[klucz],spiew=sch.spiew.includes(e.code);
      let g=zrodla.get(klucz);
      if(!g){
        g=nowyGracz(klucz,{nazwa:nazwy[klucz],kolor:sch.kolor,obrazekKapsla:kapsel(sch.kapsel),zrodlo:klucz});
        g._kl={v:0};
        zrodla.set(klucz,g);
        if(spiew)ustawPrzycisk(g,true,true);   // to naciśnięcie zostało zużyte na dołączenie
        emituj("nowe",g);
        return;
      }
      if(spiew)ustawPrzycisk(g,true);
      if(e.code===sch.gora||e.code===sch.dol){   // „do nuty”: gra mówi, dokąd skoczyć (kolejne naciśnięcie liczy od celu)
        const kier=e.code===sch.gora?-1:1;g._kl.od=performance.now();
        // z klawiszem precyzji (Shift) bez skoku na nutę: ruch tylko powolny
        const cel=trybKlawiatury(klucz)==="donuty"&&sterKl.cel&&!wcisniete.has(sch.wolno)?sterKl.cel(g.id,kier,g._kl.cel!=null?g._kl.cel:g.pitch):null;
        if(Number.isFinite(cel)){g._kl.cel=ogranicz(cel,-zakres,zakres);g._kl.v=0;}
      }
      // krótkie stuknięcie A/D albo ←/→ potrafi zacząć się i skończyć między dwiema klatkami:
      // impuls gwarantuje, że gra zobaczy przechył w bok przynajmniej w jednej klatce
      if(e.code===sch.lewo||e.code===sch.prawo)g._kl.impuls=e.code===sch.prawo?1:-1;
      // 10-18: góra/dół jako zdarzenie „pion”: przed piosenką (krok 2) gra zmienia nim instrument gracza, jak przechyłem kapsla
      if(e.code===sch.gora||e.code===sch.dol)emituj("pion",g,{kier:e.code===sch.gora?-1:1});
      emituj("klawisz",g);
    });
    addEventListener("keyup",e=>{
      wcisniete.delete(e.code);
      const klucz=schematKlawisza(e.code);if(!klucz)return;
      const g=zrodla.get(klucz),sch=KLAWIATURA[klucz];
      if(g&&sch.spiew.includes(e.code)&&!sch.spiew.some(k=>wcisniete.has(k)))ustawPrzycisk(g,false);
    });
    addEventListener("blur",()=>{
      wcisniete.clear();
      for(const g of zrodla.values())if(g.zrodlo!=="kapsel"&&g.zrodlo!=="bot")ustawPrzycisk(g,false);
    });
  }
  // Przechył z bezwładnością: trzymany klawisz rozpędza przechył do ~2,4 zakresu na sekundę (cały
  // zakres w ok. 0,8 s), puszczony szybko wyhamowuje. Przechył zostaje tam, gdzie go zostawisz, jak
  // suwak puzonu, a nie wraca do zera: inaczej długiej wysokiej nuty nie dałoby się utrzymać.
  // sterowanie klawiaturą od gry: tryb (wartość albo funkcja klucza klawiatury „ws” / „strzalki”, bo od 10-18 „skok do
  // nuty” jest pomocą gracza) i cel(id, kierunek, przechył) dla „do nuty”
  let sterKl={};
  const trybKlawiatury=klucz=>{const t=typeof sterKl.tryb==="function"?sterKl.tryb(klucz):sterKl.tryb;return t||"plynnie";};
  // Tryby (ustawienie gry „Klawiatura”, 10-10): płynnie (jak wyżej), szybko (2× szybciej, krótszy rozpęd) i do nuty
  // (naciśnięcie skacze w ok. 0,1 s na nutę wskazaną przez grę, przytrzymanie ponad 0,22 s jedzie dalej jak „szybko”).
  function krokKlawiatury(klucz,sch,dt){
    const g=zrodla.get(klucz);if(!g)return;
    const k=g._kl||(g._kl={v:0});
    const kier=(wcisniete.has(sch.gora)?-1:0)+(wcisniete.has(sch.dol)?1:0);
    g.twist=g._wib&&performance.now()<g._wib.do?WIBRATO_KLAWISZ:0;
    const tryb=trybKlawiatury(klucz),szybko=tryb!=="plynnie";
    if(k.cel!=null){   // dojazd na nutę („do nuty”)
      if(kier&&k.od!=null&&performance.now()-k.od>220)k.cel=null;   // przytrzymanie: dalej płynny ruch
      else{g.pitch=ogranicz(g.pitch+(k.cel-g.pitch)*(1-Math.exp(-dt/.035)),-zakres,zakres);k.v=0;
        if(Math.abs(k.cel-g.pitch)<.002*zakres){g.pitch=k.cel;k.cel=null;}
        return;}
    }
    const wolno=sch.wolno&&wcisniete.has(sch.wolno)?WOLNO:1;   // klawisz precyzji
    k.v+=(kier*(szybko?4.8:2.4)*wolno*zakres-k.v)*(1-Math.exp(-dt/(kier?(szybko?.05:.09):.05)));
    g.pitch=ogranicz(g.pitch+k.v*dt,-zakres,zakres);
    if(Math.abs(g.pitch)>=zakres)k.v=0;
    g.roll=(wcisniete.has(sch.lewo)?-PRZECHYL_KLAWISZA:0)+(wcisniete.has(sch.prawo)?PRZECHYL_KLAWISZA:0);
    if(k.impuls){if(!g.roll)g.roll=k.impuls*PRZECHYL_KLAWISZA;k.impuls=0;}
  }

  // ---- pad (Gamepad API) ---------------------------------------------------------------------
  // Przeglądarka pokazuje stronie pad dopiero po naciśnięciu na nim przycisku, a gra dołącza gracza właśnie
  // tym naciśnięciem (jak klawiatura). Lewa gałka w przód i w tył to przechył WPROST: wychylenie do oporu
  // = cały zakres (jak mysz od brzegu do brzegu okna), puszczona wraca na środek partii. Lewa gałka w bok
  // = przechył w bok (zmiana partii w lobby), prawa gałka wychylona = obrót kapsla (wibrato, brawa).
  // Śpiew: A, B, bumpery albo spusty; Start: pauza.
  const PAD={MARTWA:.12,SPIEW:[0,1,4,5,6,7],START:9,SPUST:.35,WIBRATO:300,BOK:45,
    WSTECZ:8,KRZYZAK:{12:"gora",13:"dol",14:"lewo",15:"prawo"},GALKA_MENU:.55,POWTORZ_PO:.42,POWTORZ_CO:.15};
  const menuPadow=new Map();   // indeks pada → {kier, nastepny}: kierunek trzymany w menu i kiedy go powtórzyć
  // Pad w menu: zbocza A/Start/B, kierunek z krzyżaka albo gałki (pierwszy krok od razu, potem powtarzanie).
  function krokPadaWMenu(p,teraz,przed,sek){
    if(typeof DzwiekiUI!=="undefined"&&DzwiekiUI&&DzwiekiUI.oznaczWejscie&&teraz.some((v,i)=>v&&!przed[i]))DzwiekiUI.oznaczWejscie("pad");
    // 10-18 (PK-06): Start osobno („start”: w pauzie wznawia), puszczenie A/Start („ok-pusc”: przytrzymanie w nakładce
    // nagród), B osobno („b”: w lobby wstecz, w pauzie i na wynikach nic, bo B to śpiew, D-5); gra decyduje w akcji
    // tryb sterowania „Łapka” (js/kursor-lapka.js): lewa gałka prowadzi łapkę tego pada, a A klika to, co pod nią;
    // krzyżak dalej skacze fokusem, a pad bez widocznej łapki klika po staremu to, co ma fokus
    const lapka=typeof KursorLapka!=="undefined"&&KursorLapka&&KursorLapka.przejmujePada&&KursorLapka.przejmujePada();
    if(lapka)KursorLapka.krokPada(p);
    if(teraz[0]&&!przed[0]&&!(lapka&&KursorLapka.klik("pad-"+p.index)))akcjaMenu("ok");
    if(teraz[PAD.START]&&!przed[PAD.START])akcjaMenu("start");
    if((!teraz[0]&&przed[0])||(!teraz[PAD.START]&&przed[PAD.START]))akcjaMenu("ok-pusc");
    if(teraz[1]&&!przed[1])akcjaMenu("b");
    if(teraz[PAD.WSTECZ]&&!przed[PAD.WSTECZ])akcjaMenu("wstecz");
    const ax=p.axes||[];let kier=null;
    for(const i in PAD.KRZYZAK)if(teraz[i])kier=PAD.KRZYZAK[i];
    if(!kier&&!lapka){const x=+ax[0]||0,y=+ax[1]||0;
      if(Math.max(Math.abs(x),Math.abs(y))>PAD.GALKA_MENU)kier=Math.abs(x)>Math.abs(y)?(x>0?"prawo":"lewo"):(y>0?"dol":"gora");}
    const m=menuPadow.get(p.index)||{kier:null,nastepny:0};
    if(!kier){m.kier=null;}
    else if(kier!==m.kier){m.kier=kier;m.nastepny=sek+PAD.POWTORZ_PO;
      // dźwięki UI (dzwieki-ui.js): pad nie daje zdarzeń DOM, więc sam mówi, że to on; pierwszy krok w ścianę
      // (fokus nie drgnął) = „blad”, powtarzanie trzymanego kierunku już nie (nie terkocze o krawędź)
      const ui=typeof DzwiekiUI!=="undefined"&&DzwiekiUI&&DzwiekiUI.zglos?DzwiekiUI:null,przed=document.activeElement;
      if(ui)ui.oznaczWejscie("pad");
      akcjaMenu(kier);
      if(ui&&czyMenu()&&przed&&przed!==document.body&&document.activeElement===przed)ui.zglos("blad");}
    else if(sek>=m.nastepny){m.nastepny=sek+PAD.POWTORZ_CO;akcjaMenu(kier);}
    menuPadow.set(p.index,m);
  }
  const KOLORY_PADOW=["#294aa8","#2aa198","#8e6fe6","#b8264a"],KAPSLE_PADOW=["7","5","6","4"];
  const stanPadow=new Map();   // indeks pada → przyciski z poprzedniej klatki
  function osPada(v){const a=Math.abs(+v||0);return a<PAD.MARTWA?0:Math.sign(v)*(a-PAD.MARTWA)/(1-PAD.MARTWA);}
  function krokPadow(sek){
    const lista=typeof navigator!=="undefined"&&navigator&&typeof navigator.getGamepads==="function"?navigator.getGamepads():null;
    const widziane=new Set();
    for(const p of lista||[]){
      if(!p||p.connected===false)continue;
      const id="pad-"+p.index;widziane.add(id);
      const teraz=p.buttons.map(b=>!!b&&(b.pressed||(+b.value||0)>PAD.SPUST));
      const przed=stanPadow.get(p.index)||teraz.map(()=>false);
      stanPadow.set(p.index,teraz);
      if(czyMenu()){   // menu: pad nawiguje, nie śpiewa i nie dołącza
        // gracz z tego pada (pauza, wyniki, nakładka): nie śpiewa, ale prawa gałka dalej bije brawo na wynikach
        const g0=zrodla.get(id);
        if(g0){ustawPrzycisk(g0,false,true);const ax0=p.axes||[];g0.twist=Math.max(Math.abs(osPada(ax0[2])),Math.abs(osPada(ax0[3])))*PAD.WIBRATO;}
        krokPadaWMenu(p,teraz,przed,sek||0);continue;
      }
      menuPadow.delete(p.index);
      if(teraz[PAD.WSTECZ]&&!przed[PAD.WSTECZ])akcjaMenu("wstecz");   // Back nie dołącza i nie jest „klawiszem” gracza
      const nowyKlik=teraz.some((v,i)=>v&&!przed[i]&&i!==PAD.WSTECZ);
      const spiew=PAD.SPIEW.some(i=>teraz[i]);
      let g=zrodla.get(id);
      if(!g){
        if(!nowyKlik)continue;   // pad, który nic nie nacisnął, nie jest jeszcze graczem
        const n=p.index%KOLORY_PADOW.length;
        g=nowyGracz(id,{nazwa:(nazwy.pad||"Pad")+" "+(p.index+1),kolor:KOLORY_PADOW[n],obrazekKapsla:kapsel(KAPSLE_PADOW[n]),
          zrodlo:"pad",etykieta:String(p.id||"").replace(/\s*\(.*$/,"").slice(0,24)});
        zrodla.set(id,g);
        ustawPrzycisk(g,spiew,true);   // to naciśnięcie zostało zużyte na dołączenie
        emituj("nowe",g);
        if(teraz[PAD.START]&&!przed[PAD.START])emituj("start",g);   // 10-18 (Z-21): pierwszy Start w sesji też pauzuje
        continue;
      }
      const ax=p.axes||[];
      g.pitch=ogranicz(osPada(ax[1])*zakres,-zakres,zakres);
      g.roll=osPada(ax[0])*PAD.BOK;
      g.twist=Math.max(Math.abs(osPada(ax[2])),Math.abs(osPada(ax[3])))*PAD.WIBRATO;
      ustawPrzycisk(g,spiew);
      // 10-18: krzyżak gracza (zbocze): góra/dół = „pion”, w bok = „bok”; przed piosenką gra zmienia nimi instrument i partię
      for(const i in PAD.KRZYZAK)if(teraz[i]&&!przed[i]){const k=PAD.KRZYZAK[i];
        emituj(k==="gora"||k==="dol"?"pion":"bok",g,{kier:k==="gora"||k==="lewo"?-1:1});}
      if(teraz[PAD.START]&&!przed[PAD.START])emituj("start",g);
      else if(nowyKlik)emituj("klawisz",g);
    }
    for(const [id,g] of zrodla)if(g.zrodlo==="pad"&&!widziane.has(id)){
      zrodla.delete(id);stanPadow.delete(+id.slice(4));emituj("znika",g);
    }
  }

  // ---- boty --------------------------------------------------------------------------------
  // Poziom trudności bota to komplet cech „ręki”, każda mierzalna osobno:
  //   reakcja    s, o ile bot spóźnia się względem nut (losowo z przedziału [od, do], raz na bota),
  //   stroj      odchylenie standardowe stroju w półtonach (losowane na każdą nutę),
  //   zapomina   szansa, że bot nie zaśpiewa nuty,  falsz: szansa na fałsz o 2,5–4 półtonu,
  //   tau        s, stała czasowa „ręki”: jak szybko dojeżdża do nowej wysokości (skoki!),
  //   predkosc   °/s, górna prędkość ręki przy zakresie 40° (przy innym zakresie skaluje się tak, żeby bot
  //              przejeżdżał tyle samo PÓŁTONÓW na sekundę). Sam `tau` ruszał na skok o oktawę z prędkością
  //              kilkuset °/s, czyli szybciej, niż da się machnąć nadgarstkiem: to limit, o który rozbijają się
  //              partie ekstremalne (daleko i gęsto), a którego w spokojnej piosence ręka w ogóle nie dotyka,
  //   drzenie    °, drżenie ręki (szum dolnoprzepustowy jak u człowieka z kapslem), czyli kara za
  //              szeroki zakres partii, gdzie jeden półton to mało stopni,
  //   wibrato    szansa, że na długiej nucie zakręci kapslem,
  //   zatrzask   [zasięg, siła, pas] półtonów: jak celnie robo-żaba SIADA na nucie, kiedy ręka już dojechała
  //              (ten sam magnes co „Przyciąganie do nut”, tylko że to nie pomoc, a precyzja czipów bota —
  //              gra podaje go do krokGracza zamiast pomocy z ustawień). Mistrz siada co do włosa, Łatwy ledwie
  //              muska nutę, więc ślad żaby na torze wygląda wreszcie tak, jak mówi jej wynik,
  //   przod      s, na ile przed końcem nuty ręka rusza już do następnej (czyta nuty z wyprzedzeniem),
  //   oddech     s, na ile przed końcem nuty puszcza przycisk (oddech, a zarazem klik w rytm: puszczenie i następne
  //              naciśnięcie dostają premię za klik). Nuty krótsze niż ARTYKULACJA s w legato przejeżdża z trzymanym
  //              przyciskiem, bo oddech zjadłby im za dużo śpiewu.
  // Wartości dobrane symulacją (tools/ribbitbeat_kalibracja.mjs), opis wyników w ZC_TRUDNOSC (zabi-chor.js).
  // Porządek wyników (10-18, D-9): jedna zapomniana albo fałszywa nuta zrywa kombo i na krótkiej piosence kosztuje
  // 25–35 % punktów, więc Trudny i Mistrz losowo nie zapominają ani nie fałszują, Średni robi to przy 1 % nut, a przedziały
  // reakcji nie zachodzą na siebie (Trudny ≤ 35 ms, Średni ≥ 55 ms). Mecze w grze (ZC.ff, 20 piosenek × 100 ziaren):
  // Mistrz > Trudny > Średni > Łatwy w każdym. Oddech krótszy niż klatka (1/60 s) psuje klik: przy 60 Hz bot nie puszcza
  // wtedy przycisku między sąsiednimi nutami.
  // ZATRZASK I PRĘDKOŚĆ (bot „Mistrz” wizualnie nie przyciągał się do nut, a i tak miażdżył):
  // do 10-20 bot brał przyciąganie z USTAWIEŃ GRY, więc w presecie „Mistrz” (przyciąganie 0) jechał po torze w ogóle
  // nie trafiając w nuty, a punkty i tak miał pełne — ocena nuty to średnia celności z całego jej czasu, a ręka
  // dojeżdżała wykładniczo i ostatnią ćwiartkę drogi pełzła przez bursztynowy pas taśmy. Zatrzask zabiera to pełzanie
  // (ręka, która już jest przy nucie, siada na niej), a `predkosc` oddaje punkty tam, gdzie mają być oddane: na
  // partiach gęstych i szerokich, czyli tych, które bot ma gubić. Kalibracja (181 partii, 1 ziarno,
  // precyzja % nut na „Dobrze” i lepiej · ślad % czasu nuty NA niej):
  //   partia łatwa     71/98/100/100 · ślad 62/88/95/98   (przed: 70/98/100/100 · ślad 61/84/93/95)
  //   średnia          35/84/ 99/100 · ślad 39/72/89/95   (przed: 34/85/ 99/100 · ślad 38/67/84/89)
  //   trudna           24/66/ 93/ 99 · ślad 29/60/85/94   (przed: 23/62/ 96/ 99 · ślad 27/53/78/86)
  //   bardzo trudna    13/34/ 74/ 90 · ślad 15/37/71/86   (przed: 12/31/ 78/ 95 · ślad 14/32/62/74)
  //   ekstremalna       9/16/ 53/ 69 · ślad 10/15/44/66   (przed:  9/15/ 43/ 60 · ślad 10/12/28/47)
  // Czyli: wynik został na swoim miejscu (drabina poziomów bez zmian), a ślad przestał kłamać — u Mistrza na partii
  // bardzo trudnej różnica „wynik minus ślad” spadła z 21 do 4 punktów procentowych.
  const POZIOMY_BOTOW={
    latwy:{reakcja:[.1,.16],stroj:.5,zapomina:.09,falsz:.05,tau:.2,predkosc:160,drzenie:1.6,wibrato:.2,przod:0,oddech:.05,zatrzask:[.8,.52,.25]},
    sredni:{reakcja:[.055,.08],stroj:.3,zapomina:.007,falsz:.003,tau:.12,predkosc:175,drzenie:1,wibrato:.5,przod:.04,oddech:.04,zatrzask:[1,.62,.35]},
    trudny:{reakcja:[.025,.035],stroj:.16,zapomina:0,falsz:0,tau:.075,predkosc:195,drzenie:.5,wibrato:.8,przod:.07,oddech:.03,zatrzask:[1.25,.82,.45]},
    mistrz:{reakcja:[0,.015],stroj:.07,zapomina:0,falsz:0,tau:.045,predkosc:240,drzenie:.2,wibrato:1,przod:.09,oddech:.02,zatrzask:[1.6,.95,.6]}};
  const ARTYKULACJA=.3;
  const POZIOM_BOTA_DOMYSLNY="sredni";
  // Cechy z poziomu (napis „latwy”…„mistrz”) albo ze starego luzu 0..1 (?luz=, ZC.dodajBota(0.3)): przy luzie 0
  // bot jest prawie idealny, przy 1 to kabaret; luz nie ma drżenia, więc liczy się dokładnie jak przed poziomami.
  function cechyBota(poziom){
    if(typeof poziom==="string"&&POZIOMY_BOTOW[poziom]){
      const P=POZIOMY_BOTOW[poziom];
      return {poziom,opoznienie:P.reakcja[0]+losuj()*(P.reakcja[1]-P.reakcja[0]),rozstrojenie:P.stroj,
        zapominalski:P.zapomina,falszywy:P.falsz,tau:P.tau,predkosc:P.predkosc,drzenie:P.drzenie,wibrato:P.wibrato,przod:P.przod,legato:true,
        oddech:P.oddech,zatrzask:{zasieg:P.zatrzask[0],sila:P.zatrzask[1],pas:P.zatrzask[2]}};
    }
    const L=ogranicz(Number.isFinite(+poziom)&&poziom!==null&&poziom!==""?+poziom:.3,0,1);
    return {poziom:null,luz:L,opoznienie:losuj()*L*.22,rozstrojenie:L*.9,zapominalski:L*.1,falszywy:L*.06,
      tau:.05+L*.12,predkosc:0,drzenie:0,wibrato:.6,przod:0,legato:false,oddech:.05,zatrzask:null};
  }
  function dodajBota(poziom){
    const n=licznikBotow++;
    const id="bot-"+(n+1);
    const g=nowyGracz(id,{nazwa:nazwy.boty[n%nazwy.boty.length],kolor:KOLORY_BOTOW[n%KOLORY_BOTOW.length],
      obrazekKapsla:kapsel(KAPSLE_BOTOW[n%KAPSLE_BOTOW.length]),zrodlo:"bot"});
    g._bot=Object.assign(cechyBota(poziom),{faza:losuj()*6.28,ostatniIdx:-2,odchyl:0,pominie:false,drz:0,drzCel:0,drzZa:0});
    g.poziom=g._bot.poziom;
    g.pitch=(losuj()-.5)*zakres*.4;
    zrodla.set(id,g);
    emituj("nowe",g);
    return g;
  }
  // Zmiana poziomu w lobby: nowe cechy ręki, ta sama faza kołysania (bot nie podskakuje).
  function ustawPoziomBota(id,poziom){
    const g=zrodla.get(id);if(!g||g.zrodlo!=="bot"||!POZIOMY_BOTOW[poziom])return null;
    g._bot=Object.assign(g._bot,cechyBota(poziom),{ostatniIdx:-2});
    g.poziom=poziom;
    emituj("zmiana",g);
    return g;
  }
  // `celBotow(g)` dostarcza gra: {idx (nuta pod linią albo null), polton (cel albo następna nuta),
  // doKonca (s do końca nuty), dlugosc (ćwierćnuty), dlugoscSek (s), postep (0..1 w nucie), nastepny (półton następnej nuty
  // albo null), nastepnyZa (s do jej początku), naStopnie(półton → stopnie przechyłu)} albo null poza grą.
  // Na długich nutach bot czasem kręci kapslem (wibrato) w drugiej połowie.
  function krokBota(g,dt,teraz){
    const b=g._bot,c=celBotow?celBotow(g):null;
    if(!c||c.polton==null){   // poza piosenką: lekkie kołysanie wokół środka
      const cel=Math.sin(teraz/1000*.8+b.faza)*zakres*.25;
      g.pitch+=(cel-g.pitch)*(1-Math.exp(-dt/.4));
      g.roll=Math.sin(teraz/1000*.5+b.faza*2)*8;g.twist=0;
      ustawPrzycisk(g,false);
      return;
    }
    if(c.idx!==b.ostatniIdx){
      b.ostatniIdx=c.idx;
      if(c.idx!=null){
        b.odchyl=ogranicz(gauss()*b.rozstrojenie,-2.2,2.2);
        if(losuj()<b.falszywy)b.odchyl+=(losuj()<.5?-1:1)*(2.5+losuj()*1.5);
        b.pominie=losuj()<b.zapominalski;
        b.wibratoTu=losuj()<b.wibrato;
      }
    }
    // czytanie z wyprzedzeniem: tuż przed końcem nuty ręka jedzie już do następnej (bez odchyłki tej nuty)
    const wPrzod=c.idx!=null&&b.przod>0&&c.nastepny!=null&&c.doKonca<b.przod;
    const deg=c.naStopnie(wPrzod?c.nastepny:c.polton+(c.idx!=null?b.odchyl:0));
    // drżenie ręki: nowy cel szumu co 0,25 s, wygładzony (τ 0,12 s), czyli powolne „pływanie” o ok. ±drzenie°
    // wokół miejsca, do którego jedzie ręka (ręka bez drżenia to stary bot co do bitu)
    const reka=g.pitch-b.drz;
    if(b.drzenie>0){
      b.drzZa-=dt;
      if(b.drzZa<=0){b.drzZa=.25;b.drzCel=gauss()*b.drzenie*1.4;}
      b.drz+=(b.drzCel-b.drz)*(1-Math.exp(-dt/.12));
    }
    // dojazd ze stałą czasową tau, ale nie szybciej niż `predkosc` (przy zakresie 40°; przy innym zakresie tyle
    // samo półtonów na sekundę). Sam tau ruszał na skok o oktawę kilkaset °/s, czyli szybciej, niż da się machnąć
    // nadgarstkiem: w spokojnej piosence limit nie wchodzi w grę, w gęstej i szerokiej decyduje o wszystkim
    let krok=(deg-reka)*(1-Math.exp(-dt/b.tau));
    if(b.predkosc>0){const maks=b.predkosc*(zakres/40)*dt;krok=Math.max(-maks,Math.min(maks,krok));}
    g.pitch=reka+krok+b.drz;
    g.roll=0;
    g.twist=(c.idx!=null&&b.wibratoTu&&c.dlugosc>=2&&c.postep>=.5)?220:0;
    // oddech przed następną nutą (klik w rytm); krótką nutę w legato (następna zaczyna się tam, gdzie ta się
    // kończy) bot z poziomem przejeżdża z trzymanym przyciskiem, jak człowiek przesuwający suwak puzonu
    const krotka=c.dlugoscSek!=null&&c.dlugoscSek<ARTYKULACJA;
    const legato=b.legato&&krotka&&c.nastepnyZa!=null&&c.nastepnyZa-c.doKonca<.03;
    ustawPrzycisk(g,c.idx!=null&&!b.pominie&&(c.doKonca>(b.oddech!=null?b.oddech:.05)||legato));
  }

  // ---- żywe kapsle --------------------------------------------------------------------------
  const zywe={wlaczone:false,polaczony:false,zdarzen:0,url:""};
  let es=null;
  // Bit przycisku: ten sam, którego uczy się panel (rf-08 _btnBit), domyślnie bajt 1, bit 0.
  // localStorage jest per adres, więc pod /web/gry/ w aplikacji gra widzi bit nauczony w panelu.
  function bitPrzycisku(){
    let bb={byte:1,bit:0};
    try{const sv=localStorage.getItem("ribbitflip.btnbit");
      if(sv){const p=JSON.parse(sv);if(p&&p.byte>=1&&p.byte<=4&&p.bit>=0&&p.bit<=7)bb={byte:+p.byte,bit:+p.bit};}}catch(e){}
    return bb;
  }
  function obsluzZdarzenie(m){
    if(!m||typeof m!=="object"||!m.dev)return;
    const id="kapsel-"+m.dev;
    let g=zrodla.get(id);
    if(m.t==="devmeta"){
      const nowy=!g;
      if(!g)g=nowyGracz(id,{zrodlo:"kapsel",zywy:true});
      g.slot=Number.isFinite(+m.slot)?+m.slot:-1;
      g.nazwa=String(m.name||m.dev).slice(0,24);
      g.etykieta=String(m.label||"").slice(0,24);
      g.kolor=/^#[0-9a-f]{6}$/i.test(String(m.color||""))?m.color:"#6cb33f";
      const cap=String(m.cap||"");
      g.obrazekKapsla=kapsel(/^[1-9]$/.test(cap)?cap:String(Math.max(0,g.slot)%9+1));
      g.wyciszony=!!m.muted;g.pauza=!!m.paused;
      if(nowy){zrodla.set(id,g);emituj("nowe",g);}else emituj("zmiana",g);
      return;
    }
    if(!g)return;   // `s` i `b` nieznanego slotu: slot wprowadza tylko devmeta
    if(m.t==="devgone"){zrodla.delete(id);emituj("znika",g);return;}
    if(m.t==="s"){
      const p=m.pose||{};
      if(Number.isFinite(+p.pitch))g.pitch=+p.pitch;
      const t=performance.now();
      if(Number.isFinite(+p.roll)){   // bujanie na boki = wibrato (prędkość przechyłu, wygładzona)
        const dt=(t-(g._ostatnio||0))/1000;
        if(dt>0&&dt<.2&&g.roll!=null)g._rollV=.7*(g._rollV||0)+.3*Math.abs(+p.roll-g.roll)/dt;
        g.roll=+p.roll;
      }
      g.twist=Math.max(Number.isFinite(+p.twist)?Math.abs(+p.twist):0,(g._rollV||0)*WIB_KAPSEL);
      g._ostatnio=t;
      return;
    }
    if(m.t==="b"&&Array.isArray(m.bytes)){
      const bb=bitPrzycisku();
      ustawPrzycisk(g,((m.bytes[bb.byte]|0)>>bb.bit)&1);
    }
  }
  function wlaczZywe(url){
    if(es)return zywe;
    zywe.wlaczone=true;zywe.url=url||"/stream";
    try{es=new EventSource(zywe.url);}catch(e){zywe.blad=String(e);return zywe;}
    es.onopen=()=>{zywe.polaczony=true;};
    es.onerror=()=>{zywe.polaczony=false;};   // EventSource sam ponawia połączenie
    es.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch(_){return;}zywe.zdarzen++;obsluzZdarzenie(m);};
    return zywe;
  }

  // ---- krok i API ----------------------------------------------------------------------------
  function krok(dt,teraz){
    const m=zrodla.get("mysz");
    if(m){m.pitch=ogranicz((mysz.y-.5)*2*zakres,-zakres,zakres);
      if(teraz-(mysz.t||0)>120)mysz.vx=0;   // mysz stoi: koniec wibrata
      m.twist=(mysz.vx||0)*WIB_MYSZ;}
    for(const k in KLAWIATURA)krokKlawiatury(k,KLAWIATURA[k],dt);
    krokPadow((teraz||0)/1000);
    for(const g of zrodla.values()){
      if(g.zrodlo==="bot")krokBota(g,dt,teraz);
      else if(g.zrodlo==="kapsel")g.swiezy=(teraz-(g._ostatnio||-1e9))<1000;
    }
  }
  function init(opcje){
    const o=opcje||{};
    if(o.nazwy)nazwy=Object.assign({},nazwy,o.nazwy);
    if(Number.isFinite(+o.zakres))zakres=+o.zakres;
    if(Number.isFinite(+o.ziarno))losuj=mulberry32(+o.ziarno);
    podlaczMysz();podlaczKlawiature();
  }
  // Runda 3 (wybór gracza w kroku Rozgrywka): źródło klawiatury albo pada tworzone na żądanie, BEZ zdarzenia
  // „nowe” (gra sama dołącza gracza tam, gdzie trzeba, np. w miejsce innego). Pad tylko, gdy przeglądarka go widzi.
  function utworzKlawiature(klucz){
    const sch=KLAWIATURA[klucz];if(!sch)return null;
    let g=zrodla.get(klucz);
    if(!g){g=nowyGracz(klucz,{nazwa:nazwy[klucz],kolor:sch.kolor,obrazekKapsla:kapsel(sch.kapsel),zrodlo:klucz});g._kl={v:0};zrodla.set(klucz,g);}
    return g;
  }
  function pady(){
    const lista=typeof navigator!=="undefined"&&navigator&&typeof navigator.getGamepads==="function"?navigator.getGamepads():null;
    return [...(lista||[])].filter(p=>p&&p.connected!==false).map(p=>p.index);
  }
  function utworzPad(nr){
    const id="pad-"+nr;let g=zrodla.get(id);if(g)return g;
    const lista=typeof navigator!=="undefined"&&navigator&&typeof navigator.getGamepads==="function"?navigator.getGamepads():null;
    const p=lista&&[...lista].find(x=>x&&x.index===+nr&&x.connected!==false);if(!p)return null;
    const n=p.index%KOLORY_PADOW.length;
    g=nowyGracz(id,{nazwa:(nazwy.pad||"Pad")+" "+(p.index+1),kolor:KOLORY_PADOW[n],obrazekKapsla:kapsel(KAPSLE_PADOW[n]),
      zrodlo:"pad",etykieta:String(p.id||"").replace(/\s*\(.*$/,"").slice(0,24)});
    stanPadow.set(p.index,p.buttons.map(b=>!!b&&(b.pressed||(+b.value||0)>PAD.SPUST)));   // trzymany przycisk nie jest nowym klikiem
    zrodla.set(id,g);
    return g;
  }
  function usun(id){
    const g=zrodla.get(id);
    if(!g||g.zrodlo==="mysz")return;
    zrodla.delete(id);
    emituj("znika",g);
  }
  return {
    init,krok,dodajBota,ustawPoziomBota,usun,wlaczZywe,obsluzZdarzenie,POZIOMY_BOTOW,POZIOM_BOTA_DOMYSLNY,utworzKlawiature,utworzPad,pady,
    gracze:()=>[...zrodla.values()],
    gracz:id=>zrodla.get(id)||null,
    naZdarzenie:fn=>{sluchacze.push(fn);},
    ustawZakres:r=>{if(Number.isFinite(+r))zakres=+r;},
    ustawCelBotow:fn=>{celBotow=fn;},
    ustawSterowanieKlawiatury:o=>{sterKl=Object.assign({},o||{});},
    ustawMenu:(czy,akcja)=>{czyMenu=typeof czy==="function"?czy:()=>false;akcjaMenu=typeof akcja==="function"?akcja:()=>{};},
    stanZywych:()=>Object.assign({},zywe),
    KLAWIATURA};
})();
