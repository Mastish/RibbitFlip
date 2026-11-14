"use strict";
// ============== "WILL THIS WORK ON MY MACHINE?" — needs vs. what is installed ==============
// Parts of a setup only do something with software that is NOT in this app: the Xbox pad needs
// the ViGEmBus driver, a virtual MIDI port for a DAW needs loopMIDI. The server answers with
// facts (`{key, have, detail}` from /setup/analyze); the wording lives here, because it has to
// exist in both languages and read differently in two places:
//   • at import — diagnosis, in the second person: what is missing HERE and what to install,
//   • in a forum post — a plain list of what the setup NEEDS, because the reader's machine is
//     a different machine and its state is none of our business.
// `have: null` means "cannot tell" and is said as exactly that. Guessing here would be worse
// than silence: someone would install a driver they never needed.

const RF_REQ_LINKS = {
  pad: "https://github.com/nefarius/ViGEmBus/releases",
  midi: "https://www.tobias-erichsen.de/software/loopmidi.html"
};

// Short name of the dependency itself — the same words in the diagnosis and in the post.
function rfReqName(key) {
  // One driver, both pads: ViGEmBus is what a set needs whether the controller is an Xbox 360 or
  // a DualShock 4, so the requirement is named after the thing that is missing, not after a type.
  if (key === "pad") return _gl("Wirtualny pad: sterownik ViGEmBus", "Virtual pad: ViGEmBus driver");
  if (key === "midi") return _gl("Port MIDI OUT (np. loopMIDI)", "A MIDI OUT port (e.g. loopMIDI)");
  if (key === "osc") return _gl("Odbiornik OSC w sieci", "An OSC receiver on the network");
  if (key === "notify") return _gl("Powiadomienia Windows", "Windows notifications");
  if (key === "screenpoint") return _gl("Klik w konkretnym punkcie ekranu", "A click at a fixed point of the screen");
  return key;
}

