"use strict";
// ==================================================================================================
//  BIBLIOTEKA — LISTA (chipy faktów, wiersz, sekcje, wybór pozycji)
//
//  Wydzielone z rf-39i-library.js przy etapie 3 (limit 500/800 linii, .github/CONTRIBUTING.md).
//  Tam zostaje to, co Biblioteka ROBI z plikami (wczytaj, pobierz, zapisz, usuń) i skąd bierze dane;
//  tutaj to, jak wygląda jej lewa kolumna. Panel opisu po prawej ma własny plik (rf-39i2).
//
//  Wszystkie trzy pliki to zwykłe skrypty klasyczne, więc dzielą jedną globalną przestrzeń nazw:
//  `_rflData`, `_rflSel`, `_rflPick` i funkcje pomocnicze są tam, gdzie były.
// ==================================================================================================

// Facts as separate little patches rather than one grey run-on line: at a glance you are counting
// badges, not reading a sentence. `dim` marks the housekeeping ones (date, size) so the things
// that actually distinguish two entries stay in front.
function _rflChips(kind, it) {
  const c = [];
  if (it.broken) return [{t: _gl("nie daje się odczytać", "will not parse"), cls: "bad"}];
  const _rflKind = kind;                 // pigułki opisują POZYCJĘ, nie otwartą szufladę: lista
                                         // pokazuje teraz wszystkie rodzaje naraz (etap 3)
  if (_rflKind === "setup") {
    // Shipped with the app rather than saved by this person. Said out loud because it changes
    // what the row can do (there is no Delete) and because "where did this come from" is the
    // first question about a setup nobody remembers making.
    if (it.official) c.push({t: _gl("w aplikacji", "built in"), cls: "own"});
    c.push({t: "v" + (it.rev || 1)});
    if (it.author) c.push({t: it.author});
    if (it.rules != null) c.push({t: _rflRules(it.rules)});
    if (it.basedOn && it.basedOn.name) {
      c.push({t: _gl("na bazie: ", "based on: ") + it.basedOn.name});
    }
  } else if (_rflKind === "profile") {
    c.push({t: _rflRules(it.rules)});
  } else if (_rflKind === "mouse") {
    // Dwa fakty, które odróżniają dwa profile myszy od siebie na liście: dokąd idzie ruch
    // i czy kursor klika sam. Reszta to pokrętła — tych nie da się streścić pigułką.
    c.push({t: (it.mode === "stick") ? _gl("drążek", "stick")
              : (it.mode === "dpad") ? _gl("krzyżak", "d-pad")
              : _gl("kursor", "cursor")});
    if (it.dwell) c.push({t: _gl("klik bez klikania", "click without clicking")});
  } else if (_rflKind === "midi") {
    // Podział na wyjścia zamiast jednej liczby: zestaw z samym OSC działa bez loopMIDI, a zestaw
    // z samym MIDI bez odbiornika UDP — więc to on mówi, czego ten plik będzie od maszyny
    // potrzebował. Zero mapowań też ma pigułkę: pusty preset to rzecz, którą się kasuje.
    if (!it.maps) c.push({t: _gl("pusty", "empty"), cls: "bad"});
    if (it.midi) c.push({t: it.midi + " MIDI"});
    if (it.osc) c.push({t: it.osc + " OSC"});
    // Skala dotyczy wyłącznie mapowań nutowych, więc pokazujemy ją tylko wtedy, gdy w ogóle coś
    // znaczy — „chromatyczna" na zestawie samych CC byłaby pigułką o niczym.
    if (it.scale && it.scale !== "chromatic") c.push({t: it.scale});
  } else if (_rflKind === "rest") {
    // Dwa fakty, które odróżniają dwa zestawy usług na liście: ile akcji i ile z nich odpala się
    // samo. Zestaw bez wyzwalaczy to zestaw do klikania ręcznego i to jest realna różnica, a nie
    // szczegół. Pusty ma pigułkę „pusty" — pusty preset to rzecz, którą się kasuje.
    if (!it.acts) c.push({t: _gl("pusty", "empty"), cls: "bad"});
    else c.push({t: it.acts + " " + _gl("akcji", "actions")});
    if (it.trigs) c.push({t: it.trigs + " " + _gl("z wyzwalaczem", "with a trigger")});
  } else if (_rflKind === "wheel") {
    // Ile wycinków RAZEM z podmenu (bo to one decydują, czy w koło da się celować) i jak się
    // wybiera — te dwa fakty odróżniają koło do gry od koła pod głowę.
    if (it.official) c.push({t: _gl("w aplikacji", "built in"), cls: "own"});
    c.push({t: (it.slices || 0) + " " +
      ((typeof rfPl === "function") ? rfPl(it.slices || 0, "wycinek", "wycinki", "wycinków", "slice", "slices")
        : _gl("wycinków", "slices"))});
    const CONF = {release: ["trzymaj i puść", "hold and release"], dwell: ["pochyl i przytrzymaj", "tilt and hold"],
                  click: ["pochyl i kliknij", "tilt and click"], toggle: ["kliknij, pochyl, kliknij", "click, tilt, click"],
                  step: ["przełączaj kliknięciami", "step with clicks"]};
    const cf = CONF[it.confirm];
    if (cf) c.push({t: _gl(cf[0], cf[1])});
  } else if (_rflKind === "synth") {
    c.push({t: (it.pads || 0) + " " +
      ((typeof rfPl === "function") ? rfPl(it.pads || 0, "pad", "pady", "padów", "pad", "pads")
        : _gl("padów", "pads"))});
    // WŁASNE BRZMIENIA mówią wprost, że w tej scenie są NAGRANIA autora — jedyny fakt, który
    // trzeba znać, zanim scena pójdzie do kogoś innego.
    if (it.customSounds) c.push({t: it.customSounds + " " + _gl("własnych brzmień", "custom sounds")});
    if (it.fxPads) c.push({t: it.fxPads + " " + _gl("efektów", "effect pads")});
  } else if (_rflKind === "overlay") {
    c.push({t: (it.windows || 0) + " " +
      ((typeof rfPl === "function") ? rfPl(it.windows || 0, "okno", "okna", "okien", "window", "windows")
        : _gl("okien", "windows"))});
  }
  const d = _rflDate(it.mtime);
  if (d) c.push({t: d, cls: "dim"});
  const s = _rflSize(it.size);
  if (s) c.push({t: s, cls: "dim"});
  // Which build wrote the file. Absent on anything saved before versions were stamped, and the
  // chip is simply absent too — inventing "1.0.0" for a file that never said so would be a guess.
  if (it.appVersion) c.push({t: "RibbitFlip " + it.appVersion, cls: "dim"});
  return c;
}

