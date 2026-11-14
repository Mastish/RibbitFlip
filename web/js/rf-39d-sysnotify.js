"use strict";
// ===================== PER-TRIGGER SYSTEM NOTIFICATIONS =====================
// Switched on for ONE chosen trigger, this posts a WINDOWS notification (the tray icon's balloon,
// through POST /notify) — not an in-page toast. That is the whole point: you are inside a game or a
// DAW with the dashboard behind another window, and you still want to see that the trigger fired.
//
// Who sends what:
//   • Mapping rules      — nothing here. Their engine is the SERVER, so it notifies directly and
//     keeps working with the dashboard closed (ribbitflip_monitor.py, TriggerEngine._notify_*).
//   • REST API triggers  — this file. Their engine runs in the browser (rf-37), so the browser is
//     the only thing that knows they went off; with the dashboard closed they do not run at all.
//
// Rate limiting lives on BOTH sides: the server has the last word (one notification per key per
// 3 s, swallowed ones counted as "(x7)"), and the mirror here spares the pointless requests — a
// "repeatedly while met" REST trigger would otherwise POST four times a second forever.

const RFN_COOLDOWN_MS = 3000;      // mirror of SystemNotifier.COOLDOWN_S
const RFN_AVAIL_TTL_MS = 30000;    // how long the "can this machine notify" answer is trusted
const _rfnLast = Object.create(null);   // key -> ts of the last POST we actually made
let _rfnAvail = null;              // {avail,reason} or null when not asked yet
let _rfnAvailAt = 0;
let _rfnWarned = false;            // the "no tray, no notifications" toast is shown once per session

function _rfnT(pl, en) { try { if (typeof _gl === "function") return _gl(pl, en); } catch (e) {} return pl; }

// Notification texts are BILINGUAL by design, like the tray menu: they are rendered by Windows, and
// the server (which sends the mapping-rule ones) has no idea which language the dashboard is in.
// `target` = what a click on the balloon leads to (rf-39q, server: notify_target).
function rfNotifySend(title, message, key, silent, target) {
  const k = key || (title + "|" + message);
  const now = Date.now();
  if (now - (_rfnLast[k] || 0) < RFN_COOLDOWN_MS) return;   // the server would swallow it anyway
  _rfnLast[k] = now;
  try {
    fetch("/notify", { method: "POST", headers: { "Content-Type": "application/json" },
                       body: JSON.stringify({ title: title, message: message, key: k,
                                              silent: (silent !== false),
                                              target: target || null }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j) { _rfnAvail = { avail: !!j.avail, reason: j.reason || "" }; _rfnAvailAt = Date.now(); } })
      .catch(function () {});
  } catch (e) {}
}
// Is the machine able to show these at all? (--no-tray = no icon = no balloon.) Cached, because
// every editor asks the moment the option is switched on.
function rfNotifyAvail() {
  if (_rfnAvail && (Date.now() - _rfnAvailAt) < RFN_AVAIL_TTL_MS) return Promise.resolve(_rfnAvail);
  return fetch("/notify").then(function (r) { return r.json(); }).then(function (j) {
    _rfnAvail = { avail: !!(j && j.avail), reason: (j && j.reason) || "" };
    _rfnAvailAt = Date.now();
    return _rfnAvail;
  }).catch(function () { return { avail: true, reason: "" }; });   // server unreachable: do not cry wolf
}
// Called by an editor right after the user switches the option on: shows exactly what the real
// notification will look like, and — once per session — says so when this machine cannot show one.
// The two wrappers below build the same two lines the live paths do, so the preview cannot drift
// from the thing it is previewing.
function rfNotifyPreviewRule(name, mode, silent, text) {
  const nm = String(name || "").slice(0, 60) || _rfnT("(bez nazwy)", "(unnamed)");
  const body = String(text || "").slice(0, 120)
    || (mode === "active" ? _rfnT("Aktywny", "Active") : _rfnT("Wyzwolone", "Triggered"));
  rfNotifyPreview(_rfnT("Mapowanie", "Mapping") + " — " + nm, body, silent);
}
function rfNotifyPreviewRest(api, t, trigLabel) {
  const mode = (t && t.toast && t.toast.mode === "active");
  rfNotifyPreview(_rfnRestTitle(api, t),
                  _rfnRestBody(t, mode ? _rfnT("Aktywny", "Active") : _rfnT("Wyzwolone", "Triggered"), trigLabel),
                  !(t && t.toast && t.toast.silent === false));
}
function rfNotifyPreview(title, body, silent) {
  rfNotifyAvail().then(function (a) {
    if (!a.avail) {
      if (_rfnWarned) return;
      _rfnWarned = true;
      if (typeof rfToast === "function") {
        rfToast(a.reason === "no-tray"
          ? _rfnT("Powiadomienia systemowe wymagają ikony w zasobniku — uruchomiono z --no-tray, więc nic się nie pokaże.",
                  "System notifications need the tray icon — this run used --no-tray, so nothing will show.")
          : _rfnT("Windows odrzucił powiadomienie systemowe — sprawdź „Powiadomienia i akcje” w ustawieniach.",
                  "Windows refused the system notification — check “Notifications & actions” in settings."),
          { tone: "danger", ms: 7000 });
      }
      return;
    }
    // A preview must not be swallowed by the cooldown of the real trigger, hence its own key.
    rfNotifySend(title, body + "  ·  " + _rfnT("podgląd", "preview"),
                 "preview|" + Date.now(), silent !== false);
  });
}

