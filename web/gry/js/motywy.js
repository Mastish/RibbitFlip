// RibbitBeat: motywy sceny (2026-10-09). Wymaganie: stopnie mają się od siebie wyraźnie różnić („nie pięć
// wariacji smoka”), tematycznie (Halloween, 8-bit itp.), a progresja ma być zabawą na popołudnie, nie na miesiące.
// Cel: 80 % motywów po ok. 40 piosenkach, całość po ok. 70 (progi PROGI w postepy.js).
// Dlatego cztery drabinki (widownia, streak, tło, klawisze) mają TĘ SAMĄ listę stopni: stopień = motyw, który
// przestawia naraz kartę toru (paleta i faktura), taśmy nut, klawiaturę, tło, widownię i efekt serii. Od 10-10 tło,
// widownia i klawisze to jeden motyw PLANSZY (wspólny, z puli ekipy w postepy.js), a gracz wybiera sobie tylko efekt
// serii (streak), więc na jednej planszy nie mieszają się klawisze z różnych motywów.
//
// Ładowany PO efekty-*.js i efekty-nuty.js (zabiera z nich gotowe stopnie, które pasują do motywu), PRZED plikami
// motywy/*.js (każdy woła Motywy.dodaj) i postepy.js. Drabinki modułów są podmieniane W MIEJSCU (te same tablice
// DRABINKA), więc gra i postępy czytają je jak dotąd. Kontrakt dla autorów motywów: motywy/README.md.
//
// Definicja motywu (Motywy.dodaj):
//   {id, nazwa, opis, kolor, kolejnosc,                          // kolejnosc = miejsce na drabince (1 = start)
//    cechy:{tlo, klawisze, streak, widownia}, opisy?:{…},          // sygnatura w 2–4 słowach i opis per tor (okno „Scena”)
//    en:{nazwa, opis, cechy, opisy?},                             // te same napisy po angielsku (gra w EN, js/jezyk.js);
//                                                                  // motyw kopiujący inny przez Object.assign MUSI podać własne en
//    karta?:{papier, cien, czarne, liniaC, minione, nazwy, kreski, nic, szpilka, szpilkaBlask, cienNuty, scieg, rysuj(c,L,st)},
//    tlo:      {z:"id starego stopnia tła"} | wpis tła (rysuj2d, nadKartami, przeswit, rama, scieg, tlo, rozgrzej, …),
//    klawisze: {z:"id"} | wpis klawiszy (tlo, gracz, fx, rozgrzej),
//    nuty?:    {z:"id stylu z efekty-nuty.js"} | styl nut (cialo, poza, brzeg, zapas, granice?, epoka?, znak?),
//    streak:   {z:"id stylu z efekty.js / efekty-streak.js"} | wpis streaka (glowa, slad, nuty, tor, …),
//    widownia: {z:"id"} | wpis widowni (rysuj, fx)}
// Pole `z` dziedziczy stopień w całości (z jego closurami i getterami), motyw nadpisuje tylko id, numer i nazwy.
const Motywy=(function(){
  "use strict";
  const TORY=["widownia","streak","tlo","klawisze"];
  const LISTA=[],MAPA=new Map();
  // Domyślna paleta karty toru: kraft i papier, jak przed motywami.
  const KARTA={papier:"#faf6ee",cien:"rgba(120,90,40,.13)",czarne:"rgba(33,31,29,.05)",liniaC:"rgba(33,31,29,.12)",
    minione:"rgba(216,205,184,.22)",nazwy:"rgba(87,80,63,.62)",kreski:"rgba(120,90,40,.24)",nic:"#ec1a83",
    szpilka:"#211f1d",szpilkaBlask:"#faf6ee",cienNuty:"rgba(120,90,40,.25)",scieg:null,rysuj:null};

  const modul=t=>t==="widownia"?(typeof EfektyWidownia!=="undefined"?EfektyWidownia:null)
    :t==="streak"?(typeof EfektyStreak!=="undefined"?EfektyStreak:null)
    :t==="tlo"?(typeof EfektyTlo!=="undefined"?EfektyTlo:null)
    :t==="klawisze"?(typeof EfektyKlawisze!=="undefined"?EfektyKlawisze:null):null;
  // Stare stopnie (drabinki 10-05) odłożone przy wczytaniu: motyw bierze z nich gotowe rysowanie po id.
  const STARE={};
  for(const t of TORY){const m=modul(t);STARE[t]=new Map();if(m&&Array.isArray(m.DRABINKA))for(const w of m.DRABINKA)if(w&&w.id)STARE[t].set(w.id,w);}
  // Kopia z deskryptorami (gettery jak `shader` tła zostają żywe), bez numeru stopnia.
  const kopia=o=>Object.defineProperties({},Object.getOwnPropertyDescriptors(o||{}));
  function bazowy(t,id){
    let w=STARE[t].get(id)||null;
    const kat=typeof Efekty!=="undefined"&&Efekty?(t==="widownia"?Efekty.widownia:t==="streak"?Efekty.streak:null):null;
    if(kat&&(!w||(t==="widownia"&&typeof w.rysuj!=="function")||(t==="streak"&&typeof w.glowa!=="function"))){
      const k=kat(id);if(k&&k.id===id)w=Object.assign({},k,w||{});
    }
    if(!w&&t==="tlo"&&id==="kraft")w={id:"kraft",prog:0,przeswit:0};
    if(!w&&t==="klawisze"&&id==="papier")w={id:"papier"};
    // Stary wpis na pełnej mocy: jego wewnętrzne mocStopnia(W) liczyło stopień / długość drabinki.
    if(w&&STARE[t].get(id))STARE[t].get(id).moc=1;
    return w;
  }
  // Napisy motywu w języku gry (js/jezyk.js): w wersji angielskiej pola z M.en = {nazwa, opis, cechy, opisy}
  // zastępują polskie; brakujące pole zostaje po polsku. `id` się nie zmienia (zapis postępów i grafiki).
  function lokalnie(M){
    const en=typeof RBJezyk!=="undefined"&&RBJezyk.en&&M.en&&typeof M.en==="object"?M.en:null;
    if(!en)return M;
    return {nazwa:en.nazwa||M.nazwa,opis:en.opis||M.opis,cechy:en.cechy||M.cechy,opisy:en.opisy||M.opisy};
  }
  function wpis(M,t,i){
    const cz=M[t]||{},baza=cz.z?bazowy(t,cz.z):null;
    if(cz.z&&!baza)console.error("RibbitBeat: motyw „"+M.id+"” bierze nieznany stopień "+t+" „"+cz.z+"”");
    const w=baza?kopia(baza):kopia(cz);
    if(baza)for(const [k,d] of Object.entries(Object.getOwnPropertyDescriptors(cz)))if(k!=="z")Object.defineProperty(w,k,d);
    const L=lokalnie(M);
    w.stopien=i+1;w.id=M.id;w.nazwa=L.nazwa;w.motyw=M.id;w.moc=1;w.prestiz=Math.min(5,i);
    w.cecha=(L.cechy&&L.cechy[t])||w.cecha||"";w.opis=(L.opisy&&L.opisy[t])||L.opis||w.opis||"";
    w.kolorMotywu=M.kolor||"#ec1a83";
    if(t==="tlo"){w.karta=Object.assign({},KARTA,M.karta||{});delete w.prog;}
    return w;
  }
  function przebuduj(){
    LISTA.sort((a,b)=>a.kolejnosc-b.kolejnosc);
    for(const t of TORY){
      const m=modul(t);if(!m||!Array.isArray(m.DRABINKA))continue;
      const nowe=LISTA.map((M,i)=>wpis(M,t,i));
      m.DRABINKA.length=0;m.DRABINKA.push(...nowe);
    }
    // katalog Efekty: widownia i streak motywu dostępne po id (miniatury, podgląd, pelnyWpis)
    try{
      if(typeof Efekty!=="undefined"&&Efekty){
        const w=modul("widownia"),s=modul("streak");
        if(w&&Efekty.zarejestrujWidownie)Efekty.zarejestrujWidownie(w.DRABINKA.filter(x=>typeof x.rysuj==="function"&&!STARE.widownia.has(x.id)));
        if(s&&Efekty.zarejestrujStreaki)Efekty.zarejestrujStreaki(s.DRABINKA.filter(x=>typeof x.glowa==="function"&&!STARE.streak.has(x.id)));
      }
    }catch(e){console.error("RibbitBeat: rejestracja motywów w katalogu",e);}
  }
  function dodaj(M){
    if(!M||!M.id){console.error("RibbitBeat: motyw bez id",M);return false;}
    const i=LISTA.findIndex(x=>x.id===M.id);
    if(i>=0)LISTA[i]=M;else LISTA.push(M);
    MAPA.set(M.id,M);
    if(!(+M.kolejnosc>0))M.kolejnosc=LISTA.length;
    przebuduj();
    return true;
  }

  // Style nut: EfektyNuty.dla(idKlawiszy) najpierw pyta motyw (id klawiszy = id motywu), potem stare style.
  const NUTY=new Map();
  function stylNut(id){
    const M=MAPA.get(id);if(!M)return undefined;
    if(!M.nuty)return null;
    if(NUTY.has(id))return NUTY.get(id);
    let s=null;
    if(M.nuty.z)s=typeof EfektyNuty!=="undefined"&&EfektyNuty&&EfektyNuty.dlaStare?EfektyNuty.dlaStare(M.nuty.z):null;
    else s=Object.assign({id:"nuty-"+M.id,granice:()=>[],epoka:()=>0,brzeg:()=>null,zapas:()=>0},M.nuty);
    NUTY.set(id,s);return s;
  }
  if(typeof EfektyNuty!=="undefined"&&EfektyNuty&&!EfektyNuty.dlaStare){
    EfektyNuty.dlaStare=EfektyNuty.dla;
    EfektyNuty.dla=id=>{const s=stylNut(id);return s===undefined?EfektyNuty.dlaStare(id):s;};
  }

  // Grafiki motywów (2026-10-09): ilustracje wygenerowane
  // z logo jako wzorem leżą w web/assets/motywy/<id>/ (tlo.webp, zaba-0.webp zamknięta buzia, zaba-1.webp śpiew,
  // fan-0..5.webp widownia, iskra-0..5.webp drobiazgi streaka). `obraz` zwraca obrazek dopiero, gdy jest gotowy
  // (inaczej null: rysuj zastępczo albo nic), a po wczytaniu woła słuchaczy `poWczytaniu` (gra składa wtedy tło
  // i czyści bufory). `wczytaj(id)` ładuje z góry całą listę `zasoby` motywu (gra woła przy przypisaniu stylów).
  const OBRAZY=new Map(),SLUCHACZE=[];
  const gotowy=im=>!!im&&im.complete&&im.naturalWidth>0;
  // Duże grafiki (tło motywu 1920×1081): przeglądarka dekodowała je w wątku głównym przy pierwszym drawImage w nowej skali,
  // mimo decoding="async" (ślad 10-10: GpuImageDecodeCache::DecodeImage 22–28 ms w klatce startu piosenki, drugi raz po lobby).
  // Po wczytaniu robimy z nich ImageBitmap w tle, a cover() rysuje bitmapę zamiast <img>; małe grafiki zostają obrazkami.
  const BITMAPY=new Map();
  function dekoduj(im){
    if(typeof createImageBitmap!=="function"||!gotowy(im)||im.naturalWidth*im.naturalHeight<400000)return;
    createImageBitmap(im).then(bm=>BITMAPY.set(im,bm)).catch(()=>{});
  }
  function obraz(src){
    if(typeof Image==="undefined")return null;   // testy w Node: bez DOM grafik nie ma
    let im=OBRAZY.get(src);
    if(!im){
      im=new Image();im.decoding="async";
      im.onload=()=>{dekoduj(im);for(const f of SLUCHACZE)try{f(src);}catch(e){console.error("RibbitBeat: słuchacz grafiki motywu",e);}};
      im.onerror=()=>console.warn("RibbitBeat: brak grafiki motywu "+src);
      im.src=src;OBRAZY.set(src,im);
    }
    return gotowy(im)?im:null;
  }
  // Druga wersja grafik (dodatkowa wersja, nie zamiennik): pierwsze 10 motywów ma w <id>/v2/ grafiki
  // w stylu naszywek z ikon RibbitFlip. Ustawienie gry „Styl grafik” (S.ust.stylGrafik) przełącza
  // wszystkie naraz; pliku, którego v2 nie ma (np. faktura.webp), szukamy w wersji pierwszej.
  const Z_V2=new Set(["filc","8bit","halloween","komiks","podwodny","koncert","synthwave","szkicownik","kosmos","staw"]);
  const PLIKI_V2=new Set(["tlo.webp","zaba-0.webp","zaba-1.webp","fan-0.webp","fan-1.webp","fan-2.webp","fan-3.webp","fan-4.webp","fan-5.webp",
    "iskra-0.webp","iskra-1.webp","iskra-2.webp","iskra-3.webp","iskra-4.webp","iskra-5.webp"]);
  let WERSJA="ilustracja";
  const ustawWersje=w=>{WERSJA=w==="naszywka"?"naszywka":"ilustracja";};
  const wersja=()=>WERSJA;
  // Robo-żaba botów (boty mają własny skin robo-żaby): cztery przebrania poza
  // motywami i progresją, po jednym na poziom bota (robo-latwy … robo-mistrz), w assets/frog/robo/<poziom>/glowa-*.webp.
  const ROBO=new Set(["robo-latwy","robo-sredni","robo-trudny","robo-mistrz"]);
  const sciezka=(id,plik)=>ROBO.has(id)?"../assets/frog/robo/"+id.slice(5)+"/"+plik
    :"../assets/motywy/"+id+"/"+(WERSJA==="naszywka"&&Z_V2.has(id)&&PLIKI_V2.has(plik)?"v2/":"")+plik;
  const zasob=(id,plik)=>obraz(sciezka(id,plik));
  function wczytaj(id){
    if(ROBO.has(id)){for(const f of PRZEBRANIE.PLIKI)obraz(sciezka(id,f));return;}
    const M=MAPA.get(id);if(!M)return;
    if(Array.isArray(M.zasoby))for(const f of M.zasoby)obraz(sciezka(id,f));
    if(M.przebranie)for(const f of PRZEBRANIE.PLIKI)obraz(sciezka(id,f));
  }
  const poWczytaniu=f=>{SLUCHACZE.push(f);};
  // Obrazek „cover” na prostokąt (x,y,w,h): wypełnia całość, nadmiar przycina symetrycznie (ax, ay = punkt zaczepienia).
  function cover(c,im,x,y,w,h,ax,ay){
    if(!im)return false;
    const iw=im.naturalWidth,ih=im.naturalHeight,sk=Math.max(w/iw,h/ih),sw=w/sk,sh=h/sk;
    const sx=(iw-sw)*(ax==null?.5:ax),sy=(ih-sh)*(ay==null?.5:ay);
    c.drawImage(BITMAPY.get(im)||im,sx,sy,sw,sh,x,y,w,h);return true;   // bitmapa zdekodowana w tle (dekoduj), gdy już jest
  }
  // Żaba gracza w motywie: [zamknięta, śpiewa] albo null, gdy motyw nie ma własnej albo jeszcze się wczytuje.
  function zaby(id){
    const M=MAPA.get(id);if(!M||!M.zaba)return null;
    const a=zasob(id,"zaba-0.webp"),b=zasob(id,"zaba-1.webp");return a&&b?[a,b]:null;
  }
  // Przebranie żaby (zamiast ozdobników wokół głowy zmienia się wygląd samej żaby, także gdy
  // śpiewa): motyw z `przebranie:true` ma w <id>/ sześć klatek głowy żaby z logo w kostiumie (hełm astronauty, mumia…):
  // glowa-c.webp (cicha, plaster na pysku) i glowa-0..4.webp (pysk jak sing-0..4-96.png). Klatka 160 × 160 px to pole
  // PRZEBRANIE.POLE jednostek sprite'a żaby (96 × 96) o środku w (48, 48), więc głowa stoi tam, gdzie żaba z logo, a hełm
  // czy kapelusz mają miejsce dookoła. Zwraca [cicha, 0, 1, 2, 3, 4] albo null (motyw bez przebrania albo jeszcze się wczytuje).
  const PRZEBRANIE={POLE:144,PLIKI:["glowa-c.webp","glowa-0.webp","glowa-1.webp","glowa-2.webp","glowa-3.webp","glowa-4.webp"]};
  function przebranie(id){
    const M=MAPA.get(id);if(!ROBO.has(id)&&(!M||!M.przebranie))return null;
    const k=PRZEBRANIE.PLIKI.map(f=>zasob(id,f));return k.every(Boolean)?k:null;
  }
  const maPrzebranie=id=>{if(ROBO.has(id))return true;const M=MAPA.get(id);return !!(M&&M.przebranie);};

  // Ruch widowni (każdy motyw ma własny styl animacji widowni, zależny od tła i tematyki,
  // np. wyspa tiki: chillowe bujanie, 8bit: kwadratowa animacja poklatkowa). fan(c, b, x, dol, st, styl, i)
  // rysuje bufor fana `b` ({cv,w,h}) stojącego stopami na `dol`, środkiem w `x`, ruchem stylu `styl` w rytm st.faza
  // (ćwierćnuty). W spokoju, przy ograniczonym ruchu i w miniaturze stoi. Tylko transformacja i jedno drawImage, bez
  // stanu i bez alokacji (wynik w jednym obiekcie wielokrotnego użytku).
  const RF={dx:0,dy:0,kat:0,sx:1,sy:1};
  const ul1=v=>v-Math.floor(v),PI1=Math.PI;
  const mieszaj=(a,b)=>{const x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x);};
  function ruchFana(st,styl,i,h){
    RF.dx=0;RF.dy=0;RF.kat=0;RF.sx=1;RF.sy=1;
    if(!st||st.spokoj||st.bezRuchu||st.mini)return RF;
    const zywe=st.spiewaja||(st.zar||0)>.05||(st.ap||0)>.12;
    const e=zywe?.6+.25*Math.min(1,st.skok||0)+.05*Math.min(3,st.zar||0)+.3*Math.min(1,(st.ap||0)*2):.2;   // energia 0,2–1,3
    // uderz: impuls na każdą ćwierćnutę. Żeby widownia nie ruszała się za jednostajnie (zwłaszcza
    // w motywie koncert), każdy fan spóźnia się o własny
    // ułamek ćwierćnuty (do 0,2), ma własną siłę ruchu (amp 0,7–1,3) i lekkie, wolne kołysanie niezależne od rytmu.
    const f=+st.faza||0,fi=mieszaj(i,7),p=ul1(f+fi*.5),uderz=Math.pow(1-ul1(f-fi*.2),3);
    switch(styl){
      case "poklatkowo":{   // 8-bit: dwie klatki na ćwierćnutę, skok o stały krok po siatce, lustro co dwa takty (jak sprite)
        const k=Math.floor(f*2)+(i%2);RF.dy=(k%2)*Math.max(2,Math.round(h*.07*e/2)*2);
        if(zywe&&(Math.floor(f/2)+i)%4===3)RF.sx=-1;break;}
      case "bujanie":{   // wyspa tiki: wolne bujanie na boki jak w hula, bez podskoków
        const a=Math.sin(PI1*(f/2+fi*.6));RF.kat=a*.08*(zywe?1:.6);RF.dx=a*h*.05;break;}
      case "fala":{   // pod wodą: unoszenie się falą wzdłuż rzędu
        const a=Math.sin(PI1*(f/2)-i*.7);RF.dy=(a*.5+.5)*h*.07*e;RF.kat=Math.cos(PI1*(f/2)-i*.7)*.04;break;}
      case "poklad":{   // piraci: cały rząd kołysze się jak pokład, każdy podskakuje lekko
        RF.kat=Math.sin(PI1*f/2)*.07;RF.dy=Math.abs(Math.sin(PI1*(f+fi)))*h*.04*e;break;}
      case "headbang":{   // koncert, garaż, skatepark: kiwnięcie głową i podskok na każdą ćwierćnutę
        RF.kat=-uderz*.16*e;RF.dy=uderz*h*.06*e;break;}
      case "upior":{   // halloween: powolne unoszenie się jak duch, z lekkim chybotaniem
        RF.dy=(Math.sin(PI1*(f/4+fi*2))*.5+.5)*h*.08*e;RF.kat=Math.sin(PI1*(f/2+fi*3))*.05;break;}
      case "disco":{   // disco: palec w górę raz w lewo, raz w prawo, na każdą ćwierćnutę
        const s=Math.floor(f+fi)%2?1:-1,w=1-Math.pow(1-Math.min(1,ul1(f+fi)*4),2);RF.kat=s*.11*w*e;RF.dx=s*h*.03*w*e;RF.dy=uderz*h*.03*e;break;}
      case "tupanie":{   // western: krok w bok co dwa takty (taniec w rzędzie) i przysiad przy tupnięciu
        const t=Math.floor(f/2)%2?1:-1;RF.dx=t*h*.04*e;RF.dy=Math.abs(Math.sin(PI1*f))*h*.05*e;RF.sy=1-uderz*.07*e;RF.sx=1+uderz*.04*e;break;}
      case "akrobata":{   // cyrk: wysokie odbicie z rozciąganiem w locie i spłaszczeniem przy lądowaniu
        const a=Math.abs(Math.sin(PI1*(f+fi)));RF.dy=a*h*.11*e;RF.sy=1+.07*a*e-.1*Math.pow(1-a,6)*e;RF.sx=1/RF.sy;break;}
      case "niewazkosc":{   // kosmos: powolne dryfowanie i obracanie się bez grawitacji
        RF.dy=(Math.sin(PI1*(f/4+fi*2))*.5+.5)*h*.08*e;RF.kat=Math.sin(PI1*(f/8+fi*3))*.12;break;}
      case "zabi":{   // staw: żabi skok łukiem co dwa takty, z przechyłem w locie
        const q=ul1((f+fi*2)/2),a=q<.5?Math.sin(PI1*q*2):0;RF.dy=a*h*.12*e;RF.kat=-a*.08*Math.cos(PI1*q*2);break;}
      case "groove":{   // synthwave: płynny ruch biodrami na boki
        const a=Math.sin(PI1*(f/2+fi*.4));RF.dx=a*h*.05*e;RF.kat=a*.05;RF.dy=uderz*h*.025*e;break;}
      case "pop":{   // komiks: poza trzymana i nagły „pop” na uderzeniu (skok z powiększeniem)
        const w=p<.18?1:0;RF.dy=w*h*.08*e;RF.sx=RF.sy=1+w*.06*e;break;}
      case "szkic":{   // szkicownik: drżąca kreska animacji rysunkowej, 6 klatek na sekundę
        const k=Math.floor((st.teraz||0)/166);RF.dx=(mieszaj(k,i)-.5)*3;RF.dy=Math.abs(Math.sin(PI1*(f+fi)))*h*.04*e+mieszaj(i,k)*2;RF.kat=(mieszaj(k+3,i)-.5)*.05;break;}
      case "obrot":{   // wycinanka: trzy podskoki i obrót jak w tańcu ludowym (lustro przez ściśnięcie w poziomie)
        const q=ul1((f+i%2)/4);RF.dy=Math.abs(Math.sin(PI1*f))*h*.06*e;if(zywe&&q>.75){const c=Math.cos(PI1*2*(q-.75)*4);RF.sx=Math.abs(c)<.25?(c<0?-.25:.25):c;}break;}
      case "koleda":{   // sweter: kołysanie jak przy kolędzie (pół taktu w jedną stronę) i lekki podskok
        RF.kat=Math.sin(PI1*f/2)*.06;RF.dx=Math.sin(PI1*f/2)*h*.03;RF.dy=Math.abs(Math.sin(PI1*(f+fi)))*h*.03*e;break;}
      case "uklon":{   // sashiko: spokojne kołysanie i ukłon na pierwszą ćwierćnutę taktu
        const q=ul1(f/4);RF.kat=q<.25?Math.sin(PI1*q*4)*.14*e:0;RF.dy=Math.abs(Math.sin(PI1*(f+fi)))*h*.025*e;break;}
      case "podrzut":{   // sushi (10-18): podskok jak podrzucone przez mistrza, przechył raz w lewo, raz w prawo, miękkie spłaszczenie
        // ryżu przy lądowaniu; co dwa takty szybki obrót w miejscu (pół ćwierćnuty, lustro przez ściśnięcie w poziomie),
        // każdy w innym beacie, więc naraz kręci się najwyżej co szesnasty
        const a=Math.abs(Math.sin(PI1*(f+fi)));RF.dy=a*h*.08*e;RF.sy=1+.05*a*e-.12*Math.pow(1-a,8)*e;RF.sx=1/RF.sy;RF.kat=Math.sin(PI1*(f+fi))*.07*e;
        const q=ul1((f+(i*3)%8)/8);if(zywe&&q>.9375){const c=Math.cos(PI1*2*(q-.9375)*16);RF.sx*=Math.abs(c)<.25?(c<0?-.25:.25):c;}break;}
      default:   // skok: zwykłe podskoki w rytm
        RF.dy=Math.abs(Math.sin(PI1*(f+fi*.5)))*h*.07*e;
    }
    // przesunięcie per fan (bez 8-bit i szkicu, które mają celowo „sztuczny” ruch): siła i wolne kołysanie
    if(styl!=="poklatkowo"&&styl!=="szkic"){
      const amp=.7+.6*mieszaj(i,3),fs=mieszaj(i,11);
      RF.dx=RF.dx*amp+Math.sin(PI1*(f*(.23+.1*fs)+fs*6))*h*.014;
      RF.dy*=amp;
      RF.kat=RF.kat*amp+Math.sin(PI1*(f*(.31+.12*fs)+fs*9))*.025;
    }
    return RF;
  }
  function fan(c,b,x,dol,st,styl,i){
    if(!b)return;
    const r=ruchFana(st,styl,i,b.h);
    if(styl==="poklatkowo"){x=Math.round(x/2)*2;dol=Math.round(dol);}
    if(!r.kat&&r.sx===1&&r.sy===1){c.drawImage(b.cv,x+r.dx-b.w/2,dol-r.dy-b.h,b.w,b.h);return;}
    c.save();c.translate(x+r.dx,dol-r.dy);if(r.kat)c.rotate(r.kat);if(r.sx!==1||r.sy!==1)c.scale(r.sx,r.sy);
    c.drawImage(b.cv,-b.w/2,-b.h,b.w,b.h);c.restore();
  }

  // Liczba fanów w rzędzie (żeby fani nie stali za rzadko): z realnej szerokości
  // wczytanych sprite'ów fan-*.webp motywu (średni stosunek szerokości do wysokości), żeby stali ramię w ramię na każdej
  // szerokości ekranu; dawny sztywny limit 18 zostawiał na szerokich ekranach dziury. `x` = dawny ułamek wysokości
  // (zapas, gdy grafiki jeszcze się wczytują). Odstęp 8 % szerokości sprite'a, 3–48 fanów.
  function ileFanow(id,W,fh,x){
    let suma=0,ile=0;
    for(let i=0;i<12;i++){const im=OBRAZY.get(sciezka(id,"fan-"+i+".webp"));if(gotowy(im)){suma+=im.naturalWidth/im.naturalHeight;ile++;}}
    const asp=ile?suma/ile*1.08:(x||.95);
    return Math.max(3,Math.min(48,Math.floor(W/(fh*asp))));
  }
  // Zasłona stóp (zakrywa ucięte doły sprite'ów): ciemny pas ziemi na dole pasa widowni, rysowany PO
  // fanach przez grę (rysujWidownie), więc ucięte sprite'y i stopy poniżej krawędzi giną w cieniu; gradient z pamięci.
  const ZASLONY=new Map();
  function zaslonaStop(c,Wd,st){
    const W=Math.round(st.W),h=Math.round(Wd.h);if(!(W>0&&h>4))return;
    const hz=Math.max(6,Math.round(h*.16)),y=Wd.y+h-hz,kl=W+"x"+hz;
    let g=ZASLONY.get(kl);
    if(!g){g=c.createLinearGradient(0,y,0,y+hz);g.addColorStop(0,"rgba(12,10,8,0)");g.addColorStop(.55,"rgba(12,10,8,.42)");g.addColorStop(1,"rgba(12,10,8,.7)");if(ZASLONY.size>8)ZASLONY.clear();ZASLONY.set(kl,g);}
    c.fillStyle=g;c.fillRect(0,y,W,hz+2);
  }

  const lista=()=>LISTA.slice();
  const motyw=id=>MAPA.get(id)||null;
  const karta=w=>(w&&w.karta)||KARTA;
  return {KARTA,TORY,dodaj,lista,motyw,karta,stylNut,stary:bazowy,obraz,zasob,sciezka,wczytaj,poWczytaniu,cover,zaby,przebranie,maPrzebranie,PRZEBRANIE,fan,ruchFana,ileFanow,zaslonaStop,ustawWersje,wersja};
})();
