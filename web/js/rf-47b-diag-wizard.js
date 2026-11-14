"use strict";
// ============ „ZGŁOŚ PROBLEM" — JEDNO OKNO, DWIE ODPOWIEDZI ============
// This used to be a three-step wizard: five text fields, two rows of tag chips, a live preview of
// the Discord thread and a four-item publish list at the end. It was built as a twin of „Podziel
// się na forum" (rf-39f), on the theory that both errands end in a forum post — but the two people
// are not in the same mood. Somebody sharing a working setup has time; somebody whose capsule will
// not pair has a problem NOW, and a form that asks them to phrase an expectation, tick a symptom
// axis and read a preview is one more obstacle between them and asking for help. A window that is
// work to get through is a window that ends in „never mind, I will live with it".
//
// So the window now answers only the two questions it is actually needed for:
//   1. HOW DO I GET THE BUNDLE — the button that builds it, where it lands, what is inside it.
//      That part stays exactly as it was: it is the one thing the app can do that the person
//      cannot, and it is why this window exists at all,
//   2. WHERE DO I REPORT IT — #pomoc, or GitHub Issues for somebody who would rather write in the
//      open (and in English), or is not on Discord at all. The invite sits next to the first one,
//      because a channel deep link resolves to NOTHING for somebody who is not on the server yet.
// The words are the person's own, written wherever they choose to write them. The app no longer
// composes the post: it never knew what was wrong, and everything it DID know travels in the zip.
//
// Nothing here sends anything anywhere — the header of rf-47-diag.js says why that is the whole
// design of this feature rather than an omission.
//
// REUSED RATHER THAN COPIED: the `.rfk-*` / `.rfs-*` window chrome (which is „the dialog look" of
// this app, not the share wizard's private CSS) and the numbered `.rfs-howto` list. Everything
// composed at paint time — anything carrying a channel name or a file count — is marked
// `data-noi18n` and repainted in `_dgSync`, because the i18n walker matches whole strings and has
// no key for „Otwórz #pomoc ↗".

let _dgwBack=null;
let _dgwPrevFocus=null;
let _dgwSync=function(){};

function rfDiagWizClose(){
  const back=_dgwBack;
  if(!back)return;
  _dgwBack=null;
  document.removeEventListener("keydown",back._onKey,true);
  back.classList.add("out");
  setTimeout(function(){try{back.remove();}catch(e){}},160);
  try{if(_dgwPrevFocus&&_dgwPrevFocus.focus)_dgwPrevFocus.focus();}catch(e){}
  _dgwPrevFocus=null;
}

// A numbered step of the list. A flex <li> stops being a list-item and loses its number with it, so
// the row goes INSIDE the <li> rather than on it. Same shape as rf-39f's publish list.
function _dgwStep(list,text){
  const li=document.createElement("li");
  const row=document.createElement("div");row.className="rfs-act";
  const tx=document.createElement("span");tx.className="rfs-acttx";tx.textContent=text;
  row.appendChild(tx);li.appendChild(row);list.appendChild(li);
  return {li:li,row:row};
}

// „Gdzie to zgłosić" — one destination: the button that opens it and a sentence saying what it is.
// The BUTTON COMES FIRST, unlike the publish list this window borrows its shape from. There the
// text is an instruction and the button carries it out; here the two rows are a CHOICE, and a
// choice reads as a choice when the two things being chosen between start in the same column. (It
// also stops the longer of the two sentences from pushing its own button onto a second line.)
// Both parts are composed — the first is a link label with an arrow, the second carries a channel
// name — so the caller gets the two nodes back and writes them in _dgwSync.
function _dgwWhere(li,btnClass,url,icon){
  const row=document.createElement("div");row.className="rfs-act rfs-where";
  const a=document.createElement("a");a.className=btnClass;
  a.href=url;a.target="_blank";a.rel="noopener noreferrer";
  a.setAttribute("data-noi18n","");
  if(icon){
    const ic=document.createElement("span");
    ic.className="bic "+icon;ic.setAttribute("aria-hidden","true");
    a.appendChild(ic);
  }
  const at=document.createTextNode("");
  a.appendChild(at);
  const tx=document.createElement("span");tx.className="rfs-acttx";
  tx.setAttribute("data-noi18n","");
  row.appendChild(a);row.appendChild(tx);li.appendChild(row);
  return {tx:tx,a:at};
}

