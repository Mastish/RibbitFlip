"use strict";
// ============ SHARE A SETUP ON THE COMMUNITY FORUM — A GUIDED WIZARD ============
// "Save setup" is where someone has just described their configuration, so the way to share sits
// right there. What follows is a wizard rather than one dense panel, because posting well is a
// sequence of small decisions and each one deserves the screen to itself: what the setup is, how
// it should be findable, whose it is, and only then — what it will look like once published.
//
// Why this PREPARES a post instead of sending one:
//   • posting straight to the community channel needs a credential that can write there, and this
//     app is open source and ships as an .exe — a webhook baked into it is extractable in seconds
//     and, worse, CANNOT BE ROTATED: revoking it after abuse kills the feature in every release
//     already out there. The app's own REST guide says a webhook URL is like a password; shipping
//     one would contradict it,
//   • a post sent by a bot is nobody's. Pasted by the author it carries their name, they can edit
//     it, and someone can ask "how did you set the sensitivity?" under it and get an answer.
//
// What the wizard decides FOR the author, because the app knows and they would have to look it up:
// which output groups are on, which module tags follow from that, and what the setup needs
// installed beyond this app (see rf-39g). What it asks for: the things no configuration reveals.
//
// The fields are MIRRORS of the ones in the setup bar, written back on every keystroke. One source
// of truth, so "Download the .json" a step later exports exactly what the preview promised.

// Where the post goes. The button opens the FORUM ITSELF, not the server's front door: someone who
// already belongs here lands in #zestawy with the "New post" button in front of them, which is the
// whole point of pressing it at the end of a wizard. The invite stays as the second door, for the
// person who is not on the server yet and for whom a channel link resolves to nothing.
// The addresses themselves live in rf-00-core, which loads first — the names below stay so the
// rest of this file reads the same, but there is only one place left to edit.
const RFS_CHANNEL = RF_FORUM_URL;
const RFS_INVITE = RF_INVITE_SHARE;
const RFS_FORUM_NAME = RF_FORUM_NAME;
const RFS_AUTHOR_KEY = "ribbitflip.shareAuthor";       // remembered so nobody retypes their nick
const RFS_TAGS_KEY = "ribbitflip.shareTags";           // domains chosen last time
const RFS_STEPS = [
  // Step one used to be called "Setup" because a setup was the only thing this wizard could post.
  // It now decides WHICH file is going out, so it is named after that. There used to be a fourth
  // step — "Signature", asking for a nick, a revision number and a "why" — and every one of its
  // questions turned out to be already answered elsewhere: the post goes out from the author's own
  // Discord account (that IS the signature), the "why" belongs in the description, and a revision
  // is something people write into the thread when they actually publish a fix. The revision still
  // gets stamped into the FILE silently (see initShare), because imports use it for lineage.
  {pl: "Plik", en: "File"}, {pl: "Tagi", en: "Tags"}, {pl: "Podgląd", en: "Preview"}
];

let _rfsBack = null;
let _rfsPrevFocus = null;
let _rfsReq = null;        // requirements of the live configuration, from /setup/requires
let _rfsStep = 0;
let _rfsPicked = [];
let _rfsKind = "setup";    // setup | trig | axis | pack — what is actually being shared
let _rfsTarget = "";       // which saved preset / which REST application, for every kind but setup
let _rfsLib = null;        // /library answer, so the preset pickers list real files
// Whether step one asks WHICH file is going out, or merely says which one already is. Somebody who
// pressed „share this preset" has answered that question by pressing it; opening on five chips with
// their answer pre-lit asked it again and made the door look like a form.
let _rfsChoose = true;
let _rfsScope = null;      // Set of section keys for a setup file; null = every section
// Wired up inside rfShareOpen — the steps are built before the navigation that drives them, and
// they call back into it after every change.
let _rfsRefresh = function () {};
let _rfsGoto = function () {};

function _rfsTags() { return rfPostTags(_rfsPicked, _rfsReq, _rfsKind); }
// The picked tags ride into the composer: they become the „Zastosowanie" and „Moduły" lines of the
// body, so copy-and-paste carries them even before anyone ticks the real tags on the forum.
function _rfsPost() { return rfPostCompose({req: _rfsReq, kind: _rfsKind, target: _rfsTargetName(), tags: _rfsTags()}); }

// What the download button will hand over, per kind. Everything here already existed — the wizard
// simply stops assuming that "share" can only ever mean "the setup I have open".
// "1 akcji" is the kind of thing that makes an interface read like a machine translated it. Polish
// takes three forms and which one depends on the last digit — except in the teens, where it does not.
function _rfsPl(n, f1, f2, f5, e1, e2) {
  const v = Math.abs(n || 0), t = v % 10, h = v % 100;
  const pl = (v === 1) ? f1 : (t >= 2 && t <= 4 && (h < 12 || h > 14)) ? f2 : f5;
  return _gl(pl, v === 1 ? e1 : e2);
}
function _rfsRestApis() {
  try {
    const c = (window.RESTAPI && window.RESTAPI.cfg) || null;
    return (c && Array.isArray(c.apis)) ? c.apis.filter(function (a) {
      return a && Array.isArray(a.actions) && a.actions.length;
    }) : [];
  } catch (e) { return []; }
}
// KTÓRA SZUFLADA BIBLIOTEKI ODPOWIADA TEMU RODZAJOWI. Do 2026-08-31 stało tu `trig → profile,
// cokolwiek innego → pose` — czyli kreator umiał sięgnąć po dwa rodzaje presetów z sześciu, a próba
// wysłania trzeciego pokazywałaby listę osi 3D pod nazwą presetu myszy. Rejestr wie to o każdym.
// Wpis rejestru dla rodzaju z kreatora. Kreator mówi identyfikatorem WYMIANY (`shareId`), a rejestr
// jest indeksowany własnym id modułu, więc bez tego przejścia każde zdanie o rodzaju musiałoby
// powtarzać dane, które rejestr już niesie — odmienioną nazwę, katalog, listę tagów.
function _rfsRegKind(kind) {
  const R = (typeof RF_KINDS !== "undefined") ? RF_KINDS : (window.RF_KINDS || {});
  for (const id in R) if (R[id].shareId === kind) return R[id];
  return null;
}
function _rfsLibKind(kind) {
  const K = _rfsRegKind(kind);
  return (K && K.lib) || "";
}
function _rfsLibNames(kind) {
  const k = _rfsLibKind(kind);
  const list = (k && _rfsLib && Array.isArray(_rfsLib[k])) ? _rfsLib[k] : [];
  return list.filter(function (it) { return it && it.name && !it.broken; })
             .map(function (it) { return it.name; });
}
// The chosen thing's NAME (the picker's value is an id for REST applications, a name for presets).
// Used for the attachment name in the preview, which has to match the file that is downloaded.
function _rfsTargetName() {
  if (_rfsKind === "pack") {
    const a = _rfsRestApis().filter(function (x) { return x.id === _rfsTarget; })[0];
    return a ? (a.name || "") : "";
  }
  return _rfsTarget || "";
}
// The options for the current kind, as [value, label]. A setup needs no choice: it is whatever is
// configured right now, which is the case the wizard was built around.
function _rfsChoices() {
  if (_rfsKind === "pack") {
    return _rfsRestApis().map(function (a) {
      const n = (a.actions || []).length, g = (a.triggers || []).length;
      return [a.id, (a.name || "?") + "  ·  " + n + " " + _rfsPl(n, "akcja", "akcje", "akcji", "action", "actions") +
                    (g ? (", " + g + " " + _rfsPl(g, "ruch", "ruchy", "ruchów", "movement", "movements")) : "")];
    });
  }
  if (_rfsKind === "trig" || _rfsKind === "axis") {
    return _rfsLibNames(_rfsKind).map(function (n) { return [n, n]; });
  }
  return [];    // setup and bundle are "whatever is configured right now" — nothing to choose
}
// One line naming what is going out: the kind, then the thing itself. Something with a name of its
// own gets it in quotes; a setup nobody has named yet and a whole rig are DESCRIBED instead, in
// brackets, because there is no name to quote and inventing one would be a lie in quotation marks.
function _rfsWhatLine() {
  const K = rfPostKind(_rfsKind), kind = _gl(K.pl, K.en);
  if (_rfsKind === "bundle") {
    const n = rfPostCapsules(), roles = rfPostRoles();
    return kind + " (" + n + " " + _rfsPl(n, "kapsel", "kapsle", "kapsli", "capsule", "capsules") +
           (roles.length ? (": " + roles.join(" · ")) : "") + ")";
  }
  const nm = (_rfsKind === "setup") ? rfPostVal("setupName") : _rfsTargetName();
  if (nm) return kind + " „" + nm + "”";
  return (_rfsKind === "setup")
    ? kind + " (" + _gl("obecna konfiguracja", "the current configuration") + ")"
    : kind;
}
// Every section a setup file can carry — the default scope, and what „wszystkie sekcje" means.
function _rfsAllScope() {
  return new Set(RF_SETUP_SECTIONS.map(function (s) { return s.key; }));
}
// What the download button will actually write out, said in the words of the picker's own rows.
function _rfsScopeLine() {
  const full = !_rfsScope || RF_SETUP_SECTIONS.every(function (s) { return _rfsScope.has(s.key); });
  if (full) return _gl("wszystkie sekcje", "all sections");
  return RF_SETUP_SECTIONS.filter(function (s) { return _rfsScope.has(s.key); })
    .map(function (s) { return _gl(s.label, s.en); }).join(" · ");
}
// The capsules this machine has, in slot order — the rows of the role editor a bundle needs.
function _rfsDevices() {
  try {
    return Object.values(state.devices || {})
      .filter(function (D) { return D && D.meta && D.meta.dev; })
      .sort(function (a, b) { return (a.meta.slot || 0) - (b.meta.slot || 0); })
      .map(function (D) { return {id: D.meta.dev, name: D.meta.label || D.meta.name || D.meta.dev}; });
  } catch (e) { return []; }
}

