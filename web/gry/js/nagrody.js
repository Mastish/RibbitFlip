// RibbitBeat: animacja postępu po piosence (odblokowywanie osiągnięć, liczenie punktów, następna nagroda, atrakcyjne
// pokazanie tego, co odblokowane) i koło nagród (po podniesieniu poziomu zamiast konkretnej nagrody losowanie na kole
// spośród rzeczy, które pozostały; najpierw instrument/tło/efekt, potem rzecz z kategorii; najlepsze są legendarne;
// ostatnie losowanie daje dwie). Nakładka nad wynikami, sceny jedna po drugiej:
//   1 POSTĘP   (na człowieka z profilem): licznik zdobytej sławy, pasek poziomu przeskakujący przez zdobyte poziomy,
//   2 KOŁO     (na człowieka z wolnymi losowaniami): koło kategorii (instrument / efekt / tło), potem koło rzeczy z kategorii;
//              rzadkość: zwykły, rzadki, epicki, legendarny (złoty, z błyskiem i fanfarą); ostatnie losowanie daje dwie rzeczy;
//              od 10-18 (Postepy.SCENY_Z_KOLA) scena zużywa losowanie jak instrument i skin, darmowa jest tylko sekretna karta.
//              Wynik zapada w Postepy.losuj PRZED animacją (koło tylko go pokazuje). Skin i scena motywu mają wspólną nazwę z rodzajem
//              („Sushi · skin”, „Sushi · scena”: nazwaPary z zabi-chor.js),
//   3 NAGRODA  (osiągnięcia; scena z progu ekipy tylko przy starym modelu bez SCENY_Z_KOLA): scena z promieniami i iskrami,
//   4 NASTĘPNA (na koniec): następne losowanie z paskiem, ile jeszcze rzeczy każdej rzadkości zostało.
// Dalej: Enter, Spacja, klik; pomiń: Esc (nieodebrane losowania czekają na następną piosenkę). Wyłączane w ustawieniach
// (`animacjaPostepu`); wtedy otwiera się tylko koło, jeśli są wolne losowania. Ograniczony ruch: te same sceny bez rozpędu,
// licznika, promieni i iskier. Ładowany PO zabi-chor.js i kolo.js (S, T, Postepy, Glos, Kolo, ikonaFilc, fmtSlawa, fmtMnoznik,
// pokazProfil, sredniaSlawy, odmiana, drabinka, ruchOgraniczony, ZC_IKONY_GRY).
// API: Nagrody.pokaz(W), Nagrody.zamknij(), Nagrody.dalej(), Nagrody.przytrzymaj(wcisniete, kto), Nagrody.otwarte, Nagrody.zbierz(W),
// Nagrody.podgladZdobycia({kat,id,rzadkosc}) (10-18: sama karta zdobycia z dźwiękiem, bez zapisu; adres ?zdobycie=kat:id[:rzadkosc]).
const Nagrody=(function(){
  "use strict";
  const L=(pl,en)=>typeof RBJezyk!=="undefined"&&RBJezyk.wybierz?RBJezyk.wybierz(pl,en):pl;
  const TX={
    postep:L("Twój postęp","Your progress"),zdobyte:L("Zdobyta sława","Fame earned"),poziom:L("Poziom {n}","Level {n}"),
    poziomNowy:L("Poziom {n}!","Level {n}!"),dalej:L("Dalej","Next"),gotowe:L("Gotowe","Done"),pomin:L("Pomiń","Skip"),
    nowaPlansza:L("Nowa scena!","New scene!"),noweOsiagniecie:L("Nowe osiągnięcie!","New achievement!"),   // scena to scena, nie „motyw planszy”
    efektNr:L("Skin {n} z {z}","Skin {n} of {z}"),motywNr:L("Scena {n} z {z}","Scene {n} of {z}"),
    posluchaj:L("Posłuchaj","Listen"),nastepna:L("Następna nagroda","Next reward"),
    losowanie:L("losowanie nagrody","reward draw"),
    ile:L("jeszcze ok. {n} {p}","about {n} {p} to go"),
    piosenka:["piosenka","piosenki","piosenek"],piosenkaEn:["song","songs"],
    wszystko:L("Wszystko zdobyte!","Everything earned!"),katPusta:L("{k} ✓","{k} ✓"),
    wszystkoOpis:L("Cała droga odblokowana. Poziomy rosną dalej z każdą piosenką.",
      "The whole road is unlocked. Your levels keep growing with every song."),   // 10-18 (Z-88): bez obietnicy Studia, które otwiera tylko sekretna karta
    kto:L("Postęp: {nazwa}","Progress: {nazwa}"),
    nowyPoziomLos:L("+{n} {p}","+{n} {p}"),losowanieN:["losowanie","losowania","losowań"],losowanieEn:["draw","draws"],   // 10-18 (Z-05): odmiana
    kolo:L("Koło nagród","Reward wheel"),kolo2:L("Losowanie nagrody: {nazwa}","Reward draw: {nazwa}"),
    losowan:L("Losowań: {n}","Draws: {n}"),kreć:L("Losuj!","Spin!"),krecDalej:L("Losuj dalej ({n})","Spin again ({n})"),
    krecenie:L("Losuję…","Spinning…"),pytanie:L("Co wylosujesz?","What will you win?"),
    kategoria:L("Najpierw kategoria…","First, the category…"),rzecz:L("A teraz nagroda z kategorii…","Now a reward from the category…"),
    bonusTlo:L("Scena jest wspólna dla ekipy i nie zużywa losowania. Losuj dalej!","The scene is shared by the crew and doesn't use up the draw. Spin again!"),   // tylko stary model (Postepy.SCENY_Z_KOLA=false)
    bonusSekret:L("Sekretna karta! Nie zużywa losowania. Losuj dalej!","The secret card! It doesn't use up the draw. Spin again!"),
    logKat:L("Kategoria: {k}","Category: {k}"),logRzecz:L("Wylosowano: {r} ({rz})","Won: {r} ({rz})"),startLos:L("+1 losowanie na start","+1 starting draw"),
    studioTytul:L("Studio instrumentów odblokowane!","Instrument studio unlocked!"),
    studioOpis:L("Sekretna karta! To pracownia, w której zbudujesz własny instrument: wybierzesz brzmienie, pokręcisz gałkami, dasz mu obrazek i od razu zagrasz nim w piosence.",
      "The secret card! It's a workshop where you build your own instrument: pick a sound, turn the knobs, give it a picture and play it in a song right away."),
    studioGdzie:L("Gdzie? Menu główne, świecący przycisk „Studio instrumentów”.","Where? Main menu, the shining “Instrument studio” button."),
    studioKarta:L("Pracownia własnych instrumentów","Your own instrument workshop"),
    sekretStudio:L("Studio instrumentów","Instrument studio"),sekretOpis:L("Sekret","Secret"),
    ekipa:L("Ekipa","The crew"),postepEkipy:L("Wspólny postęp","Shared progress"),
    zaGraczy:L("×{x} za {n} graczy","×{x} for {n} players"),wspolneOpis:L("Nagrody zbieracie razem: każde losowanie i każda rzecz są dla całej ekipy.","You collect rewards together: every draw and every item is for the whole crew."),
    razemEt:L("Losujecie razem","You draw together"),razemInfo:L("Wszyscy losujecie razem","Everyone draws together"),
    razemKat:L("Przytrzymajcie przyciski wszyscy naraz, żeby naciągnąć koło","Everyone hold your buttons at once to wind up the wheel"),
    razemRzecz:L("Przytrzymajcie przyciski wszyscy naraz, żeby nabrać mocy","Everyone hold your buttons at once to build power"),
    razemCzeka:L("Jeszcze trzymać: {kto}","Still to hold: {kto}"),
    razemPusc:L("Moc rośnie! Kto pierwszy puści, ten kręci","Power is rising! First to let go spins it"),
    razemTrzyma:L("trzyma","holding"),
    zrMysz:L("lewy przycisk myszy","left mouse button"),zrSpacja:L("Spacja","Space"),zrEnter:L("Enter","Enter"),zrPad:L("przycisk A","A button"),zrKapsel:L("przycisk kapsla","cap button"),
    dubel:L("DUBEL! Ostatnie losowanie daje dwie nagrody naraz.","DOUBLE! The last draw gives two rewards at once."),
    gwarancja:L("Gwarancja: coś epickiego albo lepszego jest blisko!","Guarantee: something epic or better is close!"),
    zostaloRz:L("Jeszcze do wylosowania","Still to win"),
    brakLosowan:L("Brak wolnych losowań.","No draws left."),
    losujeKategorie:L("Losuję kategorię…","Drawing the category…"),przytrzymaj:L("Przytrzymaj przycisk, żeby nabrać mocy, i puść, kiedy chcesz","Hold the button to build power, release when you like"),
    przytrzymajKat:L("Przytrzymaj przycisk, żeby naciągnąć koło kategorii, i puść","Hold the button to wind up the category wheel, release to spin"),
    terazRzecz:L("teraz wylosuj nagrodę","now draw the reward"),
    kurtEt:L("Pasek nagród","Reward strip"),kurtOp:L("odsłoni się po wylosowaniu kategorii","opens once the category is drawn"),
    przytrzymajBtn:L("Przytrzymaj","Hold"),puscBtn:L("Puść!","Release!"),nabieraMocy:L("Moc rośnie… puść, kiedy chcesz!","Power is rising… release when you like!"),
    mocEt:L("MOC","POWER"),mocMax:L("MAX!","MAX!"),
    doNastepnego:L("Do następnego losowania","To the next draw"),poziomLos:L("Poziom {n} → {m}","Level {n} → {m}"),
    brakujeSlawy:L("jeszcze {n} sławy","{n} fame to go"),wszystkieLosowania:L("To wszystkie losowania na tej drodze!","That was every draw on this road!"),
    kapsleEt:L("Twoje losowania","Your draws"),kapselOp:L("Kapsel = jedno losowanie. Przytrzymaj, żeby wrzucić i nabrać mocy","Cap = one draw. Hold to insert it and build power"),
    wiecej:L("+{n}","+{n}"),dzwKat:L("Kategoria","Category"),dzwRzecz:L("Nagroda","Reward"),dzwCzeka:L("czeka","waits"),dzwGotowe:L("gotowe","done"),
    liczZostalo:L("Zostało losowań","Draws left"),liczOstatnie:L("Ostatnie losowanie!","Last draw!"),liczAria:L("Zostało losowań: {n}","Draws left: {n}"),   // 10-18: licznik żetonów
    podglad:L("Podgląd zdobycia","Unlock preview"),podgladJeszcze:L("▶ Jeszcze raz","▶ Replay"),podgladZamknij:L("Zamknij","Close"),
    podgladDzwiek:L("Kliknij, żeby włączyć dźwięk","Click to turn the sound on"),
    studioIdz:L("Zabierz mnie tam","Take me there"),
    studioZamkniete:L("Studio jest tu jeszcze zamknięte, a podgląd niczego nie odblokowuje.","The studio is still locked here, and the preview unlocks nothing.")};   // 10-18: podgląd zdobycia (tier lista), przycisk na karcie Studia
  const RZ={zwykly:L("Zwykły","Common"),rzadki:L("Rzadki","Rare"),epicki:L("Epicki","Epic"),legendarny:L("Legendarny","Legendary"),sekretny:L("Sekretny","Secret")};
  const RZ_MN={zwykly:L("zwykłe","common"),rzadki:L("rzadkie","rare"),epicki:L("epickie","epic"),legendarny:L("legendarne","legendary")};
  const KAT={instrument:L("Instrument","Instrument"),efekt:L("Skin","Skin"),plansza:L("Scena","Scene")};   // „Skin” zamiast „efekt”, bo brzmi bardziej po growemu
  const KAT_KOLOR={instrument:"#ec1a83",efekt:"#6cb33f",plansza:"#3d8fd6"};
  const KAT_IKONA={instrument:"instr-syntezator",efekt:"puchar",plansza:"styl-naszywka"};
  const KLAW_GRACZA={Space:"ws",Enter:"strzalki",NumpadEnter:"strzalki"};   // klawisz w nakładce → gracz klawiaturowy (wejscie.js KLAWIATURA)
  const OPIS_ZRODLA={mysz:TX.zrMysz,ws:TX.zrSpacja,strzalki:TX.zrEnter,pad:TX.zrPad,kapsel:TX.zrKapsel};
  const tt2=(s,o)=>String(s).replace(/\{(\w+)\}/g,(m,k)=>o&&k in o?o[k]:m);
  const PALETA=["#ec1a83","#eaa32b","#6cb33f","#3d8fd6","#faf6ee"];
  let box=null,sceny=[],nr=0,czasy=[],raf=0,powrot=null,sceneW=null,kolo=null,pasekG=null,devOpcje=null;   // devOpcje: {kat, rzadkosc} z panelu DEV
  const spokoj=()=>{try{return ruchOgraniczony();}catch(e){return false;}};
  const po=(ms,f)=>{const id=setTimeout(()=>{if(box)f();},ms);czasy.push(id);return id;};
  const czyscCzasy=()=>{for(const t of czasy)clearTimeout(t);czasy=[];cancelAnimationFrame(raf);raf=0;};
  const dzwiek=n=>{try{if(typeof DzwiekiUI!=="undefined"&&DzwiekiUI.graj)DzwiekiUI.graj(n);}catch(e){}};
  const nazwaInstr=id=>(T.instrumentyGracza&&T.instrumentyGracza[id])||id;
  const el2=(t,k,x)=>{const e=document.createElement(t);if(k)e.className=k;if(x!=null)e.textContent=x;return e;};
  const ile=n=>{const en=typeof RBJezyk!=="undefined"&&RBJezyk.en;
    return en?(n===1?TX.piosenkaEn[0]:TX.piosenkaEn[1]):odmiana(n,TX.piosenka[0],TX.piosenka[1],TX.piosenka[2]);};
  const ileLos=n=>{const en=typeof RBJezyk!=="undefined"&&RBJezyk.en;
    return en?(n===1?TX.losowanieEn[0]:TX.losowanieEn[1]):odmiana(n,TX.losowanieN[0],TX.losowanieN[1],TX.losowanieN[2]);};
  const ikonaUrl=n=>ZC_IKONY_GRY+n+".webp";
  // „studio” = sekret instrumentów (10-17); skin i scena z rodzajem: „Sushi · skin”, „Sushi · scena” (10-18, nazwaPary w zabi-chor.js)
  const para=(k,n)=>typeof nazwaPary==="function"?nazwaPary(k,n):n;
  const nazwaRzeczy=(k,id,nazwa)=>k==="instrument"?(id==="studio"?TX.sekretStudio:nazwaInstr(id)):para(k,nazwa||id);
  // Obrazek nagrody na karcie losowania: instrument = filcowa ikona, skin = głowa żaby w przebraniu motywu z OTWARTYMI ustami (glowa-2, środkowa
  // klatka śpiewu; uśmiechnięta, nie z zaklejonymi ustami), a motyw bez przebrania = śpiewająca żaba motywu (zaba-1); scena = tło.
  const maPrzebranie=id=>{try{return typeof Motywy!=="undefined"&&Motywy.maPrzebranie&&Motywy.maPrzebranie(id);}catch(e){return false;}};
  const obrazRzeczy=(k,id)=>k==="instrument"?{obraz:id==="studio"?null:ikonaUrl("instr-"+id)}:k==="efekt"?{obraz:grafikaMotywu(id,maPrzebranie(id)?"glowa-2.webp":"zaba-1.webp")}:{obraz:grafikaMotywu(id,"tlo.webp"),obrazKlasa:"tlo"};

  // ---- dane -> sceny ----
  function zbierz(W){
    const out={postepy:[],kola:[],nagrody:[],nastepne:[]};
    if(!W||!Array.isArray(W.osiagniecia))return out;
    const wiersze=W.osiagniecia.filter(x=>x&&x.slawa).slice(0,3),wielu=wiersze.length>1;
    const ekW=W.osiagniecia.map(x=>x&&x.ekipa).find(Boolean);
    // 10-17 (Postepy.WSPOLNE): jedna scena postępu ekipy (pula wspólna, mnożnik za liczbę graczy), jedno koło dla wszystkich,
    // osiągnięcia dalej każdego z osobna. Przy kilku ludziach koło wymaga przytrzymania przez każdego (scenaKola, `razem`).
    if(ekW&&ekW.wspolne&&wiersze.length){
      const gracze=wiersze.map(x=>S.gracze.find(q=>q.id===x.id)).filter(Boolean),pierwszy=wiersze[0];
      const kolor=!wielu&&gracze[0]?gracze[0].kolor:"#eaa32b",nazwa=wielu?TX.ekipa:pokazProfil(pierwszy.profil);
      const mn=[],ids=new Set();for(const x of wiersze)for(const m of x.slawa.mnozniki||[])if(!ids.has(m.id)){ids.add(m.id);mn.push(m);}
      out.postepy.push({wspolne:true,x:pierwszy,g:wielu?null:gracze[0]||null,gracze,kolor,nazwa,od:ekW.przed,do:ekW.po,zysk:Math.max(0,ekW.zysk),
        mnozniki:mn,ludzie:ekW.ludzie|0,mnG:ekW.mnoznikGraczy||1,nowe:(ekW.losowania&&ekW.losowania.nowe)|0});
      if(Postepy.losowania(pierwszy.profil)>0)out.kola.push({profil:pierwszy.profil,nazwa,kolor,wielu:false,razem:true,nowe:(ekW.losowania&&ekW.losowania.nowe)|0});
      for(const x of wiersze){const g=S.gracze.find(q=>q.id===x.id);
        for(const o of x.nowe||[])out.nagrody.push({typ:"osiagniecie",id:o.id,nazwa:o.nazwa,opis:o.opis,kolor:g?g.kolor:"#eaa32b",kto:pokazProfil(x.profil),wielu});}
      const e=Postepy.ekipa(),naGre=e.gry>=3?e.slawa/e.gry:Math.max(1,ekW.zysk);
      out.nastepne.push({profil:pierwszy.profil,kolor,nazwa,po:ekW.po,naGre,cel:Postepy.nastepnyCel(pierwszy.profil,"efekt")});
      for(const a of ekW.awanse||[])out.nagrody.push({typ:"plansza",id:a.id,nazwa:a.nazwa,kolor:"#eaa32b",stopien:a.stopien,kto:T.scenaPlansza});
      return out;
    }
    for(const x of wiersze){
      const g=S.gracze.find(q=>q.id===x.id),sl=x.slawa,od=Postepy.slawaRazem(sl.przed),doo=Postepy.slawaRazem(sl.po),zysk=Math.max(0,doo-od);
      const kolor=g?g.kolor:"#eaa32b",nazwa=pokazProfil(x.profil);
      const wolne=Postepy.losowania(x.profil);
      out.postepy.push({x,g,kolor,nazwa,od,do:doo,zysk,mnozniki:sl.mnozniki||[],nowe:(sl.losowania&&sl.losowania.nowe)|0});
      if(wolne>0)out.kola.push({profil:x.profil,nazwa,kolor,wielu,nowe:(sl.losowania&&sl.losowania.nowe)|0});
      for(const o of x.nowe||[])out.nagrody.push({typ:"osiagniecie",id:o.id,nazwa:o.nazwa,opis:o.opis,kolor,kto:nazwa,wielu});
      const naGre=sredniaSlawy(x.profil,zysk/(sl.mnoznik||1));
      out.nastepne.push({profil:x.profil,kolor,nazwa,po:doo,naGre,cel:Postepy.nastepnyCel(x.profil,"efekt")});
    }
    const ek=W.osiagniecia.map(x=>x&&x.ekipa).find(Boolean);
    if(ek){
      for(const a of ek.awanse||[])out.nagrody.push({typ:"plansza",id:a.id,nazwa:a.nazwa,kolor:"#eaa32b",stopien:a.stopien,kto:T.scenaPlansza});
      out.nastepne.push({plansza:true,kolor:"#eaa32b",nazwa:T.scenaPlansza,po:ek.po,naGre:ek.zysk||1,cel:Postepy.nastepnyCel(null,"plansza")});
    }
    return out;
  }

  // ---- szkielet nakładki ----
  function otworz(){
    powrot=document.activeElement;
    box=el2("div","");box.id="nagrody";box.setAttribute("role","dialog");box.setAttribute("aria-modal","true");box.setAttribute("aria-label",TX.postep);
    const karta=el2("div","karta ng-karta");
    const kropki=el2("div","ng-kropki");kropki.setAttribute("aria-hidden","true");
    sceneW=el2("div","ng-scena");sceneW.setAttribute("aria-live","polite");
    const akcje=el2("div","ng-akcje");
    const pomin=przyciskPomin(TX.pomin,"ng-pomin");pomin.onclick=()=>{if(!losowanieTrwa())zamknij();};   // 10-18: w trakcie losowania nie da się pominąć (inaczej można kręcić w nieskończoność)
    const dalej=el2("button","przycisk glowny ng-dalej",TX.dalej);dalej.type="button";dalej.id="ngDalej";
    // scena z przytrzymywaniem (koło): wciśnięcie i puszczenie idą do sceny, zwykły klik tylko tam, gdzie scena nie ma przytrzymania
    dalej.onclick=()=>{if(sceneW&&sceneW._przytrzymaj)return;dalejKrok();};
    dalej.addEventListener("pointerdown",e=>{if(sceneW&&sceneW._przytrzymaj&&e.button===0){e.preventDefault();sceneW._przytrzymaj(true,"mysz");}});
    akcje.append(pomin,dalej);karta.append(kropki,sceneW,akcje);box.append(karta);
    box.addEventListener("pointerdown",e=>{if(e.target===box&&!(sceneW&&sceneW._przytrzymaj))dalejKrok();});
    document.body.append(box);dalej.focus({preventScroll:true});
  }
  const glowny=()=>box&&box.querySelector("#ngDalej");
  function kropkiOdswiez(){
    const k=box.querySelector(".ng-kropki");k.replaceChildren();
    sceny.forEach((s,i)=>k.append(el2("i",i===nr?"ng-k akt":i<nr?"ng-k byla":"ng-k")));
    const d=glowny();if(d){d.hidden=false;d.textContent=nr>=sceny.length-1?TX.gotowe:TX.dalej;d.disabled=false;d.classList.remove("ng-losuj");}
  }
  function dalejKrok(){
    if(!box)return;
    if(podglad){podglad.jeszczeRaz();return;}   // podgląd zdobycia (10-18): Dalej = jeszcze raz, zamyka Zamknij albo Esc
    if(sceneW._przytrzymaj){sceneW._przytrzymaj(true);sceneW._przytrzymaj(false);return;}   // koło: klik bez trzymania = szybki start/dalej
    if(sceneW.dataset.zajeta==="1"){przyspiesz();return;}   // pierwszy klik kończy animację sceny, drugi idzie dalej
    if(nr>=sceny.length-1){zamknij();return;}
    nr++;pokazScene();
  }
  function przyspiesz(){
    czyscCzasy();sceneW.dataset.zajeta="0";
    const f=sceneW._koniec;if(typeof f==="function")f();
  }
  // losowanie trwa od wciśnięcia dźwigni do końca kręcenia (klasy laduje / kreci na dźwigni); wtedy Pomiń i Esc nie zamykają okna
  function losowanieTrwa(){return !!(box&&box.querySelector(".kolo-dzw.laduje,.kolo-dzw.kreci"));}
  function zamknij(cicho){
    if(!box)return;
    if(podglad){const p=podglad;podglad=null;p.sprzatnij();}   // podgląd zdobycia: zdejmuje nasłuch i klasę html, zgłasza zamknięcie oknu nadrzędnemu
    czyscCzasy();if(kolo){try{kolo.zniszcz();}catch(e){}kolo=null;}if(pasekG){try{pasekG.zniszcz();}catch(e){}pasekG=null;}
    zdejmijResize();box.remove();box=null;sceneW=null;sceny=[];
    try{if(typeof Glos!=="undefined"&&Glos.stopProbka)Glos.stopProbka();}catch(e){}
    try{if(typeof odswiezNagrodyDoOdbioru==="function")odswiezNagrodyDoOdbioru();}catch(e){}   // licznik „Odbierz nagrody” (menu, wyniki)
    // 10-18 (Z-14a): fokus wraca po odświeżeniu licznika; gdy przycisk-powrót się schował („Odbierz nagrody” po ostatnim
    // losowaniu) albo jest wyłączony, fokus idzie na pierwszy widoczny przycisk ekranu: „Zagraj” w menu, „Jeszcze raz” na wynikach
    if(!cicho){const cel=[powrot,document.getElementById("btnZagraj"),document.getElementById("btnJeszczeRaz")].find(widoczny);
      if(cel)try{cel.focus({preventScroll:true});}catch(e){}}
    powrot=null;
  }
  const widoczny=b=>!!(b&&b.isConnected&&b.focus&&b!==document.body&&!b.disabled&&!b.closest("[hidden]")&&b.getClientRects().length);
  // 10-18 (Z-31): puszczenie przycisku myszy słuchane raz dla całego modułu (wcześniej każde otwarcie dokładało dwa nasłuchiwacze na window)
  for(const ev of ["pointerup","pointercancel"])addEventListener(ev,()=>{if(box&&sceneW&&sceneW._przytrzymaj)sceneW._przytrzymaj(false,"mysz");},true);
  let naResizeAkt=null;   // nasłuch zmiany rozmiaru okna sceny koła, zdejmowany przy zmianie sceny i zamknięciu
  const zdejmijResize=()=>{if(naResizeAkt){removeEventListener("resize",naResizeAkt);naResizeAkt=null;}};

  // ---- sceny ----
  function pokazScene(){
    czyscCzasy();zdejmijResize();if(kolo){try{kolo.zniszcz();}catch(e){}kolo=null;}if(pasekG){try{pasekG.zniszcz();}catch(e){}pasekG=null;}
    const s=sceny[nr];sceneW.replaceChildren();sceneW.dataset.zajeta="0";sceneW._koniec=null;sceneW._przytrzymaj=null;
    box.dataset.scena=s.rodzaj;kropkiOdswiez();
    if(s.rodzaj==="postep")scenaPostepu(s.p);
    else if(s.rodzaj==="kolo")scenaKola(s.k);
    else if(s.rodzaj==="nagroda")scenaNagrody(s.n);
    else scenaNastepnej(s.lista);
  }
  const kapsel=(g,kolor)=>{const i=el2("img","ng-kapsel");i.alt="";i.src=(g&&g.obrazekKapsla)||"";i.style.setProperty("--kolor",kolor);return i;};

  // Scena 1: sława liczy się od 0 do zysku, pasek poziomu napełnia się i przeskakuje przez zdobyte poziomy.
  function scenaPostepu(p){
    const w=sceneW;w.style.setProperty("--kolor",p.kolor);
    const glowa=el2("div","ng-glowa"),ekipa=p.wspolne&&p.gracze&&p.gracze.length>1;
    if(ekipa){for(const g of p.gracze)if(g.obrazekKapsla)glowa.append(kapsel(g,g.kolor));}   // ekipa: kapsle wszystkich
    else if(p.g&&p.g.obrazekKapsla)glowa.append(kapsel(p.g,p.kolor));
    glowa.append(el2("b","ng-kto",ekipa?TX.postepEkipy:tt2(TX.kto,{nazwa:p.nazwa})));
    const licz=el2("div","ng-licznik"),wartosc=el2("b","ng-liczba","+0");licz.append(wartosc,el2("span","ng-liczba-et",TX.zdobyte));
    const chipy=el2("div","ng-chipy");
    for(const m of p.mnozniki)chipy.append(el2("span","ng-chip",m.id==="dzien"?tt(T.slawaDzien,{x:fmtMnoznik(m.x)}):tt(T.slawaSeria,{x:fmtMnoznik(m.x),n:m.dni})));
    if(p.mnG>1)chipy.append(el2("span","ng-chip ng-chip-gracze",tt2(TX.zaGraczy,{x:fmtMnoznik(p.mnG),n:p.ludzie})));   // 10-17: wspólna pula
    if(p.nowe>0)chipy.append(el2("span","ng-chip ng-chip-los",tt2(TX.nowyPoziomLos,{n:p.nowe,p:ileLos(p.nowe)})));
    if(ekipa)chipy.title=TX.wspolneOpis;
    const poz=el2("div","ng-poziom"),etP=el2("span","ng-poziom-et"),pas=el2("span","ng-pasek"),wyp=el2("span","ng-pasek-w");pas.append(wyp);
    const dop=el2("span","ng-pasek-opis");poz.append(etP,pas,dop);
    const nowyP=el2("div","ng-pop");nowyP.setAttribute("aria-live","assertive");
    w.append(glowa,licz,chipy,poz,nowyP);
    const ustaw=v=>{
      const z=Postepy.poziomGraczaZ(v),f=z.do!=null?(v-z.od)/Math.max(1,z.do-z.od):1;
      etP.textContent=tt2(TX.poziom,{n:z.poziom});wyp.style.width=(100*Math.max(0,Math.min(1,f))).toFixed(1)+"%";
      dop.textContent=z.do!=null?fmtSlawa(Math.max(0,z.do-v))+" → "+tt2(TX.poziom,{n:z.poziom+1}):"MAX";
      return z.poziom;
    };
    const koniec=()=>{wartosc.textContent="+"+fmtSlawa(p.zysk);ustaw(p.do);w._koniec=null;w.dataset.zajeta="0";};
    if(spokoj()||!(p.zysk>0)){koniec();return;}
    w.dataset.zajeta="1";w._koniec=koniec;
    let poz0=ustaw(p.od);const t0=performance.now(),DL=Math.min(2600,900+p.zysk*6);
    const krok=()=>{
      if(!box||sceneW!==w)return;
      const f=Math.min(1,(performance.now()-t0)/DL),e=1-Math.pow(1-f,3);
      wartosc.textContent="+"+fmtSlawa(Math.round(p.zysk*e));
      const nowy=ustaw(f>=1?p.do:p.od+(p.do-p.od)*e);
      if(nowy>poz0){poz0=nowy;poz.classList.remove("bijacy");void poz.offsetWidth;poz.classList.add("bijacy");
        nowyP.textContent=tt2(TX.poziomNowy,{n:nowy});nowyP.classList.remove("pokaz");void nowyP.offsetWidth;nowyP.classList.add("pokaz");
        dzwiek("odblokowanie");}
      if(f<1)raf=requestAnimationFrame(krok);else koniec();
    };
    raf=requestAnimationFrame(krok);
  }

  // ---- koło nagród ----
  // 10-17: koło kategorii ma zawsze trzy pola; kategoria bez niczego do wylosowania jest zgaszona (`wyl`), koło na niej nie staje
  const KATEGORIE=["instrument","efekt","plansza"];
  function segmentyKategorii(kategorie){
    return KATEGORIE.map(k=>({etykieta:kategorie.includes(k)?KAT[k]:tt2(TX.katPusta,{k:KAT[k]}),kolor:KAT_KOLOR[k],obraz:ikonaUrl(KAT_IKONA[k]),rzadkosc:null,wyl:!kategorie.includes(k)}));   // dla koła okrągłego
  }
  // Segmenty paska rzeczy: pozostałe z kategorii (do 24), a gdy ich mało (poniżej 9), uzupełnione już wygranymi, żeby na pasku nie
  // powtarzała się w kółko ta sama karta. `wymus` = id, które musi się znaleźć (wynik losowania).
  // 10-17: `sekret` = id sekretnej rzeczy kategorii (czarna holograficzna karta „?” na pasku), gdy jeszcze niezdobyta
  function segmentyRzeczy(k,pula,wymus,sekret){
    let ids=pula.slice().sort(()=>Math.random()-.5).slice(0,24);
    if(wymus&&!ids.includes(wymus))ids.push(wymus);
    // Rzeczy, które gracz już ma, nie są losowane: krótki pasek uzupełnia się powtórkami pozostałych rzeczy,
    // a nie już zdobytymi (wcześniej Postepy.wszystkieRzeczy), żeby na pasku nie migało to, czego wygrać się nie da
    const zrodlo=ids.length?ids.slice():(wymus?[wymus]:[]);
    for(let i=0;ids.length<9&&zrodlo.length;i++)ids.push(zrodlo[i%zrodlo.length]);
    ids.sort(()=>Math.random()-.5);
    if(sekret&&!ids.includes(sekret))ids.splice(Math.floor(Math.random()*(ids.length+1)),0,sekret);
    const seg=ids.map(x=>{
      if(x===sekret)return {etykieta:"?",rzadkosc:"sekretny",id:x,obraz:null,sekret:true};
      const r=Postepy.rzadkosc(k,x),w=k==="instrument"?null:(Postepy.drabinka(k==="plansza"?Postepy.TOR_PLANSZY:Postepy.TOR_GRACZA).find(q=>q&&q.id===x));
      return Object.assign({etykieta:k==="instrument"?nazwaInstr(x):(w?w.nazwa:x),rodzaj:k==="instrument"||typeof rodzajPary!=="function"?null:rodzajPary(k),rzadkosc:r,id:x},obrazRzeczy(k,x));   // 10-18: drugi wiersz „skin” / „scena”
    });
    return {seg,indeks:wymus?ids.indexOf(wymus):-1};
  }
  // Grafika motywu z uwzględnieniem wersji „naszywka” (ustawienie gry), gdy Motywy są załadowane.
  const grafikaMotywu=(id,plik)=>typeof Motywy!=="undefined"&&Motywy.sciezka?Motywy.sciezka(id,plik):"../assets/motywy/"+id+"/"+plik;
  const KAPSLE="../assets/caps/";
  // Karta wyniku do OTWARCIA (runda 8, „jakaś animacja i otwieranie”): rewers = filc w kolorze rzadkości ze znakiem zapytania, awers = rzecz.
  // Otwiera ją obrót 3D (klasa `otwarta`), potem wybuch (klasa `wybuch`): promienie i iskry wg rzadkości (zwykły 0, rzadki 8, epicki 16,
  // legendarny 30). Scena (plansza): tło motywu wypełnia awers, a spod dolnej krawędzi wyłażą żabki-fani tego motywu (fan-0..5.webp) i bujają się
  // w rytm jingle'a, żeby scena oprócz dźwięku pokazała też swoje żabki.
  function karta(r,k,id,nazwa,stopien,drugi){
    const d=el2("div","kolo-wynik rz-"+r+(drugi?" drugi":"")),obrot=el2("div","kolo-wynik-obrot"),tyl=el2("div","kolo-wynik-tyl"),przod=el2("div","kolo-wynik-przod");
    tyl.append(el2("b","kolo-wynik-pyt","?"),el2("span","kolo-odznaka",RZ[r]));
    const odznaka=el2("span","kolo-odznaka",RZ[r]),ik=el2("div","kolo-ikona");
    const ob=obrazRzeczy(k,id),im=el2("img",k==="instrument"?"ng-ikona-obraz":"ng-ikona-obraz kolo-obraz-"+(ob.obrazKlasa||"efekt"));
    const studio=k==="instrument"&&id==="studio";
    if(studio)ik.append(ikonaStudia(d));   // własna ikona po wylosowaniu: animowany pulpit
    else if(ob.obraz||k==="plansza"){im.src=k==="plansza"?grafikaMotywu(id,"tlo.webp"):ob.obraz;im.alt="";im.decoding="async";ik.append(im);}
    else ik.append(el2("b","kolo-wynik-pyt sekret","?"));
    const n=el2("h2","ng-nazwa",nazwaRzeczy(k,id,nazwa));
    const op=el2("p","ng-opis",studio?TX.studioKarta:k==="efekt"&&stopien!=null?tt2(TX.efektNr,{n:stopien,z:drabinka(Postepy.TOR_GRACZA).length}):k==="plansza"&&stopien!=null?tt2(TX.motywNr,{n:stopien,z:drabinka(Postepy.TOR_PLANSZY).length}):KAT[k]);   // 10-18: rodzaj jest już w nazwie („Sushi · skin”)
    przod.append(odznaka,ik,n,op);
    if(studio)przod.append(el2("p","kolo-studio-opis",TX.studioOpis),el2("p","kolo-studio-gdzie",TX.studioGdzie),przyciskDoStudia());   // co to jest, gdzie to znaleźć i „Zabierz mnie tam”
    if(k==="plansza"){
      przod.classList.add("scena");
      const fani=el2("div","kolo-fani");fani.setAttribute("aria-hidden","true");
      for(let i=0;i<6;i++){const f=el2("img","kolo-fan");f.src=grafikaMotywu(id,"fan-"+i+".webp");f.alt="";f.decoding="async";f.draggable=false;f.style.setProperty("--i",String(i));fani.append(f);}
      przod.append(fani);
    }
    obrot.append(tyl,przod);
    if(r==="epicki"||r==="legendarny"||r==="sekretny")d.append(el2("i","kolo-promienie"));
    d.append(obrot);
    const ile=spokoj()?0:({zwykly:0,rzadki:10,epicki:22,legendarny:44,sekretny:48}[r]||0);
    if(ile){const is=el2("div","ng-iskry");is.setAttribute("aria-hidden","true");
      for(let i=0;i<ile;i++){const s=el2("i","ng-iskra"),a=Math.random()*Math.PI*2,rr=100+Math.random()*190;
        s.style.setProperty("--dx",Math.round(Math.cos(a)*rr)+"px");s.style.setProperty("--dy",Math.round(Math.sin(a)*rr)+"px");
        s.style.setProperty("--d",(Math.random()*.5).toFixed(2)+"s");s.style.background=r==="legendarny"?PALETA[i%PALETA.length]:(i%3?KOLORY_RZ[r]:"#fff6c8");is.append(s);}
      d.append(is);}
    return d;
  }
  // Ikona Studia instrumentów (sekretna karta), 10-18: animowany pulpit z js/studio-ikona.js (ekran z widmem, gałki, suwaki,
  // klawisze, naklejka „Sekret”). Ekran stoi zgaszony z „?”, dopóki karta jest zakryta, i włącza się przy obrocie (klasa `otwarta`).
  // Klasa kolo-studio-ikona zostaje, bo szuka jej baner() i smoke'i.
  function ikonaStudia(karta){
    if(typeof StudioIkona==="undefined")return el2("b","kolo-wynik-pyt sekret","?");
    const d=StudioIkona.zbuduj({rozmiar:"duza",czekaj:()=>!karta.classList.contains("otwarta")});
    d.classList.add("kolo-studio-ikona");return d;
  }
  // Guzik „Zabierz mnie tam” pod „Gdzie? Menu główne, świecący przycisk Studio instrumentów”: zamyka nakładkę
  // i otwiera ekran Studia, jak kliknięcie przycisku w menu. Z wyników piosenki najpierw wychodzi do lobby (jak „Inna piosenka”), a
  // nieodebrane losowania czekają dalej w „Odbierz nagrody”. Studio zamknięte (podgląd w profilu bez sekretnej karty): komunikat
  // w podglądzie i nic się nie dzieje. W podglądzie z ramki tier listy okno zostaje otwarte (bez wiadomości o zamknięciu),
  // żeby ramka pokazała ekran Studia.
  function zabierzDoStudia(){
    let jest=false;try{if(typeof Studio!=="undefined"){Studio.odswiez();jest=!!Studio.dostepne();}}catch(e){}
    if(!jest){if(podglad)podglad.uwaga(TX.studioZamkniete);return false;}
    if(podglad)podglad.bezWiadomosci=true;
    zamknij(true);   // cicho: fokus nie wraca na „Zagraj” spod ekranu Studia
    try{
      if(typeof S!=="undefined"&&S.ekran!=="lobby"&&typeof przerwijGre==="function")przerwijGre("studioEkran");   // z wyników: wyjście do lobby od razu na ekran Studia
      else if(typeof pokazLobby==="function")pokazLobby("studioEkran");
    }catch(e){}
    return true;
  }
  function przyciskDoStudia(){
    const b=el2("button","przycisk glowny kolo-studio-idz",TX.studioIdz);b.type="button";
    b.addEventListener("click",ev=>{ev.stopPropagation();zabierzDoStudia();});
    return b;
  }
  const KOLORY_RZ={zwykly:"#b8a88a",rzadki:"#3d8fd6",epicki:"#8c5bd6",legendarny:"#eaa32b",sekretny:"#9ad6ff"};
  // Rozbłysk w kolorze rzadkości i jingiel wygranej rzeczy zamiast sygnału rzadkości: błysk ekranu w kolorze
  // rzadkości (--blysk), legendarny złoty i najdłuższy. W grafice uproszczonej bez błysku. Od 10-18 na poziomie modułu, bo błyska
  // też podgląd zdobycia (scenaKola dalej woła go po nazwie).
  const KOLOR_BLYSKU={zwykly:"#efe3cc",rzadki:"#bfe0ff",epicki:"#dcc8ff",legendarny:"#ffe08a",sekretny:"#ffffff"};
  const blysk=r=>{if(spokoj()||!box)return;box.style.setProperty("--blysk",KOLOR_BLYSKU[r]||KOLOR_BLYSKU.zwykly);box.classList.remove("blysk");void 0;
    requestAnimationFrame(()=>{if(box)box.classList.add("blysk");});po(r==="legendarny"?900:600,()=>{if(box)box.classList.remove("blysk");});};
  // Otwieranie karty: wylatuje z miejsca wylosowanej karty na pasku (FLIP: jedno odczytanie prostokątów), rośnie, obraca się rewersem do przodu
  // i otwiera; w połowie obrotu wybuch (iskry, promienie, dźwięk rzadkości). Zwraca obietnicę po otwarciu. `zrodlo` może być null (dubel).
  function otworzKarte(k,zrodlo,naWybuch){
    return new Promise(res=>{
      let lot=null;
      if(zrodlo&&!spokoj()){
        try{
          const a=zrodlo.getBoundingClientRect(),b=k.getBoundingClientRect();
          if(a.width&&b.width){const dx=(a.left+a.width/2)-(b.left+b.width/2),dy=(a.top+a.height/2)-(b.top+b.height/2),s=a.width/b.width;
            lot=k.animate([{transform:"translate("+dx.toFixed(1)+"px,"+dy.toFixed(1)+"px) scale("+s.toFixed(3)+")"},{transform:"none"}],{duration:560,easing:"cubic-bezier(.2,1.1,.3,1)"});
            zrodlo.classList.add("zabrana");}
        }catch(e){lot=null;}
      }
      const t1=spokoj()?0:(lot?340:140),t2=t1+(spokoj()?0:380);
      po(t1,()=>{k.classList.add("otwarta");});
      po(t2,()=>{k.classList.add("wybuch");
        // 10-18 większy impakt: fala uderzeniowa w kolorze rzadkości; epicki i wyższy wstrząsa kartą
        if(!spokoj()){const f=el2("i","kolo-fala");k.append(f);po(800,()=>f.remove());
          const c=box&&box.querySelector(".ng-karta");   // sekretna: miękkie odbicie; epicka i legendarna: wstrząs
          if(c&&/rz-sekretny/.test(k.className)){c.classList.remove("odbij");void c.offsetWidth;c.classList.add("odbij");po(600,()=>c.classList.remove("odbij"));}
          else if(c&&/rz-(epicki|legendarny)/.test(k.className)){c.classList.remove("wstrzas");void c.offsetWidth;c.classList.add("wstrzas");po(600,()=>c.classList.remove("wstrzas"));}}
        if(naWybuch)naWybuch();});
      po(t2+(spokoj()?0:360),res);
    });
  }
  // Kaskada „monet”: seria cyknięć i dzwonków (epicki krótka, legendarny długa)
  function kaskada(ile,od,krok){
    for(let i=0;i<ile;i++)setTimeout(()=>{try{Glos.cyk(.2+i/ile*.6,.8);if(i%3===2)Glos.dzwonek(80+i*2);}catch(e){}},od+i*krok);
  }
  // Sygnał rzadkości: cztery różne sztychy z jingle.js (zwykły, rzadki, epicki, legendarny). Zwraca czas trwania w sekundach.
  function dzwiekRzadkosci(r){
    let d=0;try{Glos.odblokuj();d=Jingle.rzadkosc(r)||0;}catch(e){}
    if(!d){dzwiek("odblokowanie");d=1;}
    if(r==="epicki")kaskada(6,400,60);else if(r==="legendarny"){kaskada(14,700,55);}
    return d;
  }
  // Temat po sygnale: instrument gra swoją frazę (Glos.fraza), scena i efekt grają jingle motywu (ten sam co na koniec piosenki).
  // Zwraca czas trwania tematu; wołający planuje go po sygnale rzadkości.
  function temat(kat,id){
    try{
      if(kat==="instrument"&&id==="studio"){Glos.fanfara();return 1.5;}   // sekret: Studio dźwięków
      if(kat==="instrument")return Glos.fraza(id)||0;
      if(typeof Jingle!=="undefined"&&Jingle.ma(id)){Jingle.graj(id);return Jingle.dlugosc(id);}
      Glos.fanfara();return 1.5;
    }catch(e){return 0;}
  }
  // Żabki sceny rechoczą jedna po drugiej, każda trochę wyżej (Glos.kum), gdy wyłażą spod karty.
  function rechotFanow(){
    for(let i=0;i<6;i++)try{Glos.kum(.55+i*.1,i*11,0);}catch(e){}
  }
  // Dźwięk mocy: ciągły niski głos („sub” z glos.js), którego wysokość i jasność rosną razem z paskiem mocy (bez pisku).
  function dzwiekMocy(){
    let g=null;
    return {
      start(){try{Glos.odblokuj();g=Glos.glos("sub",Glos.skala(1),0);g.ustaw(50,.1,0);g.spiewaj(true);}catch(e){g=null;}},
      ustaw(p){if(g)try{g.ustaw(50+p*26,.1+.55*p,p*6);}catch(e){}},
      stop(){if(!g)return;const v=g;g=null;try{v.spiewaj(false);setTimeout(()=>{try{v.zniszcz();}catch(e){}},700);}catch(e){}}
    };
  }
  // Ogień mocy: płomienie nad miernikiem (od ~55 % mocy, przy pełnej buchają). Runda 8: trzy sprite'y płomienia narysowane raz (gradient),
  // potem tylko drawImage z globalAlpha; do 90 cząsteczek, płótno 90 px wysokości.
  function ogienMocy(miernik,pasek){
    const cv=el2("canvas","kolo-ogien");cv.setAttribute("aria-hidden","true");miernik.append(cv);
    const c=cv.getContext("2d"),H=90;
    const SPR=[0,.5,1].map(f=>{const s=document.createElement("canvas");s.width=s.height=32;const g=s.getContext("2d"),gr=g.createRadialGradient(16,16,0,16,16,16);
      gr.addColorStop(0,"rgba(255,"+Math.round(240-130*f)+","+Math.round(150-130*f)+",.9)");gr.addColorStop(.5,"rgba(255,"+Math.round(110-70*f)+",20,.55)");gr.addColorStop(1,"rgba(200,30,10,0)");
      g.fillStyle=gr;g.fillRect(0,0,32,32);return s;});
    let cz=[],raf=0,p=0,tl=0,W=0,x0=0,szerP=0;
    // płótno w połowie rozdzielczości (CSS rozciąga do pełnej: płomienie są miękkie, a raster 4× tańszy); wymiary paska czytane raz na start ognia, nie co klatkę
    const dopasuj=()=>{W=miernik.clientWidth||400;x0=pasek.offsetLeft;szerP=pasek.offsetWidth;const w2=Math.round(W/2),h2=H/2;if(cv.width!==w2)cv.width=w2;if(cv.height!==h2)cv.height=h2;c.setTransform(.5,0,0,.5,0,0);};
    function krok(now){
      const dt=Math.min(.05,(now-tl)/1000||0);tl=now;
      const szer=szerP*p;
      const lambda=p>.5?(p-.5)*2*(p>=1?70:34):0;const ile=Math.floor(lambda*dt+Math.random());
      for(let i=0;i<ile&&cz.length<90;i++)cz.push({x:x0+Math.random()*Math.max(8,szer),y:H-4,vx:(Math.random()-.5)*34,vy:-(70+Math.random()*150)*(.7+p*.7),t:0,m:.4+Math.random()*.5,r:6+Math.random()*10*(.5+p)});
      c.clearRect(0,0,W,H);c.globalCompositeOperation="lighter";
      for(let i=cz.length-1;i>=0;i--){
        const q=cz[i];q.t+=dt;if(q.t>=q.m){cz.splice(i,1);continue;}
        q.x+=q.vx*dt+Math.sin(q.t*14+q.m*9)*18*dt;q.y+=q.vy*dt;
        const f=q.t/q.m,r=q.r*(1-f*.6);c.globalAlpha=(1-f)*.9;c.drawImage(SPR[f<.33?0:f<.66?1:2],q.x-r,q.y-r,r*2,r*2);
      }
      c.globalAlpha=1;c.globalCompositeOperation="source-over";
      if(p>0||cz.length)raf=requestAnimationFrame(krok);else{raf=0;c.clearRect(0,0,W,H);}
    }
    return {ustaw(m){p=Math.max(0,Math.min(1,m));if(!raf&&(p>.5||cz.length)){dopasuj();tl=performance.now();raf=requestAnimationFrame(krok);}},
      zniszcz(){cancelAnimationFrame(raf);raf=0;cv.remove();}};
  }
  // Przy losowaniu wyraźnie widać, ile losowań zostało, a animacja pokazuje zużycie losowania:
  // licznik jak wrzutnia automatu. Tabliczka na tacy szafki: napis, bębnowy licznik (duża cyfra w okienku) i rynienka
  // z żetonami (jeden żeton = jedno losowanie, widać do 10, reszta „+N”) zakończona szczeliną. Zużycie: skrajny żeton wjeżdża
  // w szczelinę, bęben przeskakuje o 1 w dół. Dopisane losowania: żetony wskakują po kolei, bęben liczy w górę, dymek „+N”.
  // Zwrot (sekretna karta nie zużywa losowania; scena od 10-18 zużywa, więc jej żeton nie wraca): żeton wyskakuje ze szczeliny. Przy 1 tabliczka mówi „Ostatnie
  // losowanie!”, przy 0 gaśnie. Ruch tylko skończony; ograniczony ruch: zmiana od razu.
  const ZETONY_MAX=10;
  function licznikLosowan(razem){
    const t=el2("div","kolo-razem-info kolo-licz");   // klasa kolo-razem-info zostaje: te same haki testów i progu czcionki co tabliczka z PK-02
    if(razem)t.append(el2("b","kolo-licz-razem",TX.razemInfo));
    const et=el2("span","kolo-licz-et",TX.liczZostalo),beben=el2("span","kolo-licz-beben"),cyfra=el2("b","kolo-licz-cyfra","0");
    const rynna=el2("span","kolo-licz-rynna"),szczel=el2("i","kolo-licz-szczel"),plus=el2("span","kolo-licz-plus","");
    beben.setAttribute("aria-hidden","true");rynna.setAttribute("aria-hidden","true");szczel.setAttribute("aria-hidden","true");
    beben.append(cyfra);t.append(et,beben,rynna,szczel,plus);
    let n=0,czasyL=[];
    const zeton=()=>el2("i","kolo-licz-zeton");
    const etykieta=()=>{t.classList.toggle("ostatnie",n===1);t.classList.toggle("zero",n<=0);et.textContent=n===1?TX.liczOstatnie:TX.liczZostalo;
      t.setAttribute("aria-label",tt2(TX.liczAria,{n}));};
    const rysuj=()=>{rynna.replaceChildren();for(let i=0;i<Math.min(n,ZETONY_MAX);i++)rynna.append(zeton());
      if(n>ZETONY_MAX)rynna.append(el2("span","kolo-licz-wiecej",tt2(TX.wiecej,{n:n-ZETONY_MAX})));etykieta();};
    // bęben: stara cyfra wyjeżdża, nowa wjeżdża (malejąco z góry, rosnąco z dołu), jak w mechanicznym liczniku
    const bebnuj=(z,na)=>{cyfra.textContent=String(na);if(spokoj()||z===na)return;
      const stara=el2("b","kolo-licz-cyfra stara",String(z));beben.append(stara);const k=na<z?-1:1,opcje={duration:300,easing:"cubic-bezier(.3,1.35,.5,1)"};
      try{cyfra.animate([{transform:"translateY("+(k*100)+"%)"},{transform:"none"}],opcje);
        stara.animate([{transform:"none"},{transform:"translateY("+(-k*100)+"%)"}],opcje).onfinish=()=>stara.remove();}catch(e){stara.remove();}
      try{beben.animate([{boxShadow:"inset 0 0 0 2px #4a443d,0 0 0 0 rgba(255,216,74,0)"},{boxShadow:"inset 0 0 0 2px #ffd84a,0 0 14px 3px rgba(255,216,74,.7)"},{boxShadow:"inset 0 0 0 2px #4a443d,0 0 0 0 rgba(255,216,74,0)"}],{duration:520});}catch(e){}};
    const skala=()=>{const m=t.closest(".kolo-maszyna"),r=m&&m.getBoundingClientRect();return r&&m.offsetWidth?r.width/m.offsetWidth:1;};
    const czysc=()=>{for(const id of czasyL)clearTimeout(id);czasyL=[];};
    const potem=(ms,f)=>{const id=po(ms,f);czasyL.push(id);};
    const api={el:t,get n(){return n;},
      ustaw(v){czysc();n=Math.max(0,v|0);cyfra.textContent=String(n);rysuj();},
      // jedno losowanie wpada do maszyny
      zuzyj(){
        czysc();if(n<=0)return;const z=n;n--;
        const ost=rynna.querySelectorAll(".kolo-licz-zeton"),zt=ost[ost.length-1]||null;   // przy „+N” rynienka po wrzucie dopełnia się z zapasu
        try{Glos.dzwonek(79);Glos.cyk(.6,1);}catch(e){}dzwiek("klik");
        if(spokoj()||!zt){bebnuj(z,n);rysuj();return;}
        // moneta leci z przycisku „Losuj” do szczeliny wrzutni (element w body, position:fixed ponad szafką, więc transform szafki jej nie ścina);
        // żeton w rynience zostaje, a dopełnia go rysuj() dopiero po wejściu monety
        // start: widoczna dźwignia (.kolo-dzw) albo ukryty przycisk Losuj (ngDalej) nie ma rozmiaru; bez niej moneta wpada z góry szczeliny
        let sz=null,r=null;
        try{sz=szczel.getBoundingClientRect();r=[...document.querySelectorAll(".kolo-dzw,#ngDalej")].map(e=>e.getBoundingClientRect()).find(q=>q.width>0&&q.height>0)||null;}catch(e){}
        const wrzuc=()=>{szczel.classList.remove("wrzut");void szczel.offsetWidth;szczel.classList.add("wrzut");bebnuj(z,n);etykieta();};
        if(!sz||!sz.width){potem(120,()=>{wrzuc();rysuj();});return;}
        const x1=Math.round(sz.left+sz.width/2),y1=Math.round(sz.top+sz.height/2),
          x0=r?Math.round(r.left+r.width/2):x1,y0=r?Math.round(r.top+r.height/2):Math.round(sz.top-90),dx=x1-x0,dy=y1-y0,D=900;
        const m=el2("div","kolo-moneta"),pion=el2("i","kolo-moneta-y"),twarz=el2("i","kolo-moneta-twarz");
        pion.append(twarz);m.append(pion);m.style.left=(x0-17)+"px";m.style.top=(y0-17)+"px";m.setAttribute("aria-hidden","true");document.body.append(m);
        const usun=()=>{try{m.remove();}catch(e){}};
        try{
          m.animate([{transform:"translateX(0)"},{transform:"translateX("+dx+"px)"}],{duration:D,easing:"cubic-bezier(.45,.05,.75,.6)",fill:"forwards"});
          pion.animate([{transform:"translateY(0)",easing:"cubic-bezier(.2,.7,.4,1)"},{transform:"translateY("+Math.min(-60,dy-70)+"px)",offset:.38,easing:"cubic-bezier(.6,0,.9,.6)"},
            {transform:"translateY("+dy+"px)"}],{duration:D,fill:"forwards"});
          twarz.animate([{transform:"rotateY(0) scale(1)",opacity:1},{transform:"rotateY(1080deg) scale(1.15)",opacity:1,offset:.8},
            {transform:"rotateY(1260deg) scaleX(.1) scaleY(.9)",opacity:1,offset:.97},{transform:"rotateY(1260deg) scaleX(.1) scaleY(.9)",opacity:0}],{duration:D,easing:"linear",fill:"forwards"}).onfinish=usun;
        }catch(e){usun();}
        po(D+200,usun);   // zapas: moneta znika także wtedy, gdy animacja nie wystartowała
        potem(D-60,()=>{wrzuc();
          try{for(let i=0;i<6;i++){const k=el2("i","kolo-iskra-m"),kat=(-90+(i-2.5)*34)*Math.PI/180,d=18+i%3*7;k.style.left=x1+"px";k.style.top=y1+"px";document.body.append(k);
            k.animate([{transform:"translate(-50%,-50%) scale(1)",opacity:1},{transform:"translate(calc(-50% + "+Math.round(Math.cos(kat)*d)+"px),calc(-50% + "+Math.round(Math.sin(kat)*d)+"px)) scale(.2)",opacity:0}],
              {duration:420,easing:"ease-out",fill:"forwards"}).onfinish=()=>k.remove();po(700,()=>k.remove());}}catch(e){}});
        potem(D+60,()=>{rysuj();});
      },
      // losowanie wraca (nie zużyło się): żeton wyskakuje ze szczeliny
      zwrot(v){czysc();const z=n;n=Math.max(0,v|0);if(n<=z){if(n<z)api.ustaw(n);return;}
        bebnuj(z,n);rysuj();if(spokoj())return;
        const zt=[...rynna.querySelectorAll(".kolo-licz-zeton")].pop();
        if(zt)try{let dx=0;const a=zt.getBoundingClientRect(),b=szczel.getBoundingClientRect();dx=((b.left+b.width/2)-(a.left+a.width/2))/skala();
          zt.animate([{transform:"translateX("+dx.toFixed(1)+"px) scaleX(.1)",opacity:0},{transform:"translateX("+(dx*.4).toFixed(1)+"px) translateY(-12px) rotate(-160deg)",opacity:1,offset:.5},{transform:"none"}],{duration:520,easing:"cubic-bezier(.2,1.2,.4,1)"});}catch(e){}
        szczel.classList.remove("wrzut");void szczel.offsetWidth;szczel.classList.add("wrzut");try{Glos.dzwonek(84);}catch(e){}
        api.dymek(n-z);
      },
      dymek(ile){if(!(ile>0))return;plus.textContent=tt2(TX.wiecej,{n:ile});plus.classList.remove("pokaz");void plus.offsetWidth;plus.classList.add("pokaz");},
      // dopisane losowania (po piosence): od `od` do `na`, żeton po żetonie
      dolicz(od,na){
        czysc();od=Math.max(0,od|0);na=Math.max(0,na|0);
        if(spokoj()||na<=od){api.ustaw(na);return;}
        api.ustaw(od);const kroki=na-od,krok=Math.max(90,Math.min(220,Math.round(900/kroki)));
        api.dymek(kroki);
        for(let i=1;i<=kroki;i++)potem(260+i*krok,()=>{const z=n;n=od+i;bebnuj(z,n);rysuj();
          const zt=n<=ZETONY_MAX?[...rynna.querySelectorAll(".kolo-licz-zeton")].pop():null;
          if(zt)try{zt.animate([{transform:"translateY(-16px) scale(.3)",opacity:0},{transform:"translateY(2px) scale(1.2)",opacity:1,offset:.6},{transform:"none"}],{duration:300,easing:"ease-out"});}catch(e){}
          try{Glos.cyk(.35+.5*i/kroki,.8);}catch(e){}});
      },
      dokoncz(v){czysc();if(n!==v)api.ustaw(v);}};
    return api;
  }
  // Scena koła (runda 8, 10-16). Jedna maszyna z czarnego filcu: u góry rząd KAPSLI (jeden kapsel = jedno losowanie, każdy to osobny przycisk;
  // wciśnięty wpada do szczeliny maszyny), w maszynie okrągłe koło kategorii z oknem odczytu, pod nim pasek rzeczy za kurtyną. Pod maszyną
  // miernik mocy i DWIE DŹWIGNIE: ① Kategoria, ② Rzecz; świeci ta, która jest w kolejce; przytrzymanie (dźwignia, kapsel, Spacja, Enter) nabija
  // moc, puszczenie wystrzeliwuje. Po zatrzasku karta wylatuje z paska, obraca się rewersem i OTWIERA (iskry, promienie, dźwięk rzadkości,
  // przy scenie żabki motywu). Wynik rzeczy zapada przy puszczeniu (Postepy.losuj z wybraną kategorią), maszyna go tylko pokazuje.
  function scenaKola(q){
    const w=sceneW;w.style.setProperty("--kolor",q.kolor);
    const ludzie=(S.gracze||[]).filter(g=>g&&g.zrodlo!=="bot"),razem=!!q.razem&&ludzie.length>1;   // 10-17: wspólne przytrzymanie
    const reczne=new Set(),chipy=new Map();
    const obecni=()=>ludzie.filter(g=>{try{return typeof Wejscie==="undefined"||!!Wejscie.gracz(g.id);}catch(e){return true;}});
    const trzyma=g=>{if(reczne.has(g.id))return true;try{const z=typeof Wejscie!=="undefined"&&Wejscie.gracz(g.id);return !!(z&&z.przycisk);}catch(e){return false;}};
    // Podpis u góry i okno poza częścią losującą wyglądały ubogo: naklejka tytułu i imię w jednym wierszu,
    // imię jako filcowa plakietka z kropką w kolorze gracza (--kolor ustawia scena), patrz .kolo-naglowek / .kolo-kto w gry-nagrody.css
    const naglowek=el2("div","kolo-naglowek"),kto=el2("b","ng-kto kolo-kto",q.wielu?tt2(TX.kolo2,{nazwa:q.nazwa}):q.nazwa);
    // Awatar konta w kółku w kolorze gracza, jak żeton w oknie wyboru planszy
    // (Awatary.dla daje domyślny dla gościa i kapsla bez konta); „Ekipa" i brak modułu awatarów = sama kropka koloru
    try{if(typeof Awatary!=="undefined"&&q.profil&&q.nazwa!==TX.ekipa){
      const id=Awatary.dla(Postepy.kluczProfilu(q.profil),Postepy.awatar(q.profil)),img=id&&Awatary.element(id,{klasa:"awatar kolo-kto-awatar",rozmiar:26});
      if(img){const znak=el2("i","kolo-kto-znak");znak.setAttribute("aria-hidden","true");znak.append(img);kto.prepend(znak);kto.classList.add("z-awatarem");}
    }}catch(e){}
    naglowek.append(el2("span","ng-naklejka",TX.kolo),kto);
    w.append(naglowek);
    // Szafka (wcześniej kształty były połamane, tekst się wylewał, a lampki stały nierówno): JEDEN korpus z czarnego
    // filcu o stałych wymiarach projektowych (548 px szerokości), skalowany transformem do wysokości okna (skaluj), więc w 720p nic się nie
    // przewija. Od góry: taca z kapslami i szczeliną, sekcja KATEGORIA (koło | tytuł, okno odczytu, dźwignia ①), sekcja RZECZ (okno paska,
    // dźwignia ②, obie za kurtyną), podstawa z miernikiem mocy; lampki w dwóch równych rzędach tylko na krawędziach korpusu.
    const kapsle=el2("div","kolo-kapsle");kapsle.setAttribute("role","group");kapsle.setAttribute("aria-label",TX.kapsleEt);
    const maszynaW=el2("div","kolo-maszyna-w"),maszyna=el2("div","kolo-maszyna"),cialo=el2("div","kolo-cialo"),status=el2("p","ng-opis kolo-status",TX.pytanie),wynik=el2("div","kolo-wyniki");
    // 10-21: `rz` = rzadkość wygranej ("zwykly"…"sekretny") albo "kat" dla nazwy kategorii; bez `rz` status wraca do zwykłego zdania
    const ustawStatus=(t,rz)=>{status.textContent=t;status.classList.toggle("rzadkosc",!!rz&&rz!=="kat");if(rz)status.dataset.rz=rz;else delete status.dataset.rz;};
    const lampki=k=>{const z=el2("div","kolo-lampki "+k);z.setAttribute("aria-hidden","true");for(let i=0;i<22;i++){const b=el2("i");b.style.setProperty("--k",String(i));z.append(b);}return z;};
    const taca=el2("div","kolo-taca");taca.append(kapsle);   // 10-17: bez szczeliny na kapsle (wspólna pula)
    const sekKat=el2("div","kolo-sekcja kat"),modKat=el2("div","kolo-mod-kat"),prawa=el2("div","kolo-prawa"),modLista=el2("div","kolo-mod-lista");
    prawa.append(el2("div","kolo-tyt",TX.dzwKat),modLista);sekKat.append(modKat,prawa);
    const sekRzecz=el2("div","kolo-sekcja rzecz"),modRzecz=el2("div","kolo-mod-rzecz");sekRzecz.append(modRzecz);
    // kurtyna: dwie połówki z fałdami zasłaniają sekcję RZECZ (pasek i dźwignia ②), dopóki nie padnie kategoria, potem rozsuwają się na boki
    const kurt=el2("div","kolo-kurtyna zamknieta"),kl=el2("div","kolo-kurt-p l"),kp=el2("div","kolo-kurt-p r"),ket=el2("div","kolo-kurt-et");
    ket.append(el2("b","",TX.kurtEt),el2("span","",TX.kurtOp));kurt.append(kl,kp,ket);sekRzecz.append(kurt);
    const lampy=(st,rz)=>{maszyna.dataset.stan=st;maszyna.dataset.rz=rz||"";};
    const miernik=el2("div","kolo-moc spi");
    const mEt=el2("span","kolo-moc-et",TX.mocEt),mPasek=el2("div","kolo-moc-pasek"),mKom=[];
    for(let i=0;i<24;i++){const c=el2("i","kolo-moc-kom");c.style.setProperty("--i",String(i));mPasek.append(c);mKom.push(c);}
    mPasek.append(el2("i","kolo-moc-blask"));
    const mMax=el2("span","kolo-moc-max","");miernik.append(mEt,mPasek,mMax);
    const ogien=ogienMocy(miernik,mPasek);
    cialo.append(taca,sekKat,sekRzecz,miernik);maszyna.append(lampki("g"),cialo,lampki("d"),wynik);maszynaW.append(maszyna);   // wynik otwiera się NA szafce
    // skala szafki: mieści się w wysokości karty (92vh minus nagłówek, status, dziennik i przyciski) i w jej szerokości
    const skaluj=()=>{const wys=maszyna.offsetHeight||600,szer=548,karta=box&&box.querySelector(".ng-karta");
      maszynaW.style.height=wys+"px";   // najpierw opakowanie w pełnej wysokości, żeby szafka (absolutna) nie wliczała się do reszty
      const reszta=karta?Math.max(0,karta.scrollHeight-wys):236;   // wszystko poza szafką, zmierzone (nagłówek, status, dziennik, przyciski, odstępy)
      const dH=Math.max(200,innerHeight*.92-reszta-6),dW=Math.min(innerWidth*.96,600)-52;
      const sk=Math.max(.4,Math.min(1,dH/wys,dW/szer));maszynaW.style.setProperty("--skala",sk.toFixed(3));maszynaW.style.height=Math.round(wys*sk)+"px";};
    zdejmijResize();naResizeAkt=()=>{if(box&&sceneW===w)skaluj();else zdejmijResize();};addEventListener("resize",naResizeAkt);
    // dwie dźwignie (prośba 10-16 „osobne przyciski do losowań”, potem „rzecz pod kręcącymi się napisami kategorii, a przycisk losowania
    // przedmiotu za kurtyną”): ① siedzi w maszynie pod oknem odczytu kategorii, ② stoi obok paska rzeczy za kurtyną i odsłania się razem z nim.
    // Wciśnięcie nieaktywnej tylko nią potrząsa.
    const dzw=(etap,nr,et)=>{const b=el2("button","kolo-dzw");b.type="button";b.dataset.etap=etap;
      b.append(el2("i","kolo-dzw-nr",nr),el2("b","kolo-dzw-et",et),el2("span","kolo-dzw-op",TX.dzwCzeka));
      b.addEventListener("pointerdown",e=>{if(e.button!==0)return;e.preventDefault();if(faza!==etap||stan==="kreci"){potrzas(b);return;}wejscie(true,"mysz");});
      b.addEventListener("keydown",e=>{if(e.code==="Space"||e.code==="Enter")e.preventDefault();});   // klawiatura idzie przez nakładkę (Nagrody)
      return b;};
    const dKat=dzw("kat","1",TX.dzwKat),dRzecz=dzw("rzecz","2",TX.dzwRzecz);
    const pokazDzwignie=tak=>{dKat.hidden=!tak;dRzecz.hidden=!tak;};
    const potrzas=b=>{try{b.animate([{transform:"translateX(0)"},{transform:"translateX(-5px)"},{transform:"translateX(5px)"},{transform:"translateX(0)"}],{duration:260});}catch(e){}try{Glos.cyk(.1,.5);}catch(e){}};
    const dziennik=el2("div","kolo-log");
    w.append(maszynaW,status,dziennik);
    const wpisz=(html)=>{const d=el2("div","kolo-log-w nowy");d.innerHTML=html;dziennik.prepend(d);while(dziennik.children.length>2)dziennik.lastChild.remove();};
    const dz=dzwiekMocy();
    let stan="start",wolne=Postepy.losowania(q.profil),kat=null,segRz=null,rafM=0,t0=0,moc=0,maxPokazany=false,ostCyk=0,faza="kat",kategorie=[],pasek=null,kapselAkt=null;
    const aktywny=()=>faza==="kat"?kolo:pasek;
    const dzwAkt=()=>faza==="kat"?dKat:dRzecz;
    // główny przycisk nakładki: schowany w czasie losowania (ruch robią dźwignie), wraca po objawieniu jako „Losuj dalej (n)” / „Dalej”
    const ustawGlowny=tekst=>{const d=glowny();if(d){d.hidden=!tekst;if(tekst)d.textContent=tekst;d.disabled=false;d.classList.toggle("ng-losuj",!!tekst&&tekst!==TX.dalej&&tekst!==TX.gotowe);}};
    const naKoniec=()=>nr>=sceny.length-1?TX.gotowe:TX.dalej;
    const ustawDzwignie=()=>{
      for(const b of [dKat,dRzecz]){const moja=b.dataset.etap===faza,akt=moja&&(stan==="gotowa"||stan==="laduje"),kreci=moja&&stan==="kreci",zrob=b.dataset.etap==="kat"&&faza==="rzecz";
        b.classList.toggle("akt",akt||kreci);b.classList.toggle("laduje",akt&&stan==="laduje");b.classList.toggle("kreci",kreci);b.classList.toggle("zrobiona",zrob);b.disabled=!akt&&!zrob&&!kreci;
        b.querySelector(".kolo-dzw-op").textContent=kreci?TX.krecenie:akt?(stan==="laduje"?TX.puscBtn:TX.przytrzymajBtn):zrob?(kat?KAT[kat.kat]:TX.dzwGotowe):TX.dzwCzeka;}
    };
    // Kapsle nad losowaniem nie mają już zastosowania, bo wszyscy losują razem: pula jest wspólna, więc
    // zamiast rzędu kapsli-przycisków jedna tabliczka z liczbą losowań; losuje się dźwigniami (kapselAkt zostaje null)
    // 10-18: zamiast samej tabliczki „Losowań: N” licznik żetonów (licznikLosowan); solo bez „Wszyscy losujecie razem” (Z-82).
    // `pokazanePierwsze`: pierwsze rysowanie w scenie liczy w górę od stanu sprzed piosenki (q.nowe dopisanych losowań)
    const licz=licznikLosowan(razem);kapsle.append(licz.el);let pokazanePierwsze=false;
    const rysujKapsle=()=>{
      kapselAkt=null;
      if(!pokazanePierwsze){pokazanePierwsze=true;const nowe=Math.min(wolne,q.nowe|0);if(nowe>0)licz.dolicz(wolne-nowe,wolne);else licz.ustaw(wolne);return;}
      if(wolne>licz.n)licz.zwrot(wolne);else licz.dokoncz(wolne);
    };
    const zywa=()=>box&&sceneW===w;
    const czekaj=ms=>new Promise(r=>po(spokoj()?0:ms,r));
    let ostN=-1;
    const poziomMocy=p=>{const n=Math.round(p*mKom.length);   // segmenty przełączane tylko, gdy zmienia się ich liczba (nie co klatkę)
      if(n!==ostN){ostN=n;mKom.forEach((c,i)=>c.classList.toggle("wl",i<n));miernik.classList.toggle("max",p>=1);miernik.classList.toggle("goraco",p>.7);}
      if(p<1&&mMax.textContent)mMax.textContent="";ogien.ustaw(p);};
    const baner=studioBylo=>{   // ostatni instrument wylosowany: Studio dźwięków pojawia się w menu samo
      let jest=false;try{Studio.odswiez();jest=Studio.dostepne();}catch(e){}
      if(jest&&!studioBylo&&!w.querySelector(".kolo-studio,.kolo-studio-ikona")){   // karta Studia sama mówi, co to i gdzie
        const b=el2("div","kolo-studio");b.append(el2("b","",TX.studioTytul),el2("span","",TX.studioOpis),el2("span","kolo-studio-gdzie",TX.studioGdzie),przyciskDoStudia());wynik.append(b);dzwiek("odblokowanie");}
    };
    const studioBylo=(()=>{try{return Studio.dostepne();}catch(e){return true;}})();
    // błysk ekranu w kolorze rzadkości: `blysk(r)` na poziomie modułu (10-18: dzieli go z podglądem zdobycia)
    if(wolne<=0){rysujKapsle();ustawStatus(TX.brakLosowan);ustawGlowny(naKoniec());maszynaW.hidden=true;return;}
    const rozmKola=200;   // wymiar projektowy szafki (sekcja 216 px), skalę nadaje skaluj()

    // 1) nowa runda: kapsle, koło kategorii, kurtyna zasunięta, dźwignia ① świeci
    const nowaRunda=async()=>{
      stan="start";wolne=Postepy.losowania(q.profil);wynik.replaceChildren();miernik.classList.add("spi");poziomMocy(0);lampy("idle");
      w._przytrzymaj=null;faza="kat";kat=null;rysujKapsle();maszyna.classList.remove("wynik");pokazDzwignie(true);
      // 10-18: kategorie jak w Postepy.losujKategorie (z sekretem w pustej kategorii, a po komplecie poziomów same sekrety); wcześniej
      // filtr po zwykłej puli gubił sam sekret i koło pisało „Brak wolnych losowań”, choć Postepy dawało 1 losowanie (Studio)
      const lk=Postepy.losujKategorie(q.profil);kategorie=lk?lk.kategorie.slice():[];
      if(!kategorie.length||wolne<=0){ustawStatus(TX.brakLosowan);stan="koniec";ustawGlowny(naKoniec());ustawDzwignie();w._przytrzymaj=wejscie;return;}
      if(kolo){try{kolo.zniszcz();}catch(e){}}
      modKat.replaceChildren();
      modLista.replaceChildren();kolo=Kolo.utworzKolo(modKat,modLista,rozmKola);kolo.ustawSegmenty(segmentyKategorii(kategorie));
      prawa.append(dKat);   // ① pod oknem odczytu kategorii
      if(!pasek){modRzecz.replaceChildren();pasek=Kolo.utworz(modRzecz);pasekG=pasek;modRzecz.append(dRzecz);}   // ② pod paskiem, oba za kurtyną
      skaluj();
      kurt.classList.add("zamknieta");
      if(pasek)po(spokoj()?0:700,()=>{try{pasek.ustawSegmenty([]);}catch(e){}});
      stan="gotowa";w._przytrzymaj=wejscie;miernik.classList.remove("spi");poziomMocy(0);miernik.classList.remove("drga");
      ustawStatus(TX.przytrzymajKat);ustawGlowny(null);ustawDzwignie();
    };
    const dzwiekKurtyny=()=>{try{Glos.wystrzal();Glos.dzwonek(92);}catch(e){}};
    // 2) kategoria padła: kurtyna się rozsuwa, karty wlatują, dźwignia ② świeci
    const przejdzDoRzeczy=async()=>{
      ustawStatus(KAT[kat.kat]+"!","kat");   // kategoria bez dźwięku, dźwięk niesie dopiero wygrana rzecz
      wpisz(tt2(TX.logKat,{k:"<b>"+KAT[kat.kat]+"</b>"}));
      await czekaj(650);if(!zywa())return;
      segRz=segmentyRzeczy(kat.kat,kat.pula[kat.kat],null,kat.pula.sekret&&kat.pula.sekret[kat.kat]).seg;   // ta taśma zostaje do końca losowania
      const gotowe=pasek.ustawSegmenty(segRz);pasek.bezczynnie(true);
      kurt.classList.remove("zamknieta");dzwiekKurtyny();pasek.wejscie();
      await Promise.all([czekaj(900),gotowe]);if(!zywa())return;
      faza="rzecz";stan="gotowa";w._przytrzymaj=wejscie;miernik.classList.remove("spi");poziomMocy(0);lampy("idle");
      ustawStatus(TX.przytrzymaj);ustawDzwignie();
    };
    // 3) moc rośnie, dopóki trzymasz
    const ladowanie=now=>{
      if(stan!=="laduje"||!zywa())return;
      const f=Math.min(1,(now-t0)/1900);moc=f*f*(3-2*f);   // gładki wzrost 0 → 1 w 1,9 s, potem pełna moc
      poziomMocy(moc);aktywny().moc(moc);dz.ustaw(moc);miernik.classList.toggle("drga",moc>.8);
      const odstep=230-202*moc;if(now-ostCyk>odstep){ostCyk=now;try{Glos.cyk(.15+moc*.8,.55+moc*.45);}catch(e){}}   // ratchet 230 → 28 ms
      if(f>=1&&!maxPokazany){maxPokazany=true;mMax.textContent=TX.mocMax;try{Glos.gwiazdka(5);Glos.dzwonek(96);}catch(e){}}
      rafM=requestAnimationFrame(ladowanie);
    };
    const start=()=>{
      stan="laduje";{const g=glowny();if(g)g.classList.add("wcisniety");}t0=performance.now();moc=0;maxPokazany=false;mMax.textContent="";dz.start();
      lampy("laduje");
      ustawStatus(razem?TX.razemPusc:TX.nabieraMocy);ustawDzwignie();rafM=requestAnimationFrame(ladowanie);
    };
    // 4) puszczenie: wynik zapada, koło/pasek jedzie tym dłużej, im większa moc
    const puszczono=async()=>{
      cancelAnimationFrame(rafM);{const g=glowny();if(g)g.classList.remove("wcisniety");}dz.stop();const p=Math.max(.06,moc);miernik.classList.remove("drga");try{Glos.wystrzal();}catch(e){}
      stan="kreci";w._przytrzymaj=wejscie;ustawStatus(TX.krecenie);ustawDzwignie();lampy("krec");
      miernik.classList.add("puszczone");po(600,()=>{miernik.classList.remove("puszczone");miernik.classList.remove("max");});
      if(faza==="kat"){   // koło kategorii: wynik kategorii (bez zapisu) i wystrzał koła
        kat=Postepy.losujKategorie(q.profil,devOpcje||undefined);
        if(!kat){ustawStatus(TX.brakLosowan);stan="koniec";ustawGlowny(naKoniec());ustawDzwignie();return;}
        poziomMocy(0);licz.dokoncz(wolne);licz.zuzyj();   // 10-18: losowanie rusza = żeton wpada do maszyny, licznik −1
        await kolo.krec(KATEGORIE.indexOf(kat.kat),{czas:2800+p*3600,obroty:Math.round(4+p*6)});if(!zywa())return;
        przejdzDoRzeczy();return;
      }
      const res=Postepy.losuj(q.profil,Object.assign({},devOpcje||{},{kat:kat.kat}));
      if(!res){ustawStatus(TX.brakLosowan);stan="koniec";ustawGlowny(naKoniec());ustawDzwignie();w._przytrzymaj=null;return;}
      // Taśma się NIE przebudowuje po puszczeniu ② (podmiana kart wyglądała na ustawione losowanie). Wynik jest
      // zwykle już na taśmie; gdy nie (pula > 24 karty), dochodzi jako nowa karta poza ekranem (Kolo dolacz). Sekret = karta „?”.
      let celIdx=(segRz||[]).findIndex(x=>x&&x.id===res.id);
      if(celIdx<0){const sr=segmentyRzeczy(res.kat,[res.id],res.id,res.sekret?res.id:null);celIdx=pasek.dolacz(sr.seg[sr.indeks]);}
      poziomMocy(0);
      if(res.kat==="plansza")for(let i=0;i<6;i++){const im=new Image();im.decoding="async";im.src=grafikaMotywu(res.id,"fan-"+i+".webp");}   // żabki ładują się w czasie jazdy
      await pasek.krec(celIdx,{czas:2800+p*4300,dystans:Math.round(26+p*34)});if(!zywa())return;
      // 5) objawienie: karta wylatuje z paska i otwiera się
      ustawStatus(RZ[res.r]+"!",res.r);miernik.classList.add("spi");lampy("wygrana",res.r);   // dźwignie zostają (wysokość szafki stała, nakładka je przygasza)
      wpisz(tt2(TX.logRzecz,{r:"<b>"+nazwaRzeczy(res.kat,res.id,res.nazwa)+"</b>",rz:RZ[res.r]}));
      const k1=karta(res.r,res.kat,res.id,res.nazwa,res.stopien);wynik.replaceChildren(k1);
      let dSyg=1,dTem=1.5;
      await otworzKarte(k1,pasek.wygranaKarta(),()=>{
        dSyg=.2;blysk(res.r);   // 10-17: bez sygnału rzadkości, rozbłysk w jej kolorze, temat rzeczy zaraz po błysku
        dTem=typeof Jingle!=="undefined"?(res.kat==="instrument"?3:Jingle.dlugosc(res.id)||1.5):1.5;
        po(Math.round(dSyg*1000),()=>{try{Glos.odblokuj();}catch(e){}dTem=temat(res.kat,res.id)||dTem;if(res.kat==="plansza")rechotFanow();});
      });if(!zywa())return;
      maszyna.classList.add("wynik");   // maszyna przygasa pod otwartą kartą („Losuj dalej” ją odsłania)
      if(res.sekret)po(900,()=>{ustawStatus(TX.bonusSekret);});
      else if(res.bonus)po(900,()=>{ustawStatus(TX.bonusTlo);});
      else if(res.gwarancja&&res.gwarancja.epicka&&!res.dubel&&res.r!=="epicki"&&res.r!=="legendarny")po(900,()=>{ustawStatus(TX.gwarancja);});
      if(res.dubel){
        await czekaj(Math.round((dSyg+dTem)*1000)+400);if(!zywa())return;
        wpisz(tt2(TX.logRzecz,{r:"<b>"+nazwaRzeczy(res.dubel.kat,res.dubel.id,res.dubel.nazwa)+"</b>",rz:RZ[res.dubel.r]})+" · dubel");
        ustawStatus(TX.dubel);const k2=karta(res.dubel.r,res.dubel.kat,res.dubel.id,res.dubel.nazwa,null,true);wynik.append(k2);
        await otworzKarte(k2,null,()=>{blysk(res.dubel.r);
          po(200,()=>{try{Glos.odblokuj();}catch(e){}temat(res.dubel.kat,res.dubel.id);if(res.dubel.kat==="plansza")rechotFanow();});});
        if(!zywa())return;
      }
      baner(studioBylo);
      wolne=Postepy.losowania(q.profil);rysujKapsle();stan="reveal";ustawDzwignie();
      ustawGlowny(wolne>0?tt2(TX.krecDalej,{n:wolne}):naKoniec());skaluj();
    };
    // przycisk, kapsel, dźwignia, Spacja, Enter: wciśnięcie (dol=true) i puszczenie (dol=false)
    function przytrzymaj(dol){
      if(!zywa())return;
      if(stan==="gotowa"&&dol)start();
      else if(stan==="laduje"&&!dol)puszczono();
      // stan „kreci”: kolejne wciśnięcie NIE zatrzymuje koła (10-18, zgłoszenie: klik w trakcie kręcenia ucinał losowanie); koło dokręca się do końca
      else if(stan==="reveal"&&dol){
        if(wolne>0)nowaRunda();
        else{w._przytrzymaj=null;dalejKrok();}
      }
      else if(stan==="koniec"&&dol){w._przytrzymaj=null;dalejKrok();}
    }
    // Każdy grający musi przytrzymać przycisk otwierania, bo losują wspólnie: przy dwóch i więcej ludziach
    // w składzie moc rośnie tylko wtedy, gdy przytrzymują WSZYSCY, każdy swoim przyciskiem (mysz: lewy przycisk, W/S: Spacja,
    // Strzałki: Enter, pad: A, kapsel: jego przycisk); kto pierwszy puści, ten wystrzeliwuje. Pad i kapsel czytane co klatkę z Wejscie,
    // mysz i klawiatura ze zdarzeń nakładki (nakładka zatrzymuje te klawisze, zanim dojdą do Wejscie). Gracz bez źródła (odłączony
    // pad) nie blokuje. Zatrzymanie jazdy i „Losuj dalej” robi każdy sam. Solo bez zmian.
    function wejscie(dol,zr){
      if(!razem){przytrzymaj(dol);return;}
      const zrodlo=zr==="mysz"?"mysz":KLAW_GRACZA[zr]||null;
      if(zrodlo)for(const g of ludzie)if(g.zrodlo===zrodlo){if(dol)reczne.add(g.id);else reczne.delete(g.id);}
      if(!zrodlo&&zr&&ludzie.some(g=>g.id===zr)){if(dol)reczne.add(zr);else reczne.delete(zr);}   // Nagrody.przytrzymaj(…, id gracza)
      if(stan==="gotowa"||stan==="laduje"){pilnujRazem();return;}
      if(dol)przytrzymaj(true);
    }
    let ostStatus="";
    function pilnujRazem(){
      if(!zywa())return;
      const ob=obecni(),wsz=ob.length>0&&ob.every(trzyma);
      for(const g of ludzie){const c=chipy.get(g.id);if(!c)continue;const t=trzyma(g),n=!ob.includes(g);
        if(c.classList.contains("trzyma")!==t)c.classList.toggle("trzyma",t);if(c.classList.contains("nieobecny")!==n)c.classList.toggle("nieobecny",n);}
      if(stan==="gotowa"&&wsz){ostStatus="";przytrzymaj(true);}
      else if(stan==="laduje"&&!wsz){ostStatus="";przytrzymaj(false);}
      else if(stan==="gotowa"){const brak=ob.filter(g=>!trzyma(g)).map(g=>g.nazwa);
        const t=brak.length&&brak.length<ob.length?tt2(TX.razemCzeka,{kto:brak.join(", ")}):(faza==="kat"?TX.razemKat:TX.razemRzecz);
        if(t!==ostStatus){ostStatus=t;ustawStatus(t);}}
    }
    if(razem){
      const pas=el2("div","kolo-razem");pas.setAttribute("role","group");pas.setAttribute("aria-label",TX.razemEt);
      pas.append(el2("span","kolo-razem-et",TX.razemEt));
      for(const g of ludzie){const c=el2("div","kolo-razem-gracz");c.style.setProperty("--kolor",g.kolor||"#eaa32b");
        const im=el2("img");im.src=g.obrazekKapsla||"";im.alt="";im.decoding="async";
        c.append(im,el2("b","",g.nazwa||""),el2("span","kolo-razem-zr",OPIS_ZRODLA[g.zrodlo]||""));chipy.set(g.id,c);pas.append(c);}
      w.insertBefore(pas,maszynaW);
      const petla=()=>{if(!zywa())return;pilnujRazem();requestAnimationFrame(petla);};requestAnimationFrame(petla);
    }
    w._przytrzymaj=wejscie;
    nowaRunda();
  }

  // Scena 3: osiągnięcie albo motyw planszy z progu ekipy na scenie z promieniami.
  function ikonaNagrody(n){
    const k=el2("div","ng-ikona");
    if(typeof ikonaFilc==="function")k.innerHTML=ikonaFilc(n.typ==="plansza"?"styl-naszywka":"puchar","ng-ikona-obraz");
    return k;
  }
  function scenaNagrody(n){
    const w=sceneW;w.style.setProperty("--kolor",n.kolor);
    const naglowek={plansza:TX.nowaPlansza,osiagniecie:TX.noweOsiagniecie}[n.typ];
    const scena=el2("div","ng-reflektor");scena.append(el2("i","ng-promienie"),ikonaNagrody(n));
    const iskry=el2("div","ng-iskry");iskry.setAttribute("aria-hidden","true");
    if(!spokoj())for(let i=0;i<14;i++){const s=el2("i","ng-iskra"),a=Math.random()*Math.PI*2,r=90+Math.random()*80;
      s.style.setProperty("--dx",Math.round(Math.cos(a)*r)+"px");s.style.setProperty("--dy",Math.round(Math.sin(a)*r)+"px");
      s.style.setProperty("--d",(Math.random()*.35).toFixed(2)+"s");s.style.background=PALETA[i%PALETA.length];iskry.append(s);}
    scena.append(iskry);
    const opis=el2("p","ng-opis");
    if(n.typ==="osiagniecie")opis.textContent=n.opis||"";
    else if(n.typ==="plansza")opis.textContent=tt2(TX.motywNr,{n:n.stopien,z:drabinka(Postepy.TOR_PLANSZY).length});
    w.append(el2("span","ng-naklejka",naglowek),scena,el2("h2","ng-nazwa",n.typ==="plansza"?para("plansza",n.nazwa):n.nazwa),opis);
    if(n.wielu)w.append(el2("span","ng-dla",n.kto));
    dzwiek("odblokowanie");
  }

  // Scena 4: pasek do kolejnego losowania (celowo bez nazw nagród): poziom, ile sławy brakuje i ile to piosenek.
  function scenaNastepnej(lista){
    const w=sceneW;w.style.setProperty("--kolor","#eaa32b");
    w.append(el2("span","ng-naklejka ng-naklejka-nast",TX.doNastepnego));
    for(const q of lista){
      if(q.plansza)continue;   // tła ekipy rosną z puli ekipy, nie z poziomu gracza
      const wiersz=el2("div","ng-nast ng-nast-los");wiersz.style.setProperty("--kolor",q.kolor);
      const z=Postepy.poziomGraczaZ(q.po);
      wiersz.append(el2("b","ng-nast-kto",q.nazwa));
      if(z.do==null){wiersz.append(el2("span","ng-nast-nazwa",TX.wszystkieLosowania));w.append(wiersz);continue;}
      const f=Math.max(0,Math.min(1,(q.po-z.od)/Math.max(1,z.do-z.od)));
      const pas=el2("span","ng-pasek ng-pasek-duzy"),wyp=el2("span","ng-pasek-w");pas.append(wyp);
      const brak=Math.max(0,z.do-q.po),n=Math.max(1,Math.ceil(brak/Math.max(1,q.naGre)));
      wiersz.append(el2("span","ng-nast-nazwa",tt2(TX.poziomLos,{n:z.poziom,m:z.poziom+1})),pas,
        el2("span","ng-nast-ile",tt2(TX.brakujeSlawy,{n:fmtSlawa(brak)})+" · "+tt2(TX.ile,{n,p:ile(n)})));
      w.append(wiersz);
      wyp.style.width="0%";po(150,()=>{wyp.style.width=(100*f).toFixed(1)+"%";});
    }
  }

  // ---- podgląd zdobycia (10-18) ----
  // Podgląd z listy nagród: guzik przy każdej rzeczy do odblokowania pokazuje ekran zdobycia po losowaniu
  // z dźwiękiem, do szybkiej weryfikacji. To ta sama karta, którą gracz dostaje po losowaniu na kole, bez szafki
  // i bez zapisu (profil, losowania i postęp zostają nietknięte). Zakryta karta wlatuje, obraca się, błysk w kolorze rzadkości,
  // potem temat rzeczy (fraza instrumentu albo jingiel motywu, rechot żabek sceny): ta sama kolejność co w scenaKola.
  // Opis: {kat, id, rzadkosc} albo napis "kat:id[:rzadkosc]". `kat`: instrument | efekt (skin) | plansza (scena) | motyw (skin
  // z przełącznikiem na scenę). `rzadkosc` wymusza wygląd karty (tier lista podaje ocenę osoby), bez niej Postepy.rzadkosc.
  // Wejścia: adres ?zdobycie= i postMessage {rb:"zdobycie",…} z okna nadrzędnego (na końcu pliku). Zamknięcie zgłasza oknu
  // nadrzędnemu {rb:"zdobycie-zamkniete"}, żeby tier lista zamknęła swoje okno razem z podglądem.
  const RZ_PODGLADU=["zwykly","rzadki","epicki","legendarny","sekretny"];
  let podglad=null;   // {ustaw(opis), jeszczeRaz(), sprzatnij()} gdy podgląd jest otwarty
  function opisPodgladu(o){
    if(typeof o==="string"){const m=o.split(":");o={kat:m[0],id:m[1],rzadkosc:m[2]};}
    if(!o||typeof o!=="object")return null;
    const id=String(o.id||"").replace(/[^\w.\-]/g,"").slice(0,40),motyw=o.kat==="motyw",kat=motyw?"efekt":o.kat;
    if(!id||!["instrument","efekt","plansza"].includes(kat))return null;
    return {id,kat,motyw,rzadkosc:RZ_PODGLADU.includes(o.rzadkosc)?o.rzadkosc:null};
  }
  // Nazwa i numer stopnia skina albo sceny z drabinki, rzadkość wymuszona albo z Postepy: jak w wyniku Postepy.losuj
  function rzeczPodgladu(kat,id,wymuszona){
    let nazwa=null,stopien=null;
    if(kat!=="instrument"){
      const d=Postepy.drabinka(kat==="plansza"?Postepy.TOR_PLANSZY:Postepy.TOR_GRACZA)||[],i=d.findIndex(q=>q&&q.id===id);
      if(i>=0){nazwa=d[i].nazwa;stopien=+d[i].stopien||i+1;}
    }
    return {nazwa,stopien,r:wymuszona||Postepy.rzadkosc(kat,id)||"zwykly"};
  }
  // fraza() i Jingle.graj() milczą przy uśpionym kontekście audio, więc podgląd budzi go przed otwarciem karty (czeka najwyżej 0,4 s)
  async function budzDzwiek(){
    let c=null;try{c=Glos.odblokuj();}catch(e){}
    if(c&&c.state==="suspended")try{await Promise.race([c.resume(),new Promise(r=>setTimeout(r,400))]);}catch(e){}
    return !!c&&c.state==="running";
  }
  function podgladZdobycia(o){
    const op=opisPodgladu(o);if(!op)return false;
    if(podglad&&box&&sceneW){podglad.ustaw(op);return true;}   // już otwarty (np. zmiana oceny w tier liście): przerysuj w miejscu
    if(box)zamknij(true);
    sceny=[{rodzaj:"podglad"}];nr=0;otworz();
    box.dataset.scena="podglad";box.setAttribute("aria-label",TX.podglad);
    try{if(window.parent!==window)box.classList.add("w-ramce");}catch(e){}   // w ramce (tier lista) zamyka okno nadrzędne, więc własnego „Zamknij” nie pokazujemy
    document.documentElement.classList.add("podglad-zdobycia");
    let aktualny=op,tura=0,dzwiekOk=true;
    const w=sceneW,akcje=box.querySelector(".ng-akcje"),pomin=box.querySelector(".ng-pomin"),dalej=glowny();
    const stage=el2("div","ng-podglad-scena"),wyniki=el2("div","kolo-wyniki"),info=el2("p","ng-opis ng-podglad-info");
    stage.append(wyniki);w.append(el2("span","ng-naklejka",TX.podglad),stage,info);
    const tekst=pomin.firstChild;if(tekst&&tekst.nodeType===3)tekst.nodeValue=TX.podgladZamknij;   // „Pomiń” → „Zamknij”, bez ikony przewijania
    const ikona=pomin.querySelector("svg");if(ikona)ikona.remove();
    dalej.textContent=TX.podgladJeszcze;dalej.hidden=false;dalej.disabled=false;dalej.classList.remove("ng-losuj");
    const przel=el2("div","ng-podglad-przel");przel.setAttribute("role","group");   // Skin | Scena (tylko dla motywu)
    for(const k of ["efekt","plansza"]){const b=el2("button","ng-podglad-kat",KAT[k]);b.type="button";b.dataset.kat=k;
      b.addEventListener("click",()=>{aktualny=Object.assign({},aktualny,{kat:k});odslon();});przel.append(b);}
    akcje.insertBefore(przel,dalej);
    // karta ma stały rozmiar projektowy (450 px), a okno bywa niższe (ramka tier listy, okno 720p): skala przez `scale`, bo `transform` zajmuje animacja wejścia
    const dopasuj=()=>{const k=box&&box.querySelector(".ng-karta"),c=wyniki.firstElementChild;if(!k)return;
      if(c)stage.style.height=(c.offsetHeight+16)+"px";   // karta instrumentu jest niższa niż karta sceny z żabkami: scena obejmuje ją ciasno
      k.style.setProperty("--sk","1");
      k.style.setProperty("--sk",Math.max(.4,Math.min(1,(innerHeight-24)/k.offsetHeight,(innerWidth-24)/k.offsetWidth)).toFixed(3));};
    const odslon=async()=>{
      const moja=++tura;czyscCzasy();try{if(typeof Glos.stopProbka==="function")Glos.stopProbka();}catch(e){}
      const rz=rzeczPodgladu(aktualny.kat,aktualny.id,aktualny.rzadkosc);
      przel.hidden=!aktualny.motyw;
      for(const b of przel.children)b.setAttribute("aria-pressed",String(b.dataset.kat===aktualny.kat));
      wyniki.replaceChildren();
      dzwiekOk=await budzDzwiek();if(moja!==tura||!box)return;
      info.hidden=dzwiekOk;info.textContent=dzwiekOk?"":TX.podgladDzwiek;   // uśpiony dźwięk: jedno kliknięcie w kartę go budzi (patrz stage niżej)
      const k1=karta(rz.r,aktualny.kat,aktualny.id,rz.nazwa,rz.stopien);wyniki.append(k1);dopasuj();
      if(!spokoj())try{k1.animate([{transform:"translateY(46px) scale(.55)",opacity:0},{transform:"none",opacity:1}],{duration:420,easing:"cubic-bezier(.2,1.1,.3,1)"});}catch(e){}
      await otworzKarte(k1,null,()=>{
        blysk(rz.r);
        po(200,()=>{try{Glos.odblokuj();}catch(e){}temat(aktualny.kat,aktualny.id);if(aktualny.kat==="plansza")rechotFanow();});
      });
    };
    stage.addEventListener("pointerdown",()=>{if(!dzwiekOk)odslon();});   // gest wewnątrz okna odblokowuje dźwięk (Glos.odblokuj w budzDzwiek idzie z tego samego zdarzenia)
    const naResize=()=>dopasuj();addEventListener("resize",naResize);
    let uwagaT=0;
    podglad={
      bezWiadomosci:false,   // true: zamknięcie nie idzie do okna nadrzędnego (przycisk „Zabierz mnie tam” zostawia ramkę z ekranem Studia)
      ustaw(nowy){aktualny=nowy;odslon();},
      jeszczeRaz(){odslon();},
      uwaga(tekst){info.textContent=tekst;info.hidden=false;clearTimeout(uwagaT);   // krótka uwaga pod kartą, potem wraca podpowiedź o dźwięku albo znika
        uwagaT=setTimeout(()=>{if(dzwiekOk)info.hidden=true;else info.textContent=TX.podgladDzwiek;},4000);},
      sprzatnij(){removeEventListener("resize",naResize);clearTimeout(uwagaT);document.documentElement.classList.remove("podglad-zdobycia");
        if(this.bezWiadomosci)return;
        try{if(window.parent&&window.parent!==window)window.parent.postMessage({rb:"zdobycie-zamkniete"},location.origin);}catch(e){}}
    };
    odslon();
    return true;
  }

  // ---- wejście ----
  function pokaz(W,wymus,tylkoKolo){
    if(box)zamknij(true);
    const d=zbierz(W);
    if(!d.postepy.length)return false;
    const wylaczona=!wymus&&!!(S.ust&&S.ust.animacjaPostepu===false);
    if((wylaczona||tylkoKolo)&&!d.kola.length)return false;   // bez animacji: tylko koło, jeśli czekają losowania
    sceny=[];
    if(!wylaczona&&!tylkoKolo)for(const p of d.postepy)sceny.push({rodzaj:"postep",p});
    for(const k of d.kola)sceny.push({rodzaj:"kolo",k});
    if(!wylaczona&&!tylkoKolo){
      for(const n of d.nagrody)sceny.push({rodzaj:"nagroda",n});
      sceny.push({rodzaj:"nastepna",lista:d.nastepne});
    }
    nr=0;otworz();pokazScene();
    return true;
  }
  addEventListener("keydown",e=>{
    if(!box)return;
    if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();if(!losowanieTrwa())zamknij();return;}
    if(e.code==="Space"||e.code==="Enter"||e.code==="NumpadEnter"){
      const a=document.activeElement;
      if(a&&a.classList&&(a.classList.contains("ng-pomin")||a.classList.contains("ng-posluchaj")||a.classList.contains("ng-podglad-kat")||a.classList.contains("kolo-studio-idz")))return;   // przycisk robi swoje
      e.preventDefault();e.stopImmediatePropagation();
      if(e.repeat)return;
      if(sceneW&&sceneW._przytrzymaj)sceneW._przytrzymaj(true,e.code);else dalejKrok();   // koło: trzymasz, żeby nabrać mocy (kod klawisza = który gracz)
      return;
    }
    if(/^(Arrow|Key|Digit)/.test(e.code))e.stopImmediatePropagation();
  },true);
  // DEV (panel F2): nakładka na żywych danych profilu bez grania piosenki. `zysk` = sława doliczona na pokaz (pasek rusza z
  // poziomu sprzed), losowania i następna nagroda są prawdziwe. Wymuszenia kategorii i rzadkości: opcje()
  function pokazDev(nazwa,zysk,tylkoKolo){
    const nm=nazwa||Postepy.GOSC,p=Postepy.profil(nm),po=Object.assign({},p.slawa),przed=Object.assign({},p.slawa),z=Math.max(0,+zysk||0);
    przed.streak=Math.max(0,(+po.streak||0)-z);
    const zyski={widownia:0,streak:z,tlo:0,klawisze:0};
    const poz=Postepy.poziomGraczaZ,pusto=!!(Postepy.nicDoLosowania&&Postepy.nicDoLosowania(nm));   // 10-17: nic do wylosowania = same poziomy
    // 10-17: przy wspólnej progresji pokaz na puli ekipy (pasek ekipy, jedno koło; przy kilku ludziach w składzie wspólne przytrzymanie)
    let ekipa=null;
    if(Postepy.WSPOLNE){const e=Postepy.ekipa(),ludzie=(S.gracze||[]).filter(g=>g&&g.zrodlo!=="bot").length,od=Math.max(0,e.slawa-z);
      ekipa={wspolne:true,przed:od,po:e.slawa,zysk:e.slawa-od,awanse:[],noweMotywy:[],ludzie,mnoznikGraczy:Postepy.mnoznikGraczy(ludzie),wklad:z,
        losowania:{nowe:pusto?0:Math.max(0,poz(e.slawa).poziom-poz(od).poziom),wolne:Postepy.losowania(nm)}};}
    return pokaz({osiagniecia:[{id:"dev",profil:p.nazwa,nowe:[],ekipa,slawa:{przed,po,zyski,zaGre:zyski,mnoznik:1,mnozniki:[],awanse:[],noweInstrumenty:[],
      losowania:{nowe:pusto?0:Math.max(0,poz(Postepy.slawaRazem(po)).poziom-poz(Postepy.slawaRazem(przed)).poziom),wolne:Postepy.losowania(nm)}}}]},true,!!tylkoKolo);
  }
  // Odbiór czekających losowań poza piosenką (10-17): przycisk „Odbierz nagrody” w menu i na wynikach otwiera samo koło
  function odbierz(nazwa){
    const nm=nazwa||Postepy.GOSC;
    if(!(Postepy.losowania(nm)>0))return false;
    return pokazDev(nm,0,true);
  }
  addEventListener("keyup",e=>{
    if(!box||!sceneW||!sceneW._przytrzymaj)return;
    if(e.code==="Space"||e.code==="Enter"||e.code==="NumpadEnter"){e.preventDefault();e.stopImmediatePropagation();sceneW._przytrzymaj(false,e.code);}
  },true);
  // 10-18 hak dla pada (PK-06): przytrzymanie przycisku A = przytrzymanie Spacji. `wcisniete` true/false, `kto` = źródło
  // ("mysz", kod klawisza "Space"/"Enter", "pad") albo id gracza (przy wspólnym losowaniu liczy się jako przytrzymanie tego gracza).
  // Scena bez przytrzymania: wciśnięcie = Dalej. Zwraca false, gdy nakładka zamknięta.
  function przytrzymajZew(wcisniete,kto){
    if(!box||!sceneW||(typeof S!=="undefined"&&S&&S.probaEkranow))return false;   // próba ekranów pod zasłoną startu: koło tylko się rysuje
    if(sceneW._przytrzymaj)sceneW._przytrzymaj(!!wcisniete,kto);
    else if(wcisniete)dalejKrok();
    return true;
  }
  const api={pokaz,pokazDev,odbierz,podgladZdobycia,zabierzDoStudia,zamknij:()=>zamknij(),dalej:()=>dalejKrok(),przytrzymaj:przytrzymajZew,get otwarte(){return !!box;},zbierz,dzwiekRzadkosci,temat,
    opcje:o=>{devOpcje=o&&(o.kat||o.rzadkosc)?{kat:o.kat||undefined,rzadkosc:o.rzadkosc||undefined}:null;},get devOpcje(){return devOpcje;}};
  if(typeof window!=="undefined"){window.Nagrody=api;if(window.ZC)window.ZC.nagrody=api;}
  // Wejścia do podglądu zdobycia (10-18): adres ?zdobycie=kat:id[:rzadkosc] (po zejściu zasłony wczytywania) i postMessage
  // {rb:"zdobycie", kat, id, rzadkosc} z okna nadrzędnego tego samego adresu (tier lista, gdy zmienia się ocena). Obce źródła ignorujemy.
  if(typeof window!=="undefined"){
    const poZaslonie=()=>typeof Wczytywanie!=="undefined"&&Wczytywanie.poWczytaniu?Wczytywanie.poWczytaniu():Promise.resolve();
    const otworzPodglad=o=>{try{podgladZdobycia(o);}catch(e){console.warn("RibbitBeat: podgląd zdobycia",e);}};
    try{const z=new URLSearchParams(location.search).get("zdobycie");
      if(z)addEventListener("load",()=>{poZaslonie().then(()=>setTimeout(()=>{if(!podglad)otworzPodglad(z);},200));});}catch(e){}   // podglad już stoi, gdy wyprzedził go postMessage z nowszą rzadkością
    addEventListener("message",ev=>{
      if(ev.origin!==location.origin||!ev.data||ev.data.rb!=="zdobycie")return;
      poZaslonie().then(()=>otworzPodglad(ev.data));
    });
  }
  return api;
})();