// ---- wiersz listy (etap 3) ---------------------------------------------------------------------
// Wiersz WYBIERA, nie działa. Wczytanie, pobranie i usunięcie stoją w panelu opisu po prawej, bo
// dopiero tam widać, CO się wczytuje: kto to nosi i co ustawia. Komplet przycisków na każdym kaflu
// znaczył, że decyzję podejmowało się z samej nazwy — a to jest dokładnie ta wada, przez którą
// listy rozwijane w zakładkach zostały kiedyś zastąpione tą biblioteką.
//
// `div[role=option]`, nie `<button>`: w środku stoją chipy kapsli, a przycisk w przycisku to
// nieprawidłowy HTML, w którym klik potrafi trafić w rodzica.
function _rflListRow(kind, it) {
  const row = document.createElement("div");
  row.className = "lib-row" + (it.broken ? " broken" : "");
  row.setAttribute("role", "option");
  row.dataset.kind = kind; row.dataset.name = it.name;
  const on = !!(_rflSel && _rflSel.kind === kind && _rflSel.name === it.name);
  row.classList.toggle("sel", on);
  row.setAttribute("aria-selected", on ? "true" : "false");
  row.tabIndex = on ? 0 : -1;
  /* MINIATURA PRESETU SKANERA (16.09) — zrzut ekranu, na którym ustawiano skanery, w miejscu
     ikony modułu. Wymaganie: „daj możliwość dodania miniatury jeśli użytkownik używał
     screenów". Obraz idzie osobną trasą (`/library/cover`), więc indeks Biblioteki zostaje lekki,
     a przeglądarka zapamiętuje obrazek jak każdy inny. Ikona modułu wraca, gdy miniatury nie ma
     albo gdy plik nie chce się wczytać — wiersz nigdy nie zostaje bez znaku rozpoznawczego. */
  /* 02.10: obrazek dostaje też preset BEZ miniatury, gdy jego plansza ma zrzut na tym komputerze,
     i ZESTAW, który niesie skaner — `rfScanOkladka` (rf-39i4) wybiera źródło. */
  /* 22.11: ZESTAW TO KASETA. Każdy zestaw (także paczka na kilka kapsli) pokazuje kasetę, którą
     autor wybrał przy zapisie (`it.cassette`, plik bez pola = kaseta 1, rf-28e). Miniatura planszy
     skanera ustąpiła jej miejsca na liście: kaseta jest tym, po czym zestaw poznaje się wszędzie
     (lista, podgląd, okno importu, wczytanie), a plansze skanera dalej pokazuje panel opisu. */
  let oklSrc = "";
  if (kind === "setup" && typeof rfKasetaMini === "function") {
    row.appendChild(rfKasetaMini(it));
  } else if (typeof rfScanOkladka === "function") {
    if (kind === "scan") oklSrc = rfScanOkladka(kind, it.name, it, null);
    else if (kind === "setup" && Array.isArray(it.scan)) {
      for (const c of it.scan) { oklSrc = rfScanOkladka(kind, it.name, null, c); if (oklSrc) break; }
    }
  } else if (it.cover) {
    oklSrc = "/library/cover?kind=" + encodeURIComponent(kind) + "&name=" + encodeURIComponent(it.name);
  }
  if (kind === "setup" && typeof rfKasetaMini === "function") { /* kaseta już stoi */ }
  else if (oklSrc) {
    const okl = document.createElement("img");
    okl.className = "lib-cover";
    okl.alt = "";
    okl.loading = "lazy";
    okl.src = oklSrc;
    okl.addEventListener("error", function () {
      if (okl.parentNode) okl.parentNode.replaceChild(_rflModIcon(kind), okl);
    });
    row.appendChild(okl);
  } else row.appendChild(_rflModIcon(kind));
  const w = document.createElement("span"); w.className = "lib-w";

  const t = document.createElement("div"); t.className = "lib-top";
  const nm = document.createElement("span"); nm.className = "lib-name";
  nm.textContent = it.name;
  nm.setAttribute("data-noi18n", "");     // nazwa pliku to podpis człowieka, nie etykieta interfejsu
  t.appendChild(nm);
  // PLAKIETKA MODUŁU — bez niej lista wszystkich rodzajów naraz nie mówi, gdzie się tę pozycję
  // edytuje, a dwie konfiguracje o tej samej nazwie w dwóch modułach wyglądają na jedną.
  const tag = document.createElement("span"); tag.className = "lib-modtag";
  tag.textContent = _rflModLabel(kind);
  t.appendChild(tag);
  if (kind === "setup" && it.forApp) {
    const f = document.createElement("span"); f.className = "lib-for";
    // Pole „dla” zestawu UŻYTKOWNIKA to jego własny wpis — nie tłumaczymy. Zestawy dostarczane
    // z aplikacją (Presets/, `official`) mają pary w rf-01-i18n (przy opisach presetów), więc
    // dla nich blokada zostaje zdjęta; sama NAZWA pliku pozostaje nietłumaczona w obu wypadkach.
    if (!it.official) f.setAttribute("data-noi18n", "");
    f.textContent = it.forApp;
    t.appendChild(f);
  }
  // Which game pulls this set in by itself. A badge rather than a line of text, and next to the
  // "for" one, because the two answer neighbouring questions — "what is this for" and "when does
  // it happen on its own" — and the second is the one nothing on the tile could say before.
  if (kind === "setup" && Array.isArray(it.exe) && it.exe.length) {
    const e = document.createElement("span"); e.className = "lib-exe";
    e.setAttribute("data-noi18n", "");        // nazwy plików gier są nazwami, nie tekstem do tłumaczenia
    e.textContent = "🎮 " + it.exe.join(" · ");
    e.title = _gl("Wczytam ten zestaw sam, gdy ta gra znajdzie się na wierzchu",
                  "I load this set by myself when that game comes to the front");
    t.appendChild(e);
  }
  // SKANER: ile skanerów i plansz — poradnik od 20.09 obiecywał, że wiersz to mówi, a nie mówił
  // (chipy ustępują tu chipom kapsli). Pigułka obok plakietki modułu, więc stoi zawsze (02.10).
  if (kind === "scan" && typeof rfScanFakty === "function") {
    const f = document.createElement("span"); f.className = "lib-for";
    f.textContent = rfScanFakty({ sekcje: new Array(it.sekcje || 0), zrzuty: new Array(it.ekrany || 0) });
    t.appendChild(f);
  }
  w.appendChild(t);

  // PO CO TA POZYCJA JEST — jedno miejsce w wierszu, niezależnie od rodzaju pliku. Zestaw nosi to
  // zdanie w polu `description`, konfiguracja wyzwalaczy w `desc` (kopercie presetu nadał je hub,
  // rf-49i). Pytanie jest to samo, więc odpowiedź stoi w tym samym miejscu i wygląda tak samo —
  // inaczej opis konfiguracji byłby widoczny wyłącznie na kaflu, a Biblioteka pokazywałaby same nazwy.
  const _desc = it.description || it.desc;
  if (_desc) {
    const d = document.createElement("div"); d.className = "lib-desc";
    // zdanie autora pliku, nie etykieta interfejsu — chyba że autorem jest aplikacja (Presets/,
    // `official`): te opisy mają pary w rf-01-i18n (klucz = prefiks ucięty przez serwer do 200 znaków).
    if (!it.official) d.setAttribute("data-noi18n", "");
    d.textContent = _desc;
    d.title = _desc;
    w.appendChild(d);
  }

  // KTO TO NOSI — chipy kapsli przy presetach, jak w liście modułu. Zestaw ich nie ma: nie jest
  // konfiguracją JEDNEGO kapsla, tylko migawką całej aplikacji, więc zamiast chipów niesie fakty
  // o pliku (dla kogo, wersja, autor, kiedy).
  const car = _rflCarriers(kind, it.name);
  if (car) w.appendChild(car);
  else {
    const chips = document.createElement("div"); chips.className = "lib-chips";
    _rflChips(kind, it).slice(0, 4).forEach(function (c) {
      const s = document.createElement("span");
      s.className = "lib-chip" + (c.cls ? " " + c.cls : "");
      s.setAttribute("data-noi18n", "");
      s.textContent = c.t;
      chips.appendChild(s);
    });
    w.appendChild(chips);
  }
  row.appendChild(w);

  row.addEventListener("click", function (e) {
    if (e.target && e.target.closest && e.target.closest("button,select")) return;
    rfLibSelect(kind, it.name);
  });
  row.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target !== row) return;
    e.preventDefault(); rfLibSelect(kind, it.name);
  });
  return row;
}

