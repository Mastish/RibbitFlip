"use strict";
// ===== RIBBITBEAT: ekran wczytywania (10-10) =====
// Gra przy starcie się zacinała, bo widocznie coś doczytywała. Dlatego najpierw wczytuje się lekki ekran wczytywania,
// a dopiero po nim reszta. Pomiar startu (skrypt poza repozytorium, zimna przeglądarka):
// przy widocznym już menu siedem zamrożeń 86–515 ms (kontekst audio, silnik WebGL, rozgrzewka płócien, pierwszy raster
// ekranów lobby, fonty doczytane po 1,5 s), bo ciężka praca szła w „chwilach bezczynności” menu.
//
// Jak w grach: zasłona #wczytywanie jest statycznym HTML-em na górze <body> (pierwsza rzecz, którą widać), jej ruch to
// tylko transform w CSS, więc kompozytor animuje ją płynnie także wtedy, gdy wątek JS jest zajęty. Pod nią kroki idą
// po kolei, z klatką oddechu między nimi (pasek postępu), a menu pokazuje się dopiero, gdy wszystko jest gotowe
// i raz narysowane. Klasa html.wczytuje wstrzymuje animację wejścia menu (gry.css), żeby nie odegrała się pod zasłoną.
// Bezpiecznik: zasłona schodzi najpóźniej po MAKS_MS, cokolwiek by się działo.
const Wczytywanie=(function(){
  const MAKS_MS=15000;   // 11-18: pod zasłoną wczytują się też grafiki menu i podmenu, więc start trwa dłużej
  let gotowe=false,odp=null;
  // Dopóki zasłona stoi, klawiatura i mysz nie docierają do gry (11-18). Zasłona przepuszcza kliknięcia, a pod nią gra
  // naprawdę otwiera ekrany lobby i okna (zabi-chor.js: probaEkranow); wcześniej Enter wciśnięty w trakcie wczytywania
  // i tak trafiał w „Zagraj” pod zasłoną. Ten plik ładuje się pierwszy, więc te nasłuchy stoją przed wszystkimi innymi.
  // Skróty przeglądarki (F5, F11) działają dalej, bo niczego nie anulujemy.
  if(typeof addEventListener==="function")for(const z of ["keydown","keyup","keypress","pointerdown","pointerup","mousedown","mouseup","click","dblclick","contextmenu","wheel","touchstart","touchend"])
    addEventListener(z,e=>{if(!gotowe)e.stopImmediatePropagation();},true);
  const klatka=()=>new Promise(r=>requestAnimationFrame(()=>r()));
  const zas=()=>document.getElementById("wczytywanie");
  // Girlanda lamp jest w HTML-u zasłony startu (widać ją przed jakimkolwiek skryptem). Zasłona utworu (zabi-chor.js)
  // bierze stąd jej kopię, więc znaczniki lamp są w jednym miejscu; wzór zapamiętany, zanim zasłona startu zniknie z DOM.
  let wzorGirlandy=null;
  function girlanda(){
    if(!wzorGirlandy){const g=document.querySelector("#wczytywanie .wcz-girlanda");if(g)wzorGirlandy=g.cloneNode(true);}
    return wzorGirlandy?wzorGirlandy.cloneNode(true):null;
  }
  // Puls żaby i błyski lamp (index.html, --wt) startują od zera osi czasu strony, a nie od chwili pierwszego malowania:
  // z tego samego zegara bierze rytm scena menu, zanim przeglądarka wypuści dźwięk (menu-koncert.js: rytmZZegara),
  // więc po zejściu zasłony naklejka w menu pulsuje dalej w tę samą stopę. Jedno ustawienie, animacje zostają na kompozytorze.
  try{const z=zas();if(z&&z.getAnimations)for(const a of z.getAnimations({subtree:true}))
    if(/^wcz(Puls|Swiatlo|Zar)$/.test(a.animationName||""))a.startTime=0;}catch(e){}
  function postep(f){
    const p=document.getElementById("wczPasek");
    if(p)p.style.transform="translateX("+(-100*(1-Math.max(.04,Math.min(1,f)))).toFixed(1)+"%)";
  }
  function zakoncz(){
    if(gotowe)return;gotowe=true;
    postep(1);girlanda();
    // najpierw rusza wejście menu (pierwszy raster jego animacji jeszcze pod zasłoną), dwie klatki później zasłona znika
    document.documentElement.classList.remove("wczytuje");
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const z=zas();
      if(z){z.classList.add("znika");setTimeout(()=>z.remove(),400);}
      if(odp)odp();
    }));
  }
  // kroki: [[nazwa, funkcja zwracająca wartość albo Promise], …]; błąd kroku nie zatrzymuje reszty
  async function uruchom(kroki){
    const t0=performance.now(),czasy=[];
    const bezpiecznik=setTimeout(()=>{console.warn("RibbitBeat: wczytywanie przerwane po "+MAKS_MS+" ms");zakoncz();},MAKS_MS);
    await klatka();   // pierwsza klatka z samą zasłoną
    for(let i=0;i<kroki.length&&!gotowe;i++){
      const [nazwa,f]=kroki[i],a=performance.now();
      try{await f();}catch(e){console.warn("RibbitBeat: wczytywanie, krok „"+nazwa+"”",e);}
      czasy.push(nazwa+" "+Math.round(performance.now()-a));
      postep((i+1)/kroki.length);
      await klatka();
    }
    clearTimeout(bezpiecznik);
    Wczytywanie.raport={ms:Math.round(performance.now()-t0),kroki:czasy};
    zakoncz();
  }
  return {uruchom,klatka,postep,zakoncz,girlanda,
    get gotowe(){return gotowe;},
    // dla innych modułów: obietnica „zasłona zeszła”
    poWczytaniu:()=>gotowe?Promise.resolve():new Promise(r=>{const s=odp;odp=()=>{if(s)s();r();};}),
    raport:null};
})();
if(typeof window!=="undefined")window.Wczytywanie=Wczytywanie;