// ---------- REST API triggers (engine in rf-37) ----------
function _rfnRestAction(api, t) {
  try {
    for (const a of (api && api.actions) || []) if (a && a.id === t.actionId) return String(a.name || "");
  } catch (e) {}
  return "";
}
// Line 2 of the notification: "<module> — <action>". Line 1 is the app itself ("RibbitFlip" + the
// frog, from the AppUserModelID), line 3 is the description below.
function _rfnRestTitle(api, t) {
  const an = _rfnRestAction(api, t) || String((api && api.name) || "");
  return _gl("Usługi sieciowe", "Network services") + (an ? (" — " + an) : "");
}
// Line 3: the user's own wording when they gave one, otherwise what happened and which trigger did
// it (the action's name is already on line 2, so it is not repeated here).
function _rfnRestBody(t, what, fallback) {
  const own = String((t && t.toast && t.toast.text) || "").slice(0, 120);
  if (own) return own;
  const nm = String(fallback || "").slice(0, 60);
  return what + (nm ? ("  ·  " + nm) : "");
}
// A REST trigger went off (called from _ra4Fire).
function rfNotifyRestFire(api, t, info) {
  const cfg = t && t.toast;
  if (!cfg || !cfg.on || cfg.mode === "active") return;
  rfNotifySend(_rfnRestTitle(api, t),
               _rfnRestBody(t, _rfnT("Wyzwolone", "Triggered"), info && info.label),
               "rest|" + (api && api.id) + "|" + (t && t.id), cfg.silent !== false,
               { kind: "rest", api: api && api.id, id: t && t.id });
}
// A REST motion trigger's condition became true / stopped being true (called from restOnPose on the
// edge only). Both edges share ONE key, so a value chattering around the threshold cannot dodge the
// cooldown by alternating between two of them.
function rfNotifyRestActive(api, t, dev, on, label) {
  const cfg = t && t.toast;
  if (!cfg || !cfg.on || cfg.mode !== "active") return;
  rfNotifySend(_rfnRestTitle(api, t),
               _rfnRestBody(t, on ? _rfnT("Aktywny", "Active") : _rfnT("Koniec", "Released"), label),
               "rest-act|" + (api && api.id) + "|" + (t && t.id) + "|" + dev, cfg.silent !== false,
               { kind: "rest", api: api && api.id, id: t && t.id });
}
