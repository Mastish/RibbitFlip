"use strict";
// ===================== TIP JAR — KO-FI PANEL INSIDE THE APP =====================
// Clicking the mug in the corner used to throw the user out into a browser tab. Now it opens
// Ko-fi's own donation panel in a dialog on top of the dashboard: fewer steps between "this was
// useful" and actually tipping, and the app stays where it was.
//
// Why not Ko-fi's `overlay-widget.js` (the snippet their site hands out):
//   • it fetches a script from storage.ko-fi.com at EVERY app start — the app then depends on an
//     external CDN to boot, and the request happens whether or not anyone cares about tipping,
//   • our CSP is `default-src 'none'; script-src 'self' 'unsafe-inline'` — a CDN script is blocked
//     outright, and loosening script-src for a third party is a much bigger hole than one frame,
//   • it draws its OWN floating button, which would land next to the felt mug as a second,
//     off-brand copy of the same thing.
// The panel the widget shows is just an iframe of Ko-fi's embed URL, so we load that ourselves —
// on click, never before. The app makes zero outbound requests until the mug is pressed.
//
// The frame is cross-origin: it cannot read the dashboard (nor its session token), and we cannot
// read it. The whole payment happens on Ko-fi's side, which is also what the footnote tells the
// user. Ko-fi needs `allow="payment"` to offer the wallet buttons (Apple/Google Pay) in a frame.
//
// CSP: serving this needs `frame-src https://ko-fi.com https://*.ko-fi.com` in _serve_html
// (ribbitflip_monitor.py). Without it the frame stays blank and only the fallback link works.

const RFK_EMBED = "https://ko-fi.com/mastish/?hidefeed=true&widget=true&embed=true&preview=true";
const RFK_PAGE  = "https://ko-fi.com/mastish";
// The iframe's `load` fires only once EVERY subresource is in, which on Ko-fi routinely takes
// 6-8 s — long after the donation form itself is painted. Waiting for it would leave a spinner
// on top of a working panel, so the cover comes off at RFK_REVEAL_MS whether or not `load` has
// arrived. RFK_SLOW_MS is the separate, much later "this really is not coming" line, and it goes
// in the footer rather than over the frame, so it can never hide a panel that did show up.
const RFK_REVEAL_MS = 3500;
const RFK_SLOW_MS = 14000;

let _rfkBack = null;             // the open dialog, or null
let _rfkPrevFocus = null;        // what to give the focus back to on close
let _rfkRevealTmr = 0, _rfkSlowTmr = 0;

function _rfkFocusables(root) {
  return Array.prototype.filter.call(
    root.querySelectorAll('a[href],button:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])'),
    function (el) { return el.offsetParent !== null || el.tagName === "IFRAME"; });
}

function rfKofiClose() {
  const back = _rfkBack;
  if (!back) return;
  _rfkBack = null;
  clearTimeout(_rfkRevealTmr); clearTimeout(_rfkSlowTmr);
  document.removeEventListener("keydown", back._onKey, true);
  // Drop the frame BEFORE the fade-out: removing the element is what actually ends Ko-fi's
  // connection, and leaving it alive for the animation would keep a third-party page running.
  try { const f = back.querySelector(".rfk-frame"); if (f) f.remove(); } catch (e) {}
  back.classList.add("out");
  setTimeout(function () { try { back.remove(); } catch (e) {} }, 160);
  try { if (_rfkPrevFocus && _rfkPrevFocus.focus) _rfkPrevFocus.focus(); } catch (e) {}
  _rfkPrevFocus = null;
}

