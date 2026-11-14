"use strict";
// ============ WHAT IS WHAT: A SETUP, A PRESET AND THE CONFIGURATION, AS A GRAPH ============
// The tab is called "Configs and presets" and for a long time explained neither, while the app's own
// vocabulary worked against it: the same file was a "profile" in one tab, a "preset" in the hint
// beside it and a "setup" here. The first attempt at fixing that was three tiles of prose. It was
// correct and nobody read it, because the thing being explained is a RELATION — which file contains
// which parts of your configuration — and prose is the wrong shape for a relation.
//
// So it is a graph. Six blocks on the left are the configuration you have right now; three nodes on
// the right are the files you can write it to; the edges say what goes into what. Pick a file and it
// says out loud what loading it will overwrite and what it will leave alone, which is the question
// people actually hesitate over. The count on each node ("6 parts" vs "1 part") is the whole idea in
// one glance: these are not different KINDS of thing, they are different SIZES of the same slice.
//
// Collapsed by default, in the same fold shape the tab's guide already uses. Rebuilt from scratch on
// a language switch (whatIsRelang) because every label is composed with _gl() at build time — see
// the same arrangement in rf-39i.

const RFW_NS = "http://www.w3.org/2000/svg";

// The six groups a setup is made of, in the order the app itself lists them.
// `low` is a separate field rather than t.toLowerCase(): lowercasing turns "MIDI / OSC" into
// "midi / osc" and "Osie 3D" into "osie 3d". Acronyms are written the way they are written.
function _rfwBlocks() {
  return [
    // Pad BUTTONS are in here, not in the block below: they are ordinary rules whose action happens
    // to be `pad:a`, so the file carries them with the other triggers even though the panel edits
    // them in the „Kontroler" tab. The note under the graph says so out loud.
    {id: "rules", t: _gl("Wyzwalacze", "Triggers"),
     s: _gl("próg → klawisz, mysz, pad, makra", "threshold → key, mouse, pad, macros"),
     low: _gl("wyzwalacze", "the triggers")},
    // One config section behind two tabs („Mysz" and „Kontroler"), and the name follows the label
    // the setup picker uses (RF_SETUP_SECTIONS in rf-28), so the same thing is not called two names.
    {id: "mouse", t: _gl("Mysz i kontroler", "Mouse & controller"),
     s: _gl("mysz, gałka, krzyżak, przypisanie padów", "mouse, stick, d-pad, pad assignment"),
     low: _gl("ustawienia myszy i kontrolera", "the mouse and controller settings")},
    {id: "midi", t: "MIDI / OSC",
     s: _gl("nuty, CC, wiadomości", "notes, CC, messages"),
     // W wyliczeniu „MIDI i OSC" zderza się z „i" przed ostatnim elementem, stąd ukośnik.
     low: "MIDI/OSC"},
    // Skaner wchodzi do zestawu od 2026-09-13 (RF_SETUP_SECTIONS w rf-28, SETUP_KEYS w monitorze).
    {id: "scan", t: _gl("Skaner", "Scanner"),
     s: _gl("obszar, sekcje, tempo, czasy", "area, sections, tempo, timings"),
     low: _gl("skaner", "the scanner")},
    {id: "pose", t: _gl("Osie 3D", "3D axes"),
     s: _gl("kalibracja, filtr, tor sygnału", "calibration, filter, signal chain"),
     low: _gl("osie 3D", "the 3D axes")},
    {id: "power", t: _gl("Oszczędzanie baterii", "Battery saving"),
     s: _gl("usypianie, budzenie", "sleep, wake"),
     low: _gl("oszczędzanie baterii", "battery saving")},
    {id: "pad", t: _gl("Synth: pady i dźwięki", "Synth: pads and sounds"),
     s: _gl("opcjonalnie", "optional"),
     low: _gl("pady Syntha", "the Synth pads")},
    // Uslugi sieciowe sit in this frame like everything else, but no setup reaches them — they have
    // own. Until action packs carried the movements, this row lived OUTSIDE the frame captioned
    // "goes into no file at all", which stopped being true the moment a pack could carry a whole
    // working configuration. A picture that says something false is worse than no picture.
    {id: "rest", t: _gl("Usługi sieciowe", "Network services"),
     s: _gl("własne wywołania HTTP i ruchy", "your own HTTP calls and movements"),
     low: _gl("Usługi sieciowe", "Network services")}
  ];
}

