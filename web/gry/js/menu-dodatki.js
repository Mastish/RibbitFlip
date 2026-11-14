// RibbitBeat: dodatki menu głównego (osobny plik; nazwa i treść
// pliku celowo nie zdradzają, co i jak się tu uruchamia, a działa to tylko w menu głównym). Nic w interfejsie ani w
// pomocy o tym nie mówi; ten plik to jedyne miejsce.
//
// Nasłuch klawiatury w fazie przechwytywania (menu zatrzymuje propagację strzałek), tylko w menu głównym
// (S.ekran "lobby" + S.lobbyEkran "menu"), poza polami tekstowymi; przerwa > 2,5 s zeruje. Sekwencja nie jest
// zapisana w kodzie: liczy się odcisk (FNV-1a) ostatnich naciśnięć i porównuje z ODCISK. Po dopasowaniu:
// TrybOszusta.wlacz() (js/tryb-oszusta.js: wszystko poza supersekretami tylko do zamknięcia gry, bez postępów
// i bez zapisu; wcześniej był tu trwały Postepy.odblokujWszystko), fanfara „odblokowanie”, zasłona z konfetti z filcowych
// łatek, gwiazdek i naklejek żaby oraz karta ze zglitchowaną żabą (assets/frog/zaba-oszust.webp) i jasnym opisem trybu.
// Ograniczony ruch: jedna stojąca klatka konfetti, żaba bez glitcha. Zamknięcie: przycisk, Esc, klik obok karty.
// API tylko w DEV (?dev=1; konsola, testy): ZC.dodatek = {odpal(), cofnij(), zamknij(), otwarte}; cofnij() zdejmuje
// stary trwały `ekipa.wszystko`. Poza DEV nic nie jest wystawione na window. Ładowany PO zabi-chor.js (S, IMG, Postepy,
// ruchOgraniczony, rysujGraczy, window.ZC), PRZED konta.js.
(function(){
  "use strict";
  const ODCISK=0xb16052e4,DLUGOSC=10,PRZERWA=2500,CZAS=6000,ILE=140;
  const DEV=/[?&]dev=(1|true|tak)(&|$)/i.test(location.search);
  const L=(pl,en)=>typeof RBJezyk!=="undefined"&&RBJezyk.wybierz?RBJezyk.wybierz(pl,en):pl;
  const TX={
    nad:L("Tajny kod!","Secret code!"),tytul:L("Tryb oszusta","Cheat mode"),
    opis:L("Działa do zamknięcia gry albo do wyłączenia w menu.","It lasts until you close the game or turn it off in the menu."),
    // Karta celowo nie mówi, czego dokładnie nie można odblokować: nie wylicza już supersekretów po nazwie
    // — wyliczanka była zarazem spoilerem i instrukcją, czego szukać. Zostaje sama zasada.
    plus:L("Masz dostęp do (prawie) wszystkiego: motywów planszy, efektów i instrumentów. Sekretne osiągnięcia zdobędziesz wyłącznie, grając uczciwie.",
      "You get (almost) everything: board themes, effects and instruments. Secret achievements can only be earned by playing fair."),
    zasady:[L("Postępy się nie liczą: bez sławy i poziomów.","Nothing counts: no fame, no levels."),
      L("Nie odblokujesz skórek ani nagród.","You won't unlock skins or rewards."),
      L("Nic się nie zapisuje: wyniki, ustawienia i zmiany znikną po wyłączeniu trybu albo zamknięciu gry.","Nothing is saved: scores, settings and changes vanish when you turn it off or close the game.")],
    znowu:L("Tryb oszusta już działa. Ale konfetti zawsze się przyda.","Cheat mode is already on. Confetti never hurts, though."),
    ok:L("Gram!","Let's play!"),zamknij:L("Zamknij","Close")};
  const PALETA=["#ec1a83","#e8632b","#ffd84a","#5bb86b","#3d8fd6","#8c5bd6","#faf6ee"];
  let ostatnie=[],ost=0,box=null,raf=0,powrot=null;

  // ---- nasłuch ----
  const wPolu=t=>!!t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT"||t.isContentEditable);
  const wMenu=()=>typeof S!=="undefined"&&!!S&&S.ekran==="lobby"&&S.lobbyEkran==="menu";
  function odcisk(lista){
    let h=2166136261>>>0;
    for(const ch of lista.join("|")){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
    return h;
  }
  function klawisz(e){
    if(box){if(e.key==="Escape"){e.stopPropagation();e.preventDefault();zamknij();}return;}
    if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||wPolu(e.target)||!wMenu()){ostatnie=[];return;}
    const k=e.key.length===1?e.key.toLowerCase():e.key,teraz=performance.now();
    if(teraz-ost>PRZERWA)ostatnie=[];
    ost=teraz;
    ostatnie.push(k);if(ostatnie.length>DLUGOSC)ostatnie.shift();
    if(ostatnie.length===DLUGOSC&&odcisk(ostatnie)===ODCISK){ostatnie=[];odpal();}
  }

  // ---- odpalenie ----
  function odpal(){
    const nowy=typeof TrybOszusta!=="undefined"&&TrybOszusta.wlacz(),r={bylo:!nowy};
    try{if(typeof DzwiekiUI!=="undefined"&&DzwiekiUI.graj)DzwiekiUI.graj("odblokowanie");}catch(e){}
    pokaz(r);
    odswiez();
    return r;
  }
  function cofnij(){const r=Postepy.odblokujWszystko(false);odswiez();return r;}
  // Lobby rysuje karty i pasek planszy od nowa (nowe opcje w strzałkach); menu odświeża przycisk Studia.
  function odswiez(){try{if(typeof Studio!=="undefined"&&Studio.odswiez)Studio.odswiez();}catch(e){}
    try{if(typeof odswiezNagrodyDoOdbioru==="function")odswiezNagrodyDoOdbioru();}catch(e){}   // tryb oszusta chowa „Odbierz nagrody”
    try{if(typeof S!=="undefined"&&S.ekran==="lobby"&&typeof rysujGraczy==="function")rysujGraczy();}catch(e){}}

  // ---- zasłona: konfetti + karta ----
  const spokoj=()=>{try{return typeof ruchOgraniczony==="function"&&ruchOgraniczony();}catch(e){return false;}};
  function pokaz(r){
    zamknij(true);
    powrot=document.activeElement;
    box=document.createElement("div");box.id="menuDodatek";box.setAttribute("role","dialog");box.setAttribute("aria-modal","true");box.setAttribute("aria-labelledby","menuDodatekTytul");
    const cv=document.createElement("canvas");cv.className="dodatek-konfetti";cv.setAttribute("aria-hidden","true");
    const karta=document.createElement("div");karta.className="karta dodatek-karta";
    const nad=document.createElement("span");nad.className="dodatek-nad";nad.textContent=TX.nad;
    const tyt=document.createElement("h2");tyt.className="dodatek-tytul";tyt.id="menuDodatekTytul";tyt.textContent=TX.tytul;
    const zaba=document.createElement("div");zaba.className="dodatek-zaba";zaba.setAttribute("aria-hidden","true");
    for(let i=0;i<3;i++){const im=document.createElement("img");im.src="../assets/frog/zaba-oszust.webp";im.alt="";im.decoding="async";zaba.append(im);}
    const opis=document.createElement("p");opis.className="dodatek-opis";opis.textContent=r&&r.bylo?TX.znowu:TX.opis;
    const zasady=document.createElement("ul");zasady.className="dodatek-zasady";
    if(!(r&&r.bylo)){
      const plus=document.createElement("li");plus.className="dodatek-plus";plus.textContent=TX.plus;zasady.append(plus);
      for(const z of TX.zasady){const li=document.createElement("li");li.textContent=z;zasady.append(li);}
    }
    const ok=document.createElement("button");ok.type="button";ok.className="przycisk dodatek-ok";ok.textContent=TX.ok;ok.onclick=()=>zamknij();
    const zam=document.createElement("button");zam.type="button";zam.className="gracz-usun tablica-zamknij dodatek-zamknij";zam.textContent="×";
    zam.setAttribute("aria-label",TX.zamknij);zam.title=TX.zamknij;zam.onclick=()=>zamknij();
    karta.append(zam,zaba,nad,tyt,opis);if(zasady.children.length)karta.append(zasady);karta.append(ok);
    box.append(cv,karta);
    box.addEventListener("pointerdown",e=>{if(e.target===box)zamknij();});
    document.body.append(box);
    konfetti(cv);
    ok.focus({preventScroll:true});
  }
  function zamknij(cicho){
    if(!box)return;
    cancelAnimationFrame(raf);raf=0;
    box.remove();box=null;
    if(!cicho&&powrot&&powrot.isConnected&&powrot.focus)try{powrot.focus({preventScroll:true});}catch(e){}
    powrot=null;
  }
  // Konfetti: filcowe łatki (prostokąt z fastrygą), gwiazdki i naklejki żaby (IMG.zaby z gry, gdy już wczytane) sypią
  // się z góry z lekkim wiatrem i obrotem; kilka większych żab wyskakuje z dołu. Płótno w rozdzielczości okna (dpr ≤ 1,5).
  function konfetti(cv){
    const dpr=Math.min(1.5,window.devicePixelRatio||1),W=innerWidth,H=innerHeight;
    cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
    const c=cv.getContext("2d");if(!c)return;
    c.setTransform(dpr,0,0,dpr,0,0);
    const zaby=(typeof IMG!=="undefined"&&IMG&&Array.isArray(IMG.zaby)?IMG.zaby:[]).filter(im=>im&&im.complete&&im.naturalWidth>0);
    const los=(a,b)=>a+Math.random()*(b-a);
    const cz=[];
    for(let i=0;i<ILE;i++){
      const rodzaj=Math.random()<.12&&zaby.length?"zaba":Math.random()<.22?"gwiazda":"latka";
      // pierwsza fala wpada szybko (jest na ekranie w pierwszej sekundzie), potem łatki wracają z góry spokojniej
      cz.push({rodzaj,x:los(0,W),y:los(-H*.5,-10),vx:los(-40,40),vy:los(320,640),kat:los(0,Math.PI*2),vk:los(-3,3),
        w:rodzaj==="zaba"?los(34,54):los(12,26),h:los(9,18),kolor:PALETA[i%PALETA.length],img:zaby.length?zaby[i%zaby.length]:null,op:0});
    }
    for(let i=0;i<6&&zaby.length;i++)cz.push({rodzaj:"zaba",x:los(W*.1,W*.9),y:H+40,vx:los(-60,60),vy:los(-560,-420),kat:los(-.4,.4),vk:los(-2,2),
      w:los(70,110),h:0,kolor:"#fff",img:zaby[i%zaby.length],op:0,skok:true});
    const t0=performance.now();let ost=t0;
    function rysuj(dt,t){
      c.clearRect(0,0,W,H);
      for(const p of cz){
        if(p.skok)p.vy+=900*dt;else p.vy+=p.vy>220?-260*dt:120*dt;   // łatki hamują do spokojnego opadania
        p.vx+=Math.sin(t*1.7+p.kat)*20*dt;
        p.x+=p.vx*dt;p.y+=p.vy*dt;p.kat+=p.vk*dt;
        if(!p.skok&&p.y>H+40){p.y=los(-80,-20);p.x=los(0,W);p.vy=los(120,240);}
        const zanik=Math.max(0,Math.min(1,(CZAS-(t*1000))/600));
        c.save();c.translate(p.x,p.y);c.rotate(p.kat);c.globalAlpha=zanik;
        if(p.rodzaj==="zaba"&&p.img)c.drawImage(p.img,-p.w/2,-p.w/2,p.w,p.w);
        else if(p.rodzaj==="gwiazda"){
          c.fillStyle=p.kolor;c.beginPath();
          for(let k=0;k<10;k++){const r=k%2?p.w*.22:p.w*.5,a=k*Math.PI/5-Math.PI/2;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
          c.closePath();c.fill();
        }else{
          c.fillStyle=p.kolor;c.beginPath();c.roundRect(-p.w/2,-p.h/2,p.w,p.h,3);c.fill();
          c.strokeStyle="rgba(33,31,29,.55)";c.lineWidth=1.2;c.setLineDash([3,2.5]);
          c.beginPath();c.roundRect(-p.w/2+2.5,-p.h/2+2.5,p.w-5,p.h-5,2);c.stroke();
        }
        c.restore();
      }
    }
    if(spokoj()){for(const p of cz){p.y=los(0,H);p.vy=0;p.skok=false;}rysuj(0,0);return;}   // ograniczony ruch: jedna stojąca klatka
    function petla(now){
      if(!box||!cv.isConnected)return;
      const dt=Math.min(.05,(now-ost)/1000),t=(now-t0)/1000;ost=now;
      rysuj(dt,t);
      if(now-t0<CZAS)raf=requestAnimationFrame(petla);else c.clearRect(0,0,W,H);
    }
    raf=requestAnimationFrame(petla);
  }

  window.addEventListener("keydown",klawisz,true);
  if(DEV&&typeof window!=="undefined"&&window.ZC)window.ZC.dodatek={odpal,cofnij,zamknij:()=>zamknij(),get otwarte(){return !!box;}};
})();
