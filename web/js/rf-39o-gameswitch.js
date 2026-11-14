"use strict";
// ============================================================================
//  AUTO-ZESTAWY WG GRY — panel tej funkcji.
//
//  Serwer pilnuje, które okno jest na wierzchu, i sam wczytuje zestaw przypisany do tej gry
//  (GameSwitcher w ribbitflip_monitor.py). Ten plik robi dwie rzeczy, których serwer zrobić
//  nie może:
//    * karta ustawień w zakładce „Biblioteka" — przełącznik funkcji i lista zapamiętanych
//      odpowiedzi („ta gra → ten zestaw"), obok karty stopu awaryjnego i karty MCP, bo to
//      wszystko są przełączniki CAŁEJ aplikacji, nie jednego kapsla,
//    * okno wyboru, gdy do wykrytej gry pasuje więcej niż jeden zestaw. Serwer w takiej
//      sytuacji NICZEGO nie wczytuje: zgadywanie między dwoma zestawami, które ktoś napisał
//      świadomie, jest gorsze niż nie zrobienie nic.
//
//  Polski jest pisany tutaj, angielski dochodzi z par niżej, wmieszanych do globalnego I18N_EN
//  ZANIM ruszy initI18n() — ten sam kontrakt co rf-39b-guides.js / rf-39j-hotkey.js.
// ============================================================================
const RF_GS_I18N={
 "Auto-zestawy wg gry":"Auto sets by game",
 "zestaw wczytuje się sam, gdy odpalasz grę":"the set loads itself when you start the game",
 "Zestaw zapisujesz pod grę, a wczytać go musisz przed jej włączeniem albo wyjściem z niej na pulpit. Ta funkcja to załatwia: aplikacja pilnuje, które okno jest na wierzchu, i gdy pojawia się gra przypisana do zestawu, wczytuje go sama. Grę przypisujesz w pasku wyżej, w polu „gra.exe”. Gdy do jednej gry pasuje kilka zestawów, aplikacja pyta, którego użyć, i może zapamiętać odpowiedź. Wczytanie zmienia wyłącznie ustawienia: żadna grupa wyjść nie włącza się sama, tak samo jak przy wczytywaniu ręcznym.":"You write a set for one game, and you have to load it before starting that game or by alt-tabbing out of it. This does that for you: the app watches which window is in front, and when a game a set is written for shows up, it loads the set by itself. You assign the game in the bar above, in the “game.exe” field. When several sets claim the same game the app asks which one to use, and can remember the answer. Loading only ever changes settings: no output group switches itself on, exactly as when you load a set by hand.",
 // Pole „gra.exe" w pasku zapisu (ribbitflip_dashboard.html). Placeholder i podpowiedź mieszkają
 // w atrybutach, które chodzik i18n tłumaczy tak samo jak tekst — ale tylko wtedy, gdy ma parę.
 // Bez tych dwóch linijek pole zostawało polskie na angielskim panelu.
 "gra.exe (auto-wczytywanie)":"game.exe (auto-load)",
 "Nazwa pliku gry, np. eldenring.exe. Gdy ta gra znajdzie się na wierzchu, aplikacja sama wczyta ten zestaw. Kilka nazw oddziel przecinkiem.":"The game's file name, e.g. eldenring.exe. When that game comes to the front, the app loads this set by itself. Separate several names with commas.",
 "Wczytuj zestaw sam po uruchomieniu gry":"Load the set by itself when the game starts",
 "Włącz albo wyłącz samoczynne wczytywanie zestawu wykrytej gry":"Turn on or off loading the detected game's set by itself",
 "Zapamiętane gry":"Remembered games",
 "Nie masz jeszcze zapamiętanych gier. Aplikacja zapamięta wybór, gdy zaznaczysz to w oknie z pytaniem „którego zestawu użyć”.":"No games remembered yet. The app remembers your pick when you tick the box in the “which set” question.",
 "Ta funkcja działa tylko w Windows: tylko tam da się zapytać, które okno jest na wierzchu.":"This only works on Windows: it is the only place where the app can ask which window is in front.",
 "Zapomnij tę grę":"Forget this game",
 "Wykryto grę":"Game detected",
 "Który zestaw wczytać?":"Which set should I load?",
 "Zapamiętaj dla tej gry":"Remember for this game",
 "Wczytaj":"Load",
 "Anuluj":"Cancel",
 "Zamknij":"Close",
 "Zestaw na kilka kapsli":"Multi-capsule set",
 "Nie wybrano zestawu.":"No set picked.",
 "Serwer nieosiągalny":"Server unreachable"
};
try{Object.assign(I18N_EN,RF_GS_I18N);}catch(e){}