function _rfwFiles() {
  return [
    {id: "setup", t: _gl("Zestaw", "Setup"),
     s: _gl("cała konfiguracja jednego kapsla", "the whole configuration of one capsule"),
     extra: _gl("+ nazwa · gra · opis · autor · wersja", "+ name · game · description · author · revision"),
     path: "Library/Setups/", color: "var(--pink)", tint: "rgba(236,26,131,.10)",
     whole: true,                      // "everything at once" is about the setup, not about a count
     covers: ["rules", "mouse", "midi", "scan", "pose", "power", "pad"]},
    // JEDEN KAFEL NA WSZYSTKIE PRESETY MODUŁÓW, a nie dwa wybrane. Do 2026-08-31 stały tu preset
    // wyzwalaczy i preset osi 3D — bo tylko te dwa wtedy istniały. Potem doszły mysz i kontroler,
    // MIDI i OSC, usługi sieciowe, koło i syntezator, a rysunek dalej pokazywał dwa: czytało się
    // to jako „presety są dla dwóch modułów", czyli nieprawdę. Dorysowanie siedmiu kafli nie
    // wchodzi w grę (kolumna ma miejsce na trzy), a wybranie z nich „najważniejszych" byłoby tą
    // samą pomyłką jeszcze raz. Kafel mówi więc to, co jest naprawdę: KAŻDY moduł ma swoje presety,
    // ale plik jest zawsze o JEDNYM z nich.
    {id: "mod", t: _gl("Preset modułu", "A module preset"),
     s: _gl("jeden moduł, ten i tylko ten", "one module, that one and no other"),
     // ⚠️ Ta linia MUSI się zmieścić w kaflu (384 jednostki viewBox). Pełne nazwy modułów
     // („mysz i kontroler", „MIDI i OSC") wychodziły 13 jednostek poza prawą krawędź rysunku.
     extra: _gl("wyzwalacze · mysz · MIDI/OSC · osie · koło · usługi · synth",
                "triggers · mouse · MIDI/OSC · axes · wheel · services · synth"),
     path: "Library/", color: "var(--green)", tint: "rgba(108,179,63,.12)",
     oneOf: true,                      // podświetla wszystkie moduły, ale mówi „jeden naraz"
     covers: ["rules", "mouse", "midi", "scan", "pose", "pad", "rest"]},
    {id: "pack", t: _gl("Paczka akcji REST", "REST action pack"),
     s: _gl("wywołania HTTP razem z ruchami", "the HTTP calls together with the movements"),
     extra: _gl("bez tokenów i haseł — te zostają w sejfie", "no tokens or passwords — those stay in the vault"),
     path: _gl("plik .json z ekranu Usługi sieciowe", "a .json file from the Network services screen"),
     color: "var(--az)", tint: "rgba(200,151,26,.14)",
     adds: true,                       // a pack APPENDS to an application; it replaces nothing
     covers: ["rest"]}
  ];
}

// ---- geometry of the main graph ----------------------------------------------
const RFW_L = {x: 36, y: 76, w: 300, h: 414};
const RFW_ROW = {x: 52, w: 268, h: 42, y0: 90, gap: 8};   // 8 bloków mieści się w ramce (do y 490)
const RFW_F = {x: 700, w: 384};
const RFW_FY = {setup: {y: 92, h: 150},
                // Kafel presetu modułu jest wysoki, bo wymienia moduły — to ta linia niesie całą
                // różnicę między „presety są dla dwóch rzeczy" a „presety ma każdy moduł".
                mod: {y: 266, h: 150},
                // The pack node is the tall one: it is the only file that has to say out loud what
                // it does NOT carry, so its extra line needs room above the path.
                pack: {y: 448, h: 104}};

let _rfwPicked = null;

function _rfwE(n, a) {
  const e = document.createElementNS(RFW_NS, n);
  for (const k in a) e.setAttribute(k, a[k]);
  return e;
}
function _rfwT(x, y, cls, s) {
  const t = _rfwE("text", {x: x, y: y, class: cls});
  t.textContent = s;
  return t;
}
function _rfwRowY(i) { return RFW_ROW.y0 + i * (RFW_ROW.h + RFW_ROW.gap); }
function _rfwRowMid(i) { return _rfwRowY(i) + RFW_ROW.h / 2; }

