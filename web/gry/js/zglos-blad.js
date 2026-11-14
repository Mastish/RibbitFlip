// RibbitBeat: „Zgłoś błąd” (2026-10-19). Okno z opisem problemu → plik tekstowy z dziennikiem gry
// (pobierany na dysk) → przejście na forum #pomoc na Discordzie, gdzie gracz SAM zakłada wątek i wrzuca plik.
//
// Gra niczego nie wysyła: tak samo jak „Zgłoś problem” w panelu RibbitFlip (web/js/rf-47-diag.js). Wpis musi wyjść
// z konta gracza (inaczej nie zobaczy odpowiedzi), a webhook wszyty w .exe nie da się wymienić, gdy ktoś go nadużyje.
//
// RODO (dane osobowe w pliku): plik jest zwykłym tekstem, który gracz widzi przed wrzuceniem (podgląd w oknie).
// Zbieramy WYŁĄCZNIE dane techniczne z listy (dozwolone, nie „wszystko poza…”):
//   wersja przeglądarki (sama marka i numer), system (sama nazwa), ekran i skala, karta graficzna (model), język gry,
//   ekran gry, liczba graczy i ich sterowanie (mysz/klawiatura/pad/kapsel/bot) BEZ nazw, ustawienia gry (bez
//   `instrumentyGraczy`), id piosenki tylko dla wbudowanych (własne = „własny utwór”), tryb oszusta, ostatnie błędy
//   i ostrzeżenia z konsoli (najwyżej 60, każdy ≤ 400 znaków).
// NIE zbieramy: nazw profili i konta, nazw graczy, tytułów i plików własnych utworów, zapisu postępów, adresów IP,
// pełnego user-agenta. Każdy tekst (opis gracza też) przechodzi przez `wyczysc`: nazwy profili/graczy/konta i tytuły
// własnych utworów → «gracz» / «własny utwór», e-maile → «e-mail», C:\Users\<konto> → C:\Users\…, adresy bez zapytania
// (?…) i bez długich ciągów (tokeny), ciągi cyfr ≥ 9 (telefony) → «liczba».
//
// Dziennik błędów zbiera się od startu strony (plik ładowany wcześnie, po tryb-oszusta.js): window error,
// unhandledrejection, console.error/console.warn (oryginały dalej działają).
// API: ZglosBlad.otworz(), ZglosBlad.tekst(opis) (treść pliku; testy), ZglosBlad.wyczysc(s).
(function(){
  "use strict";
  const L=(pl,en)=>typeof RBJezyk!=="undefined"&&RBJezyk.wybierz?RBJezyk.wybierz(pl,en):pl;
  // forum #pomoc (link działa dla członków serwera) i zaproszenie (dla reszty), te same co w panelu (rf-00-core.js)
  const POMOC="https://discord.com/channels/1540354827517693952/1540416135017799810";
  const ZAPROSZENIE="https://discord.gg/tyv2MjjVdb";
  const MAKS_WPISOW=60,MAKS_DL=400,MAKS_OPIS=1500;
  const TX={
    link:L("Zgłoś błąd","Report a bug"),
    linkAria:L("Zgłoś błąd: przygotuj plik z dziennikiem i opisz problem na Discordzie","Report a bug: prepare a log file and describe the problem on Discord"),
    tytul:L("Zgłoś błąd","Report a bug"),
    lead:L("Opisz, co się stało. Gra przygotuje plik z dziennikiem, a Ty wrzucisz go z opisem na forum #pomoc na Discordzie.",
      "Describe what happened. The game prepares a log file, and you post it with the description in the #pomoc forum on Discord."),
    etykieta:L("Co się stało? Co robiłeś tuż przed?","What happened? What were you doing right before?"),
    placeholder:L("Np. po wybraniu piosenki ekran zrobił się czarny, a muzyka grała dalej.","E.g. after picking a song the screen went black and the music kept playing."),
    uwaga:L("Nie wpisuj imion, nazwisk, adresów ani e-maili.","Don't type names, addresses or e-mails."),
    coJest:L("Co jest w pliku","What's in the file"),
    coJestOpis:L("Twój opis, wersja przeglądarki, system, ekran, karta graficzna, ustawienia gry i ostatnie błędy gry. Bez nazw profili i graczy, bez tytułów Twoich utworów, bez postępów i bez adresów. Możesz go przeczytać, zanim go wrzucisz.",
      "Your description, browser version, system, screen, graphics card, game settings and the game's recent errors. No profile or player names, no titles of your songs, no progress and no addresses. You can read it before posting."),
    podglad:L("Pokaż zawartość pliku","Show the file contents"),
    pobierz:L("Pobierz plik z dziennikiem","Download the log file"),
    anuluj:L("Anuluj","Cancel"),zamknij:L("Zamknij","Close"),
    pustyOpis:L("Napisz kilka słów o problemie, to bardzo pomaga.","Write a few words about the problem, it helps a lot."),
    gotowyTytul:L("Prawie gotowe!","Almost done!"),
    krok1:L("Plik {plik} jest w folderze Pobrane.","The file {plik} is in your Downloads folder."),
    krok2:L("Otwórz forum #pomoc i załóż nowy wątek.","Open the #pomoc forum and start a new thread."),
    krok3:L("Wklej opis (jest już skopiowany) i przeciągnij plik do wątku.","Paste the description (already copied) and drag the file into the thread."),
    krok3bez:L("Wpisz opis i przeciągnij plik do wątku.","Type the description and drag the file into the thread."),
    otworzPomoc:L("Otwórz #pomoc ↗","Open #pomoc ↗"),
    dolacz:L("Nie jesteś na serwerze? Dołącz ↗","Not on the server? Join ↗"),
    gotowe:L("Gotowe","Done"),
    gracz:"«"+L("gracz","player")+"»",utwor:"«"+L("własny utwór","own song")+"»"};
  const tt=(s,o)=>String(s).replace(/\{(\w+)\}/g,(m,k)=>o&&k in o?o[k]:m);

  // ---- dziennik od startu ----
  const t0=Date.now(),wpisy=[];
  const godz=d=>{const z=n=>String(n).padStart(2,"0");return z(d.getHours())+":"+z(d.getMinutes())+":"+z(d.getSeconds());};
  function tekstZ(x){
    if(x instanceof Error)return (x.name||"Error")+": "+x.message+(x.stack?"\n"+String(x.stack).split("\n").slice(1,5).join("\n"):"");
    if(typeof x==="string")return x;
    try{return JSON.stringify(x);}catch(e){return String(x);}
  }
  function dopisz(rodzaj,czesci){
    try{
      let s=czesci.map(tekstZ).join(" ");
      if(s.length>MAKS_DL)s=s.slice(0,MAKS_DL)+"…";
      wpisy.push({t:new Date(),rodzaj,s});
      if(wpisy.length>MAKS_WPISOW)wpisy.shift();
    }catch(e){}
  }
  window.addEventListener("error",e=>{
    if(e&&e.target&&e.target!==window&&e.target.tagName){dopisz("zasób",[e.target.tagName.toLowerCase()+" "+(e.target.src||e.target.href||"")]);return;}
    dopisz("błąd",[e&&e.error?e.error:(e&&e.message)||"?",e&&e.filename?"@ "+e.filename+":"+e.lineno+":"+e.colno:""]);
  },true);
  window.addEventListener("unhandledrejection",e=>dopisz("błąd (promise)",[e&&e.reason!=null?e.reason:"?"]));
  for(const [m,rodzaj] of [["error","błąd"],["warn","ostrzeżenie"]]){
    const org=console[m];
    if(typeof org!=="function")continue;
    console[m]=function(...a){dopisz(rodzaj,a);return org.apply(this,a);};
  }

  // ---- czyszczenie danych osobowych ----
  const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  function nazwyOsob(){
    const n=new Set();
    try{if(typeof Postepy!=="undefined"&&Postepy.lista)for(const p of Postepy.lista())if(p&&p.nazwa&&!p.gosc)n.add(String(p.nazwa));}catch(e){}
    try{if(typeof S!=="undefined"&&S&&Array.isArray(S.gracze))for(const g of S.gracze)if(g&&g.nazwa&&g.zrodlo!=="bot")n.add(String(g.nazwa));}catch(e){}
    try{if(typeof ZC!=="undefined"&&ZC.konto&&ZC.konto.aktywny){const a=ZC.konto.aktywny();if(a)n.add(String(a));}}catch(e){}
    try{const k=JSON.parse(localStorage.getItem("ribbitflip.zabiChor.konto")||"null");if(k&&k.aktywny)n.add(String(k.aktywny));}catch(e){}
    return [...n].map(x=>x.trim()).filter(x=>x.length>=2);
  }
  function wlasneUtwory(){
    const n=new Set();
    try{if(typeof B!=="undefined"&&B&&Array.isArray(B.moje))for(const p of B.moje)for(const k of ["tytul","nazwa","plik","autor","zrodlo","url"])if(p&&typeof p[k]==="string"&&p[k].trim().length>=3)n.add(p[k].trim());}catch(e){}
    return [...n];
  }
  function wyczysc(s){
    s=String(s==null?"":s);
    // najdłuższe najpierw, żeby „Ania Kowalska” nie zostało jako «gracz» Kowalska
    for(const u of wlasneUtwory().sort((a,b)=>b.length-a.length))s=s.split(u).join(TX.utwor);
    for(const n of nazwyOsob().sort((a,b)=>b.length-a.length))s=s.replace(new RegExp("(^|[^\\p{L}\\p{N}])"+esc(n)+"(?![\\p{L}\\p{N}])","giu"),(m,p)=>p+TX.gracz);
    s=s.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g,"«e-mail»");
    s=s.replace(/([A-Za-z]:[\\/]+Users[\\/]+)[^\\/\r\n"'<>]+/gi,"$1…");
    s=s.replace(/(file:\/\/\/?[A-Za-z]:\/Users\/)[^/\s"'<>]+/gi,"$1…");
    s=s.replace(/(https?:\/\/[^\s"'<>?#]+)[?#][^\s"'<>]*/g,"$1?…");
    s=s.replace(/blob:[^\s"'<>]+/g,"blob:…");
    s=s.replace(/[A-Za-z0-9_-]{24,}/g,m=>"«ukryto:"+m.length+"»");
    s=s.replace(/(?<![\w.:])\+?\d(?:[ -]?\d){8,}(?![\w.:])/g,"«liczba»");   // numer telefonu, PESEL itp.
    return s;
  }

  // ---- treść pliku ----
  function przegladarka(){
    const ua=navigator.userAgent||"";
    const m=ua.match(/Edg\/([\d.]+)/)||ua.match(/Chrome\/([\d.]+)/)||ua.match(/Firefox\/([\d.]+)/)||ua.match(/Version\/([\d.]+).*Safari/);
    const marka=/Edg\//.test(ua)?"Edge":/Chrome\//.test(ua)?"Chrome":/Firefox\//.test(ua)?"Firefox":/Safari\//.test(ua)?"Safari":"?";
    const sys=/Windows NT 10/.test(ua)?"Windows 10/11":/Windows/.test(ua)?"Windows":/Mac OS X/.test(ua)?"macOS":/Android/.test(ua)?"Android":/Linux/.test(ua)?"Linux":"?";
    return {przegladarka:marka+" "+(m?m[1]:"?"),system:sys};
  }
  function karta(){
    try{
      const c=document.createElement("canvas"),g=c.getContext("webgl2")||c.getContext("webgl");if(!g)return "brak WebGL";
      const d=g.getExtension("WEBGL_debug_renderer_info");
      return String(d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)).slice(0,160);
    }catch(e){return "?";}
  }
  function stanGry(){
    const o={};
    try{
      if(typeof S==="undefined"||!S)return o;
      o.ekran=S.ekran+(S.lobbyEkran?" / "+S.lobbyEkran:"");
      const g=Array.isArray(S.gracze)?S.gracze:[];
      o.gracze=g.length+(g.length?" ("+g.map(x=>x.zrodlo||"?").join(", ")+")":"");
      if(S.ust){const u=Object.assign({},S.ust);if(u.instrumentyGraczy)u.instrumentyGraczy="(pominięte, "+Object.keys(u.instrumentyGraczy).length+")";o.ustawienia=u;}
      const p=S.gra&&S.gra.piosenka;
      if(p){const wb=typeof BUILTIN!=="undefined"&&Array.isArray(BUILTIN)&&BUILTIN.some(d=>d.id===p.id);o.piosenka=wb?p.id:TX.utwor;}
    }catch(e){o.blad=String(e&&e.message||e);}
    try{if(typeof R!=="undefined"&&R){if(R.jakoscCzeka!=null)o.jakoscCzeka=R.jakoscCzeka;}}catch(e){}
    return o;
  }
  function tekst(opis){
    const p=przegladarka(),st=stanGry(),d=new Date(),z=n=>String(n).padStart(2,"0");
    const w=[];
    w.push("RibbitBeat: zgłoszenie błędu");
    w.push("Przygotowano: "+d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate())+" "+godz(d)+" (gra działa od "+Math.round((Date.now()-t0)/60000)+" min)");
    w.push("");
    w.push("== Opis ==");
    w.push(wyczysc(String(opis||"").trim().slice(0,MAKS_OPIS))||"(brak opisu)");
    w.push("");
    w.push("== Sprzęt i przeglądarka ==");
    w.push("Przeglądarka: "+p.przegladarka);
    w.push("System: "+p.system);
    w.push("Ekran: "+screen.width+"×"+screen.height+", okno "+innerWidth+"×"+innerHeight+", skala "+(window.devicePixelRatio||1));
    w.push("Karta graficzna: "+wyczysc(karta()));
    w.push("Rdzenie: "+(navigator.hardwareConcurrency||"?")+", pamięć: "+(navigator.deviceMemory?navigator.deviceMemory+" GB":"?"));
    w.push("Język gry: "+(typeof RBJezyk!=="undefined"&&RBJezyk.en?"en":"pl")+", ograniczony ruch: "+(matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches?"tak":"nie"));
    w.push("Adres gry: "+location.pathname+(/[?&]zywe=1/.test(location.search)?" (osobny program)":""));
    w.push("");
    w.push("== Gra ==");
    w.push("Ekran: "+(st.ekran||"?"));
    w.push("Gracze: "+(st.gracze||"0"));
    if(st.piosenka)w.push("Piosenka: "+st.piosenka);
    if(st.jakoscCzeka!=null)w.push("Strażnik klatek: "+st.jakoscCzeka);
    w.push("Tryb oszusta: "+(typeof TrybOszusta!=="undefined"&&TrybOszusta.aktywny?"tak":"nie"));
    if(st.ustawienia)w.push("Ustawienia: "+wyczysc(JSON.stringify(st.ustawienia)));
    w.push("");
    w.push("== Ostatnie błędy i ostrzeżenia ("+wpisy.length+") ==");
    if(!wpisy.length)w.push("(brak)");
    for(const x of wpisy)w.push("["+godz(x.t)+"] "+x.rodzaj+": "+wyczysc(x.s));
    w.push("");
    w.push("Plik nie zawiera nazw profili ani graczy, tytułów własnych utworów, postępów ani adresów.");
    return w.join("\n");
  }

  // ---- okno ----
  let box=null,powrot=null;
  const el=(tag,klasa,txt)=>{const e=document.createElement(tag);if(klasa)e.className=klasa;if(txt!=null)e.textContent=txt;return e;};
  function nazwaPliku(){const d=new Date(),z=n=>String(n).padStart(2,"0");return "RibbitBeat-zgloszenie-"+String(d.getFullYear()).slice(2)+z(d.getMonth()+1)+z(d.getDate())+"-"+z(d.getHours())+z(d.getMinutes())+".txt";}
  function pobierz(nazwa,tresc){
    const u=URL.createObjectURL(new Blob([tresc],{type:"text/plain;charset=utf-8"}));
    const a=el("a");a.href=u;a.download=nazwa;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),4000);
  }
  async function kopiuj(s){try{await navigator.clipboard.writeText(s);return true;}catch(e){return false;}}
  function otworz(){
    zamknij(true);
    powrot=document.activeElement;
    box=el("div","zglos-tlo");box.id="zglosBlad";
    const k=el("div","karta zglos-karta");k.setAttribute("role","dialog");k.setAttribute("aria-modal","true");k.setAttribute("aria-labelledby","zglosTytul");
    const zam=el("button","gracz-usun tablica-zamknij zglos-x","×");zam.type="button";zam.setAttribute("aria-label",TX.zamknij);zam.title=TX.zamknij;zam.onclick=()=>zamknij();
    const tyt=el("h2","zglos-tytul",TX.tytul);tyt.id="zglosTytul";
    const lead=el("p","zglos-lead",TX.lead);
    const lab=el("label","zglos-etykieta",TX.etykieta);lab.htmlFor="zglosOpis";
    const pole=el("textarea","zglos-pole");pole.id="zglosOpis";pole.rows=5;pole.maxLength=MAKS_OPIS;pole.placeholder=TX.placeholder;
    const uw=el("p","zglos-uwaga",TX.uwaga);
    const co=el("details","zglos-co");const sm=el("summary",null,TX.coJest);co.append(sm,el("p",null,TX.coJestOpis));
    const pg=el("details","zglos-podglad");const sm2=el("summary",null,TX.podglad);const pre=el("pre","zglos-pre");
    pg.append(sm2,pre);pg.addEventListener("toggle",()=>{if(pg.open)pre.textContent=tekst(pole.value);});
    pole.addEventListener("input",()=>{blad.hidden=true;if(pg.open)pre.textContent=tekst(pole.value);});
    const blad=el("p","zglos-blad",TX.pustyOpis);blad.hidden=true;blad.setAttribute("role","alert");
    const ok=el("button","przycisk glowny zglos-ok",TX.pobierz);ok.type="button";
    const an=el("button","przycisk zglos-anuluj",TX.anuluj);an.type="button";an.onclick=()=>zamknij();
    const rzad=el("div","zglos-przyciski");rzad.append(an,ok);
    ok.onclick=async()=>{
      if(pole.value.trim().length<3){blad.hidden=false;pole.focus();return;}
      const plik=nazwaPliku(),opis=wyczysc(pole.value.trim());
      pobierz(plik,tekst(pole.value));
      const skop=await kopiuj(opis);
      gotowe(k,plik,skop);
    };
    k.append(zam,tyt,lead,lab,pole,uw,blad,co,pg,rzad);
    box.append(k);
    box.addEventListener("pointerdown",e=>{if(e.target===box)zamknij();});
    document.body.append(box);
    pole.focus({preventScroll:true});
  }
  function gotowe(k,plik,skop){
    k.replaceChildren();
    const zam=el("button","gracz-usun tablica-zamknij zglos-x","×");zam.type="button";zam.setAttribute("aria-label",TX.zamknij);zam.title=TX.zamknij;zam.onclick=()=>zamknij();
    const tyt=el("h2","zglos-tytul",TX.gotowyTytul);tyt.id="zglosTytul";
    const ol=el("ol","zglos-kroki");
    for(const s of [tt(TX.krok1,{plik}),TX.krok2,skop?TX.krok3:TX.krok3bez])ol.append(el("li",null,s));
    const a=el("a","przycisk glowny zglos-pomoc",TX.otworzPomoc);a.href=POMOC;a.target="_blank";a.rel="noopener";
    const j=el("a","zglos-dolacz",TX.dolacz);j.href=ZAPROSZENIE;j.target="_blank";j.rel="noopener";
    const kon=el("button","przycisk zglos-gotowe",TX.gotowe);kon.type="button";kon.onclick=()=>zamknij();
    const rzad=el("div","zglos-przyciski");rzad.append(kon,a);
    k.append(zam,tyt,ol,rzad,j);
    a.focus({preventScroll:true});
  }
  function zamknij(cicho){
    if(!box)return;
    box.remove();box=null;
    if(!cicho&&powrot&&powrot.isConnected&&powrot.focus)try{powrot.focus({preventScroll:true});}catch(e){}
    powrot=null;
  }
  // Esc zamyka okno, zanim zobaczy go menu (faza przechwytywania); reszta klawiszy idzie normalnie (pole tekstowe
  // gra ignoruje: wejscie.js i zabi-chor.js pomijają INPUT/TEXTAREA).
  window.addEventListener("keydown",e=>{
    if(!box)return;
    if(e.key==="Escape"){e.stopPropagation();e.preventDefault();zamknij();return;}
    e.stopPropagation();   // menu i lobby nie dostają strzałek ani Entera, gdy okno jest otwarte
  },true);

  // przycisk w stopce menu (id menuZglos w index.html)
  function podepnij(){
    const b=document.getElementById("menuZglos");if(!b)return;
    const t=b.querySelector("span");if(t)t.textContent=TX.link;
    b.setAttribute("aria-label",TX.linkAria);b.title=TX.linkAria;
    b.onclick=e=>{e.preventDefault();otworz();};
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",podepnij);else podepnij();

  window.ZglosBlad={otworz,zamknij:()=>zamknij(),tekst,wyczysc,get otwarte(){return !!box;}};
})();
