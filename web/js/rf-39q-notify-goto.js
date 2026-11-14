"use strict";
// ===================== CLICK ON A SYSTEM NOTIFICATION = GO THERE =====================
// Owner, 2026-09-29: clicking the Windows balloon should take you to the thing the notification is
// about and highlight it. The server knows which balloon was clicked (SystemNotifier.last_target)
// and reaches this page one of two ways (notify_goto in ribbitflip_monitor.py):
//   • the panel is open  → the server brings its window forward and sends the SSE event `goto`,
//   • the panel is shut  → the server opens a new one at /?goto=<json>, read once at boot below.
// Either way it is the same target, already cleaned on the server (notify_target):
//   {kind:"rule", dev, id}          a Mapping or Controller rule (its row, on its capsule)
//   {kind:"rest", api, id}          a REST API trigger (Network services › Triggers)
//   {kind:"card", tab?, sel?, dev?} a card or a control, e.g. the "⏻ Uzbrojone" switch
//
// The blink is the one from "How to share" (rf-39m `_rfhGoTo`, class .rfh-blink): the app already
// has a way of saying "here", and a second one would read as a different kind of message.

const RFG_WAIT_MS = 6000;   // rules and REST cards arrive over the stream: a fresh page needs a moment
const RFG_STEP_MS = 150;
let _rfgRun = 0;            // a newer click cancels the search started by an older one

function _rfgT(pl, en) { try { if (typeof _gl === "function") return _gl(pl, en); } catch (e) {} return pl; }
function _rfgSel(v) { return String(v == null ? "" : v).replace(/["\\\]]/g, ""); }

function _rfgTab(id) {
  try { if (id && window.setTabById) window.setTabById(id); } catch (e) {}
}

// The element the target points at, or null while it is not on the page (yet).
function _rfgFind(t) {
  if (t.kind === "rule") {
    // The same rule can be drawn in Mapowanie and in the Kontroler pad list (rf-43 reuses _ruleRow).
    // Pick the copy that lives in a tab panel; a pad rule lives only in Kontroler.
    const all = document.querySelectorAll('.rule-wrap[data-id="' + _rfgSel(t.id) + '"]');
    for (const el of all) if (el.closest(".tab-panel")) return el;
    return null;
  }
  if (t.kind === "rest") {
    const card = document.querySelector('.ra-app[data-id="' + _rfgSel(t.api) + '"]');
    if (!card) return null;
    // The trigger list sits behind the card's own "Wyzwalacze" sub-tab.
    const st = card.querySelector('.ra-st[data-st="triggers"]');
    if (st && !st.classList.contains("on")) try { st.click(); } catch (e) {}
    return card.querySelector('.ra-trig[data-tid="' + _rfgSel(t.id) + '"]');
  }
  if (t.sel) { try { return document.querySelector(t.sel); } catch (e) { return null; } }
  return null;
}

function _rfgShow(t, el) {
  // Put the element's own tab in front — for a rule that is where it actually lives, which is not
  // always the tab the target named.
  const panel = el.closest(".tab-panel");
  if (panel && panel.id && !panel.classList.contains("active")) _rfgTab(panel.id.replace(/^tab-/, ""));
  // Folded sections and the two-tab strip of "Everything else" (rf-49p) would leave it without a size.
  for (let d = el.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) d.open = true;
  try { if (window.rfRestTabs) window.rfRestTabs.reveal(el); } catch (e) {}
  const host = (t.kind === "rule" && el.querySelector(".rule")) || el;
  // A page in the background runs neither smooth scrolling nor animations, and the `goto` event can
  // arrive a moment BEFORE the server has brought the window forward. So: jump straight there, and
  // keep the blink until the page is actually visible.
  const seen = document.visibilityState === "visible";
  try { host.scrollIntoView({ block: "center", behavior: seen ? "smooth" : "auto" }); } catch (e) { try { host.scrollIntoView(); } catch (e2) {} }
  _rfgBlinkWhenSeen(t, host, 0);
}

function _rfgBlinkWhenSeen(t, host, tries) {
  if (document.visibilityState !== "visible" && tries < 20) {
    setTimeout(function () { _rfgBlinkWhenSeen(t, host, tries + 1); }, 150);
    return;
  }
  host.classList.remove("rfh-blink");
  void host.offsetWidth;                       // restart the animation when the same row is clicked twice
  host.classList.add("rfh-blink");
  setTimeout(function () { host.classList.remove("rfh-blink"); }, 2600);
  // A fresh page draws the rule list more than once while the stream catches up, and a redraw swaps
  // the row for a new one without the class. Checked once: if the row was replaced, blink the new one.
  setTimeout(function () {
    if (host.isConnected) return;
    const el = _rfgFind(t);
    const h2 = el && ((t.kind === "rule" && el.querySelector(".rule")) || el);
    if (!h2) return;
    try { h2.scrollIntoView({ block: "center" }); } catch (e) {}
    h2.classList.add("rfh-blink");
    setTimeout(function () { h2.classList.remove("rfh-blink"); }, 2600);
  }, 500);
}

function rfNotifyGoto(t) {
  if (!t || typeof t !== "object") return;
  const run = ++_rfgRun;
  try { window.focus(); } catch (e) {}
  // Capsule first: rule lists and several cards show the ACTIVE capsule only.
  try {
    if (t.dev && state.devices && state.devices[t.dev] && t.dev !== state.activeDeviceId
        && typeof switchDevice === "function") switchDevice(t.dev);
  } catch (e) {}
  if (t.kind === "rest") _rfgTab("restapi");
  else if (t.tab) _rfgTab(t.tab);
  else if (t.kind === "rule") _rfgTab("mapowanie");
  const t0 = Date.now();
  (function look() {
    if (run !== _rfgRun) return;
    const el = _rfgFind(t);
    if (el && el.getClientRects().length) { _rfgShow(t, el); return; }
    if (Date.now() - t0 < RFG_WAIT_MS) { setTimeout(look, RFG_STEP_MS); return; }
    // Deleted since the notification went out, or on a capsule that is gone. Say it rather than
    // leave the person on a tab wondering what they were supposed to see.
    if (typeof rfToast === "function" && t.kind !== "card") {
      rfToast(t.kind === "rule"
        ? _rfgT("Nie ma już reguły, której dotyczyło powiadomienie. Mogła zostać usunięta.",
                "The rule this notification was about is gone. It may have been deleted.")
        : _rfgT("Nie ma już wyzwalacza, którego dotyczyło powiadomienie. Mógł zostać usunięty.",
                "The trigger this notification was about is gone. It may have been deleted."),
        { ms: 5000 });
    }
  })();
}

// A panel opened by the click itself: /?goto=… — used once, then taken out of the address, so a
// reload (or a bookmark of this tab) does not replay the jump.
function initNotifyGoto() {
  let t = null;
  try {
    const q = new URLSearchParams(location.search);
    const raw = q.get("goto");
    if (!raw) return;
    t = JSON.parse(raw);
    q.delete("goto");
    const rest = q.toString();
    history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
  } catch (e) { return; }
  if (t && typeof t === "object") setTimeout(function () { rfNotifyGoto(t); }, 300);
}