// Ostatnia znana odpowiedź serwera. Trzymana, żeby przełącznik i lista nie migały pustką
// między kliknięciem a odpowiedzią — i żeby przerysowanie po zmianie języka nie musiało pytać.
let _gsState={enabled:false,defaults:{},lastExe:null,supported:true,watcherAlive:false};
let _gsBack=null;        // otwarte okno wyboru (singleton, jak rfBundleMap)

let _gsLoaded=false;     // true after the first server answer; before that (or with the mod off) we say nothing
function _gsSet(j){
  if(!j||typeof j!=="object")return;
  _gsLoaded=true;
  _gsState={enabled:j.enabled===true,
            defaults:(j.defaults&&typeof j.defaults==="object")?j.defaults:{},
            lastExe:j.lastExe||null,
            supported:j.supported!==false,
            watcherAlive:j.watcherAlive===true};
  rfGsRender();
}

function rfGsFetch(){
  return fetch("/gameswitch").then(function(r){return r.json();}).then(_gsSet).catch(function(){});
}

// --- karta ustawień ---------------------------------------------------------
function initGameSwitchUi(){
  // Okna nakładki i podglądu nie proponują cofnięcia: zabrałyby je zwykłemu oknu panelu.
  try{if(!/[?&](overlay=1|view=overview)/.test(location.search||""))_gsUndoResume();}catch(e){}
  const panel=document.getElementById("tab-konfiguracje");
  if(!panel||document.getElementById("gsCard"))return;
  // PIĘTRO 2 (UX 261120 L4c): ustawia się raz, potem zestaw wczytuje się sam. Zwijak na dole karty
  // biblioteki, pod paskiem zapisu z polem „gra.exe”; w nagłówku stan i liczba zapamiętanych gier.
  const card=document.createElement("details");card.className="cardfold inset gs-fold";card.id="gsCard";
  card.innerHTML=
    '<summary>Auto-zestawy wg gry</summary><div class="cardfold-body">'+
      '<p class="hint gs-fold-hint">zestaw wczytuje się sam, gdy odpalasz grę</p>'+
    '<div class="ra-lead">Zestaw zapisujesz pod grę, a wczytać go musisz przed jej włączeniem albo wyjściem z niej na pulpit. Ta funkcja to załatwia: aplikacja pilnuje, które okno jest na wierzchu, i gdy pojawia się gra przypisana do zestawu, wczytuje go sama. Grę przypisujesz w pasku wyżej, w polu „gra.exe”. Gdy do jednej gry pasuje kilka zestawów, aplikacja pyta, którego użyć, i może zapamiętać odpowiedź. Wczytanie zmienia wyłącznie ustawienia: żadna grupa wyjść nie włącza się sama, tak samo jak przy wczytywaniu ręcznym.</div>'+
    '<div class="setupbar mcpbar">'+
      '<span class="setuplbl">Wczytuj zestaw sam po uruchomieniu gry</span>'+
      '<div class="rf-toggle" id="gsEnable" role="switch" aria-checked="false" tabindex="0" title="Włącz albo wyłącz samoczynne wczytywanie zestawu wykrytej gry">'+
        '<span class="rf-tg-lbl off">Wył.</span><span class="rf-tg-knob"></span><span class="rf-tg-lbl on">Wł.</span></div>'+
      '<span class="ra-pill" id="gsPill"></span>'+
      '<span class="setupmsg" id="gsMsg" role="status" aria-live="polite"></span>'+
    '</div>'+
    '<div class="gs-defs" id="gsDefs"></div></div>';
  (document.getElementById("libraryCard")||panel).appendChild(card);
  try{if(typeof rfTier==="function")_gsTierSync=rfTier(card,"zestawy.autozestawy",{sum:_gsSum,changed:function(){return 0;}});}catch(e){}
  _gsExeHintInit();
  const tg=card.querySelector("#gsEnable");
  tg.addEventListener("click",_gsToggle);
  // Klawiatura obsługuje ten przełącznik tak samo jak myszka: role="switch" bez Spacji/Entera
  // to przycisk, którego nie da się nacisnąć bez myszy.
  tg.addEventListener("keydown",function(e){
    if(e.key===" "||e.key==="Enter"||e.key==="Spacebar"){e.preventDefault();_gsToggle();}
  });
  rfGsFetch();
}

