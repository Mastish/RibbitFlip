"use strict";
// ===== theme colour access =====
// cv('--name') reads a CSS custom property off :root. The style snapshot is taken once at
// load, so every rf-* file below sees the same palette (JS-drawn canvases must match CSS).
//
// MEMOIZED (2026-09-05). `COL` is a LIVE CSSStyleDeclaration, so every `getPropertyValue`
// is a real read against the current computed style — and the drawing code calls cv() per
// axis, per label, per tick: 78 reads per frame on the sensor screen and 1713 during boot.
// The tokens themselves only ever change when the overlay window switches its look, so the
// cache is cleared from exactly one place (`cvReset` in rf-41 `ovlApply`). Empty values are
// NOT cached: a token asked for before its stylesheet applied would stay empty forever.
const COL=getComputedStyle(document.documentElement),_cvM=new Map();
const cv=n=>{let v=_cvM.get(n);if(v===undefined){v=COL.getPropertyValue(n).trim();if(v)_cvM.set(n,v);}return v;};
function cvReset(){_cvM.clear();}

// ===== community addresses and the forum's tag dictionary =====
// ONE copy of every community address and of every forum tag name. The server is offered from a
// dozen places in this app; a duplicate that goes stale sends people to a channel that no longer
// exists, or — worse — tells them to tick a tag the forum has never had.
// Everything below was read off the LIVE server on 2026-09-02 (guild 1540354827517693952).
//
// THREE PERMANENT INVITES, THREE DOORS, and they stay separate on purpose: every Discord invite
// carries its own use counter, so the split is the only way to tell which door people came through.
// Each one also LANDS somewhere different, which is the half that matters to whoever clicks it:
//   • tyv2MjjVdb → #start-tutaj  — the app header, the „Zgłoś problem" window, both READMEs and the
//     project page. Somebody arriving with no idea what the server is gets the tour first,
//   • Wkd6UGDcPC → #zestawy      — every exchange flow (the post wizard, the exchange hub, the link
//     importer). Somebody who came to swap a setup lands in the room where setups are,
//   • 7H2gsjTe3T → #pochwal-się  — the project page's „show what you made" chip.
// A channel deep link resolves to NOTHING for somebody who is not on the server yet, which is why
// every deep link in this app is offered next to the invite that matches it.
const RF_FORUM_URL="https://discord.com/channels/1540354827517693952/1540416138704457820";
const RF_FORUM_NAME="#zestawy";
// The HELP forum, kept apart from RF_FORUM_URL (#zestawy) on purpose: they are two different
// channels for two different errands. Somebody sharing a working setup and somebody whose capsule
// will not pair must not land in the same place — a bug report drowning in a setup exchange gets
// no answer, and the exchange stops being readable. Same reason the invites are split above.
const RF_HELP_URL="https://discord.com/channels/1540354827517693952/1540416135017799810";
const RF_HELP_NAME="#pomoc";
// „Show what you made" — the third room, and the one the app never pointed at until now. It is NOT
// #zestawy: a video of somebody playing with their capsule is not a file anybody can load, and
// mixing the two makes the exchange unreadable.
const RF_SHOWCASE_URL="https://discord.com/channels/1540354827517693952/1540416132035514410";
const RF_SHOWCASE_NAME="#pochwal-się";
// Ideas and wishes. Kept away from #pomoc for the same reason #pomoc is kept away from #zestawy:
// „it would be nice if" and „it is broken" are answered by different people on different days.
const RF_IDEAS_URL="https://discord.com/channels/1540354827517693952/1540436211884101642";
const RF_IDEAS_NAME="#pomysły";
const RF_INVITE_HEADER="https://discord.gg/tyv2MjjVdb";    // header button, help wizard, READMEs, project page
const RF_INVITE_SHARE="https://discord.gg/Wkd6UGDcPC";     // exchange flows (post wizard, hub, link importer)
// ⚠️ No reader inside this app, and that is deliberate: the third door is opened from the PROJECT
// PAGE (docs/index.html), not from the panel. It is declared here anyway so that the list of doors
// is complete in one place — an invite that exists on the server but nowhere in the code is exactly
// the one that gets revoked by accident during a tidy-up.
const RF_INVITE_SHOWCASE="https://discord.gg/7H2gsjTe3T";  // project page „pokaż, co zrobiłeś" chip
// The help wizard sends people through the front door on purpose: somebody whose app is misbehaving
// has not necessarily ever seen the server, and #start-tutaj answers „where am I" before #pomoc
// answers „what is broken".
const RF_INVITE_HELP=RF_INVITE_HEADER;
// THE SECOND DOOR FOR A BUG REPORT, next to #pomoc. Not everybody is on Discord, not everybody
// wants to be, and a public issue is a permanent link somebody can point a second person at —
// which a forum thread on a server you have to join is not. Offered as an ALTERNATIVE rather than a
// fallback: the choice belongs to whoever is reporting.
// The address is written out here rather than at the button, like every other address in this file;
// `git grep "Mastish/RibbitFlip"` still lists every copy in the project.
const RF_GITHUB_ISSUES="https://github.com/Mastish/RibbitFlip/issues";