function rfDiagOpen(){
  if(_dgwBack)return;
  _dgwPrevFocus=document.activeElement;

  const back=document.createElement("div");
  back.className="rfk-back rfs-back";back.id="rfDiagW";
  back.setAttribute("role","presentation");
  const card=document.createElement("div");
  card.className="rfk-card rfs-card";
  card.setAttribute("role","dialog");card.setAttribute("aria-modal","true");
  card.setAttribute("aria-label","Zgłoś problem");

  const head=document.createElement("div");head.className="rfk-head";
  const h=document.createElement("h3");h.className="rfk-title";
  h.textContent="Zgłoś problem";
  const x=document.createElement("button");x.type="button";x.className="rfk-x";
  x.setAttribute("aria-label","Zamknij");x.textContent="×";
  x.addEventListener("click",rfDiagWizClose);
  head.appendChild(h);head.appendChild(x);

  const body=document.createElement("div");body.className="rfs-body";
  const intro=document.createElement("p");intro.className="rfs-intro";
  intro.textContent="Aplikacja nic nie wysyła sama. Zbuduj paczkę diagnostyczną, a potem opisz problem tam, gdzie Ci wygodniej, i dołącz do wpisu plik .zip.";
  body.appendChild(intro);

  const steps=document.createElement("ol");steps.className="rfs-howto";body.appendChild(steps);

  // ---- 1: the bundle ---------------------------------------------------------------------------
  // It leads because nothing can be dragged anywhere until the file exists, and because it is the
  // half of a bug report that the person reporting cannot write themselves.
  const s1=_dgwStep(steps,"Zbuduj paczkę diagnostyczną.");
  const build=document.createElement("button");
  build.type="button";build.className="btn sm primary";build.textContent="Zbuduj paczkę";
  const show=document.createElement("button");
  show.type="button";show.className="btn sm";show.textContent="Pokaż w folderze";show.hidden=true;
  const pill=document.createElement("span");pill.className="ra-pill";pill.id="dgPill";
  s1.row.appendChild(build);s1.row.appendChild(show);s1.row.appendChild(pill);
  const bNote=document.createElement("p");bNote.className="rfs-dlnote";bNote.hidden=true;
  s1.li.appendChild(bNote);
  // CO JEST W PACZCE — po zbudowaniu liczone z LISTY PLIKÓW, którą serwer odesłał, a nie z obietnicy
  // spisanej w kodzie. Dziennik `ribbitflip.log` trafia do zipa tylko wtedy, gdy leży na dysku:
  // wersja okienkowa prowadzi go zawsze, a uruchomienie z konsoli — nie. Zdanie składane z liczb,
  // więc `data-noi18n` i przepisywanie w `_dgSync`, jak reszta okna.
  const safe=document.createElement("p");safe.className="rfs-hint-add";
  safe.setAttribute("data-noi18n","");
  s1.li.appendChild(safe);
  const det=document.createElement("details");det.className="setup-details";det.hidden=true;
  const sum=document.createElement("summary");det.appendChild(sum);
  const dBody=document.createElement("div");dBody.className="setup-body";
  const ul=document.createElement("ul");ul.className="dg-list";dBody.appendChild(ul);
  det.appendChild(dBody);s1.li.appendChild(det);

  build.addEventListener("click",function(){
    build.disabled=true;
    bNote.hidden=false;bNote.classList.remove("bad");
    bNote.textContent=_gl("Buduję…","Building…");
    rfDiagBuild().then(function(res){
      build.disabled=false;
      bNote.hidden=false;
      bNote.classList.toggle("bad",!res.ok);
      bNote.textContent=res.ok
        ?_gl("Gotowe","Done")
        :(_gl("Nie udało się zbudować paczki","Could not build the bundle")+(res.error?(": "+res.error):""));
      _dgwSync();
    });
  });
  show.addEventListener("click",function(){
    rfDiagShowFolder().then(function(ok){
      if(ok)return;
      bNote.hidden=false;bNote.classList.add("bad");
      bNote.textContent=_gl("Nie udało się otworzyć folderu","Could not open the folder");
    });
  });

  // ---- 2: where ---------------------------------------------------------------------------------
  // TWO DOORS, side by side rather than one behind the other. #pomoc is first because it is where
  // somebody answers fastest and in Polish; GitHub is not a fallback for when Discord fails, it is
  // the right door for somebody who does not want a Discord account or wants a link that outlives a
  // chat server. Neither one is described as „better" — the choice is not the app's to make.
  const s2=_dgwStep(steps,"Napisz, co się dzieje, czego się spodziewasz i kiedy to występuje:");
  const wHelp=_dgwWhere(s2.li,"btn sm primary rfs-go",RF_HELP_URL,"bic-discord");
  // ONE invite sentence in the whole app, word for word the one in rf-39f / rf-39l / rf-46f.
  const join=document.createElement("p");join.className="rfs-hint-add";
  const jTxt=document.createElement("span");
  const jLink=document.createElement("a");
  jLink.href=RF_INVITE_HELP;jLink.target="_blank";jLink.rel="noopener noreferrer";
  jLink.className="rfs-invite";
  join.appendChild(jTxt);join.appendChild(jLink);
  s2.li.appendChild(join);
  // No felt icon for GitHub: the icon set is hand-drawn artwork, and a mark borrowed from somewhere
  // else would be the one button in this app wearing a stranger's clothes. The arrow says „leaves
  // the app", which is the part that matters.
  const wGit=_dgwWhere(s2.li,"btn sm",RF_GITHUB_ISSUES,"");

  // Not a bug at all — one quiet line, because a wish filed on #pomoc waits for a fix nobody ever
  // planned, and the person who wrote it thinks it is being worked on.
  const idea=document.createElement("p");idea.className="rfs-hint-add";
  idea.setAttribute("data-noi18n","");
  const iTxt=document.createElement("span");
  const iLink=document.createElement("a");
  iLink.href=RF_IDEAS_URL;iLink.target="_blank";iLink.rel="noopener noreferrer";
  iLink.className="rfs-invite";
  idea.appendChild(iTxt);idea.appendChild(iLink);
  body.appendChild(idea);

  const foot=document.createElement("div");foot.className="rfk-foot rfs-foot";
  const note=document.createElement("span");note.className="rfk-note";
  note.textContent="Paczka powstaje u Ciebie na dysku. Wpis wysyłasz sam, ze swojego konta.";
  const doneBtn=document.createElement("button");
  doneBtn.type="button";doneBtn.className="btn sm primary";doneBtn.textContent="Gotowe";
  doneBtn.addEventListener("click",rfDiagWizClose);
  foot.appendChild(note);foot.appendChild(doneBtn);

  // Liczebnik z rejestru rodzajów (rf-49), z furtką na build bez niego.
  const _pl=function(n,f1,f2,f5,e1,e2){
    return (typeof rfPl==="function")?rfPl(n,f1,f2,f5,e1,e2):((n===1)?f1:f5);
  };
  const _packSum=function(b){
    if(!b||!b.files||!b.files.length){
      return _gl("W paczce znajdą się: raport, pliki ustawień i dziennik aplikacji, o ile aplikacja go prowadzi (w wersji .exe zawsze). Bez haseł, bez sejfu, bez danych przeglądarki.",
                 "The bundle will hold: the report, your settings files and the app log, if the app keeps one (the .exe build always does). No passwords, no vault, no browser data.");
    }
    const n=b.files.filter(function(x){return /^Settings\//.test(x);}).length;
    const log=b.files.some(function(x){return /\.log$/i.test(x);});
    return _gl("W paczce: raport, "+n+" "+_pl(n,"plik ustawień","pliki ustawień","plików ustawień","settings file","settings files")+
                 ", dziennik: "+(log?"tak":"nie")+". Bez haseł, bez sejfu, bez danych przeglądarki.",
               "In the bundle: the report, "+n+" "+((n===1)?"settings file":"settings files")+
                 ", log: "+(log?"yes":"no")+". No passwords, no vault, no browser data.");
  };

  // Everything the walker cannot reach: the two destination lines, the invite, the ideas line and
  // the bundle's own summary. All of them carry either a channel name or a number.
  _dgwSync=function(){
    wHelp.tx.textContent=_gl("Forum pomocy ","The help forum ")+RF_HELP_NAME+
                         _gl(": po polsku, tam odpowiadamy najszybciej.",": in Polish, and answered fastest.");
    wHelp.a.textContent=_gl("Otwórz ","Open ")+RF_HELP_NAME+" ↗";
    jTxt.textContent=_gl("Nie jesteś jeszcze na serwerze? ","Not on the server yet? ");
    jLink.textContent=_gl("Dołącz zaproszeniem ↗","Join with the invite ↗");
    wGit.tx.textContent=_gl("GitHub Issues: publiczny rejestr błędów, po angielsku.",
                            "GitHub Issues: the public bug tracker, in English.");
    wGit.a.textContent=_gl("Zgłoś na GitHubie ↗","Report on GitHub ↗");
    iTxt.textContent=_gl("To nie błąd, tylko pomysł? Wrzuć go na ","Not a bug but an idea? Post it on ");
    iLink.textContent=RF_IDEAS_NAME+" ↗";

    const b=rfDiagBundle(),has=!!(b&&b.name);
    safe.textContent=_packSum(b);
    pill.textContent=has?(b.name+" · "+b.sizeKB+" KB")
                        :_gl("jeszcze nie zbudowana","not built yet");
    pill.className="ra-pill "+(has?"ok":"");
    show.hidden=!has;
    det.hidden=!has;
    sum.textContent=has
      ?(_gl("Co dokładnie jest w paczce","Exactly what is in the bundle")+" ("+b.files.length+")")
      :"";
    ul.textContent="";
    if(has)b.files.forEach(function(f){
      const li=document.createElement("li");li.textContent=f;ul.appendChild(li);
    });
  };

  card.appendChild(head);card.appendChild(body);card.appendChild(foot);
  back.appendChild(card);

  back.addEventListener("mousedown",function(e){if(e.target===back)rfDiagWizClose();});
  back._onKey=function(e){
    if(e.key==="Escape"){e.preventDefault();e.stopPropagation();rfDiagWizClose();return;}
    if(e.key!=="Tab")return;
    const f=Array.prototype.filter.call(
      card.querySelectorAll("a[href]:not([hidden]),button:not([disabled]):not([hidden])"),
      function(el){return el.offsetParent!==null;});
    if(!f.length)return;
    const first=f[0],last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  document.addEventListener("keydown",back._onKey,true);

  document.body.appendChild(back);
  _dgwBack=back;
  _dgwSync();

  try{if(typeof applyLang==="function")applyLang(back);}catch(e){}
  setTimeout(function(){try{build.focus();}catch(e){}},30);
}

// Language switch while the window is open: the two destination lines, the invite, the ideas line
// and the bundle summary are all composed at paint time, so they need a repaint rather than the
// walker.
function rfDiagWizRelang(){
  if(!_dgwBack)return;
  try{if(typeof applyLang==="function")applyLang(_dgwBack);}catch(e){}
  _dgwSync();
}

window.rfDiagOpen=rfDiagOpen;
window.rfDiagWizClose=rfDiagWizClose;
