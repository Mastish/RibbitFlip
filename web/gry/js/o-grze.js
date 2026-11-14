// RibbitBeat: metka „Stworzona z AI” i okno „O grze” (2026-11-13): gra ma bardzo
// wyraźnie mówić, że powstała za pomocą AI i służy wyłącznie jako demonstracja możliwości aplikacji
// bazowej; nic tu nie jest ukrywane.
//
// Metka (#menuAI w index.html) siedzi w lewym górnym rogu menu pod naklejką RibbitFlip, więc jest na każdym zrzucie
// i nagraniu menu. Klik otwiera okno, które mówi wprost: gra demonstracyjna, kod i grafiki z pomocą AI, człowiek
// decyduje. Okno korzysta z wyglądu „Zgłoś błąd” (klasy zglos-* w gry.css) i jest na liście nakladkaLobby()
// w zabi-chor.js (id oGrze), żeby menu nie dostawało strzałek ani pada, gdy jest otwarte.
// API: OGrze.otworz(), OGrze.zamknij(), OGrze.otwarte.
(function(){
  "use strict";
  const L=(pl,en)=>typeof RBJezyk!=="undefined"&&RBJezyk.wybierz?RBJezyk.wybierz(pl,en):pl;
  const STRONA="https://mastish.github.io/RibbitFlip/";
  const TX={
    metka:L("Stworzona z AI","Made with AI"),
    metkaAria:L("O grze: gra demonstracyjna, stworzona z pomocą AI","About the game: a demo game, made with the help of AI"),
    tytul:L("O grze","About the game"),
    demoTytul:L("Gra demonstracyjna","A demo game"),
    demo:L("RibbitBeat nie jest osobnym produktem. Powstał, żeby pokazać, co potrafi RibbitFlip: aplikacja, która zamienia ruch kapsla „Triki” w sterowanie komputerem.",
      "RibbitBeat is not a product of its own. It exists to show what RibbitFlip can do: an app that turns the motion of a “Triki” capsule into computer controls."),
    aiTytul:L("Stworzona z pomocą AI","Made with the help of AI"),
    ai:L("Kod i grafiki tej gry powstały z pomocą sztucznej inteligencji, pod kierunkiem autora projektu. Pomysł, decyzje i ostateczny kształt należą do człowieka.",
      "The code and the artwork of this game were made with the help of AI, directed by the author of the project. The idea, the decisions and the final shape are human."),
    licencje:L("Skąd pochodzą melodie, fonty i nagrania, sprawdzisz w „Autorzy i licencje” przy wyborze piosenki.",
      "Where the tunes, fonts and recordings come from is listed under “Credits and licences” on the song selection screen."),
    strona:L("Strona RibbitFlip ↗","RibbitFlip page ↗"),
    zamknij:L("Zamknij","Close")};

  let box=null,powrot=null;
  const el=(tag,klasa,txt)=>{const e=document.createElement(tag);if(klasa)e.className=klasa;if(txt!=null)e.textContent=txt;return e;};
  function otworz(){
    zamknij(true);
    powrot=document.activeElement;
    box=el("div","zglos-tlo");box.id="oGrze";
    const k=el("div","karta zglos-karta ogrze-karta");k.setAttribute("role","dialog");k.setAttribute("aria-modal","true");k.setAttribute("aria-labelledby","oGrzeTytul");
    const zam=el("button","gracz-usun tablica-zamknij zglos-x","×");zam.type="button";zam.setAttribute("aria-label",TX.zamknij);zam.title=TX.zamknij;zam.onclick=()=>zamknij();
    const tyt=el("h2","zglos-tytul",TX.tytul);tyt.id="oGrzeTytul";
    const a=el("a","przycisk glowny zglos-pomoc",TX.strona);a.href=STRONA;a.target="_blank";a.rel="noopener";
    const kon=el("button","przycisk",TX.zamknij);kon.type="button";kon.onclick=()=>zamknij();
    const rzad=el("div","zglos-przyciski");rzad.append(kon,a);
    k.append(zam,tyt,el("h3","ogrze-naglowek",TX.demoTytul),el("p","zglos-lead",TX.demo),
      el("h3","ogrze-naglowek",TX.aiTytul),el("p","zglos-lead",TX.ai),el("p","zglos-lead ogrze-licencje",TX.licencje),rzad);
    box.append(k);
    box.addEventListener("pointerdown",e=>{if(e.target===box)zamknij();});
    document.body.append(box);
    kon.focus({preventScroll:true});
  }
  function zamknij(cicho){
    if(!box)return;
    box.remove();box=null;
    if(!cicho&&powrot&&powrot.isConnected&&powrot.focus)try{powrot.focus({preventScroll:true});}catch(e){}
    powrot=null;
  }
  // Esc zamyka okno, zanim zobaczy go menu (faza przechwytywania); pozostałe klawisze nie trafiają do menu pod spodem
  window.addEventListener("keydown",e=>{
    if(!box)return;
    if(e.key==="Escape"){e.stopPropagation();e.preventDefault();zamknij();return;}
    e.stopPropagation();
  },true);

  function podepnij(){
    const b=document.getElementById("menuAI");if(!b)return;
    const t=b.querySelector(".menu-ai-tekst");if(t)t.textContent=TX.metka;
    b.setAttribute("aria-label",TX.metkaAria);b.title=TX.metkaAria;
    b.onclick=()=>otworz();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",podepnij);else podepnij();

  window.OGrze={otworz,zamknij:()=>zamknij(),get otwarte(){return !!box;}};
})();
