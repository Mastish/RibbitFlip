"use strict";
// RibbitBeat: samouczek „Jak grać” w prawdziwym interfejsie gry (2026-10-16). Gra wymaga wyjaśnienia,
// np. jak robić vibrato, więc przy pierwszym graniu albo pod przyciskiem jest animowane „jak grać”. Pierwsza wersja
// (karty z osobnymi animacjami obok gry) ustąpiła pokazywaniu wprost w interfejsie gry.
// Jak działa: bot „mistrz” śpiewa krótką piosenkę (ZC.dev.autoplay), a samouczek zatrzymuje grę w pięciu chwilach
// wyliczonych z nut tej piosenki (pierwsza nuta, nuta w trakcie, długa nuta z wibratem, HUD, złota fraza) i pokazuje
// dymek z obwódką na prawdziwym elemencie: żabie, linii „teraz”, nutach, żetonie gracza w HUD. „Dalej” (Enter, Spacja,
// klik) wznawia, „Pomiń” (Esc) kończy. Po piosence karta „Teraz Ty!”: Zagraj (wybór piosenki) albo Zamknij (menu).
// Gracze, którzy byli w składzie, wracają do niego po samouczku. Pauza samouczka = S.pauza bez okna pauzy, wznowienie
// przez ZC.pauza(false, true) (bez odliczania). Liczby w tekstach = stałe gry (ZC_PUNKTY: wibrato ≥ 2 ćwierćnuty,
// ×1,25; „w punkt” 100 ms), napisy sm_* w zabi-chor.js (PL) i js/jezyk-en.js (EN).
// Wejście: przycisk „Jak grać” w menu (zawsze) i pierwsze „Zagraj” na tym komputerze (raz, zapis KLUCZ).
window.JakGrac=(function(){
  const KLUCZ="ribbitbeat.jakGrac";
  const PIOSENKA=["gwiazdka","oda"];   // krótkie, z długimi nutami i złotymi frazami
  let st=null;   // {kroki, nr, el, timer, sklad, piosenka}
  const widziane=()=>{try{return localStorage.getItem(KLUCZ)==="1";}catch(e){return true;}};
  const zapamietaj=()=>{try{localStorage.setItem(KLUCZ,"1");}catch(e){}};
  const z=(tag,kl,txt)=>{const e=document.createElement(tag);if(kl)e.className=kl;if(txt!=null)e.textContent=txt;return e;};
  const D=()=>window.ZC&&ZC.dev;
  const G=()=>{const d=D();return d&&d.S.gra;};

  // Chwile samouczka z nut pierwszego toru: [beat zatrzymania, klucz tekstu, co obrysować]
  function plan(){
    const g=G(),tor=g&&g.tory[0],n=tor?tor.def.nuty:[];if(!n.length)return [];
    const kroki=[{b:n[0].t-.15,k:"linia",cel:"zaba"}];
    if(n[1])kroki.push({b:n[1].t+n[1].d*.5,k:"spiew",cel:"nuta",idx:1});
    const dl=n.findIndex((x,i)=>i>1&&x.d>=2);
    if(dl>=0)kroki.push({b:n[dl].t+n[dl].d*.6,k:"wibrato",cel:"nuta",idx:dl});
    const pozniej=(dl>=0?n[dl].t+n[dl].d:n[Math.min(n.length-1,4)].t)+1.5;
    kroki.push({b:pozniej,k:"hud",cel:"hud"});
    const sk=(tor.sekcje||[]).find(s=>n[s.od]&&n[s.od].t>pozniej+1);
    if(sk)kroki.push({b:n[sk.od].t-1.2,k:"fraza",cel:"fraza",od:sk.od,do:sk.do});
    return kroki.sort((a,b)=>a.b-b.b);
  }
  // Prostokąt obwódki (px okna) dla kroku
  function prostokat(k){
    const geo=ZC.geometria&&ZC.geometria(),L=geo&&geo.tory[0];if(!L)return null;
    const zaba=L.zaby[0]||{x:L.teraz,y:L.y+L.h/2};
    if(k.cel==="hud"){const h=document.querySelector("#hud .hud-gracz");if(!h)return null;const r=h.getBoundingClientRect();return {x:r.left-8,y:r.top-6,w:r.width+16,h:r.height+12};}
    if(k.cel==="fraza"){const g=G(),n=g.tory[0].def.nuty,x0=L.teraz+(n[k.od].t-g.beat)*L.px,x1=L.teraz+(n[k.do].t+n[k.do].d-g.beat)*L.px;
      let y0=1e9,y1=-1e9;for(let i=k.od;i<=k.do;i++){const y=L.yNuty(n[i].m);y0=Math.min(y0,y);y1=Math.max(y1,y);}
      return {x:x0-22,y:y0-30,w:Math.max(60,x1-x0+44),h:y1-y0+60};}
    if(k.cel==="nuta"){   // żaba i reszta nuty, którą właśnie śpiewa (do jej końca)
      const g=G(),n=g.tory[0].def.nuty[k.idx],x1=L.teraz+(n.t+n.d-g.beat)*L.px;
      return {x:zaba.x-46,y:zaba.y-46,w:Math.max(92,x1-zaba.x+70),h:92};}
    return {x:zaba.x-38,y:zaba.y-38,w:76,h:76};   // sama żaba, bez podpisu bota
  }
  function tekst(k){
    const t=T["sm_"+k.k];return Array.isArray(t)?t:[String(t||""),""];
  }
  function pokazKrok(k){
    const d=D();d.S.pauza=true;try{Glos.wycisz(true);}catch(e){}
    const r=prostokat(k),box=st.el;box.hidden=false;
    const ring=box.querySelector(".sm-obwodka"),karta=box.querySelector(".sm-karta");
    if(r){ring.hidden=false;Object.assign(ring.style,{left:r.x+"px",top:r.y+"px",width:r.w+"px",height:r.h+"px"});}else ring.hidden=true;
    const [tyt,opis]=tekst(k);
    karta.querySelector(".sm-tytul").textContent=tyt;karta.querySelector(".sm-opis").textContent=opis;
    karta.querySelector(".sm-licznik").textContent=(st.nr+1)+" / "+st.kroki.length;
    // karta nie zasłania obwódki ani nut przed nią: pod obwódką, a gdy brak miejsca, nad nią (wysokość karty mierzona)
    const W=innerWidth,H=innerHeight,kw=Math.min(440,W-32);karta.style.width=kw+"px";karta.style.left="0px";karta.style.top="-9999px";
    const kh=karta.offsetHeight||220;
    let x=r?Math.max(16,Math.min(W-kw-16,r.x)):(W-kw)/2,y=H*.3;
    if(r){
      y=r.y+r.h+18;if(y+kh>H-12)y=r.y-kh-18;
      if(y<12){   // brak miejsca nad i pod obwódką: karta z boku (prawo, potem lewo), na końcu przy dolnej krawędzi
        y=Math.max(12,Math.min(H-kh-12,r.y));
        if(r.x+r.w+18+kw<=W-16)x=r.x+r.w+18;else if(r.x-18-kw>=16)x=r.x-18-kw;else y=H-kh-12;
      }
    }
    karta.style.left=x+"px";karta.style.top=y+"px";
    karta.querySelector(".sm-dalej").textContent=T.sm_dalej;
    karta.querySelector(".sm-dalej").focus({preventScroll:true});
  }
  function dalej(){
    if(!st)return;
    if(st.konczy){zakoncz(true);return;}
    st.el.hidden=true;st.nr++;
    try{ZC.pauza(false,true);}catch(e){}
  }
  // Pad (A-04): zbocze A/Start = Dalej (albo przycisk z fokusem), B/Back = Pomiń; czytane co tik, bez zmian w wejscie.js.
  // Stan przycisków aktualizujemy zawsze, więc A przytrzymane w chwili pojawienia się dymka nie przeskakuje kroku.
  function padSledz(){
    let lista=[];try{lista=Array.from(navigator.getGamepads?navigator.getGamepads():[]);}catch(e){}
    let dalejZb=false,pominZb=false;
    for(const p of lista){
      if(!p||!p.connected)continue;
      const b=i=>!!(p.buttons[i]&&p.buttons[i].pressed);
      const A=b(0)||b(9),B=b(1)||b(8),kl="p"+p.index,pr=st.pad[kl]||{A:false,B:false};
      if(A&&!pr.A)dalejZb=true;if(B&&!pr.B)pominZb=true;
      st.pad[kl]={A,B};
    }
    if(st.el.hidden)return;
    if(pominZb){zakoncz(false);return;}
    if(dalejZb){const f=document.activeElement;(f&&f.classList&&f.classList.contains("sm-pomin")?f:st.el.querySelector(".sm-dalej")).click();}
  }
  function krokSledzenia(){
    if(!st)return;
    padSledz();if(!st)return;
    const d=D(),S=d&&d.S;if(!S){zakoncz(false);return;}
    if(S.ekran==="wyniki"&&!st.konczy){pokazKoniec();return;}
    if(S.ekran!=="gra"&&S.ekran!=="odliczanie"&&S.ekran!=="wyniki"){zakoncz(false);return;}   // ktoś wyszedł z piosenki
    if(S.pauza||!st.el.hidden)return;
    const k=st.kroki[st.nr];if(k&&S.gra&&S.gra.beat>=k.b)pokazKrok(k);
  }
  function pokazKoniec(){
    st.konczy=true;const box=st.el;box.hidden=false;box.querySelector(".sm-obwodka").hidden=true;
    const karta=box.querySelector(".sm-karta"),[tyt,opis]=tekst({k:"koniec"});
    karta.querySelector(".sm-tytul").textContent=tyt;karta.querySelector(".sm-opis").textContent=opis;karta.querySelector(".sm-licznik").textContent="";
    const W=innerWidth,kw=Math.min(460,W-32);Object.assign(karta.style,{width:kw+"px",left:((W-kw)/2)+"px",top:"18vh"});
    const b=karta.querySelector(".sm-dalej");b.textContent=T.sm_zagraj;b.focus({preventScroll:true});
  }
  function zbuduj(){
    const box=z("div","samouczek");box.id="samouczek";box.hidden=true;
    const ring=z("div","sm-obwodka");ring.setAttribute("aria-hidden","true");
    const karta=z("div","sm-karta karta");karta.setAttribute("role","dialog");karta.setAttribute("aria-modal","true");karta.setAttribute("aria-labelledby","smTytul");
    const tyt=z("h2","sm-tytul");tyt.id="smTytul";
    const nogi=z("div","sm-nogi");
    const pom=przyciskPomin(T.sm_pomin,"sm-pomin");pom.onclick=()=>zakoncz(false);
    const dal=z("button","przycisk glowny sm-dalej",T.sm_dalej);dal.type="button";dal.onclick=dalej;
    nogi.append(z("span","sm-licznik"),pom,dal);
    karta.append(z("span","sm-etykieta",T.sm_etykieta),tyt,z("p","sm-opis"),nogi);
    box.append(ring,karta);el("gra").append(box);
    // Samouczek da się zakończyć wcześniej: przycisk widoczny przez cały samouczek, także między
    // zatrzymaniami; Esc w dowolnej chwili samouczka robi to samo
    const kon=z("button","przycisk sm-zakoncz",T.sm_zakoncz);kon.type="button";kon.id="smZakoncz";kon.hidden=true;
    kon.onclick=()=>zakoncz(false);el("gra").append(kon);
    // klawisze, gdy dymek jest na ekranie: Enter/Spacja = Dalej (albo przycisk z fokusem), Esc = Pomiń; nic nie idzie do gry
    addEventListener("keydown",e=>{
      if(st&&e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();zakoncz(false);return;}   // także między zatrzymaniami
      if(!st||box.hidden)return;
      e.stopImmediatePropagation();
      if(e.key==="Tab"){e.preventDefault();(document.activeElement===dal?pom:dal).focus();return;}
      if((e.code==="Enter"||e.code==="Space"||e.code==="NumpadEnter")&&!e.repeat){e.preventDefault();(document.activeElement===pom?pom:dal).click();}
    },true);
    return box;
  }
  // Start samouczka (z menu albo z pierwszego Zagraj). opcje.powrot: fokus po zamknięciu.
  function otworz(opcje){
    const d=D();if(!d||!d.autoplay||st)return false;
    const o=opcje||{},S=d.S,lista=d.piosenki().map(p=>p.id),id=PIOSENKA.find(p=>lista.includes(p))||lista[0];
    const sklad=S.gracze.map(g=>g.id);   // ludzie i boty gracza (źródła zostają w Wejscie, autoplay tylko je odłącza)
    st={kroki:[],nr:0,el:el("samouczek")||zbuduj(),sklad,powrot:o.powrot||null,doWyboru:!!o.doWyboru,konczy:false,pad:{}};
    zapamietaj();
    if(!d.autoplay(id,{botow:1,poziom:"mistrz",zaslona:true})){st=null;return false;}   // z zasłoną wczytywania utworu, jak każdy start piosenki
    st.kroki=plan();
    const kon=el("smZakoncz");if(kon)kon.hidden=false;
    st.timer=setInterval(krokSledzenia,30);
    return true;
  }
  // graj=true: po samouczku do wyboru piosenki, inaczej do menu. Skład ludzi wraca.
  function zakoncz(graj){
    if(!st)return;
    const s=st;st=null;clearInterval(s.timer);s.el.hidden=true;
    const kon=el("smZakoncz");if(kon)kon.hidden=true;
    const d=D();
    // wyjście z piosenki (gra, pauza samouczka albo wyniki): to samo co „Wyjdź” / „Inna piosenka”
    try{if(d.S.ekran!=="lobby")document.getElementById("btnWyjdz").click();}catch(e){}
    try{for(let i=d.S.gracze.length-1;i>=0;i--)if(d.S.gracze[i].zrodlo==="bot")d.usunBota();}catch(e){}
    for(const id of s.sklad)try{ZC.dolacz(id);}catch(e){}
    // przejście ekranów lobby (zasłona) musi się skończyć, zanim przełączymy na menu, inaczej zostaje „wybor”
    const cel=graj||s.doWyboru?"wybor":"menu",t0=performance.now();
    // zasłona na czas wyjścia z piosenki: bez niej przez chwilę widać krok 1 („wybor”) zanim wejdzie menu
    let zas=document.getElementById("smZaslona");
    if(!zas){zas=z("div","sm-zaslona");zas.id="smZaslona";zas.setAttribute("aria-hidden","true");
      Object.assign(zas.style,{position:"fixed",inset:"0",zIndex:"9000",pointerEvents:"none"});document.body.append(zas);}
    // kolor ekranu docelowego: jasny filc menu (jak ekran wczytywania) albo ciemna „kurtka” lobby, bez ciemnego mignięcia nad jasnym menu
    zas.style.background=cel==="menu"?"#efe9dd":"#1b1917";
    zas.hidden=false;
    const przelacz=()=>{
      const trwa=typeof LobbyScena!=="undefined"&&LobbyScena.przejscie&&LobbyScena.przejscie().trwa;
      if(trwa&&performance.now()-t0<2000){setTimeout(przelacz,50);return;}
      try{ZC.lobby(cel);}catch(e){}
      setTimeout(()=>{zas.hidden=true;},cel==='menu'?160:120);
      if(!graj&&!s.doWyboru&&s.powrot&&s.powrot.isConnected)setTimeout(()=>s.powrot.focus({preventScroll:true}),320);
    };
    setTimeout(przelacz,60);
  }
  // Pierwsze „Zagraj” na tym komputerze: pytanie, czy przejść samouczek, ZANIM ruszy plansza z muzyką
  // (nie wciskamy na siłę w samouczek). Okno jest nakładką lobby (#smPytanie w nakladkaLobby() w zabi-chor.js),
  // więc strzałki, pad i Esc/Back działają jak w innych oknach. Odpowiedź (tak albo nie) zapamiętuje się; zamknięcie
  // krzyżykiem/Esc niczego nie zapisuje, więc następne „Zagraj” zapyta znowu. true = przejął przejście dalej.
  let pyt=null;
  function zbudujPytanie(){
    const box=z("div","sm-pytanie");box.id="smPytanie";box.hidden=true;
    const karta=z("div","sm-karta karta");karta.setAttribute("role","dialog");karta.setAttribute("aria-modal","true");karta.setAttribute("aria-labelledby","smPytanieTytul");
    const x=z("button","przycisk tablica-zamknij sm-pytanie-x","×");x.type="button";x.setAttribute("aria-label",T.sm_pytanieZamknij);
    const gora=z("div","sm-pytanie-gora");gora.append(z("span","sm-etykieta",T.sm_etykieta),x);
    const tyt=z("h2","sm-tytul",T.sm_pytanieTytul);tyt.id="smPytanieTytul";
    const nie=z("button","przycisk sm-pytanie-nie",T.sm_pytanieNie);nie.type="button";
    const tak=z("button","przycisk glowny sm-pytanie-tak",T.sm_pytanieTak);tak.type="button";
    const nogi=z("div","sm-nogi");nogi.append(z("span","sm-licznik"),nie,tak);
    karta.append(gora,tyt,z("p","sm-opis",T.sm_pytanieOpis),nogi);box.append(karta);
    box.addEventListener("pointerdown",e=>{if(e.target===box)zamknijPytanie(true);});   // klik obok karty = jak krzyżyk
    x.onclick=()=>zamknijPytanie(true);
    // Esc w menu nie idzie do nawigacji lobby (Back pada tak: klika .tablica-zamknij), więc okno łapie go samo
    addEventListener("keydown",e=>{
      if(box.hidden)return;
      if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();zamknijPytanie(true);return;}
      if(e.key==="Tab"){   // pułapka Tab: krążymy po przyciskach okna (×, Nie, Tak)
        const lista=[...box.querySelectorAll("button")].filter(b=>!b.disabled&&!b.hidden);if(!lista.length)return;
        e.preventDefault();e.stopImmediatePropagation();
        const i=lista.indexOf(document.activeElement),n=lista.length;
        lista[i<0?(e.shiftKey?n-1:0):(i+(e.shiftKey?n-1:1))%n].focus({preventScroll:true});
      }
    },true);
    nie.onclick=()=>{zapamietaj();zamknijPytanie(false);if(typeof pokazLobby==="function")pokazLobby("wybor");};
    tak.onclick=()=>{zamknijPytanie(false);if(!otworz({doWyboru:true})){zapamietaj();if(typeof pokazLobby==="function")pokazLobby("wybor");}};
    document.body.append(box);   // nie do #gra: ta sekcja jest ukryta, kiedy widać menu
    return {box,tak};
  }
  function zamknijPytanie(doMenu){
    if(!pyt||pyt.box.hidden)return;
    pyt.box.hidden=true;
    if(doMenu){const b=el("btnZagraj");if(b)setTimeout(()=>b.focus({preventScroll:true}),30);}
  }
  function przyPierwszejGrze(){
    if(widziane())return false;
    if(!pyt)pyt=zbudujPytanie();
    pyt.box.hidden=false;
    setTimeout(()=>pyt.tak.focus({preventScroll:true}),30);
    return true;
  }
  // `dymek`: na ekranie stoi dymek samouczka (gra zatrzymana). Pilot kapsla (krokPilotow w zabi-chor.js) rusza tylko
  // wtedy: „ok” = Dalej, przytrzymanie = Pomiń, jak A i B pada wyżej. Między zatrzymaniami kapsel należy do śpiewania.
  return {otworz,zakoncz,przyPierwszejGrze,widziane,dalej,get dymek(){return !!st&&!st.el.hidden;},
    get aktywny(){return !!st;},get krok(){return st?st.nr:null;},
    zapomnij:()=>{try{localStorage.removeItem(KLUCZ);}catch(e){}}};
})();
