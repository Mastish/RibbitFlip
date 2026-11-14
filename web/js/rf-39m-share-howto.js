"use strict";
// ================= HOW SHARING WORKS — three frames, read left to right =================
// This window used to draw the exchange as a ring: four stations in the four corners, arrows
// between them, and the honest split (what YOU do vs what the APP does) hidden behind a click.
// Four faults, all of them fatal for somebody who has never shared anything:
//   1. corners make the eye walk 1, 2, 4, 3 — the story arrives out of order;
//   2. the dashed promise strips looked like fields waiting to be filled in;
//   3. the most valuable text in the window was BLANK until a box happened to get clicked;
//   4. the labels named PLACES („on your machine", „a thread in #zestawy"), not events.
//
// So it is a comic strip now. Three frames, left to right, nothing folded away, no click needed
// to understand any of it. Each frame says who does what in it — both lines always visible — and
// carries the one promise that holds at that point. The ring survives as a single closing line,
// because „and round it goes" is one sentence, not a diagram.
//
// The chips below the strip are unchanged: they are the only INTERACTIVE part, and they answer a
// different question („where is that button?"), so being the one clickable row is a help.

const RFH_SEEN = "ribbitflip.shareHowToSeen";
let _rfhBack = null;
let _rfhPrevFocus = null;

function rfShareHowToSeen() {
  try { return localStorage.getItem(RFH_SEEN) === "1"; } catch (e) { return true; }
}
// Marking it seen has to take the „zacznij tu" chip off the doors that are ALREADY on screen. The
// hero row in the Zestawy tab is static markup that never re-renders, so before 2026-09-02 opening
// this window from the exchange hub (a different door, same window) left that chip sitting there
// until a reload — the app going on telling somebody to start where they had already been.
function _rfhMarkSeen() {
  try { localStorage.setItem(RFH_SEEN, "1"); } catch (e) {}
  try {
    document.querySelectorAll(".xh-badge, .pdc-badge").forEach(function (b) { b.remove(); });
  } catch (e) {}
}

// The three beats. `sure` is the promise that holds at that beat — it rides inside the frame on a
// FILLED tint, never on a dashed outline, because a dashed box next to a sentence reads as an
// empty form field and that is exactly the wrong invitation here.
function _rfhFrames() {
  return [
    {n: "1", cls: "hwx-1",
     t: _gl("Dzielisz się", "You share it"),
     rows: [
       {who: _gl("Ty:", "You:"),
        what: _gl("klikasz „Podziel się”, a gotowy post wklejasz na forum #zestawy.",
                  "you hit “Share” and paste the ready-made post on the #zestawy forum.")},
       {who: _gl("Aplikacja:", "The app:"),
        what: _gl("pakuje Twoje ustawienia do pliku .json i sama układa post: tytuł, tagi, treść.",
                  "packs your settings into a .json file and writes the post for you: the title, the tags, the body.")}
     ],
     sure: _gl("W pliku nie ma haseł, tokenów ani niczego o Twoim komputerze.",
               "The file carries no passwords, no tokens, nothing about your computer.")},
    {n: "2", cls: "hwx-2",
     t: _gl("Ktoś to bierze", "Somebody takes it"),
     rows: [
       {who: _gl("Druga osoba:", "The other person:"),
        what: _gl("klika „Wczytaj plik lub odnośnik” i wkleja odnośnik do Twojego pliku.",
                  "hits “Load a file or link” and pastes the link to your file.")},
       {who: _gl("Aplikacja:", "The app:"),
        what: _gl("najpierw pokazuje, co plik zmieni, robi kopię jej ustawień i zostawia „Cofnij”.",
                  "first shows what the file will change, saves a copy of their settings and leaves an “Undo”.")}
     ],
     sure: _gl("Obcy plik niczego nie naciśnie sam: makra wymagają osobnej zgody.",
               "A stranger's file presses nothing on its own: macros need a separate consent.")},
    {n: "3", cls: "hwx-3",
     t: _gl("Zestaw żyje dalej", "The set lives on"),
     rows: [
       {who: _gl("Druga osoba:", "The other person:"),
        what: _gl("gra na Twoim zestawie, a czasem coś dostroi i wrzuci własną wersję.",
                  "plays with your set, and sometimes tunes something and posts their own version.")},
       {who: _gl("Aplikacja:", "The app:"),
        what: _gl("pamięta w pliku, że zaczęło się od Ciebie: „na bazie: Ty”.",
                  "remembers in the file that it started with you: “based on: you”.")}
     ],
     sure: _gl("Podzielenie się to chwila, a komuś może sprawić sporo dobrej zabawy.",
               "Sharing takes a moment and can give somebody a lot of good fun.")}
  ];
}