function _rfsSavedDomains() {
  let v = [];
  try {
    const raw = JSON.parse(localStorage.getItem(RFS_TAGS_KEY) || "[]");
    v = Array.isArray(raw) ? raw.filter(rfPostIsDomain) : [];
  } catch (e) { v = []; }
  // SKANER WŁĄCZONY ⇒ PODPOWIEDZ „♿ Dostępność". Moduł ma na tym serwerze DOMENĘ, a nie własny tag
  // modułu — i to jest właściwa odpowiedź, a nie brak: skaner jest drogą do komputera dla kogoś,
  // kto nie ma innej, więc ludzie szukają go pod dostępnością, nie pod nazwą modułu.
  // ⚠️ Podpowiedź, nie przymus: to zwykłe zaznaczenie w kreatorze, które da się odkliknąć.
  // ⛔ Nie dokładamy tu tagu „Skaner" — tego na serwerze NIE MA. Dokładnie tak zniknęły stąd
  //    „Mysz" i „Kontroler" (02.09): kreator wysyłał ludzi po tagi, których żaden wybór nie pokaże.
  try {
    const dost = (RF_FORUM_TAGS.domain.filter(function (t) { return t.g === "accessibility"; })[0] || {}).n;
    if (dost && v.indexOf(dost) < 0 && typeof rfPostOn === "function" && rfPostOn("scanEnable")) v.push(dost);
  } catch (e) { }
  return v;
}

function rfShareClose() {
  const back = _rfsBack;
  if (!back) return;
  _rfsBack = null;
  document.removeEventListener("keydown", back._onKey, true);
  back.classList.add("out");
  setTimeout(function () { try { back.remove(); } catch (e) {} }, 160);
  try { if (_rfsPrevFocus && _rfsPrevFocus.focus) _rfsPrevFocus.focus(); } catch (e) {}
  _rfsPrevFocus = null;
}

// Clipboard access gets refused often enough (permissions, an unfocused window) that the failure
// path has to be a real one: reveal the raw text with everything selected, so Ctrl+C still works.
function _rfsCopyText(text, btn, raw) {
  const done = function (ok) {
    btn.textContent = ok ? _gl("Skopiowane ✓", "Copied ✓") : _gl("Zaznacz i skopiuj", "Select and copy");
    if (!ok && raw) {
      raw.hidden = false;
      raw.value = text;
      try { raw.focus(); raw.select(); } catch (e) {}
    }
    setTimeout(function () { try { btn.textContent = btn._label; } catch (e) {} }, 1800);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
  } else { done(false); }
}

function _rfsCopyBtn(label, getText) {
  const wrap = document.createElement("span"); wrap.className = "rfs-copywrap";
  const b = document.createElement("button");
  b.type = "button"; b.className = "btn sm rfs-copy";
  b._label = label; b.textContent = label;
  const raw = document.createElement("textarea");
  raw.className = "rfs-raw"; raw.rows = 4; raw.hidden = true; raw.readOnly = true;
  b.addEventListener("click", function () { _rfsCopyText(getText(), b, raw); });
  wrap.appendChild(b); wrap.appendChild(raw);
  return wrap;
}

// A field that writes straight through to its twin in the setup bar.
function _rfsInput(host, labelTxt, targetId, opts) {
  const o = opts || {};
  const wrap = document.createElement("div"); wrap.className = "rfs-row";
  const lab = document.createElement("label"); lab.className = "rfs-lab"; lab.textContent = labelTxt;
  const el = o.rows ? document.createElement("textarea") : document.createElement("input");
  el.className = "rfs-field";
  if (o.rows) el.rows = o.rows; else el.type = o.type || "text";
  if (o.placeholder) el.placeholder = o.placeholder;
  if (o.min != null) el.min = o.min;
  if (o.max != null) el.max = o.max;
  el.spellcheck = !!o.spell;
  const twin = document.getElementById(targetId);
  el.value = twin ? twin.value : "";
  el.addEventListener("input", function () {
    if (twin) twin.value = el.value;
    _rfsRefresh();
  });
  lab.appendChild(el); wrap.appendChild(lab);
  host.appendChild(wrap);
  el._row = wrap;   // the whole row, for a caller that has to hide the field AND its label
  return el;
}

// Where focus lands when a step opens. It has to skip what the step is HIDING: since step one can
// switch off its name field and its picker, "the first input" and "the first input you can see"
// stopped being the same element, and focus was going to something invisible — which reads as focus
// going nowhere. Fields first, controls only if the step has none.
function _rfsFocusFirst(panel) {
  const vis = function (q) {
    return Array.prototype.filter.call(panel.querySelectorAll(q), function (el) {
      return el.offsetParent !== null && !el.disabled;
    })[0] || null;
  };
  return vis("input,textarea") || vis("select,button");
}

