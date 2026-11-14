"use strict";
// ===== RIBBITBEAT: okno „Profile” (zarządzanie profilami graczy, 2026-10-10) =====
// Zarządzanie użytkownikami. Profil = sława, odblokowane motywy i osiągnięcia gracza
// (postepy.js). Okno umie: Nowy, Zmień nazwę, Kolor (ulubiony kolor gracza), Przypnij (przypięty nigdy nie znika sam),
// Wyzeruj postępy i Usuń (oba z potwierdzeniem w stylu gry, bez confirm() przeglądarki), Eksport (plik JSON z Bloba,
// lokalnie) i Import (scal albo zastąp, z raportem). Drugi tryb tego samego okna: „Kto gra?” z karty gracza, czyli
// wybór istniejącego profilu dla gracza w składzie (kolor profilu przechodzi na gracza, kapsel zapamiętuje profil).
//
// Ładowany po zabi-chor.js (i skrypcie startowym). Korzysta z globali gry: S, T, tt, h, el, ZC_PALETA,
// ZC_LOC, ZC_SKLAD_KLUCZ, fmtSlawa, pokazProfil, rysujGraczy, zapiszSkladTeraz, nawigujLobby, Wejscie, Postepy.
// Nakładka #profileOkno powstaje przy pierwszym otwarciu (klasy .tablica .okno jak inne okna gry); nakladkaLobby()
// w zabi-chor.js ją zna, więc pad i pilot kapsla chodzą po niej tak jak po „Scenie”. Klawiatura: strzałki po
// przyciskach (w polu tekstowym lewo i prawo zostają dla kursora), Enter i Spacja klikają, Esc = krok wstecz
// (z podokna do listy, z listy zamyka), Tab krąży w oknie.
//
// API: window.ZC.profile = {otworz(o?), wybierz(idGracza, o?), lista(), przypisz(idGracza, nazwa), zamknij(), otwarte}.
// Wejście tymczasowe do czasu przycisku w menu: ?profile=1 i menu deweloperskie (F2, „Efekty i gra” → Profile).
const ZCProfile=(function(){
  const V={el:null,karta:null,tytul:null,cialo:null,status:null,plik:null,baza:"lista",tryb:"lista",dane:null,dla:null,powrot:null};
  const ZAKAZ_GOSC=()=>T.profGoscBlokada;
  // ---- ikonki: filcowe jak w całej grze (10-15; zabi-chor.js ikonaFilc), „app/” = ikony panelu RibbitFlipa ----
  const IKONY_PLIKI={nowy:"app/plusclean",eksport:"app/export",import:"app/import",nazwa:"olowek",pinezka:"pinezka",zeruj:"reset",
    kosz:"app/bin",zarzadzaj:"profile",puchar:"puchar"};
  const IKONY=Object.fromEntries(Object.entries(IKONY_PLIKI).map(([k,v])=>[k,ikonaFilc(v,"ikona-filc profil-ikona")]));
  function przycisk(tekst,klasa,ikona,fn){
    const b=h("button","przycisk maly profil-btn"+(klasa?" "+klasa:""));b.type="button";
    if(ikona)b.insertAdjacentHTML("beforeend",IKONY[ikona]);
    b.append(h("span","",tekst));if(fn)b.onclick=fn;return b;
  }
  const nazwaDla=n=>pokazProfil(n);   // „Gość” po angielsku to „Guest”
  // Awatar profilu (10-19, js/awatary.js): ta sama żaba, którą widać przy koncie w menu i w oknie „Kto gra na tym
  // komputerze?”. Bez modułu okno wygląda jak przedtem. Plakietkę konta odświeża js/konta.js po zamknięciu tego okna.
  const maAwatary=()=>typeof Awatary!=="undefined";
  const awatarEl=(x,klasa)=>Awatary.element(Awatary.dla(x.klucz,x.awatar),{klasa:"awatar "+klasa});
  // Klucz profilu aktywnego konta (js/konta.js; bez konta = Gość), do znacznika „grasz teraz” na liście.
  function kluczKonta(){try{return window.ZC&&ZC.konto?Postepy.kluczProfilu(ZC.konto.aktywny()||Postepy.GOSC):null;}catch(e){return null;}}
  const fmtData=ms=>new Date(ms).toLocaleDateString(ZC_LOC,{day:"numeric",month:"numeric",year:"numeric"});
  function staty(x){
    return [tt("profStatSlawa",{n:fmtSlawa(x.slawa)}),tt("profStatMotywy",{n:x.motywy,z:x.motywyZ}),
      tt("profStatGry",{n:x.gry}),   // 10-19: bez licznika osiągnięć
      x.ostatnio?tt("profOstatnio",{data:fmtData(x.ostatnio)}):T.profNigdy].join(" · ");
  }

  // ---- nakładka ----
  function zbuduj(){
    const box=h("section","tablica okno profile-okno");box.id="profileOkno";box.hidden=true;
    const karta=h("div","karta tablica-karta okno-karta profile-karta");karta.setAttribute("role","dialog");karta.setAttribute("aria-modal","true");
    karta.setAttribute("aria-labelledby","profileTytul");
    const glowa=h("header","tablica-glowa"),tyt=h("h2","tablica-tytul");tyt.id="profileTytul";
    const zam=h("button","gracz-usun tablica-zamknij","×");zam.type="button";zam.setAttribute("aria-label",T.oknoZamknij);zam.title=T.oknoZamknij;
    zam.onclick=()=>wstecz();   // pad „wstecz” klika właśnie ten przycisk (nawigujLobby)
    glowa.append(tyt,zam);
    const status=h("p","profil-status");status.setAttribute("role","status");status.setAttribute("aria-live","polite");
    const cialo=h("div","okno-cialo profile-cialo");
    const plik=h("input","");plik.type="file";plik.accept=".json,application/json";plik.hidden=true;plik.tabIndex=-1;
    plik.onchange=()=>{const f=plik.files&&plik.files[0];plik.value="";if(f)wczytajPlik(f);};
    karta.append(glowa,status,cialo,plik);box.append(karta);document.body.append(box);
    box.addEventListener("pointerdown",e=>{if(e.target===box)wstecz();});
    Object.assign(V,{el:box,karta,tytul:tyt,cialo,status,plik});
  }
  const otwarte=()=>!!(V.el&&!V.el.hidden);
  function otworz(opc){
    opc=opc||{};
    if(typeof S==="undefined"||S.ekran!=="lobby"){if(typeof toast==="function")toast(T.profTylkoLobby);return false;}
    if(!V.el)zbuduj();
    V.baza="lista";V.dla=null;V.powrot=opc.powrot||document.activeElement;
    pokaz("lista");V.el.hidden=false;ustawFokus();
    return true;
  }
  // Tryb „Kto gra?” dla gracza ze składu (przycisk .gracz-profil w karcie gracza).
  function wybierz(id,opc){
    opc=opc||{};
    const g=S.gracze.find(x=>x.id===id);if(!g||g.zrodlo==="bot")return false;
    if(!otworz(opc))return false;
    V.baza="wybor";V.dla=g.id;pokaz("wybor");ustawFokus();
    return true;
  }
  function zamknij(){
    if(!otwarte())return;
    V.el.hidden=true;V.cialo.replaceChildren();V.status.textContent="";
    let z=V.powrot;V.powrot=null;
    if(z&&!z.isConnected&&V.dla){const k=document.querySelector('.gracz[data-id="'+CSS.escape(V.dla)+'"] .gracz-profil');if(k)z=k;}
    V.dla=null;
    if(z&&z.isConnected&&z.focus)z.focus({preventScroll:true});
  }
  // Esc, pad „wstecz”, × i klik obok karty: z podokna wraca do listy (albo wyboru), z listy zamyka okno.
  function wstecz(){
    if(V.tryb!==V.baza){const f=V.dane&&V.dane.fokus;pokaz(V.baza);ustawFokus(f);return;}
    zamknij();
  }
  function pokaz(tryb,dane){
    V.tryb=tryb;V.dane=dane||null;
    V.tytul.textContent=V.baza==="wybor"?T.profWybierzTytul:T.profTytul;
    const widok={lista:widokLista,wybor:widokWybor,formularz:widokFormularz,kolor:widokKolor,awatar:widokAwatar,
      potwierdz:widokPotwierdz,import:widokImport,raport:widokRaport}[tryb]||widokLista;
    V.cialo.replaceChildren(...widok(V.dane||{}));
    V.cialo.dataset.tryb=tryb;
    if(tryb!==V.baza){komunikat("");ustawFokus();}   // podokno: bez starego komunikatu: fokus na jego start (pole nazwy, Anuluj, wybrany kolor); powrót ustawia go sam
  }
  // Fokus po zmianie widoku: wskazany selektor, a bez niego pierwszy aktywny element widoku.
  function ustawFokus(sel){
    let cel=(sel&&V.cialo.querySelector(sel))||V.cialo.querySelector("[data-start]")||
      V.cialo.querySelector("button:not(:disabled),input:not([type=file])");
    // cel wyłączony albo ukryty (np. „Wyzeruj” po wyzerowaniu): pierwszy aktywny przycisk tego samego wiersza (A-08)
    if(cel&&(cel.disabled||!cel.getClientRects().length)){
      const rzad=cel.closest(".profil-akcje")||cel.parentElement;
      cel=(rzad&&rzad.querySelector("button:not(:disabled)"))||V.cialo.querySelector("button:not(:disabled),input:not([type=file])");
    }
    if(cel){cel.focus({preventScroll:true});if(cel.scrollIntoView)cel.scrollIntoView({block:"nearest"});}
  }
  function komunikat(tekst,blad){V.status.textContent=tekst||"";V.status.classList.toggle("blad",!!blad);}
  const odswiezLobby=()=>{if(S.ekran==="lobby")try{rysujGraczy();}catch(e){}};
  const sel=k=>'[data-klucz="'+CSS.escape(k)+'"]';

  // ---- widoki ----
  function widokLista(){
    const pasek=h("div","profil-pasek");
    const nowy=przycisk(T.profNowy,"glowny","nowy",()=>pokaz("formularz",{cel:"nowy",fokus:".profil-pasek .glowny"}));
    const eks=przycisk(T.profEksport,"","eksport",eksportuj);eks.title=T.profEksportOpis;
    const imp=przycisk(T.profImport,"","import",()=>{komunikat("");V.plik.click();});imp.title=T.profImportOpis;imp.dataset.akcja="import";
    pasek.append(nowy,eks,imp);
    const ul=h("ul","profil-lista");ul.setAttribute("aria-label",T.profLista);
    for(const x of Postepy.lista())ul.append(wierszProfilu(x));
    return [h("p","okno-wstep",T.profWstep),pasek,ul];
  }
  function wierszProfilu(x){
    const li=h("li","profil-wiersz"+(x.przypiety?" przypiety":""));li.dataset.klucz=x.klucz;
    if(x.kolor)li.style.setProperty("--kolor",x.kolor);
    const nazwa=nazwaDla(x.nazwa);
    const info=h("div","profil-info"),rz=h("div","profil-nazwa-rzad");
    if(maAwatary())rz.append(awatarEl(x,"awatar-mini"));
    rz.append(h("b","profil-nazwa",nazwa));
    if(x.klucz===kluczKonta()){const z=h("span","profil-znaczek profil-znaczek-teraz",T.profGraszTeraz);z.title=T.profGraszTerazOpis;rz.append(z);}
    if(x.przypiety){const z=h("span","profil-znaczek profil-znaczek-pin");z.insertAdjacentHTML("afterbegin",IKONY.pinezka);z.append(h("span","",T.profPrzypiety));rz.append(z);}
    if(x.kapsle.length){const z=h("span","profil-znaczek profil-znaczek-kapsel",T.profKapsel);z.title=T.profKapselOpis;rz.append(z);}
    info.append(rz,h("p","profil-staty",staty(x)));
    if(x.gosc)info.append(h("p","profil-gosc",T.profGoscOpis));
    const akcje=h("div","profil-akcje");akcje.setAttribute("role","group");akcje.setAttribute("aria-label",nazwa);
    const aria=(b,akcja)=>{b.setAttribute("aria-label",tt("profAkcjaAria",{akcja,nazwa}));return b;};
    const fok=a=>sel(x.klucz)+' [data-akcja="'+a+'"]';
    const bNazwa=aria(przycisk(T.profZmienNazwe,"","nazwa",()=>pokaz("formularz",{cel:"nazwa",klucz:x.klucz,nazwa:x.nazwa,fokus:fok("nazwa")})),T.profZmienNazwe);
    const bKolor=aria(przycisk(T.profKolor,"profil-btn-kolor",null,()=>pokaz("kolor",{klucz:x.klucz,nazwa:x.nazwa,kolor:x.kolor,fokus:fok("kolor")})),T.profKolor);
    bKolor.prepend(h("span","profil-probka"));
    const bAwatar=maAwatary()?aria(przycisk(T.profAwatar,"awatar-btn",null,
      ()=>pokaz("awatar",{klucz:x.klucz,nazwa:x.nazwa,awatar:x.awatar,fokus:fok("awatar")})),T.profAwatar):null;
    if(bAwatar){bAwatar.prepend(awatarEl(x,"awatar-btn-obraz"));bAwatar.dataset.akcja="awatar";}
    const bPin=aria(przycisk(x.przypiety?T.profOdepnij:T.profPrzypnij,"","pinezka",()=>przypnij(x)),x.przypiety?T.profOdepnij:T.profPrzypnij);
    bPin.setAttribute("aria-pressed",String(x.przypiety));
    const bZeruj=aria(przycisk(T.profWyzeruj,"","zeruj",()=>pokaz("potwierdz",{rodzaj:"wyzeruj",klucz:x.klucz,nazwa:x.nazwa,fokus:fok("zeruj")})),T.profWyzeruj);
    bZeruj.disabled=!x.postep;
    const bUsun=aria(przycisk(T.profUsun,"profil-btn-usun","kosz",()=>pokaz("potwierdz",{rodzaj:"usun",klucz:x.klucz,nazwa:x.nazwa,fokus:fok("usun")})),T.profUsun);
    if(x.gosc){for(const b of [bNazwa,bUsun]){b.disabled=true;b.title=ZAKAZ_GOSC();}}
    const bOsiag=aria(przycisk(T.profOsiag,"","puchar",()=>pokazOsiagniecia(x)),T.profOsiag);bOsiag.title=T.profOsiagOpis;
    bOsiag.dataset.akcja="osiag";bNazwa.dataset.akcja="nazwa";bKolor.dataset.akcja="kolor";bPin.dataset.akcja="pin";bZeruj.dataset.akcja="zeruj";bUsun.dataset.akcja="usun";
    akcje.append(...[bOsiag,bNazwa,bKolor,bAwatar,bPin,bZeruj,bUsun].filter(Boolean));
    li.append(h("span","profil-pasek-koloru"),info,akcje);
    return li;
  }
  // „Kto gra?”: kafle profili (jak okno wyboru gracza), obecny zaznaczony; pod spodem Nowy i Zarządzaj.
  function widokWybor(){
    const g=S.gracze.find(x=>x.id===V.dla);if(!g){setTimeout(zamknij,0);return [];}
    const teraz=Postepy.kluczProfilu(Postepy.nazwaProfilu(g)||Postepy.GOSC);
    const rz=h("div","wybor-rzad profil-wybor");
    for(const x of Postepy.lista()){
      const b=h("button","wybor-opcja profil-opcja"+(maAwatary()?" awatar-kafel":""));b.type="button";b.dataset.klucz=x.klucz;
      if(x.kolor)b.style.setProperty("--kolor",x.kolor);
      if(maAwatary())b.append(awatarEl(x,"awatar-kafel-obraz"));
      const jest=x.klucz===teraz;b.setAttribute("aria-pressed",String(jest));if(jest)b.dataset.start="1";
      const t=h("b","",nazwaDla(x.nazwa));if(jest)t.append(h("span","profil-teraz",T.profTeraz));
      b.append(t,h("span","",staty(x)));
      b.onclick=()=>{przypisz(g.id,x.nazwa);zamknij();};
      rz.append(b);
    }
    const pasek=h("div","profil-pasek");
    pasek.append(przycisk(T.profNowy,"glowny","nowy",()=>pokaz("formularz",{cel:"nowy",dla:g.id,fokus:".profil-pasek .glowny"})),
      przycisk(T.profZarzadzaj,"","zarzadzaj",()=>{V.baza="lista";V.dla=null;pokaz("lista");ustawFokus();}));
    return [h("p","okno-wstep",tt("profWybierzOpis",{nazwa:g.nazwa})),rz,pasek];
  }
  function widokFormularz(d){
    const nowy=d.cel==="nowy",f=h("form","profil-formularz");f.noValidate=true;
    const id="profilPole",et=h("label","profil-et",T.profNazwaEt);et.htmlFor=id;
    const pole=h("input","profil-pole");pole.id=id;pole.type="text";pole.maxLength=18;pole.spellcheck=false;pole.autocomplete="off";
    pole.value=nowy?"":d.nazwa;pole.dataset.start="1";
    const blad=h("p","profil-blad");blad.setAttribute("role","alert");blad.id="profilPoleBlad";pole.setAttribute("aria-describedby",blad.id);
    const rz=h("div","profil-pasek profil-pasek-dol");
    const anuluj=przycisk(T.profAnuluj,"",null,()=>wstecz()),zapisz=h("button","przycisk maly glowny profil-btn",T.profZapisz);zapisz.type="submit";
    rz.append(anuluj,zapisz);
    // 10-15: nowy profil też dostaje ulubiony kolor (jak „Nowe konto” w js/konta.js), domyślny według liczby profili
    let kolor=ZC_PALETA[Postepy.lista().length%ZC_PALETA.length];
    const paleta=h("div","profil-paleta");paleta.setAttribute("role","radiogroup");paleta.setAttribute("aria-label",T.profKolorEt);
    if(nowy){
      const zaznacz=()=>{for(const b of paleta.children)b.setAttribute("aria-checked",String(b.dataset.kolor===kolor));};
      ZC_PALETA.forEach((k,i)=>{
        const b=h("button","profil-kolor-opcja");b.type="button";b.setAttribute("role","radio");b.dataset.kolor=k;
        b.style.setProperty("--kolor",k);const e=tt("profKolorNr",{n:i+1});b.setAttribute("aria-label",e);b.title=e;
        b.onclick=()=>{kolor=k;zaznacz();};paleta.append(b);
      });
      zaznacz();
    }
    f.onsubmit=e=>{
      e.preventDefault();
      const r=nowy?Postepy.utworz(pole.value):Postepy.zmienNazwe(d.nazwa,pole.value);
      if(!r.ok){blad.textContent=T[{pusta:"profBladPusta",zajeta:"profBladZajeta",gosc:"profBladGosc",brak:"profBladBrak",limit:"profBladLimit"}[r.powod]]||"";
        pole.setAttribute("aria-invalid","true");pole.focus();return;}
      if(nowy){
        try{Postepy.kolor(r.nazwa,kolor);}catch(e2){}
        komunikat(tt("profUtworzono",{nazwa:r.nazwa}));
        if(d.dla){przypisz(d.dla,r.nazwa);zamknij();return;}
        pokaz(V.baza);ustawFokus(sel(r.klucz)+' [data-akcja="nazwa"]');return;
      }
      poZmianieNazwy(r);komunikat(tt("profNowaNazwa",{nazwa:r.nazwa}));
      pokaz(V.baza);ustawFokus(sel(r.klucz)+' [data-akcja="nazwa"]');
    };
    f.append(h("h3","okno-sekcja",nowy?T.profNowyTytul:tt("profZmienTytul",{nazwa:nazwaDla(d.nazwa)})),et,pole,blad);
    if(nowy)f.append(h("p","profil-et",T.profKolorEt),paleta);
    f.append(rz);
    return [f];
  }
  function widokKolor(d){
    const grupa=h("div","profil-paleta");grupa.setAttribute("role","radiogroup");grupa.setAttribute("aria-label",tt("profKolorTytul",{nazwa:nazwaDla(d.nazwa)}));
    const opcja=(kolor,et)=>{
      const b=h("button","profil-kolor-opcja"+(kolor?"":" bez"));b.type="button";b.setAttribute("role","radio");
      b.setAttribute("aria-checked",String((d.kolor||null)===kolor));b.setAttribute("aria-label",et);b.title=et;
      if(kolor)b.style.setProperty("--kolor",kolor);if((d.kolor||null)===kolor)b.dataset.start="1";
      b.onclick=()=>{
        const r=Postepy.kolor(d.nazwa,kolor);
        if(!r.ok){komunikat(T.profBladKolor,true);return;}
        poZmianieKoloru(d.nazwa,kolor);komunikat(tt("profKolorZmieniony",{nazwa:nazwaDla(r.nazwa)}));
        pokaz(V.baza);ustawFokus(d.fokus);
      };
      return b;
    };
    ZC_PALETA.forEach((k,i)=>grupa.append(opcja(k,tt("profKolorNr",{n:i+1}))));
    grupa.append(opcja(null,T.profKolorBrak));
    const rz=h("div","profil-pasek profil-pasek-dol");rz.append(przycisk(T.profAnuluj,"",null,()=>wstecz()));
    return [h("h3","okno-sekcja",tt("profKolorTytul",{nazwa:nazwaDla(d.nazwa)})),h("p","okno-wstep",T.profKolorOpis),grupa,rz];
  }
  // Awatar profilu (10-19): klik żabą zapisuje i wraca do listy, jak podokno koloru. Napisy i nazwy żab są w T.
  function widokAwatar(d){
    const tytul=tt("awatarTytul",{nazwa:nazwaDla(d.nazwa)});
    const grupa=Awatary.wybor({klucz:d.klucz,wybrany:Awatary.dla(d.klucz,d.awatar),etykieta:tytul,naZmiane:id=>{
      const r=Postepy.awatar(d.nazwa,id);
      if(!r.ok){komunikat(T.profBladAwatar,true);return;}
      komunikat(tt("awatarZmieniony",{nazwa:nazwaDla(r.nazwa)}));
      pokaz(V.baza);ustawFokus(d.fokus);
    }});
    const rz=h("div","profil-pasek profil-pasek-dol");rz.append(przycisk(T.profAnuluj,"",null,()=>wstecz()));
    return [h("h3","okno-sekcja",tytul),h("p","okno-wstep",T.awatarOpis),grupa,rz];
  }
  // Potwierdzenie w stylu gry: nazwa profilu w treści, „Anuluj” z fokusem na starcie (Enter nie kasuje przez pomyłkę).
  function widokPotwierdz(d){
    const usun=d.rodzaj==="usun",n=nazwaDla(d.nazwa);
    const box=h("div","profil-potwierdz");box.setAttribute("role","alertdialog");box.setAttribute("aria-labelledby","profilPotwTytul");
    box.setAttribute("aria-describedby","profilPotwTresc");
    const t=h("h3","okno-sekcja",usun?T.profUsunTytul:T.profWyzerujTytul);t.id="profilPotwTytul";
    const p=h("p","okno-wstep",tt(usun?"profUsunPytanie":"profWyzerujPytanie",{nazwa:n}));p.id="profilPotwTresc";
    const rz=h("div","profil-pasek profil-pasek-dol");
    const anuluj=przycisk(T.profAnuluj,"",null,()=>wstecz());anuluj.dataset.start="1";
    const tak=przycisk(usun?T.profUsunTak:T.profWyzerujTak,"glowny profil-btn-niebezp",usun?"kosz":"zeruj",()=>{
      const r=usun?Postepy.usun(d.nazwa):Postepy.wyzeruj(d.nazwa);
      if(!r.ok){komunikat(T[r.powod==="gosc"?"profBladGosc":"profBladBrak"],true);pokaz(V.baza);ustawFokus();return;}
      if(usun)poUsunieciu(d.nazwa);else odswiezLobby();
      komunikat(tt(usun?"profUsunieto":"profWyzerowano",{nazwa:n}));
      pokaz(V.baza);ustawFokus(usun?".profil-pasek .glowny":d.fokus);
    });
    rz.append(anuluj,tak);box.append(t,p,rz);
    return [box];
  }
  function widokImport(d){
    const opcja=(tryb,tytul,opis,start)=>{
      const b=h("button","wybor-opcja profil-import-opcja");b.type="button";b.dataset.tryb=tryb;if(start)b.dataset.start="1";
      b.append(h("b","",tytul),h("span","",opis));b.onclick=()=>importuj(d.tekst,tryb);return b;};
    const rz=h("div","wybor-rzad profil-import");
    rz.append(opcja("scal",T.profScal,T.profScalOpis,true),opcja("zastap",T.profZastap,T.profZastapOpis));
    const dol=h("div","profil-pasek profil-pasek-dol");dol.append(przycisk(T.profAnuluj,"",null,()=>wstecz()));
    return [h("h3","okno-sekcja",T.profImportTytul),h("p","okno-wstep",tt("profImportPlik",{plik:d.plik,n:d.n})),rz,dol];
  }
  function widokRaport(r){
    const ul=h("ul","profil-raport");
    const linia=(klucz,lista)=>{if(!lista.length&&klucz!=="profRaportDodane")return;
      const li=h("li","",tt(klucz,{n:lista.length}));
      if(lista.length)li.append(h("span","profil-raport-nazwy",": "+lista.slice(0,12).map(nazwaDla).join(", ")+(lista.length>12?" …":"")));ul.append(li);};
    linia("profRaportDodane",r.dodane);linia("profRaportZastapione",r.zastapione);linia("profRaportPominiete",r.pominiete);
    if(r.odrzucone)ul.append(h("li","",tt("profRaportOdrzucone",{n:r.odrzucone})));
    ul.append(h("li","profil-raport-razem",tt("profRaportRazem",{n:r.razem})));
    const dol=h("div","profil-pasek profil-pasek-dol"),ok=przycisk(T.profOk,"glowny",null,()=>{pokaz(V.baza);ustawFokus();});ok.dataset.start="1";
    dol.append(ok);
    return [h("h3","okno-sekcja",T.profRaportTytul),ul,dol];
  }

  // ---- akcje ----
  // Efekt i osiągnięcia profilu (10-15): okno zamyka się, otwiera się okno sceny dla profilu (zabi-chor.js), a jego
  // zamknięcie wraca tutaj z fokusem na tym samym przycisku.
  function pokazOsiagniecia(x){
    if(typeof otworzOsiagnieciaProfilu!=="function")return;
    const pow=V.powrot,k=x.klucz;V.powrot=null;zamknij();
    const wroc=()=>{if(otworz({powrot:pow}))ustawFokus(sel(k)+' [data-akcja="osiag"]');};
    if(!otworzOsiagnieciaProfilu(x.nazwa,wroc))wroc();
  }
  function przypnij(x){
    const r=Postepy.przypnij(x.nazwa,!x.przypiety);
    if(!r.ok){komunikat(T.profBladBrak,true);return;}
    komunikat(tt(r.przypiety?"profPrzypieto":"profOdpieto",{nazwa:nazwaDla(r.nazwa)}));
    pokaz(V.baza);ustawFokus(sel(x.klucz)+' [data-akcja="pin"]');
  }
  // Skład zapisany w localStorage dostaje nową nazwę (albo traci starą), a skład w pamięci zapisuje się po swojemu.
  function przepiszSklad(stara,nowa){
    try{const z=JSON.parse(localStorage.getItem(ZC_SKLAD_KLUCZ)||"null");
      if(z)localStorage.setItem(ZC_SKLAD_KLUCZ,JSON.stringify(Postepy.skladPoZmianie(z,stara,nowa)));}catch(e){}
    try{zapiszSkladTeraz();}catch(e){}
  }
  const graczeProfilu=klucz=>S.gracze.filter(g=>{const n=Postepy.nazwaProfilu(g);return n&&Postepy.kluczProfilu(n)===klucz;});
  function poZmianieNazwy(r){
    for(const g of graczeProfilu(r.staryKlucz)){g.nazwa=r.nazwa;g.nazwaWlasna=true;}
    przepiszSklad(r.stara,r.nazwa);odswiezLobby();
  }
  // Usunięty profil: gracze, którzy go używali, wracają do nazwy swojego źródła (mysz i pady: Gość, kapsel: jego nazwa).
  function poUsunieciu(nazwa){
    for(const g of graczeProfilu(Postepy.kluczProfilu(nazwa))){
      if(!g.nazwaWlasna)continue;
      g.nazwaWlasna=false;const w=Wejscie.gracz(g.id);if(w&&w.nazwa)g.nazwa=w.nazwa;
    }
    przepiszSklad(nazwa,null);odswiezLobby();
  }
  function poZmianieKoloru(nazwa,kolor){
    if(!kolor)return;
    for(const g of graczeProfilu(Postepy.kluczProfilu(nazwa))){g.kolor=kolor;g.kolorWlasny=true;}
    odswiezLobby();
  }
  // Gracz ze składu gra jako profil `nazwa` (Gość = bez własnej nazwy). Kolor profilu przechodzi na gracza, a kapsel
  // zapamiętuje profil (Postepy.przypiszKapsel). Zwraca nazwę profilu gracza po zmianie albo null (brak gracza, bot).
  function przypisz(id,nazwa){
    const g=S.gracze.find(x=>x.id===id);if(!g||g.zrodlo==="bot")return null;
    const t=String(nazwa==null?"":nazwa).trim().slice(0,18);
    if(!t||Postepy.kluczProfilu(t)===Postepy.kluczProfilu(Postepy.GOSC)){
      g.nazwaWlasna=false;const w=Wejscie.gracz(g.id);if(w&&w.nazwa)g.nazwa=w.nazwa;
      if(g.zrodlo==="kapsel")Postepy.przypiszKapsel(g.id,null);
    }else{
      g.nazwa=Postepy.profil(t).nazwa;g.nazwaWlasna=true;
      const k=Postepy.kolor(g.nazwa);if(k){g.kolor=k;g.kolorWlasny=true;}
      if(g.zrodlo==="kapsel")Postepy.przypiszKapsel(g.id,g.nazwa);
    }
    try{zapiszSkladTeraz();}catch(e){}
    odswiezLobby();
    return Postepy.nazwaProfilu(g);
  }
  function eksportuj(){
    const plik="ribbitbeat-profile-"+Postepy.dzienLokalny(new Date())+".json";
    try{
      const url=URL.createObjectURL(new Blob([Postepy.eksport()],{type:"application/json"})),a=document.createElement("a");
      a.href=url;a.download=plik;a.hidden=true;document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),5000);
      komunikat(tt("profEksportGotowy",{plik})+" "+T.profEksportBez);   // 10-15: wprost, czego plik nie przenosi
    }catch(e){komunikat(T.profEksportBlad,true);}
  }
  const BLEDY_IMPORTU={json:"profImportBladJson",format:"profImportBladFormat",pusty:"profImportBladPusty",rozmiar:"profImportBladRozmiar"};
  // Plik z dysku: wstępna kontrola (JSON, kształt), potem wybór Scal / Zastąp; właściwa walidacja w Postepy.importuj.
  function wczytajPlik(f){
    if(f.size>5e6){komunikat(T.profImportBladRozmiar,true);return;}
    f.text().then(tekst=>{
      let z=null;try{z=JSON.parse(tekst.trim());}catch(e){komunikat(T.profImportBladJson,true);return;}
      if(!z||typeof z!=="object"||!z.profile||typeof z.profile!=="object"||Array.isArray(z.profile)){komunikat(T.profImportBladFormat,true);return;}
      komunikat("");
      pokaz("import",{plik:f.name,tekst,n:Object.keys(z.profile).length,fokus:'.profil-pasek [data-akcja="import"]'});ustawFokus();
    },()=>komunikat(T.profImportBladOdczyt,true));
  }
  function importuj(tekst,tryb){
    const r=Postepy.importuj(tekst,tryb);
    if(!r.ok){komunikat(T[BLEDY_IMPORTU[r.blad]]||T.profImportBladFormat,true);pokaz(V.baza);ustawFokus();return;}
    komunikat("");odswiezLobby();
    pokaz("raport",r);ustawFokus();
  }

  // ---- klawiatura: przechwycenie, gdy okno jest otwarte (jak okno wyboru gracza w zabi-chor.js) ----
  addEventListener("keydown",e=>{
    if(!otwarte())return;
    if(/^F\d+$/.test(e.key))return;   // F2 / F3 menu deweloperskiego dalej działają
    e.stopImmediatePropagation();
    if(e.key==="Escape"){e.preventDefault();if(window.DzwiekiUI&&DzwiekiUI.zglos)DzwiekiUI.zglos("wstecz");wstecz();return;}   // dźwięk: ten nasłuch zatrzymuje keydown dzwieki-ui.js
    if(e.key==="Tab"){   // Tab krąży w oknie (aria-modal)
      const l=[...V.karta.querySelectorAll("button,input:not([type=file])")].filter(x=>!x.disabled&&x.getClientRects().length);
      if(!l.length)return;const i=l.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){e.preventDefault();l[l.length-1].focus();}else if(!e.shiftKey&&i===l.length-1){e.preventDefault();l[0].focus();}
      return;
    }
    const akcja={ArrowUp:"gora",ArrowDown:"dol",ArrowLeft:"lewo",ArrowRight:"prawo"}[e.key];
    const wPolu=e.target&&e.target.tagName==="INPUT"&&e.target.type==="text";
    if(akcja&&!(wPolu&&(akcja==="lewo"||akcja==="prawo"))&&!e.ctrlKey&&!e.altKey&&!e.metaKey){
      e.preventDefault();if(typeof nawigujLobby==="function")nawigujLobby(akcja);}
  },true);

  return {otworz,wybierz,zamknij,przypisz,lista:()=>Postepy.lista(),get otwarte(){return otwarte();},
    get tryb(){return otwarte()?V.tryb:null;}};
})();
// Punkt styku z lobby i harnessem: window.ZC.profile (zabi-chor.js tworzy window.ZC wcześniej).
if(window.ZC)window.ZC.profile=ZCProfile;
// ?profile=1: okno otwiera się samo po starcie (narzędzie testów; graczom wejście daje plakietka konta #menuKonto).
if(/^(1|true|tak)$/i.test(new URLSearchParams(location.search).get("profile")||""))
  setTimeout(()=>{try{ZCProfile.otworz();}catch(e){console.error(e);}},0);
