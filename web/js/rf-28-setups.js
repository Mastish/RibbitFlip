"use strict";
// ======================= SETUPS — complete configuration =======================
//  Setup = ALL groups (triggers + motion + MIDI/OSC + 3D axes + battery) + metadata.
//  The .json file is the unit of exchange between users (sharing per game/program).
//  Import/load applies everything on the server and reloads the page (full UI sync).
// ===== "what to include" picker for saved/exported presets =====
//  cfg keys name entries inside the server config envelope; `pad:true` marks the one
//  section that is NOT server-side (XY-pad instruments live in localStorage).
const RF_SETUP_SECTIONS=[
  {key:"rules", label:"Wyzwalacze (Mapowanie)", en:"Triggers (Mapping)",     cfg:["rules","trigEnabled"]},
  {key:"mouse", label:"Mysz i kontroler (sterowanie ruchem)", en:"Mouse & controller (motion control)", cfg:["mouse"]},
  {key:"midi",  label:"MIDI / OSC",             en:"MIDI / OSC",              cfg:["midi"]},
  // SKANER doszedł do zestawów 2026-09-13 (`SETUP_KEYS` w monitorze). Ta lista nie jest opisem —
  // z niej powstaje `include`, po którym serwer TNIE koperkę przy zapisie i eksporcie. Bez tego
  // wiersza każdy zapisany i wysłany zestaw gubił konfigurację skanera po cichu, łącznie z kopią
  // „zapisz przed wczytaniem", czyli z jedyną drogą powrotu.
  {key:"scan",  label:"Skaner",                 en:"Scanner",                 cfg:["scan"]},
  {key:"pose",  label:"Kalibracja osi 3D",      en:"3D axis calibration",     cfg:["pose"]},
  {key:"power", label:"Oszczędzanie baterii",   en:"Battery saving",          cfg:["power"]},
  {key:"pad",   label:"Synth: pady i dźwięki", en:"Synth: pads & sounds", pad:true}
];
function _rfCfgKeep(sel){const keep=new Set();RF_SETUP_SECTIONS.forEach(s=>{if(s.cfg&&sel.has(s.key))s.cfg.forEach(k=>keep.add(k));});return keep;}
function _rfIncStyleOnce(){/* no-op: styles live in /web/css/13-dialogs-overview.css */}
// opts.sel (optional, a Set of section keys) preselects the boxes. Without it everything is ticked,
// which is what every caller wanted while this window was only ever opened once per file. The share
// wizard can reopen it to CHANGE a scope it already shows, and a picker that reopens on „everything"
// would be quietly lying about the state of the line that opened it.
function rfIncludeModal(opts){
  _rfIncStyleOnce();
  const old=document.getElementById("rfInc");if(old)old.remove();
  const ov=document.createElement("div");ov.id="rfInc";
  const pre=(opts&&opts.sel&&typeof opts.sel.has==="function")?opts.sel:null;
  const rows=RF_SETUP_SECTIONS.map(s=>`<label class="ic-row"><input type="checkbox" data-k="${s.key}"${(!pre||pre.has(s.key))?" checked":""}> <span>${miEsc(_gl(s.label,s.en))}</span></label>`).join("");
  ov.innerHTML=`<div class="ic-box"><div class="ic-head"><h3>${miEsc(opts.title||_gl("Co uwzględnić?","What to include?"))}</h3>`+
    `<div class="ic-sub">${miEsc(_gl("Zaznacz sekcje do zapisania w tym pliku.","Pick the sections to store in this file."))}</div></div>`+
    `<div class="ic-tools"><button type="button" id="icAll">${miEsc(_gl("Zaznacz wszystko","Select all"))}</button>`+
    `<button type="button" id="icNone">${miEsc(_gl("Odznacz wszystko","Clear all"))}</button></div>`+
    `<div class="ic-list">${rows}</div>`+
    `<div class="ic-act"><button class="btn" id="icCancel">${miEsc(_gl("Anuluj","Cancel"))}</button>`+
    `<button class="btn primary" id="icGo">${miEsc(opts.okLabel||_gl("Dalej","Continue"))}</button></div></div>`;
  document.body.appendChild(ov);
  const boxes=()=>[...ov.querySelectorAll('input[data-k]')];
  const sync=()=>boxes().forEach(b=>b.closest('.ic-row').classList.toggle('off',!b.checked));
  const close=()=>{document.removeEventListener("keydown",onKey); if(window.rfmClose) window.rfmClose(ov,()=>ov.remove()); else ov.remove();};
  const onKey=e=>{if(e.key==="Escape")close();};
  ov.addEventListener("click",e=>{if(e.target===ov)close();});
  boxes().forEach(b=>b.addEventListener('change',sync));
  sync();   // a preselected row that starts unticked has to LOOK unticked from the first frame
  document.addEventListener("keydown",onKey);
  document.getElementById("icAll").onclick=()=>{boxes().forEach(b=>b.checked=true);sync();};
  document.getElementById("icNone").onclick=()=>{boxes().forEach(b=>b.checked=false);sync();};
  document.getElementById("icCancel").onclick=close;
  document.getElementById("icGo").onclick=()=>{const sel=new Set(boxes().filter(b=>b.checked).map(b=>b.dataset.k));
    if(!sel.size){setupFlash(_gl("Nic nie zaznaczono","Nothing selected"));return;}close();opts.onConfirm(sel);};
}
function setupFlash(t){const e=document.getElementById("setupMsg");if(!e)return;e.textContent=t;
  clearTimeout(e._t);e._t=setTimeout(()=>{e.textContent="";},3000);}
