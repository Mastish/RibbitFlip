"use strict";
// ================== WHAT GOES INTO A POST ABOUT A SETUP ==================
// The text of the post, the tags that make it findable and the name of the attached file — the
// content, with no opinion about how it gets collected. The wizard (rf-39f) owns the flow and the
// screens; the preview (rf-39h) owns what it looks like on the forum. This file sits between them
// so both read from the same source, and so "what the post says" can be reasoned about without
// wading through dialog plumbing.
//
// Everything here reads the app's own state: the fields in the setup bar, which output groups are
// switched on, and the requirements the server worked out. The only inputs are the two things the
// app cannot know — the chosen tags, and the optional "why".

// THE TAGS OF #zestawy. Names and emoji come from the ONE dictionary in rf-00-core (RF_FORUM_TAGS,
// read off the live server on 2026-09-02) — this file used to keep its own copy, and that copy is
// exactly how „Mysz" and „Kontroler" survived here for weeks as tags this server has never had.
// Emoji travel with the names because that is how they read on the forum, and the whole point of
// showing a tag is that it can be matched by eye against the forum's own picker.
const RFS_DOMAINS = RF_FORUM_TAGS.domain;
// A setup post may claim a module tag or the two extras of #zestawy — never a symptom tag, which
// belongs to #pomoc. „🎡 Koło wyboru" is on the list because the WHEEL's own post window (rf-46f)
// asks this file for its emoji; a post about a setup must not tick it, because a setup file does
// not carry the wheel at all (RF_SETUP_SECTIONS in rf-28) — see rfPostModuleTags below.
const RFS_MULTI_TAG = RF_TAG_MULTI;
const RFS_TAG_MAX = 5;      // Discord's own ceiling per forum post

// WHAT is being shared. Until packs carried the movements there was only one answer — a setup — so
// the wizard never asked. Now four kinds of file leave this app, they need different tags, a
// different sentence about what the reader has to do, and a different exporter behind the download
// button. The `mods` list is the honest part: a module tag may only be claimed when it can be
// PROVEN, which is the same rule the forum guidelines state.
//   • setup — the modules are read live off the configuration (see rfPostModuleTags),
//   • trig  — a trigger preset is Mapping and nothing else,
//   • pack  — a REST pack is REST API and nothing else. This tag was deliberately never suggested
//     while REST rules could not travel; now they can, so the tag became provable,
//   • axis  — NO module tag. The forum has two tag axes, domain and module, and axis tuning is not
//     a module: it feeds triggers, motion, MIDI and pads alike. Picking one of them would be the
//     "tag that misses the truth" the guidelines warn against, so the kind goes in the title instead.
// ⚠️ LISTA JEST LICZONA Z REJESTRU RODZAJÓW (rf-49-kinds), nie wypisana tu drugi raz. Do 2026-08-31
// stało tu pięć pozycji z własnym opisem każdej — i to jest powód, dla którego trzy rodzaje presetów
// dołożone w sierpniu (mysz, MIDI/OSC, usługi sieciowe) dawało się POBRAĆ z Biblioteki, a nie dawało
// wysłać: nikt nie dopisał ich TUTAJ. Teraz rodzaj wchodzi do kreatora w chwili, w której trafia
// do rejestru.
//
// Kolejność jest kolejnością rejestru: najpierw całe konfiguracje (zestaw, zestaw na kilka kapsli),
// potem presety pojedynczych modułów, na końcu paczka. Czyta się to od największego do najmniejszego,
// czyli tak, jak ludzie o tym myślą.
//
// KOŁA TU NIE MA i to jest jedyny świadomy wyjątek (`ownWizard` w rejestrze): jego preset mieści się
// w TREŚCI wpisu, w bloku kodu, więc nie potrzebuje załącznika — a cały ostatni krok tego kreatora
// jest o załączniku. Ma własne okno w rf-46f, które bierze stąd listę tagów i kształt treści.
const RFS_KINDS = (function () {
  const R = (typeof RF_KINDS !== "undefined") ? RF_KINDS : (window.RF_KINDS || {});
  const out = [];
  for (const id in R) {
    const K = R[id];
    if (!K.share || K.ownWizard) continue;
    out.push({k: K.shareId, pl: K.pl.one, en: K.en.one,
              // `mods` = tagi modułów, które wolno zaznaczyć. `null` znaczy „policz z konfiguracji"
              // (zestaw i bundle), pusta tablica znaczy „ten rodzaj nie należy do żadnego modułu
              // albo jego tagu na forum jeszcze nie ma" — wtedy rodzaj stoi w TYTULE wątku.
              mods: (K.tags === null || K.tags === undefined) ? null : K.tags.slice(),
              prefix: K.pl.prefix,
              plWhat: (K.explain || ["", ""])[0], enWhat: (K.explain || ["", ""])[1],
              plTodo: (K.todo || ["", ""])[0], enTodo: (K.todo || ["", ""])[1]});
  }
  return out;
})();
function rfPostKind(k) {
  for (const x of RFS_KINDS) if (x.k === k) return x;
  return RFS_KINDS[0];
}