function _rfwGraph(svg, blocks, files) {
  svg.textContent = "";

  const defs = _rfwE("defs", {});
  files.forEach(function (f) {
    const m = _rfwE("marker", {id: "rfw-ar-" + f.id, viewBox: "0 0 10 10", refX: "9", refY: "5",
      markerWidth: "5.5", markerHeight: "5.5", orient: "auto-start-reverse"});
    m.appendChild(_rfwE("path", {d: "M 0 0 L 10 5 L 0 10 z", fill: f.color}));
    defs.appendChild(m);
  });
  svg.appendChild(defs);

  svg.appendChild(_rfwT(RFW_L.x, 60, "wi-cap", _gl("TO, CO MASZ TERAZ W APLIKACJI", "WHAT YOU HAVE IN THE APP RIGHT NOW")));
  svg.appendChild(_rfwE("rect", {x: RFW_L.x, y: RFW_L.y, width: RFW_L.w, height: RFW_L.h, rx: 18, class: "wi-frame"}));

  blocks.forEach(function (b, i) {
    const g = _rfwE("g", {"data-blk": b.id});
    g.appendChild(_rfwE("rect", {x: RFW_ROW.x, y: _rfwRowY(i), width: RFW_ROW.w, height: RFW_ROW.h,
      rx: 12, class: "wi-blk"}));
    g.appendChild(_rfwT(RFW_ROW.x + 14, _rfwRowY(i) + 20, "wi-blk-t", b.t));
    g.appendChild(_rfwT(RFW_ROW.x + 14, _rfwRowY(i) + 36, "wi-blk-s", b.s));
    svg.appendChild(g);
  });

  // Outside the frame on purpose, and it is the ONE thing here that no file carries in any
  // direction: the vault. Everything else on this picture can be written to disk and handed to
  // somebody; tokens and passwords cannot, which is the whole reason a pack is shareable at all.
  const rest = _rfwE("g", {});
  rest.appendChild(_rfwE("rect", {x: RFW_ROW.x, y: 506, width: RFW_ROW.w, height: 44, rx: 12,
    class: "wi-out"}));
  rest.appendChild(_rfwT(RFW_ROW.x + 14, 528, "wi-blk-t", _gl("Sejf poświadczeń", "The credential vault")));
  rest.appendChild(_rfwT(RFW_ROW.x + 14, 543, "wi-out-s",
    _gl("nie wchodzi do żadnego pliku", "goes into no file at all")));
  svg.appendChild(rest);

  svg.appendChild(_rfwT(RFW_F.x, 60, "wi-cap", _gl("CO Z TEGO ZAPISUJESZ NA DYSK", "WHAT YOU WRITE TO DISK")));

  files.forEach(function (f) {
    const p = RFW_FY[f.id];
    const g = _rfwE("g", {class: "wi-file", "data-file": f.id, tabindex: "0", role: "button",
      "aria-pressed": "false", "aria-label": f.t + ": " + f.s});
    g.appendChild(_rfwE("rect", {x: RFW_F.x, y: p.y, width: RFW_F.w, height: p.h, rx: 16,
      class: "wi-file-box", fill: f.tint, stroke: f.color}));
    g.appendChild(_rfwT(RFW_F.x + 18, p.y + 30, "wi-file-t", f.t));
    g.appendChild(_rfwT(RFW_F.x + 18, p.y + 50, "wi-file-s", f.s));
    if (f.extra) g.appendChild(_rfwT(RFW_F.x + 18, p.y + 74, "wi-file-s", f.extra));
    const pth = _rfwT(RFW_F.x + 18, p.y + p.h - 14, "wi-file-p", f.path);
    pth.setAttribute("data-noi18n", "");    // a folder name is a folder name in both languages
    g.appendChild(pth);

    // The count turns "how much does it take" into something you compare by eye, not by reading.
    const cx = RFW_F.x + RFW_F.w - 34, cy = p.y + 30;
    g.appendChild(_rfwE("circle", {cx: cx, cy: cy, r: 16, fill: f.color}));
    const n = _rfwT(cx, cy + 5, "wi-tally", String(f.covers.length));
    n.setAttribute("text-anchor", "middle");
    g.appendChild(n);
    const lab = _rfwT(cx, cy + 30, "wi-file-s",
      f.covers.length === 1 ? _gl("część", "part") : _gl("części", "parts"));
    lab.setAttribute("text-anchor", "middle");
    g.appendChild(lab);

    g.addEventListener("click", function () { _rfwPick(f.id === _rfwPicked ? null : f.id); });
    g.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); _rfwPick(f.id === _rfwPicked ? null : f.id); }
    });
    svg.appendChild(g);
  });

  files.forEach(function (f) {
    const p = RFW_FY[f.id], n = f.covers.length;
    f.covers.forEach(function (bid, k) {
      const i = blocks.findIndex(function (b) { return b.id === bid; });
      const y1 = _rfwRowMid(i);
      // Entry points spread along the node's left edge, so six things visibly land in one place.
      const inset = 22;
      const y2 = (n === 1) ? p.y + p.h / 2 : p.y + inset + (p.h - 2 * inset) * (k / (n - 1));
      const d = "M " + (RFW_ROW.x + RFW_ROW.w) + " " + y1 +
                " C " + (RFW_ROW.x + RFW_ROW.w + 150) + " " + y1 +
                " " + (RFW_F.x - 150) + " " + y2 + " " + RFW_F.x + " " + y2;
      svg.appendChild(_rfwE("path", {d: d, class: "wi-edge", stroke: f.color,
        "data-edge": f.id, "marker-end": "url(#rfw-ar-" + f.id + ")"}));
    });
  });

  const s1 = _rfwT(500, 82, "wi-cap-s", _gl("zapis →", "saving →"));
  s1.setAttribute("text-anchor", "middle");
  svg.appendChild(s1);
  const s2 = _rfwT(500, 98, "wi-cap-s", _gl("← wczytanie", "← loading"));
  s2.setAttribute("text-anchor", "middle");
  svg.appendChild(s2);
}

function _rfwNames(ids, blocks) {
  const n = ids.map(function (id) {
    const b = blocks.find(function (x) { return x.id === id; });
    return b ? b.low : id;
  });
  if (n.length <= 1) return n[0] || "";
  return n.slice(0, -1).join(", ") + _gl(" i ", " and ") + n[n.length - 1];
}