// One diagnosis row: state ∈ ok | todo | missing | unknown.
function _rfReqRow(r) {
  const d = r.detail || {};
  if (r.key === "pad") {
    if (r.have === true) {
      return {state: "ok", title: rfReqName("pad"),
              why: d.active ? _gl("wirtualny kontroler już działa", "the virtual controller is already running")
                            : _gl("sterownik jest zainstalowany", "the driver is installed")};
    }
    if (!d.module) {
      return {state: "missing", title: rfReqName("pad"),
              why: _gl("brak modułu vgamepad. W wersji uruchamianej ze źródeł doinstaluj go: pip install vgamepad",
                       "the vgamepad module is missing. When running from source, install it: pip install vgamepad"),
              url: RF_REQ_LINKS.pad};
    }
    if (r.have === false) {
      return {state: "missing", title: rfReqName("pad"),
              why: _gl("nie znalazłem sterownika ViGEmBus. Bez niego gałka zostaje podglądem na ekranie, krzyżak zadziała przez klawiaturę, a przyciski kontrolera w mapowaniach nie polecą nigdzie.",
                       "I cannot find the ViGEmBus driver. Without it the analog stick stays an on-screen preview, the d-pad falls back to the keyboard, and controller buttons in mappings go nowhere."),
              url: RF_REQ_LINKS.pad};
    }
    return {state: "unknown", title: rfReqName("pad"),
            why: _gl("nie umiem sprawdzić sterownika na tym systemie, okaże się przy pierwszym użyciu gałki",
                     "I cannot check the driver on this system; the first use of the stick will tell"),
            url: RF_REQ_LINKS.pad};
  }
  if (r.key === "midi") {
    if (r.have === true) {
      return {state: "ok", title: rfReqName("midi"),
              why: d.portName ? _gl("otwarty port: ", "port open: ") + d.portName
                              : _gl("port jest otwarty", "a port is open")};
    }
    if (d.chooseport) {
      return {state: "todo", title: rfReqName("midi"),
              why: _gl("porty MIDI są, ale żaden nie jest wybrany. Wskaż go na ekranie MIDI",
                       "there are MIDI ports, but none is selected. Pick one on the MIDI screen")};
    }
    return {state: "missing", title: rfReqName("midi"),
            why: _gl("nie ma ani jednego portu MIDI OUT. Wirtualny port do programu muzycznego tworzy loopMIDI.",
                     "there is no MIDI OUT port at all. loopMIDI creates a virtual one for your music software."),
            url: RF_REQ_LINKS.midi};
  }
  if (r.key === "osc") {
    const t = (d.host || "127.0.0.1") + ":" + (d.port != null ? d.port : 9000);
    return {state: "unknown", title: rfReqName("osc"),
            why: _gl("nic nie trzeba instalować, pakiety polecą na ", "nothing to install; packets will go to ") + t +
                 _gl(". Sprawdź tylko, czy coś tam nasłuchuje.", ". Just make sure something is listening there.")};
  }
  if (r.key === "notify") {
    if (r.have) return {state: "ok", title: rfReqName("notify"), why: _gl("działają", "working")};
    return {state: "missing", title: rfReqName("notify"),
            why: (d.reason === "no-tray")
              ? _gl("aplikacja działa bez ikony w zasobniku, więc nie ma na czym powiesić dymka",
                    "the app is running without a tray icon, so there is nothing to hang a balloon on")
              : _gl("Windows odrzucił ostatnie powiadomienie", "Windows refused the last notification")};
  }
  // Nothing to install here — what it needs is a screen laid out like the author's, which is the
  // one thing we cannot check: the set carries coordinates, not the desktop they were measured on.
  // So this row exists to make the aiming VISIBLE before the set is armed, not to diagnose it.
  if (r.key === "screenpoint") {
    const px = d.px || 0, pct = d.pct || 0;
    const mine = (d.sw && d.sh) ? (d.sw + "×" + d.sh) : _gl("nieznany", "unknown");
    if (!px) {
      return {state: "ok", title: rfReqName("screenpoint"),
              why: _gl("punkty podane w procentach pulpitu (" + pct + "), więc trafią tam samo na każdym ekranie",
                       "the points are given in percentages of the desktop (" + pct + ") — they land in the same place on any screen")};
    }
    // Polish counts: 1 miejsce podane, 2–4 miejsca podane, 5+ miejsc podanych (12–14 take the last form).
    const t = px % 10, h = px % 100;
    const ile = (px === 1) ? "miejsce podane"
      : ((t >= 2 && t <= 4 && !(h >= 12 && h <= 14)) ? "miejsca podane" : "miejsc podanych");
    return {state: "unknown", title: rfReqName("screenpoint"),
            why: _gl("zestaw klika w " + px + " " + ile + " w pikselach" + (pct ? (" (oraz " + pct + " w procentach)") : "") +
                     ". Współrzędne zmierzono na ekranie autora, Twój pulpit ma " + mine +
                     ". Sprawdź te punkty, zanim uzbroisz.",
                     "the set clicks " + (px === 1 ? "one place" : (px + " places")) + " given in pixels" +
                     (pct ? (" (plus " + pct + " in percentages)") : "") +
                     ". Those coordinates were measured on the author's screen; your desktop is " + mine +
                     " — check the points before arming.")};
  }
  return {state: "unknown", title: rfReqName(r.key), why: ""};
}

const _RF_REQ_IC = {ok: "✅", todo: "🔧", missing: "⚠️", unknown: "❔"};

