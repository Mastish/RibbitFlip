"use strict";
// RibbitBeat: język gry, polski albo angielski (2026-10-10).
// Ładowany PIERWSZY, przed piosenki.js: każdy następny plik może zapytać RBJezyk.en przy wczytaniu (motywy.js,
// postepy.js i piosenki.js podmieniają napisy definicji od razu, zabi-chor.js nakłada słownik RB_EN.T na T).
//
// SKĄD JĘZYK NA STARCIE (pierwszy głos, który coś mówi, wygrywa). Aplikacja domyślnie
// uruchamia się po polsku, więc głosują TYLKO jawne wybory człowieka, a język Windows i przeglądarki nie:
//   1. ?jezyk=pl|en w adresie: harness i zrzuty, niczego nie zapisuje;
//   2. wybór w grze (przełącznik PL/EN w menu albo język konta, js/konta.js; localStorage „ribbitflip.zabiChor.jezyk”
//      = {jezyk, aplikacja}), ale tylko dopóki jawny wybór w aplikacji RibbitFlip jest ten sam co w chwili wyboru
//      w grze: późniejsze kliknięcie języka w panelu to nowsza decyzja, więc gra znowu idzie za aplikacją;
//   3. jawny wybór w panelu RibbitFlip: „ribbitflip.lang” (panel zapisuje go WYŁĄCZNIE po kliknięciu przełącznika,
//      gra pod /web/gry/ ma ten sam origin). RIBBITFLIP_LANG z serwera nie głosuje, bo serwer notuje też język
//      wykryty z Windows (rekomendacja „do odwrócenia”: jawny wybór w panelu przechodzi na grę);
//   4. polski.
// RIBBITFLIP_SYS_LANG i navigator.languages zostają wyłącznie w diagnostyce (RBJezyk.system).
//
// API dla innych plików (np. lobby-scena.js):
//   RBJezyk.jezyk        "pl" | "en"            RBJezyk.en   true dla angielskiego
//   RBJezyk.loc          "pl-PL" | "en-US"      do toLocaleString / localeCompare
//   RBJezyk.wybierz(pl,en) albo RBJezyk.wybierz({pl,en})   napis w bieżącym języku (brak EN = polski)
//   RBJezyk.ustaw(j)     zapisuje wybór, wysyła zdarzenie „rb-jezyk” na window (detail.jezyk), potem przeładowuje
//                        stronę: gra składa napisy przy budowie ekranów, więc przeładowanie jest najpewniejsze
//   RBJezyk.blad(tekst)  znane polskie komunikaty parsera MIDI, analizatora i serwera po angielsku (RB_EN.bledy)
//   RBJezyk.skad         skąd wziął się język (diagnostyka: "adres" | "gra" | "aplikacja" | "domyslny"; RBJezyk.system = język Windows albo przeglądarki, tylko informacyjnie)
const RBJezyk=(function(){
  const KLUCZ="ribbitflip.zabiChor.jezyk",KLUCZ_APLIKACJI="ribbitflip.lang";
  const ok=j=>j==="pl"||j==="en";
  const czytaj=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
  // jawny wybór w panelu aplikacji (tylko kliknięcie przełącznika zapisuje „ribbitflip.lang”)
  function jezykAplikacji(){const s=czytaj(KLUCZ_APLIKACJI);return ok(s)?s:null;}
  // język systemu i przeglądarki: tylko do diagnostyki, celowo nie wybiera języka gry
  function jezykSystemu(){
    try{if(ok(window.RIBBITFLIP_SYS_LANG))return window.RIBBITFLIP_SYS_LANG;}catch(e){}
    try{const l=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""];
      const k=Array.prototype.map.call(l,x=>String(x||"")).filter(Boolean);if(k.length)return k.some(x=>/^pl(-|_|$)/i.test(x))?"pl":"en";}catch(e){}
    return null;
  }
  function wykryj(){
    try{const q=new URLSearchParams(location.search).get("jezyk");if(ok(q))return [q,"adres"];}catch(e){}
    const apl=jezykAplikacji();
    try{
      const z=JSON.parse(czytaj(KLUCZ)||"null");
      if(z&&ok(z.jezyk)&&(!apl||z.aplikacja===apl))return [z.jezyk,"gra"];
    }catch(e){}
    if(apl)return [apl,"aplikacja"];
    return ["pl","domyslny"];
  }
  const [jezyk,skad]=wykryj();
  const en=jezyk==="en";
  try{document.documentElement.lang=jezyk;}catch(e){}
  function wybierz(pl,enTekst){
    if(pl&&typeof pl==="object")return en&&pl.en!=null?pl.en:pl.pl;
    return en&&enTekst!=null?enTekst:pl;
  }
  function ustaw(j){
    if(!ok(j)||j===jezyk)return;
    try{localStorage.setItem(KLUCZ,JSON.stringify({jezyk:j,aplikacja:jezykAplikacji()}));}catch(e){}
    try{window.dispatchEvent(new CustomEvent("rb-jezyk",{detail:{jezyk:j}}));}catch(e){}
    // ?jezyk= w adresie wygrałby z zapisem, więc przy przeładowaniu znika z adresu
    try{
      const u=new URL(location.href);
      if(u.searchParams.has("jezyk")){u.searchParams.delete("jezyk");location.replace(u.toString());return;}
    }catch(e){}
    location.reload();
  }
  function blad(tekst){
    if(!en||tekst==null)return tekst;
    let s=String(tekst);const b=typeof RB_EN!=="undefined"&&RB_EN&&RB_EN.bledy||[];
    for(const [wz,zam] of b)s=s.replace(wz,zam);   // wzorce z flagą g: zamieniają wszystkie wystąpienia
    return s;
  }
  return {jezyk,en,loc:en?"en-US":"pl-PL",skad,get system(){return jezykSystemu();},wybierz,ustaw,blad};
})();
// const skryptu nie jest właściwością window; window.RBJezyk dla harnessów i konsoli
try{window.RBJezyk=RBJezyk;}catch(e){}
// Przełącznik PL/EN w stopce menu głównego (#menuJezyk, 10-10; wcześniej siedział w ustawieniach kroku Rozgrywka).
// Napisy obu przycisków są stałe (PL, EN), więc nie czekają na słownik T.
(function(){
  if(typeof document==="undefined"||typeof document.getElementById!=="function")return;   // harness Node bez DOM
  function podepnij(){
    const g=document.getElementById("menuJezyk");if(!g||g.dataset.podpiety)return;g.dataset.podpiety="1";
    g.setAttribute("aria-label",RBJezyk.wybierz("Język gry","Game language"));
    for(const b of g.querySelectorAll("button[data-jezyk]")){
      const j=b.dataset.jezyk,biezacy=j===RBJezyk.jezyk;
      b.setAttribute("aria-pressed",String(biezacy));
      b.title=j==="pl"?"Polski":"English";
      b.addEventListener("click",()=>{if(!biezacy)RBJezyk.ustaw(j);});
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",podepnij);else podepnij();
})();