function _rfwPick(id) {
  _rfwPicked = id;
  const host = document.getElementById("whatis-body");
  if (!host) return;
  const blocks = host._blocks, files = host._files;
  const f = files.find(function (x) { return x.id === id; }) || null;
  const svg = host.querySelector("#whatis-graph");
  if (!svg) return;

  svg.querySelectorAll("[data-edge]").forEach(function (e) {
    e.classList.toggle("on", !!f && e.getAttribute("data-edge") === id);
    e.classList.toggle("off", !!f && e.getAttribute("data-edge") !== id);
  });
  svg.querySelectorAll("[data-blk]").forEach(function (g) {
    const on = !f || f.covers.indexOf(g.getAttribute("data-blk")) >= 0;
    const box = g.querySelector(".wi-blk");
    box.classList.toggle("dim", !on);
    box.setAttribute("stroke", (f && on) ? f.color : "var(--stitch)");
    box.setAttribute("stroke-width", (f && on) ? "3" : "2");
    box.setAttribute("fill", (f && on) ? f.tint : "#fff");
    g.querySelectorAll(".wi-blk-t,.wi-blk-s").forEach(function (t) { t.classList.toggle("dim", !on); });
  });
  svg.querySelectorAll("[data-file]").forEach(function (g) {
    const me = g.getAttribute("data-file") === id;
    g.classList.toggle("dim", !!f && !me);
    g.setAttribute("aria-pressed", me ? "true" : "false");
  });
  host.querySelectorAll(".wi-pick[data-file]").forEach(function (b) {
    b.setAttribute("aria-pressed", b.getAttribute("data-file") === id ? "true" : "false");
  });

  const ch = host.querySelector("#whatis-change"), ke = host.querySelector("#whatis-keep");
  if (!f) {
    ch.textContent = _gl("Wybierz plik powyżej, a wypiszę tu, co zniknie po jego wczytaniu.",
                         "Pick a file above and this will say what disappears when you load it.");
    ke.textContent = _gl("Tu wyląduje to, czego ten plik nie dotyka.",
                         "This will say what that file does not touch.");
    return;
  }
  const rest = blocks.filter(function (b) { return f.covers.indexOf(b.id) < 0; })
                     .map(function (b) { return b.id; });
  // A pack is the odd one out and has to be said differently: it APPENDS actions and movements to an
  // application you already have. Calling that "replaces" would be a plain lie, and it is exactly
  // the question somebody asks before clicking import.
  if (f.adds) {
    ch.textContent = _gl("Dokłada do wybranej aplikacji REST: wywołania HTTP i gotowe ruchy, które je odpalają. Nic nie kasuje, dopisuje.",
                         "Adds to the REST application you choose: the HTTP calls and the ready-made movements that fire them. It deletes nothing, it appends.");
    ke.textContent = _gl("Wszystko inne, a przede wszystkim Twoje poświadczenia: paczka ich nie niesie i nie może. Token wpisujesz sam po imporcie.",
                         "Everything else, and above all your credentials: a pack does not carry them and cannot. You put the token in yourself after importing.");
    return;
  }
  if (f.oneOf) {
    // Kafel zbiorczy: podświetla wszystkie moduły, ale plik jest zawsze o JEDNYM. Zdanie „podmienia
    // wyzwalacze, mysz, MIDI, osie…" byłoby tu po prostu nieprawdą.
    ch.textContent = _gl("Podmienia JEDEN moduł — ten, którego preset wybierzesz: ",
                         "Replaces ONE module — the one whose preset you pick: ") +
      _rfwNames(f.covers, blocks) +
      _gl(". Plik niesie zawsze dokładnie jeden z nich.",
          ". The file always carries exactly one of them.");
    ke.textContent = _gl("Cała reszta. Preset jednego modułu nie ma czym nadpisać pozostałych — i to jest cały powód, dla którego presety istnieją obok zestawów.",
                         "Everything else. A single module's preset has nothing to overwrite the others with — and that is the whole reason presets exist alongside setups.");
    return;
  }
  ch.textContent = (f.whole
      ? _gl("Wszystko naraz: ", "Everything at once: ")
      : _gl("Podmienia: ", "Replaces: ")) + _rfwNames(f.covers, blocks) +
    _gl(". Twoje dotychczasowe ustawienia zostają zastąpione tym, co niesie plik.",
        ". Your current settings are replaced by whatever the file carries.") +
    (f.id === "setup" ? _gl(" Panel przeładuje się, bo zmiana dotyczy każdej grupy.",
                            " The panel reloads, because the change touches every group.") : "");
  ke.textContent = rest.length
    ? _gl("Bez zmian: ", "Untouched: ") + _rfwNames(rest, blocks) +
      _gl(". Plik ich nie niesie, więc nie ma czym ich nadpisać.",
          ". The file does not carry them, so there is nothing to overwrite them with.")
    : _gl("Nic. Zestaw to zdjęcie całej konfiguracji, więc po wczytaniu nie zostaje nic z poprzedniej.",
          "Nothing. A setup is a photograph of the whole configuration, so none of the previous one survives.");
}