// ===== sharing metadata that travels WITH the file =====
//  Name, program and description say what a setup IS. These three say whose it is and where it
//  came from: without them every fix is a new thread and nobody can tell which post is current.
//  `basedOn` is filled by the importer (see _rfLineageSave), not typed by hand — the app knows.
function rfShareMeta(){
  const v=id=>{const e=document.getElementById(id);return e?(e.value||"").trim():"";};
  let rev=parseInt(v("setupRev"),10); if(!(rev>=1))rev=1;
  const m={author:v("setupAuthor").slice(0,60),rev:Math.min(999,rev)};
  const lin=rfLineage();
  if(lin)m.basedOn=lin.url?{name:lin.name,author:lin.author,rev:lin.rev,url:lin.url}
                          :{name:lin.name,author:lin.author,rev:lin.rev};
  return m;
}
function rfLineage(){   // the set this configuration was imported from, or null
  let l=null; try{l=JSON.parse(localStorage.getItem("ribbitflip.lineage")||"null");}catch(e){}
  return (l&&(l.name||l.author))?l:null;
}
function rfLineageClear(){try{localStorage.removeItem("ribbitflip.lineage");}catch(e){}}
// Nazwa pliku eksportu. \w gubi polskie litery („przeróbka" → „przerbka"), a plik ląduje potem
// jako załącznik na forum, gdzie tę nazwę widać — bierzemy więc dowolne litery i cyfry Unicode.
function rfSetupFileBase(name){
  return (String(name||"").replace(/[^\p{L}\p{N}\- ]+/gu,"").trim())||_gl("zestaw","setup");
}
// ===== SAFETY NET BEFORE A DESTRUCTIVE IMPORT =====
//  Importing replaces every group at once. There is an "Undo import" toast, but it lasts 25 seconds
//  and holds exactly one step back — no help at all to someone who spent an evening tuning an axis
//  and only notices two days later. So the import preview offers to put the CURRENT configuration
//  into the library first, under its own name, where it stays until deleted.
//  Never overwrites: a colliding name gets a numeric suffix, because the whole point is not losing
//  something, and silently replacing a saved setup would be exactly that.
function _rfBackupName(base,taken){
  let n=base,i=2;
  while(taken.indexOf(n)>=0){n=base+" ("+i+")";i++;}
  return n;
}
// Dashes, not dots and colons: the server's name sanitizer keeps letters, digits, space, _ - ( )
// and drops everything else, so "22.08 19:18" landed on disk as "2208 1918" — a stamp nobody can
// read, and a name that no longer matched what the field had shown.
function rfBackupStamp(){
  const d=new Date(),p=x=>String(x).padStart(2,"0");
  return _gl("Przed importem ","Before import ")+p(d.getDate())+"-"+p(d.getMonth()+1)+" "+
         p(d.getHours())+"-"+p(d.getMinutes());
}
async function rfBackupCurrent(name){
  let taken=[];
  try{const m=await fetch("/setups").then(r=>r.json());taken=m.setups||[];}catch(e){}
  const fin=_rfBackupName((String(name||"").trim())||rfBackupStamp(),taken);
  const inc=[];RF_SETUP_SECTIONS.forEach(s=>{if(s.cfg)s.cfg.forEach(k=>inc.push(k));});   // backup = everything
  const body={name:fin,forApp:(document.getElementById("setupFor")||{}).value||"",
    // Kopia zapasowa bierze WSZYSTKO — łącznie z przypisaniem do gry. Gdyby je gubiła, cofnięcie
    // importu oddawałoby konfigurację, ale zestaw przestałby wczytywać się sam.
    exe:(document.getElementById("setupExe")||{}).value||"",
    description:_gl("Kopia zapasowa zrobiona przed importem.","Backup taken before an import."),
    include:inc,pad:padStateIfLoaded(),...rfShareMeta()};   // bez wczytanego Syntha: bez `pad` (rf-20)
  try{
    const res=await fetch("/setup/save",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body)}).then(r=>r.json());
    return res&&res.ok?(res.name||fin):null;
  }catch(e){return null;}
}
// `sel` (a Set of section keys) SKIPS the picker and exports exactly that scope. The share wizard
// asks the scope question in its own first step, where it stands next to the name and the tags —
// so raising the same window on top of the wizard asked it twice, and the second answer silently
// won. Called with nothing (the setup card, the exchange window) it behaves as it always did.
function setupExport(sel){
  const run=function(sel){
  fetch("/setup").then(r=>r.json()).then(env=>{
    const nm=(document.getElementById("setupName").value||"").trim();
    const fr=(document.getElementById("setupFor").value||"").trim();
    const ds=(document.getElementById("setupDesc").value||"").trim();
    if(nm)env.name=nm; if(fr)env.forApp=fr; if(ds)env.description=ds;
    // Instrukcja użytkowania — tą samą drogą co opis i z tego samego powodu: `GET /setup`
    // nie zna zawartości pól paska. Wysyłamy tekst, a serwer i tak przepuszcza go przez
    // sanityzator przy wczytaniu; tu dzielimy po liniach, żeby plik od razu miał listę.
    {const hw=((document.getElementById("setupHowto")||{}).value||"").trim();
     if(hw)env.howto=hw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,8);}
    // Przypisanie do gry jedzie razem z plikiem: kto go dostanie, dostaje też auto-wczytywanie,
    // bez przepisywania nazwy procesu z opisu na forum. GET /setup nie zna zawartości pola (nie
    // ma nazwy zestawu, po której mógłby ją odczytać), więc bierzemy ją z paska — jak nazwę i opis.
    {const ex=((document.getElementById("setupExe")||{}).value||"").trim(); if(ex)env.exe=ex;}
    // Kaseta wybrana w pasku zapisu albo w kreatorze posta (rf-28e). `GET /setup` zawsze daje
    // domyślną, bo nie zna pola paska — tak samo jak z nazwą i opisem.
    if(typeof rfKasetaWybrana==="function")env.cassette=rfKasetaWybrana().id;
    const meta=rfShareMeta();
    if(meta.author)env.author=meta.author;
    env.rev=meta.rev;
    if(meta.basedOn)env.basedOn=meta.basedOn;
    env.exportedAt=Math.round(state.nowTs)+"s";
    // XY-pad instruments (all play pads + effects pads + custom sounds). Without the Synth loaded
    // in this tab there is nothing to export, and an empty section would wipe the importer's pads.
    if(sel.has("pad")){const p=padStateIfLoaded();if(p)env.pad=p;}
    if(env.config&&typeof env.config==="object"){const keep=_rfCfgKeep(sel);Object.keys(env.config).forEach(k=>{if(!keep.has(k))delete env.config[k];});}
    env.included=[...sel];
    const base=rfSetupFileBase(env.name);
    const blob=new Blob([JSON.stringify(env,null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="ribbitflip-setup-"+base+".json";document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    setupFlash(_gl("Wyeksportowano zestaw do pliku","Exported setup to file"));
  }).catch(()=>setupFlash(_gl("Błąd eksportu","Export error")));
  };
  if(sel&&typeof sel.has==="function"&&sel.size){run(sel);return;}
  rfIncludeModal({title:_gl("Eksport zestawu: co uwzględnić?","Export setup: what to include?"),okLabel:_gl("Eksportuj","Export"),onConfirm:run});
}
// --- IMPORT SECURITY PREVIEW -----------------------------------------
//  Import from file is NOT applied immediately. First /…/analyze (server classifies
//  safe/risky rules, changes NOTHING), we show a preview, the user chooses:
//   • "Load safe only" (mode=safe — skips macros/Windows key),
//   • "I understand the risk — load everything" (mode=advanced, informed consent).
//  Labels/descriptions from the foreign file are rendered via miEsc (anti-XSS in the dashboard,
//  which is same-origin with the server controlling the keyboard).
function _tsStyleOnce(){/* no-op: styles live in /web/css/13-dialogs-overview.css */}
function rfSafetyModal(opts){
  _tsStyleOnce();
  const a=opts.analysis||{};
  // `motion` jedzie do sekcji także dla zestawu JEDNOKAPSLOWEGO, gdzie „urządzeń" nie ma wcale:
  // strojenie ruchu jest tam dokładnie tak samo połową zestawu, co w paczce (patrz rf-28b).
  const sections=Array.isArray(a.devices)?a.devices:[{devName:null,rules:a.rules||[],motion:a.motion}];
  // ILE TU JEST REGUŁ — liczone tak, żeby paczka na kilka kapsli nie mówiła „0 · 0" nad listą
  // własnych reguł. `analyze_config` (jeden zestaw) daje `ruleCount`/`safeCount`/`riskyCount` na
  // wierzchu, ale `analyze_bundle` trzyma je PER KAPSEL w `devices[]`, a na wierzch wystawia samo
  // `riskyCount`. Nagłówek czytał więc `a.safeCount` → undefined, `a.ruleCount` → undefined, i przy
  // jednej bezpiecznej regule wypisywał „0 bezpiecznych reguł · 0 ryzykownych" DOKŁADNIE nad tą
  // regułą wypisaną niżej. Sumujemy więc po kapslach, gdy wierzch milczy.
  const _cnt=(k)=>{
    if(a[k]!=null)return a[k]|0;
    if(!Array.isArray(a.devices))return 0;
    return a.devices.reduce((s,d)=>s+(((d&&d[k])|0)||0),0);
  };
  const risky=_cnt("riskyCount");
  const safe=(a.safeCount!=null||Array.isArray(a.devices))
    ? (a.safeCount!=null?(a.safeCount|0):a.devices.reduce((s,d)=>s+((d&&d.safeCount!=null)
        ?(d.safeCount|0):(((d&&d.ruleCount)|0)-((d&&d.riskyCount)|0))),0))
    : ((a.ruleCount||0)-risky);
  const old=document.getElementById("rfSafe");if(old)old.remove();
  const ov=document.createElement("div");ov.id="rfSafe";
  const rows=[];
  sections.forEach(sec=>{
    // ROLA + STEROWANIE RUCHEM zamiast samej nazwy kapsla z cudzej maszyny (rf-28b). Stara linijka
    // zostaje jako zapas: build bez rf-28b ma stracić opis, nie nagłówek sekcji.
    const head=(typeof rfRoleHeadHtml==="function")?rfRoleHeadHtml(sec):"";
    if(head)rows.push(head);
    else if(sec.devName)rows.push(`<div class="ts-dev">🎮 ${miEsc(sec.devName)}</div>`);
    // KAPSEL BEZ ANI JEDNEJ REGUŁY to często DECYZJA autora, nie brak (prawy kapsel Isaaca nie ma
    // reguły przycisku, bo przycisk otwiera koło i reguła strzelałaby razem z nim). Powiedziane
    // wprost, bo sama rola nad pustym miejscem wygląda jak plik, z którego coś wypadło.
    if(head&&!(sec.rules||[]).length)
      rows.push(`<div class="ts-norule">${_gl("Bez reguł przycisku, ten kapsel prowadzi sam ruch.","No button rules, this capsule only drives the motion.")}</div>`);
    (sec.rules||[]).forEach(r=>{
      const bad=r.level==="risky";
      // REGUŁA WYŁĄCZONA — wariant, który autor położył gotowy, ale zostawił na drugim włączniku.
      // Bez tej plakietki wyglądała w podglądzie jak każda inna, czyli obiecywała sterowanie,
      // którego po wczytaniu nie ma. Znacznik `off` przygasza wiersz; słowo mówi, co z tym zrobić.
      const off=(r.enabled===false);
      rows.push(`<div class="ts-row ${bad?'bad':'ok'}${off?' off':''}"><span class="ts-ic">${bad?'⚠️':'✅'}</span>`+
        `<div class="ts-mid"><div class="ts-lbl">${miEsc(r.label||'reguła')}`+
        (off?`<span class="ts-off">${_gl("wyłączona","switched off")}</span>`:'')+`</div>`+
        `<div class="ts-desc">${miEsc(r.desc||'')}</div>`+
        ((bad&&r.reasons&&r.reasons.length)?`<div class="ts-why">${r.reasons.map(miEsc).join(' · ')}</div>`:'')+
        `</div></div>`);
    });
  });
  const warn=risky>0
    ? `<div class="ts-warn ts-warn-big"><span class="ts-dfrog" role="img" aria-label="uwaga"></span><div class="ts-warn-txt">${_gl("<b>⚠️ Ten plik zawiera makra / klawisze systemowe.</b><br>Makra wykonują <b>realne operacje na Twoim komputerze</b>: mogą naciskać klawisze, wpisywać komendy, otwierać programy, a nawet zamykać okna. Uruchamianie makr z <b>nieznanego lub niezaufanego źródła może być ryzykowne</b>. To zwykły plik JSON, ale jego działanie <b>nie jest niewinne</b>. Jeśli nie masz pewności co do źródła, wczytaj <b>tylko bezpieczne</b> reguły (same klawisze do gry).","<b>⚠️ This file contains macros / system keys.</b><br>Macros perform <b>real operations on your computer</b>: they can press keys, type commands, open programs, and even close windows. Running macros from an <b>unknown or untrusted source can be risky</b>. This is plain JSON, but its behaviour is <b>not innocent</b>. If you are unsure about the source, load <b>only the safe</b> rules (game keys only).")}</div></div>`
    : `<div class="ts-ok">${_gl("✅ Same klawisze do gry, nic ryzykownego. Bezpieczne do wczytania.","✅ Game keys only, nothing risky. Safe to load.")}</div>`;
  // Safety first, then "will it work here" — two different questions, asked in that order.
  // The dependency box is silent when the set needs nothing from outside the app.
  const req=(typeof rfRequiresHtml==="function")?rfRequiresHtml(a.requires):"";
  const compat=(typeof rfCompatHtml==="function")?rfCompatHtml(a.compat):"";
  // …i co z tego pliku w tym uruchomieniu nie zadziała, bo moduł wyłączono przy starcie (rf-28b).
  const modsOff=(typeof rfModsOffSetupHtml==="function")?rfModsOffSetupHtml(a.modulesOff):"";
  // …i dopiero wtedy słowa AUTORA: czym ten zestaw jest i jak go użyć (rf-28b). Po bezpieczeństwie,
  // bo kolejność pytań jest stała („czy to bezpieczne" → „czy tu zadziała" → „co to właściwie
  // jest"), ale NAD listą reguł: opis ma wyjaśniać listę, a nie stać pod nią jako dopisek.
  // Import ZESTAWU (z pliku, z forum, z Biblioteki) podaje `opts.cassette`: wtedy obok słów autora stoi
  // jego kaseta (rf-28e). Import presetu wyzwalaczy kasety nie ma i dostaje sam opis, jak dotąd.
  const about=(opts.cassette!=null&&typeof rfKasetaAboutHtml==="function")?rfKasetaAboutHtml(a,opts.cassette)
             :(typeof rfSetupAboutHtml==="function")?rfSetupAboutHtml(a):"";
  // The backup is no longer a question. It used to be a ticked checkbox with an editable name, which
  // asked the reader to decide something they had no way to judge yet — and every "no" answer was a
  // configuration lost for good. It just happens now, and this line only says WHERE it lands, so the
  // way back is findable. `backupLabel` lets a caller replace the whole sentence (a trigger import
  // saves a trigger preset, not a configuration); the name is already inside it.
  const bkTxt=opts.backupName
    ? (opts.backupLabel||(_gl("Obecną konfigurację najpierw zapiszę w Bibliotece jako „","I will first save your current configuration to the Library as “")+
        opts.backupName+_gl("”, żeby dało się wrócić.","”, so you can go back.")))
    : "";
  // Z CZEGO SKŁADA SIĘ TEN ZESTAW — nazwami, a nie sekcjami. Do 2026-08-31 podgląd wymieniał
  // „wyzwalacze · sterowanie ruchem · osie 3D", czyli mówił, co się ZMIENI, a nie CZYM to jest —
  // i milczał o tym, że kapsel zaraz zacznie nosić nazwy z CUDZEJ biblioteki. Człowiek widział
  // je dopiero po imporcie, jako trzy wiersze „tej konfiguracji nie ma już na liście".
  const items=rfSetupItemsHtml(a);
  // CO AUTOR MIAŁ WŁĄCZONE + pole „Włącz od razu po wczytaniu" (rf-29e). Stoi POD składem zestawu
  // i NAD kopią zapasową: najpierw co to jest, potem co będzie działać, na końcu co się stanie
  // z tym, co mam. Pusta ramka, gdy plik nie ma nic włączonego. Odpowiedź z pola wędruje do
  // `apply` jako TRZECI argument, obok zgody na dopisanie presetów.
  const armBox=(typeof rfArmBoxHtml==="function")?rfArmBoxHtml(a):"";
  // Liczebnik z rejestru rodzajów (rf-49 `rfPl`) — ta sama funkcja, którą liczy reszta panelu.
  // `typeof` na wypadek builda bez rejestru: zdanie ma wtedy wyjść uboższe, nie zniknąć.
  const _pl=(n,f1,f2,f5,e1,e2)=>(typeof rfPl==="function")?rfPl(n,f1,f2,f5,e1,e2)
                                                          :((n===1)?f1:f5);
  const sumTxt=safe+" "+_pl(safe,"bezpieczna reguła","bezpieczne reguły","bezpiecznych reguł","safe rule","safe rules")+
    " · "+risky+" "+_pl(risky,"ryzykowna","ryzykowne","ryzykownych","risky","risky");
  // PRZYCISK MA MÓWIĆ, CO ZROBI. Do 13.09 pisało tu „Wczytaj" ZAWSZE — także wtedy, gdy po tym
  // oknie szło jeszcze jedno (paczka na kilka kapsli pyta o role, a od dziś każde wczytanie pyta
  // o niezapisane zmiany). Kliknięcie „Wczytaj" nie wczytywało więc niczego, tylko otwierało
  // kolejne okno: preset nie był wczytany, a tylko zapowiadano, że tak się stanie.
  // `opts.nextStep` = „po mnie idzie jeszcze jeden
  // krok" — wtedy przycisk nazywa się „Dalej" i nie obiecuje niczego, czego sam nie zrobi.
  const _next=!!opts.nextStep;
  const _lblGo=_next?_gl("Dalej","Continue"):_gl("Wczytaj","Load");
  const _lblSafe=_next?_gl("Dalej tylko z bezpiecznymi","Continue with the safe ones only")
                      :_gl("Wczytaj tylko bezpieczne","Load safe only");
  const _lblAdv=_next?_gl("⚠️ Rozumiem ryzyko, dalej ze wszystkim","⚠️ I accept the risk, continue with everything")
                     :_gl("⚠️ Rozumiem ryzyko, wczytaj wszystko","⚠️ I accept the risk, load everything");
  ov.innerHTML=`<div class="ts-box"><div class="ts-head"><h3>${miEsc(opts.title||'Import zestawu')}</h3>`+
    `<span class="ts-sum">${miEsc(sumTxt)}</span></div>${warn}${compat}${req}${modsOff}`+
    // JEDEN OBSZAR PRZEWIJANIA na całą treść, zamiast przewijania osobno w każdym bloku. Do 13.09
    // jedyną rzeczą, która się kurczyła, była lista reguł — więc dołożenie opisu i instrukcji
    // zostawiło jej 11 px z 295 px treści. Dwa osobne paski przewijania w jednym oknie czyta się
    // jeszcze gorzej, bo czytelnik nie wie, który z nich ma ruszyć.
    // Poza przewijaniem zostają trzy rzeczy i każda z powodu: ostrzeżenie o makrach (ma być widoczne
    // przez cały czas, a nie do przewinięcia), zgoda „wiem, co robię" i przyciski.
    `<div class="ts-scroll">${about}`+
    `<div class="ts-list">${rows.join('')||'<div class="ts-empty">Brak reguł w tym pliku.</div>'}</div>`+
    items+armBox+
    (bkTxt?`<div class="ts-keepinfo"><span class="bic bic-save" aria-hidden="true"></span><span>${miEsc(bkTxt)}</span></div>`:'')+
    `</div>`+
    (risky>0?`<label class="ts-ack"><input type="checkbox" id="tsAck"> ${_gl("Wiem, co robię: ufam źródłu tego pliku","I know what I am doing: I trust the source of this file")}</label>`:'')+
    `<div class="ts-act"><button class="btn" id="tsCancel">${_gl("Anuluj","Cancel")}</button>`+
    `<button class="btn primary" id="tsSafe"><span class="bic bic-checks" aria-hidden="true"></span>${risky>0?_lblSafe:_lblGo}</button>`+
    (risky>0?`<button class="btn ts-danger" id="tsAdv" disabled>${_lblAdv}</button>`:'')+
    `</div></div>`;
  document.body.appendChild(ov);
  const close=()=>{document.removeEventListener("keydown",onKey); if(window.rfmClose) window.rfmClose(ov,()=>ov.remove()); else ov.remove();};
  const onKey=e=>{if(e.key==="Escape")close();};
  ov.addEventListener("click",e=>{if(e.target===ov)close();});
  document.addEventListener("keydown",onKey);
  document.getElementById("tsCancel").onclick=close;
  // „Dopisz te presety do biblioteki" — odpowiedź wędruje do `apply` jako drugi argument, żeby
  // wywołujący (setupImport) mógł ją wysłać razem z importem. Domyślnie ZAZNACZONE: człowiek, który
  // bierze cudzy zestaw, prawie zawsze chce mieć też jego części — a odznaczyć da się jednym kliknięciem.
  const adopt=()=>{const c=document.getElementById("tsAdopt");return !c||c.checked;};
  // Pole czytane PRZED close(): zamknięcie zdejmuje okno razem z polem. Odpowiedź jest zapamiętywana
  // (rfArmTakeChoice), więc następny import i Biblioteka zaczynają od niej.
  const arm=()=>(typeof rfArmTakeChoice==="function")?rfArmTakeChoice():false;
  document.getElementById("tsSafe").onclick=()=>{const A=adopt(),R=arm();close();opts.apply("safe",A,R);};
  const adv=document.getElementById("tsAdv"), ack=document.getElementById("tsAck");
  if(ack&&adv)ack.onchange=()=>{adv.disabled=!ack.checked;};
  if(adv)adv.onclick=()=>{if(adv.disabled)return;const A=adopt(),R=arm();close();opts.apply("advanced",A,R);};
}

// Z CZEGO SKŁADA SIĘ ZESTAW — sekcja podglądu importu. Pusta (dosłownie pusty napis), gdy plik nie
// niesie ANI JEDNEJ nazwanej konfiguracji: zestaw ułożony ręcznie i nigdy niezapisany pod nazwami
// jest zupełnie normalny, a nagłówek nad pustą listą czytałby się jak brakujące dane.
//
// Trzy stany, każdy znaczy co innego dla człowieka i każdy jest tu powiedziany wprost:
//   nowy    — takiej nazwy nie masz, dopiszę ją,
//   masz    — masz ją i jest identyczna, nie ma czego dopisywać,
//   zajęte  — masz TĘ NAZWĘ z inną treścią; plik wejdzie jako „… (2)", a kapsel dostanie tę nową
//             nazwę (inaczej nosiłby cudzą etykietę nad Twoją konfiguracją).
function rfSetupItemsHtml(a){
  const ad=(a&&a.adoptable&&typeof a.adoptable==="object")?a.adoptable:{};
  const keys=Object.keys(ad);
  if(!keys.length)return "";
  const MOD={trig:["Mapowanie","Mapping"],mouse:["Mysz","Mouse"],
             midi:["MIDI i OSC","MIDI and OSC"],pose:["Osie 3D","3D axes"],
             // Skaner doszedł do zestawów 2026-09-13 — bez wpisu tutaj lista „z czego to jest
             // złożone" pokazywałaby surowy klucz `scan` zamiast nazwy modułu.
             scan:["Skaner","Scanner"]};
  const ST={new:["nowy","new"],same:["już masz","already yours"],
            taken:["nazwa zajęta — wejdzie jako kopia","name taken — arrives as a copy"]};
  const rows=keys.map(k=>{
    const it=ad[k], m=MOD[k]||[k,k], st=ST[it.state]||ST.new;
    return `<div class="ts-item"><span class="ts-item-m">${miEsc(_gl(m[0],m[1]))}</span>`+
      `<span class="ts-item-n">${miEsc(it.name)}</span>`+
      `<span class="ts-item-s is-${miEsc(it.state)}">${miEsc(_gl(st[0],st[1]))}</span></div>`;
  }).join("");
  const anyNew=keys.some(k=>ad[k].state!=="same");
  return `<div class="ts-items"><div class="ts-items-h">${_gl("Z czego składa się ten zestaw","What this setup is made of")}</div>${rows}`+
    (anyNew?`<label class="ts-ack ts-adopt"><input type="checkbox" id="tsAdopt" checked> `+
      _gl("Dopisz te presety do mojej biblioteki (nic nie nadpiszę)",
          "Add these presets to my library (nothing gets overwritten)")+`</label>`:"")+
    `</div>`;
}