// What can be sent — and WHERE it is made, which is the part worth a click.
const RFH_KINDS = [
  // The chip points at the „Wymiana" button, not at the whole card: a flash on one button says
  // „this is what you press", a flash on a card the size of the screen says nothing.
  {t: ["Zestaw", "Setup"], tip: ["Wszystko pod jedną grę dla jednego kapsla.", "Everything for one game and one capsule."],
   go: {tab: "konfiguracje", sel: "#setupShare"}},
  {t: ["Preset wyzwalaczy", "Trigger preset"], tip: ["Same reguły próg → klawisz.", "Nothing but the threshold → key rules."],
   go: {tab: "mapowanie", sel: "#profDiscord"}},
  {t: ["Preset osi 3D", "3D axis preset"], tip: ["Samo strojenie kapsla.", "Nothing but the capsule tuning."],
   go: {tab: "czujnik", sel: "#posePresetDiscord"}},
  {t: ["Paczka REST", "REST pack"], tip: ["Wywołania HTTP z ruchami, bez tokenów.", "HTTP calls with their movements, no tokens."],
   go: {tab: "restapi", sel: ".ra-toolbar"}},
  {t: ["Kilka kapsli", "Several capsules"], tip: ["Cały rig z rolą przy każdym kapslu.", "The whole rig, with a role per capsule."],
   go: {tab: "konfiguracje", sel: "#bundleDiscord"}}
];

// One frame of the strip. The <li> carries the beat, the arrow is parked absolutely in the gap to
// its right — so the <ol> keeps exactly three children and the browser's own numbering stays
// honest for a screen reader, while the drawn number circle stays decorative.
function _rfhFrameEl(f, withArrow) {
  const li = document.createElement("li");
  li.className = "hwx-step " + f.cls;

  const head = document.createElement("div"); head.className = "hwx-head";
  const ic = document.createElement("span");
  ic.className = "hwx-ic"; ic.setAttribute("aria-hidden", "true");
  const htx = document.createElement("div"); htx.className = "hwx-htx";
  const num = document.createElement("span");
  num.className = "hwx-num"; num.setAttribute("aria-hidden", "true");
  num.setAttribute("data-noi18n", ""); num.textContent = f.n;
  const t = document.createElement("span"); t.className = "hwx-t"; t.textContent = f.t;
  htx.appendChild(num); htx.appendChild(t);
  head.appendChild(ic); head.appendChild(htx);
  li.appendChild(head);

  // Both lines, always. The split between „you" and „the app" IS the argument for taking part, so
  // it cannot be the thing that only appears once somebody guesses to click.
  f.rows.forEach(function (r) {
    const p = document.createElement("p"); p.className = "hwx-line";
    const who = document.createElement("b"); who.className = "hwx-who"; who.textContent = r.who;
    p.appendChild(who);
    p.appendChild(document.createTextNode(" " + r.what));
    li.appendChild(p);
  });

  const sure = document.createElement("p"); sure.className = "hwx-sure";
  const sic = document.createElement("span");
  sic.className = "hwx-sic"; sic.setAttribute("aria-hidden", "true");
  sure.appendChild(sic);
  sure.appendChild(document.createTextNode(f.sure));
  li.appendChild(sure);

  if (withArrow) {
    const arr = document.createElement("span");
    arr.className = "hwx-arr"; arr.setAttribute("aria-hidden", "true");
    arr.setAttribute("data-noi18n", ""); arr.textContent = "→";
    li.appendChild(arr);
  }
  return li;
}

function rfShareHowToClose() {
  const back = _rfhBack;
  if (!back) return;
  _rfhBack = null;
  document.removeEventListener("keydown", back._onKey, true);
  back.classList.add("out");
  setTimeout(function () { try { back.remove(); } catch (e) {} }, 160);
  try { if (_rfhPrevFocus && _rfhPrevFocus.focus) _rfhPrevFocus.focus(); } catch (e) {}
  _rfhPrevFocus = null;
}