let _gsTierSync=null;
function _gsSum(){
  const pill=document.getElementById("gsPill"),n=Object.keys(_gsState.defaults||{}).length;
  return (pill?pill.textContent:"")+" · "+_gl("zapamiętane gry: ","remembered games: ")+n;
}
function _gsFlash(t,bad){
  const e=document.getElementById("gsMsg");if(!e)return;
  e.textContent=t;e.classList.toggle("bad",!!bad);
  clearTimeout(e._t);e._t=setTimeout(function(){e.textContent="";e.classList.remove("bad");},3200);
}

function _gsToggle(){
  const want=!_gsState.enabled;
  // Wysyłamy SAM przełącznik. Serwer dokłada resztę z pliku, więc włączenie funkcji nie może
  // przypadkiem wyczyścić zapamiętanych gier — a tak by było, gdyby panel odsyłał całą swoją
  // (być może nieaktualną) kopię ustawień.
  fetch("/gameswitch",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({enabled:want})})
    .then(function(r){return r.json();})
    .then(function(j){
      if(!j||!j.ok){_gsFlash((j&&j.error)||_gl("Nie zapisano","Not saved"),true);return;}
      _gsSet(j);
    })
    .catch(function(){_gsFlash(_gl("Serwer nieosiągalny","Server unreachable"),true);});
}

function _gsForget(exe){
  const next={};
  Object.keys(_gsState.defaults||{}).forEach(function(k){
    if(k!==exe)next[k]=_gsState.defaults[k];
  });
  fetch("/gameswitch",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({defaults:next})})
    .then(function(r){return r.json();})
    .then(function(j){
      if(!j||!j.ok){_gsFlash((j&&j.error)||_gl("Nie zapisano","Not saved"),true);return;}
      _gsSet(j);
      _gsFlash(_gl("Zapomniano „","Forgot “")+exe+"”");
    })
    .catch(function(){_gsFlash(_gl("Serwer nieosiągalny","Server unreachable"),true);});
}

// STAN FUNKCJI PRZY POLU „gra.exe”. Grę przypisuje się w pasku zapisu, a włącznik stoi w karcie
// niżej i domyślnie jest wyłączony, więc wpisanie gry i zapis nie dawały nic. Przy polu stoi teraz
// jedno zdanie: „wczyta się sam” albo „wyłączone” z przyciskiem, który włącza funkcję od razu.
// Pokazuje się tylko, gdy w polu coś jest: puste pole nie ma czego obiecywać.
// WHY: the game field promised auto-loading while the feature behind it was off and out of sight.
function _gsExeHintInit(){
  const ex=document.getElementById("setupExe");
  if(!ex||document.getElementById("setupExeGs"))return;
  const h=document.createElement("span");h.id="setupExeGs";h.className="gs-exe-hint";h.hidden=true;
  ex.insertAdjacentElement("afterend",h);
  ex.addEventListener("input",_gsExeHint);
}
function _gsExeHint(){
  const h=document.getElementById("setupExeGs"),ex=document.getElementById("setupExe");
  if(!h||!ex)return;
  const has=!!(ex.value||"").trim();
  if(!_gsLoaded||!has||!_gsState.supported){h.hidden=true;return;}
  h.hidden=false;
  const sig=_gsState.enabled?"on":"off";
  if(h._sig===sig+(typeof _lang!=="undefined"?_lang:""))return;
  h._sig=sig+(typeof _lang!=="undefined"?_lang:"");
  h.classList.toggle("on",_gsState.enabled);
  h.setAttribute("data-noi18n","");
  if(_gsState.enabled){
    h.textContent=_gl("✓ wczyta się sam","✓ loads by itself");
    h.title=_gl("Auto-wczytywanie jest włączone: gdy ta gra znajdzie się na wierzchu, zestaw wczyta się sam.",
                "Auto-loading is on: when this game comes to the front, the setup loads by itself.");
  }else{
    // Pusty title nie czyści dymka: rf-05 przeniósł wcześniejszy tekst do data-rftip i opisu,
    // więc zdejmujemy je tu, inaczej dymek dalej mówił „włączone”.
    h.textContent="";h.title="";
    ["data-rftip","data-rftip-d","aria-describedby","aria-label"].forEach(function(a){h.removeAttribute(a);});
    const t=document.createElement("span");t.textContent=_gl("auto-wczytywanie wyłączone","auto-loading is off");
    const b=document.createElement("button");b.type="button";b.className="btn xs";b.textContent=_gl("Włącz","Turn on");
    b.title=_gl("Włącza automatyczne wczytywanie zestawów, gdy przypisana gra jest na wierzchu",
                "Turns on loading setups automatically when the assigned game is in front");
    b.addEventListener("click",function(e){e.preventDefault();if(!_gsState.enabled)_gsToggle();});
    h.appendChild(t);h.appendChild(b);
  }
}
// Po zapisie zestawu z przypisaną grą: jedno zdanie o tym, co się teraz stanie. Gdy funkcja jest
// wyłączona, dymek mówi to wprost i daje „Włącz”. Zwraca false, gdy nie ma nic do powiedzenia
// (brak gry, inny system, moduł wyłączony) i wołający pokazuje swój zwykły komunikat.
function rfGsAfterSave(name,exe){
  exe=String(exe||"").trim();
  if(!exe||!_gsLoaded||!_gsState.supported||typeof window.rfToast!=="function")return false;
  const first=exe.split(",")[0].trim();
  if(_gsState.enabled){
    window.rfToast(_gl("Zapisano „"+name+"”. Wczyta się sam, gdy odpalisz "+first+".",
                       "Saved “"+name+"”. It loads by itself when you start "+first+"."));
  }else{
    window.rfToast(_gl("Zapisano „"+name+"”. Auto-wczytywanie jest wyłączone, więc po odpaleniu "+first+" zestaw sam się nie wczyta.",
                       "Saved “"+name+"”. Auto-loading is off, so starting "+first+" will not load the setup by itself."),
      {ms:9000,action:{label:_gl("Włącz","Turn on"),onClick:function(){if(!_gsState.enabled)_gsToggle();}}});
  }
  return true;
}
window.rfGsAfterSave=rfGsAfterSave;

