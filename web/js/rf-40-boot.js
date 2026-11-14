"use strict";
// Last file of the rf-NN chain: it must run after every module it boots. First it wraps a few REST
// render/lang hooks that can only be patched once each definition exists, then it runs the
// application bootstrap. (rf-motion.js and rf-knob.js load after this one, but are self-contained
// and bootstrap themselves.)
// ---------- REST render/lang hooks (wrapped here, after every definition exists) ----------
if(typeof restRenderApis==="function"){
  const _ra5PrevRenderApis=restRenderApis;
  restRenderApis=function(){                                  // refresh the "Variables" card after every list render
    const r=_ra5PrevRenderApis.apply(this,arguments);
    try{restRenderVars();}catch(e){}
    return r;
  };
  try{if(window.RESTAPI)window.RESTAPI.renderApis=restRenderApis;}catch(e){}
}
if(typeof _ra3ApiCard==="function"){
  const _ra5PrevApiCard=_ra3ApiCard;
  _ra3ApiCard=function(api){                                  // every API card also gets its service-pack setup guide
    const card=_ra5PrevApiCard.apply(this,arguments);
    try{restApiGuide(api,card);}catch(e){}
    return card;
  };
}
try{
  if(window.RESTAPI){
    window.RESTAPI.renderVars=restRenderVars;
    window.RESTAPI.setVar=restSetVar;
    window.RESTAPI.removeVar=restRemoveVar;
    window.RESTAPI.exportActions=restExportActions;
    window.RESTAPI.importPack=restImportPack;
    window.RESTAPI.importPackText=restImportPackText;   // link importer hands fetched bytes to the same review modal
    window.RESTAPI.importPackFile=restImportPackFile;   // a pack arriving from any other door: the module asks which application
    window.RESTAPI.analyzePack=restPackAnalyze;
    window.RESTAPI.packFromApi=restPackFromApi;
    window.RESTAPI.mergePack=restPackMerge;
    window.RESTAPI.mergeTrigs=restTrigMerge;
    window.RESTAPI.addFromTemplate=restAddApiFromTemplate;
    window.RESTAPI.createFromPack=restCreateApiFromPack;
    window.RESTAPI.templates=_ra5Packs;
  }
}catch(e){}
// Built-in service-pack text (setup guides, warnings, action names) has no I18N_EN keys by design —
// it is content, not labels — and the i18n walker skips it (data-noi18n). It therefore has to be
// REDRAWN on a language switch. Wrapping setLang is the only hook that catches both directions
// and also fires on an EN start-up, where initI18n itself calls setLang('en').
if(typeof setLang==="function"&&typeof _ra5OnLangChange==="function"){
  const _ra5PrevSetLang=setLang;
  setLang=function(){
    const r=_ra5PrevSetLang.apply(this,arguments);
    try{_ra5OnLangChange();}catch(e){}
    return r;
  };
}

