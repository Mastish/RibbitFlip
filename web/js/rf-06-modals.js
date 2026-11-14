"use strict";
// ===== in-theme dialogs and toasts (replacing native confirm/alert) =====
// rfModal -> Promise resolving to the chosen action's value. rfConfirm -> Promise(bool).
// rfModal with `input:{label,value,placeholder,maxLength}` ASKS FOR A NAME and resolves to the
// typed text instead, or to null when cancelled (Escape, the backdrop, or a cancel action). One
// dialog rather than a private clone per module: naming a thing is the same act everywhere, and
// the primary button stays disabled while the field is blank, so "" can never come back.
// rfAlert / rfToast / rfSkullSay -> notifications. rfRestartOverlay -> blocking restart screen.
// Text is authored in Polish and translated on the fly by applyLang (exact-match dictionary),
// which is why every dialog calls applyLang on its own subtree right after it is built.
(function(){
  let _openCard=null;
  function _close(back,val,resolve){
    if(back._done)return; back._done=true;
    back.style.animation="rfm-fade .16s ease reverse both";
    const card=back.querySelector(".rfm-card"); if(card)card.style.animation="rfm-pop .16s ease reverse both";
    setTimeout(()=>{try{back.remove();}catch(e){} if(_openCard===back)_openCard=null; document.removeEventListener("keydown",back._onKey,true);
      // DLACZEGO: dialog zabiera fokus, wiec musi go ODDAC tam, skad przyszedl — inaczej po Escape
      // uzytkownik klawiatury laduje na poczatku dokumentu i tabuje od nowa. Warunek na
      // activeElement chroni przypadek, w ktorym zamkniecie otworzylo kolejny dialog albo edytor
      // i to ON ustawil juz fokus — wtedy nie odbieramy mu go.
      // WHY: a dialog that takes focus must give it back, unless something else already claimed it.
      const p=back._prev;
      if(p&&p.isConnected&&p.focus&&(document.activeElement===document.body||!document.activeElement)){try{p.focus();}catch(e){}}
    },150);
    resolve(val);
  }
  window.rfModal=function(o){
    o=o||{};
    return new Promise(resolve=>{
      const back=document.createElement("div"); back.className="rfm-backdrop"; back.setAttribute("role","presentation");
      const tone=o.tone?(" "+o.tone):"";
      const acts=(o.actions&&o.actions.length?o.actions:[{label:"OK",value:true,variant:"primary"}]);
      const card=document.createElement("div"); card.className="rfm-card"+tone;
      card.setAttribute("role","dialog"); card.setAttribute("aria-modal","true"); card.setAttribute("aria-label",o.title||"Komunikat");
      const ic=document.createElement("div"); ic.className="rfm-ic"; ic.setAttribute("aria-hidden","true");
      if(o.icon&&o.icon[0]==="<")ic.innerHTML=o.icon; else ic.textContent=o.icon||"❓";   // HTML icon (e.g. bin.png) or emoji
      card.appendChild(ic);
      if(o.title){const h=document.createElement("h3");h.className="rfm-title";h.textContent=o.title;card.appendChild(h);}
      if(o.message){const p=document.createElement("p");p.className="rfm-msg";p.textContent=o.message;card.appendChild(p);}
      let inp=null;
      if(o.input){
        const row=document.createElement("label"); row.className="rfm-inrow";
        if(o.input.label){const sp=document.createElement("span");sp.className="rfm-inlbl";sp.textContent=o.input.label;row.appendChild(sp);}
        inp=document.createElement("input"); inp.type="text"; inp.className="rfm-in";
        inp.value=o.input.value||""; inp.placeholder=o.input.placeholder||"";
        inp.maxLength=o.input.maxLength||60; inp.spellcheck=false;
        if(!o.input.label)inp.setAttribute("aria-label",o.title||"Nazwa");
        row.appendChild(inp); card.appendChild(row);
      }
      // DRUGIE POLE — WIELOLINIJKOWY OPIS, obok nazwy. Dołożone dla huba konfiguracji (rf-49i):
      // nazwa mówi „Triki 2", a dopiero opis mówi „Wolfenstein: kamera i strzelanie", i to on
      // odróżnia dwa kafle w bibliotece. Dodatek jest w pełni opcjonalny — bez `o.textarea` ten
      // dialog zachowuje się co do znaku tak, jak przedtem, więc żaden istniejący wołający tego
      // nie zauważy. Z nim odpowiedzią jest {name, desc}, bo dwa pola nie mieszczą się w jednym
      // stringu, a null nadal znaczy „anulowano" i nie da się go pomylić z pustym opisem.
      let ta=null;
      if(o.textarea){
        const row2=document.createElement("label"); row2.className="rfm-inrow";
        if(o.textarea.label){const sp=document.createElement("span");sp.className="rfm-inlbl";sp.textContent=o.textarea.label;row2.appendChild(sp);}
        ta=document.createElement("textarea"); ta.className="rfm-in rfm-ta"; ta.rows=o.textarea.rows||3;
        ta.value=o.textarea.value||""; ta.placeholder=o.textarea.placeholder||"";
        ta.maxLength=o.textarea.maxLength||200; ta.spellcheck=false;
        if(!o.textarea.label)ta.setAttribute("aria-label",o.title||"Opis");
        row2.appendChild(ta); card.appendChild(row2);
      }
      // With a field, the answer IS the typed text — a caller asking for a name has no use for
      // `true`. Cancelling (button, Escape, backdrop) says null, which is a different answer from
      // an empty name and cannot be mistaken for one.
      const done=inp?(v=>resolve((v===false||v==null)?null
        :(ta?{name:String(inp.value||"").trim(),desc:String(ta.value||"").trim()}
            :String(inp.value||"").trim()))):resolve;
      const bar=document.createElement("div"); bar.className="rfm-actions";
      const cancelVal=(acts.find(a=>a.value===false)||acts[0]).value;
      acts.forEach(a=>{const b=document.createElement("button");b.type="button";
        b.className="rfm-btn "+(a.variant||"ghost");b.textContent=a.label;
        b.addEventListener("click",()=>_close(back,a.value,done));bar.appendChild(b);});
      card.appendChild(bar); back.appendChild(card);
      back.addEventListener("mousedown",e=>{if(e.target===back)_close(back,cancelVal,done);});
      back._onKey=function(e){
        if(e.key==="Escape"){e.preventDefault();e.stopPropagation();_close(back,cancelVal,done);}
        // PULAPKA FOKUSA (wzorzec _ra5Modal w rf-39-rest-e5.js): okno modalne przykrywa panel, wiec
        // Tab nie moze z niego wyjsc w tlo, ktorego i tak nie widac. Liste liczymy przy KAZDYM Tab,
        // bo przycisk glowny bywa wyszarzony przy pustej nazwie i ma byc wtedy pomijany.
        // WHY: a modal covers the panel, so Tab must cycle inside it; the list is rebuilt on every
        // Tab because the primary button is disabled while the name field is blank.
        else if(e.key==="Tab"){
          const f=card.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex="0"]');
          if(!f.length)return;
          const first=f[0],last=f[f.length-1],a=document.activeElement;
          if(!card.contains(a)){e.preventDefault();first.focus();}
          else if(e.shiftKey&&a===first){e.preventDefault();last.focus();}
          else if(!e.shiftKey&&a===last){e.preventDefault();first.focus();}
        }
        // Enter zatwierdza — poza polem wielolinijkowym, gdzie ma robić to, co robi wszędzie:
        // nową linię. Opis bywa dwuzdaniowy, a dialog, który zapisuje się w połowie zdania, uczy,
        // że w tym polu nie wolno nacisnąć Enter.
        else if(e.key==="Enter"&&!(ta&&e.target===ta)){const prim=bar.querySelector(".primary,.danger")||bar.lastChild;if(prim&&!prim.disabled){e.preventDefault();prim.click();}}
      };
      document.addEventListener("keydown",back._onKey,true);
      back._prev=document.activeElement;   // kto otworzyl dialog — do niego wraca fokus po zamknieciu
      document.body.appendChild(back); _openCard=back;
      try{if(typeof applyLang==="function")applyLang(back);}catch(e){}   // translate before paint — no PL flash
      const focusBtn=bar.querySelector(".primary,.danger")||bar.lastChild;
      if(inp&&focusBtn){
        // A button that would save a nameless thing is worse than no button: it teaches that the
        // field is optional. Greyed out while it is blank, it teaches the opposite in one glance.
        const gate=()=>{focusBtn.disabled=!String(inp.value||"").trim();};
        inp.addEventListener("input",gate); gate();
      }
      if(inp)setTimeout(()=>{try{inp.focus();inp.select();}catch(e){}},30);
      else if(focusBtn)setTimeout(()=>focusBtn.focus(),30);
    });
  };
  window.rfConfirm=function(message,opt){opt=opt||{};
    return window.rfModal({message,title:opt.title||"Potwierdź",icon:opt.icon||"❓",tone:opt.tone||"",
      actions:[{label:opt.cancelLabel||"Anuluj",value:false,variant:"ghost"},
               {label:opt.confirmLabel||"Potwierdź",value:true,variant:opt.tone==="danger"?"danger":"primary"}]});};
  window.rfAlert=function(message,opt){opt=opt||{};
    return window.rfModal({message,title:opt.title||"Uwaga",icon:opt.icon||'<span class="rfic info-ic" aria-hidden="true"></span>',tone:opt.tone||"",
      actions:[{label:opt.okLabel||"OK",value:true,variant:"primary"}]});};
  // rfToast — kept as the name every caller already uses, but there is no top-right toast any more.
  // Those stacked over the menu bar, so a sentence about one thing covered a control you might be
  // reaching for. Everything the app has to say now comes out of the skull's mouth in the
  // bottom-left corner (rfSkullNote below), which is the one corner nothing else occupies — the tip
  // jar's mug has the other. One voice, one place, whatever the news is.
  // The `icon` option is dropped on purpose: the skull IS the icon.
  window.rfToast=function(message,opt){opt=opt||{};
    return window.rfSkullNote(message,{tone:opt.tone,ms:opt.ms,action:opt.action,keys:opt.keys});
  };
  // A key combination in a note is drawn as KEYCAPS on a line of its own, centred — the same caps
  // the emergency-stop card shows (.hk-key), so both places teach the same shape. "Alt + R + F"
  // buried in a sentence reads like configuration; a row of keycaps reads like an instruction, and
  // this particular note exists to be obeyed in a hurry, with a game on top.
  // `keys` arrives as an array of finished LABELS (["Alt","R","F"]) rather than as the server's
  // token string: which key is called what is the hotkey module's business (rf-39j), not the
  // dialog library's.
  function _keysRow(keys){
    const row=document.createElement("div"); row.className="rss-keys"; row.setAttribute("aria-hidden","true");
    keys.forEach((k,i)=>{
      if(i){const p=document.createElement("span");p.className="hk-plus";p.textContent="+";row.appendChild(p);}
      const kb=document.createElement("kbd"); kb.className="hk-key"; kb.textContent=k; row.appendChild(kb);
    });
    return row;
  }
  // rfSkullSay: "the skull speaks" popup, centred (no backdrop, singleton, auto-dismiss) — an answer
  // to what you just did, and it wants to be in the way. News that just happened by itself is not an
  // answer: that goes to rfSkullNote, which stacks in the bottom-left corner and never covers this.
  window.rfSkullSay=function(message,opt){opt=opt||{};
    let old=document.getElementById("rfSkullSay"); if(old){try{old.remove();}catch(e){}}
    const ov=document.createElement("div"); ov.id="rfSkullSay";
    const wrap=document.createElement("div"); wrap.className="rss-wrap";
    const skull=document.createElement("div"); skull.className="rss-skull"; skull.setAttribute("aria-hidden","true");
    const bubble=document.createElement("div"); bubble.className="rss-bubble"+(opt.tone?(" "+opt.tone):"");
    // Assertive by default: this one is the answer to something you just did, so a screen reader
    // should say it now. (opt.polite is there for a caller that knows better.)
    bubble.setAttribute("role",opt.polite?"status":"alert");
    bubble.setAttribute("aria-live",opt.polite?"polite":"assertive"); bubble.textContent=message;
    // Optional action button inside the bubble (the "undo the import" case). It has to live here
    // rather than in a toast, because there are no toasts any more.
    if(opt.action&&opt.action.label){
      const ab=document.createElement("button"); ab.className="btn xs rss-act"; ab.type="button";
      ab.textContent=opt.action.label;
      ab.addEventListener("pointerdown",e=>e.stopPropagation());   // the whole popup dismisses on pointerdown
      ab.addEventListener("click",()=>{ try{opt.action.onClick&&opt.action.onClick();}catch(e){} kill(); });
      bubble.appendChild(ab);
    }
    wrap.appendChild(skull); wrap.appendChild(bubble); ov.appendChild(wrap);
    document.body.appendChild(ov);
    try{if(typeof applyLang==="function")applyLang(ov);}catch(e){}
    let done=false;
    const onKey=e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();kill();}};
    const kill=()=>{if(done)return;done=true;ov.classList.add("out");
      document.removeEventListener("keydown",onKey,true);
      setTimeout(()=>{try{ov.remove();}catch(e){}},220);
      try{opt.onGone&&opt.onGone();}catch(e){}};
    document.addEventListener("keydown",onKey,true);
    ov.addEventListener("pointerdown",kill);   // click the skull or bubble to dismiss
    setTimeout(kill,opt.ms||3500);
    return ov;
  };
  // ===== rfSkullNote: corner news, a STACK rather than a queue =====
  // News used to be one bubble at a time with a queue behind it: the next sentence waited for the
  // previous one to expire, so four capsules connecting at start-up took a dozen seconds to finish
  // talking and the last line landed long after the thing it described. Now a note goes up the
  // moment it happens and pushes the older ones upward — three on screen at most, which is what
  // fits above the skull and what anyone reads at a glance.
  // The tail belongs to the bottom bubble only — that is the one the skull is saying right now.
  // Pushed up by a newer note it becomes something already said and lets the tail go (CSS:
  // .rss-slot:last-child), so the stack never has three bubbles all pointing at one mouth.
  const _NOTE_MAX=3, _NOTE_OUT=200, _NOTE_EVICT=140;
  let _noteHost=null,_noteStack=null,_noteGoing=0;
  // ODCZYT BĄBLA PRZEZ CZYTNIK. Bąbel dostawał role=status/alert i aria-live DOPIERO w chwili,
  // w której już niósł zdanie — a czytniki ogłaszają zmiany w obszarze, KTÓRY OBSERWOWAŁY WCZEŚNIEJ.
  // Region powstały razem z treścią jest dla nich niczym nowym i notka przepadała w ciszy. Dlatego
  // dwa puste regiony powstają raz, przy starcie skryptu, i stoją POZA #rfSkullNotes (ten znika
  // razem z ostatnią notką — _noteHostGone — i zabrałby je ze sobą). Do nich wpisujemy zdanie
  // dopiero po applyLang, czyli w języku, który człowiek naprawdę widzi.
  // WHY: a live region created together with its text is not a CHANGE, so nothing is announced;
  // the two regions are created empty, once, outside the bubble host, which is removed on idle.
  let _noteLiveP=null,_noteLiveA=null;
  function _noteLiveRegions(){
    const body=document.body; if(!body)return null;
    if(_noteLiveP&&_noteLiveP.isConnected&&_noteLiveA&&_noteLiveA.isConnected)return _noteLiveP;
    const SR="position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0";
    const mk=(id,role,live)=>{let n=document.getElementById(id);
      if(!n){n=document.createElement("div");n.id=id;n.style.cssText=SR;
        n.setAttribute("role",role);n.setAttribute("aria-live",live);n.setAttribute("aria-atomic","true");
        body.appendChild(n);}
      return n;};
    _noteLiveP=mk("rfNoteLive","status","polite");
    _noteLiveA=mk("rfNoteLiveAlert","alert","assertive");
    return _noteLiveP;
  }
  if(document.body)_noteLiveRegions();
  else document.addEventListener("DOMContentLoaded",_noteLiveRegions);
  // Zdanie wpisujemy po wyczyszczeniu regionu i w osobnym zadaniu: dwa razy to samo zdanie z rzędu
  // (np. dwa kapsle z tym samym błędem) bez tej przerwy jest dla czytnika brakiem zmiany.
  function _noteSay(text,polite){
    _noteLiveRegions();
    const live=polite?_noteLiveP:_noteLiveA;
    if(!live||!text)return;
    live.textContent="";
    setTimeout(()=>{try{live.textContent=text;}catch(e){}},50);
  }
  const _noteRM=()=>!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  // One skull for the whole stack — it arrives with the first sentence and leaves with the last,
  // so an empty corner means nothing is going on.
  function _noteOpenHost(){
    if(_noteHost&&_noteHost.isConnected){clearTimeout(_noteGoing);_noteHost.classList.remove("out");return _noteHost;}
    const ov=document.createElement("div"); ov.id="rfSkullNotes";
    const wrap=document.createElement("div"); wrap.className="rss-wrap";
    const skull=document.createElement("div"); skull.className="rss-skull"; skull.setAttribute("aria-hidden","true");
    _noteStack=document.createElement("div"); _noteStack.className="rss-stack";
    wrap.appendChild(skull); wrap.appendChild(_noteStack); ov.appendChild(wrap);
    document.body.appendChild(ov); _noteHost=ov; return ov;
  }
  function _noteHostGone(){
    if(!_noteHost||!_noteStack||_noteStack.children.length)return;
    _noteHost.classList.add("out");
    _noteGoing=setTimeout(()=>{
      if(!_noteHost||!_noteStack||_noteStack.children.length)return;   // a new note arrived mid-exit
      try{_noteHost.remove();}catch(e){} _noteHost=null; _noteStack=null;
    },240);
  }
  // FLIP: note where the bubbles are, change the stack, then let each one slide from where it was
  // to where it now belongs. Without this the older bubbles jump the height of the new one.
  // The slide is a keyframe animation, not a transition: a transition needs the browser to notice
  // two different computed styles, and setting the offset and clearing it inside one task is not
  // reliably two — the bubbles came out stuck at the offset. An animation just runs.
  function _noteFlip(mutate){
    if(!_noteStack||_noteRM()){mutate();return;}
    const slots=[].slice.call(_noteStack.children);
    const was=slots.map(s=>s.getBoundingClientRect().top);
    mutate();
    slots.forEach((s,i)=>{
      if(!s.isConnected)return;
      s.classList.remove("slide"); void s.offsetWidth;        // restart the slide if one is still running
      const d=was[i]-s.getBoundingClientRect().top;
      if(!d)return;
      s.style.setProperty("--rf-slide",d+"px");
      s.classList.add("slide");
    });
  }
  function _noteKill(slot,fast){
    if(!slot||slot._going)return;
    slot._going=true; clearTimeout(slot._t); slot.classList.add("out");
    setTimeout(()=>{_noteFlip(()=>{try{slot.remove();}catch(e){}}); _noteHostGone();},
               _noteRM()?0:(fast?_NOTE_EVICT:_NOTE_OUT));
  }
  window.rfSkullNote=function(message,opt){
    opt=opt||{};
    // ms:0 = notka, która CZEKA. Odliczanie przepisuje jedno zdanie co sekundę (rf-12b: wskazywanie
    // punktu na ekranie), więc nie może zgasnąć w połowie liczenia ani rozsypać się na pięć bąbli.
    // Taka notka stoi, dopóki jej właściciel jej nie zdejmie — rfNoteSet/rfNoteClose niżej.
    const sticky=(opt.ms===0);
    const tone=opt.tone||"", ms=(opt.ms>0?opt.ms:2600);
    // UX 261120 A2: `actions:[{label,onClick,primary}]` = kilka przycisków w rzędzie pod zdaniem
    // (zaproszenie do przewodnika: „Pokaż mi panel” i „Gotowe zestawy”). Pojedyncze `action` bez zmian.
    const acts=Array.isArray(opt.actions)?opt.actions.filter(a=>a&&a.label):[];
    const act=(opt.action&&opt.action.label)?opt.action:(acts[0]||null);
    // Something with a button is waiting for an answer, so it is not news: it is announced
    // assertively and it survives a burst that pushes everything else out.
    const polite=(opt.polite!==undefined)?!!opt.polite:!act;
    _noteOpenHost();
    // A fourth sentence retires the oldest — never one carrying a button, unless they all do.
    const _live=()=>[].slice.call(_noteStack.children).filter(s=>!s._going);
    for(let live=_live();live.length>=_NOTE_MAX;live=_live())
      _noteKill(live.find(s=>!s._keep)||live[0],true);
    // `_keep` = nie eksmitować przy natłoku. Notka z przyciskiem czeka na odpowiedź, a notka
    // czekająca (sticky) na koniec odliczania — obie zniknęłyby dokładnie wtedy, gdy są potrzebne.
    const slot=document.createElement("div"); slot.className="rss-slot"; slot._keep=!!act||sticky;
    // Bąbel jest już tylko OBRAZKIEM tej wiadomości — mówi ją region z _noteLiveRegions().
    const b=document.createElement("div"); b.className="rss-bubble"+(tone?(" "+tone):"");
    b.textContent=message;
    // The caps go AFTER the sentence and outside it, so applyLang (which walks text nodes) never
    // sees them as something to translate — a keycap is a key, not a word.
    if(Array.isArray(opt.keys)&&opt.keys.length)b.appendChild(_keysRow(opt.keys));
    if(acts.length){   // UX 261120 A2: rząd przycisków (patrz `acts` wyżej)
      const row=document.createElement("div"); row.className="rss-acts";
      for(const a of acts){
        const ab=document.createElement("button"); ab.className="btn xs rss-act"+(a.primary?" primary":""); ab.type="button";
        ab.textContent=a.label;
        ab.addEventListener("pointerdown",e=>e.stopPropagation());
        ab.addEventListener("click",()=>{try{a.onClick&&a.onClick();}catch(e){} _noteKill(slot);});
        row.appendChild(ab);
      }
      b.appendChild(row);
    }else if(act){
      const ab=document.createElement("button"); ab.className="btn xs rss-act"; ab.type="button";
      ab.textContent=act.label;
      ab.addEventListener("pointerdown",e=>e.stopPropagation());   // the bubble itself dismisses on pointerdown
      ab.addEventListener("click",()=>{try{act.onClick&&act.onClick();}catch(e){} _noteKill(slot);});
      b.appendChild(ab);
    }
    slot.appendChild(b);
    slot.addEventListener("pointerdown",()=>_noteKill(slot));      // click a bubble to send it away early
    try{if(typeof applyLang==="function")applyLang(slot);}catch(e){}   // translate BEFORE measuring — the English
    // …i PO tłumaczeniu bierzemy zdanie do odczytu: pierwszy węzeł tekstowy bąbla (klawisze i
    // przycisk stoją obok niego, poza zdaniem), a etykietę przycisku dopowiadamy po przecinku,
    // bo bez niej „Cofnij" nie istnieje dla kogoś, kto bąbla nie widzi.
    try{
      const _tn=b.firstChild&&b.firstChild.nodeType===3?(b.firstChild.nodeValue||"").trim():"";
      const _ab=b.querySelector(".rss-act");
      _noteSay(_tn+(_ab&&_ab.textContent?(", "+_ab.textContent.trim()):""),polite);
    }catch(e){}
    _noteFlip(()=>_noteStack.appendChild(slot));                       // line can be a different height
    if(!sticky)slot._t=setTimeout(()=>_noteKill(slot),ms);
    return slot;
  };
  // ===== notka, która MÓWI DALEJ: rfNoteSet / rfNoteClose =====
  // Jedno zdarzenie to jeden bąbel, także wtedy, gdy trwa kilka sekund i zmienia treść po drodze.
  // Odliczanie wskazywania punktu (rf-12b) przechodzi w tym samym bąblu przez „ustaw kursor na
  // celu…", kolejne sekundy i wynik — pięć bąbli na jedno odliczanie wypchnęłoby z rogu wszystko
  // inne, a róg jest jeden i jest głosem aplikacji.
  //   • `textContent`, nie `nodeValue`: obserwator tłumaczeń (rf-01) patrzy na `childList`, nie na
  //     `characterData`, więc po angielsku przetłumaczy się tylko węzeł tekstowy, który NAPRAWDĘ
  //     jest nowy. Podmiana treści w istniejącym węźle zostałaby po polsku.
  //   • Czytnik ekranu NIE dostaje kolejnych sekund (`say` domyślnie wyłączone): „biorę za 5 s…
  //     4 s… 3 s…" to pięć przerwań na jedno zdarzenie. Ogłaszamy pierwsze zdanie i wynik.
  //   • `ms` w rfNoteSet uzbraja zniknięcie: tak notka czekająca kończy się wynikiem i gaśnie
  //     sama, zamiast zostać zdjęta pusta.
  window.rfNoteSet=function(slot,message,opt){opt=opt||{};
    if(!slot||!slot.isConnected||slot._going)return null;
    const b=slot.querySelector(".rss-bubble"); if(!b)return null;
    b.textContent=message;                       // nowy węzeł tekstowy = jest co tłumaczyć
    if(opt.tone!==undefined)b.className="rss-bubble"+(opt.tone?(" "+opt.tone):"");
    try{if(typeof applyLang==="function")applyLang(b);}catch(e){}
    if(opt.ms>0){slot._keep=false;clearTimeout(slot._t);slot._t=setTimeout(()=>_noteKill(slot),opt.ms);}
    if(opt.say){try{
      const _tn=b.firstChild&&b.firstChild.nodeType===3?(b.firstChild.nodeValue||"").trim():"";
      _noteSay(_tn,opt.polite!==false);
    }catch(e){}}
    return slot;
  };
  window.rfNoteClose=function(slot){if(slot)_noteKill(slot);};
  // Full-screen overlay shown while the app restarts (simulation <-> LIVE mode switch).
  window.rfRestartOverlay=function(show,msg,sub){
    let ov=document.getElementById("rfRestartOv");
    if(!show){if(ov)ov.remove();return;}
    if(!ov){ov=document.createElement("div");ov.id="rfRestartOv";ov.className="rfm-restart";
      ov.innerHTML='<div class="rfm-spin" aria-hidden="true"></div><div class="rfm-rmsg"></div><div class="rfm-rsub"></div>';
      document.body.appendChild(ov);}
    ov.querySelector(".rfm-rmsg").textContent=msg||"Restartuję…";
    ov.querySelector(".rfm-rsub").textContent=sub||"Czekam na ponowne połączenie…";
  };
})();