function rfGsRender(){
  _gsExeHint();
  const tg=document.getElementById("gsEnable");
  if(tg){
    tg.setAttribute("aria-checked",_gsState.enabled?"true":"false");
    tg.classList.toggle("on",!!_gsState.enabled);
    // Poza Windowsem nie ma czego pilnować: przełącznik, który niczego nie robi, jest gorszy
    // niż jego brak, więc jest wyłączony, a powód stoi obok.
    tg.classList.toggle("dis",!_gsState.supported);
    tg.setAttribute("aria-disabled",_gsState.supported?"false":"true");
  }
  const pill=document.getElementById("gsPill");
  if(pill){
    if(!_gsState.supported)pill.textContent=_gl("tylko Windows","Windows only");
    else if(!_gsState.enabled)pill.textContent=_gl("wyłączone","off");
    else if(_gsState.lastExe)pill.textContent=_gl("ostatnio widziano: ","last seen: ")+_gsState.lastExe;
    else pill.textContent=_gl("czuwa","watching");
  }
  try{if(_gsTierSync)_gsTierSync();}catch(e){}
  const host=document.getElementById("gsDefs");
  if(!host)return;
  host.textContent="";
  if(!_gsState.supported){
    const p=document.createElement("p");p.className="setup-note";
    p.textContent=_gl("Ta funkcja działa tylko w Windows: tylko tam da się zapytać, które okno jest na wierzchu.",
                      "This only works on Windows: it is the only place where the app can ask which window is in front.");
    host.appendChild(p);
    return;
  }
  const lab=document.createElement("div");lab.className="setuplbl";
  lab.textContent=_gl("Zapamiętane gry","Remembered games");
  host.appendChild(lab);
  const keys=Object.keys(_gsState.defaults||{}).sort();
  if(!keys.length){
    const p=document.createElement("p");p.className="setup-note";
    p.textContent=_gl("Nie masz jeszcze zapamiętanych gier. Aplikacja zapamięta wybór, gdy zaznaczysz to w oknie z pytaniem „którego zestawu użyć”.",
                      "No games remembered yet. The app remembers your pick when you tick the box in the “which set” question.");
    host.appendChild(p);
    return;
  }
  const list=document.createElement("div");list.className="gs-list";
  keys.forEach(function(k){
    const v=_gsState.defaults[k]||{};
    const row=document.createElement("div");row.className="gs-row";
    const g=document.createElement("span");g.className="gs-exe";
    g.setAttribute("data-noi18n","");g.textContent="🎮 "+k;
    const arrow=document.createElement("span");arrow.className="gs-arrow";
    arrow.textContent="→";arrow.setAttribute("aria-hidden","true");
    const nm=document.createElement("span");nm.className="gs-set";
    nm.setAttribute("data-noi18n","");nm.textContent=v.name||"";
    row.appendChild(g);row.appendChild(arrow);row.appendChild(nm);
    if(v.kind==="bundle"){
      const b=document.createElement("span");b.className="lib-chip";
      b.textContent=_gl("Zestaw na kilka kapsli","Multi-capsule set");
      row.appendChild(b);
    }
    const x=document.createElement("button");
    x.type="button";x.className="btn sm gs-x";
    x.setAttribute("aria-label",_gl("Zapomnij tę grę","Forget this game")+": "+k);
    x.title=_gl("Zapomnij tę grę","Forget this game");
    x.textContent="✕";
    x.addEventListener("click",function(){_gsForget(k);});
    row.appendChild(x);
    list.appendChild(row);
  });
  host.appendChild(list);
  try{if(typeof applyLang==="function")applyLang(host);}catch(e){}
}