// ---------- bootstrap ----------
// Each init runs inside its own try/catch ON PURPOSE: one broken feature must not take the whole
// dashboard down with it. The cost is that a failure is SILENT apart from the console error — the
// affected tab simply stays empty or its buttons do nothing. Anything verifying a change here has
// to click real controls and check the effect; "the function exists" proves nothing.
// Order matters: initTabs builds the panels the later inits fill, connect/frame start the data flow.
// initMidiCfgHub stoi PO initTabs i PO initMidi z konkretnego powodu: karta „Kontroler OSC"
// (#oscCard) w ogóle nie istnieje przed initTabs — rf-34 wycina ją z karty MIDI — a jeden z dwóch
// hubów konfiguracji mieszka właśnie w niej. Przed initIoLog, żeby hub trafił pod nagłówek KARTY,
// a nie pod nagłówek dziennika, który initIoLog dokłada na jej koniec.
// initOscTargets stoi obok nich z tego samego powodu (sekcja „Urządzenia OSC" dokłada się do paska
// celu w karcie OSC) i PO initMidi, bo to ono przywozi pierwszy rejestr razem z konfiguracją kapsla.
// initOvlManage (karta „Nakładki nad grą", rf-41b) stoi PO initTabs, bo wchodzi do panelu ekranu
// „Nakładka" (#tab-wszystkie), który powstaje dopiero tam — i PRZED initOvlLayoutBar, bo pasek
// nazwanych układów montuje się pod nagłówkiem TEJ karty.
// initOvlLayoutBar (pasek nazwanych UKŁADÓW okien nakładek, rf-49f) stoi więc jako trzeci: nazwa
// opisuje rozstawienie WSZYSTKICH okien, czyli dokładnie to, czym zarządza karta nad nim.
// initSynthCfgBar (pasek nazwanych SCEN syntezatora, rf-49g) stoi zaraz PO initPad, ale NIE czeka
// na niego: karta „Pady grające" jest w statycznym HTML, więc pasek montuje się od razu, a stan
// syntezatora dojeżdża z serwera chwilę później i sam odświeża pasek (`padLoadAsync` → sync).
// Odwrotna kolejność byłaby fałszywą obietnicą — initPad jest teraz asynchroniczne i czekanie na
// nie wstrzymałoby resztę bootu.
// initRestCfg (biblioteka presetów Usług sieciowych, rf-49n) stoi zaraz PO initRest, ale NIE czeka
// na jego pobranie configu: pobiera SWOJĄ listę i tyle. O tym, że config dojechał, ramka modułu
// dowiaduje się z `restCfgSync()` wołanego na końcu tamtego pobrania.
//
// initPresetCols (ramka trzech zakładek w każdym module, rf-49j + rf-49m) stoi na SAMYM KOŃCU
// montażu paneli — po wszystkich init*CfgHub i init*CfgBar. Przenosi karty modułów do niej, więc gdyby
// poszło wcześniej, tamte szukałyby `#trigCard .head` w karcie, której jeszcze nie ma tam, gdzie
// jej szukają. Przed initI18n, żeby walker zastał gotowe napisy i przetłumaczył je za pierwszym razem.
//
// initRestTabs (ramka DWÓCH zakładek w każdej pozycji „Reszty", rf-49p) stoi na SAMYM KOŃCU CAŁEJ
// listy — za initExchangeHero i initLibrary. Robi to samo, co initPresetCols, tylko dla zakładek,
// którym karty dokłada się jeszcze PO nim: hub wymiany i biblioteka wjeżdżają do „Zestawów"
// dopiero tam, a wszystko, co trafiłoby do panelu po przeniesieniu, wylądowałoby POD ramką
// zamiast w jej pierwszej zakładce.
if(IS_OVERVIEW)document.body.classList.add("overview-only");
// PIERWSZA KLATKA ODRACZANA DO rAF (2026-09-05). `frame()` (rf-09-scopes.js) rysuje cztery
// oscyloskopy, kulę pozy, pas naciśnięć i miniaturę prawej kolumny — i robi to z wymuszonym
// układem, bo czyta rozmiary tuż po zapisach do DOM. Wołana WPROST z tablicy initów doklejała ~30 ms
// do SYNCHRONICZNEGO łańcucha bootu, w którym na ekranie nie ma jeszcze nic — ta klatka i tak nie
// była widoczna. Odroczenie o jedną rAF niczego nie psuje: żaden późniejszy init nie zakłada, że
// klatka już była (initI18n tylko zakłada obserwatora, rfRcolMini.frame wychodzi po `offsetParent`,
// `connect` zostaje tam, gdzie było i dane płyną jak wcześniej), a `frame()` sam planuje kolejną
// klatkę na swoim końcu — pętla startuje dokładnie tak samo, tylko o jedną klatkę później.
// WHY: the first frame() ran inside the synchronous boot chain and drew a screen nobody could see
// yet; one requestAnimationFrame later costs nothing and no init depends on it having run.
function frameDeferred(){requestAnimationFrame(frame);}
// MODUŁY WYŁĄCZONE PRZY STARCIE (--disable / --only, rf-00b-modules.js): ich inity nie ruszają wcale,
// więc nie budują kart, nie stawiają timerów ani pętli rysowania i nie pytają serwera. Wpis z kilkoma
// modułami (wspólny silnik ruchu Myszy i Kontrolera, wspólna karta MIDI i OSC) rusza, gdy działa
// którykolwiek z nich. Klucz to nazwa funkcji, żeby lista nie musiała znać kolejności plików.
// WHY: a module the server never started gets no UI, no timers and no requests in the panel either.
const _RF_INIT_MODS={initWheel:["kolo"],initMouse:["mysz","kontroler"],initMouseCfgHub:["mysz","kontroler"],
  initPadCtl:["kontroler"],initMidi:["midi","osc"],initMidiCfgHub:["midi","osc"],initIoLog:["midi","osc"],
  initOscTargets:["osc"],initPad:["synth"],initSynthCfgBar:["synth"],initRest:["uslugi"],initRestCfg:["uslugi"],
  initOvlManage:["nakladka"],initOvlLayoutBar:["nakladka"],initGameSwitchUi:["autozestawy"],initMcpUi:["mcp"]};
