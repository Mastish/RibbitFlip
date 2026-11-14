"use strict";
// ============ WHICH CAPSULE DOES WHAT — ROLES IN A MULTI-CAPSULE SET ============
// A game can need two capsules doing different jobs: one steers, the other jumps and shoots. The
// file for that already existed — a bundle carries every capsule's configuration — but it travelled
// as "device 0, device 1", and those numbers are PAIRING ORDER, which is nobody's business but the
// machine that paired them. Applied positionally on somebody else's computer, the steering could
// land on the capsule they hold in the wrong hand, and nothing would say so.
//
// So a shared bundle carries ROLES: what each capsule does, in the author's words ("Kierowanie",
// "Skok i strzał"), plus an optional note ("trzymasz w lewej ręce"). On the way in, the reader is
// asked which of THEIR capsules takes which role — with the app's own identification trick as the
// hint, because "shake it and its pill lights up" answers "which one is this?" better than any
// dropdown label can.
//
// Two halves live here: the author's side (roles remembered per slot, written into the file at
// export) and the reader's side (the mapping dialog). Both are small; what they replace is a silent
// wrong guess.

const RFBR_KEY = "ribbitflip.bundleRoles";   // {slot: {name, note}} — the author's own wording

function rfBundleRoles() {
  try { const v = JSON.parse(localStorage.getItem(RFBR_KEY) || "{}"); return (v && typeof v === "object") ? v : {}; }
  catch (e) { return {}; }
}
function rfBundleRoleSet(slot, role) {
  if (!slot) return;
  const all = rfBundleRoles();
  const nm = String((role && role.name) || "").slice(0, 40).trim();
  const note = String((role && role.note) || "").slice(0, 120).trim();
  if (!nm && !note) delete all[slot]; else all[slot] = {name: nm, note: note};
  try { localStorage.setItem(RFBR_KEY, JSON.stringify(all)); } catch (e) {}
}
// The label to start from when nobody has written a role yet: what the author calls that capsule.
// "Triki 1" is a poor role and the export step says so — but it is still better than "d0", and it
// costs the author nothing when they do not care.
function rfBundleRoleDefault(slot) {
  try {
    const D = (state.devices || {})[slot];
    const m = (D && D.meta) || {};
    return m.label || m.name || slot;
  } catch (e) { return slot; }
}
// Stamp the remembered roles into an envelope on its way out. Called by every export path, so a
// bundle downloaded from the wizard and one downloaded from the Library carry the same thing.
function rfBundleStampRoles(env) {
  if (!env || !Array.isArray(env.devices)) return env;
  const all = rfBundleRoles();
  env.devices.forEach(function (dv) {
    if (!dv || !dv.slot) return;
    const r = all[dv.slot];
    const nm = (r && r.name) || rfBundleRoleDefault(dv.slot);
    const note = (r && r.note) || "";
    dv.role = {name: String(nm || "").slice(0, 40), note: String(note || "").slice(0, 120)};
  });
  return env;
}

// ---- the reader's side: which of my capsules takes which role ----------------
let _brmBack = null;

function _brmLocal() {
  try {
    return Object.values(state.devices || {})
      .filter(function (D) { return D && D.meta && D.meta.dev; })
      .sort(function (a, b) { return (a.meta.slot || 0) - (b.meta.slot || 0); })
      .map(function (D) { return {id: D.meta.dev, name: D.meta.label || D.meta.name || D.meta.dev}; });
  } catch (e) { return []; }
}
const _BRM_GROUP = {rules: ["wyzwalacze", "triggers"], mouse: ["sterowanie ruchem", "motion control"],
                    midi: ["MIDI/OSC", "MIDI/OSC"], pose: ["osie 3D", "3D axes"],
                    power: ["bateria", "battery"]};
function _brmGroups(g) {
  return (g || []).map(function (k) { const v = _BRM_GROUP[k]; return v ? _gl(v[0], v[1]) : null; })
                  .filter(Boolean);
}
// „⚠ niezapisane zmiany" przy nazwie kapsla w rozwijanej liście. Pusty napis, gdy nie ma czego
// stracić albo gdy bramka (rf-29f) nie doszła — brak odpowiedzi to nie jest powód, żeby zgadywać.
function _brmLossMark(dev, groups) {
  if (typeof rfSetupGuardRisk !== "function") return "";
  let risk = [];
  try { risk = rfSetupGuardRisk(groups || [], [dev]) || []; } catch (e) { return ""; }
  const real = risk.filter(function (r) { return r.why === "dirty" || r.why === "gone"; });
  return real.length ? ("  ⚠ " + _gl("niezapisane zmiany", "unsaved changes")) : "";
}