function rfPostVal(id) { const e = document.getElementById(id); return e ? (e.value || "").trim() : ""; }
function rfPostOn(id) { const e = document.getElementById(id); return !!(e && e.getAttribute("aria-checked") === "true"); }

// One lookup for the whole app: rf-46f asks this file for an emoji rather than keeping a map of
// its own, and this file asks rf-00-core. A name the server does not have gets "".
function rfPostTagEmoji(n) {
  return rfTagEmoji(n);
}

function rfPostIsDomain(n) {
  return RFS_DOMAINS.some(function (d) { return d.n === n; });
}

// Module tags that can be PROVEN from the state of the app. Pad Xbox, MIDI and OSC come from the
// server's own reading of the configuration (the same one that answers "will this work here?"),
// so a tag can never claim a module the setup does not really drive. REST API is deliberately
// absent: its rules live outside the setup file, so a setup post cannot honestly claim it.
function rfPostModuleTags(req, kind) {
  const K = rfPostKind(kind);
  if (K.mods) return K.mods.slice();    // a preset or a pack IS one module — nothing to read off
  const t = [];
  if (rfPostOn("trigEnable")) t.push("Mapowanie");
  // ONE tag for both halves of motion control, and read off the ENGINE rather than a switch: since
  // the split there are two toggles (#mEnable / #kEnable), each lit only for its own half, so asking
  // one of them would have hidden every stick setup. Until 2026-09-02 this line pushed „Mysz" or
  // „Kontroler" depending on the mode — two names that DO NOT EXIST on this server, so the wizard
  // was sending people to hunt for tags no picker would ever show them. #zestawy carries the same
  // „🖱️ Sterowanie ruchem" that every other forum on this server does.
  {
    const mo = (typeof state !== "undefined" && state.mouse) || {};
    if (mo.enabled) t.push(RF_TAG_MOTION);
  }
  const keys = (req || []).map(function (r) { return r.key; });
  // A virtual controller in use — the server's own reading of the configuration, not a checkbox.
  if (keys.indexOf("pad") >= 0) t.push(RF_TAG_PAD);
  if (keys.indexOf("midi") >= 0) t.push("MIDI");
  if (keys.indexOf("osc") >= 0) t.push("OSC");
  if (rfPostOn("padEnable")) t.push("Pady i synth");
  // Proven the same way the modules are — off the thing being shared. Two capsules paired means a
  // bundle really does carry two, and one capsule means the tag would be a lie, so it is absent.
  if (kind === "bundle" && rfPostCapsules() > 1) t.push(RFS_MULTI_TAG);
  return t;
}
// How many capsules this machine has. A bundle is built from every slot, so this is also how many
// the file will carry — and the number the reader needs before they open the thread.
function rfPostCapsules() {
  try { return Object.keys((state && state.devices) || {}).length; } catch (e) { return 0; }
}
// The roles as the author wrote them, in slot order — for the post body ("Kapsle: 2 — Kierowanie ·
// Skok i strzał"), which is the sentence that makes a multi-capsule set understandable in a list.
function rfPostRoles() {
  try {
    return Object.values(state.devices || {})
      .filter(function (D) { return D && D.meta && D.meta.dev; })
      .sort(function (a, b) { return (a.meta.slot || 0) - (b.meta.slot || 0); })
      .map(function (D) {
        const r = (typeof rfBundleRoles === "function") ? (rfBundleRoles()[D.meta.dev] || null) : null;
        return (r && r.name) || D.meta.label || D.meta.name || D.meta.dev;
      });
  } catch (e) { return []; }
}

// Picked tags that still hold: a module tag stops being true the moment its group is switched off,
// or the moment the author changes what kind of file they are sharing.
function rfPostTags(picked, req, kind) {
  const mods = rfPostModuleTags(req, kind);
  return (picked || []).filter(function (n) { return rfPostIsDomain(n) || mods.indexOf(n) >= 0; });
}

