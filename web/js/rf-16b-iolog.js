"use strict";
// ======================= MIDI / OSC SEND JOURNAL (front) =======================
//  The REST log's counterpart for the two output groups, and it is built the same way: its own
//  card, always open, sitting directly under the controller it belongs to. It used to be a
//  collapsed <details> at the very bottom of the tab, below a long help fold — a live view
//  nobody can see is not a live view, and a journal that only polls while it happens to be
//  unfolded looks broken to anyone who never unfolded it.
//
//  The server (io_log in ribbitflip_monitor.py) records EVENTS, not packets: every threshold
//  crossing, note, program change, park and test button gets a line, while a continuous stream
//  contributes one summary every couple of seconds ("172 messages, 0–180, last 137"). Logging
//  50 lines a second would bury the very thing the journal exists to show — which is why
//  per-packet mode is a switch in the header, off by default, and says so.
//
//  Two things the journal deliberately shows that a naive "log what we sent" would not:
//    * BLOCKED streams (ok=false). Group on, armed, mapping reacting, no MIDI port — the
//      journal says so on the same cadence as a real stream instead of staying empty.
//    * an empty state that names the actual reason (group off / no mappings / nothing moved),
//      because "Nothing has gone out yet" is not an answer when the user believes it should.
//
//  Own file because rf-16-midi.js is already past the 800-line hard limit in
//  .github/CONTRIBUTING.md. Flat classic script like the rest of the app — no IIFE,
//  no modules; every name here is prefixed `iolog` to stay clear of the shared global scope.
const IOLOG_POLL_MS = 700;              // only ticks while the panel is on screen
const IOLOG_ROWS = 160;                 // how many rows a panel keeps on screen
const IOLOG_FRESH_S = 3;                // "live" dot: newest entry younger than this
const _iologState = {};                 // proto -> {seq, rows, card, host, stat, every}

