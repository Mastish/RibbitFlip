// RibbitBeat: tryb oszusta. Włącza go ukryty kod w menu głównym (js/menu-dodatki.js).
// Działa tylko do zamknięcia gry (albo przeładowania strony), nic z niego nie trafia do zapisu:
// - wszystko do wyboru: Postepy.wszystkoOtwarte() zwraca true (motywy planszy, efekty, instrumenty), ale bez
//   supersekretów (Postepy.SEKRETY: Studio instrumentów, „prawdziwy”); te zostają, tylko jeśli ekipa je wygrała;
// - postęp się nie liczy: Postepy.poGrze nic nie przyznaje (sława, poziomy, osiągnięcia), Postepy.losowania = 0
//   (koło nagród, skórki), tablica wyników nie dostaje wpisu (zabi-chor.js zakonczGre);
// - nic się nie zapisuje: od chwili włączenia setItem/removeItem/clear na localStorage idą do pamięci tej karty
//   (cień), a getItem czyta najpierw z cienia, więc zmiany działają do końca sesji i znikają po zamknięciu gry.
// Widoczny znak: naszywka „Tryb oszusta” w rogu ekranu (z opisem w podpowiedzi) i klasa `oszust` na <html>.
// API: TrybOszusta.aktywny, wlacz() (zwraca true, gdy właśnie włączony; false, gdy już działał), wylacz() (przeładowuje
// grę; przycisk „Wyłącz tryb oszusta” w menu głównym), TX (teksty).
// Ładowany wcześnie (po jezyk-en.js), żeby postepy.js i zabi-chor.js mogły go pytać.
(function(){
  "use strict";
  const L=(pl,en)=>typeof RBJezyk!=="undefined"&&RBJezyk.wybierz?RBJezyk.wybierz(pl,en):pl;
  const TX={
    naszywka:L("Tryb oszusta","Cheat mode"),
    podpowiedz:L("Tryb oszusta do zamknięcia gry albo wyłączenia w menu: wszystko odblokowane, ale nic się nie liczy i nic się nie zapisuje.",
      "Cheat mode until you close the game or turn it off in the menu: everything is unlocked, but nothing counts and nothing is saved."),
    wylacz:L("Wyłącz tryb oszusta","Turn off cheat mode"),
    wylaczOpis:L("Gra wczyta się od nowa z Twoim prawdziwym zapisem. Zmiany z tej sesji znikną.",
      "The game reloads with your real save. Changes from this session are dropped."),
    wyniki:L("Tryb oszusta: ta piosenka nie liczy się do postępów. Bez sławy, poziomów, nagród i wpisu na tablicy wyników.",
      "Cheat mode: this song does not count. No fame, levels, rewards or scoreboard entry.")};
  let aktywny=false;
  const cien=new Map();   // klucz → tekst albo null (usunięty w tej sesji)

  function cienStorage(){
    const P=Storage.prototype,get=P.getItem,set=P.setItem,del=P.removeItem,clr=P.clear;
    let ls=null;try{ls=window.localStorage;}catch(e){}
    if(!ls)return;
    P.getItem=function(k){if(aktywny&&this===ls){k=String(k);if(cien.has(k))return cien.get(k);}return get.call(this,k);};
    P.setItem=function(k,v){if(aktywny&&this===ls){cien.set(String(k),String(v));return;}return set.call(this,k,v);};
    P.removeItem=function(k){if(aktywny&&this===ls){cien.set(String(k),null);return;}return del.call(this,k);};
    P.clear=function(){if(aktywny&&this===ls){for(let i=0;i<ls.length;i++)cien.set(ls.key(i),null);for(const k of cien.keys())cien.set(k,null);return;}return clr.call(this);};
  }

  function naszywka(){
    if(document.getElementById("trybOszusta"))return;
    const n=document.createElement("div");n.id="trybOszusta";n.className="tryb-oszusta";
    n.setAttribute("role","status");n.title=TX.podpowiedz;n.setAttribute("aria-label",TX.podpowiedz);
    const ik=document.createElement("span");ik.className="tryb-oszusta-ikona";ik.setAttribute("aria-hidden","true");ik.textContent="✶";
    const t=document.createElement("span");t.textContent=TX.naszywka;
    n.append(ik,t);document.body.append(n);
  }

  // Krótki glitch na całą grę w chwili włączenia (jak Sombra w Overwatch): nakładka
  // nic nie rysuje — zniekształca `backdrop-filter`em to, co akurat jest na ekranie (gry.css, .oszust-glitch),
  // więc działa w menu, w lobby i na wynikach tak samo. Żyje 0,72 s, tyle co animacje, i znika razem z klasą.
  const GLITCH_MS=720;
  function glitch(){
    try{if(matchMedia("(prefers-reduced-motion:reduce)").matches)return;}catch(e){}
    const g=document.createElement("div");g.className="oszust-glitch";g.setAttribute("aria-hidden","true");
    document.body.append(g);
    document.documentElement.classList.add("oszust-trzesie");
    setTimeout(()=>{g.remove();document.documentElement.classList.remove("oszust-trzesie");},GLITCH_MS+40);
  }

  // 11-20: przycisk „Wyłącz tryb oszusta” w menu głównym, pod Studiem instrumentów (ostatni w .menu-przyciski).
  // Wyłączenie = przeładowanie strony: cień localStorage żyje tylko w pamięci karty, więc po przeładowaniu gra
  // wczytuje prawdziwy zapis. Bez „na żywo”, bo moduły (Postepy, ustawienia, lobby) trzymają stan wczytany
  // jeszcze w trybie oszusta i trzeba by je wszystkie wczytać od nowa. Tak samo przeładowuje zmiana języka (jezyk.js).
  function przyciskMenu(){
    if(document.getElementById("btnOszustWylacz"))return;
    const nav=document.querySelector(".menu-przyciski");if(!nav)return;
    const b=document.createElement("button");b.id="btnOszustWylacz";b.type="button";b.className="menu-przycisk menu-oszust-wylacz";
    b.title=TX.wylaczOpis;b.setAttribute("aria-description",TX.wylaczOpis);
    // 11-20: czacha z filcu (assets/icons/punkskull.png, ta sama co w panelu RibbitFlip) zamiast gwiazdki naszywki
    const ik=document.createElement("img");ik.className="oszust-wylacz-czacha";ik.src="../assets/icons/punkskull.png";ik.alt="";
    ik.setAttribute("aria-hidden","true");ik.decoding="async";ik.width=128;ik.height=128;
    const t=document.createElement("span");t.textContent=TX.wylacz;
    b.append(ik,t);
    b.onclick=wylacz;
    nav.append(b);
  }
  function wylacz(){
    if(!aktywny)return false;
    try{location.reload();}catch(e){}
    return true;
  }

  function wlacz(){
    if(aktywny)return false;
    cienStorage();
    aktywny=true;
    document.documentElement.classList.add("oszust");
    naszywka();
    przyciskMenu();
    glitch();
    try{window.dispatchEvent(new CustomEvent("rb-oszust"));}catch(e){}
    return true;
  }

  window.TrybOszusta={get aktywny(){return aktywny;},wlacz,wylacz,TX};
})();