// Close, switch tab, scroll, blink. Being SHOWN the bar beats being told which tab it lives in,
// and the blink is what stops "it scrolled somewhere" from being the end of the journey.
function _rfhGoTo(where) {
  rfShareHowToClose();
  if (!where) return;
  try { if (window.setTabById) window.setTabById(where.tab); } catch (e) {}
  setTimeout(function () {
    let el = null;
    try { el = document.querySelector(where.sel); } catch (e) {}
    if (!el) return;
    // Od 2026-08-31 pozycje „Reszty" mają własny pasek dwóch zakładek (rf-49p), więc cel może
    // siedzieć w tej schowanej. Przewijanie do czegoś bez wymiaru kończy się niczym i niczym nie
    // miga, a człowiek zostaje z wrażeniem, że przycisk nic nie robi.
    try { if (window.rfRestTabs) window.rfRestTabs.reveal(el); } catch (e) {}
    // Cel bywa w zwiniętym zwijaku piętra 2 albo 3 (UX 261120), więc otwieramy go jak rfReady.show.
    for (let d = el.closest && el.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) d.open = true;
    // Both setup chips (#setupShare, #bundleDiscord) live inside the library card's save row now,
    // and that row is HIDDEN while the library is showing presets rather than setups. Scrolling to
    // something hidden lands nowhere and blinks nothing, so switch the drawer back to "Zestawy"
    // first — the same click the person would have made on arriving.
    try {
      if (el.closest && el.closest("#setupSaveRow[hidden]")) {
        const kb = document.querySelector('.lib-kind[data-kind="setup"]');
        if (kb) kb.click();
      }
    } catch (e) {}
    // The multi-capsule door only exists with two capsules paired. With one, that chip has nothing
    // to point at, so it points at the row the door would appear in instead of at nothing at all.
    if (el.offsetParent === null) {
      const alt = document.getElementById("setupSaveRow");
      if (!alt || alt.offsetParent === null) return;
      el = alt;
    }
    try { el.scrollIntoView({block: "center", behavior: "smooth"}); } catch (e) { try { el.scrollIntoView(); } catch (e2) {} }
    const host = el.closest(".card, .trigbar, .pose-presets, .setupbar, .ra-toolbar") || el;
    host.classList.add("rfh-blink");
    setTimeout(function () { host.classList.remove("rfh-blink"); }, 2400);
  }, 260);
}