// Cała treść tej karty poza nagłówkiem powstaje przez _gl() w chwili rysowania, więc chodzik
// tłumaczący stronę nie ma czego cofnąć — przerysowanie jest jedynym lekarstwem (tak samo robią
// miRelang / poseRelang / hkRelang / rfLibRelang).
function rfGsRelang(){rfGsRender();}

// Wołane z paska narzędzi Biblioteki (rf-39i `_rflRenderTools`), żeby karta była świeża, gdy ta
// zakładka się przerysowuje. Nie pobiera nic z sieci — samo przerysowanie tego, co już wiemy.
function rfGsRenderCard(){rfGsRender();}

// --- zdarzenie ze strumienia ------------------------------------------------
//  Serwer mówi jedno z dwojga: „wczytałem X, bo wykryłem grę.exe" albo „wykryłem grę.exe,
//  pasuje kilka zestawów — wybierz". Pierwsze jest powiadomieniem, drugie pytaniem.
function onGameSwitch(m){
  if(!m||typeof m!=="object")return;
  const exe=m.exe||"";
  const ms=Array.isArray(m.matches)?m.matches:[];
  _gsState.lastExe=exe||_gsState.lastExe;
  rfGsRender();
  if(m.applied&&m.applied.name){
    const txt=_gl("Wczytano zestaw „","Loaded the set “")+m.applied.name+
              _gl("” — wykryto ","” — detected ")+exe;
    const undo=_gsUndoInfo(m,m.applied);
    if(typeof rfLibReload==="function"){try{rfLibReload();}catch(e){}}
    // Sekcja Synth zestawu idzie tą samą drogą co przy ręcznym „Wczytaj” (padAdoptState), zanim
    // strona się przeładuje: inaczej ten sam zestaw dawał inny wynik z ręki i z gry.
    _gsAdoptPad(m,m.applied).then(function(){
      // KASETA (rf-28e): scena wczytania gra po przeładowaniu, a gdy panel zostaje (człowiek pisze
      // albo ma otwarte okno) — od razu, bo i tak niczego nie zasłania ani nie łapie myszy.
      if(_gsReloadSoon(undo)){try{if(typeof rfKasetaZapowiedzNazwa==="function")rfKasetaZapowiedzNazwa(m.applied.name);}catch(e){}return;}
      try{
        if(typeof rfKasetaGraj==="function"){
          const arr=(typeof _rflData!=="undefined"&&_rflData&&_rflData.setup)||[];
          const it=arr.find(function(x){return x&&x.name===m.applied.name;});
          rfKasetaGraj(it&&it.cassette,m.applied.name);
        }
      }catch(e){}
      if(undo)_gsUndoOffer(undo,txt);
      else if(typeof rfSkullNote==="function")rfSkullNote(txt);
      else if(typeof rfToast==="function")rfToast(txt);
    });
    return;
  }
  if(ms.length>=2)rfGsPick(exe,ms);
}