// `target` = the name of the chosen preset / REST application, when there is one. For prefixed
// kinds it is the title's SOURCE, not a fallback: the wizard hides the Name field for them, so the
// setup card's name (which belongs to a different file entirely) must not be able to override the
// name of the preset actually going out — that produced "Preset wyzwalaczy: Mój zestaw" whenever
// the setup card happened to be filled in. The field is only a fallback when the preset is nameless.
function rfPostTitle(kind, target) {
  const K = rfPostKind(kind);
  const name = K.prefix ? (String(target || "").trim() || rfPostVal("setupName")) : rfPostVal("setupName"),
        forApp = rfPostVal("setupFor");
  // Title shape from the forum's own guidelines: "Name — game or program". Skipped when the
  // name already contains the program, which is what people type when the setup IS the game —
  // "Trackmania precyzyjny — Trackmania" reads like a stutter.
  const dup = !!(forApp && name && name.toLowerCase().indexOf(forApp.toLowerCase()) >= 0);
  const body = (name || _gl("Mój zestaw", "My setup")) + (forApp && !dup ? " — " + forApp : "");
  // The forum has no tag for "what kind of file is this", so for anything that is not a plain setup
  // the kind leads the title. Somebody scrolling the list has to be able to tell a whole
  // configuration from a single preset without opening the thread.
  return K.prefix ? (_gl(K.prefix, K.en) + ": " + body) : body;
}

// The name the preview shows on the attachment. It has to match what the download button actually
// produces, or the preview promises a file the reader will not recognise: the library writes
// "ribbitflip-<kind>-…", the setup exporter writes "ribbitflip-setup-…" and the REST pack writes
// "ribbitflip-akcje-…".
const RFS_FILE_PFX = (function () {
  const R = (typeof RF_KINDS !== "undefined") ? RF_KINDS : (window.RF_KINDS || {});
  const out = {};
  for (const id in R) if (R[id].shareId && R[id].file) out[R[id].shareId] = R[id].file;
  return out;
})();
function rfPostFileName(kind, target) {
  // A bundle is named after the game first, because that is what its exporter writes — the preview
  // has to promise the file the download button actually produces.
  const raw = (kind === "bundle")
    ? (rfPostVal("setupFor") || rfPostVal("setupName") || "rig")
    : ((target != null && String(target).trim()) ? String(target) : rfPostVal("setupName"));
  const base = (typeof rfSetupFileBase === "function") ? rfSetupFileBase(raw) : "zestaw";
  return (RFS_FILE_PFX[kind] || RFS_FILE_PFX.setup) + base + ".json";
}

// „Paczka" is the one feminine name on the list of kinds, and Polish will not let a sentence ignore
// that: „wczytasz ją", everything else „wczytasz go". Read off the name rather than hardcoded per
// kind, so a kind added later gets the right pronoun without anybody remembering this line exists.
function _rfpIt(K) {
  return /a$/.test(String(K.pl || "").split(" ")[0]) ? "ją" : "go";
}
// „Setup" → „setup" mid-sentence, but „REST action pack" and „3D axis preset" keep their first word:
// lowercasing an acronym or a model number makes it look like a typo rather than a sentence.
function _rfpLow(s) {
  const t = String(s || ""), w = t.split(" ")[0];
  if (!t || /[0-9]/.test(w) || w === w.toUpperCase()) return t;
  return t[0].toLowerCase() + t.slice(1);
}