function _rfInitOn(fn){const m=fn&&_RF_INIT_MODS[fn.name];return !m||typeof rfModOn!=="function"||m.some(rfModOn);}
[...[buildAxisCards,buildLegends,buildFilterLegend,buildStatusBytes,initTriggers,initPower,initTrigCfgHub,initMouse,initMouseCfgHub,initCmd,initTabs,initTabVis,initOvlManage,initOvlLayoutBar,initWheel,initPadCtl,initGuides,initWhatIs,initDevMods,initMidi,initMidiCfgHub,initOscTargets,initIoLog,initPad,initSynthCfgBar,initRest,initRestCfg,initSetup,initKasety,initMcpUi,initHotkeyUi,initDiagUi,initModsOffCard,initFoldPrefCard,initGameSwitchUi,initFileDrop,initPosePresets,initPoseCfgBar,initPresetCols,connect,frameDeferred,initI18n,_rfUndoInit,initOvResize,initKofi,initShare,initShareHub,initExchangeHero,initLibrary,initRestTabs,initRailScroll,initTour,initHelpMenu,initFirstAsk,initNotifyGoto].filter(_rfInitOn)].forEach(function(fn){try{fn();}catch(e){console.error("[RibbitFlip init] "+((fn&&fn.name)||"?")+" nie wykona\u0142 si\u0119:",e);}});
// KOLEJNOŚĆ KART W „KONFIGURACJI" (przegląd modułów 2026-11-17). Cztery karty doklejały cztery
// różne inity, więc o tym, co stoi na górze, decydowała kolejność plików: pierwszy był MCP,
// a Stop awaryjny, jedyna funkcja bezpieczeństwa na tym ekranie, dopiero drugi. Teraz kolejność
// ustala jedna lista: Stop awaryjny, Moduły przy starcie, MCP, Zgłoś problem. Karta modułów nie
// skacze już na samą górę, gdy coś wyłączono: stoi zaraz pod Stopem, czyli i tak na wierzchu.
// Brakująca karta (moduł MCP wyłączony, ?view=overview) jest po prostu pomijana.
// WHY: one owner of the card order instead of whichever init happened to run first.
function rfUstawOrder(){
  // Karty nie siedzą wprost w `tab-ustawienia`: initRestTabs (rf-49p) przenosi je wcześniej do
  // pod-zakładki („rfpcPane-ustawienia-main"). Porządkujemy więc w ich wspólnym rodzicu.
  if(!document.getElementById("tab-ustawienia"))return;
  // UX 261120 L4c (piętra): Stop awaryjny i Zgłoś problem na wierzchu, potem Wygląd panelu,
  // zwijak „Start programu” (piętro 2) i „Zaawansowane” z serwerem MCP na końcu.
  const all=["hkCard","diagCard","uiLookCard","modsOffCard","usAdv"].map(function(id){return document.getElementById(id);})
    .filter(Boolean);
  if(!all.length)return;
  const panel=all[0].parentNode;
  const cards=all.filter(function(c){return c.parentNode===panel;});
  if(cards.length<2)return;
  const first=cards.reduce(function(a,c){return (a.compareDocumentPosition(c)&Node.DOCUMENT_POSITION_PRECEDING)?c:a;});
  const mark=document.createComment("ustaw-order");panel.insertBefore(mark,first);
  cards.forEach(function(c){panel.insertBefore(c,mark);});mark.remove();
}
try{rfUstawOrder();}catch(e){console.error("[RibbitFlip init] rfUstawOrder:",e);}
// USTAWIENIA, KTÓRYCH NIE DA SIĘ ZAPISAĆ, I USZKODZONE PLIKI. Serwer mówi o tym w `GET /health`
// (`settingsWritable`, `settingsDir`, `settingsCorrupt`), a do tej pory panel milczał: aplikacja
// w folderze bez prawa zapisu gubiła każdą zmianę po restarcie, a plik uszkodzony przy awarii
// zasilania zamieniał się po cichu w ustawienia domyślne. Mówimy to raz na start: ten sam stan
// po przeładowaniu strony (wczytanie zestawu przeładowuje panel) nie wraca, bo pamięta go
// sessionStorage tej karty. Okna nakładki i ściągi milczą, to tylko podgląd.
// WHY: settings that silently fail to save, or a corrupt file replaced by defaults, must be said out loud.
function rfSettingsHealthNote(){
  if(/[?&](overlay=1|view=overview)/.test(location.search||""))return;
  fetch("/health",{cache:"no-store"}).then(function(r){return r.json();}).then(function(h){
    if(!h||typeof h!=="object"||typeof window.rfToast!=="function")return;
    const bad=Array.isArray(h.settingsCorrupt)?h.settingsCorrupt.filter(function(c){return c&&c.file;}):[];
    const ro=(h.settingsWritable===false);
    const sig=JSON.stringify([ro,ro?String(h.settingsDir||""):"",bad.map(function(c){return [c.file,c.copy];})]);
    let seen="";try{seen=sessionStorage.getItem("ribbitflip.settingsNote")||"";}catch(e){}
    if(seen===sig)return;
    try{sessionStorage.setItem("ribbitflip.settingsNote",sig);}catch(e){}
    if(ro){
      const dir=String(h.settingsDir||_gl("folderze aplikacji","the app folder"));
      window.rfToast(_gl("Nie mogę zapisywać ustawień w "+dir+". Przenieś RibbitFlip do folderu, w którym możesz zapisywać pliki, np. w Dokumentach.",
                         "I cannot save settings in "+dir+". Move RibbitFlip to a folder where you can save files, for example in Documents."),
                     {tone:"danger",ms:30000});
    }
    bad.forEach(function(c,i){
      const f=String(c.file),cp=String(c.copy||"");
      setTimeout(function(){
        window.rfToast(cp
          ? _gl("Plik ustawień "+f+" był uszkodzony; jego kopia to "+cp+", a aplikacja wystartowała z domyślnymi.",
                "The settings file "+f+" was damaged; its copy is "+cp+", and the app started with the defaults.")
          : _gl("Plik ustawień "+f+" był uszkodzony, a aplikacja wystartowała z domyślnymi.",
                "The settings file "+f+" was damaged, and the app started with the defaults."),
          {tone:"warn",ms:20000});
      },(ro?400:0)+i*300);
    });
  }).catch(function(){});
}
setTimeout(function(){try{rfSettingsHealthNote();}catch(e){}},1200);
// Panel jest panelem — zdejmujemy zasłonę z bootu (02-base.css, `html.rf-boot`). Tutaj,
// a nie w rAF: karty stoją już w trzech kolumnach, więc pierwsza klatka, którą ktokolwiek
// zobaczy, jest od razu ta właściwa. Dotyczy też `?view=overview` i `?overlay=1` — obie idą
// tą samą pętlą.
// WHY: the raw one-column stack stays hidden from the first paint until the panel is assembled.
document.documentElement.classList.remove("rf-boot");
// Give the left-hand (input-group) tabs one shared width so the bar does not jitter as labels change.
//
// ⚠️ OD 2026-08-29 TO JEST BEZPIECZNY NO-OP. Poziomy pasek zakładek zniknął przy przebudowie na
// trzy kolumny — nawigacja stoi pionowo w lewej kolumnie, gdzie wszystkie pozycje i tak mają jedną
// szerokość (szerokość panelu), więc nie ma czego wyrównywać. Funkcja i jej cztery wywołania
// (tutaj ×2, rf-34 przy montażu, rf-01 przy zmianie języka) ZOSTAJĄ celowo: wychodzi z niej pusty
// `querySelector`, kosztuje tyle co nic, a usuwanie wywołań rozsianych po trzech plikach jest
// czystym ryzykiem bez zysku. Wróci do życia sama, jeśli kiedyś wróci pasek.
function _equalizeLeftTabs(){
  const bar=document.querySelector(".tabbar");if(!bar)return;
  const L=Array.prototype.slice.call(bar.querySelectorAll(".tab-eqw"));if(!L.length)return;
  L.forEach(b=>{b.style.minWidth="0";});
  let mx=0;L.forEach(b=>{const w=b.getBoundingClientRect().width;if(w>mx)mx=w;});
  if(mx<=0)return;mx=Math.ceil(mx);L.forEach(b=>{b.style.minWidth=mx+"px";});
}
window._equalizeLeftTabs=_equalizeLeftTabs;
// The tab bar sticks below the header, so --topbar-h MUST track the real header height — it wraps
// to two rows once there are enough buttons. Re-measured on resize, on header mutations and once
// more after fonts settle.
function _syncTopbarH(){const h=document.querySelector("header");if(h)document.documentElement.style.setProperty("--topbar-h",h.offsetHeight+"px");}
_syncTopbarH();
window.addEventListener("resize",_syncTopbarH);
if(window.ResizeObserver){try{const _h=document.querySelector("header");if(_h)new ResizeObserver(_syncTopbarH).observe(_h);}catch(e){}}
// Between 901 and 1279 px the right-hand column ("Kapsle i podgląd") stops being a column:
// 20-cols.css turns it into a STICKY HORIZONTAL STRIP above the middle column, right under the
// app bar. The module header (`.rfpc-head`, 22-modtabs.css) is sticky too and used to measure
// itself from --topbar-h alone, so it slid UNDER that strip and the module title with its tabs
// disappeared. --rf-strip-h carries the MEASURED height of the strip; it is 0px at >=1280 px
// (a real column) and at <=900 px (single-column stack), where nothing but the app bar is above
// the header. Mierzone, nie zakodowane na sztywno: pas rośnie i maleje z liczbą kapsli oraz
// przy zwijaniu prawej kolumny.
var _stripMQ=window.matchMedia?window.matchMedia("(max-width:1279px) and (min-width:901px)"):null,_stripLast="";
function _syncStripH(){
  const r=document.querySelector(".rf-rcol");
  // offsetParent===null łapie `display:none` (ściąga w osobnym oknie chowa całą kolumnę);
  // pozycjonowanie `sticky` offsetParenta nie zeruje, więc ten test jest bezpieczny.
  const on=!!(r&&_stripMQ&&_stripMQ.matches&&r.offsetParent!==null);
  const v=on?Math.round(r.getBoundingClientRect().height)+"px":"0px";
  if(v===_stripLast)return;   // ResizeObserver woła to przy każdym drgnięciu pasa
  _stripLast=v;document.documentElement.style.setProperty("--rf-strip-h",v);
}
_syncStripH();
window.addEventListener("resize",_syncStripH);
if(window.ResizeObserver){try{const _r=document.querySelector(".rf-rcol");if(_r)new ResizeObserver(_syncStripH).observe(_r);}catch(e){}}
// TRZECI PASEK NAD TREŚCIĄ MODUŁU. Poza paskiem aplikacji i pasem kapsli jest jeszcze pasek modułu
// (`.rfpc-head` — nazwa, pigułka kapsla, włącznik, zakładki), też przyklejony. Kolumny, które mają
// stać w oknie (scena koła, podgląd myszy, mapa kontrolera, podgląd skanera), ZGADYWAŁY jego
// wysokość — 46 px w jednym arkuszu, 84 w drugim, 8 w trzecim — i każda z tych liczb była zła:
// zmierzone 14.09 daje 75 px (81 px, zanim rysunek modułu zmaleje przy przewijaniu). Zamiast
// czterech pomysłów jedna zmienna: `--rf-modhead-h` niesie ZMIERZONĄ wysokość tego paska, który
// akurat jest na ekranie, a 22-modtabs.css składa z niej `--rf-sticky-top`.
// ⚠️ `offsetHeight`, a NIE `getBoundingClientRect()`. Wejście w moduł jest animowane skalowaniem
// (`transform` na stronie modułu), a rect podaje pudło PO przekształceniu: pasek „mierzy" wtedy
// 79,8 px, chwilę później 81,1 px w przeskoku i dopiero po ~350 ms siada na swoim 81 px. Zmienna
// zapisana w połowie tej animacji zostawała krzywa do końca życia strony, bo ResizeObserver liczy
// pudło treści i zmian samego `transform` w ogóle nie zgłasza — prostowało ją dopiero szarpnięcie
// oknem (zmierzone 14.09). `offsetHeight` to wysokość z UKŁADU, której skalowanie nie dotyczy:
// stabilna od pierwszej klatki i zgodna z tym, o co pyta `sticky`.
var _modHeadLast="",_modHeadRO=null;
function _syncModHeadH(){
  // Pasków jest kilkanaście, po jednym na moduł, i wszystkie zostają w DOM-ie — bierzemy ten JEDEN
  // wyświetlony. `offsetParent===null` łapie schowaną stronę modułu; `sticky` go nie zeruje.
  const L=document.querySelectorAll(".rfpc-head");let h=0;
  for(let i=0;i<L.length;i++){
    if(L[i].offsetParent===null)continue;
    if(L[i].offsetHeight>0){h=L[i].offsetHeight;break;}
  }
  const v=h+"px";
  if(v===_modHeadLast)return;   // ResizeObserver woła to przy każdym drgnięciu paska
  _modHeadLast=v;document.documentElement.style.setProperty("--rf-modhead-h",v);
}
// Woła to ten, kto BUDUJE pasek (rf-49m, rf-49p) — bez odpytywania w pętli i bez MutationObserver.
// Przełączenie modułu zmienia rozmiar dwóch pudeł naraz (chowane leci do zera, pokazywane rośnie),
// więc ten sam obserwator jest zarazem powiadomieniem o zmianie modułu.
function rfWatchModHead(head){
  _syncModHeadH();
  if(!head||!window.ResizeObserver)return;
  if(!_modHeadRO)_modHeadRO=new ResizeObserver(_syncModHeadH);
  try{_modHeadRO.observe(head);}catch(e){}
}
window.rfWatchModHead=rfWatchModHead;
window.addEventListener("resize",_syncModHeadH);
setTimeout(_syncTopbarH,300);   // after finalizing fonts/layout
setTimeout(_syncStripH,300);
setTimeout(_syncModHeadH,300);
setTimeout(_equalizeLeftTabs,340);