// SEKCJA SYNTH Z AUTO-ZESTAWU. Zdarzenie albo odpowiedź mogą nieść `pad`; gdy klucza nie ma
// wcale, czytamy go z wpisu w Bibliotece. `pad:null` znaczy „zestaw nie ma Syntha” i nic nie robi.
function _gsAdoptPad(src,applied){
  if(typeof padAdoptState!=="function")return Promise.resolve();
  if(src&&Object.prototype.hasOwnProperty.call(src,"pad")){
    try{return Promise.resolve(src.pad?padAdoptState(src.pad):null);}
    catch(e){return Promise.resolve();}
  }
  const nm=applied&&applied.name;
  if(!nm)return Promise.resolve();
  return fetch("/library/item?kind=setup&name="+encodeURIComponent(nm))
    .then(function(r){return r.json();})
    .then(function(j){const p=j&&j.ok&&j.item&&j.item.pad;return p?padAdoptState(p):null;})
    .catch(function(){});
}

// KOPIA SPRZED AUTO-WCZYTANIA. Serwer może podać jej nazwę w polu `backup` (tekst albo
// {name, kind, dev}); bez tego pola nie ma czego proponować i zostaje sam komunikat.
// Kapsel: ten, na który wszedł zestaw (`dev` w kopii, zdarzeniu albo odpowiedzi). Bez niego
// przy kilku kapslach nie zgadujemy, bo cofnięcie na zły kapsel nadpisałoby jego konfigurację.
function _gsUndoInfo(src,applied){
  const b=src&&src.backup;
  if(!b)return null;
  const o=(typeof b==="object")?b:{name:String(b)};
  if(!o.name)return null;
  let dev=o.dev||src.dev||(applied&&applied.dev)||"";
  if(!dev){
    const ids=Object.keys((typeof state!=="undefined"&&state.devices)||{});
    if(ids.length>1)return null;
    dev=ids[0]||"";
  }
  return {name:String(o.name),kind:o.kind||"setup",dev:dev,
          applied:(applied&&applied.name)||"",t:Date.now()};
}
const _GS_UNDO_KEY="ribbitflip.gs.undo";
const _GS_UNDO_TTL=60000;     // po minucie propozycja cofnięcia jest już nieaktualna
function _gsUndoOffer(u,txt){
  if(!u||typeof window.rfToast!=="function")return;
  const msg=(txt||(_gl("Wczytano zestaw „","Loaded the set “")+u.applied+"”."))+" "+
    _gl("Poprzednia konfiguracja jest w kopii „","The previous configuration is in the copy “")+u.name+"”.";
  window.rfToast(msg,{tone:"warn",ms:25000,
    action:{label:_gl("↶ Cofnij","↶ Undo"),onClick:function(){_gsUndoApply(u);}}});
}
// Po przeładowaniu: propozycja zostawiona przez okno, które się przeładowało. Pierwsze okno ją
// zabiera, więc przy dwóch otwartych oknach „Cofnij” pojawia się raz.
function _gsUndoResume(){
  let u=null;
  try{u=JSON.parse(localStorage.getItem(_GS_UNDO_KEY)||"null");localStorage.removeItem(_GS_UNDO_KEY);}catch(e){}
  if(u&&u.name&&(Date.now()-(+u.t||0))<_GS_UNDO_TTL)setTimeout(function(){_gsUndoOffer(u);},800);
}
function _gsUndoApply(u){
  if(u.kind==="bundle"){
    // Paczka na kilka kapsli wraca przez okno Wymiany (role, tryb), jak każda inna paczka.
    fetch("/library/item?kind=setup&name="+encodeURIComponent(u.name))
      .then(function(r){return r.json();})
      .then(function(j){
        if(!j||!j.ok||!j.item){window.rfToast(_gl("Nie udało się cofnąć.","Could not undo."),{tone:"danger"});return;}
        if(typeof bundleImportObj==="function")bundleImportObj(j.item);
      })
      .catch(function(){window.rfToast(_gl("Serwer nieosiągalny","Server unreachable"),{tone:"danger"});});
    return;
  }
  // Adres z `?dev=` omija podstawianie aktywnego kapsla (rf-05): kopia wraca tam, skąd ją zrobiono.
  const url="/setup/load"+(u.dev?"?dev="+encodeURIComponent(u.dev):"");
  fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:u.name})})
    .then(function(r){return r.json();})
    .then(async function(j){
      if(!j||!j.ok){window.rfToast((j&&j.error)||_gl("Nie udało się cofnąć.","Could not undo."),{tone:"danger"});return;}
      try{if(j.pad&&typeof padAdoptState==="function")await padAdoptState(j.pad);}catch(e){}
      if(typeof setupFlash==="function")setupFlash(_gl("Przywrócono „","Restored “")+u.name+_gl("”, odświeżam…","”, refreshing…"));
      setTimeout(function(){location.reload();},650);
    })
    .catch(function(){window.rfToast(_gl("Serwer nieosiągalny, nie cofnięto.","Server unreachable, not undone."),{tone:"danger"});});
}