function _rfwBundle(svg) {
  svg.textContent = "";
  const defs = _rfwE("defs", {});
  const m = _rfwE("marker", {id: "rfw-ar-b", viewBox: "0 0 10 10", refX: "9", refY: "5",
    markerWidth: "5.5", markerHeight: "5.5", orient: "auto-start-reverse"});
  m.appendChild(_rfwE("path", {d: "M 0 0 L 10 5 L 0 10 z", fill: "var(--idle)"}));
  defs.appendChild(m);
  svg.appendChild(defs);

  const src = [
    {t: _gl("Ustawienia aplikacji", "App settings"),
     s: _gl("wspólne dla wszystkich kapsli", "shared by every capsule"), y: 30, c: "var(--idle)"},
    {t: _gl("Zestaw kapsla 1", "Capsule 1 setup"),
     s: _gl("sześć części, tak jak wyżej", "six parts, as above"), y: 104, c: "var(--pink)"},
    {t: _gl("Zestaw kapsla 2", "Capsule 2 setup"),
     s: _gl("sześć części, tak jak wyżej", "six parts, as above"), y: 178, c: "var(--pink)"}
  ];
  src.forEach(function (s) {
    const g = _rfwE("g", {});
    g.appendChild(_rfwE("rect", {x: 36, y: s.y, width: 300, height: 56, rx: 13,
      fill: "#fff", stroke: s.c, "stroke-width": "2.5"}));
    g.appendChild(_rfwT(50, s.y + 24, "wi-blk-t", s.t));
    g.appendChild(_rfwT(50, s.y + 41, "wi-blk-s", s.s));
    svg.appendChild(g);
    const y1 = s.y + 28;
    svg.appendChild(_rfwE("path", {class: "wi-edge on", stroke: "var(--idle)",
      "marker-end": "url(#rfw-ar-b)",
      d: "M 336 " + y1 + " C 480 " + y1 + " 560 134 700 134"}));
  });

  const g = _rfwE("g", {});
  g.appendChild(_rfwE("rect", {x: 700, y: 90, width: 384, height: 88, rx: 16,
    fill: "rgba(168,154,125,.16)", stroke: "var(--idle)", "stroke-width": "3"}));
  g.appendChild(_rfwT(718, 120, "wi-file-t", _gl("Zestaw na kilka kapsli", "Multi-capsule set")));
  g.appendChild(_rfwT(718, 140, "wi-file-s",
    _gl("całe stanowisko w jednym pliku", "a whole rig in a single file")));
  const p = _rfwT(718, 164, "wi-file-p", _gl("plik wybrany przy eksporcie", "the file you pick on export"));
  g.appendChild(p);
  svg.appendChild(g);
}

// ---- the fold's contents ------------------------------------------------------
// A section that answers "why", folded away. The drawing above answers "what is what", and that is
// what the card is for; the reasoning behind it is worth keeping, but not worth three screens of
// scrolling before you reach the next control.
function _rfwMore(pl, en) {
  const d = document.createElement("details");
  d.className = "wi-more";
  const s = document.createElement("summary");
  s.textContent = _gl(pl, en);
  const box = document.createElement("div");
  box.className = "wi-more-body";
  d.appendChild(s); d.appendChild(box);
  return {d: d, box: box};
}

