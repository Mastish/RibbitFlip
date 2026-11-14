"use strict";
// ===== File import (setup / bundle / triggers) + autosnapshot & "undo import" =====
// A snapshot of the current configuration is stored BEFORE every destructive import so one click
// restores what the user had. localStorage keys: ribbitflip.undo (the snapshot itself),
// ribbitflip.undo.pending ("1" ⇒ show the "Undo import" toast after the reload the import triggers).
async function _rfUndoStash(kind){   // kind: "setup" | "bundle" | "rules" | "pose" | "mouse" | "midi"
  try{
    const snap={ts:Date.now(),kind};
    // KTÓREGO KAPSLA TO DOTYCZY. Wszystko poza paczką (ta jest na całą aplikację) wymienia
    // konfigurację JEDNEGO kapsla: aktywnego, a osie oglądanego (rf-05 `_VIEW_FETCH`). Bez tego
    // „Cofnij import" po przeładowaniu (panel wstaje na kapslu domyślnym) wgrywało starą
    // konfigurację na inny kapsel niż ten, który import zmienił. Patrz _rfUndoDevCheck.
    if(kind!=="bundle"){
      const dv=(kind==="pose")?(state.viewDev||state.activeDeviceId):state.activeDeviceId;
      if(dv)snap.dev=String(dv);
    }
    if(kind==="rules"){
      snap.rules=JSON.parse(JSON.stringify(state.rules||[]));
    }else if(kind==="mouse"){
      // Ustawienia ruchu, które kapsel ma TERAZ. Wczytanie profilu myszy wymienia je w całości,
      // a strojenie myszy bywa wieczorem pracy — jeśli nie było zapisane pod żadną nazwą, bez tej
      // migawki nie ma dokąd wracać.
      if(!state.mouse)return false;
      snap.config=JSON.parse(JSON.stringify(state.mouse));
    }else if(kind==="midi"){
      // Zestaw mapowań, który kapsel ma TERAZ. Wczytanie presetu wymienia CAŁĄ listę (do 64 pozycji),
      // a mapowania buduje się po jednym, godzinami — jeśli zestaw nie był zapisany pod żadną nazwą,
      // bez tej migawki nie ma dokąd wracać. Zapamiętujemy tylko to, co preset niesie: przełączniki,
      // kanał i prefiks nie zmieniają się przy wczytaniu, więc nie ma czego przywracać.
      if(!state.midi)return false;
      snap.config={mappings:JSON.parse(JSON.stringify(state.midi.mappings||[])),
                   scale:state.midi.scale,scaleRoot:state.midi.scaleRoot,
                   configName:state.midi.configName||""};
    }else if(kind==="pose"){
      if(typeof poseCfgObj!=="function")return false;   // Sensor tab not built yet — nothing to remember
      snap.config=poseCfgObj();
    }else if(kind==="setup"){
      const env=await fetch("/setup").then(r=>r.json());
      snap.config=env&&env.config; snap.pad=padStateIfLoaded();
    }else if(kind==="bundle"){
      const env=await fetch("/bundle").then(r=>r.json());
      snap.bundle=env; snap.pad=padStateIfLoaded();
    }else return false;
    localStorage.setItem("ribbitflip.undo",JSON.stringify(snap));
    return true;
  }catch(e){ try{localStorage.removeItem("ribbitflip.undo");}catch(_){}  return false; }   // quota/fetch failure → no undo, but never block the import
}
// Groups the imported setup used, but whose SWITCH it was not allowed to flip (a setup carries
// configuration, never arming — see apply_setup). Without a word here the import looks broken:
// the author had Motion control on, the person importing does not, and nothing moves.
//
// It used to be a clause tacked onto the "loaded" sentence, and that was too quiet for what it
// costs. A two-capsule set can leave FOUR switches off, and the one that is easiest to miss is
// Mapping on the capsule that only carries a button: the sticks work, the set looks alive, and the
// button does nothing at all — which reads as a broken mapping, not as a switch. So it gets its own
// note, it names the capsule, and it carries the button that flips exactly those switches. The
// principle is untouched: the FILE still arms nothing, a person does, with one deliberate click.
function _rfSwitchTake(){
  let kept=null,by=null;
  try{ kept=JSON.parse(localStorage.getItem("ribbitflip.undo.switches")||"[]"); }catch(e){}
  try{ by=JSON.parse(localStorage.getItem("ribbitflip.undo.switchesBy")||"[]"); }catch(e){}
  try{ localStorage.removeItem("ribbitflip.undo.switches");
       localStorage.removeItem("ribbitflip.undo.switchesBy"); }catch(e){}
  return {groups:Array.isArray(kept)?kept:[], by:Array.isArray(by)?by:[]};
}
// Grouped BY CAPSULE — "Toczenie (Mapowanie, Mysz i kontroler), Skok (Mapowanie)" — because that
// is how the reader will do it: they go to one capsule and flip what it needs, then the next one.
// A flat list repeats the capsule's name once per module and reads like four separate errands.
// Falls back to bare module names when the server sent no capsules (older build, or one capsule).
function _rfSwitchList(info){
  const nm=k=>(typeof rfGroupName==="function")?rfGroupName(k):k;
  if(info.by&&info.by.length){
    const out=[];
    info.by.forEach(it=>{
      const gs=(it.groups||[]).map(nm).filter(Boolean);
      if(!gs.length)return;
      out.push(it.name?(it.name+" ("+gs.join(", ")+")"):gs.join(", "));
    });
    if(out.length)return out.join(", ");
  }
  return info.groups.map(nm).filter(Boolean).join(", ");
}
function _rfSwitchAnnounce(info){
  if(!info||(!info.groups.length&&!info.by.length))return;
  const list=_rfSwitchList(info);
  if(!list)return;
  const msg=_gl("Zestaw nigdy nie włącza wyjść sam. Żeby zadziałał, włącz: "+list+".",
                "A setup never switches an output on by itself. To make it work, switch on: "+list+".");
  const act=info.by.length?{label:_gl("Włącz teraz","Switch on now"),
                            onClick:()=>_rfSwitchEnable(info.by)}:null;
  // Neutralny ton, nie `danger`: to nie awaria, tylko następny krok — i to zamierzony (zestaw
  // celowo nie zbroi wyjść za człowieka). Czerwień na poprawnym przebiegu uczy mijać czerwień.
  rfToast(msg,{ms:20000,action:act});
}
// One click, every switch the set wanted, on the capsule that wants it. Sequential on purpose:
// these are four small POSTs at most, and doing them one after another means a failure stops on
// the one that failed instead of half-arming the rig behind a green bubble.
async function _rfSwitchEnable(by){
  const apply=async()=>{
    // Te same POST-y, którymi pole „Włącz od razu po wczytaniu" włącza grupy zaraz po wczytaniu
    // (rf-29e) — jedno miejsce, więc przycisk i pole nie mogą się rozjechać.
    const out=(typeof rfArmSwitches==="function")?await rfArmSwitches(by):{done:[],left:(by||[])};
    if(out.left.length){rfToast(_gl("Nie udało się włączyć wszystkiego. Sprawdź przełączniki w zakładkach.",
                                    "Could not switch everything on — check the switches in the tabs."),{tone:"danger"});return;}
    // Reloaded rather than reflected in place: the switches live on several cards, some of them
    // belonging to capsules that are not the one on screen, and a half-refreshed panel showing a
    // module as off while it is on is worse than a second of waiting.
    rfToast(_gl("Włączone. Odświeżam panel…","Switched on. Refreshing the panel…"),{tone:"ok",ms:1500});
    setTimeout(()=>location.reload(),500);
  };
  // Same gate every switch goes through: in simulation the outputs are real, so it asks first.
  if(typeof rfSimConfirmOn==="function")rfSimConfirmOn(true,apply,"mapping"); else apply();
}
// Roles from a multi-capsule set that got no capsule — because there were not enough, or because
// the reader skipped them. Named, not counted: "one role did not load" is not actionable, "Skok
// i strzał did not load" is.
function _rfSkippedNote(){
  let sk=null;
  try{ sk=JSON.parse(localStorage.getItem("ribbitflip.undo.skipped")||"[]"); }catch(e){}
  try{ localStorage.removeItem("ribbitflip.undo.skipped"); }catch(e){}
  if(!Array.isArray(sk)||!sk.length)return "";
  return " "+_gl("Bez kapsla zostało: "+sk.join(", ")+". Dołóż kapsel i wczytaj plik jeszcze raz, żeby dobrać te role.",
                 "Left without a capsule: "+sk.join(", ")+". Add a capsule and load the file again to pick those roles up.");
}
// Every replacement of what you had gets the same way back, whether the file came from a stranger
// or from your own library. `msg` tells the two apart: an import is announced with the default
// sentence and the notes an import can leave behind, a load of your own thing says what it loaded.
// Without a snapshot the news is still worth saying — just without the button that cannot work.
// Every caller of this is a load that SUCCEEDED, so the bubble is green in both branches. It
// used to be green only when there was nothing to undo — which is the rarer case, so in practice
// a successful load looked exactly like any other piece of news.
function _rfUndoShowToast(msg){
  let has=false;
  try{ has=!!localStorage.getItem("ribbitflip.undo"); }catch(e){}
  // Taken before the bubble goes up and announced after it, so the two notes stack in reading
  // order: what was loaded first, what is still switched off on top of it.
  const sw=_rfSwitchTake();
  // …and what was switched on RIGHT AWAY because the person ticked the box (rf-29e). Announced
  // after the leftovers, so the reading order is: loaded → still off → switched on for you.
  const ar=(typeof _rfArmedTake==="function")?_rfArmedTake():null;
  const armed=()=>{ if(ar&&typeof rfArmedAnnounce==="function")rfArmedAnnounce(ar); };
  const ad=_rfAdoptedTake();
  const mo=_rfModsOffTake();
  const text=msg||(_gl("Wczytano nowy zestaw.","Loaded a new setup.")+_rfSkippedNote());
  if(!has){ if(msg)rfToast(text,{tone:"ok"}); _rfSwitchAnnounce(sw); armed(); _rfAdoptedAnnounce(ad); _rfModsOffAnnounce(mo); return false; }
  rfToast(text,{icon:"↺",ms:25000,tone:"ok",action:{
    label:msg?_gl("↶ Cofnij","↶ Undo"):_gl("↶ Cofnij import","↶ Undo import"), onClick:_rfUndoApply }});
  _rfSwitchAnnounce(sw);
  armed();
  _rfAdoptedAnnounce(ad);
  _rfModsOffAnnounce(mo);
  return true;
}
// CO Z ZESTAWU CZEKA NA RESTART: części dla modułów wyłączonych przy starcie (--disable / --only).
// Zapisały się razem z resztą, ale ich silnik w tym uruchomieniu nie działa. Bursztynowy dymek, bo
// to nie błąd wczytania, tylko rzecz, której człowiek inaczej nie zauważy (rf-28b).
function _rfModsOffTake(){
  let a=null;
  try{ a=JSON.parse(localStorage.getItem("ribbitflip.undo.modsOff")||"[]"); }catch(e){}
  try{ localStorage.removeItem("ribbitflip.undo.modsOff"); }catch(e){}
  return Array.isArray(a)?a:[];
}
function _rfModsOffAnnounce(list){
  const t=(typeof rfModsOffSetupText==="function")?rfModsOffSetupText(list):"";
  if(t)setTimeout(()=>rfToast(t,{tone:"warn",ms:15000}),1200);
}
// CO WYLĄDOWAŁO W BIBLIOTECE przy okazji importu. Osobne zdanie, a nie klauzula doklejona do
// „Wczytano" — bo to jest nowa rzecz na dysku, i to taka, którą człowiek zaraz będzie chciał
// znaleźć. Zmienioną nazwę mówimy WPROST: kto szukałby potem „Precyzja", a leży „Precyzja (2)",
// uznałby, że import zgubił plik.
function _rfAdoptedTake(){
  let a=null;
  try{ a=JSON.parse(localStorage.getItem("ribbitflip.undo.adopted")||"[]"); }catch(e){}
  try{ localStorage.removeItem("ribbitflip.undo.adopted"); }catch(e){}
  return Array.isArray(a)?a.filter(x=>x&&x.name&&x.state!=="same"):[];
}
function _rfAdoptedAnnounce(list){
  if(!list||!list.length)return;
  const names=list.map(x=>(x.state==="renamed"&&x.was)
    ?(x.name+_gl(" (nazwa „","(the name “")+x.was+_gl("” była zajęta)","” was taken)"))
    :x.name);
  setTimeout(()=>{
    rfToast(_gl("Do biblioteki doszły też presety z tego zestawu: ",
                "The presets from this setup landed in your library too: ")+names.join(", "),
      {tone:"ok",ms:12000});
  },900);
}
// COFNIĘCIE TYLKO NA TEN KAPSEL, Z KTÓREGO JEST MIGAWKA. Kapsla już nie ma = nic nie cofamy:
// serwer na nieznany `?dev=` odpowiada kapslem domyślnym, więc wysłanie i tak trafiłoby w inny.
function _rfUndoDevName(id){
  try{const D=state.devices&&state.devices[id];return (D&&D.meta&&D.meta.name)||id;}catch(e){return id;}
}
function _rfUndoGone(){
  try{localStorage.removeItem("ribbitflip.undo");}catch(e){}
  rfToast(_gl("Kapsla, którego dotyczy to cofnięcie, nie ma już w aplikacji. Niczego nie cofnięto, żeby nie nadpisać innego kapsla.",
              "The capsule this undo belongs to is no longer in the app. Nothing was undone, so no other capsule gets overwritten."),
    {tone:"danger",ms:9000});
}
// Cofnięcia „na miejscu" (wyzwalacze, mysz, MIDI, osie) wysyłają do kapsla, który panel ma TERAZ
// na ekranie. Gdy w trakcie dymka przełączono kapsel, nie cofamy na niewłaściwy: prosimy o powrót
// i zostawiamy migawkę z przyciskiem, żeby po przełączeniu dało się kliknąć jeszcze raz.
function _rfUndoDevCheck(snap){
  if(!snap||!snap.dev)return true;   // migawka sprzed tej zmiany: jak dotąd
  const cur=(snap.kind==="pose")?(state.viewDev||state.activeDeviceId):state.activeDeviceId;
  if(String(cur)===String(snap.dev))return true;
  if(!(state.devices&&state.devices[snap.dev])){_rfUndoGone();return false;}
  rfToast(_gl("To cofnięcie dotyczy kapsla „","This undo belongs to the capsule “")+_rfUndoDevName(snap.dev)
          +_gl("”. Przełącz panel na ten kapsel i kliknij „Cofnij” jeszcze raz.","”. Switch the panel to that capsule and press “Undo” again."),
    {tone:"warn",icon:"↺",ms:25000,action:{label:_gl("↶ Cofnij","↶ Undo"),onClick:_rfUndoApply}});
  return false;
}
function _rfUndoApply(){
  let snap=null; try{snap=JSON.parse(localStorage.getItem("ribbitflip.undo")||"null");}catch(e){}
  if(!snap){rfToast(_gl("Brak migawki do cofnięcia.","No snapshot to undo."),{tone:"danger"});return;}
  if(snap.kind==="rules"||snap.kind==="mouse"||snap.kind==="midi"||snap.kind==="pose"){
    if(!_rfUndoDevCheck(snap))return;
  }
  if(snap.kind==="rules"){   // triggers restore in place — no reload needed
    if(state.editing&&typeof closeEditor==="function")closeEditor();
    state.rules=Array.isArray(snap.rules)?snap.rules:[];
    commitRules(); renderRules();
    try{localStorage.removeItem("ribbitflip.undo");}catch(e){}
    rfToast(_gl("Przywrócono poprzednie wyzwalacze.","Restored the previous triggers."),{tone:"ok"});
    return;
  }
  if(snap.kind==="mouse"){   // ustawienia ruchu wracają na miejscu — postMouse odsyła je na serwer
    if(typeof onMouseCfg==="function")onMouseCfg(snap.config,true);
    if(typeof postMouse==="function")postMouse();
    try{localStorage.removeItem("ribbitflip.undo");}catch(e){}
    rfToast(_gl("Przywrócono poprzednie ustawienia myszy.","Restored the previous mouse settings."),{tone:"ok"});
    return;
  }
  if(snap.kind==="midi"){   // mapowania wracają na miejscu — postMidi odsyła je na serwer
    // Edytor mapowania trzyma kopię wiersza z listy, która za chwilę przestanie istnieć — i przy
    // otwartym edytorze onMidiCfg w ogóle nic by nie przyjął (bramka state.midiEditing).
    if(state.midiEditing&&typeof closeMidiEditor==="function")closeMidiEditor();
    if(typeof onMidiCfg==="function")onMidiCfg(snap.config);
    if(typeof postMidi==="function")postMidi();
    try{localStorage.removeItem("ribbitflip.undo");}catch(e){}
    rfToast(_gl("Przywrócono poprzedni zestaw mapowań.","Restored the previous mapping set."),{tone:"ok"});
    return;
  }
  if(snap.kind==="pose"){   // axes restore in place too — savePoseCal pushes them back to the server
    if(typeof applyPoseConfig==="function")applyPoseConfig(snap.config);
    if(typeof savePoseCal==="function")savePoseCal();
    try{localStorage.removeItem("ribbitflip.undo");}catch(e){}
    rfToast(_gl("Przywrócono poprzednie osie 3D.","Restored the previous 3D axes."),{tone:"ok"});
    return;
  }
  // Zestaw jednego kapsla wraca na TEN kapsel, z którego jest migawka, a nie na aktywny: po
  // przeładowaniu panel stoi na kapslu domyślnym. `?dev=` w adresie omija podstawianie aktywnego
  // slotu (rf-05). Najpierw pytamy, czy ten kapsel jeszcze jest (patrz _rfUndoGone).
  if(snap.kind!=="bundle"&&snap.dev){
    fetch("/devices").then(r=>r.json()).then(j=>{
      const ids=((j&&j.devices)||[]).map(d=>d&&String(d.dev));
      if(ids.indexOf(String(snap.dev))<0){_rfUndoGone();return;}
      _rfUndoPost(snap,"/setup?dev="+encodeURIComponent(snap.dev));
    }).catch(()=>rfToast(_gl("Serwer nieosiągalny, nie cofnięto.","Server unreachable, not undone."),{tone:"danger"}));
    return;
  }
  _rfUndoPost(snap,(snap.kind==="bundle")?"/bundle/apply":"/setup");
}
function _rfUndoPost(snap,url){
  // mode:"advanced" is safe here — the snapshot is the user's OWN earlier configuration,
  // already accepted once, so it must not be re-filtered as if it came from a foreign file.
  const body=(snap.kind==="bundle")?{bundle:snap.bundle,mode:"advanced"}:{config:snap.config,mode:"advanced"};
  fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
    .then(r=>r.json()).then(async res=>{
      if(res&&res.ok){
        // `padAdoptState` (rf-20b), a nie samo localStorage: od chwili, w której stan syntezatora
        // mieszka w Settings/, odświeżenie strony czyta go STAMTĄD — zapisany tylko w przeglądarce
        // przepadłby bez słowa przy `location.reload()` dwie linijki niżej. Czekamy na zapis, bo
        // duży stan leci bez `keepalive`.
        try{if(snap.pad)await padAdoptState(snap.pad);}catch(e){}
        try{localStorage.removeItem("ribbitflip.undo");}catch(e){}
        // The import that is being rolled back also wrote the lineage ("based on: ..."). With the
        // import undone that claim is no longer true, and the next share must not carry it.
        try{if(typeof rfLineageClear==="function")rfLineageClear();}catch(e){}
        rfToast(_gl("Przywracam poprzednią konfigurację, odświeżam…","Restoring previous configuration, reloading…"),{tone:"ok",ms:1500});
        setTimeout(()=>location.reload(),450);
      }else rfToast(_gl("Nie udało się cofnąć importu.","Could not undo the import."),{tone:"danger"});
    }).catch(()=>rfToast(_gl("Serwer nieosiągalny, nie cofnięto.","Server unreachable, not undone."),{tone:"danger"}));
}
function _rfUndoInit(){   // on (re)start: if an import left the pending flag, offer the undo toast
  let pend=null; try{pend=localStorage.getItem("ribbitflip.undo.pending");}catch(e){}
  if(!pend)return;
  try{localStorage.removeItem("ribbitflip.undo.pending");}catch(e){}
  // The flag used to be the string "1" and says nothing about WHAT was loaded. Loading from the
  // library now writes {name}, so the note can name it; "1" still works, because a flag written
  // by the previous build can be sitting in localStorage right now.
  let nm="";
  if(pend!=="1"){ try{ nm=String((JSON.parse(pend)||{}).name||""); }catch(e){} }
  _rfUndoShowToast(nm ? (_gl("Wczytano zestaw „","Loaded the setup “")+nm+"”."+_rfSkippedNote()) : "");
}
// --- LINEAGE: who made the set this configuration came from -----------------
// A shared file carries a name, an author and a revision. Remembering them at import is what
// lets the next post say "version 3, built on Kowalski's set" instead of looking like an
// unrelated new thing — the app knows the answer, so nobody has to type it from memory.
// Set by the link importer just before it hands the file over, read once, then cleared.
let _rfImportOrigin=null;
window.rfSetImportOrigin=function(u){_rfImportOrigin=u||null;};
function _rfLineageSave(o){
  try{
    const nm=String((o&&o.name)||"").trim(), au=String((o&&o.author)||"").trim();
    if(!nm&&!au){localStorage.removeItem("ribbitflip.lineage");return;}   // nothing to credit
    const lin={name:nm.slice(0,60),author:au.slice(0,60),rev:Math.max(1,parseInt(o.rev,10)||1),
               forApp:String((o&&o.forApp)||"").slice(0,80),ts:Date.now()};
    if(_rfImportOrigin)lin.url=String(_rfImportOrigin).slice(0,400);
    localStorage.setItem("ribbitflip.lineage",JSON.stringify(lin));
  }catch(e){}
  _rfImportOrigin=null;
}
// The durable copy every import leaves behind. It is not asked for any more — the preview only says
// where it will land — so a failure has to be said out loud: the import still goes ahead, but the
// person needs to know the way back was not saved.
//
// ⚠️ OD 2026-09-13 NIE JEST JUŻ WOŁANE Z IMPORTU ZESTAWU. Kopia „zawsze, nigdy pytanie" była
// odpowiedzią na pytanie, którego wtedy nikt nie zadawał; od kiedy pyta bramka (rf-29f), robienie
// jej mimo odpowiedzi „wczytaj bez zapisywania" znaczyłoby, że przycisk kłamie. Zostaje jako
// wspólne wejście dla ścieżek, które pytania nie mają (import presetu wyzwalaczy w rf-12 robi to
// po swojemu, więc na razie nie ma tu żadnego wywołującego — i to jest stan docelowy, nie brak).
async function _rfKeepCurrent(keep){
  const nm=await rfBackupCurrent(keep&&keep.name);
  if(nm){setupFlash(_gl("Zapisano kopię „","Saved a copy “")+nm+"”");rfLibReload();}
  else setupFlash(_gl("Nie udało się zapisać kopii, importuję mimo to","Could not save the copy, importing anyway"));
  return nm;
}
// PYTANIE PRZED WYMIANĄ — jedno wejście dla wszystkich trzech dróg (import pliku, import paczki,
// „Wczytaj zestaw" z Biblioteki), żeby wszystkie mówiły dokładnie to samo. `env` to koperta pliku
// (sekcje czytamy z niej, nie z metadanych), `devs` to kapsle, na które zestaw wejdzie — przy
// paczce znane dopiero po wyborze ról, stąd bramka stoi za tamtym oknem, a nie przed nim.
// Bez rf-29f (starszy build, okno nakładki) przepuszczamy bez pytania: bramka ma chronić, nie
// blokować, a jej brak nie jest powodem, żeby wczytywanie przestało działać.
async function _rfGuard(env,devs){
  if(typeof rfSetupGuard!=="function")return {saved:null,risk:0};
  const groups=(typeof rfSetupGuardGroups==="function")?rfSetupGuardGroups(env):[];
  return await rfSetupGuard({name:(env&&env.name)||"",groups:groups,devs:devs,
                             bundle:!!(env&&Array.isArray(env.devices))});
}
function setupImport(file){
  const fr=new FileReader();
  fr.onload=()=>{try{
    const o=JSON.parse(fr.result);
    if(!o||typeof o!=="object"){setupFlash("Zły plik");return;}
    const cfg=(o.config&&typeof o.config==="object")?o.config:o;
    fetch("/setup/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({config:cfg,envelope:o})})
      .then(r=>r.json()).then(a=>{
        // BEZ `backupName`: od 13.09 o kopię pyta bramka (rf-29f), a nie zapowiada jej linijka
        // w środku podglądu. Zdanie „najpierw zapiszę…" stojące tu obok przycisku „Wczytaj"
        // opisywało rzecz, o której człowiek nie miał jak zdecydować, i robiło ją nawet wtedy,
        // gdy nie było czego ratować — stąd pozycje-śmiecie „Przed importem…" na liście zestawów.
        // `nextStep`: po tym oknie idzie jeszcze bramka, więc przycisk mówi „Dalej", nie „Wczytaj".
        // `cassette` — kaseta z pliku (serwer już ją oczyścił w `setup_about`): okno pokazuje ją obok
        // opisu autora, tak jak potem lista Biblioteki (rf-28e).
        rfSafetyModal({title:"Import zestawu"+(o.forApp?": "+o.forApp:""),analysis:a,nextStep:true,cassette:a.cassette,apply:async(mode,adopt,arm)=>{
          const G=await _rfGuard(o,null);
          if(!G)return;                  // anulowano w bramce — nic nie zapisane, nic nie wczytane
          await _rfUndoStash("setup");   // snapshot the current setup BEFORE the destructive import
          // Zrzuty plansz skanera jadą w pliku zestawu od 02.10 (`library_item`); rozpakowuje je ta
          // sama funkcja, co przy presecie skanera. Dopiero po zgodzie w bramce — nie przy podglądzie.
          if(o&&o.obrazy&&typeof rfScanImportObrazy==="function"){try{await rfScanImportObrazy(o);}catch(e){}}
          fetch("/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({config:cfg,mode,adopt:adopt!==false})})
            .then(r=>r.json()).then(async res=>{
              if(res.ok){try{if(o&&o.pad)await padAdoptState(o.pad);}catch(e){}   // restore XY-pad instruments (localStorage + Settings/ — patrz rf-20b)
                _rfLineageSave(o);
                // Group switches the setup wanted but may not flip: switched on NOW when the person
                // ticked „Włącz od razu po wczytaniu" in the preview, otherwise explained after the
                // reload — rf-29e writes the notes for after the reload either way.
                if(typeof rfArmAfterLoad==="function")await rfArmAfterLoad(res,arm);
                try{localStorage.setItem("ribbitflip.undo.pending","1");
                     // …i CO WYLĄDOWAŁO W BIBLIOTECE. Strona zaraz się przeładuje, więc zdanie o tym
                     // musi przeżyć przeładowanie — inaczej człowiek dowiedziałby się o nowych
                     // pozycjach dopiero wtedy, gdy sam na nie trafi.
                     localStorage.setItem("ribbitflip.undo.adopted",JSON.stringify(res.adopted||[]));}catch(e){}
                // Scena „kaseta wsuwa się, Wczytane" gra po przeładowaniu (rf-28e).
                try{if(typeof rfKasetaZapowiedz==="function")rfKasetaZapowiedz(a.cassette,o.name||o.forApp||"");}catch(e){}
                setupFlash("Wczytano ("+(mode==="safe"?"tryb bezpieczny":"tryb zaawansowany")+(res.droppedRisky?", pominięto "+res.droppedRisky+" ryzykownych":"")+"), odświeżam…");setTimeout(()=>location.reload(),750);}
              else setupFlash("Nie wczytano ("+(res.error||"błąd")+")");
            }).catch(()=>setupFlash("Serwer nieosiągalny"));
        }});
      }).catch(()=>setupFlash("Błąd analizy pliku"));
  }catch(e){setupFlash("Błąd: nieprawidłowy JSON");}};
  fr.readAsText(file);
}
// --- BUNDLE: 1 file = app configuration + each device's setup -----
function bundleExport(){
  fetch("/bundle").then(r=>r.json()).then(env=>{
    const nm=(document.getElementById("setupName").value||"").trim();
    const fr=(document.getElementById("setupFor").value||"").trim();
    const ds=(document.getElementById("setupDesc").value||"").trim();
    if(nm)env.name=nm; if(fr)env.forApp=fr; if(ds)env.description=ds;
    // Instrukcja użytkowania — to samo pole i ta sama droga, co przy jednym kapslu (rf-28).
    // Paczka potrzebuje jej nawet bardziej: to w niej trzeba powiedzieć, który kapsel bierze
    // którą rolę i co w grze sprawdzić.
    {const hw=((document.getElementById("setupHowto")||{}).value||"").trim();
     if(hw)env.howto=hw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,8);}
    {const ex=((document.getElementById("setupExe")||{}).value||"").trim(); if(ex)env.exe=ex;}   // to samo pole co przy jednym kapslu
    if(typeof rfKasetaWybrana==="function")env.cassette=rfKasetaWybrana().id;   // kaseta z paska zapisu / kreatora (rf-28e)
    const meta=rfShareMeta();
    if(meta.author)env.author=meta.author;
    env.rev=meta.rev;
    if(meta.basedOn)env.basedOn=meta.basedOn;
    {const p=padStateIfLoaded();if(p)env.pad=p;}   // XY-pad instruments; none without the Synth loaded (rf-20)
    // Roles: what each capsule DOES in this set. Without them the file says "device 0, device 1",
    // and those are pairing order — meaningless on the machine that imports it (rf-29c).
    try{if(typeof rfBundleStampRoles==="function")rfBundleStampRoles(env);}catch(e){}
    const base=rfSetupFileBase(env.forApp||env.name)||"rig";
    const blob=new Blob([JSON.stringify(env,null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="ribbitflip-bundle-"+base+".json";document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    setupFlash("Pobrano zestaw na kilka kapsli (wszystkie kapsle)");
  }).catch(()=>setupFlash("Błąd pobierania zestawu na kilka kapsli"));
}
function bundleImport(file){
  const fr=new FileReader();
  fr.onload=()=>{try{
    const o=JSON.parse(fr.result);
    bundleImportObj(o);
  }catch(e){setupFlash("Błąd: nieprawidłowy JSON");}};
  fr.readAsText(file);
}
// The same door for a bundle that is ALREADY an object — the library hands one over when a
// multi-capsule set sits among the setups (the built-in „Pad na dwa kapsle (start)" ships that
// way). Same analysis, same safety modal, same role mapping: where the JSON came from changes
// nothing about what applying it does.
function bundleImportObj(o){
  {
    if(!o||typeof o!=="object"){setupFlash("Zły plik");return;}
    fetch("/bundle/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bundle:o})})
      .then(r=>r.json()).then(a=>{
        // `nextStep` — po tym oknie idą JESZCZE DWA (role kapsli, potem bramka), więc przycisk
        // nazywa się „Dalej". Do 13.09 pisało na nim „Wczytaj", a kliknięcie otwierało kolejne
        // okno; zgłoszony objaw brzmiał wprost: „nie wczytano presetu, a tylko
        // zakomunikowano, że tak się stanie".
        rfSafetyModal({title:"Zestaw na kilka kapsli"+(o.forApp?": "+o.forApp:"")+" (kapsli: "+(a.deviceCount||0)+")",analysis:a,nextStep:true,cassette:a.cassette,apply:async(mode,adopt,arm)=>{
          // WHICH capsule takes which role — asked after "is this safe" and before anything is
          // written, because the answer decides where the author's steering lands. Backing out
          // here must leave the machine untouched, so the backup and the undo snapshot wait.
          let map=null;
          if(typeof rfBundleMap==="function"){
            map=await rfBundleMap(a,true);   // po tym oknie idzie jeszcze bramka → przycisk „Dalej"
            // CICHY POWRÓT BYŁ BŁĘDEM. Do 13.09 zamknięcie tego okna (Escape, ×, „Anuluj",
            // kliknięcie w tło) kończyło CAŁY import bez jednego słowa — po tym, jak człowiek
            // w poprzednim oknie kliknął przycisk z napisem „Wczytaj". Wyglądało to dokładnie
            // jak udane wczytanie, które nic nie zmieniło.
            if(!map){setupFlash(_gl("Nie wczytano: nie wybrano kapsli do ról.",
                                    "Not loaded: no capsules were assigned to the roles."));return;}
          }
          // Kapsle, na które paczka naprawdę wejdzie — znane dopiero TERAZ, po wyborze ról.
          // Dlatego bramka („co stracisz") stoi tutaj, a nie przed oknem ról: wcześniej musiałaby
          // ostrzegać o kapslach, których wczytanie może w ogóle nie dotknąć.
          const G=await _rfGuard(o,Array.isArray(map)?map.filter(Boolean):null);
          if(!G)return;                   // anulowano w bramce — nic nie zapisane, nic nie wczytane
          await _rfUndoStash("bundle");   // snapshot the whole rig BEFORE the destructive import
          if(o&&o.obrazy&&typeof rfScanImportObrazy==="function"){try{await rfScanImportObrazy(o);}catch(e){}}   // zrzuty plansz skanera (02.10)
          // ⚠️ `adopt` (trzeci argument `rfSafetyModal`) NIE JEDZIE TU CELOWO, i to nie jest
          // przeoczenie: pole „Dopisz te presety do mojej biblioteki" rysuje się WYŁĄCZNIE wtedy,
          // gdy analiza przysłała `adoptable`, a `analyze_bundle` jej nie liczy — nazwane
          // konfiguracje siedzą w paczce PER KAPSEL, więc płaski słownik {trig, mouse, midi}
          // zderzyłby dwa różne presety pod jednym kluczem. Wysyłanie `adopt:true` „bo argument
          // jest" znaczyłoby dopisywanie cudzych presetów do biblioteki BEZ PYTANIA — dokładnie
          // odwrotnie niż na jednokapslowej ścieżce, gdzie to wybór człowieka. Do zrobienia razem:
          // `adoptable` per kapsel w analizie + jeden blok na kapsel w `rfSetupItemsHtml`.
          fetch("/bundle/apply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bundle:o,mode,map})})
            .then(r=>r.json()).then(async res=>{
              if(res.ok){try{if(o&&o.pad)await padAdoptState(o.pad);}catch(e){}   // restore XY-pad instruments (localStorage + Settings/ — patrz rf-20b)
                _rfLineageSave(o);
                // Group switches the setup wanted but may not flip: switched on NOW when the person
                // ticked „Włącz od razu po wczytaniu" in the preview, otherwise explained after the
                // reload — rf-29e writes the notes for after the reload either way.
                if(typeof rfArmAfterLoad==="function")await rfArmAfterLoad(res,arm);
                try{localStorage.setItem("ribbitflip.undo.pending","1");
                     // Roles left without a capsule. Said out loud AFTER the reload, next to the
                     // undo offer — half a set landing quietly used to read as a full success.
                     localStorage.setItem("ribbitflip.undo.skipped",JSON.stringify(res.skipped||[]));}catch(e){}
                try{if(typeof rfKasetaZapowiedz==="function")rfKasetaZapowiedz(a.cassette,o.name||o.forApp||"");}catch(e){}   // scena wczytania po przeładowaniu (rf-28e)
                setupFlash("Wczytano zestaw na kilka kapsli ("+(mode==="safe"?"bezpieczny":"zaawansowany")+(res.droppedRisky?", pominięto "+res.droppedRisky:"")+"), odświeżam…");setTimeout(()=>location.reload(),800);}
              else setupFlash("Nie wczytano ("+(res.error||"błąd")+")");
            }).catch(()=>setupFlash("Serwer nieosiągalny"));
        }});
      }).catch(()=>setupFlash("Błąd analizy zestawu na kilka kapsli"));
  }
}
// --- 3D AXIS PRESET: a file somebody else tuned ------------------------------
// Until now an axis preset could be SAVED, loaded from the library and downloaded — but a preset
// file arriving from outside had nowhere to go: the sniffer saw its `config` key, took it for a
// setup, and the server answered "nothing applied" because none of a setup's groups were in it.
// A dead end that looked like a bug. It matters more now that axis presets can be posted on the
// forum: a door saying "take one from a post" has to lead somewhere.
//
// No safety preview here, and that is deliberate rather than an omission: an axis preset carries
// channels, filters and curves — no keystrokes, no macros, nothing that can act on the machine.
// What it CAN cost is an evening of tuning, so that is what gets protected: the current axes are
// put in the library first, under a stamped name, and the toast says where they went.
async function _rfPoseNames(){
  try{const m=await fetch("/pose-presets").then(r=>r.json());return m.presets||[];}catch(e){return [];}
}
async function _rfPoseSave(name,cfg,taken){
  const fin=_rfBackupName(String(name||"").trim()||rfBackupStamp(),taken||[]);
  try{
    const res=await fetch("/pose-preset/save",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name:fin,config:cfg})}).then(r=>r.json());
    return (res&&res.ok)?fin:null;
  }catch(e){return null;}
}
function poseImport(file){
  const fr=new FileReader();
  fr.onerror=()=>rfToast(_gl("Nie udało się odczytać pliku.","Could not read the file."),{tone:"danger"});
  fr.onload=async ()=>{
    let o;try{o=JSON.parse(fr.result);}catch(e){setupFlash(_gl("Błąd: nieprawidłowy JSON","Error: invalid JSON"));return;}
    // Envelope (kind:"pose-preset") or a bare config, the way load_pose_preset accepts both.
    const cfg=(o&&typeof o==="object"&&o.config&&typeof o.config==="object")?o.config:o;
    if(!cfg||typeof cfg!=="object"||(cfg.chans==null&&cfg.cal==null&&cfg.axes==null)){
      setupFlash(_gl("To nie wygląda na preset osi 3D","That does not look like a 3D axis preset"));return;
    }
    const D=(typeof state!=="undefined")?(state.devices||{})[state.viewDev||state.activeDeviceId]:null;
    const who=(D&&D.meta&&(D.meta.label||D.meta.name))||_gl("wybranego kapsla","the selected capsule");
    const nm=String((o&&o.name)||"").trim();
    const ok=(typeof rfConfirm==="function")
      ? await rfConfirm(_gl("Zastąpi strojenie osi 3D kapsla „","It will replace the 3D axis tuning of “")+who+
          _gl("”: kanały, filtr, czułość, odwrócenie i tor sygnału. Obecne osie zapiszę wcześniej jako preset, żeby dało się do nich wrócić.",
              "”: channels, filter, sensitivity, inversion and the signal chain. I will save your current axes as a preset first, so you can go back to them."),
          {title:_gl("Wczytać preset osi 3D?","Load the 3D axis preset?"),
           icon:'<span class="bic bic-import" aria-hidden="true"></span>',
           confirmLabel:_gl("Wczytaj","Load"),cancelLabel:_gl("Anuluj","Cancel")})
      : true;
    if(!ok)return;
    const taken=await _rfPoseNames();
    let back=null;
    if(typeof poseCfgObj==="function")back=await _rfPoseSave(rfBackupStamp(),poseCfgObj(),taken);
    if(back)taken.push(back);
    // The incoming preset lands in the library too — "I took this from a post" should mean you HAVE
    // it, not just that your axes changed once.
    const kept=await _rfPoseSave(nm||_gl("Preset z posta","Preset from a post"),cfg,taken);
    if(typeof applyPoseConfig==="function")applyPoseConfig(cfg);
    if(typeof savePoseCal==="function")savePoseCal();
    if(typeof loadPosePresetList==="function")loadPosePresetList(kept||"");
    try{if(typeof rfLibReload==="function")rfLibReload();}catch(e){}
    rfToast(_gl("Wczytano osie 3D","Loaded the 3D axes")+(kept?(_gl(" i zapisano jako „"," and saved it as “")+kept+"”"):"")+
      (back?(_gl(". Poprzednie leżą w bibliotece jako „",". The previous ones are in the library as “")+back+"”."):"."),
      {tone:"ok",ms:9000});
  };
  fr.readAsText(file);
}
// Saving no longer asks WHAT to include. A setup is by definition the whole configuration, and the
// backup below (rfBackupCurrent) has always taken everything for exactly that reason — the two are
// the same act, so they cannot disagree about what a saved setup is. Choosing a scope only matters
// when a FILE leaves the machine, and that choice lives in the share wizard now, in its first step.
// The question here bought nothing and cost the one thing a library copy exists to protect: a
// half-saved setup looks identical to a whole one until the evening you load it.
// CO STOI POD TĄ NAZWĄ — pytanie zadawane PRZED zapisem, nie po. Odpowiedź: "" (wolna nazwa),
// "user" (własny zestaw) albo "builtin" (zestaw z aplikacji). Bierzemy ją z /library, bo tylko ta
// lista mówi, CZYJA jest pozycja (`official`); /setups skleja jedno i drugie w jeden ciąg nazw.
// Cichy null przy błędzie sieci jest celowy: pytanie kontrolne nie może zablokować zapisu, którego
// serwer i tak by przyjął.
async function _setupNameTaken(name){
  return (await _setupExisting(name)).taken;
}
// To samo pytanie, ale razem z wierszem listy: `hit.name` to nazwa w pisowni, pod którą zestaw
// naprawdę leży (pytanie o szczegóły rozróżnia wielkość liter inaczej niż to porównanie).
async function _setupExisting(name){
  const key=String(name||"").trim().toLowerCase();
  if(!key)return {taken:"",hit:null};
  try{
    const j=await fetch("/library").then(r=>r.json());
    const hit=((j&&j.setup)||[]).find(it=>String(it.name||"").trim().toLowerCase()===key);
    return {taken:hit?(hit.official?"builtin":"user"):"",hit:hit||null};
  }catch(e){return {taken:"",hit:null};}
}
// NADPISANIE NIE KASUJE TEGO, CZEGO PASEK NIE POKAZUJE. Serwer buduje kopertę od zera z tego, co
// przyszło, a pola „gra.exe", „dla programu", opis i instrukcja są w pasku puste, dopóki ktoś ich
// nie wypełni. Zapis poprawionych reguł pod tą samą nazwą zdejmował więc przypisanie gry (zestaw
// przestawał wczytywać się sam) i opis, bez słowa. Teraz puste pole bierze wartość z zapisanej
// wersji, a wypełnione ją zastępuje. Pełna koperta, bo wiersz listy przycina opis. Błąd sieci =
// `null`, czyli zapis jak dotąd: to uzupełnienie, nie bramka.
async function _setupPrevEnvelope(hit){
  if(!hit||!hit.name)return null;
  try{
    const r=await fetch("/library/item?kind=setup&name="+encodeURIComponent(hit.name)).then(x=>x.json());
    return (r&&r.ok&&r.item&&typeof r.item==="object")?r.item:null;
  }catch(e){return null;}
}
async function setupSave(){
  const name=(document.getElementById("setupName").value||"").trim();
  if(!name){setupFlash("Podaj nazwę zestawu");return;}
  // NADPISANIE JEST DECYZJĄ, NIE SKUTKIEM UBOCZNYM. Zestaw to cała konfiguracja pod jedną grę —
  // wieczór strojenia — a zapis pod zajętą nazwą kasował go bez jednego słowa. Przy zestawie
  // wbudowanym było jeszcze gorzej: własna kopia PRZYSŁANIA plik z aplikacji (load_setup
  // i library_index szukają najpierw w Library/Setups), więc oryginał znikał z listy i nic nie
  // mówiło, że wróci po usunięciu kopii. Teraz mówi to zdanie w pytaniu.
  const ex=await _setupExisting(name), taken=ex.taken;
  if(taken){
    const ok=await rfConfirm(
      taken==="builtin"
        ? _gl("„"+name+"” to zestaw wbudowany. Twoja wersja go zastąpi na liście; usuń ją, a wbudowana wróci.",
              "“"+name+"” is a built-in setup. Your version replaces it in the list; delete yours and the built-in comes back.")
        : _gl("Zestaw o tej nazwie już jest w Bibliotece. Zapis go zastąpi, a starej wersji nie da się odzyskać.",
              "A setup with this name is already in the Library. Saving replaces it and the old version cannot be recovered."),
      {title:_gl("Nadpisać zestaw „"+name+"”?","Overwrite the setup “"+name+"”?"),
       icon:'<span class="bic bic-save" aria-hidden="true"></span>',
       tone:taken==="builtin"?"":"danger",
       confirmLabel:taken==="builtin"?_gl("Zastąp na liście","Replace in the list"):_gl("Nadpisz","Overwrite"),
       cancelLabel:_gl("Anuluj","Cancel")});
    if(!ok)return;
  }
  const prev=taken?await _setupPrevEnvelope(ex.hit):null;
  const inc=[];RF_SETUP_SECTIONS.forEach(s=>{if(s.cfg)s.cfg.forEach(k=>inc.push(k));});   // save = everything
  const body={name, forApp:(document.getElementById("setupFor").value||"").trim(),
    // Plik gry, po którym zestaw wczyta się sam. Serwer normalizuje (małe litery, bez ścieżki,
    // z .exe) i to on ma ostatnie słowo — panel nie próbuje zgadywać za niego.
    exe:((document.getElementById("setupExe")||{}).value||"").trim(),
    description:(document.getElementById("setupDesc").value||"").trim(),
    // Instrukcja użytkowania z kreatora posta (bliźniak #setupHowto w pasku). Serwer dzieli
    // ją po liniach i przycina — patrz `_sanitize_howto`; panel nie liczy kroków za niego.
    howto:((document.getElementById("setupHowto")||{}).value||"").trim(),
    include:inc,
    // XY-pad instruments live outside the capsule config, so they travel as their own key.
    // Without the Synth loaded in this tab the key is left out (rf-20 padStateIfLoaded).
    pad:padStateIfLoaded(),
    ...rfShareMeta()};   // author / rev / basedOn — kept in the library copy too, not only in exports
  // KASETA (rf-28e): ta, którą autor wybrał przyciskiem z kasetą w pasku albo w kreatorze posta.
  const kas=(typeof rfKasetaWybrana==="function")?rfKasetaWybrana():{id:1,touched:false};
  body.cassette=kas.id;
  if(prev){   // puste pole paska = wartość z zapisanej wersji (patrz _setupPrevEnvelope)
    // Nietknięty wybór kasety = kaseta zapisanej wersji: poprawka reguł nie zmienia zestawowi wyglądu.
    if(!kas.touched&&prev.cassette!=null)body.cassette=prev.cassette;
    if(!body.forApp&&prev.forApp)body.forApp=String(prev.forApp);
    if(!body.exe&&prev.exe&&(!Array.isArray(prev.exe)||prev.exe.length))body.exe=prev.exe;
    if(!body.description&&prev.description)body.description=String(prev.description);
    if(!body.howto&&Array.isArray(prev.howto)&&prev.howto.length)body.howto=prev.howto;
  }
  fetch("/setup/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
    .then(r=>r.json()).then(res=>{
      if(res.ok){setupFlash("Zapisano zestaw „"+name+"”");rfLibReload();
        // a setup tied to a game also says whether it will load by itself (rf-39o)
        try{if(body.exe&&typeof window.rfGsAfterSave==="function")window.rfGsAfterSave(name,body.exe);}catch(e){}}
      else setupFlash(res.error||"Nie zapisano");
    }).catch(()=>setupFlash("Serwer nieosiągalny"));
}
function initFileDrop(){   // drag & drop JSON onto the window (auto-detect type → same safety modal as manual import)
  if(window._rfDropWired)return; window._rfDropWired=true;
  // #rfDrop styling lives in /web/css/13-dialogs-overview.css
  const ov=document.createElement("div");ov.id="rfDrop";
  ov.innerHTML='<div class="rfdrop-card" role="dialog" aria-label="Upu\u015b\u0107 plik JSON">'+
    '<div class="rfdrop-frog" aria-hidden="true"></div>'+
    '<p class="rfdrop-t">Upu\u015b\u0107 plik JSON</p>'+
    '<p class="rfdrop-s">zestaw \u00b7 kilka kapsli \u00b7 presety \u00b7 paczka REST</p></div>';
  document.body.appendChild(ov);
  try{if(typeof applyLang==="function")applyLang(ov);}catch(e){}
  let depth=0;
  const hasFiles=e=>{const t=e.dataTransfer&&e.dataTransfer.types;return !!t&&Array.from(t).indexOf("Files")>=0;};
  const hide=()=>{depth=0;ov.classList.remove("on");};
  window.addEventListener("dragenter",e=>{if(!hasFiles(e))return;e.preventDefault();depth++;ov.classList.add("on");});
  window.addEventListener("dragover",e=>{if(!hasFiles(e))return;e.preventDefault();try{e.dataTransfer.dropEffect="copy";}catch(_){}});
  window.addEventListener("dragleave",e=>{if(!hasFiles(e))return;depth--;if(depth<=0)hide();});
  window.addEventListener("drop",e=>{if(!hasFiles(e))return;e.preventDefault();hide();
    const files=e.dataTransfer.files;if(!files||!files.length)return;
    if(files.length>1)rfToast(_gl("Wczytuj\u0119 jeden plik naraz \u2014 wybieram pierwszy.","Loading one file at a time \u2014 using the first."),{ms:3500});
    const f=files[0],nameOk=/\.json$/i.test(f.name||""),typeOk=/json/i.test(f.type||"");
    if(!nameOk&&!typeOk){rfToast(_gl("To nie jest plik JSON.","That is not a JSON file."),{tone:"danger"});return;}
    // The „load from somebody" window asks exactly what this drop just answered, so it steps aside.
    // Not politeness: its backdrop sits ABOVE the safety review (.rfk-back 10050 vs #rfSafe 10001),
    // so left open it would bury the dialog the drop is about to raise.
    try{if(window.rfLinkClose)window.rfLinkClose();}catch(e){}
    _rfDropDispatch(f);});
}
function _rfDropDispatch(file){   // sniff order: bundle -> triggers -> preset modulu -> setup; the backend re-verifies macros either way
  const fr=new FileReader();
  fr.onerror=()=>rfToast(_gl("Nie udało się odczytać pliku.","Could not read the file."),{tone:"danger"});
  fr.onload=()=>{let o;try{o=JSON.parse(fr.result);}catch(e){rfToast(_gl("Nie rozpoznano pliku: nieprawidłowy JSON.","File not recognised: invalid JSON."),{tone:"danger"});return;}
    if(o&&typeof o==="object"&&!Array.isArray(o)&&o.devices!=null&&(Array.isArray(o.devices)||typeof o.devices==="object")){bundleImport(file);return;}
    if(Array.isArray(o)||(o&&o.app==="ribbitflip-wyzwalacze")||(o&&Array.isArray(o.rules)&&!o.config)){importConfig(file);return;}
    // An axis preset BEFORE the setup test: its envelope also carries a `config` key, so the setup
    // branch used to swallow it and the server answered "nothing applied".
    if(o&&o.kind==="pose-preset"&&o.config&&typeof o.config==="object"){poseImport(file);return;}
    // PRESET MODUŁU (mysz · MIDI/OSC · usługi sieciowe · koło) — PRZED testem zestawu i z tego samego
    // powodu, co preset osi: ich koperty też niosą `config`, więc gałąź zestawu je połykała, a serwer
    // odpowiadał "Pusty lub nieznany zestaw" (zmierzone 2026-08-31 na presecie usług i na presecie koła).
    // Rodzaj rozstrzyga REJESTR (rf-49-kinds), a nie kolejny `if`: dokładanie rodzaju ma być jedną
    // pozycją w jednej tablicy, bo właśnie rozsypanie tej wiedzy po piętnastu miejscach dało te błędy.
    if(o&&o.kind&&typeof rfKindByEnv==="function"){
      const K=rfKindByEnv(o.kind);
      if(K&&(K.dropVia==="preset"||K.dropVia==="wheel")){
        if(typeof rfPresetImportObj==="function"){rfPresetImportObj(o,K);return;}
        // Build bez rf-29d: mówimy, czego brakuje, zamiast wpuszczać plik w gałąź zestawu.
        rfToast(_gl("Tej wersji panelu brakuje obsługi importu presetów modułów.",
                    "This build of the panel is missing the module-preset import."),{tone:"danger",ms:9000});
        return;
      }
    }
    // A REST pack lands INSIDE one application and the file does not say which — the one question
    // the sniffer cannot answer from the bytes. It used to be answered by refusing the file and
    // telling the person to do it somewhere else; now the REST module asks it (which application,
    // and only when there is more than one) and takes the file from here like any other door. The
    // toast stays as the fallback for a build where that module never loaded.
    if(o&&o.kind==="rest-actions"){
      const packFile=(window.RESTAPI&&window.RESTAPI.importPackFile)||null;
      if(packFile){packFile(file);return;}
      rfToast(_gl("To paczka akcji REST. Wczytasz ją na ekranie Usługi sieciowe, przyciskiem „Wymiana” w karcie aplikacji.",
                  "This is a REST action pack. You load it on the Network services screen, with the “Wymiana” button on an application card."),
        {tone:"danger",ms:9000});
      return;
    }
    // Treat as a setup ONLY when recognizable config keys are present, so an arbitrary foreign
    // JSON cannot slip through as an empty "setup import" and silently wipe the configuration.
    const looksSetup=o&&typeof o==="object"&&((o.config&&typeof o.config==="object")||["rules","mouse","midi","pose","power","trigEnabled","pad"].some(k=>o[k]!=null));
    if(looksSetup){setupImport(file);return;}
    rfToast(_gl("Nie rozpoznano pliku: to nie wygląda na konfigurację RibbitFlip.","File not recognised: this does not look like a RibbitFlip configuration."),{tone:"danger"});};
  fr.readAsText(file);
}
// Only the save button hangs off this now. The six file buttons that used to stand in the "Plik
// zestawu:" strip are gone, and the four functions behind them are as alive as they ever were —
// they simply have better doors: setupExport / bundleExport are what the exchange window's
// "Pobierz plik .json" calls, and setupImport / bundleImport are reached through the one import
// window and the drop sniffer (_rfImportSniff above), which pick the right one by looking INSIDE
// the file instead of asking the person to know which button they need.
function initSetup(){
  const g=id=>document.getElementById(id);
  if(g("setupSave"))g("setupSave").onclick=setupSave;
}