// Zestaw dotyka każdej grupy, więc panel trzeba przeczytać od serwera na nowo — tak samo jak po
// ręcznym „Wczytaj" w Bibliotece. Ale tutaj przeładowania NIKT nie kliknął, więc nie wolno go
// zrobić komuś pod palcami: otwarte okno albo kursor w polu tekstowym znaczy „człowiek jest w
// środku czynności", i wtedy zostaje sam dymek. Panel jest wtedy chwilowo nieaktualny —
// pokazuje to, co było przed wczytaniem — i to jest mniejsza szkoda niż zgubiona wpisywana treść.
// Zwraca true, gdy przeładowanie jest zaplanowane; propozycja „Cofnij” przeżywa je w localStorage.
function _gsReloadSoon(undo){
  const busy=document.querySelector(".rfk-back,.rfm-backdrop");
  const ae=document.activeElement;
  const typing=ae&&(ae.tagName==="INPUT"||ae.tagName==="TEXTAREA"||ae.isContentEditable);
  if(busy||typing)return false;
  if(undo){try{localStorage.setItem(_GS_UNDO_KEY,JSON.stringify(undo));}catch(e){}}
  setTimeout(function(){location.reload();},900);
  return true;
}

// --- okno wyboru ------------------------------------------------------------
function rfGsPickClose(){
  if(!_gsBack)return;
  try{document.removeEventListener("keydown",_gsBack._onKey,true);}catch(e){}
  try{_gsBack.remove();}catch(e){}
  _gsBack=null;
}