// Markup for the import preview. Returns "" when the set needs nothing from outside —
// an empty "everything fine" box would be one more thing to read for no reason.
function rfRequiresHtml(requires) {
  const list = Array.isArray(requires) ? requires : [];
  if (!list.length) return "";
  const rows = list.map(function (r) {
    const x = _rfReqRow(r);
    const link = x.url
      ? '<a class="rq-link" href="' + x.url + '" target="_blank" rel="noopener noreferrer">' +
        miEsc(_gl("skąd wziąć ↗", "where to get it ↗")) + "</a>"
      : "";
    return '<div class="rq-row ' + x.state + '"><span class="rq-ic" aria-hidden="true">' + _RF_REQ_IC[x.state] +
      '</span><div class="rq-mid"><div class="rq-t">' + miEsc(x.title) + "</div>" +
      '<div class="rq-w">' + miEsc(x.why) + " " + link + "</div></div></div>";
  }).join("");
  const bad = list.some(function (r) { return r.have === false; });
  const head = bad
    ? _gl("Czego ten zestaw potrzebuje i czego u Ciebie brakuje",
          "What this setup needs, and what is missing here")
    : _gl("Czego ten zestaw potrzebuje poza aplikacją", "What this setup needs beyond the app");
  return '<div class="rq-box' + (bad ? " rq-bad" : "") + '"><div class="rq-head">' + miEsc(head) +
    "</div>" + rows + "</div>";
}

// "This file knows more than I do." Shown only when it is true, and it says exactly what will be
// skipped — because the alternative is somebody wondering for a week why the setup behaves
// differently than in the clip they saw. A file from an OLDER app never needs this: every group is
// applied through a sanitizer that fills in defaults, so nothing is lost going forward.
function rfCompatHtml(c) {
  if (!c) return "";
  const groups = (c.unknownGroups || []).length;
  if (!c.newer && !groups) return "";
  const L = [];
  if (c.newer) {
    L.push(_gl("Ten plik zapisała nowsza wersja RibbitFlipa", "This file was written by a newer RibbitFlip") +
      (c.appVersion ? " (" + c.appVersion + ")" : "") +
      _gl(". Twoja zna format ", ". Yours reads format ") + c.myFormat +
      _gl(", plik jest w formacie ", ", the file is format ") + c.format + ".");
  }
  if (groups) {
    L.push(_gl("Pominę sekcje, których nie znam: ", "I will skip the sections I do not know: ") +
      c.unknownGroups.join(", ") + ".");
  }
  L.push(_gl("Reszta wczyta się normalnie. Jeśli zestaw ma działać w całości, zaktualizuj aplikację.",
             "The rest loads normally. Update the app if you want the whole setup to work."));
  return '<div class="rq-box rq-compat"><div class="rq-head">' +
    miEsc(_gl("Wersja pliku", "File version")) + '</div><div class="rq-row unknown">' +
    '<span class="rq-ic" aria-hidden="true">📦</span><div class="rq-mid"><div class="rq-w">' +
    miEsc(L.join(" ")) + "</div></div></div></div>";
}

