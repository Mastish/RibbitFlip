"use strict";
// ===== RIBBITBEAT: KURSOR-ŁAPKA, sterowanie menu kapslem i padem =====
// W menu kapsel i pad prowadzą po ekranie żabią łapkę, jak wskaźnik pilota konsoli. Do 11-20 był też tryb
// „Skoki” (przechył kapsla przeskakiwał fokusem między przyciskami) z przełącznikiem w stopce, ale kto miał kapsel
// w ręce, nieświadomie skakał po menu i nie wiedział dlaczego. Został sam tryb łapki; skoki fokusu z krokPilotow
// zostały w kodzie tylko dla testów (KursorLapka.ustaw("fokus")), klawiatura i krzyżak pada dalej skaczą. Przechył kapsla
//     to pozycja łapki WPROST (kapsel płasko = środek ekranu, przechył do oporu = brzeg), lewa gałka pada
//     przesuwa łapkę z prędkością wychylenia. Krótkie naciśnięcie kapsla albo A na padzie klika to, co jest
//     pod czubkiem palca; przytrzymanie kapsla i B/Back pada cofają jak dotąd.
// Łapka to TEN SAM wskaźnik, który gra ma dla myszy (żabia dłoń w rękawiczce, web/assets/cursor/, reguły na końcu
// gry.css): te same rysunki, rozmiar i punkt kliknięcia, w tych samych trzech pozach (spoczynek, najazd na coś
// klikalnego w różowym obrysie, wciśnięcie). Jedyna różnica: kółko z numerkiem gracza w kolorze jego kapsla, bo
// każdy kapsel i każdy pad ma WŁASNĄ łapkę i kilka osób może wskazywać naraz. Wskaźnika myszy moduł nie rusza.
//
// Co łapka umie poza kliknięciem: podświetla element, który kliknie (.lapka-nad), przewija listę, gdy stoi przy
// jej górnej albo dolnej krawędzi, suwak ustawia w miejscu kliknięcia, a listę <select> przełącza na następną
// pozycję. Okna systemowe (wybór pliku, pełny ekran) wymagają prawdziwego kliknięcia i łapka ich nie otworzy,
// tak samo jak fokus kapsla.
//
// Gdzie NIE działa (zostaje sterowanie tych miejsc): samouczek, okno wyboru planszy i dźwignia koła nagród.
// W kroku Rozgrywka łapka kapsla działa od 11-20 (wcześniej kapsel chodził tam po polach swojej karty, co gracz
// brał za nagłe przełączenie na „wybieranie”). Decyduje o tym krokPilotow; pad pyta przez przejmujePada().
//
// Dawny wybór trybu z localStorage (klucz KLUCZ) jest ignorowany i kasowany przy starcie.
const KursorLapka=(function(){
  const KLUCZ="ribbitflip.zabiChor.sterowanieMenu";
  const C={
    ZAKRES_X:26,ZAKRES_Y:18,   // przechył (°), przy którym łapka dochodzi do brzegu ekranu: w bok i przód/tył
    GLADKO:.06,                // stała czasowa wygładzania pozycji kapsla (s)
    PAD_PX:1.15,               // prędkość łapki pada przy gałce do oporu, w szerokościach ekranu na sekundę
    PAD_MARTWA:.14,PAD_KRZYWA:1.6,
    BRZEG:.16,BRZEG_MAX:90,    // strefa przewijania przy krawędzi listy (część wysokości, najwyżej tyle px)
    PRZEWIN:1100,              // prędkość przewijania listy przy samej krawędzi (px/s)
    BADAJ:.05,                 // co ile sekund łapka sprawdza, co ma pod sobą
    ZNIKA:700,                 // po tylu ms bez ruchu ze sterownika łapka gaśnie (wyjście z menu, kapsel zamilkł)
    WCISK:170};                // tyle ms łapka pokazuje palec w dół po kliknięciu
  // Pozy łapki = rysunki wskaźnika myszy z gry.css (blok „KURSOR »DŁOŃ Z PIANKI«”): plik, bok w px i punkt
  // kliknięcia [x,y] takie same jak tam, żeby łapka kapsla nie różniła się od wskaźnika myszy.
  const RYSUNKI="../assets/cursor/";
  const POZY={spoczynek:{plik:"hand-idle-36.png",bok:36,punkt:[15,3]},najazd:{plik:"hand-idle-hot-38.png",bok:38,punkt:[16,4]},
    wcisk:{plik:"hand-press-36.png",bok:36,punkt:[15,3]}};
  const KLIKALNE='button,a[href],[role="button"],[role="tab"],[role="radio"],[role="switch"],[role="checkbox"],[role="option"],'+
    'input,select,textarea,label,summary,canvas[tabindex]';
  const POLE_TEKSTU='input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]):not([type="file"]),textarea';
  const dok=typeof document!=="undefined"?document:null;
  const czas=()=>typeof performance!=="undefined"?performance.now():Date.now();
  const ogr=(v,a,b)=>Math.max(a,Math.min(b,v));
  let tryb="kursor";
  const kursory=new Map();   // id sterownika → {el, kapsel, x, y, widac, czas, badaj, cel, przewijak}
  const nad=new Set();       // elementy podświetlone którąkolwiek łapką
  const padCzas=new Map();

  // Przechył kapsla → punkt na ekranie. Dodatni pitch spycha w dół, dodatni roll w prawo (jak mysz aplikacji).
  function pozaNaEkran(pitch,roll,szer,wys){
    const x=szer/2+ogr((+roll||0)/C.ZAKRES_X,-1,1)*szer/2,y=wys/2+ogr((+pitch||0)/C.ZAKRES_Y,-1,1)*wys/2;
    return {x:ogr(x,0,Math.max(0,szer-1)),y:ogr(y,0,Math.max(0,wys-1))};
  }
  // Gałka pada → prędkość −1..1 z martwą strefą i krzywą (małe wychylenie = precyzja, do oporu = szybko).
  function osGalki(v){
    const a=Math.abs(+v||0);
    return a<C.PAD_MARTWA?0:Math.sign(v)*Math.pow((a-C.PAD_MARTWA)/(1-C.PAD_MARTWA),C.PAD_KRZYWA);
  }
  // Wartość suwaka z miejsca kliknięcia (ułamek 0..1 szerokości), dociągnięta do kroku.
  function wartoscSuwaka(min,max,krok,ulamek){
    min=+min||0;max=max===""||max==null||isNaN(+max)?100:+max;krok=+krok>0?+krok:1;
    const v=min+(max-min)*ogr(+ulamek||0,0,1);
    return +ogr(min+Math.round((v-min)/krok)*krok,min,max).toFixed(6);
  }

  // Numer gracza na łapce: miejsce w składzie (1, 2, 3…). Kto jeszcze nie dołączył do składu (np. pad w menu),
  // dostaje kolejny wolny numer za składem, w kolejności pojawienia się, żeby dwie łapki nie miały tego samego.
  const pozaSkladem=[];
  function numerGracza(id){
    let n=0;
    try{if(typeof S!=="undefined"&&S&&S.gracze){const i=S.gracze.findIndex(g=>g.id===id);if(i>=0)return i+1;n=S.gracze.length;}}catch(e){}
    if(!pozaSkladem.includes(id))pozaSkladem.push(id);
    try{if(n)for(let i=pozaSkladem.length-1;i>=0;i--)if(pozaSkladem[i]!==id&&S.gracze.some(g=>g.id===pozaSkladem[i]))pozaSkladem.splice(i,1);}catch(e){}
    return n+pozaSkladem.indexOf(id)+1;
  }
  // Napis na kółku: ciemny na jasnym kolorze kapsla, biały na ciemnym.
  function kolorNapisu(kolor){
    const m=/^#?([0-9a-f]{6})$/i.exec(String(kolor||"").trim());if(!m)return "#ffffff";
    const v=parseInt(m[1],16),f=c=>{c/=255;return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4);};
    const l=.2126*f(v>>16&255)+.7152*f(v>>8&255)+.0722*f(v&255);
    return (l+.05)/(.0122+.05)>=(1+.05)/(l+.05)?"#1b1917":"#ffffff";   // który napis ma większy kontrast z tłem
  }

  function aktywny(){return tryb==="kursor";}
  // Pad oddaje łapce gałkę i przycisk A wszędzie poza kołem nagród (tam A to dźwignia trzymana „na moc”).
  function przejmujePada(){return aktywny()&&!(typeof Nagrody!=="undefined"&&Nagrody&&Nagrody.otwarte);}

  function kursor(id,d){
    let k=kursory.get(id);
    if(!k){
      const e=dok.createElement("div");e.className="lapka";e.setAttribute("aria-hidden","true");
      for(const n in POZY){   // trzy pozy leżą jedna na drugiej, widać tę, którą wskazuje klasa łapki (gry-kursor.css)
        const o=POZY[n],im=dok.createElement("img");im.className="lapka-rys lapka-"+n;im.alt="";im.draggable=false;
        im.width=o.bok;im.height=o.bok;im.style.left=-o.punkt[0]+"px";im.style.top=-o.punkt[1]+"px";im.src=RYSUNKI+o.plik;e.append(im);
      }
      const nr=dok.createElement("b");nr.className="lapka-nr";
      e.append(nr);dok.body.append(e);
      k={id,el:e,nr,numer:0,kolor:"",x:innerWidth/2,y:innerHeight/2,widac:false,czas:0,badaj:0,cel:null,przewijak:null};
      kursory.set(id,k);
    }
    if(d){
      if(d.kolor&&d.kolor!==k.kolor){k.kolor=d.kolor;k.el.style.setProperty("--kolor",d.kolor);k.el.style.setProperty("--napis",kolorNapisu(d.kolor));}
      if(d.numer&&d.numer!==k.numer){k.numer=d.numer;k.nr.textContent=String(d.numer);}
    }
    return k;
  }
  function ustawPozycje(k,x,y){
    k.x=ogr(x,0,Math.max(0,innerWidth-1));k.y=ogr(y,0,Math.max(0,innerHeight-1));
    k.el.style.transform="translate3d("+k.x.toFixed(1)+"px,"+k.y.toFixed(1)+"px,0)";
    if(!k.widac){k.widac=true;k.el.classList.add("widac");}
    k.czas=czas();
  }
  function schowaj(k){
    if(!k.widac)return;
    k.widac=false;k.cel=null;k.przewijak=null;k.el.classList.remove("widac","klik","nad");
  }
  function nieczynny(e){return !!e.disabled||e.getAttribute("aria-disabled")==="true"||!!e.closest("[inert]");}
  function przewijalny(e){
    for(let n=e;n&&n!==dok.body&&n.nodeType===1;n=n.parentElement){
      if(n.scrollHeight>n.clientHeight+4&&/(auto|scroll)/.test(getComputedStyle(n).overflowY))return n;
    }
    return null;
  }
  function odswiezNad(){
    const teraz=new Set();
    for(const k of kursory.values())if(k.widac&&k.cel)teraz.add(k.cel);
    for(const e of nad)if(!teraz.has(e)){e.classList.remove("lapka-nad");nad.delete(e);}
    for(const e of teraz)if(!nad.has(e)){e.classList.add("lapka-nad");nad.add(e);}
  }
  // Co łapka ma pod czubkiem palca (co BADAJ s) i przewijanie listy przy jej krawędzi (co klatkę).
  function obejrzyj(k,dt){
    k.badaj-=dt;
    if(k.badaj<=0){
      k.badaj=C.BADAJ;
      const e=dok.elementFromPoint(k.x,k.y),i=e&&e.closest?e.closest(KLIKALNE):null;
      k.cel=i&&!nieczynny(i)?i:null;k.przewijak=e?przewijalny(e):null;
      k.el.classList.toggle("nad",!!k.cel);
      odswiezNad();
    }
    const p=k.przewijak;
    if(p&&dt>0){
      const r=p.getBoundingClientRect(),m=Math.min(C.BRZEG_MAX,r.height*C.BRZEG);
      const v=k.y<r.top+m?-(r.top+m-k.y)/m:k.y>r.bottom-m?(k.y-(r.bottom-m))/m:0;
      if(v)p.scrollTop+=ogr(v,-1,1)*C.PRZEWIN*dt;
    }
  }
  // Kliknięcie tym, co stoi pod łapką. Zwraca false tylko wtedy, gdy ten sterownik nie ma widocznej łapki
  // (wtedy pad klika po staremu to, co ma fokus).
  function klik(id){
    const k=kursory.get(id);if(!k||!k.widac)return false;
    k.el.classList.add("klik");clearTimeout(k.wcisk);k.wcisk=setTimeout(()=>k.el.classList.remove("klik"),C.WCISK);
    const e=dok.elementFromPoint(k.x,k.y);if(!e)return true;
    const i=e.closest?e.closest(KLIKALNE):null;
    if(typeof DzwiekiUI!=="undefined"&&DzwiekiUI&&DzwiekiUI.oznaczWejscie)DzwiekiUI.oznaczWejscie("pad");
    if(i&&nieczynny(i)){if(typeof DzwiekiUI!=="undefined"&&DzwiekiUI&&DzwiekiUI.zglos)DzwiekiUI.zglos("blad");return true;}
    if(i&&i.matches('input[type="range"]')){
      const r=i.getBoundingClientRect();
      i.value=String(wartoscSuwaka(i.min,i.max,i.step,r.width?(k.x-r.left)/r.width:0));
      i.dispatchEvent(new Event("input",{bubbles:true}));i.dispatchEvent(new Event("change",{bubbles:true}));return true;
    }
    if(i&&i.matches("select")){
      if(i.options.length){i.selectedIndex=(i.selectedIndex+1)%i.options.length;
        i.dispatchEvent(new Event("input",{bubbles:true}));i.dispatchEvent(new Event("change",{bubbles:true}));}
      return true;
    }
    if(i&&i.matches(POLE_TEKSTU)){i.focus({preventScroll:true});return true;}
    e.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window,clientX:k.x,clientY:k.y,button:0}));
    k.badaj=0;   // kliknięcie zwykle zmienia ekran: następna klatka od razu sprawdza, co jest pod łapką
    return true;
  }

  // Kapsel: woła krokPilotow (zabi-chor.js) co klatkę w zwykłym menu. `z` to zdarzenia krokPilota (ok, wstecz).
  function krokKapsla(w,z,dt){
    if(!dok||!w)return;
    if(w.swiezy!==false){   // kapsel, który przestał nadawać ruch, nie przesuwa łapki (zgaśnie sama), ale przycisk dalej działa
      const k=kursor(w.id,{kolor:w.kolor||"#6cb33f",numer:numerGracza(w.id)});
      const c=pozaNaEkran(w.pitch,w.roll,innerWidth,innerHeight);
      const a=k.widac?1-Math.exp(-Math.max(0,+dt||0)/C.GLADKO):1;   // pierwsze pokazanie: od razu na miejscu
      ustawPozycje(k,k.x+(c.x-k.x)*a,k.y+(c.y-k.y)*a);
      obejrzyj(k,+dt||0);
    }
    if(z&&z.ok)klik(w.id);
    if(z&&z.wstecz&&typeof nawigujLobby==="function")nawigujLobby("wstecz");
  }
  // Pad: woła krokPadaWMenu (wejscie.js) co klatkę w menu. Łapka pada pojawia się przy pierwszym ruchu gałki
  // i zostaje tam, gdzie ją zostawiono, dopóki pad jest w menu.
  function krokPada(p){
    if(!dok||!p)return;
    const id="pad-"+p.index,t=czas(),ost=padCzas.get(id);padCzas.set(id,t);
    const dt=ost==null?0:ogr((t-ost)/1000,0,.05),ax=p.axes||[];
    const vx=osGalki(ax[0]),vy=osGalki(ax[1]);
    let k=kursory.get(id);
    if(!vx&&!vy&&!(k&&k.widac))return;
    const zr=typeof Wejscie!=="undefined"&&Wejscie&&Wejscie.gracz?Wejscie.gracz(id):null;   // pad, który gra, ma swój kolor
    k=kursor(id,{kolor:(zr&&zr.kolor)||"#f0a92c",numer:numerGracza(id)});
    const v=C.PAD_PX*innerWidth;
    ustawPozycje(k,k.x+vx*v*dt,k.y+vy*v*dt);
    obejrzyj(k,dt);
  }
  function sprzataj(){
    const t=czas();let zmiana=false;
    for(const k of kursory.values())if(k.widac&&t-k.czas>C.ZNIKA){schowaj(k);zmiana=true;}
    if(zmiana)odswiezNad();
  }

  // Tryb „fokus” (skoki) ustawiają już tylko testy ścieżki krokPilotow; gracz zawsze ma łapkę.
  function ustaw(t){
    tryb=t==="fokus"?"fokus":"kursor";
    if(!dok)return;
    dok.documentElement.classList.toggle("ster-kursor",tryb==="kursor");
    if(tryb==="kursor"){if(typeof schowajPilota==="function")schowajPilota();}
    else{for(const k of kursory.values())schowaj(k);odswiezNad();}
  }
  function start(){
    try{localStorage.removeItem(KLUCZ);}catch(e){}
    ustaw("kursor");
    setInterval(sprzataj,250);
  }
  if(dok){
    if(dok.readyState==="loading")dok.addEventListener("DOMContentLoaded",start);else start();
  }
  return {aktywny,przejmujePada,ustaw,tryb:()=>tryb,krokKapsla,krokPada,klik,
    // dla testów i harnessu
    pozaNaEkran,osGalki,wartoscSuwaka,kolorNapisu,C,POZY,
    stan:()=>({tryb,kursory:[...kursory.values()].map(k=>({id:k.id,x:+k.x.toFixed(1),y:+k.y.toFixed(1),widac:k.widac,numer:k.numer,kolor:k.kolor,
      cel:k.cel?(k.cel.id||k.cel.className||k.cel.tagName):null}))})};
})();
if(typeof window!=="undefined")window.KursorLapka=KursorLapka;
if(typeof module!=="undefined"&&module.exports)module.exports=KursorLapka;