function rfKofiOpen() {
  if (_rfkBack) return;                                   // already up — the mug is not a toggle
  _rfkPrevFocus = document.activeElement;

  const back = document.createElement("div");
  back.className = "rfk-back";
  back.setAttribute("role", "presentation");

  const card = document.createElement("div");
  card.className = "rfk-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", "Postaw mi kawę na Ko-fi");

  // — head: title + close —
  const head = document.createElement("div"); head.className = "rfk-head";
  const h = document.createElement("h3"); h.className = "rfk-title"; h.textContent = "Postaw mi kawę";
  const x = document.createElement("button"); x.type = "button"; x.className = "rfk-x";
  x.setAttribute("aria-label", "Zamknij"); x.textContent = "×";
  x.addEventListener("click", rfKofiClose);
  head.appendChild(h); head.appendChild(x);

  // — body: the embed, with a loader on top until Ko-fi paints —
  const body = document.createElement("div"); body.className = "rfk-body";
  const load = document.createElement("div"); load.className = "rfk-load";
  const spin = document.createElement("span"); spin.className = "rfk-spin"; spin.setAttribute("aria-hidden", "true");
  const ltx = document.createElement("span"); ltx.className = "rfk-load-tx"; ltx.textContent = "Wczytuję Ko-fi…";
  load.appendChild(spin); load.appendChild(ltx);

  const frame = document.createElement("iframe");
  frame.className = "rfk-frame";
  frame.title = "Ko-fi";
  frame.setAttribute("allow", "payment");
  let loaded = false;
  frame.addEventListener("load", function () {
    loaded = true;
    clearTimeout(_rfkRevealTmr); clearTimeout(_rfkSlowTmr);
    load.classList.add("done");
  });
  frame.src = RFK_EMBED;                                   // first and only outbound request
  _rfkRevealTmr = setTimeout(function () { load.classList.add("done"); }, RFK_REVEAL_MS);
  body.appendChild(frame); body.appendChild(load);

  // — foot: who takes the money, the "still nothing" line, and the way out to a normal tab —
  const foot = document.createElement("div"); foot.className = "rfk-foot";
  const note = document.createElement("span"); note.className = "rfk-note";
  note.textContent = "Płatność obsługuje Ko-fi. RibbitFlip nie widzi Twoich danych.";
  const warn = document.createElement("span"); warn.className = "rfk-warn"; warn.hidden = true;
  warn.textContent = "Ko-fi się nie wczytuje. Sprawdź połączenie z internetem.";
  foot.appendChild(note); foot.appendChild(warn);

  // Osobny rząd MIĘDZY ramką a stopką, nie w stopce: stopka jest przypisem (kto bierze pieniądze),
  // a to jest druga droga do tego samego, więc stoi tam, gdzie się patrzy, gdy ramka milczy.
  const outRow = document.createElement("div"); outRow.className = "rfk-outrow";
  const out = document.createElement("a"); out.className = "btn sm rfk-outbtn";
  out.href = RFK_PAGE; out.target = "_blank"; out.rel = "noopener noreferrer";
  out.textContent = "Otwórz Ko-fi w przeglądarce ↗";
  outRow.appendChild(out);
  _rfkSlowTmr = setTimeout(function () {
    // Nothing finished loading in 14 s. Say so NEXT TO the escape hatch instead of over the
    // frame — a blocked frame (CSP, X-Frame-Options) still fires `load` and lands here as a
    // white rectangle, so the note has to be a hint, not a verdict.
    if (!loaded) { warn.hidden = false; note.hidden = true; }
  }, RFK_SLOW_MS);

  card.appendChild(head); card.appendChild(body); card.appendChild(outRow); card.appendChild(foot);
  back.appendChild(card);

  back.addEventListener("mousedown", function (e) { if (e.target === back) rfKofiClose(); });
  back._onKey = function (e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); rfKofiClose(); return; }
    if (e.key !== "Tab") return;
    // Light focus trap. Once the focus is inside the cross-origin frame we stop seeing keys at
    // all, so this only guards the edges of our own chrome — enough to keep Tab out of the page
    // behind the backdrop when the user starts from the close button.
    const f = _rfkFocusables(card); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener("keydown", back._onKey, true);

  document.body.appendChild(back);
  _rfkBack = back;
  try { if (typeof applyLang === "function") applyLang(back); } catch (e) {}   // translate before paint
  setTimeout(function () { try { x.focus(); } catch (e) {} }, 30);
}

// PRZYPIĘTY DO DOŁU PRAWEJ KOLUMNY (UX 261120, D6). Pływając w rogu okna zasłaniał „Steruj ręcznie”
// i dół kolumny. Gdy prawa kolumna stoi jako kolumna (≥1280 px, rozwinięta), kubek jest jej
// ostatnim dzieckiem z `position:sticky` (13-dialogs-overview.css): kolumna przewija się POD nim,
// więc niczego nie zasłania, a klik dalej otwiera Ko-fi. Zwinięta kolumna i poziomy pas (<1280 px)
// nie mają na niego miejsca, więc wtedy wraca do `<body>` i pływa w rogu jak dawniej. Przenoszony
// między dwoma rodzicami, a nie przestawiany samym CSS-em, bo kolumna ma maskę krawędzi i własne
// przewijanie: pływający kubek w jej środku byłby przez nie przycinany.
// WHY: sticky inside the expanded column, fixed in <body> otherwise; the node moves, never rebuilt.
function _rfkPlace() {
  const box = document.getElementById("rfKofi"), rcol = document.getElementById("rfRcol");
  if (!box || !rcol) return;
  const wide = !window.matchMedia || window.matchMedia("(min-width:1280px)").matches;
  const into = wide && !document.body.classList.contains("rp-collapsed") ? rcol : document.body;
  if (box.parentNode !== into) into.appendChild(box);
}
function _rfkPlaceInit() {
  _rfkPlace();
  try { window.matchMedia("(min-width:1280px)").addEventListener("change", _rfkPlace); } catch (e) {}
  try {
    new MutationObserver(_rfkPlace).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  } catch (e) {}
}

function initKofi() {
  const btn = document.getElementById("rfKofiBtn");
  if (!btn) return;
  _rfkPlaceInit();
  btn.addEventListener("click", function (e) {
    // Modifier / middle clicks keep their normal meaning: open the real href in a new tab. Only
    // a plain left click is ours.
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    rfKofiOpen();
  });
}

window.rfKofiOpen = rfKofiOpen;
window.rfKofiClose = rfKofiClose;
