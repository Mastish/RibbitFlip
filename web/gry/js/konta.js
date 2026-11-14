"use strict";
// ===== RIBBITBEAT: konto na tym komputerze („Grasz jako…”, 2026-10-10) =====
// Konta użytkowników z pełnym przepływem i konfiguracją; celowo LOKALNE (bez serwera
// i haseł). Konto = profil z postepy.js (ten sam model co okno „Profile” w js/profile.js, żeby nie było dwóch systemów):
// tu dochodzi tylko „kto gra w tej sesji” i ustawienia, które idą za osobą.
//
// Przepływ:
//  1. Pierwsze uruchomienie (brak zapisu konta) albo „Pytaj przy starcie”: okno „Kto gra na tym komputerze?” z kaflami
//     profili, formularzem „Nowe konto” (nazwa + ulubiony kolor) i „Graj jako gość”. Automat (navigator.webdriver) okna
//     sam nie dostaje, żeby smoke'i innych sesji widziały menu; ?konto=1 wymusza je, ?konto=0 chowa.
//  2. Plakietka #menuKonto w prawym górnym rogu menu („Grasz jako Oczko”, kolor profilu) to JEDYNE wejście do kont
//     i profili w menu: otwiera okno „Konto” (zmiana konta, nowe konto, gość, „Pytaj przy starcie”, „Zarządzaj
//     profilami” → ZC.profile.otworz()).
//  3. Przełączenie konta: ustawienia poprzedniego zapisują się do jego profilu (Postepy.zapiszUstawienia), nowego
//     wchodzą do S.ust przez ustaw() gry (te same skutki uboczne co klik w lobby), gracz grający jako poprzednie konto
//     (albo pierwszy człowiek bez nazwy) przechodzi na nowe, a inny język konta przeładowuje grę w tym języku.
//     Nowe konto bez zapisanych ustawień dziedziczy bieżące.
//  4. Na bieżąco: każdy zapis ustawień gry (zapiszUstawienia, owinięte) i zmiana języka (zdarzenie „rb-jezyk”)
//     trafiają też do profilu aktywnego konta. Przy starcie gra wczytuje ustawienia aktywnego konta (owinięte
//     wczytajUstawienia, dlatego ten plik ładuje się PRZED skryptem startowym z ZC.init).
//  5. Nowy gracz w składzie (mysz, klawiatura, pad, kapsel bez zapamiętanego profilu) dostaje nazwę i kolor aktywnego
//     konta, jeśli nikt w składzie jeszcze nim nie gra (owinięte dolacz; odtwarzanie składu z zapisu ma pierwszeństwo).
//  6. Zmiana nazwy i usunięcie profilu w oknie „Profile” idą za aktywnym kontem (owinięte Postepy.zmienNazwe/usun);
//     zniknięcie profilu w inny sposób (import „Zastąp”) cofa konto do gościa przy następnym odświeżeniu plakietki.
//
// Awatar konta (żaby inne niż te dostępne do śpiewania):
// żabia gęba przy nazwie konta: na kaflu w oknie, na plakietce w menu i w oknie „Profile”. Rysunki i domyślny awatar
// są w js/awatary.js (osobny zestaw, żadnego skina ze koła), a wybrane id leży w profilu konta (Postepy.awatar), więc
// idzie za kontem razem z nazwą i kolorem (ten sam zapis, eksport i import). Konto założone przed tą zmianą nie ma pola
// `awatar`: dostaje żabę policzoną z klucza profilu, zawsze tę samą, więc nikt nie widzi pustego kwadratu.
//
// Za kontem idą ustawienia osoby (KLUCZE_KONTA + język). Ustawienia sprzętu i pokoju (opóźnienie kapsli, kąt, grafika,
// klatki, głośności, dźwięki menu) zostają wspólne dla komputera, bo zależą od sprzętu, nie od tego, kto gra.
// Zapis: localStorage["ribbitflip.zabiChor.konto"] = {wersja:1, aktywny:"nazwa"|null (null = gość), pytaj:bool}.
// API: window.ZC.konto = {aktywny(), przelacz(nazwa|null), otworz(tryb?), zamknij(), otwarte, KLUCZE}.
const ZCKonto=(function(){
  const KLUCZ="ribbitflip.zabiChor.konto",WERSJA=1;
  const KLUCZE_KONTA=["uklad","tory","tryb","czasNaRuch","glos","spiewaSama","tempo","przyciaganie","pokazJak","odwroc",
    "instrument","silnikMidi","podpowiedz","stylGrafik","poziomBota","sortowanie","klawDoNuty"];   // 10-18: „Skok do nuty” to pomoc osoby, tempo klawiatury zostaje przy sprzęcie
  // 10-18 wieczór: pomoce z karty gracza (pomocPrzyciaganie, pomocSpiewaSama, pomocKlawDoNuty) leżą w tym samym `ust` profilu,
  // ale to nie ustawienia konta: czyta je i zapisuje gra (zabi-chor.js synchronizujPomoce), a lustro scala zapis, więc ich nie rusza.
  const L=(pl,en)=>typeof RBJezyk!=="undefined"?RBJezyk.wybierz(pl,en):pl;
  const TX={
    grasz:L("Grasz jako","Playing as"),gosc:L("Gość","Guest"),
    plakietkaAria:L("Konto: {nazwa}. Zmień konto albo zarządzaj profilami","Account: {nazwa}. Switch account or manage profiles"),
    tytulStart:L("Kto gra na tym komputerze?","Who's playing on this computer?"),
    wstepStart:L("Wybierz swoje konto albo załóż nowe. Konto pamięta sławę, skiny i Twoje ustawienia gry.",
      "Pick your account or create a new one. It remembers your fame, skins and game settings."),
    tytulKonto:L("Konto","Account"),
    wstepKonto:L("Przełącz konto, a gra wczyta jego ustawienia. Ustawienia sprzętu (opóźnienie, grafika, głośność) są wspólne dla komputera.",
      "Switch account and the game loads its settings. Hardware settings (latency, graphics, volume) are shared by this computer."),
    teraz:L("teraz","now"),nowe:L("Nowe konto","New account"),jakoGosc:L("Graj jako gość","Play as guest"),
    goscOpis:L("bez nazwy, postępy trafiają do wspólnego profilu Gość","no name, progress goes to the shared Guest profile"),
    zarzadzaj:L("Zarządzaj profilami","Manage profiles"),osiag:L("Skin","Skin"),
    pytaj:L("Pytaj, kto gra, przy każdym uruchomieniu","Ask who's playing every time the game starts"),
    nazwaEt:L("Nazwa konta (najwyżej 18 znaków)","Account name (up to 18 characters)"),kolorEt:L("Ulubiony kolor","Favourite colour"),
    utworz:L("Załóż konto","Create account"),anuluj:L("Anuluj","Cancel"),
    witaj:L("Grasz jako {nazwa}","Playing as {nazwa}"),
    zostaw:L("Zostaw","Keep"),
    zamknij:L("Zamknij","Close")};
  const tx=(k,z)=>{let s=TX[k]||k;if(z)for(const n in z)s=s.split("{"+n+"}").join(String(z[n]));return s;};
  const V={el:null,tytul:null,cialo:null,tryb:"konto",powrot:null};
  const czyGosc=n=>!n||Postepy.kluczProfilu(n)===Postepy.kluczProfilu(Postepy.GOSC);
  // ---- awatar konta (js/awatary.js; bez modułu okno wygląda jak przed 10-19: litera w kółku) ----
  const maAwatary=()=>typeof Awatary!=="undefined";
  const awatarKlucza=(klucz,id)=>Awatary.dla(klucz,id);
  const awatarNazwy=n=>{try{return awatarKlucza(Postepy.kluczProfilu(n),Postepy.awatar(n));}catch(e){return Awatary.ID[0];}};
  const wstawAwatar=(gdzie,id,klasa)=>gdzie.insertAdjacentHTML("afterbegin",Awatary.obraz(id,{klasa:"awatar "+klasa}));

  // ---- zapis konta ----
  function czytaj(){try{const z=JSON.parse(localStorage.getItem(KLUCZ)||"null");return z&&z.wersja===WERSJA?z:null;}catch(e){return null;}}
  function zapisz(z){try{localStorage.setItem(KLUCZ,JSON.stringify(Object.assign({wersja:WERSJA},z)));}catch(e){}}
  let stan=czytaj();
  function aktywny(){
    const n=stan&&stan.aktywny;if(czyGosc(n))return null;
    try{if(!Postepy.lista().some(x=>x.klucz===Postepy.kluczProfilu(n))){stan.aktywny=null;zapisz(stan);return null;}}catch(e){}
    return n;
  }
  const nazwaAktywnego=()=>aktywny()||Postepy.GOSC;
  const pokazNazwe=n=>czyGosc(n)?TX.gosc:n;

  // ---- ustawienia za kontem ----
  function wybraneUstawienia(){
    const u={};for(const k of KLUCZE_KONTA)if(k in S.ust)u[k]=S.ust[k];
    if(typeof RBJezyk!=="undefined")u.jezyk=RBJezyk.jezyk;
    return u;
  }
  let lustroCzas=0,wstrzymaj=false;
  function lustroTeraz(){clearTimeout(lustroCzas);lustroCzas=0;if(wstrzymaj)return;try{Postepy.zapiszUstawienia(nazwaAktywnego(),wybraneUstawienia());}catch(e){}}
  const lustro=()=>{if(wstrzymaj)return;clearTimeout(lustroCzas);lustroCzas=setTimeout(lustroTeraz,250);};
  // ustawienia profilu → S.ust (tylko znane klucze tego samego typu, jak wczytajUstawienia gry)
  function doStanu(u,przezUstaw){
    const zmiany=[];
    if(typeof migrujPomoce==="function")u=migrujPomoce(Object.assign({},u));   // 10-18: konto zapisane przed poziomami przyciągania
    for(const k of KLUCZE_KONTA){
      if(!(k in u)||!(k in S.ust)||typeof u[k]!==typeof S.ust[k]||u[k]===S.ust[k])continue;
      zmiany.push(k);
      if(przezUstaw&&typeof ustaw==="function")try{ustaw(k,u[k]);}catch(e){S.ust[k]=u[k];}
      else S.ust[k]=u[k];
    }
    return zmiany;
  }

  // ---- przełączenie konta ----
  function przelacz(nazwa,o){
    o=o||{};
    const stara=nazwaAktywnego(),nowa=czyGosc(nazwa)?Postepy.GOSC:Postepy.profil(nazwa).nazwa;
    lustroTeraz();   // poprzednie konto zabiera swoje ustawienia
    stan=Object.assign({},stan||{pytaj:false},{aktywny:czyGosc(nowa)?null:nowa});
    if(o.pytaj!=null)stan.pytaj=!!o.pytaj;
    zapisz(stan);
    const u=Postepy.ustawienia(nowa);
    wstrzymaj=true;
    try{
      if(Object.keys(u).length){doStanu(u,true);if(typeof zapiszUstawienia==="function")zapiszUstawienia();if(typeof odswiezUstawienia==="function")odswiezUstawienia();}
    }finally{wstrzymaj=false;}
    lustroTeraz();   // nowe konto bez ustawień dziedziczy bieżące; z ustawieniami: zapis bez zmian
    przepiszGraczy(stara,nowa);
    odswiezPlakietke();
    const j=u.jezyk;
    if(typeof RBJezyk!=="undefined"&&(j==="pl"||j==="en")&&j!==RBJezyk.jezyk){RBJezyk.ustaw(j);return nowa;}   // przeładowanie
    if(!o.cicho&&typeof toast==="function")toast(tx("witaj",{nazwa:pokazNazwe(nowa)}));
    return nowa;
  }
  // Gracze grający jako poprzednie konto przechodzą na nowe; bez takich pierwszy człowiek bez własnej nazwy.
  function przepiszGraczy(stara,nowa){
    if(typeof S==="undefined"||!Array.isArray(S.gracze)||!window.ZC||!ZC.profile)return;
    const ludzie=S.gracze.filter(g=>g.zrodlo!=="bot");
    const kS=Postepy.kluczProfilu(stara),kN=Postepy.kluczProfilu(nowa);
    if(ludzie.some(g=>Postepy.kluczProfilu(Postepy.nazwaProfilu(g)||Postepy.GOSC)===kN))return;
    let cel=czyGosc(stara)?null:ludzie.find(g=>g.zrodlo!=="kapsel"&&Postepy.kluczProfilu(Postepy.nazwaProfilu(g)||Postepy.GOSC)===kS);
    if(!cel&&!czyGosc(nowa))cel=ludzie.find(g=>!g.nazwaWlasna);
    if(cel)try{ZC.profile.przypisz(cel.id,czyGosc(nowa)?null:nowa);}catch(e){}
  }

  // ---- plakietka w menu ----
  function odswiezPlakietke(){
    const b=document.getElementById("menuKonto");if(!b)return;
    const n=aktywny(),k=n?Postepy.kolor(n):null;
    b.querySelector(".menu-konto-et").textContent=TX.grasz;
    b.querySelector(".menu-konto-nazwa").textContent=pokazNazwe(n);
    const kolko=b.querySelector(".menu-konto-inicjal");
    // awatar zamiast litery (10-19): gość też ma swoją żabę, bo Gość to zwykły profil
    if(maAwatary()){kolko.replaceChildren();wstawAwatar(kolko,awatarNazwy(nazwaAktywnego()),"awatar-plakietka");}
    else kolko.textContent=(pokazNazwe(n).trim()[0]||"?").toLocaleUpperCase(RBJezyk.loc);
    if(k)b.style.setProperty("--kolor",k);else b.style.removeProperty("--kolor");
    b.classList.toggle("gosc",!n);
    b.setAttribute("aria-label",tx("plakietkaAria",{nazwa:pokazNazwe(n)}));
    b.hidden=false;
  }

  // ---- okno ----
  function zbuduj(){
    const box=h("section","tablica okno konto-okno");box.id="kontoOkno";box.hidden=true;
    const karta=h("div","karta tablica-karta okno-karta profile-karta konto-karta");karta.setAttribute("role","dialog");karta.setAttribute("aria-modal","true");
    karta.setAttribute("aria-labelledby","kontoTytul");
    const glowa=h("header","tablica-glowa"),tyt=h("h2","tablica-tytul");tyt.id="kontoTytul";
    const zam=h("button","gracz-usun tablica-zamknij","×");zam.type="button";zam.setAttribute("aria-label",TX.zamknij);zam.title=TX.zamknij;
    zam.onclick=()=>wstecz();   // pad „wstecz” i Esc klikają ten przycisk (nawigujLobby)
    glowa.append(tyt,zam);
    const cialo=h("div","okno-cialo profile-cialo konto-cialo");
    karta.append(glowa,cialo);box.append(karta);document.body.append(box);
    box.addEventListener("pointerdown",e=>{if(e.target===box)wstecz();});
    Object.assign(V,{el:box,tytul:tyt,cialo});
  }
  const otwarte=()=>!!(V.el&&!V.el.hidden);
  // tryb: "start" (pierwsze uruchomienie: zamknięcie = gość, gdy nic nie wybrano) | "konto" (z plakietki)
  function otworz(tryb,powrot){
    if(typeof S==="undefined"||S.ekran!=="lobby")return false;
    if(window.ZC&&ZC.profile&&ZC.profile.otwarte)return false;
    if(!V.el)zbuduj();
    V.tryb=tryb==="start"?"start":"konto";V.powrot=powrot||document.activeElement;
    pokaz("lista");V.el.hidden=false;fokus();
    return true;
  }
  function zamknij(){
    if(!otwarte())return;
    V.el.hidden=true;V.cialo.replaceChildren();
    if(V.tryb==="start"&&!stan){stan={aktywny:null,pytaj:false};zapisz(stan);}   // zamknięte bez wyboru: gość, bez pytania co start
    const z=V.powrot&&V.powrot.isConnected?V.powrot:document.getElementById("menuKonto");V.powrot=null;
    if(z&&z.focus)z.focus({preventScroll:true});
  }
  function wstecz(){if(V.cialo.dataset.widok!=="lista"){pokaz("lista");fokus();return;}zamknij();}   // „Nowe konto” i „Awatar” wracają do listy
  function fokus(sel){
    const c=(sel&&V.cialo.querySelector(sel))||V.cialo.querySelector("[data-start]")||V.cialo.querySelector("button:not(:disabled),input");
    if(c){c.focus({preventScroll:true});if(c.scrollIntoView)c.scrollIntoView({block:"nearest"});}
  }
  function pokaz(widok){
    V.tytul.textContent=V.tryb==="start"?TX.tytulStart:TX.tytulKonto;
    V.cialo.dataset.widok=widok;
    const budowa={nowe:widokNowe,awatar:widokAwatar}[widok]||widokLista;
    V.cialo.replaceChildren(...budowa());
  }
  function przycisk(tekst,klasa,fn){const b=h("button","przycisk maly profil-btn"+(klasa?" "+klasa:""),tekst);b.type="button";if(fn)b.onclick=fn;return b;}
  function widokLista(){
    const teraz=Postepy.kluczProfilu(nazwaAktywnego());
    const rz=h("div","wybor-rzad profil-wybor konto-wybor");
    const lista=Postepy.lista().slice().sort((a,b)=>(a.gosc-b.gosc)||((b.ostatnio||0)-(a.ostatnio||0)));
    for(const x of lista){
      const b=h("button","wybor-opcja profil-opcja konto-opcja"+(maAwatary()?" awatar-kafel":""));b.type="button";b.dataset.klucz=x.klucz;
      if(x.kolor)b.style.setProperty("--kolor",x.kolor);
      if(maAwatary())wstawAwatar(b,awatarKlucza(x.klucz,x.awatar),"awatar-kafel-obraz");
      const jest=x.klucz===teraz&&!(V.tryb==="start"&&!stan);
      b.setAttribute("aria-pressed",String(jest));if(jest)b.dataset.start="1";
      const t=h("b","",x.gosc?TX.jakoGosc:x.nazwa);if(jest)t.append(h("span","profil-teraz",TX.teraz));
      const opis=x.gosc?TX.goscOpis:[tt("profStatSlawa",{n:fmtSlawa(x.slawa)}),tt("profStatMotywy",{n:x.motywy,z:x.motywyZ}),tt("profStatGry",{n:x.gry})].join(" · ");
      b.append(t,h("span","",opis));
      b.onclick=()=>{przelacz(x.gosc?null:x.nazwa,{pytaj:pytaj.checked});zamknij();};
      rz.append(b);
    }
    const pasek=h("div","profil-pasek");
    const bNowe=przycisk(TX.nowe,"glowny",()=>{pokaz("nowe");fokus();});
    pasek.append(bNowe);
    // 10-15: osiągnięcia i efekt aktywnego konta prosto z menu (okno sceny z zabi-chor.js; zamknięcie wraca tutaj)
    if(typeof otworzOsiagnieciaProfilu==="function"&&!(V.tryb==="start"&&!stan)){
      const bOs=przycisk(TX.osiag,"",()=>{
        const p=document.getElementById("menuKonto"),n=nazwaAktywnego();zamknij();
        const wroc=()=>{if(otworz("konto",p))fokus('[data-akcja="osiag"]');};
        if(!otworzOsiagnieciaProfilu(n,wroc))wroc();
      });
      bOs.dataset.akcja="osiag";pasek.append(bOs);
    }
    // 10-19: awatar aktywnego konta zmienia się tu, obok skina (gość też ma swój, bo Gość to zwykły profil)
    if(maAwatary()&&!(V.tryb==="start"&&!stan)){
      const bAw=przycisk(T.profAwatar,"awatar-btn",()=>{pokaz("awatar");fokus();});
      bAw.dataset.akcja="awatar";wstawAwatar(bAw,awatarNazwy(nazwaAktywnego()),"awatar-btn-obraz");pasek.append(bAw);
    }
    if(window.ZC&&ZC.profile)pasek.append(przycisk(TX.zarzadzaj,"",()=>{const p=document.getElementById("menuKonto");zamknij();ZC.profile.otworz({powrot:p});}));
    const et=h("label","konto-pytaj"),pytaj=h("input","");pytaj.type="checkbox";pytaj.checked=!!(stan&&stan.pytaj);
    pytaj.onchange=()=>{stan=Object.assign({aktywny:aktywny()},stan||{},{pytaj:pytaj.checked});zapisz(stan);};
    et.append(pytaj,h("span","",TX.pytaj));
    if(V.tryb==="start"&&!stan&&!lista.some(x=>!x.gosc))bNowe.dataset.start="1";   // zupełnie pierwszy raz: od razu „Nowe konto”
    return [h("p","okno-wstep",V.tryb==="start"?TX.wstepStart:TX.wstepKonto),rz,pasek,et];
  }
  function widokNowe(){
    const f=h("form","profil-formularz konto-formularz");f.noValidate=true;
    const et=h("label","profil-et",TX.nazwaEt);et.htmlFor="kontoPole";
    const pole=h("input","profil-pole");pole.id="kontoPole";pole.type="text";pole.maxLength=18;pole.spellcheck=false;pole.autocomplete="off";pole.dataset.start="1";
    const blad=h("p","profil-blad");blad.setAttribute("role","alert");blad.id="kontoPoleBlad";pole.setAttribute("aria-describedby",blad.id);
    let kolor=ZC_PALETA[Postepy.lista().length%ZC_PALETA.length];
    const paleta=h("div","profil-paleta");paleta.setAttribute("role","radiogroup");paleta.setAttribute("aria-label",TX.kolorEt);
    const odswiez=()=>{for(const b of paleta.children)b.setAttribute("aria-checked",String(b.dataset.kolor===kolor));};
    ZC_PALETA.forEach((k,i)=>{
      const b=h("button","profil-kolor-opcja");b.type="button";b.setAttribute("role","radio");b.dataset.kolor=k;
      b.style.setProperty("--kolor",k);const e=tt("profKolorNr",{n:i+1});b.setAttribute("aria-label",e);b.title=e;
      b.onclick=()=>{kolor=k;odswiez();};paleta.append(b);
    });
    odswiez();
    // awatar nowego konta (10-19): domyślnie kolejna żaba z listy, tak jak kolejny kolor palety
    let awatar=maAwatary()?Awatary.ID[Postepy.lista().length%Awatary.ID.length]:null;
    const zaby=maAwatary()?Awatary.wybor({klucz:"",wybrany:awatar,etykieta:T.awatarEt,naZmiane:id=>{awatar=id;}}):null;
    const rz=h("div","profil-pasek profil-pasek-dol");
    const zapiszB=h("button","przycisk maly glowny profil-btn",TX.utworz);zapiszB.type="submit";
    rz.append(przycisk(TX.anuluj,"",()=>{pokaz("lista");fokus();}),zapiszB);
    f.onsubmit=e=>{
      e.preventDefault();
      const r=Postepy.utworz(pole.value);
      if(!r.ok){blad.textContent=T[{pusta:"profBladPusta",zajeta:"profBladZajeta",limit:"profBladLimit"}[r.powod]]||"";
        pole.setAttribute("aria-invalid","true");pole.focus();return;}
      try{Postepy.kolor(r.nazwa,kolor);}catch(e2){}
      if(awatar)try{Postepy.awatar(r.nazwa,awatar);}catch(e2){}
      przelacz(r.nazwa,{pytaj:!!(stan&&stan.pytaj)});zamknij();
    };
    f.append(h("h3","okno-sekcja",TX.nowe),et,pole,blad,h("p","profil-et",TX.kolorEt),paleta);
    if(zaby)f.append(h("p","profil-et",T.awatarEt),zaby);
    f.append(rz);
    return [f];
  }
  // Zmiana awatara aktywnego konta: klik żabą zapisuje, odświeża plakietkę i wraca do listy (jak kolor w oknie „Profile”).
  function widokAwatar(){
    const nazwa=nazwaAktywnego(),widoczna=pokazNazwe(aktywny()),tytul=tt("awatarTytul",{nazwa:widoczna});
    const grupa=Awatary.wybor({klucz:Postepy.kluczProfilu(nazwa),wybrany:awatarNazwy(nazwa),etykieta:tytul,
      naZmiane:id=>{
        try{Postepy.awatar(nazwa,id);}catch(e){}
        odswiezPlakietke();
        if(typeof toast==="function")toast(tt("awatarZmieniony",{nazwa:widoczna}));
        pokaz("lista");fokus('[data-akcja="awatar"]');
      }});
    const rz=h("div","profil-pasek profil-pasek-dol");
    rz.append(przycisk(TX.anuluj,"",()=>{pokaz("lista");fokus('[data-akcja="awatar"]');}));
    return [h("h3","okno-sekcja",tytul),h("p","okno-wstep",T.awatarOpis),grupa,rz];
  }

  // ---- owinięcia gry i postępów ----
  function owin(){
    // start: ustawienia aktywnego konta przykrywają ogólny zapis (ZC.init woła wczytajUstawienia)
    const wczytaj=window.wczytajUstawienia;
    if(typeof wczytaj==="function")window.wczytajUstawienia=function(){
      const z=wczytaj.apply(this,arguments);
      try{const n=aktywny();if(n)doStanu(Postepy.ustawienia(n),false);}catch(e){}
      return z;
    };
    const zapiszU=window.zapiszUstawienia;
    if(typeof zapiszU==="function")window.zapiszUstawienia=function(){const r=zapiszU.apply(this,arguments);lustro();return r;};
    const dolacz0=window.dolacz;
    if(typeof dolacz0==="function")window.dolacz=function(id){
      const g=dolacz0.apply(this,arguments);
      try{
        const n=aktywny();
        if(g&&n&&g.zrodlo!=="bot"&&!g.nazwaWlasna&&!S.odtwarzanie&&
          !S.gracze.some(x=>x!==g&&Postepy.kluczProfilu(Postepy.nazwaProfilu(x)||Postepy.GOSC)===Postepy.kluczProfilu(n))){
          g.nazwa=n;g.nazwaWlasna=true;
          const k=Postepy.kolor(n);if(k){g.kolor=k;g.kolorWlasny=true;}
          if(g.zrodlo==="kapsel")Postepy.przypiszKapsel(g.id,n);
          rysujGraczy();
        }
      }catch(e){}
      return g;
    };
    const zmien=Postepy.zmienNazwe,usun=Postepy.usun;
    Postepy.zmienNazwe=function(stara,nowa){
      const r=zmien.apply(this,arguments);
      if(r&&r.ok&&stan&&stan.aktywny&&Postepy.kluczProfilu(stan.aktywny)===Postepy.kluczProfilu(stara)){stan.aktywny=r.nazwa;zapisz(stan);}
      setTimeout(odswiezPlakietke,0);return r;
    };
    Postepy.usun=function(nazwa){
      const r=usun.apply(this,arguments);
      if(r&&r.ok&&stan&&stan.aktywny&&Postepy.kluczProfilu(stan.aktywny)===r.klucz){stan.aktywny=null;zapisz(stan);}
      setTimeout(odswiezPlakietke,0);return r;
    };
    // język: zapis do konta, zanim RBJezyk.ustaw przeładuje stronę
    window.addEventListener("rb-jezyk",e=>{try{Postepy.zapiszUstawienia(nazwaAktywnego(),Object.assign(wybraneUstawienia(),{jezyk:e.detail.jezyk}));}catch(e2){}});
  }
  owin();

  // ---- klawiatura: ten sam wzorzec co okno „Profile” (profile.js): Esc = × (w „Nowe konto” = „Anuluj”), Tab krąży
  // w oknie (aria-modal), strzałki do nawigujLobby, F-klawisze przepuszczone; reszta nie dochodzi do menu pod spodem (A-02, A-03)
  addEventListener("keydown",e=>{
    if(!otwarte())return;
    if(/^F\d+$/.test(e.key))return;
    e.stopImmediatePropagation();
    if(e.key==="Escape"){e.preventDefault();if(window.DzwiekiUI&&DzwiekiUI.zglos)DzwiekiUI.zglos("wstecz");wstecz();return;}
    if(e.key==="Tab"){
      if(window.DzwiekiUI&&DzwiekiUI.oznaczWejscie)DzwiekiUI.oznaczWejscie("klawiatura");
      const l=[...V.el.querySelectorAll("button,input")].filter(x=>!x.disabled&&x.getClientRects().length);
      if(!l.length)return;const i=l.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){e.preventDefault();l[l.length-1].focus();}else if(!e.shiftKey&&(i===l.length-1||i<0)){e.preventDefault();l[0].focus();}
      return;
    }
    const akcja={ArrowUp:"gora",ArrowDown:"dol",ArrowLeft:"lewo",ArrowRight:"prawo"}[e.key];
    const wPolu=e.target&&e.target.tagName==="INPUT"&&e.target.type==="text";
    if(akcja&&!(wPolu&&(akcja==="lewo"||akcja==="prawo"))&&!e.ctrlKey&&!e.altKey&&!e.metaKey){
      e.preventDefault();if(typeof nawigujLobby==="function")nawigujLobby(akcja);}
  },true);

  function poStarcie(){
    const b=document.getElementById("menuKonto");
    if(b){b.onclick=()=>otworz("konto");odswiezPlakietke();}
    // okno „Profile” (profile.js, powstaje przy pierwszym otwarciu): po jego zamknięciu plakietka pokazuje bieżący profil
    const patrz=()=>{const o=document.getElementById("profileOkno");if(!o)return false;
      new MutationObserver(()=>{if(o.hidden)odswiezPlakietke();}).observe(o,{attributes:true,attributeFilter:["hidden"]});return true;};
    if(!patrz()){const mo=new MutationObserver(()=>{if(patrz())mo.disconnect();});mo.observe(document.body,{childList:true});}
    let q=null;try{q=new URLSearchParams(location.search).get("konto");}catch(e){}
    const automat=typeof navigator!=="undefined"&&navigator.webdriver;
    const pytac=q==="1"||(q!=="0"&&!automat&&(!stan||stan.pytaj));
    // po zdjęciu zasłony wczytywania (Wczytywanie.poWczytaniu), a potem chwila na wejście menu (A-01)
    const poWczytaniu=typeof Wczytywanie!=="undefined"&&Wczytywanie.poWczytaniu?Wczytywanie.poWczytaniu():Promise.resolve();
    if(pytac)poWczytaniu.then(()=>setTimeout(()=>{if(S.lobbyEkran==="menu"&&!otwarte())otworz("start");},650));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",poStarcie);else setTimeout(poStarcie,0);

  return {aktywny,przelacz,otworz,zamknij,get otwarte(){return otwarte();},KLUCZE:KLUCZE_KONTA};
})();
if(window.ZC)window.ZC.konto=ZCKonto;