function rfShareHowTo() {
  if (_rfhBack) return;
  _rfhMarkSeen();
  _rfhPrevFocus = document.activeElement;

  const back = document.createElement("div");
  // The id is how the windows underneath know to keep their hands off the Escape key while this
  // one is up — it can open ON TOP of the share wizard (rf-39f), whose handler runs first.
  back.id = "rfHowTo";
  back.className = "rfk-back rfh-back"; back.setAttribute("role", "presentation");
  const card = document.createElement("div");
  card.className = "rfk-card rfh-card";
  card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", _gl("Jak działa dzielenie się", "How sharing works"));

  const head = document.createElement("div"); head.className = "rfk-head";
  const h = document.createElement("h3"); h.className = "rfk-title";
  h.textContent = _gl("Jak działa dzielenie się", "How sharing works");
  const x = document.createElement("button"); x.type = "button"; x.className = "rfk-x";
  x.setAttribute("aria-label", _gl("Zamknij", "Close")); x.textContent = "×";
  x.addEventListener("click", rfShareHowToClose);
  head.appendChild(h); head.appendChild(x);

  const body = document.createElement("div"); body.className = "rfh-body";
  const intro = document.createElement("p"); intro.className = "rfh-intro";
  intro.textContent = _gl("Cała wymiana to jeden plik .json, który krąży między ludźmi. Nic poza nim nie wychodzi z Twojego komputera.",
                          "The whole exchange is one .json file passed between people. Nothing else leaves your computer.");
  body.appendChild(intro);

  const strip = document.createElement("ol"); strip.className = "hwx-strip";
  const frames = _rfhFrames();
  frames.forEach(function (f, i) {
    strip.appendChild(_rfhFrameEl(f, i < frames.length - 1));
  });
  body.appendChild(strip);

  // The loop, in one line instead of a ring: the fourth station of the old graph said nothing the
  // third frame does not already say, except that it happens again.
  const loop = document.createElement("p"); loop.className = "hwx-loop";
  const loopIc = document.createElement("span");
  loopIc.className = "hwx-loopic"; loopIc.setAttribute("aria-hidden", "true");
  loopIc.setAttribute("data-noi18n", ""); loopIc.textContent = "↻";
  loop.appendChild(loopIc);
  loop.appendChild(document.createTextNode(
    _gl("I tak w kółko: każda wersja może być czyimś punktem wyjścia.",
        "And round it goes: every version can be somebody's starting point.")));
  body.appendChild(loop);

  const lab = document.createElement("div"); lab.className = "rfh-lab";
  lab.textContent = _gl("Co możesz wysłać? Kliknij, a podświetlę miejsce:",
                        "What can you send? Click and I will highlight the place:");
  body.appendChild(lab);
  const chips = document.createElement("div"); chips.className = "rfh-chips";
  RFH_KINDS.forEach(function (k) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "rfh-chip";
    b.textContent = _gl(k.t[0], k.t[1]);
    b.title = _gl(k.tip[0], k.tip[1]);
    b.addEventListener("click", function () { _rfhGoTo(k.go); });
    chips.appendChild(b);
  });
  body.appendChild(chips);

  // NO forum link in this footer, on purpose (removed 2026-09-02). This window is the LESSON, and
  // the room it talks about is one click away from four other places on the same screen — the hero
  // tile „Zobacz forum ↗" right behind it, the exchange hub's own row, the wizard's last step and
  // the import window. A fifth door here only made the window look like one more menu; the first
  // frame above already names #zestawy in its own sentence, which is what somebody reading a lesson
  // actually needs.
  const foot = document.createElement("div"); foot.className = "rfk-foot rfh-foot";
  const spacer = document.createElement("span"); spacer.className = "rfk-note";
  // The other drawing: this one tells the STORY, that one maps the FILES. They answer different
  // halves of the same confusion, so each points at the other.
  const draw = document.createElement("button");
  draw.type = "button"; draw.className = "btn sm";
  draw.textContent = _gl("Rysunek: co jest czym", "The drawing: what is what");
  draw.addEventListener("click", function () {
    rfShareHowToClose();
    try { if (window.setTabById) window.setTabById("konfiguracje"); } catch (e) {}
    setTimeout(function () {
      const d = document.getElementById("whatis-fold");
      if (!d) return;
      // Rysunek pojechał do zakładki „Informacje" razem z resztą tego, co się czyta (rf-49p) —
      // najpierw ją otwieramy, dopiero potem rozwijamy blok i przewijamy.
      try { if (window.rfRestTabs) window.rfRestTabs.reveal(d); } catch (e) {}
      d.open = true;
      try { d.scrollIntoView({block: "start", behavior: "smooth"}); } catch (e) {}
      d.classList.add("rfh-blink");
      setTimeout(function () { d.classList.remove("rfh-blink"); }, 2400);
    }, 260);
  });
  const ok = document.createElement("button");
  ok.type = "button"; ok.className = "btn sm primary";
  ok.textContent = _gl("Jasne", "Got it");
  ok.addEventListener("click", rfShareHowToClose);
  foot.appendChild(spacer); foot.appendChild(draw); foot.appendChild(ok);

  card.appendChild(head); card.appendChild(body); card.appendChild(foot);
  back.appendChild(card);
  back.addEventListener("mousedown", function (e) { if (e.target === back) rfShareHowToClose(); });
  back._onKey = function (e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); rfShareHowToClose(); return; }
    if (e.key !== "Tab") return;
    // Nothing in the strip is focusable any more — the frames are prose, not controls — so the
    // trap is just the links and the buttons.
    const f = Array.prototype.filter.call(
      card.querySelectorAll("a[href],button:not([disabled])"),
      function (el) { return el.getBoundingClientRect().width > 0; });
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener("keydown", back._onKey, true);
  document.body.appendChild(back);
  _rfhBack = back;
  try { if (typeof applyLang === "function") applyLang(back); } catch (e) {}
  setTimeout(function () { try { ok.focus(); } catch (e) {} }, 30);
}

window.rfShareHowTo = rfShareHowTo;
window.rfShareHowToClose = rfShareHowToClose;
window.rfShareHowToSeen = rfShareHowToSeen;