// st: {req: [...requirements], kind: "setup"|"trig"|"axis"|"pack", target: "…", tags: ["Granie",…]}
// The post reads like a post by a person, not a spec sheet: every line has to earn its place.
// What is left is the things only THIS author can say (the description, the game) and the things
// the app can prove while the reader cannot guess them (the tags, the capsule roles, the
// requirements). Anything with nothing to say emits no line at all.
// No signature line: the post goes out from the author's own Discord account, which says who wrote
// it better than a typed-in nick ever did, and a revision number is something people write into the
// thread when they publish a fix. What remains of that line is the lineage — whose work a fork
// grew out of is a fact about the FILE, and it still deserves its sentence.
// The tags are in the BODY on purpose: they used to exist only as pills next to the preview, so
// „Kopiuj treść" produced a post with no trace of them. Ticking the real tags on the forum is still
// step four of the checklist, but now a pasted post carries the same facts as text.
function rfPostCompose(st) {
  const s = st || {};
  const K = rfPostKind(s.kind);
  const desc = rfPostVal("setupDesc");
  const forApp = rfPostVal("setupFor");
  const lin = (typeof rfLineage === "function") ? rfLineage() : null;
  // A whole configuration — a setup or a rig — as opposed to one slice of one.
  const whole = (s.kind == null || s.kind === "setup" || s.kind === "bundle");
  const tags = Array.isArray(s.tags) ? s.tags : [];
  const doms = tags.filter(rfPostIsDomain);
  // „Kilka kapsli" is proven and tagged, but as a line it would repeat the „Kapsle" line below.
  const mods = tags.filter(function (n) { return !rfPostIsDomain(n) && n !== RFS_MULTI_TAG; });
  const withEmoji = function (n) { return (rfPostTagEmoji(n) + " " + n).trim(); };
  const L = [];
  // The author's own words, first and unadorned. A label in front of them would turn two sentences
  // somebody wrote into a field somebody filled in.
  if (desc) { L.push(desc); L.push(""); }
  if (forApp) L.push(_gl("🎯 **Do czego:** ", "🎯 **What for:** ") + forApp);
  // The chosen tags, in the two dimensions the forum itself uses. The names stay in the forum's own
  // language deliberately — they are the literal labels to tick, not vocabulary to translate.
  if (doms.length) L.push(_gl("🏷️ **Zastosowanie:** ", "🏷️ **Use:** ") + doms.map(withEmoji).join(" · "));
  if (mods.length) L.push(_gl("🧩 **Moduły:** ", "🧩 **Modules:** ") + mods.map(withEmoji).join(" · "));
  // The first thing a reader has to know about a multi-capsule set: how many capsules, and what
  // each one is for. Without this line the thread is a lottery ticket — you find out by importing.
  if (s.kind === "bundle") {
    const n = rfPostCapsules(), roles = rfPostRoles();
    L.push(_gl("👥 **Kapsle:** ", "👥 **Capsules:** ") + n +
      (roles.length ? (" · " + roles.join(" · ")) : ""));
  }
  // The reader's machine is not this machine, so the post says what the file NEEDS — never what
  // happens to be installed here. „Nothing" is the ordinary case and tells nobody anything, so it
  // no longer takes a line to say it.
  const needs = whole ? ((typeof rfRequiresNames === "function") ? rfRequiresNames(s.req) : []) : [];
  if (needs.length) L.push(_gl("🔌 **Wymaga:** ", "🔌 **Needs:** ") + needs.join(" · "));
  if (lin) {
    L.push(_gl("🌱 **Na bazie:** „", "🌱 **Based on:** “") + (lin.name || "?") + "”" +
      (lin.author ? (" (" + lin.author + ")") : ""));
  }
  // JAK TEGO UŻYWAĆ — kroki, które autor wpisał w pierwszym kroku kreatora. Numerowane, bo to jest
  // kolejność czynności; w poście, bo post czyta się PRZED pobraniem pliku i to on decyduje, czy
  // ktoś w ogóle sięgnie po zestaw. W pliku jadą tak samo (`howto`), więc po wczytaniu stoją
  // w oknie importu i w szufladzie Biblioteki — jedna treść, trzy miejsca, żadnego przepisywania.
  {
    const hw = rfPostVal("setupHowto");
    const kroki = hw ? hw.split("\n").map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 8) : [];
    if (kroki.length) {
      L.push(_gl("🧭 **Jak tego używać:**", "🧭 **How to use it:**"));
      kroki.forEach(function (k, i) { L.push((i + 1) + ". " + k); });
    }
  }
  // Only three kinds have anything here, and what they have is a real chore waiting on the other
  // side (retune the axes, assign the roles, put your own credential in). A kind with none says
  // nothing, rather than „nothing to do".
  if (K.plTodo) L.push(_gl("ℹ️ **Po wczytaniu:** ", "ℹ️ **After loading:** ") + _gl(K.plTodo, K.enTodo));
  L.push("");
  // The last line is the one that turns a reader into somebody who HAS the file: the attachment,
  // then the shortest real way into their app. Quoted from the buttons as they are ACTUALLY
  // labelled — this sentence leaves the machine and is where a newcomer learns the words.
  L.push(_gl("📎 " + K.pl + " w załączniku. Wczytasz " + _rfpIt(K) +
             " w RibbitFlip: ekran „Zestawy” → „Wczytaj plik lub odnośnik”, albo upuść plik na panel.",
             "📎 The " + _rfpLow(K.en) + " is attached. Load it in RibbitFlip: the “Setups” screen → " +
             "“Load a file or link”, or drop the file onto the panel."));
  return {title: rfPostTitle(s.kind, s.target), body: L.join("\n")};
}