function iologFmtTime(t) {
  const d = new Date(t * 1000);
  const p = (n, w) => String(n).padStart(w || 2, "0");
  return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()) +
         "." + p(Math.floor((t % 1) * 1000), 3);
}
// kind -> [label, css modifier]. The modifier only says "this went up / this went down /
// this is a safety action", so the eye can scan a column without reading it.
function iologKind(k) {
  const T = {
    "stream":     [_gl("strumień", "stream"), "flow"],
    "pkt":        [_gl("pakiet", "packet"), "flow"],
    "bang":       [_gl("impuls", "impulse"), "up"],
    "gate-on":    [_gl("bramka ▲", "gate ▲"), "up"],
    "gate-off":   [_gl("bramka ▼", "gate ▼"), "down"],
    "toggle-on":  [_gl("przełącznik ▲", "latch ▲"), "up"],
    "toggle-off": [_gl("przełącznik ▼", "latch ▼"), "down"],
    "pulse-on":   [_gl("impuls ▲", "pulse ▲"), "up"],
    "pulse-off":  [_gl("impuls ▼", "pulse ▼"), "down"],
    "park":       [_gl("parkowanie", "park"), "safe"],
    "test":       [_gl("test", "test"), "test"],
    "note-on":    [_gl("nuta ▲", "note ▲"), "up"],
    "note-off":   [_gl("nuta ▼", "note ▼"), "down"],
    "program":    [_gl("program", "program"), "up"],
    "panic":      [_gl("panika", "panic"), "safe"],
  };
  return T[k] || [k, ""];
}
// Why a mapping that is on and armed still put nothing on the wire. The server sends a machine
// key (see MidiMapper._why_blocked) precisely so the sentence can live here, in both languages.
function iologWhy(k) {
  const W = {
    "noport": _gl("nie wybrano portu MIDI OUT", "no MIDI OUT port selected"),
    "nomidi": _gl("MIDI wyłączone przy starcie (--no-midi)", "MIDI switched off at startup (--no-midi)"),
    "noosc":  _gl("wyjście OSC niedostępne (--no-midi)", "OSC output unavailable (--no-midi)"),
    "drop":   _gl("odbiornik nie przyjął komunikatu", "the receiver did not take the message"),
    // …and the two reasons the PANEL knows about before the server does — a test refused here
    // never reaches it, so the key is written by iologLocal() rather than by MidiMapper.
    "midioff": _gl("moduł MIDI wyłączony", "the MIDI module is off"),
    "oscoff":  _gl("moduł OSC wyłączony", "the OSC module is off"),
  };
  return W[k] || "";
}
// A row the PANEL writes itself. The journal is the server's ring and stays that way, but an
// action the panel REFUSES to send never reaches the server — and "I pressed Test and nothing
// happened" is precisely the question this panel exists to answer. `seq: 0` keeps the poll's
// bookkeeping untouched (it only ever raises `st.seq` from entries the server sent), so a local
// row can never hide a real one.
function iologLocal(proto, e) {
  const st = _iologState[proto];
  if (!st) return;
  st.rows = st.rows.concat([Object.assign({t: Date.now() / 1000, seq: 0, ok: false}, e)])
                   .slice(-IOLOG_ROWS);
  iologRender(proto);
}
function iologDetail(e) {
  const esc = (typeof miEsc === "function") ? miEsc : (s => String(s == null ? "" : s));
  const bits = [];
  if (e.addr) bits.push('<code>' + esc(e.addr) + '</code>');
  // DOKĄD to poszło. Tylko dla nazwanych urządzeń: cel domyślny nie ma nazwy, a dopisywanie
  // „domyślny" przy każdym wierszu zamieniłoby dziennik w kolumnę tego samego słowa.
  if (e.to) bits.push("→ " + esc(e.to));
  if (e.d && e.proto === "midi") bits.push(esc(e.d));
  if (e.cc != null) bits.push("CC " + e.cc);
  if (e.note != null) bits.push((typeof miNoteName === "function" ? miNoteName(e.note) : e.note) +
                                (e.vel != null ? (" · vel " + e.vel) : ""));
  if (e.prog != null) bits.push("#" + e.prog);
  if (e.ch != null) bits.push(_gl("kan. ", "ch ") + e.ch);
  if (e.kind === "stream") {
    // the shape of the window, not a single number: how many went out and what they spanned
    bits.push("<b>" + e.n + "</b> " + _gl("komunikatów", "messages"));
    bits.push(e.lo + " – " + e.hi);
    bits.push(_gl("ostatnio ", "last ") + e.val);
  } else if (e.val != null) {
    bits.push("<b>" + (e.val === true ? "true" : e.val === false ? "false" : e.val) + "</b>");
  }
  if (e.ms != null) bits.push(e.ms + " ms");
  if (e.n != null && e.kind === "panic") bits.push(e.n + " " + _gl("kanałów", "channels"));
  if (e.ok === false) {
    const why = iologWhy(e.why);
    bits.push('<span class="iolog-bad">' + _gl("nie wysłano", "not sent") +
              (why ? (" — " + why) : "") + "</span>");
  }
  return bits.join(" · ");
}
// What to say when there is nothing on screen. "Nothing has gone out yet" is only the truth when
// everything else is in place; every other case has a specific, fixable reason and saying it here
// is the difference between "the journal is broken" and "ah, the group is off".
// WHY IS THIS EMPTY. The sentence is picked from the live state, and it used to be picked ONCE —
// at mount, which happens before the MIDI config has arrived over SSE. So a tab with two mappings
// on screen kept insisting there were none: the reason was computed while the list really was
// empty and nothing ever recomputed it (a poll with no new rows only refreshed the counter).
// An empty journal says one thing only: nothing has gone out yet. WHY nothing goes out (no mapping,
// module off, no port, no UDP) is the readiness line's job under the module head (P-G3-08), and the
// journal used to repeat the empty list's sentence right under it. Until something can go out, the
// empty journal is blank.
function iologEmpty(proto) {
  const on = (proto === "osc") ? !!(state.midi && state.midi.oscEnabled)
                               : !!(state.midi && state.midi.enabled);
  const maps = ((state.midi && state.midi.mappings) || [])
    .filter(m => m.enabled !== false && ((m.dest === "osc") === (proto === "osc")));
  if (!maps.length || !on) return "";
  if (proto === "midi" && typeof miDiag === "function") {
    let d = null; try {d = miDiag();} catch (e) {}
    if (d && d.ok === false) return "";
  }
  if (proto === "osc" && state.midiEnv && state.midiEnv.oscAvail === false) return "";
  return _gl("Nic jeszcze nie poszło. Porusz kapslem albo kliknij „Test wyjścia” w edytorze mapowania.",
             "Nothing has gone out yet. Move the capsule or hit “Test output” in the mapping editor.");
}
function iologRender(proto) {
  const st = _iologState[proto];
  if (!st || !st.host) return;
  iologStats(proto);
  if (!st.rows.length) {
    const txt = iologEmpty(proto);
    if (st.emptyTxt !== txt) {st.emptyTxt = txt; st.host.innerHTML = txt ? '<div class="iolog-empty">' + txt + "</div>" : "";}
    return;
  }
  st.emptyTxt = null;
  const esc = (typeof miEsc === "function") ? miEsc : (s => String(s == null ? "" : s));
  st.host.innerHTML = st.rows.slice().reverse().map(e => {
    const k = iologKind(e.kind);
    return '<div class="ev' + (e.ok === false ? " bad" : "") + '">' +
      '<span class="t">' + iologFmtTime(e.t) + "</span>" +
      '<span class="iolog-k ' + k[1] + '">' + esc(k[0]) + "</span>" +
      '<span class="iolog-n">' + esc(e.name || "") + "</span>" +
      '<span class="iolog-d">' + iologDetail(e) + "</span>" +
      "</div>";
  }).join("");
}
// Header counter. The dot next to it is the whole point of the panel being always-on: it says
// "something went out a second ago" without the user having to read a single row.
function iologStats(proto) {
  const st = _iologState[proto];
  if (!st || !st.stat) return;
  if (!st.rows.length) {st.stat.textContent = ""; st.stat.classList.remove("on"); return;}
  const last = st.rows[st.rows.length - 1].t;
  st.stat.textContent = st.rows.length + " " + _gl("wpisów", "entries") +
                        " · " + _gl("ostatnio ", "last ") + iologFmtTime(last).slice(0, 8);
  st.stat.classList.toggle("on", (Date.now() / 1000 - last) < IOLOG_FRESH_S);
}
function iologPoll(proto) {
  const st = _iologState[proto];
  if (!st) return;
  fetch("/midi/log?proto=" + proto + "&since=" + st.seq + "&limit=" + IOLOG_ROWS)
    .then(r => r.json()).then(d => {
      if (!d || !d.ok) return;
      // Per-packet mode is process-wide (one ring), so the checkbox mirrors the server rather
      // than its own last click — the other tab, or a restart, can have moved it.
      if (d.every && st.every) st.every.checked = !!d.every[proto];
      // The server's seq is global (both protocols share one counter), so `since` must track
      // the newest entry THIS panel actually received — not d.seq, or the other tab's traffic
      // would silently skip rows here.
      if (d.entries && d.entries.length) {
        for (const e of d.entries) if (e.seq > st.seq) st.seq = e.seq;
        st.rows = st.rows.concat(d.entries).slice(-IOLOG_ROWS);
        iologRender(proto);
      } else {
        iologStats(proto);          // the dot has to go out again when the stream stops
        if (!st.rows.length) iologRender(proto);   // …and the "why is it empty" line can have changed
      }
    }).catch(() => {});
}
function iologTick(proto) {
  const st = _iologState[proto];
  if (!st || !st.card) return;
  // Poll only while the panel is actually on screen (its tab is the active one). A journal
  // nobody is looking at has no business making a request every second — but it no longer has
  // to be unfolded first, which was the reason it looked dead.
  if (st.card.offsetParent !== null) iologPoll(proto);
}
function iologClear(proto) {
  fetch("/midi/log/clear", {method: "POST", headers: {"Content-Type": "application/json"}, body: "{}"})
    .then(r => r.json()).then(() => {
      for (const p of Object.keys(_iologState)) {   // one buffer on the server = clear both views
        _iologState[p].rows = []; _iologState[p].seq = 0; iologRender(p);
      }
      if (typeof miFlash === "function") miFlash(_gl("Dziennik wyczyszczony ✓", "Journal cleared ✓"));
    }).catch(() => {});
}
function iologSetEvery(proto, on) {
  fetch("/midi/log/mode", {method: "POST", headers: {"Content-Type": "application/json"},
                           body: JSON.stringify({proto: proto, every: !!on})})
    .then(r => r.json()).then(d => {
      const st = _iologState[proto];
      if (d && d.every && st && st.every) st.every.checked = !!d.every[proto];
      if (typeof miFlash === "function") {
        miFlash(on ? _gl("Dziennik: każdy pakiet z osobna", "Journal: every packet, one by one")
                   : _gl("Dziennik: podsumowania co 2 s", "Journal: a summary every 2 s"));
      }
    }).catch(() => {});
}
// Builds the panel as its own card and drops it right after the controller it belongs to —
// same shape as the REST send log, and above every help fold rather than below it. Called once
// per protocol from initIoLog, after both cards exist.
function iologMount(cardId, proto) {
  const card = document.getElementById(cardId);
  if (!card || _iologState[proto]) return;
  const isOsc = (proto === "osc");
  const title = isOsc ? "Dziennik wysyłek OSC" : "Dziennik wysyłek MIDI";
  // Built as a SUB-SECTION of the controller card, not a card of its own: a header row plus a
  // list, exactly like "Dziennik wyzwoleń" at the bottom of the Mapping tab. Two elements appended
  // straight to the card, because `.card>.head.sub` is what gives that header its look — wrapped in
  // a div it would be a different-looking header saying the same thing.
  // Static markup stays Polish on purpose: the i18n DOM walker keys on it (rf-01-i18n.js).
  const head = document.createElement("div");
  head.className = "head sub iolog-head";
  head.innerHTML =
    "<h2>" + title + "</h2>" +
    '<span class="hint">' + (isOsc
      ? "każde zdarzenie osobno · sterowanie ciągłe streszczane co 2 s"
      : "nuty i zdarzenia osobno · sterowanie ciągłe streszczane co 2 s") + "</span>" +
    '<span class="iolog-live" id="ioLogStat-' + proto + '" aria-live="polite"></span>' +
    '<label class="iolog-every" title="Pokazuj każdy pakiet z osobna zamiast podsumowania co dwie sekundy. Przy sterowaniu ciągłym bufor 800 wpisów zapełnia się w kilkanaście sekund.">' +
      '<input type="checkbox" id="ioLogEvery-' + proto + '"> każdy pakiet</label>' +
    '<button class="btn xs" id="ioLogClear-' + proto + '" type="button">Wyczyść</button>';
  const list = document.createElement("div");
  list.className = "log iolog-log";
  list.id = "ioLogList-" + proto;
  list.setAttribute("aria-label", title);
  card.appendChild(head);
  card.appendChild(list);
  _iologState[proto] = {seq: 0, rows: [], card: list,
                        host: list,
                        stat: head.querySelector(".iolog-live"),
                        every: head.querySelector("#ioLogEvery-" + proto)};
  head.querySelector("#ioLogClear-" + proto).onclick = () => iologClear(proto);
  _iologState[proto].every.onchange = (ev) => iologSetEvery(proto, ev.target.checked);
  iologRender(proto);
  iologPoll(proto);                                  // never a blank first second
  setInterval(() => iologTick(proto), IOLOG_POLL_MS);
}
// The kind labels, the counter and the empty state are built with _gl() at RENDER time, so a
// language switch has to redraw what is already on screen. Called from miRelang() (rf-16),
// which setLang() runs.
function iologRelang() {
  for (const p of Object.keys(_iologState)) {
    const st = _iologState[p]; if (st) st.emptyTxt = null;   // force the sentence to be rebuilt
    iologRender(p);
  }
}
// Called from onMidiCfg (rf-16) the moment the controller config lands or changes: adding the
// first mapping, or flipping a group switch, changes what the empty panel should be saying.
function iologRefresh() { iologRelang(); }
function initIoLog() {
  // UX 261120 L4c: dziennik to piętro 3, karta w „Zaawansowane” na dole ekranu (#oscLogCard, #miLogCard).
  iologMount(document.getElementById("oscLogCard") ? "oscLogCard" : "oscCard", "osc");
  iologMount(document.getElementById("miLogCard") ? "miLogCard" : "midiCard", "midi");
}