// ============== CZĘŚCI ZESTAWU DLA MODUŁÓW WYŁĄCZONYCH PRZY STARCIE (--disable / --only) ==============
// Serwer liczy je w `setup_modules_off` (pole `modulesOff` w analizie i w odpowiedzi po wczytaniu).
// Zestaw wczytuje się w całości, także te części: zapiszą się i wrócą do pracy po restarcie bez
// parametru. Ale TERAZ nie zadziałają, a ktoś, kto wczytał zestaw pod pada przy wyłączonym
// Kontrolerze, inaczej szukałby przez wieczór, czemu przyciski milczą. Stąd jedno pudełko przed
// wczytaniem i jedno zdanie w dymku po nim.
// Parts of a setup that belong to modules switched off at start: saved, but idle until a restart.
function _rfModsOffPart(p) {
  const n = +p.n || 0;
  const pl = (typeof rfPl === "function") ? rfPl : function (k, f1, f2, f5, e1, e2) { return (typeof _lang !== "undefined" && _lang === "en") ? (k === 1 ? e1 : e2) : (k === 1 ? f1 : f5); };
  if (p.key === "padRules") return n + " " + pl(n, "reguła z przyciskiem pada", "reguły z przyciskami pada", "reguł z przyciskami pada", "rule with pad buttons", "rules with pad buttons");
  if (p.key === "scanRules") return n + " " + pl(n, "reguła z sygnałem skanera", "reguły z sygnałami skanera", "reguł z sygnałami skanera", "rule with scanner signals", "rules with scanner signals");
  if (p.key === "motion") {
    if (p.mode === "stick") return _gl("sterowanie ruchem: gałka pada", "motion control: pad stick");
    if (p.mode === "dpad") return _gl("sterowanie ruchem: krzyżak", "motion control: d-pad");
    return _gl("sterowanie ruchem: kursor myszy", "motion control: mouse cursor");
  }
  if (p.key === "midi") return _gl("wyjście MIDI", "MIDI output");
  if (p.key === "osc") return _gl("wyjście OSC", "OSC output");
  if (p.key === "scan") return _gl("ustawienia skanera i jego sekcje", "scanner settings and its sections");
  return String(p.key || "");
}
function _rfModsOffName(m) {
  return _gl(m.name || m.module, m.nameEn || m.name || m.module);
}
function rfModsOffSetupHtml(list) {
  const L = Array.isArray(list) ? list : [];
  if (!L.length) return "";
  const rows = L.map(function (m) {
    return '<div class="rq-row todo"><span class="rq-ic" aria-hidden="true">⏸</span><div class="rq-mid">' +
      '<div class="rq-t">' + miEsc(_rfModsOffName(m)) + '</div><div class="rq-w">' +
      miEsc((m.parts || []).map(_rfModsOffPart).join(", ")) + "</div></div></div>";
  }).join("");
  return '<div class="rq-box rq-modsoff" data-noi18n><div class="rq-head">' +
    miEsc(_gl("Części zestawu dla modułów wyłączonych przy starcie", "Parts of this setup for modules switched off at start")) +
    "</div>" + rows + '<div class="rq-row unknown"><div class="rq-mid"><div class="rq-w">' +
    miEsc(_gl("Wczytają się i zapiszą razem z zestawem, ale nie zadziałają, dopóki nie uruchomisz aplikacji bez parametru --disable / --only.",
              "They load and are saved with the setup, but will not work until you start the app without --disable / --only.")) +
    "</div></div></div></div>";
}
// Jedno zdanie do dymka po wczytaniu (rf-29). "" = nic nie koliduje.
function rfModsOffSetupText(list) {
  const L = Array.isArray(list) ? list : [];
  if (!L.length) return "";
  const what = L.map(function (m) {
    return _rfModsOffName(m) + " (" + (m.parts || []).map(_rfModsOffPart).join(", ") + ")";
  }).join("; ");
  return _gl("Zapisane, ale nie zadziała do restartu bez parametru --disable / --only: ",
             "Saved, but idle until you restart the app without --disable / --only: ") + what + ".";
}

// Plain "Wymaga: …" line for a forum post — names only, no local state.
function rfRequiresNames(requires) {
  const list = Array.isArray(requires) ? requires : [];
  return list.filter(function (r) { return r.key !== "notify"; })   // a balloon is not a dependency
             .map(function (r) { return rfReqName(r.key); });
}