// Chipy kapsli noszących tę konfigurację — liczone TYM SAMYM `rfCfgIdCarriers`, którym liczy je
// lista w module. Bez adaptera (moduł nie doszedł) albo dla zestawu wracamy `null`, a wiersz
// pokazuje wtedy fakty o pliku: milczenie jest tu uczciwsze niż „nie nosi go żaden kapsel"
// powiedziane o czymś, o co nie było kogo zapytać.
function _rflCarriers(kind, name) {
  const A = _rflAdapter(kind);
  if (!A || typeof rfCfgIdCarriers !== "function") return null;
  let who = [];
  try { who = rfCfgIdCarriers(A, name) || []; } catch (e) { return null; }
  const box = document.createElement("div"); box.className = "lib-car";
  if (!who.length) {
    const s = document.createElement("span"); s.className = "lib-cchip none";
    s.textContent = _gl("nie nosi go żaden kapsel", "no capsule carries it");
    box.appendChild(s);
    return box;
  }
  const cur = (typeof A.getDev === "function") ? A.getDev() : "";
  const perDev = typeof A.fingerprintOf === "function";
  who.forEach(function (d) {
    const s = document.createElement("span"); s.className = "lib-cchip";
    const bead = document.createElement("span"); bead.className = "lib-bead";
    let col = "";
    try { col = _cfhDevColor(A, d) || ""; } catch (e) { }
    if (col) bead.style.background = col;
    s.appendChild(bead);
    const b = document.createElement("b");
    b.setAttribute("data-noi18n", "");
    b.textContent = (typeof A.devName === "function") ? A.devName(d) : d;
    s.appendChild(b);
    let dirty = false;
    try { dirty = !!((d === cur || perDev) ? rfCfgIdState(A, d).dirty : false); } catch (e) { }
    if (dirty) {
      const dot = document.createElement("span"); dot.className = "lib-dd";
      dot.title = _gl("zmienione na tym kapslu", "changed on this capsule");
      dot.setAttribute("role", "img");
      dot.setAttribute("aria-label", b.textContent + ": " + dot.title);
      s.appendChild(dot);
    }
    box.appendChild(s);
  });
  return box;
}