// THE TAG DICTIONARY OF THE FORUMS, read off the live server on 2026-09-02. One object, because the
// same names are needed by the setup post wizard (#zestawy) and the wheel's own post window — and
// two copies of a list that lives on somebody else's server drift apart at the first rename.
// `e` is the emoji as it reads on the forum (the whole point of showing a tag is that it can be
// matched by eye); `mod:true` means only a moderator can put it on a thread, so it must never be
// OFFERED as something to tick.
//   • domain       — on #zestawy and #pochwal-się only. „What is this project", not „what is broken",
//     which is why #pomoc and #pomysły do not carry them,
//   • module       — on ALL FOUR fora. One dictionary for the whole server,
//   • zestawyExtra — #zestawy only,
//   • pomocExtra   — #pomoc only (the symptom axis). ⚠️ NO READER IN THE APP since the „Zgłoś
//     problem" window stopped ticking tags for people (rf-47b) — kept for the same reason
//     RF_INVITE_SHOWCASE is: a list of what the server really carries is only useful whole,
//   • pomyslyStatus— #pomysły only, and moderator-owned from end to end.
// ⚠️ There is NO „Mysz" tag and NO „Kontroler" tag anywhere on this server. Motion control is ONE
// tag, „🖱️ Sterowanie ruchem", even though the app splits it into two tabs.
// `g` is an ENGLISH GLOSS, not a translation: the chip keeps the literal Polish label (that is the
// string somebody has to find in the forum's tag picker), and the gloss rides along in a `title`
// so an English speaker knows what they are ticking. Tags whose name is already English —
// MIDI, OSC, REST API — carry none, because „MIDI (MIDI)" helps nobody.
const RF_FORUM_TAGS={
  domain:[{e:"🎹",n:"Muzyka",g:"music"},{e:"🎮",n:"Granie",g:"gaming"},{e:"🔧",n:"Majsterkowanie",g:"DIY"},
          {e:"🎨",n:"Sztuka",g:"art"},{e:"♿",n:"Dostępność",g:"accessibility"},{e:"🧩",n:"Inne",g:"other"}],
  module:[{e:"⌨️",n:"Mapowanie",g:"mapping"},{e:"🖱️",n:"Sterowanie ruchem",g:"motion control"},
          {e:"🕹️",n:"Pad Xbox",g:"Xbox pad"},
          {e:"🎼",n:"MIDI"},{e:"📡",n:"OSC"},{e:"🌐",n:"REST API"},{e:"🔊",n:"Pady i synth",g:"pads and synth"}],
  zestawyExtra:[{e:"👥",n:"Kilka kapsli",g:"several capsules"},{e:"🎡",n:"Koło wyboru",g:"selection wheel"}],
  pomocExtra:[{e:"📶",n:"Połączenie i Bluetooth",g:"connection and Bluetooth"},{e:"📦",n:"Instalacja i EXE",g:"install and EXE"},
              {e:"🪟",n:"Windows i zasobnik",g:"Windows and the tray"},{e:"🐞",n:"Błąd",g:"bug"},
              {e:"✅",n:"Rozwiązane",g:"solved",mod:true}],
  pomyslyStatus:[{e:"🗓️",n:"W planie",g:"planned",mod:true},{e:"✅",n:"Zrobione",g:"done",mod:true},
                 {e:"🙏",n:"Nie tym razem",g:"not this time",mod:true}]
};
// The four names the code refers to by hand, so a rename on the server is still ONE edit above.
const RF_TAG_MOTION=RF_FORUM_TAGS.module[1].n;        // 🖱️ Sterowanie ruchem
const RF_TAG_PAD=RF_FORUM_TAGS.module[2].n;           // 🕹️ Pad Xbox
const RF_TAG_MULTI=RF_FORUM_TAGS.zestawyExtra[0].n;   // 👥 Kilka kapsli
const RF_TAG_WHEEL=RF_FORUM_TAGS.zestawyExtra[1].n;   // 🎡 Koło wyboru
// ILE ZNAKÓW PRZYJMUJE JEDEN WPIS NA FORUM. To fakty o cudzym serwerze, więc stoją tu razem
// z adresami i tagami: posty składają DWA okna — kreator zestawów (rf-39f) i okno koła (rf-46f) —
// a dwie kopie tych liczb rozjechałyby się po cichu. Odczytane z dokumentacji Discorda:
// „1-100 character channel name” dla nazwy wątku i „Message contents (up to 2000 characters)”
// dla treści. Powyżej 2000 klient NIE ucina wpisu — zamienia go w załącznik message.txt, więc
// czytający dostaje plik tekstowy zamiast opisu. Liczba tagów na wpis (5) siedzi w rf-39g przy
// RFS_TAG_MAX, bo tamten plik jest o tym, CO wchodzi do posta.
const RF_FORUM_TITLE_MAX=100;
const RF_FORUM_BODY_MAX=2000;
// Every name on one axis, for the places that draw a whole row of chips.
function rfTagNames(axis){
  const a=RF_FORUM_TAGS[axis]||[];
  return a.filter(function(t){return !t.mod;}).map(function(t){return t.n;});
}
// The emoji for a tag, whichever axis it belongs to. Returns "" for a name this server does not
// have — the caller then shows the bare name rather than inventing a symbol for it.
function rfTagEmoji(n){
  for(const ax in RF_FORUM_TAGS){
    const hit=RF_FORUM_TAGS[ax].filter(function(t){return t.n===n;})[0];
    if(hit)return hit.e;
  }
  return "";
}
// „Sterowanie ruchem (motion control)" — for a `title` on a tag chip, and ONLY in English. Returns
// "" in Polish and for tags whose name needs no gloss, so the caller can just skip the attribute.
function rfTagGloss(n){
  try{ if(typeof _lang==="undefined"||_lang!=="en")return ""; }catch(e){ return ""; }
  for(const ax in RF_FORUM_TAGS){
    const hit=RF_FORUM_TAGS[ax].filter(function(t){return t.n===n;})[0];
    if(hit)return hit.g?(n+" ("+hit.g+")"):"";
  }
  return "";
}