function _rfwBody() {
  const blocks = _rfwBlocks(), files = _rfwFiles();
  const body = document.createElement("div");
  body.className = "mapwiki-body wi-body";
  body.id = "whatis-body";
  body._blocks = blocks;
  body._files = files;

  const lede = document.createElement("p");
  lede.className = "wi-lede";
  lede.innerHTML = _gl(
    "<b>Konfiguracja</b> to nie plik. To stan, w jakim aplikacja jest w tej chwili: jak masz ustawione klawisze, ruch, MIDI, osie. <b>Zestaw</b> i <b>preset</b> to zdjęcia tego stanu zapisane na dysku. Różnią się jedną rzeczą: ile z niego biorą.",
    "<b>The configuration</b> is not a file. It is the state the app is in right now: how you have the keys, the motion, MIDI and the axes set. A <b>setup</b> and a <b>preset</b> are photographs of that state written to disk. They differ in one thing: how much of it they take.");
  body.appendChild(lede);

  const hint = document.createElement("p");
  hint.className = "wi-sub";
  hint.textContent = _gl("Kliknij plik po prawej, żeby zobaczyć, co po jego wczytaniu zniknie, a co zostanie.",
                         "Click a file on the right to see what loading it wipes out and what it leaves alone.");
  body.appendChild(hint);

  // picker
  const picker = document.createElement("div");
  picker.className = "wi-picker";
  files.forEach(function (f) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "wi-pick"; b.setAttribute("aria-pressed", "false");
    b.setAttribute("data-file", f.id);
    b.style.setProperty("--wi-c", f.color);
    const dot = document.createElement("span");
    dot.className = "wi-dot"; dot.style.background = f.color; dot.setAttribute("aria-hidden", "true");
    b.appendChild(dot);
    b.appendChild(document.createTextNode(f.t));
    b.addEventListener("click", function () { _rfwPick(f.id === _rfwPicked ? null : f.id); });
    picker.appendChild(b);
  });
  const reset = document.createElement("button");
  reset.type = "button"; reset.className = "wi-pick wi-reset";
  reset.textContent = _gl("Pokaż wszystko", "Show everything");
  reset.addEventListener("click", function () { _rfwPick(null); });
  picker.appendChild(reset);
  body.appendChild(picker);

  const stage = document.createElement("div");
  stage.className = "wi-stage";
  const svg = _rfwE("svg", {class: "wi-graph", id: "whatis-graph", viewBox: "0 0 1120 580",
    role: "img", "aria-label": _gl(
      "Graf: sześć części bieżącej konfiguracji po lewej, trzy rodzaje plików po prawej, krawędzie pokazują, które części wchodzą do którego pliku.",
      "A graph: six parts of the current configuration on the left, three kinds of file on the right, the edges show which parts go into which file.")});
  _rfwGraph(svg, blocks, files);
  stage.appendChild(svg);
  body.appendChild(stage);

  const verdict = document.createElement("div");
  verdict.className = "wi-verdict";
  verdict.innerHTML =
    '<div class="wi-v change"><h5>' + _gl("Po wczytaniu zmieni się", "Loading it changes") +
      '</h5><p id="whatis-change"></p></div>' +
    '<div class="wi-v keep"><h5>' + _gl("Zostanie bez zmian", "It leaves alone") +
      '</h5><p id="whatis-keep"></p></div>';
  body.appendChild(verdict);

  const arrows = document.createElement("p");
  arrows.className = "wi-note";
  arrows.innerHTML = _gl(
    "<b>Strzałki prowadzą w obie strony.</b> Tą samą drogą, którą stan idzie do pliku przy zapisie, wraca do aplikacji przy wczytaniu.",
    "<b>The arrows run both ways.</b> The road the state takes into a file when you save is the road it comes back by when you load.");
  body.appendChild(arrows);

  // Where a pad-button rule is EDITED and where it LIVES are two different answers since the
  // controller tab was split out, and the picture cannot show that on its own: the rule sits in the
  // „Wyzwalacze" block because that is the section of the file carrying it, while the panel edits it
  // three blocks away. Saying it here stops it reading like a mistake in the drawing.
  const padWhere = document.createElement("p");
  padWhere.className = "wi-note";
  padWhere.innerHTML = _gl(
    "<b>Przyciski pada jadą z wyzwalaczami.</b> Mapowania „gest → przycisk kontrolera” ustawiasz na ekranie Kontroler, ale w pliku siedzą razem z resztą reguł, w części Wyzwalacze. Preset wyzwalaczy zabiera je ze sobą, a część Mysz i kontroler niesie sam ruch oraz to, który kapsel steruje którym padem.",
    "<b>Pad buttons travel with the triggers.</b> You set the “gesture → controller button” mappings on the Controller screen, but in the file they sit with the rest of the rules, in the Triggers part. A trigger preset takes them along, while the Mouse & controller part carries the motion itself and which capsule drives which pad.");
  body.appendChild(padWhere);

  // The obvious question once REST has its own node: why is it not simply part of a setup? Answering
  // it here saves the reader guessing that it is an oversight.
  const restWhy = document.createElement("p");
  restWhy.className = "wi-note";
  restWhy.innerHTML = _gl(
    "<b>Czemu konfiguracja REST stoi osobno?</b> Bo jego plik ma własne bramki, których zestaw nie ma. Przy eksporcie paczka odmawia zapisu, jeśli znajdzie w treści akcji wartość wpisaną wprost z sejfu, a przy imporcie każde wywołanie przechodzi przegląd pod kątem obcego hosta i cudzych tokenów. Podgląd bezpieczeństwa zestawu ocenia makra klawiaturowe i nie umiałby ocenić żądania HTTP. Zestaw i paczkę wysyła się więc razem, dwoma plikami.",
    "<b>Why does the REST configuration stand apart?</b> Because its file has gates a setup does not. On export a pack refuses to write itself if it finds a vault value spelled out inside an action, and on import every call goes through a review for foreign hosts and other people's tokens. A setup's safety preview judges keyboard macros and would have no idea how to judge an HTTP request. So a setup and a pack travel together, as two files.");
  body.appendChild(restWhy);

  // ---- why they are separate
  // Folded, like the two sections after it. The drawing is the answer to "what is what"; these
  // three are the answers to "why", and left open they tripled the height of the card — which is
  // how a panel meant to explain something becomes a wall people scroll past. Reported by the
  // owner: „nie obejmuje tego całego na raz wzrokiem".
  const whyF = _rfwMore("Po co w ogóle ten podział", "Why they are separate at all");
  const why = whyF.box;
  why.innerHTML =
    '<p class="wi-sub">' + _gl(
      "Najkrótsza odpowiedź: bo kapsla stroisz raz, a klawisze zmieniasz co grę. Ten sam wieczór, dwie drogi.",
      "The short answer: you tune the capsule once and change the keys every game. The same evening, two roads.") + "</p>" +
    '<div class="wi-lanes">' +
      '<div class="wi-lane bad"><h5>' + _gl("Gdyby istniały same zestawy", "If setups were all there was") + "</h5><ol>" +
        "<li>" + _gl("Godzinę stroisz osie 3D pod swojego kapsla: kanały, filtr, czułość, martwa strefa.",
                     "You spend an hour tuning the 3D axes for your capsule: channels, filter, sensitivity, dead zone.") + "</li>" +
        "<li>" + _gl("Ustawiasz klawisze pod <b>grę A</b> i zapisujesz to jako zestaw.",
                     "You set the keys for <b>game A</b> and save that as a setup.") + "</li>" +
        "<li>" + _gl("Kolega przysyła Ci swój zestaw do <b>gry B</b>. Wczytujesz.",
                     "A friend sends you their setup for <b>game B</b>. You load it.") + "</li>" +
        "<li>" + _gl("Wchodzą jego klawisze, ale razem z nimi <b>jego osie</b>, bo zestaw niesie wszystko.",
                     "Their keys land, and their <b>axes</b> land with them, because a setup carries everything.") + "</li>" +
      '</ol><p class="wi-out-bad">' + _gl("Twoja godzina strojenia właśnie zniknęła. Kalibrujesz od nowa.",
                                          "Your hour of tuning has just gone. You calibrate again.") + "</p></div>" +
      '<div class="wi-lane good"><h5>' + _gl("Jak jest naprawdę", "How it actually works") + "</h5><ol>" +
        "<li>" + _gl("Godzinę stroisz osie 3D i zapisujesz je raz, jako <b>preset osi 3D</b>.",
                     "You spend the hour tuning the 3D axes and save them once, as a <b>3D axis preset</b>.") + "</li>" +
        "<li>" + _gl("Klawisze pod <b>grę A</b> zapisujesz osobno, jako <b>preset wyzwalaczy</b>.",
                     "The keys for <b>game A</b> you save separately, as a <b>trigger preset</b>.") + "</li>" +
        "<li>" + _gl("Do <b>gry B</b> wczytujesz sam preset wyzwalaczy.",
                     "For <b>game B</b> you load the trigger preset alone.") + "</li>" +
        "<li>" + _gl("Zmieniają się klawisze. Osie zostają Twoje, bo preset ich nie dotyka.",
                     "The keys change. The axes stay yours, because the preset does not touch them.") + "</li>" +
      '</ol><p class="wi-out-good">' + _gl("Jedno strojenie działa pod każdą grą. Zmieniasz tylko to, co faktycznie się zmienia.",
                                           "One tuning works under every game. You change only what actually changes.") + "</p></div>" +
    "</div>" +
    '<p class="wi-moral">' + _gl(
      "<b>A jeśli Cię to nie dotyczy?</b> To zacznij od zestawów — jeden plik na grę wystarczy do wszystkiego i niczego nie trzeba składać. Presety zaczynają się opłacać w chwili, w której jeden kawałek konfiguracji ma przeżyć zmianę pozostałych: strojenie osi pod Twojego kapsla, ustawienie myszy, które lubisz, zestaw mapowań MIDI. Od tej chwili zestaw jest po prostu <b>kilkoma presetami naraz</b> i tak też się go wczytuje: aplikacja mówi, z czego się składa, i dopisuje jego części do Twojej biblioteki, żeby dały się użyć osobno. Dzielić się można jednym i drugim — zestaw niesie nazwę, grę, opis, autora i wersję, a preset jedną rzecz, którą ktoś dopracował.",
      "<b>And if none of that applies to you?</b> Then start with setups — one file per game is enough for everything and there is nothing to assemble. Presets start paying off the moment one piece of the configuration has to survive a change of the others: the axis tuning for your capsule, the mouse feel you like, a set of MIDI mappings. From then on a setup is simply <b>several presets at once</b>, and that is how it loads: the app says what it is made of, and adds its parts to your library so they can be used on their own. Both are worth sharing — a setup carries a name, a game, a description, an author and a revision; a preset carries one thing somebody got right.") + "</p>";
  body.appendChild(whyF.d);

  // ---- bundle
  const bundleF = _rfwMore("Piętro wyżej: zestaw na kilka kapsli", "One level up: the multi-capsule set");
  const bundle = bundleF.box;
  bundle.innerHTML =
    '<p class="wi-sub">' + _gl(
      "Zestaw opisuje jednego kapsla. Zestaw na kilka kapsli (w pliku: bundle) bierze całe stanowisko: ustawienia aplikacji plus zestaw każdego kapsla, w jednym pliku.",
      "A setup describes one capsule. A multi-capsule set (in the file: a bundle) takes the whole rig: the app settings plus every capsule's setup, in one file.") + "</p>";
  const bstage = document.createElement("div");
  bstage.className = "wi-stage";
  const bsvg = _rfwE("svg", {class: "wi-graph", viewBox: "0 0 1120 250", role: "img",
    "aria-label": _gl("Graf: ustawienia aplikacji oraz zestaw kapsla 1 i kapsla 2 zbiegają się w jeden plik na kilka kapsli.",
                      "A graph: the app settings and the setups of capsule 1 and capsule 2 converge into one multi-capsule file.")});
  _rfwBundle(bsvg);
  bstage.appendChild(bsvg);
  bundle.appendChild(bstage);
  const bnote = document.createElement("p");
  bnote.className = "wi-note";
  bnote.textContent = _gl(
    "Taki plik robisz wtedy, gdy przenosisz się na inny komputer albo chcesz zabezpieczyć wszystko naraz. Do wysłania komuś konfiguracji pod jedną grę jest za duży: niesie także kapsle, których ta osoba nie ma.",
    "You make such a file when you move to another computer or want everything backed up at once. For sending somebody a configuration for one game it is too big: it also carries capsules that person does not have.");
  bundle.appendChild(bnote);
  body.appendChild(bundleF.d);

  // ---- what no file ever changes
  const neverF = _rfwMore("Czego nie zmienia żaden z tych plików", "What none of these files ever changes");
  const never = neverF.box;
  never.innerHTML =
    '<div class="wi-nevers">' +
      '<div class="wi-never"><h5>' + _gl("Włączniki grup wyjścia", "The output group switches") + "</h5><p>" +
        _gl("Plik wczytuje to, jak grupa jest <b>ustawiona</b>, ale nigdy jej nie włącza ani nie wyłącza. Włącznik znaczy „od teraz sygnał może opuścić ten komputer”, a tę decyzję podejmujesz Ty przy panelu, nie plik, który mógł przyjść od nieznajomego. Jeśli zestaw korzysta z modułu, który masz wyłączony, aplikacja to po imporcie powie, ale włączasz go sam.",
            "A file loads how a group is <b>configured</b>, but never switches it on or off. A switch means “input may leave this machine from now on”, and that decision is yours at the panel, not a file's, which may well have come from a stranger. If a setup uses a module you have switched off, the app says so after the import, but you switch it on yourself.") +
      "</p></div>" +
      '<div class="wi-never"><h5>' + _gl("Poświadczenia usług sieciowych", "Your network-service credentials") + "</h5><p>" +
        _gl("Tokeny i hasła leżą w osobnym, zaszyfrowanym sejfie i nie wchodzą do żadnego pliku: ani do zestawu, ani do zestawu na kilka kapsli, ani do paczki akcji. Samą konfigurację REST <b>można</b> się dzielić, właśnie dlatego, że sekrety siedzą gdzie indziej — paczka wiezie wywołania i ruchy, a token wpisuje u siebie ten, kto ją zaimportuje.",
            "Tokens and passwords live in a separate, encrypted vault and go into no file at all: not a setup, not a multi-capsule set, not an action pack. The REST configuration itself <b>can</b> be shared, precisely because the secrets sit elsewhere — a pack carries the calls and the movements, and whoever imports it puts in their own token.") +
      "</p></div>" +
    "</div>";
  body.appendChild(neverF.d);

  return body;
}