// An empty drawer used to end the conversation: it named the tab where you could build one
// yourself and stopped there. Building from zero is the LONG road — the short one is somebody
// else's finished file — so the empty state says that out loud and puts both doors to it right
// where the disappointment happens.
const _RFL_EMPTY_FORUM = {
  setup: ["Nie musisz zaczynać od zera: na forum #zestawy leżą gotowe zestawy innych.",
          "You do not have to start from scratch: ready-made setups from other people sit on the #zestawy forum."],
  profile: ["Gotowe presety znajdziesz na forum pod tagiem ⌨️ Mapowanie.",
            "Ready-made presets are on the forum under the ⌨️ Mapowanie tag."],
  pose: ["Gotowe strojenia znajdziesz na forum w wątkach „Preset osi 3D”.",
         "Ready-made tunings are on the forum in the “Preset osi 3D” threads."]
  // BEZ wpisu dla „mouse" ani „midi": ta wersja nie umie jeszcze wczytać CUDZEGO profilu myszy
  // ani cudzego zestawu mapowań z pliku (rozpoznawanie plików w rf-29 rozpoznaje oba, ale tylko
  // po to, żeby powiedzieć, gdzie należą), więc wysłanie kogoś po plik na forum byłoby obietnicą
  // bez pokrycia. Pusta szuflada mówi wtedy samo „zapisz swój".
};
// Which route the one import window opens on. Its own names are older than the library's.
// Rodzaj bez wpisu = brak drzwi dla cudzego pliku, więc przycisk „Wczytaj plik lub odnośnik" się nie
// pojawia (patrz _rflEmpty) — zamiast prowadzić w miejsce, które tego rodzaju nie przyjmie.
const _RFL_LINK_KIND = {setup: "setup", profile: "trig", pose: "axis"};