function rfBundleMapClose() {
  const back = _brmBack;
  if (!back) return;
  _brmBack = null;
  document.removeEventListener("keydown", back._onKey, true);
  back.classList.add("out");
  setTimeout(function () { try { back.remove(); } catch (e) {} }, 160);
}

// analysis = the /bundle/analyze answer (devices[] with role, devName and groups).
// Resolves to an array as long as analysis.devices — a local slot id per role, or null to skip —
// or to null when the reader backs out.
//
// `nextStep` = „po tym oknie idzie jeszcze jedno" (od 2026-09-13 idzie: bramka „co stracisz",
// rf-29f). Przycisk nazywa wtedy to, co naprawdę robi — „Dalej". Przycisk z napisem „Wczytaj",
// który otwiera kolejne okno zamiast wczytać, dawał dokładnie ten objaw:
// „nie wczytano presetu, a tylko zakomunikowano, że tak się stanie".
function rfBundleMap(analysis, nextStep) {
  return new Promise(function (resolve) {
    const devs = (analysis && Array.isArray(analysis.devices)) ? analysis.devices : [];
    const mine = _brmLocal();
    // One capsule on both sides is not a decision — there is exactly one answer, so do not stage
    // a dialog to hear it.
    if (devs.length <= 1 && mine.length <= 1) { resolve(mine.length ? [mine[0].id] : [null]); return; }

    const pick = devs.map(function (d, i) { return (i < mine.length) ? mine[i].id : null; });

    const back = document.createElement("div");
    back.className = "rfk-back brm-back"; back.setAttribute("role", "presentation");
    const card = document.createElement("div");
    card.className = "rfk-card brm-card";
    card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", _gl("Który kapsel do której roli", "Which capsule takes which role"));

    const head = document.createElement("div"); head.className = "rfk-head";
    const h = document.createElement("h3"); h.className = "rfk-title";
    h.textContent = _gl("Który kapsel do której roli?", "Which capsule takes which role?");
    const x = document.createElement("button"); x.type = "button"; x.className = "rfk-x";
    x.setAttribute("aria-label", _gl("Zamknij", "Close")); x.textContent = "×";
    head.appendChild(h); head.appendChild(x);

    const body = document.createElement("div"); body.className = "brm-body";
    const intro = document.createElement("p"); intro.className = "rfs-intro";
    intro.textContent = (devs.length > mine.length)
      ? _gl("Ten zestaw jest na ", "This set is for ") + devs.length +
        _gl(" kapsle, a Ty masz ", " capsules, and you have ") + mine.length +
        _gl(". Role bez kapsla pominę i wczytam tylko te, którym kogoś przypiszesz.",
            ". Roles with no capsule are skipped; I load only the ones you assign somebody to.")
      : _gl("Autor rozpisał zestaw na role. Przypisz każdej swój kapsel, bo kolejność parowania u Ciebie jest inna niż u niego.",
            "The author split the set into roles. Give each one your capsule, because your pairing order is not theirs.");
    body.appendChild(intro);

    const rows = [];
    devs.forEach(function (d, i) {
      const row = document.createElement("div"); row.className = "brm-row";
      const info = document.createElement("div"); info.className = "brm-info";
      const t = document.createElement("span"); t.className = "brm-role";
      t.textContent = (d.role && d.role.name) || d.devName || ("d" + i);
      info.appendChild(t);
      if (d.role && d.role.note) {
        const n = document.createElement("span"); n.className = "brm-note";
        n.textContent = d.role.note;
        info.appendChild(n);
      }
      const g = _brmGroups(d.groups);
      const meta = document.createElement("span"); meta.className = "brm-meta";
      meta.textContent = (g.length ? _gl("zmieni: ", "changes: ") + g.join(" · ") : _gl("nic nie zmienia", "changes nothing")) +
        (d.riskyCount ? (_gl(" · ⚠️ ryzykowne reguły: ", " · ⚠️ risky rules: ") + d.riskyCount) : "");
      info.appendChild(meta);
      row.appendChild(info);

      const arrow = document.createElement("span"); arrow.className = "brm-arrow";
      arrow.textContent = "→"; arrow.setAttribute("aria-hidden", "true");
      row.appendChild(arrow);

      const prev = document.createElement("span"); prev.className = "brm-prev";
      const sel = document.createElement("select"); sel.className = "brm-sel";
      sel.setAttribute("aria-label", _gl("Kapsel dla roli ", "Capsule for the role ") + t.textContent);
      const opt0 = document.createElement("option");
      opt0.value = ""; opt0.textContent = _gl("— pomiń —", "— skip —");
      sel.appendChild(opt0);
      // KTÓRY KAPSEL COŚ STRACI — widać w chwili wybierania, a nie dopiero w oknie po. Wybór roli
      // JEST wyborem tego, czyje ustawienia zostaną wymienione, więc informacja o niezapisanych
      // zmianach należy do tej listy. Liczona z tej samej kropki „zmienione", którą pokazuje
      // nawigacja (rf-29f → rfCfgIdState), i TYLKO dla realnej straty: „nic nie zapisane pod
      // nazwą" to normalny stan świeżej instalacji i dopisane przy każdym kapslu nauczyłoby
      // wyłącznie tego, że ten znak nic nie znaczy.
      mine.forEach(function (m) {
        const o = document.createElement("option");
        o.value = m.id; o.textContent = m.name + _brmLossMark(m.id, d.groups);
        o.setAttribute("data-noi18n", "");
        sel.appendChild(o);
      });
      sel.value = pick[i] || "";
      sel.addEventListener("change", function () {
        const was = pick[i], now = sel.value || null;
        // A capsule can hold one role. Picking a capsule that another row had SWAPS them, which is
        // what somebody fixing "these two are the wrong way round" is actually trying to do.
        if (now) {
          const other = pick.indexOf(now);
          if (other >= 0 && other !== i) { pick[other] = was; rows[other].sel.value = was || ""; rows[other].sync(); }
        }
        pick[i] = now;
        sync();
      });
      const cell = document.createElement("div"); cell.className = "brm-pick";
      cell.appendChild(prev); cell.appendChild(sel);
      row.appendChild(cell);
      body.appendChild(row);
      const rowSync = function () {
        prev.innerHTML = (sel.value && typeof capImgSpan === "function") ? capImgSpan(sel.value, 22) : "";
        row.classList.toggle("skip", !sel.value);
      };
      rows.push({sel: sel, sync: rowSync});
      rowSync();
    });

    const hint = document.createElement("p"); hint.className = "rfs-hint-add";
    hint.textContent = _gl("Nie wiesz, który kapsel to który? Potrząśnij nim, a jego pigułka u góry zamiga.",
                           "Not sure which capsule is which? Give it a shake — its pill at the top lights up.");
    body.appendChild(hint);

    const foot = document.createElement("div"); foot.className = "rfk-foot brm-foot";
    const state_ = document.createElement("span"); state_.className = "rfk-note";
    const cancel = document.createElement("button");
    cancel.type = "button"; cancel.className = "btn sm"; cancel.textContent = _gl("Anuluj", "Cancel");
    const go = document.createElement("button");
    go.type = "button"; go.className = "btn sm primary";
    go.textContent = nextStep ? _gl("Dalej", "Continue") : _gl("Wczytaj", "Load");
    foot.appendChild(state_); foot.appendChild(cancel); foot.appendChild(go);

    const sync = function () {
      const n = pick.filter(Boolean).length;
      go.disabled = !n;
      state_.textContent = n
        ? (_gl("Wczytam ról: ", "Roles to load: ") + n + (n < devs.length ? (_gl(" z ", " of ") + devs.length) : ""))
        : _gl("Przypisz przynajmniej jedną rolę.", "Assign at least one role.");
      rows.forEach(function (r) { r.sync(); });
    };

    const done = function (val) { rfBundleMapClose(); resolve(val); };
    x.addEventListener("click", function () { done(null); });
    cancel.addEventListener("click", function () { done(null); });
    go.addEventListener("click", function () { if (!go.disabled) done(pick.slice()); });

    card.appendChild(head); card.appendChild(body); card.appendChild(foot);
    back.appendChild(card);
    back.addEventListener("mousedown", function (e) { if (e.target === back) done(null); });
    back._onKey = function (e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(null); return; }
      if (e.key !== "Tab") return;
      const f = Array.prototype.filter.call(
        card.querySelectorAll("button:not([disabled]),select"),
        function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", back._onKey, true);
    document.body.appendChild(back);
    _brmBack = back;
    sync();
    try { if (typeof applyLang === "function") applyLang(back); } catch (e) {}
    setTimeout(function () { try { (rows[0] && rows[0].sel || go).focus(); } catch (e) {} }, 30);
  });
}

window.rfBundleMap = rfBundleMap;
window.rfBundleRoles = rfBundleRoles;
window.rfBundleRoleSet = rfBundleRoleSet;
window.rfBundleStampRoles = rfBundleStampRoles;