function initWhatIs() {
  const panel = document.getElementById("tab-konfiguracje");
  if (!panel || document.getElementById("whatis-fold")) return;
  const d = document.createElement("details");
  d.className = "mapwiki wi-fold";
  d.id = "whatis-fold";
  const s = document.createElement("summary");
  const ic = document.createElement("span");
  ic.className = "rfic guide-ic";
  ic.setAttribute("aria-hidden", "true");
  s.appendChild(ic);
  // A separate text node, same as the guides: the i18n walker matches whole text nodes.
  s.appendChild(document.createTextNode(
    _gl("Zestaw, preset, konfiguracja: co jest czym", "Setup, preset, configuration: what is what")));
  d.appendChild(s);
  d.appendChild(_rfwBody());
  // Inside the "how to" guide, right under its title: what these things ARE comes before what to
  // do with them. Prepended into the guide body, so when rf-49p turns the guide into the About pane
  // (title as h3, then the body) the block lands right after that h3, with no CSS reordering.
  // Runs after initGuides, so the chapter list is already in the body; the block goes above it.
  // Without the guide (the ?view=overview cheat sheet builds none) it keeps its old slot under the
  // exchange row, which stays at the top of the tab: a finished setup beats any explanation.
  const gbody = document.querySelector("#guide-konfiguracje > .mapwiki-body");
  const hero = document.getElementById("exchangeHero");
  if (gbody) {
    gbody.insertBefore(d, gbody.firstChild);
    if (hero && hero.parentNode === panel && panel.firstChild !== hero) panel.insertBefore(hero, panel.firstChild);
  } else if (hero && hero.parentNode === panel) {
    if (panel.firstChild !== hero) panel.insertBefore(hero, panel.firstChild);
    panel.insertBefore(d, hero.nextSibling);
  } else {
    panel.insertBefore(d, panel.firstChild);
  }
  _rfwPick(null);
}

// Rebuilt rather than translated in place: every label is composed with _gl() at build time, so a
// node rendered in English has no Polish original for the walker to restore. Same as rfLibRelang.
function whatIsRelang() {
  const d = document.getElementById("whatis-fold");
  if (!d) return;
  const wasOpen = d.open, keep = _rfwPicked;
  const old = d.querySelector("#whatis-body");
  const fresh = _rfwBody();
  if (old) d.replaceChild(fresh, old);
  const s = d.querySelector("summary");
  if (s && s.lastChild) s.lastChild.nodeValue =
    _gl("Zestaw, preset, konfiguracja: co jest czym", "Setup, preset, configuration: what is what");
  d.open = wasOpen;
  _rfwPick(keep);
}

window.initWhatIs = initWhatIs;
window.whatIsRelang = whatIsRelang;
