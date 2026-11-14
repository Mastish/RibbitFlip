"use strict";
// RibbitBeat: próbki gracza dla Studia instrumentów (samplowanie audio, nagranie
// albo dogranie). Interfejs (karta „02 Próbka”) jest w studio.js, a cała obróbka
// dźwięku — nagrywanie, dekodowanie, granice ciszy, wycinek, poziom, zlepek pętli, wykrycie stroju, format WAV —
// we WSPÓLNYM z panelem ../js/probki-audio.js (`ProbkiAudio`). Tu zostaje to, co w grze jest inne niż w panelu:
// magazyn bajtów i wstawianie próbek do silnika gry.
//
// DECYZJE, KTÓRE TU MIESZKAJĄ:
//
//  • GDZIE LEŻĄ BAJTY: IndexedDB `zabi-chor` → magazyn `probki` (biblioteka.js, wersja bazy 3), klucz „p:<id>”.
//    localStorage trzyma tylko PARAMETRY instrumentu (kilkaset bajtów), bo cały zapis Studia ma ok. 5 MB limitu,
//    a jedna próbka to kilkaset kB. Zapis idzie OD RAZU po nagraniu (zanim ktoś kliknie „Zapisz instrument”),
//    więc po drodze powstają sieroty: `sprzataj()` przy starcie usuwa klucze, do których nie ma już instrumentu.
//
//  • JEDEN ZESTAW BAJTÓW, KILKA INSTRUMENTÓW: kopia instrumentu dzieli `probka.id` z pierwowzorem (nie dubluje
//    kilkuset kB), a wszystkie nastawy ma własne, bo niesie je RECEPTURA instrumentu.
//    Usunięcie instrumentu kasuje bajty tylko wtedy, gdy nikt inny ich nie używa (liczy to studio.js).
//
//  • CO DOSTAJE SILNIK (żeby użytkownik miał większą kontrolę): nie surowe bajty, tylko
//    WYNIK `ProbkiAudio.wytnij` — wycinek z poziomem, kierunkiem i zlepionym szwem pętli. Zestawy w silniku
//    nazywają się więc `u-<id>-<odcisk nastaw>`, a nie samo `u-<id>`: dwa instrumenty na tych samych bajtach
//    z różnym wycinkiem muszą mieć różne bufory, inaczej jeden nadpisywałby drugiemu brzmienie. Nastawy
//    domyślne (cały dźwięk, poziom 1,00×, bez pętli) zostają pod gołym `u-<id>` — po to, żeby instrumenty
//    zapisane przed tą zmianą miały dokładnie tę samą recepturę, co wczoraj.
//    Zestawów nie kasuje żaden licznik: usuwa je `sprzatajZestawy(żywe nazwy)`, wołane ze studio.js przy każdej
//    zmianie formularza. Inaczej przeciąganie pokrętła wycinka zostawiałoby po sobie megabajty buforów.
//
//  • FORMAT: WAV PCM16 mono 32 kHz — to samo, czym są próbki instrumentu Krzyk w web/assets/krzyk/, więc czyta je
//    ten sam parser, grają tym samym torem i mieszczą się w pliku z instrumentami jako base64. W pliku i w bazie
//    leżą BAJTY SUROWE (całe nagranie), bo wycinek jest nastawą instrumentu, nie właściwością nagrania.
const StudioProbki=(function(){
  const A=typeof ProbkiAudio!=="undefined"?ProbkiAudio:null;
  const SKLEP="probki",klucz=id=>"p:"+id;
  const nazwaZestawu=id=>"u-"+id;               // nazwa w tablicy próbek silnika (Glos.ustawProbki)
  const pamiec=new Map();                       // id → {dane:Float32Array, sr} — BAJTY, jeden egzemplarz na próbkę
  const zestawy=new Map();                      // nazwa w silniku → id próbki (tylko te policzone z nastaw)
  let ladowanie=Promise.resolve();

  // ---- magazyn bajtów (IndexedDB przez biblioteka.js) --------------------------------------------
  const maBaze=()=>typeof bibIdbSet==="function"&&typeof indexedDB!=="undefined";
  async function zapisz(id,prob){
    pamiec.set(id,{dane:prob.dane,sr:prob.sr});wyrejestruj(id);   // nowe bajty = stare bufory do wyrzucenia
    if(!maBaze())return false;
    try{await bibIdbSet(SKLEP,klucz(id),A.doWav(prob));return true;}catch(e){return false;}
  }
  async function wczytaj(id){
    if(pamiec.has(id))return pamiec.get(id);
    if(!maBaze())return null;
    const ab=await bibIdbGet(SKLEP,klucz(id));
    const w=ab?A.zWav(ab instanceof ArrayBuffer?ab:(ab.buffer||ab)):null;
    if(!w)return null;
    const p={dane:w.dane,sr:w.sr};pamiec.set(id,p);return p;
  }
  // Wczytanie wszystkich próbek, których szukają zapisane instrumenty. Zwraca obietnicę, na którą czeka zapis
  // do pliku (`gotowe()`): bez tego eksport zaraz po starcie mógłby pominąć bajty, których jeszcze nie ma w pamięci.
  function wczytajWiele(ids){
    const lista=Array.from(new Set((ids||[]).filter(Boolean)));
    ladowanie=Promise.all(lista.map(id=>wczytaj(id).catch(()=>null))).then(()=>true,()=>true);
    return ladowanie;
  }
  const gotowe=()=>ladowanie;
  async function usun(id){
    pamiec.delete(id);wyrejestruj(id);
    if(maBaze())try{await bibIdbDel(SKLEP,klucz(id));}catch(e){}
  }
  // Sieroty: bajty, do których nie ma już instrumentu (nagranie bez zapisu, usunięty instrument, przerwany import).
  async function sprzataj(uzywane){
    if(!maBaze()||typeof bibIdbKeys!=="function")return 0;
    const zyje=new Set((uzywane||[]).filter(Boolean).map(klucz));
    let ile=0;
    for(const k of await bibIdbKeys(SKLEP)){
      if(typeof k!=="string"||k.slice(0,2)!=="p:"||zyje.has(k))continue;
      await bibIdbDel(SKLEP,k);ile++;
    }
    return ile;
  }

  // ---- silnik ------------------------------------------------------------------------------------
  // Nastawy → nazwa zestawu w silniku. FNV-1a (ten sam skrót, co identyfikator utworu w piosenki.js), bo nazwa
  // ma być krótka i taka sama przy każdym uruchomieniu: po niej silnik trzyma bufory, a studio.js liczy, które
  // z nich jeszcze żyją.
  function odcisk(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
  const domyslna=e=>!e||(!(+e.od>0)&&!(+e.koniec>0)&&(e.poziom==null||+e.poziom===1)&&!e.wstecz&&!e.petla&&!(+e.zlep>0));
  function nazwaEdycji(id,e){
    if(domyslna(e))return nazwaZestawu(id);
    return nazwaZestawu(id)+"-"+odcisk([e.od||0,e.koniec||0,e.poziom==null?1:e.poziom,e.wstecz?1:0,e.zlep||0,
      e.petla?e.petla[0]+":"+e.petla[1]:""].join(","));
  }
  // Nazwa zestawu dla tych bajtów i tych nastaw, policzona leniwie — jak `probkiDla` w glos.js. Nazwa wraca
  // ZAWSZE, nawet gdy bajtów jeszcze nie ma w pamięci (dojeżdżają z IndexedDB): wtedy nic się nie rejestruje
  // i instrument gra zastępczym głosem z oscylatorów, dokładnie jak Krzyk przed wczytaniem swoich WAV-ów.
  function zarejestrujEdycje(id,e){
    const nazwa=nazwaEdycji(id,e),p=pamiec.get(id);
    if(!p||!A)return nazwa;
    if(zestawy.has(nazwa))return nazwa;
    const w=A.wytnij(p,e||{});
    if(!w||!w.dane.length)return nazwa;
    try{if(Glos.ustawProbki(nazwa,[{sr:w.sr,dane:w.dane,root:60,petla:w.petla}]))zestawy.set(nazwa,id);}catch(err){}
    return nazwa;
  }
  // Zestawy, do których nie ma już instrumentu ani formularza. Woła to studio.js po każdej zmianie, bo każdy
  // ruch pokrętła wycinka robi nowy zestaw, a jeden to do 1,5 MB w AudioBufferach na kontekst.
  function sprzatajZestawy(uzywane){
    const zyje=new Set((uzywane||[]).filter(Boolean));
    let ile=0;
    for(const nazwa of [...zestawy.keys()]){
      if(zyje.has(nazwa))continue;
      try{Glos.usunProbki(nazwa);}catch(e){}
      zestawy.delete(nazwa);ile++;
    }
    return ile;
  }
  function wyrejestruj(id){
    for(const [nazwa,wlasciciel] of [...zestawy.entries()]){
      if(wlasciciel!==id)continue;
      try{Glos.usunProbki(nazwa);}catch(e){}
      zestawy.delete(nazwa);
    }
  }
  const wPamieci=id=>pamiec.get(id)||null;
  const wav=id=>{const p=pamiec.get(id);return p?A.doWav(p):null;};             // SUROWE bajty: tak jadą do pliku
  const wavB64=id=>{const ab=wav(id);return ab?A.b64(ab):null;};
  // „Zapisz WAV” w Studiu: to, CO SŁYCHAĆ (wycinek z poziomem i kierunkiem), bo po to się zapisuje próbkę
  // do pliku — żeby komuś dać albo wziąć do innego programu to, co gra instrument.
  const wavEdycji=(id,e)=>{const p=pamiec.get(id);if(!p||!A)return null;const w=A.wytnij(p,e||{});return w?A.doWav(w):null;};
  const kontekst=()=>{try{return Glos.odblokuj();}catch(e){return null;}};

  return {SR:A?A.SR:32000,MAKS_SEK:A?A.MAKS_SEK:12,MIN_PROBEK:A?A.MIN_PROBEK:600,
    nazwaZestawu,nazwaEdycji,zarejestrujEdycje,sprzatajZestawy,
    nowyId:()=>A.nowyId(),
    // obróbka dźwięku: wspólna z panelem (../js/probki-audio.js), tu tylko pod ręką pod nazwami, których używa studio.js
    doWav:p=>A.doWav(p),zWav:ab=>A.zWav(ab),b64:ab=>A.b64(ab),zB64:t=>A.zB64(t),
    normalizuj:(d,sr)=>A.normalizuj(d,sr),granice:(d,sr)=>A.granice(d,sr),
    wytnij:(p,e)=>A.wytnij(p,e),wycinek:(p,e)=>A.wycinek(p,e),wykryjRoot:(d,sr)=>A.wykryjRoot(d,sr),SZCZYT:A?A.SZCZYT:.9,
    zPliku:plik=>A.zPliku(plik,kontekst()),toDzwiek:f=>A.toDzwiek(f),
    obslugiwane:()=>A.obslugiwane(),nagrywa:()=>A.nagrywa(),podsluchuje:()=>A.podsluchuje(),
    urzadzenia:()=>A.urzadzenia(),naZmianeUrzadzen:fn=>A.naZmianeUrzadzen(fn),
    nagraj:(cb,opcje)=>A.nagraj(kontekst(),cb,opcje),podsluch:(cb,urz)=>A.podsluch(kontekst(),cb,urz),
    stopPodsluch:()=>A.stopPodsluch(),stop:()=>A.stop(),zamknij:()=>A.zamknij(),
    zapisz,wczytaj,wczytajWiele,gotowe,usun,sprzataj,wyrejestruj,wPamieci,wav,wavB64,wavEdycji};
})();
if(typeof window!=="undefined")window.StudioProbki=StudioProbki;