function _rflEmpty() {
  // A filtered list that matched nothing is NOT an empty drawer: there is something here, it just
  // does not match what was typed. Sending that person to the forum would be answering a question
  // they did not ask.
  if (_rflFilter) {
    const e = document.createElement("p"); e.className = "lib-empty";
    e.textContent = _gl("Nic nie pasuje do tego, czego szukasz.", "Nothing matches what you are looking for.");
    return e;
  }
  const box = document.createElement("div"); box.className = "lib-empty";
  const mine = document.createElement("p"); mine.className = "lib-empty-t";
  if (_rflKind === "setup") {
    mine.textContent = "Nie masz jeszcze zapisanego zestawu. Ustaw moduły pod jedną grę, a potem zapisz je pod własną nazwą w pasku pod listą.";
  } else if (_rflKind === "profile") {
    mine.textContent = "Nie masz zapisanych wyzwalaczy. Zapiszesz je na ekranie Mapowanie, gdy ułożysz zestaw reguł.";
  } else if (_rflKind === "mouse") {
    mine.textContent = "Nie masz zapisanych profili myszy. Zapiszesz je na ekranie Mysz, na pasku „Konfiguracja” pod nagłówkiem, przyciskiem „Zapisz jako…”.";
  } else if (_rflKind === "midi") {
    mine.textContent = "Nie masz zapisanych zestawów mapowań. Zapiszesz je na ekranie MIDI albo OSC (to ten sam zestaw), na pasku „Konfiguracja” pod nagłówkiem, przyciskiem „Zapisz jako…”.";
  } else {
    mine.textContent = "Nie masz zapisanych ustawień osi. Zapiszesz je na ekranie Czujnik, po skalibrowaniu kapsla.";
  }
  box.appendChild(mine);

  // Druga połowa — cudze pliki — tylko dla rodzajów, które ta wersja umie przyjąć z zewnątrz.
  // Bez tego szuflada profili myszy wysyłałaby po plik, którego nie ma jak wczytać.
  const f = _RFL_EMPTY_FORUM[_rflKind];
  const link = _RFL_LINK_KIND[_rflKind];
  if (f && link) {
    const theirs = document.createElement("p"); theirs.className = "lib-empty-t";
    theirs.textContent = _gl(f[0], f[1]);

    const acts = document.createElement("div"); acts.className = "lib-empty-acts";
    const go = document.createElement("a"); go.className = "btn sm";
    go.href = RF_FORUM_URL; go.target = "_blank"; go.rel = "noopener noreferrer";
    go.textContent = _gl("Przeglądaj forum ↗", "Browse the forum ↗");
    const take = document.createElement("button");
    take.type = "button"; take.className = "btn sm primary";
    take.textContent = _gl("Wczytaj plik lub odnośnik", "Load a file or link");
    take.addEventListener("click", function () {
      if (typeof rfLinkOpen === "function") rfLinkOpen({kind: link});
    });
    acts.appendChild(go); acts.appendChild(take);
    box.appendChild(theirs); box.appendChild(acts);
  }
  return box;
}