// Shared modal EXIT: fade the backdrop + settle the card, THEN hide/remove. Used by
// #devEdit / #pairModal / #rfInc / #rfSafe (the display-toggled + createElement dialogs).
// Token guard: if the same overlay is re-opened mid-close, the stale finisher aborts so it
// can never hide a freshly re-opened modal.
// Always converges (animationend OR 260ms fallback OR reduced-motion) => no stuck overlays.
window.rfmClose=function(ov,done){
  if(!ov){ try{done&&done();}catch(e){} return; }
  var tok=(ov.__rfmCloseTok=(ov.__rfmCloseTok||0)+1);
  var RMm=(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var finished=false, tid=0;
  var fin=function(){
    if(finished) return; finished=true;
    clearTimeout(tid); ov.removeEventListener("animationend",onEnd);
    if(ov.__rfmCloseTok!==tok) return;       // superseded by a newer open/close — do nothing
    ov.classList.remove("rfm-closing");
    try{done&&done();}catch(e){}
  };
  var onEnd=function(e){ if(e.target===ov) fin(); };
  if(RMm){ ov.classList.remove("rfm-closing"); if(ov.__rfmCloseTok===tok){ try{done&&done();}catch(e){} } return; }
  ov.classList.add("rfm-closing");
  ov.addEventListener("animationend",onEnd);
  tid=setTimeout(fin,260);
};
// Re-opening a dialog must cancel any in-flight close so its entrance is not overridden.
window.rfmReopen=function(ov){ if(!ov) return; ov.__rfmCloseTok=(ov.__rfmCloseTok||0)+1; ov.classList.remove("rfm-closing"); };

// =====================================================================================================
// ===== UX 261120 A1: jeden głos komunikatów, „Cofnij", „Wyśrodkuj kapsel", pamięć zwijaka =====
// =====================================================================================================
// Synteza UX 2026-11-20, 3.11: potwierdzenia mówi czaszka (`rfToast`), a nie pole `#trigMsg`
// w karcie Mapowania, którego z innych ekranów nie widać. Usuwanie i reset działają od razu
// i dają „Cofnij" na 25 s zamiast pytania „Czy na pewno?". Wszystko tutaj, a nie w modułach,
// żeby siedem ekranów mówiło tym samym głosem i liczyło ten sam czas.
(function(){
  const T=function(pl,en){return (typeof _lang!=="undefined"&&_lang==="en")?en:pl;};
  const UNDO_MS=25000;

  // rfSay(tekst, {tone, ms, at, atText, action, keys}) — potwierdzenie czynności.
  //   tone   "ok" | "warn" | "danger" (kolor bąbla czaszki),
  //   at     kontrolka, którą kliknięto: obok niej na 2 s staje krótki napis (`atText`, domyślnie
  //          sam `tekst`), bo tam patrzy człowiek; czaszka mówi pełne zdanie w rogu,
  //   action {label, onClick} — przycisk w bąblu (np. „Cofnij"), keys — klawisze do narysowania.
  // Tekst może być po polsku: bąbel tłumaczy go słownikiem jak każdy inny napis.
  window.rfSay=function(text,opt){opt=opt||{};
    if(opt.at)_sayAt(opt.at,opt.atText||text,opt.tone==="danger"||opt.tone==="warn");
    if(typeof window.rfToast!=="function")return null;
    return window.rfToast(text,{tone:opt.tone,ms:opt.ms,action:opt.action,keys:opt.keys});
  };
  function _sayAt(el,text,bad){
    if(!el||!el.parentNode)return;
    let s=el.nextElementSibling;
    if(!(s&&s.classList&&s.classList.contains("rf-said"))){
      s=document.createElement("span"); s.className="rf-said"; s.setAttribute("aria-hidden","true");  // czytnik dostaje zdanie z bąbla
      el.parentNode.insertBefore(s,el.nextSibling);
    }
    s.textContent=String(text||"");
    s.classList.toggle("bad",!!bad); s.classList.remove("out");
    try{if(typeof applyLang==="function")applyLang(s);}catch(e){}
    clearTimeout(s._t); clearTimeout(s._t2);
    s._t=setTimeout(()=>{s.classList.add("out"); s._t2=setTimeout(()=>{try{s.remove();}catch(e){}},260);},2000);
  }

  // rfUndo({msg, take, run, restore, ms, label, clone}) — operacja z drogą powrotną.
  //   take()        zwraca to, co trzeba odłożyć PRZED zmianą (kopiowane głęboko, chyba że clone:false),
  //   run()         robi zmianę (opcjonalnie: można ją zrobić samemu przed wywołaniem),
  //   restore(snap) oddaje stan sprzed zmiany i sam go zapisuje (commit/fetch modułu),
  //   msg           zdanie bąbla, np. „Usunięto wycinek „Skok”",
  //   ms            czas na „Cofnij", domyślnie 25 s (jeden czas w całej aplikacji).
  // Zwraca {snap, undo()}; `undo()` przydaje się do skrótu klawiszowego. Druga próba cofnięcia
  // (bąbel i skrót naraz) nic nie robi.
  window.rfUndo=function(o){o=o||{};
    let snap=null;
    try{ snap=(typeof o.take==="function")?o.take():null; }catch(e){ snap=null; }
    if(o.clone!==false&&snap!=null)snap=_clone(snap);
    if(typeof o.run==="function")o.run();
    let used=false;
    const undo=function(){
      if(used)return false; used=true;
      try{ o.restore(snap); }catch(e){ console.error("[RibbitFlip] Cofnij:",e); return false; }
      return true;
    };
    if(typeof window.rfToast==="function")
      window.rfToast(o.msg||T("Zrobione.","Done."),{tone:o.tone||"ok",ms:o.ms||UNDO_MS,
        action:{label:o.label||T("↶ Cofnij","↶ Undo"),onClick:undo}});
    return {snap:snap,undo:undo};
  };
  function _clone(v){
    try{ if(typeof structuredClone==="function")return structuredClone(v); }catch(e){}
    try{ return JSON.parse(JSON.stringify(v)); }catch(e){ return v; }
  }

  // rfCenterCapsule(przycisk) — „Wyśrodkuj kapsel" w Myszy, Kontrolerze, Kole i Skanerze. Jedna
  // pozycja zerowa na całą aplikację (POST /airmouse/calibrate), jedno zdanie potwierdzenia przy
  // przycisku i w bąblu. Zwraca obietnicę z true/false.
  window.rfCenterCapsule=function(btn){
    return fetch("/airmouse/calibrate",{method:"POST"})
      .then(r=>{ if(r&&r.ok===false)throw new Error("HTTP "+r.status);
        window.rfSay(T("Wyśrodkowano. To położenie kapsla jest teraz środkiem.","Centred. This capsule position is now the middle."),
          {tone:"ok",at:btn,atText:T("Wyśrodkowano","Centred")});
        return true; })
      .catch(()=>{
        window.rfSay(T("Nie udało się wyśrodkować. Sprawdź, czy kapsel jest połączony.","Could not centre. Check that the capsule is connected."),
          {tone:"danger",at:btn,atText:T("Nie udało się","Failed")});
        return false; });
  };

  // rfFold(details, klucz, {sum}) — zwijak `details.cardfold` pamięta otwarcie w localStorage
  // (`ribbitflip.fold.<klucz>`), a `sum()` wpisuje bieżące wartości do `.cardfold-sum` w nagłówku.
  // Zwraca funkcję, którą moduł woła po każdej zmianie wartości, żeby podsumowanie nadążało.
  window.rfFold=function(det,key,opt){opt=opt||{};
    if(!det)return function(){};
    const LS="ribbitflip.fold."+key;
    try{ const v=localStorage.getItem(LS); if(v==="1")det.open=true; else if(v==="0")det.open=false; }catch(e){}
    // L1: preferencja „Rozwijaj wszystkie ustawienia" (rf-28d) otwiera zwijak na starcie i wtedy
    // nie nadpisuje zapamiętanego stanu, żeby po jej wyłączeniu wrócił dawny układ.
    const all=()=>typeof window.rfFoldAllOn==="function"&&window.rfFoldAllOn();
    det._rfFoldLS=LS;
    if(all()){ det.open=true; det._rfAllDone=true; }
    if(!det._rfFold){
      det._rfFold=true;
      det.addEventListener("toggle",()=>{ if(all())return; try{localStorage.setItem(LS,det.open?"1":"0");}catch(e){} });
    }
    const sync=function(){
      if(typeof opt.sum!=="function")return;
      const sm=det.querySelector(":scope>summary"); if(!sm)return;
      let s=sm.querySelector(".cardfold-sum");
      if(!s){ s=document.createElement("span"); s.className="cardfold-sum"; sm.appendChild(s); }
      let t=""; try{ t=String(opt.sum()||""); }catch(e){}
      if(s.textContent!==t){ s.textContent=t; try{if(typeof applyLang==="function")applyLang(s);}catch(e){} }
    };
    sync();
    return sync;
  };
})();
// (koniec sekcji A1)