// ============== „BRAKUJE CZEGOŚ SPOZA APLIKACJI" — jeden wyraźny komunikat na wszystkie ekrany ==============
// Komunikat o sterowniku do doinstalowania musi być wyraźnie wyróżniony, żeby użytkownik
// wiedział i rozumiał. Wcześniej każdy ekran mówił o tym po swojemu: szara
// podpowiedź z ℹ na MIDI, wiersz drobnego tekstu na Kontrolerze, przypis w stopce Myszy. Brak
// loopMIDI albo ViGEmBus wyglądał więc jak jeszcze jedna uwaga do pominięcia. Jeden wzór dla
// wszystkich: tytuł mówi, CZEGO brakuje, zdanie niżej, CO bez tego nie działa, a przyciski, co
// z tym zrobić teraz („Pobierz", „Sprawdź ponownie"). Ton: `need` (bursztyn, trzeba coś doinstalować
// albo uruchomić) i `block` (czerwień, moduł jest włączony i przez to nic nie wychodzi).
// One loud, consistent box for "something outside the app is missing": what, what breaks, what to do.
// The caller passes HTML for title/why/fix (static or already escaped) and sets the class on the host:
//   host.className = "rf-need " + tone; host.innerHTML = rfNeedHtml({...});
function rfNeedHtml(o) {
  const acts = [];
  if (o.url) {
    acts.push('<a class="btn sm primary rf-need-get" href="' + o.url + '" target="_blank" rel="noopener noreferrer">' +
      miEsc(o.urlLabel || _gl("Pobierz ↗", "Download ↗")) + "</a>");
  }
  if (o.recheck) {
    acts.push('<button type="button" class="btn sm" data-rf-need-recheck="' + o.recheck + '">' +
      miEsc(_gl("🔄 Sprawdź ponownie", "🔄 Check again")) + "</button>");
  }
  return '<div class="rf-need-ic" aria-hidden="true">!</div><div class="rf-need-body">' +
    '<div class="rf-need-t">' + o.titleHtml + "</div>" +
    (o.whyHtml ? '<div class="rf-need-why">' + o.whyHtml + "</div>" : "") +
    (o.fixHtml ? '<div class="rf-need-fix">' + o.fixHtml + "</div>" : "") +
    (acts.length ? '<div class="rf-need-act">' + acts.join("") + "</div>" : "") + "</div>";
}
// „Sprawdź ponownie" woła funkcję po nazwie (miLoadPorts, mouseFetchState…), bo komunikat żyje
// w kilku modułach, a każdy wie sam, jak dopytać serwer o swój stan.
document.addEventListener("click", function (e) {
  const b = e.target && e.target.closest && e.target.closest("[data-rf-need-recheck]");
  if (!b) return;
  const fn = window[b.getAttribute("data-rf-need-recheck")];
  if (typeof fn === "function") { try { fn(); } catch (err) {} }
});

// ============== DŁUGIE WSTĘPY KART — dwie linijki i „Pokaż więcej" ==============
// Przegląd UX 2026-10-15 („spójrz okiem użytkownika, który pierwszy raz widzi planszę"): kilka kart
// zaczyna się akapitem na pięć linijek (Auto-zestawy, Stop awaryjny, Sejf, MCP), który stoi MIĘDZY
// nagłówkiem a jedynym przełącznikiem karty. Ktoś, kto przyszedł coś włączyć, musi go przeczytać,
// żeby dojść do przełącznika. Treść zostaje co do znaku (te węzły mają pary EN w słownikach), tylko
// długi wstęp jest zwinięty do dwóch linijek z przyciskiem. Etykieta przycisku idzie z CSS według
// `html[lang]`, więc przełączenie języka jej nie zamraża.
// Long card intros (.ra-lead) are clamped to two lines with a "show more" toggle; text untouched.
const RF_CLAMP_MIN = 220;   // znaków: krótsze wstępy mieszczą się w dwóch linijkach i tak
function rfClampLeads() {
  document.querySelectorAll(".ra-lead:not(.ra-lead-shared):not([data-rf-clamp])").forEach(function (el) {
    if ((el.textContent || "").trim().length < RF_CLAMP_MIN) return;
    el.setAttribute("data-rf-clamp", "");
    el.classList.add("rf-clamp");
    const b = document.createElement("button");
    b.type = "button"; b.className = "rf-more"; b.setAttribute("aria-expanded", "false");
    b.onclick = function () {
      const open = el.classList.toggle("is-open");
      b.setAttribute("aria-expanded", String(open));
    };
    el.insertAdjacentElement("afterend", b);
  });
}
(function () {
  let t = 0;
  const run = function () { t = 0; try { rfClampLeads(); } catch (e) {} };
  const kick = function () { if (!t) t = setTimeout(run, 250); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", kick); else kick();
  // Karty z takimi wstępami składa JS (innerHTML) w różnych chwilach startu, więc patrzymy na DOM.
  // Zapytanie jest tanie (kilka węzłów, `:not([data-rf-clamp])`) i odpala się najwyżej co 250 ms.
  try { new MutationObserver(kick).observe(document.documentElement, {childList: true, subtree: true}); } catch (e) {}
})();