function rfGsPick(exe,matches){
  rfGsPickClose();                       // jedno pytanie naraz — drugie okno na wierzchu pierwszego
  let pick=(matches[0]&&matches[0].name)||null;
  let pickKind=(matches[0]&&matches[0].kind)||"setup";

  const back=document.createElement("div");
  back.className="rfk-back gs-back";back.setAttribute("role","presentation");
  const card=document.createElement("div");
  card.className="rfk-card gs-card";
  card.setAttribute("role","dialog");card.setAttribute("aria-modal","true");
  card.setAttribute("aria-label",_gl("Który zestaw wczytać?","Which set should I load?"));

  const head=document.createElement("div");head.className="rfk-head";
  const h=document.createElement("h3");h.className="rfk-title";
  h.textContent=_gl("Który zestaw wczytać?","Which set should I load?");
  const x=document.createElement("button");x.type="button";x.className="rfk-x";
  x.setAttribute("aria-label",_gl("Zamknij","Close"));x.textContent="×";
  head.appendChild(h);head.appendChild(x);

  const body=document.createElement("div");body.className="gs-body";
  const intro=document.createElement("p");intro.className="rfs-intro";
  intro.appendChild(document.createTextNode(_gl("Wykryto grę","Game detected")+": "));
  const strong=document.createElement("strong");
  strong.setAttribute("data-noi18n","");strong.textContent=exe;
  intro.appendChild(strong);
  intro.appendChild(document.createTextNode(
    _gl(". Pasuje do niej więcej niż jeden zestaw, więc nie wybieram za Ciebie.",
        ". More than one set claims it, so I am not picking for you.")));
  body.appendChild(intro);

  const rows=[];
  const gname="gs-pick-"+Math.random().toString(36).slice(2,8);
  matches.forEach(function(m,i){
    const lab=document.createElement("label");lab.className="gs-opt";
    const rb=document.createElement("input");
    rb.type="radio";rb.name=gname;rb.value=m.name||"";rb.checked=(i===0);
    rb.addEventListener("change",function(){
      if(!rb.checked)return;
      pick=m.name||null;pickKind=m.kind||"setup";
      rows.forEach(function(r){r.lab.classList.toggle("on",r.rb.checked);});
      sync();
    });
    const info=document.createElement("span");info.className="gs-optinfo";
    const nm=document.createElement("span");nm.className="gs-optname";
    nm.setAttribute("data-noi18n","");nm.textContent=m.name||"";
    info.appendChild(nm);
    if(m.forApp){
      const f=document.createElement("span");f.className="lib-for";
      f.setAttribute("data-noi18n","");f.textContent=m.forApp;
      info.appendChild(f);
    }
    if(m.kind==="bundle"){
      const b=document.createElement("span");b.className="lib-chip";
      b.textContent=_gl("Zestaw na kilka kapsli","Multi-capsule set");
      info.appendChild(b);
    }
    lab.appendChild(rb);lab.appendChild(info);
    lab.classList.toggle("on",rb.checked);
    body.appendChild(lab);
    rows.push({lab:lab,rb:rb});
  });

  const rem=document.createElement("label");rem.className="gs-remember";
  const rc=document.createElement("input");rc.type="checkbox";
  const rt=document.createElement("span");
  rt.textContent=_gl("Zapamiętaj dla tej gry","Remember for this game");
  rem.appendChild(rc);rem.appendChild(rt);
  body.appendChild(rem);

  const foot=document.createElement("div");foot.className="rfk-foot gs-foot";
  const note=document.createElement("span");note.className="rfk-note";
  const cancel=document.createElement("button");
  cancel.type="button";cancel.className="btn sm";cancel.textContent=_gl("Anuluj","Cancel");
  const go=document.createElement("button");
  go.type="button";go.className="btn sm primary";go.textContent=_gl("Wczytaj","Load");
  foot.appendChild(note);foot.appendChild(cancel);foot.appendChild(go);

  const sync=function(){
    go.disabled=!pick;
    note.textContent=pick?"":_gl("Nie wybrano zestawu.","No set picked.");
  };

  const done=function(){rfGsPickClose();};
  x.addEventListener("click",done);
  cancel.addEventListener("click",done);
  go.addEventListener("click",function(){
    if(go.disabled||!pick)return;
    go.disabled=true;
    fetch("/gameswitch/apply",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({exe:exe,kind:pickKind,name:pick,remember:rc.checked===true})})
      .then(function(r){return r.json();})
      .then(function(j){
        if(!j||!j.ok){
          go.disabled=false;
          note.textContent=(j&&j.error)||_gl("Nie udało się wczytać.","Could not load.");
          return;
        }
        _gsSet(j);
        rfGsPickClose();
        // Po wczytaniu zestawu panel czyta się od serwera na nowo — dokładnie jak po „Wczytaj"
        // w Bibliotece. Tutaj przeładowanie kliknął człowiek, więc idzie bez pytania.
        if(typeof setupFlash==="function")
          setupFlash(_gl("Wczytano „","Loaded “")+pick+_gl("” — odświeżam…","” — refreshing…"));
        const applied={name:pick,kind:pickKind,dev:j.dev};
        const undo=_gsUndoInfo(j,applied);
        if(undo){try{localStorage.setItem(_GS_UNDO_KEY,JSON.stringify(undo));}catch(e){}}
        try{if(typeof rfKasetaZapowiedzNazwa==="function")rfKasetaZapowiedzNazwa(pick);}catch(e){}   // scena wczytania po przeładowaniu (rf-28e)
        return _gsAdoptPad(j,applied).then(function(){setTimeout(function(){location.reload();},650);});
      })
      .catch(function(){
        go.disabled=false;
        note.textContent=_gl("Serwer nieosiągalny","Server unreachable");
      });
  });

  card.appendChild(head);card.appendChild(body);card.appendChild(foot);
  back.appendChild(card);
  back.addEventListener("mousedown",function(e){if(e.target===back)done();});
  back._onKey=function(e){
    if(e.key==="Escape"){e.preventDefault();e.stopPropagation();done();return;}
    if(e.key!=="Tab")return;
    const f=Array.prototype.filter.call(
      card.querySelectorAll("button:not([disabled]),input"),
      function(el){return el.offsetParent!==null;});
    if(!f.length)return;
    const first=f[0],last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  document.addEventListener("keydown",back._onKey,true);
  document.body.appendChild(back);
  _gsBack=back;
  sync();
  try{if(typeof applyLang==="function")applyLang(back);}catch(e){}
  setTimeout(function(){try{(rows[0]&&rows[0].rb||go).focus();}catch(e){}},30);
}

window.rfGsFetch=rfGsFetch;
window.rfGsRelang=rfGsRelang;
window.rfGsRenderCard=rfGsRenderCard;
window.onGameSwitch=onGameSwitch;
window.rfGsPick=rfGsPick;