function _rfsChip(parent, label, on, onToggle) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "rfs-chip" + (on ? " on" : "");
  b.setAttribute("aria-pressed", on ? "true" : "false");
  // The chip text is the LITERAL forum label. Translating it would send an English speaker
  // looking for a tag called "Mapping", which does not exist on that forum.
  b.setAttribute("data-noi18n", "");
  b.textContent = rfPostTagEmoji(label) + " " + label;
  // …but an English speaker still has to know WHAT they are ticking, so the English gloss rides
  // in a tooltip: „Sterowanie ruchem (motion control)". Empty in Polish — nothing to explain.
  try { const g = (typeof rfTagGloss === "function") ? rfTagGloss(label) : ""; if (g) b.title = g; } catch (e) {}
  b.addEventListener("click", function () {
    const next = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", next ? "true" : "false");
    b.classList.toggle("on", next);
    onToggle(label, next);
  });
  parent.appendChild(b);
  return b;
}

function _rfsPick(label, on) {
  const i = _rfsPicked.indexOf(label);
  if (on && i < 0) _rfsPicked.push(label);
  if (!on && i >= 0) _rfsPicked.splice(i, 1);
}

// ---- steps -------------------------------------------------------------------
function _rfsBuildStep1(host) {
  // Two different first sentences, because there are two different first moments: „which of these
  // five" for somebody who pressed „share yours", and „here is what you picked" for somebody who
  // already said it by pressing the button they pressed. Written with _gl rather than left to the
  // walker: the text changes on every sync, and a sentence that has to survive that cannot depend
  // on being re-translated after each one.
  const p = document.createElement("p"); p.className = "rfs-intro";
  host.appendChild(p);

  // Four kinds of file leave this app now, and they are not interchangeable: they need different
  // tags, a different sentence about what the reader has to do and a different exporter.
  const kLab = document.createElement("div"); kLab.className = "rfs-taglab";
  kLab.textContent = "Rodzaj pliku:";
  host.appendChild(kLab);
  const kRow = document.createElement("div"); kRow.className = "rfs-chiprow";
  host.appendChild(kRow);
  RFS_KINDS.forEach(function (K) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "rfs-chip";
    b.setAttribute("data-kind", K.k);
    b.textContent = _gl(K.pl, K.en);
    b.addEventListener("click", function () {
      if (_rfsKind === K.k) return;
      _rfsKind = K.k;
      _rfsTarget = "";
      _rfsRefresh();
    });
    kRow.appendChild(b);
  });

  // …and the same fact stated instead of asked, for whoever arrived from a bar that already said
  // which file they meant. „Zmień" is the way back to the chips above — small, because changing
  // your mind here is the rare case, not the ritual.
  const conf = document.createElement("div"); conf.className = "rfs-confirm";
  const confLab = document.createElement("span"); confLab.className = "rfs-conflab";
  confLab.textContent = _gl("Wysyłasz: ", "You are sending: ");
  const confWhat = document.createElement("span"); confWhat.className = "rfs-confwhat";
  confWhat.setAttribute("data-noi18n", "");   // carries a user-authored name — never translate it
  const confChg = document.createElement("button");
  confChg.type = "button"; confChg.className = "btn sm rfs-confchg";
  confChg.textContent = _gl("Zmień", "Change");
  confChg.addEventListener("click", function () { _rfsChoose = true; _rfsRefresh(); });
  conf.appendChild(confLab); conf.appendChild(confWhat); conf.appendChild(confChg);
  host.appendChild(conf);

  // Which saved preset / which REST application. A setup is whatever is configured right now, so
  // there is nothing to choose and the row stays hidden.
  const pickWrap = document.createElement("div"); pickWrap.className = "rfs-row rfs-pickrow";
  const pickLab = document.createElement("label"); pickLab.className = "rfs-lab";
  const pickTxt = document.createTextNode("");
  const sel = document.createElement("select"); sel.className = "rfs-field";
  sel.addEventListener("change", function () { _rfsTarget = sel.value; _rfsRefresh(); });
  pickLab.appendChild(pickTxt); pickLab.appendChild(sel);
  pickWrap.appendChild(pickLab);
  host.appendChild(pickWrap);
  const pickNone = document.createElement("p"); pickNone.className = "rfs-warn";
  host.appendChild(pickNone);

  // ROLES — only for a multi-capsule set. "Capsule 1 / capsule 2" is pairing order and means
  // nothing to the reader; what they need is "this one steers, that one shoots". Prefilled with
  // whatever the author calls each capsule, so leaving it alone still produces something usable,
  // and saved as they type, so the same words end up in the file and in the post.
  const roleWrap = document.createElement("div"); roleWrap.className = "rfs-roles";
  const roleLab = document.createElement("div"); roleLab.className = "rfs-taglab";
  roleLab.textContent = "Role kapsli — co robi każdy z nich w tej grze:";
  roleWrap.appendChild(roleLab);
  const roleRows = document.createElement("div");
  roleWrap.appendChild(roleRows);
  host.appendChild(roleWrap);
  let _rolesBuilt = "";
  const buildRoles = function () {
    const devs = _rfsDevices();
    const sig = devs.map(function (d) { return d.id; }).join(",");
    if (sig === _rolesBuilt) return;
    _rolesBuilt = sig;
    roleRows.textContent = "";
    const saved = (typeof rfBundleRoles === "function") ? rfBundleRoles() : {};
    devs.forEach(function (d, i) {
      const row = document.createElement("div"); row.className = "rfs-rolerow";
      const cap = document.createElement("span"); cap.className = "rfs-rolecap";
      cap.innerHTML = (typeof capImgSpan === "function") ? capImgSpan(d.id, 22) : "";
      const nm = document.createElement("input");
      nm.type = "text"; nm.className = "rfs-field rfs-rolename"; nm.maxLength = 40;
      nm.placeholder = (i === 0) ? "np. Kierowanie" : "np. Skok i strzał";
      nm.value = (saved[d.id] && saved[d.id].name) ||
        ((typeof rfBundleRoleDefault === "function") ? rfBundleRoleDefault(d.id) : d.name);
      const note = document.createElement("input");
      note.type = "text"; note.className = "rfs-field rfs-rolenote"; note.maxLength = 120;
      note.placeholder = "jak go trzymasz (nieobowiązkowe)";
      note.value = (saved[d.id] && saved[d.id].note) || "";
      const save = function () {
        if (typeof rfBundleRoleSet === "function") rfBundleRoleSet(d.id, {name: nm.value, note: note.value});
        _rfsRefresh();
      };
      nm.addEventListener("change", save);
      note.addEventListener("change", save);
      row.appendChild(cap); row.appendChild(nm); row.appendChild(note);
      roleRows.appendChild(row);
    });
    try { if (typeof applyLang === "function") applyLang(roleRows); } catch (e) {}
  };

  const nameRow = _rfsInput(host, "Nazwa", "setupName", {placeholder: "np. Precyzyjne czasówki"})._row;
  _rfsInput(host, "Gra lub program", "setupFor", {placeholder: "np. Trackmania"});
  _rfsInput(host, "Krótki opis", "setupDesc", {rows: 2, spell: true,
    placeholder: "Co to robi, w dwóch zdaniach."});
  // JAK TEGO UŻYWAĆ — to, czego opis nie powie: kolejność czynności. Osobne pole, a nie dłuższy
  // opis, bo panel numeruje kroki i pokazuje je jako listę (okno importu, szuflada Biblioteki),
  // a krok, który nie mieści się w linijce, nie jest krokiem. Stoi zaraz pod opisem: oba
  // odpowiadają na pytania, które czytelnik zadaje po kolei („czym to jest" → „co mam zrobić").
  _rfsInput(host, "Jak tego używać (krok na linię)", "setupHowto", {rows: 4, spell: true,
    placeholder: "Wczytaj i rozdaj kapsle do ról.\nZaznacz „Wczytaj i od razu aktywuj zestaw”.\nW grze: lewy kapsel chodzi, prawy celuje."});
  // KASETA ZESTAWU (rf-28e) — bliźniak przycisku „Kaseta" z paska zapisu: ta sama siatka pisze do tego
  // samego ukrytego pola, więc plik do pobrania i zestaw w Bibliotece mają jedną kasetę.
  const kasRow = (typeof rfKasetaPickerRow === "function") ? rfKasetaPickerRow() : null;
  if (kasRow) host.appendChild(kasRow);

  // HOW MUCH of the configuration the file carries — a setup's question and nobody else's. It used
  // to be asked by a window that jumped up on top of the wizard when the download button was
  // pressed, four steps later, with the post already written. Here it is one quiet line that
  // answers itself, and „Zmień" for the rare evening when somebody really wants to send the
  // triggers without their axes.
  const scope = document.createElement("div"); scope.className = "rfs-scope";
  const scopeTx = document.createElement("span"); scopeTx.className = "rfs-scopetx";
  const scopeBtn = document.createElement("button");
  scopeBtn.type = "button"; scopeBtn.className = "btn sm rfs-scopechg";
  scopeBtn.textContent = _gl("Zmień", "Change");
  scopeBtn.addEventListener("click", function () {
    rfIncludeModal({title: _gl("Zakres pliku: co uwzględnić?", "File scope: what to include?"),
      okLabel: _gl("Ustaw", "Set"), sel: _rfsScope || _rfsAllScope(),
      onConfirm: function (pick) { _rfsScope = pick; _rfsRefresh(); }});
  });
  scope.appendChild(scopeTx); scope.appendChild(scopeBtn);
  host.appendChild(scope);

  // Whose work this grew out of. It used to live in the "Signature" step; with that step gone it
  // belongs here, next to the file it describes — it goes into the post and into the file either
  // way, and "To nie przeróbka" is the one chance to say the app guessed wrong.
  const lin = document.createElement("p"); lin.className = "rfs-lineage";
  host.appendChild(lin);
  const syncLineage = function () {
    const l = (typeof rfLineage === "function") ? rfLineage() : null;
    lin.textContent = "";
    if (!l) return;
    const t = document.createElement("span");
    t.textContent = _gl("Na bazie: „", "Based on: “") + (l.name || "?") + "”" +
      (l.author ? _gl(", autor ", ", by ") + l.author : "") +
      _gl(". Trafi to do posta i do pliku.", ". This goes into the post and into the file.");
    const drop = document.createElement("button");
    drop.type = "button"; drop.className = "btn sm rfs-lindrop";
    drop.textContent = _gl("To nie przeróbka", "Not a fork");
    drop.addEventListener("click", function () {
      if (typeof rfLineageClear === "function") rfLineageClear();
      _rfsRefresh();
    });
    lin.appendChild(t); lin.appendChild(drop);
  };

  const t = document.createElement("p"); t.className = "rfs-titlehint";
  host.appendChild(t);

  host._sync = function () {
    p.textContent = _rfsChoose
      ? _gl("Zacznijmy od tego, czym się dzielisz. Od rodzaju zależą tagi, treść posta i plik do pobrania.",
            "Let us start with what you are sharing. The kind decides the tags, the body of the post and the file you download.")
      : _gl("Sprawdź, co wysyłasz, i opisz to w dwóch zdaniach.",
            "Check what you are sending, and describe it in two sentences.");
    kRow.querySelectorAll("[data-kind]").forEach(function (b) {
      const on = b.getAttribute("data-kind") === _rfsKind;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const choices = _rfsChoices();
    const needsPick = (_rfsKind !== "setup" && _rfsKind !== "bundle");
    // The kind chips and the „which one" picker are the QUESTION; the line under them is the same
    // fact as an answer. One of the two is on screen, never both.
    kLab.hidden = !_rfsChoose;
    kRow.hidden = !_rfsChoose;
    conf.hidden = _rfsChoose;
    if (!_rfsChoose) confWhat.textContent = _rfsWhatLine();
    pickWrap.hidden = !(needsPick && _rfsChoose);
    pickNone.hidden = !(needsPick && _rfsChoose && !choices.length);
    // The name is what becomes the thread title, and for a setup or a whole rig there is nothing
    // else it could come from. A preset and a REST pack already have a name of their own — the
    // title line below says which — so the field only offered a way to overwrite it by accident.
    nameRow.hidden = !(_rfsKind === "setup" || _rfsKind === "bundle");
    if (kasRow) kasRow.hidden = !(_rfsKind === "setup" || _rfsKind === "bundle");
    scope.hidden = (_rfsKind !== "setup");
    scopeTx.textContent = _gl("Zakres pliku: ", "File scope: ") + _rfsScopeLine();
    roleWrap.hidden = (_rfsKind !== "bundle");
    if (_rfsKind === "bundle") buildRoles();
    // Populated even while the picker is off screen: „Zmień" reveals it, and a list that only fills
    // in once it is visible would show an empty select for the first frame after the click.
    if (needsPick) {
      pickTxt.nodeValue = (_rfsKind === "pack")
        ? _gl("Która aplikacja REST", "Which REST application")
        : _gl("Który preset", "Which preset");
      const cur = _rfsTarget;
      sel.textContent = "";
      choices.forEach(function (c) {
        const o = document.createElement("option");
        o.value = c[0]; o.textContent = c[1];
        o.setAttribute("data-noi18n", "");   // user-authored names
        sel.appendChild(o);
      });
      if (choices.length && !choices.some(function (c) { return c[0] === cur; })) {
        _rfsTarget = choices[0][0];
      }
      sel.value = _rfsTarget;
      sel.disabled = !choices.length;
      // NAZWA RODZAJU Z REJESTRU, a nie wypisana tutaj. Do 2026-09-06 ta gałąź miała dwa zdania na
      // dziewięć rodzajów: wszystko poza „pack" i „trig" dostawało tekst o presecie osi 3D i ekranie
      // Czujnik — więc ktoś, kto wybrał „Preset myszy", był odsyłany na cudzy ekran po nieswój plik.
      // Nazwa stoi po dwukropku, w mianowniku, bo dziewięciu nazw nie da się odmienić jednym wzorem
      // („presetu myszy", ale „sceny syntezatora"). Ekran nie jest nazywany, tylko zakładka — te same
      // słowa, co w oknie wymiany (rf-39l): `mod` w rejestrze bywa nazwą MODUŁU, a nie ekranu (osie
      // 3D mieszkają na ekranie „Czujnik"), więc wskazanie go z rejestru odesłałoby równie krzywo.
      const RK = _rfsRegKind(_rfsKind);
      pickNone.textContent = (_rfsKind === "pack")
        ? _gl("Nie masz jeszcze aplikacji REST z akcjami. Zbuduj ją na ekranie Usługi sieciowe.",
              "You have no REST application with actions yet. Build one on the Network services screen.")
        : _gl("Nie masz jeszcze nic zapisanego tego rodzaju: „" + (RK ? RK.pl.one : "") + "”. " +
              "Zapisz to najpierw w zakładce Biblioteka tego modułu.",
              "You have nothing of this kind saved yet: “" + (RK ? RK.en.one : "") + "”. " +
              "Save one first in this module's Library tab.");
    }
    syncLineage();
    t.textContent = _gl("Tytuł wątku: ", "Post title: ") + rfPostTitle(_rfsKind, _rfsTargetName());
    try {
      if (typeof applyLang === "function") { applyLang(kRow); applyLang(conf); applyLang(scope); }
    } catch (e) {}
  };
}

function _rfsBuildStep2(host) {
  // Zdanie wstępne zależy od RODZAJU pliku, a rodzaj wybiera się krok wcześniej, więc tekst jest
  // malowany w _sync, a nie wpisywany raz przy budowie panelu.
  const p = document.createElement("p"); p.className = "rfs-intro";
  host.appendChild(p);
  // "Zastosowanie" and "Moduły" on purpose — the same two words head the tag lines in the post
  // body, so what gets picked here is recognisable there and on the forum's own tag picker.
  const dLab = document.createElement("div"); dLab.className = "rfs-taglab";
  dLab.textContent = "Zastosowanie. Wybierz przynajmniej jedno:";
  host.appendChild(dLab);
  const dRow = document.createElement("div"); dRow.className = "rfs-chiprow";
  host.appendChild(dRow);
  RFS_DOMAINS.forEach(function (d) {
    _rfsChip(dRow, d.n, _rfsPicked.indexOf(d.n) >= 0, function (label, on) {
      _rfsPick(label, on);
      try {
        localStorage.setItem(RFS_TAGS_KEY, JSON.stringify(_rfsPicked.filter(rfPostIsDomain)));
      } catch (e) {}
      _rfsRefresh();
    });
  });
  const mLab = document.createElement("div"); mLab.className = "rfs-taglab";
  // „Kilka kapsli" lands in this group too, and it is strictly a requirement rather than a module —
  // but „Moduły" is the word the post body and the reader use, so the label wears it anyway.
  // Druga połowa etykiety mówi, SKĄD ta lista, a to zależy od rodzaju pliku — malowana w _sync.
  host.appendChild(mLab);
  const mRow = document.createElement("div"); mRow.className = "rfs-chiprow";
  host.appendChild(mRow);
  const out = document.createElement("p"); out.className = "rfs-tagout";
  host.appendChild(out);

  host._sync = function () {
    // SKĄD biorą się tagi modułów, zależy od rodzaju pliku, a nie od konfiguracji. Rejestr niesie to
    // w jednym polu (rf-39g): `mods === null` znaczy „policz z konfiguracji" (zestaw i zestaw na
    // kilka kapsli), niepusta lista — „wynika z samego rodzaju" (preset wyzwalaczy, paczka REST),
    // pusta — „ten rodzaj nie należy do żadnego modułu z forum". Dziewięć rodzajów, trzy zdania.
    const K = rfPostKind(_rfsKind);
    const fromCfg = (K.mods === null), fromKind = !!(K.mods && K.mods.length);
    p.textContent = fromCfg
      ? _gl("Tagi decydują o tym, czy ktokolwiek to znajdzie. Moduły odczytuję z Twojej konfiguracji, zastosowanie wskazujesz Ty.",
            "Tags decide whether anybody finds this at all. I read the modules off your configuration; the use is yours to pick.")
      : (fromKind
          ? _gl("Tagi decydują o tym, czy ktokolwiek to znajdzie. Tag modułu wynika z samego rodzaju pliku, zastosowanie wskazujesz Ty.",
                "Tags decide whether anybody finds this at all. The module tag follows from the kind of file itself; the use is yours to pick.")
          : _gl("Tagi decydują o tym, czy ktokolwiek to znajdzie. Ten rodzaj pliku nie należy do żadnego modułu z forum, więc zostaje samo zastosowanie, a wskazać je możesz tylko Ty.",
                "Tags decide whether anybody finds this at all. This kind of file belongs to none of the forum's modules, so all that is left is the use, and only you can pick it."));
    mLab.textContent = fromCfg
      ? _gl("Moduły. Odczytane z Twojej konfiguracji:", "Modules. Read from your configuration:")
      : (fromKind
          ? _gl("Moduły. Wynikają z samego rodzaju pliku:", "Modules. They follow from the kind of file itself:")
          : _gl("Moduły. Ten rodzaj nie należy do żadnego:", "Modules. This kind belongs to none:"));
    mRow.textContent = "";
    const mods = rfPostModuleTags(_rfsReq, _rfsKind);
    if (!mods.length) {
      const none = document.createElement("i"); none.className = "rfs-nomod";
      // TRZY różne powody pustej listy i żaden nie jest tym samym. „Nie mam czego podpowiedzieć"
      // mówi o WYŁĄCZONYCH grupach wyjścia, więc obowiązuje wyłącznie rodzaje czytane z
      // konfiguracji; preset myszy, MIDI/OSC, usług sieciowych i scena syntezatora mają tę listę
      // pustą z definicji i dostawały dotąd zdanie napisane nie o nich.
      none.textContent = (_rfsKind === "axis")
        ? _gl("forum ma tagi dziedzin i modułów, a strojenie osi nie jest modułem: karmi wyzwalacze, ruch, MIDI i pady naraz. Rodzaj pliku widać w tytule wątku.",
              "the forum tags domains and modules, and axis tuning is not a module: it feeds triggers, motion, MIDI and the pads alike. The kind of file is in the thread title.")
        : (fromCfg
            ? _gl("żadna grupa wyjścia nie jest włączona, więc nie mam czego podpowiedzieć",
                  "no output group is switched on, so there is nothing to suggest")
            : _gl("ten rodzaj pliku nie należy do żadnego modułu z forum, za to widać go w tytule wątku: „" + K.pl + "”.",
                  "this kind of file belongs to none of the forum's modules; it stands in the thread title instead: “" + K.en + "”."));
      mRow.appendChild(none);
    } else {
      mods.forEach(function (n) {
        if (_rfsPicked.indexOf(n) < 0) _rfsPicked.push(n);   // detected = ticked, still removable
        _rfsChip(mRow, n, true, function (label, on) { _rfsPick(label, on); _rfsRefresh(); });
      });
    }
    const all = _rfsTags();
    const hasDomain = all.some(rfPostIsDomain);
    out.className = "rfs-tagout" + (hasDomain && all.length <= RFS_TAG_MAX ? "" : " bad");
    if (!hasDomain) {
      out.textContent = _gl("Zaznacz zastosowanie. Bez niego " + _rfpLow(K.pl) + " nie wejdzie w żaden filtr na forum i nikt tego nie znajdzie.",
                            "Pick a use. Without one your " + _rfpLow(K.en) + " lands in no filter on the forum and nobody finds it.");
    } else if (all.length > RFS_TAG_MAX) {
      out.textContent = _gl("Discord przyjmie najwyżej 5 tagów, odznacz ", "Discord accepts at most 5 tags, untick ") +
        (all.length - RFS_TAG_MAX) + ".";
    } else {
      out.textContent = _gl("Do zaznaczenia na forum: ", "To tick on the forum: ") +
        all.map(function (n) { return rfPostTagEmoji(n) + " " + n; }).join("  ·  ");
    }
    try { if (typeof applyLang === "function") applyLang(mRow); } catch (e) {}
  };
}

function _rfsBuildStep3(host) {
  const p = document.createElement("p"); p.className = "rfs-intro";
  p.textContent = "Tak wygląda Twój wątek po opublikowaniu.";
  host.appendChild(p);

  const view = document.createElement("div"); view.className = "rfs-preview";
  host.appendChild(view);

  // Publishing, as ONE numbered list in the order it happens — and every step's button sits INSIDE
  // its step. The old layout had the copy buttons above the preview, the instructions in the middle,
  // the tags below them and the download and forum buttons in the footer, so the list read like a
  // treasure map: „the button below", „the buttons above", „the tags listed further down". Whoever
  // is here has finished deciding; the only job left is to walk them through the door.
  const wLab = document.createElement("div"); wLab.className = "rfs-taglab";
  wLab.textContent = "Opublikuj w 4 krokach:";
  host.appendChild(wLab);
  const steps = document.createElement("ol"); steps.className = "rfs-howto";
  host.appendChild(steps);
  // Each step is a list item with a flex row inside — the row and not the <li> itself, because a
  // flex <li> stops being a list-item and its number vanishes with it.
  const mkStep = function (text) {
    const el = document.createElement("li");
    const row = document.createElement("div"); row.className = "rfs-act";
    const tx = document.createElement("span"); tx.className = "rfs-acttx"; tx.textContent = text;
    row.appendChild(tx); el.appendChild(row); steps.appendChild(el);
    return {li: el, row: row};
  };

  // 1 — the file. It has to exist before anything can be dragged anywhere, which is why it leads,
  // and why the button lives here rather than in the footer where the old list never mentioned it.
  const s1 = mkStep("Pobierz plik na dysk.");
  const dl = document.createElement("button");
  dl.type = "button"; dl.className = "btn sm rfs-dl"; dl.textContent = "Pobierz plik .json";
  s1.row.appendChild(dl);
  const dlNote = document.createElement("p"); dlNote.className = "rfs-dlnote"; dlNote.hidden = true;
  s1.li.appendChild(dlNote);
  dl.addEventListener("click", function () {
    // Each kind has its OWN exporter, and every one of them already existed — the setup export
    // (handed the scope from step one instead of asking for it), the library's download-without-
    // loading, and the REST pack export with its refusal to write a file it cannot prove is free of
    // vault values. The wizard dispatches to them rather than re-implementing any of it, so the
    // gates stay exactly where they were.
    let ok = true;
    try {
      if (_rfsKind === "setup") setupExport(_rfsScope || _rfsAllScope());
      else if (_rfsKind === "bundle") bundleExport();   // whole rig, roles stamped in on the way out
      else if (_rfsKind === "pack") {
        const a = _rfsRestApis().filter(function (x) { return x.id === _rfsTarget; })[0];
        ok = !!(a && typeof restExportActions === "function" && restExportActions(a));
      } else if (typeof rfLibDownload === "function") {
        // Każdy pozostały rodzaj to pozycja Biblioteki, a ta umie oddać plik BEZ wczytywania go
        // sobie — szuflada bierze się z rejestru, więc preset myszy czy MIDI wychodzi tą samą
        // drogą, co preset wyzwalaczy, i nie trzeba tu było o nim pamiętać.
        const lib = _rfsLibKind(_rfsKind);
        if (lib) rfLibDownload(lib, _rfsTarget); else ok = false;
      } else ok = false;
    } catch (e) { ok = false; }
    dlNote.hidden = false;
    dlNote.classList.toggle("bad", !ok);
    dlNote.textContent = ok
      ? _gl("Plik trafi tam, gdzie zapisują się Twoje pobrane pliki.",
            "The file lands wherever your downloads go.")
      : _gl("Nie udało się przygotować pliku. Szczegóły są na ekranie, z którego pochodzi.",
            "The file could not be prepared. The details are on the screen it comes from.");
  });

  // 2 — the room. The one control here that LEAVES the app, so it carries the Discord mark.
  // The label carries the CHANNEL NAME, so it is COMPOSED rather than written out — which means the
  // i18n walker has no key to match. Until 2026-09-02 this leaned on an exact composed key sitting
  // in I18N_EN ("Otwórz #zestawy ↗"), i.e. a translation that silently stops working the day the
  // channel is renamed. Marked `data-noi18n` and repainted in _sync instead: the same contract the
  // „Zgłoś problem" window (rf-47b) and the stepper pills already use.
  const s2 = mkStep("Otwórz forum i kliknij „Nowy post”.");
  const go = document.createElement("a"); go.className = "btn sm primary rfs-go";
  go.href = RFS_CHANNEL; go.target = "_blank"; go.rel = "noopener noreferrer";
  go.setAttribute("data-noi18n", "");
  const goIc = document.createElement("span");
  goIc.className = "bic bic-discord"; goIc.setAttribute("aria-hidden", "true");
  go.appendChild(goIc);
  const goTx = document.createTextNode("");
  go.appendChild(goTx);
  s2.row.appendChild(go);
  const join = document.createElement("p"); join.className = "rfs-hint-add";
  const jTxt = document.createElement("span");
  const jLink = document.createElement("a");
  jLink.href = RFS_INVITE; jLink.target = "_blank"; jLink.rel = "noopener noreferrer";
  jLink.className = "rfs-invite";
  // ONE invite sentence in the whole app — this one. The hub (rf-39l), the wheel's post window
  // (rf-46f) and the help window (rf-47b) say it in exactly these words too: three wordings for one
  // door read as three different doors. Painted in _sync with the rest of this step, so a language
  // switch with the wizard open cannot leave it in the language it was built in.
  join.appendChild(jTxt); join.appendChild(jLink);
  s2.li.appendChild(join);

  // 3 — the words.
  const s3 = mkStep("Wklej tytuł i treść:");
  s3.row.appendChild(_rfsCopyBtn(_gl("Kopiuj tytuł", "Copy title"), function () { return _rfsPost().title; }));
  s3.row.appendChild(_rfsCopyBtn(_gl("Kopiuj treść", "Copy body"), function () { return _rfsPost().body; }));
  // OSTRZEŻENIE O DŁUGOŚCI, a nie blokada przycisku: Discord powyżej limitu nie odrzuca i nie ucina
  // wpisu, tylko zamienia go w załącznik message.txt, a wklejenie i tak robi człowiek w oknie
  // Discorda, które ma własny licznik. Zgaszony przycisk zabrałby przy okazji awaryjną drogę
  // kopiowania (textarea .rfs-raw pod nim), czyli karałby problem ze schowkiem problemem z treścią.
  // Własny element, a NIE ten spod pozycji 1: tam po kliknięciu ląduje komunikat o pobranym pliku
  // i skasowałby ostrzeżenie o tym, przed czym ostrzega.
  const lenNote = document.createElement("p"); lenNote.className = "rfs-dlnote bad"; lenNote.hidden = true;
  s3.li.appendChild(lenNote);

  // 4 — the tags and the attachment, which Discord's own form asks for last. Pills rather than a
  // sentence: on the forum they are things to click, and a list you compare by eye beats a sentence
  // you have to parse while looking at another window.
  const s4 = mkStep("Zaznacz tagi i przeciągnij pobrany plik do posta:");
  const tagPills = document.createElement("span"); tagPills.className = "rfs-tagpills";
  s4.row.appendChild(tagPills);

  const note = document.createElement("p"); note.className = "rfs-hint-add";
  note.textContent = "Post wychodzi z Twojego konta, więc jest podpisany i możesz go potem poprawić.";
  host.appendChild(note);

  host._sync = function () {
    goTx.textContent = _gl("Otwórz ", "Open ") + RFS_FORUM_NAME + " ↗";
    jTxt.textContent = _gl("Nie jesteś jeszcze na serwerze? ", "Not on the server yet? ");
    jLink.textContent = _gl("Dołącz zaproszeniem ↗", "Join with the invite ↗");
    const tags = _rfsTags();
    // The forum shows tags WITH their emoji, so the preview does too — otherwise the pills here
    // and the ones being ticked over there would not look like the same thing.
    const pills = tags.map(function (n) { return rfPostTagEmoji(n) + " " + n; });
    // No author handed over on purpose: the post carries no nick line any more — it is signed by
    // the Discord account it goes out from, and the preview says exactly that with „Ty".
    // Jeden skład na odświeżenie: podgląd i pomiar długości muszą patrzeć na DOKŁADNIE ten sam
    // tekst, a nie na dwa niezależne wywołania składarki.
    const post = _rfsPost();
    view.innerHTML = (typeof rfDiscordPreview === "function")
      ? rfDiscordPreview(post, pills, {file: rfPostFileName(_rfsKind, _rfsTargetName())})
      : "";
    tagPills.textContent = "";
    if (!pills.length) {
      const none = document.createElement("i"); none.className = "rfs-nomod";
      none.textContent = _gl("brak", "none");
      tagPills.appendChild(none);
    } else {
      pills.forEach(function (t) {
        const s = document.createElement("span"); s.className = "rfs-tagpill";
        s.setAttribute("data-noi18n", "");   // literal forum labels, same reason as the chips
        s.textContent = t;
        tagPills.appendChild(s);
      });
    }
    // Dwa różne limity i dwa różne pola, więc komunikat nazywa to, które przekracza, i mówi o ile.
    // Liczymy jednostki UTF-16 (String.length), tak samo jak okno koła: emoji w treści liczy się za
    // dwa, więc ostrzeżenie zapala się odrobinę za wcześnie, nigdy za późno.
    const over = [];
    if (post.title.length > RF_FORUM_TITLE_MAX) {
      over.push(_gl("Tytuł wątku ma " + post.title.length + " znaków, a Discord przyjmuje " + RF_FORUM_TITLE_MAX
                    + ". Skróć o " + (post.title.length - RF_FORUM_TITLE_MAX) + " nazwę albo pole „Gra lub program” w kroku „Plik”.",
                    "The thread title is " + post.title.length + " characters and Discord accepts " + RF_FORUM_TITLE_MAX
                    + ". Shorten the name, or the “Game or program” field on the “File” step, by " + (post.title.length - RF_FORUM_TITLE_MAX) + "."));
    }
    if (post.body.length > RF_FORUM_BODY_MAX) {
      over.push(_gl("Treść ma " + post.body.length + " znaków, a Discord przyjmuje " + RF_FORUM_BODY_MAX
                    + ". Skróć o " + (post.body.length - RF_FORUM_BODY_MAX) + " pole „Krótki opis” w kroku „Plik” — dłuższy wpis Discord wkleja jako załącznik message.txt zamiast treści posta.",
                    "The body is " + post.body.length + " characters and Discord accepts " + RF_FORUM_BODY_MAX
                    + ". Shorten the “Short description” field on the “File” step by " + (post.body.length - RF_FORUM_BODY_MAX) + " — a longer post is pasted by Discord as a message.txt attachment instead of the body."));
    }
    lenNote.hidden = !over.length;
    lenNote.textContent = over.join(" ");
  };
}

// ---- navigation --------------------------------------------------------------
// Why a step can BLOCK: both gates guard something the author cannot see from here. A nameless
// post is a nameless thread forever; an untagged one is invisible to every filter on the forum.
// Everything else is a suggestion.
function _rfsBlocker(step) {
  if (step === 0) {
    // Nothing to attach means nothing to post about — and unlike a missing name, this one cannot be
    // fixed in this window, so the message says where to go instead.
    if (_rfsKind !== "setup" && _rfsKind !== "bundle" && !_rfsTarget) {
      return (_rfsKind === "pack")
        ? _gl("Nie ma czego wysłać: zbuduj aplikację REST z akcjami na ekranie Usługi sieciowe.",
              "There is nothing to send: build a REST application with actions on the Network services screen.")
        : _gl("Nie ma czego wysłać: zapisz najpierw preset w Bibliotece.",
              "There is nothing to send: save a preset in the Library first.");
    }
    // A set for several capsules, posted from a machine with one, would arrive as a set with one
    // role in it — the reader would get a file that does not do what the title says.
    if (_rfsKind === "bundle" && rfPostCapsules() < 2) {
      return _gl("Ten rodzaj jest na kilka kapsli, a masz jeden. Wyślij zwykły zestaw.",
                 "This kind is for several capsules and you have one. Send a plain setup instead.");
    }
    // The gate is about a NAMELESS thread, not about a filled-in field: a preset or a pack already
    // has a name of its own, and the title line right above says so ("Trigger preset: Precision").
    // Demanding the setup card's name field on top of that asked the author to retype what they
    // had just chosen from the picker.
    if (!rfPostVal("setupName") && !(rfPostKind(_rfsKind).prefix && _rfsTargetName())) {
      return _gl("Podaj nazwę, z tego powstaje tytuł wątku.",
                 "Give it a name; that is what becomes the thread title.");
    }
  }
  if (step === 1) {
    const all = _rfsTags();
    if (!all.some(rfPostIsDomain)) {
      return _gl("Wybierz zastosowanie, żeby dało się to znaleźć.",
                 "Pick a use so it can be found.");
    }
    if (all.length > RFS_TAG_MAX) {
      return _gl("Za dużo tagów jak na jeden wątek.", "Too many tags for one post.");
    }
  }
  return null;
}

// opts (optional): {kind: "setup"|"trig"|"axis"|"pack", target: "<preset name / REST app id>"}.
// The wizard opens on a setup when nobody says otherwise — that is the button in the setup card.
// The presets bar under the trigger list opens the same wizard already pointing at the preset the
// person was looking at, so "share this one" does not start with picking it again. Handing a kind in
// also decides HOW step one opens: with the kind confirmed in one line rather than asked with five
// chips. Only „Podziel się swoim", which says nothing about which of the five, really has to ask.
// An unknown kind falls back to a setup rather than throwing: this is a door, not a form.
function rfShareOpen(opts) {
  if (_rfsBack) return;
  const o = opts || {};
  _rfsPrevFocus = document.activeElement;
  _rfsStep = 0;
  const known = !!(o.kind && rfPostKind(o.kind).k === o.kind);
  _rfsKind = known ? o.kind : "setup";
  _rfsTarget = (_rfsKind !== "setup" && o.target) ? String(o.target) : "";
  _rfsPicked = _rfsSavedDomains();
  // Opened from a bar that already named the file → confirm it. Opened from „Podziel się swoim",
  // which says nothing about WHICH of the five, → ask. An unrecognised kind counts as not knowing:
  // confirming a fallback would state something the caller never said.
  _rfsChoose = !known;
  _rfsScope = null;   // every section, until somebody says otherwise in step one

  const back = document.createElement("div");
  back.className = "rfk-back rfs-back"; back.setAttribute("role", "presentation");
  const card = document.createElement("div");
  card.className = "rfk-card rfs-card";
  card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", "Kreator posta z zestawem");

  const head = document.createElement("div"); head.className = "rfk-head";
  const h = document.createElement("h3"); h.className = "rfk-title"; h.textContent = "Podziel się na forum";
  // „Why am I doing all this" lives one button away from the wizard, not only in the window that
  // opened it: plenty of people land here straight from the setup card and have never seen the hub.
  const help = document.createElement("button");
  help.type = "button"; help.className = "rfk-x rfs-help";
  help.setAttribute("aria-label", _gl("Jak działa dzielenie się", "How sharing works"));
  help.title = _gl("Jak działa dzielenie się", "How sharing works");
  help.textContent = "?";
  help.addEventListener("click", function () {
    if (typeof rfShareHowTo === "function") rfShareHowTo();
  });
  const x = document.createElement("button"); x.type = "button"; x.className = "rfk-x";
  x.setAttribute("aria-label", "Zamknij"); x.textContent = "×";
  x.addEventListener("click", rfShareClose);
  head.appendChild(h); head.appendChild(help); head.appendChild(x);

  const stepper = document.createElement("div"); stepper.className = "rfs-stepper";
  const pills = RFS_STEPS.map(function (s, i) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "rfs-pill"; b.setAttribute("data-noi18n", "");
    b.innerHTML = "<i>" + (i + 1) + "</i>" + miEsc(_gl(s.pl, s.en));
    b.addEventListener("click", function () { if (i < _rfsStep) _rfsGoto(i); });
    stepper.appendChild(b);
    return b;
  });

  const body = document.createElement("div"); body.className = "rfs-body";
  const panels = RFS_STEPS.map(function () {
    const d = document.createElement("div"); d.className = "rfs-step";
    body.appendChild(d);
    return d;
  });
  _rfsBuildStep1(panels[0]);
  _rfsBuildStep2(panels[1]);
  _rfsBuildStep3(panels[2]);

  // The footer only steers the wizard now. Downloading, opening the forum and copying all live
  // inside the numbered list of the last step, in the order they happen — a footer button belonging
  // to step one of that list was the easiest thing on the screen to miss.
  const foot = document.createElement("div"); foot.className = "rfk-foot rfs-foot";
  const why = document.createElement("span"); why.className = "rfs-block";
  const backBtn = document.createElement("button");
  backBtn.type = "button"; backBtn.className = "btn sm"; backBtn.textContent = "Wstecz";
  backBtn.addEventListener("click", function () { _rfsGoto(_rfsStep - 1); });
  const nextBtn = document.createElement("button");
  nextBtn.type = "button"; nextBtn.className = "btn sm primary"; nextBtn.textContent = "Dalej";
  nextBtn.addEventListener("click", function () { _rfsGoto(_rfsStep + 1); });
  const doneBtn = document.createElement("button");
  doneBtn.type = "button"; doneBtn.className = "btn sm primary"; doneBtn.textContent = "Gotowe";
  doneBtn.addEventListener("click", rfShareClose);
  foot.appendChild(why); foot.appendChild(backBtn); foot.appendChild(nextBtn); foot.appendChild(doneBtn);

  _rfsRefresh = function () {
    const last = _rfsStep === RFS_STEPS.length - 1;
    panels.forEach(function (p, i) {
      p.classList.toggle("on", i === _rfsStep);
      if (i === _rfsStep && p._sync) p._sync();
    });
    pills.forEach(function (b, i) {
      b.classList.toggle("on", i === _rfsStep);
      b.classList.toggle("done", i < _rfsStep);
      b.disabled = i > _rfsStep;
    });
    const blocker = _rfsBlocker(_rfsStep);
    why.textContent = blocker || "";
    nextBtn.disabled = !!blocker;
    nextBtn.hidden = last;
    doneBtn.hidden = !last;
    backBtn.disabled = _rfsStep === 0;
  };
  _rfsGoto = function (n) {
    if (n < 0 || n >= RFS_STEPS.length) return;
    if (n > _rfsStep && _rfsBlocker(_rfsStep)) return;
    _rfsStep = n;
    _rfsRefresh();
    const f = _rfsFocusFirst(panels[n]);
    setTimeout(function () { try { if (f) f.focus(); } catch (e) {} }, 30);
  };

  card.appendChild(head); card.appendChild(stepper);
  card.appendChild(body); card.appendChild(foot);
  back.appendChild(card);

  back.addEventListener("mousedown", function (e) { if (e.target === back) rfShareClose(); });
  back._onKey = function (e) {
    // Another dialog can sit ON TOP of this one — the export picker, opened by the download button
    // in the footer. This handler is on the capture phase, so without stepping aside it would eat
    // that dialog's Escape and close the wizard underneath it instead.
    if (document.getElementById("rfInc") || document.getElementById("rfSafe") ||
        document.getElementById("rfHowTo")) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); rfShareClose(); return; }
    // Enter moves on, the way it does in every other form — except in the textareas, where it is
    // a line break the author actually wants.
    if (e.key === "Enter" && !e.shiftKey && card.contains(e.target) && e.target.tagName === "INPUT") {
      e.preventDefault(); _rfsGoto(_rfsStep + 1); return;
    }
    if (e.key !== "Tab") return;
    const f = Array.prototype.filter.call(
      card.querySelectorAll("a[href]:not([hidden]),button:not([disabled]):not([hidden]),input,textarea"),
      function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener("keydown", back._onKey, true);

  document.body.appendChild(back);
  _rfsBack = back;
  _rfsRefresh();
  // Requirements come from the server (only it knows about drivers and MIDI ports). The wizard is
  // usable without them; when they land, the module chips and the "Needs:" line redraw.
  fetch("/setup/requires").then(function (r) { return r.json(); }).then(function (res) {
    if (!_rfsBack) return;
    _rfsReq = (res && res.requires) || [];
    _rfsRefresh();
    try { if (typeof applyLang === "function") applyLang(back); } catch (e) {}
  }).catch(function () {});
  // Saved presets, so the "which one" picker lists real files rather than asking the author to type
  // a name. Same source the Library reads; the wizard is usable before it lands.
  fetch("/library").then(function (r) { return r.json(); }).then(function (res) {
    if (!_rfsBack || !res || !res.ok) return;
    _rfsLib = res;
    _rfsRefresh();
  }).catch(function () {});
  try { if (typeof applyLang === "function") applyLang(back); } catch (e) {}
  setTimeout(function () {
    try { (_rfsFocusFirst(panels[0]) || x).focus(); } catch (e) {}
  }, 30);
}

function initShare() {
  const who = document.getElementById("setupAuthor");
  if (who) {
    try { who.value = localStorage.getItem(RFS_AUTHOR_KEY) || ""; } catch (e) {}
    who.addEventListener("change", function () {
      try { localStorage.setItem(RFS_AUTHOR_KEY, (who.value || "").trim()); } catch (e) {}
    });
  }
  // A set imported from somebody else and then changed is a NEXT revision of theirs, not a first
  // of ours — so the field starts one past what came in, and stays editable.
  const rev = document.getElementById("setupRev");
  if (rev && !rev.value) {
    const lin = (typeof rfLineage === "function") ? rfLineage() : null;
    rev.value = lin ? Math.min(999, (lin.rev || 1) + 1) : 1;
  }
  // The „Wymiana" button next to the setup card (#setupShare) is NOT wired here any more. It used to
  // jump straight into the post wizard, while every other kind of file opened the hub first — so the
  // one thing people share most often was the one place that offered no way to browse the forum or
  // pull somebody else's file back. It now goes through initShareHub (rf-39l) like all the rest, and
  // the hub calls rfShareOpen({kind:"setup"}) from its first row.
}

window.rfShareOpen = rfShareOpen;
window.rfShareClose = rfShareClose;