// Czy ta pozycja pasuje do wpisanej frazy. Szukamy też po pliku gry: kto pyta „który zestaw wczyta
// się przy eldenring.exe", pyta dokładnie o to pole, a bez tego wyszukiwarka odpowiadałaby „nie ma
// takiego".
function _rflMatch(it, q) {
  if (!q) return true;
  return (it.name + " " + (it.forApp || "") + " " + (it.description || "") + " " + (it.desc || "") +
          " " + (it.author || "") + " " + ((it.exe || []).join(" ")))
    .toLowerCase().indexOf(q) >= 0;
}
function _rflSection(host, txt) {
  const s = document.createElement("div"); s.className = "lib-sec"; s.textContent = txt;
  host.appendChild(s);
}

// LISTA WSZYSTKICH RODZAJÓW NARAZ (etap 3). Do tej pory widać było jedną szufladę i trzeba było
// wiedzieć, w której leży to, czego się szuka — a nazwa pliku jest tym, co człowiek pamięta,
// nie jego rodzaj. Zestawy idą pierwsze i osobną sekcją, bo to jedyna rzecz, która wchodzi na
// kilka modułów naraz; reszta to presety pojedynczych modułów.
function rfLibRender() {
  const host = document.getElementById("libList");
  if (!host) return;
  host.textContent = "";
  if (!_rflData) {
    const p = document.createElement("p"); p.className = "lib-empty";
    p.textContent = "Wczytuję bibliotekę…";
    host.appendChild(p);
    return;
  }
  const q = _rflFilter.toLowerCase();
  const sets = (_rflPick && _rflPick !== "setup") ? []
    : (_rflData.setup || []).filter(function (it) { return _rflMatch(it, q); });
  const mods = [];
  RFL_KINDS.forEach(function (x) {
    if (x.k === "setup") return;
    if (_rflPick && _rflPick !== x.k) return;
    (_rflData[x.k] || []).forEach(function (it) {
      if (_rflMatch(it, q)) mods.push({ kind: x.k, it: it });
    });
  });
  if (sets.length) {
    _rflSection(host, _gl("Zestawy, czyli kilka modułów naraz", "Setups, several modules at once"));
    sets.forEach(function (it) { host.appendChild(_rflListRow("setup", it)); });
  }
  if (mods.length) {
    _rflSection(host, _gl("Presety modułów", "Module presets") + " (" + mods.length + ")");
    mods.forEach(function (m) { host.appendChild(_rflListRow(m.kind, m.it)); });
  }
  if (!sets.length && !mods.length) host.appendChild(_rflEmpty());
  try { if (typeof applyLang === "function") applyLang(host); } catch (e) {}
  if (typeof rfLibDetailRender === "function") rfLibDetailRender();
}

// WYBÓR POZYCJI — jedyne, co robi klik w wiersz. Opis rysuje się obok, na miejscu: klik w
// Bibliotece niczego nie wczytuje i nigdzie nie wyrzuca.
function rfLibSelect(kind, name, quiet) {
  _rflSel = (kind && name) ? { kind: String(kind), name: String(name) } : null;
  const host = document.getElementById("libList");
  if (host) {
    host.querySelectorAll(".lib-row").forEach(function (r) {
      const on = !!(_rflSel && r.dataset.kind === _rflSel.kind && r.dataset.name === _rflSel.name);
      r.classList.toggle("sel", on);
      r.setAttribute("aria-selected", on ? "true" : "false");
      r.tabIndex = on ? 0 : -1;
      if (on) { try { if (!quiet) r.focus({preventScroll: true}); r.scrollIntoView({block: "nearest"}); } catch (e) {} }
    });
  }
  if (typeof rfLibDetailRender === "function") rfLibDetailRender();
}