// ===== folds that slide both ways =====
// Two panels in this app fold out of a bar: „Moduły" under the capsules (rf-45) and „Widoczność"
// at the end of the tab bar (rf-48). Both used to animate OPEN only and vanish on close, which is
// half a gesture — and both got it that way by copying the other, so the fix lives HERE rather
// than twice. The CSS is in 16-devmods.css; this is only the timing, which is the part that is
// easy to get subtly wrong: `display` cannot animate, so a fold needs THREE states, not two.
//   • no class  — `display:none`, out of the layout entirely (both folds sit in flex/grid parents
//     that would otherwise keep their gap around an element of zero height),
//   • `.on`     — laid out, collapsed,
//   • `.on.open`— open.
// A transition needs a FROM value that the engine has actually computed, and a style change made
// in the same task as the `display` change is folded into one recalculation — so `.on` and `.open`
// set back to back would jump straight to the end. The fix is a forced reflow between them, NOT a
// nested `requestAnimationFrame`: measured 2026-08-27 in this very panel, a rAF scheduled from
// INSIDE a rAF callback never ran (`hit` stopped at 1 after 600 ms) because nothing else asked for
// a frame — a browser that paints on demand had no reason to make one. Reading a layout property
// costs one synchronous recalculation and works whether or not another frame is ever painted.
function rfFoldMs(){
  let v="";
  try{v=getComputedStyle(document.documentElement).getPropertyValue("--rf-d-pop").trim();}catch(e){}
  const n=parseFloat(v);
  if(!n)return 220;
  return /ms$/.test(v)?n:n*1000;      // the token is authored in ms, but s is legal CSS
}
function rfFoldSetOpen(wrap,open){
  if(!wrap)return;
  const want=!!open;
  // The wanted state lives on the element, so a toggle pressed twice in a row cannot have the
  // previous press's timer or animation frame land on top of the newer answer.
  wrap._rfFoldWant=want;
  clearTimeout(wrap._rfFoldT);
  if(want){
    wrap.classList.add("on");                 // laid out, still collapsed
    void wrap.offsetHeight;                   // …computed, so 0fr is the transition's FROM…
    wrap.classList.add("open");               // …and this is the TO. One task, no frames needed.
  }else{
    wrap.classList.remove("open");     // slides shut on the transition…
    wrap._rfFoldT=setTimeout(function(){
      if(!wrap._rfFoldWant)wrap.classList.remove("on");   // …and only THEN leaves the layout
    },rfFoldMs()+40);
  }
}
// „There is nothing to fold" — a different question from „it is closed", and it must not wait for
// an animation: the fold is gone this instant, timers and all.
function rfFoldHide(wrap){
  if(!wrap)return;
  wrap._rfFoldWant=false;
  clearTimeout(wrap._rfFoldT);
  wrap.classList.remove("open");wrap.classList.remove("on");
}

