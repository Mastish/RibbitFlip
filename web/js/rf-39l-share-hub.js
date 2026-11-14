"use strict";
// ============ THE EXCHANGE DOOR, STANDING WHERE THE THINGS ARE SAVED ============
// Sharing had exactly one entrance in this app: the "Save and share a setup" card. But three other
// kinds of file are saved somewhere else entirely — a trigger preset under the trigger list, a 3D
// axis preset in the Sensor tab, a REST action pack inside its own application card — and from any
// of those, sending one to somebody meant knowing that a card in another tab could do it for you.
//
// This is that entrance, in all three places, from one file: whoever is standing at one of those
// bars wants one of three things, so the window offers three and nothing else:
//   • send THIS one to the forum,
//   • go and see what other people posted,
//   • take one of those posts and have it here.
//
// It PREPARES rather than posts, for the reasons the wizard states (rf-39f): a webhook baked into
// an open-source .exe is extractable in seconds and CANNOT be rotated, and a post sent by a bot
// belongs to nobody. Nothing new leaves the machine from here — every choice below leads to
// machinery that already exists (the post wizard, the browser, the link importer).

// Both addresses belong to rf-39f, which loads before this file — read them from there so there is
// one copy, and fall back to rf-00-core only if that file ever stops loading (the button still works).
function _pdcForum() {
  return (typeof RFS_CHANNEL === "string" && RFS_CHANNEL) || RF_FORUM_URL;
}
function _pdcInvite() {
  return (typeof RFS_INVITE === "string" && RFS_INVITE) || RF_INVITE_SHARE;
}

let _pdcBack = null;
let _pdcPrevFocus = null;
let _pdcOpener = null;      // the button that opened it, so aria-expanded goes back to false

// ---- what each kind knows about itself ---------------------------------------
// `pick`/`empty` are the two things the window has to answer before it can promise anything: WHICH
// file would go out, and what to do when there is none yet. A trigger and an axis preset read their
// own <select>; a pack is whatever application card the button sits in, so it is handed in.
// ZDANIA DLA RODZAJU, KTÓRY WŁASNYCH NIE MA. Pięć rodzajów poniżej ma teksty pisane ręcznie i one
// zostają co do znaku — są lepsze od czegokolwiek, co da się złożyć z szablonu. Ale rodzaj dołożony
// do rejestru ma się w tym oknie POJAWIĆ, a nie czekać, aż ktoś napisze mu dziesięć zdań; inaczej
// wracamy do stanu z 31.08, kiedy presety myszy, MIDI i usług dawało się pobrać i nie dawało wysłać.
// Szablon mówi prawdę o każdym rodzaju, bo składa ją z faktów, które rejestr i tak niesie: nazwy,
// zdania „co to jest" (`explain`) i miejsca, w którym te pliki leżą (`dir`).
function _pdcGeneric(K) {
  const one = K.pl.one, oneEn = K.en.one, many = K.pl.many, manyEn = K.en.many;
  const A = () => (typeof rfKindAdapter === "function") ? rfKindAdapter(K) : null;
  return {
    sel: null, nameField: null,
    // Lista bierze się z ADAPTERA modułu, czyli z tego samego miejsca, z którego rysuje ją
    // zakładka „Biblioteka" tego modułu. Dwa źródła jednej listy rozjechałyby się w tydzień.
    names: function () {
      try { return (A().listPresets() || []).map(p => p && p.name).filter(Boolean); }
      catch (e) { return []; }
    },
    selected: function () {
      try { return String(A().getCfgName() || ""); } catch (e) { return ""; }
    },
    title: [many + " na Discordzie", manyEn + " on Discord"],
    intro: [K.explain[0] + " Na forum #zestawy rodzaj stoi w tytule wątku: „" + one + "”.",
            K.explain[1] + " On the #zestawy forum the kind stands in the thread title: “" + oneEn + "”."],
    share: ["Podziel się tym: " + one, "Share this " + oneEn.toLowerCase()],
    browseSub: ["Otworzy kanał #zestawy w przeglądarce. Szukaj wątków z „" + one + "” w tytule.",
                "Opens the #zestawy channel in your browser. Look for threads with “" + oneEn + "” in the title."],
    load: ["Wczytaj plik lub odnośnik", "Load a file or link"],
    loadSub: ["Plik z dysku albo odnośnik z posta. Zanim cokolwiek się zmieni, pokażę, co ten plik niesie, i odłożę go w bibliotece.",
              "A file from disk or a link from a post. Before anything changes I show what the file carries, and it lands in your library."],
    foot: ["Twoje pozycje leżą w " + (K.dir || "bibliotece") + " obok aplikacji.",
           "Yours live in " + (K.dir || "the library") + " next to the app."],
    noneSaved: ["Najpierw zapisz obecne ustawienia jako preset w zakładce Biblioteka tego modułu.",
                "Save the current settings as a preset first, in this module's Library tab."],
    noneAtAll: ["Ten moduł nie ma jeszcze nic zapisanego.", "This module has nothing saved yet."],
    hasContent: function () { return true; },
    flashSave: ["Najpierw zapisz obecne ustawienia jako preset przyciskiem „+ Zapisz obecne jako…”.",
                "Save the current settings as a preset first with the “+ Save the current one as…” button."],
    flashEmpty: ["Najpierw zapisz obecne ustawienia jako preset przyciskiem „+ Zapisz obecne jako…”.",
                 "Save the current settings as a preset first with the “+ Save the current one as…” button."]
  };
}

const PDC_KINDS = {
  setup: {
    // A setup has no <select> of its own: what travels is the configuration you are looking at
    // right now, named in the field above the button. It is listed first because it is the kind
    // most people mean when they say "send me your settings".
    sel: null, nameField: "setupName",
    title: ["Wymiana z innymi", "Share with others"],
    intro: [RF_KINDS.setup.explain[0] + " Na forum #zestawy to główny rodzaj wątków.",
            RF_KINDS.setup.explain[1] + " On the #zestawy forum it is the main kind of thread."],
    share: ["Podziel się tym zestawem", "Share this setup"],
    browseSub: ["Otworzy kanał #zestawy w przeglądarce. Zestawy to wątki bez przedrostka w tytule: sama nazwa i gra.",
                "Opens the #zestawy channel in your browser. Setups are the threads with no prefix in the title: just a name and a game."],
    load: ["Wczytaj plik lub odnośnik", "Load a file or link"],
    loadSub: ["Plik z dysku albo odnośnik z posta. Podgląd bezpieczeństwa, kopia w Bibliotece i możliwość cofnięcia.",
              "A file from disk or a link from a post. A safety preview, a Library copy and undo."],
    foot: ["Twoje zestawy leżą w katalogu Library/Setups obok aplikacji.",
           "Your setups live in the Library/Setups folder next to the app."],
    // Unreachable in practice (see _pdcNames: a setup always exists), kept so every kind answers
    // the same questions and nothing has to special-case this one.
    noneSaved: ["Zestaw to Twoja bieżąca konfiguracja, zawsze jest co wysłać.",
                "A setup is your current configuration, so there is always something to send."],
    noneAtAll: ["Zestaw to Twoja bieżąca konfiguracja, zawsze jest co wysłać.",
                "A setup is your current configuration, so there is always something to send."],
    hasContent: function () { return true; },
    flashSave: ["Zestaw to Twoja bieżąca konfiguracja, zawsze jest co wysłać.",
                "A setup is your current configuration, so there is always something to send."],
    flashEmpty: ["Zestaw to Twoja bieżąca konfiguracja, zawsze jest co wysłać.",
                 "A setup is your current configuration, so there is always something to send."]
  },
  trig: {
    // ⚠️ ŹRÓDŁEM LISTY JEST TU PAMIĘĆ, NIE POLE NA EKRANIE. Do 2026-08-28 okno wymiany czytało
    // opcje z `#profSelect` w rzędzie „Presety wyzwalaczy"; ten rząd zniknął razem z paskiem
    // tożsamości, bo Mapowanie ma teraz jedną powierzchnię konfiguracji — hub (rf-49i). Gdyby to
    // zostało przy `sel`, okno twierdziłoby „najpierw zapisz preset" nawet przy pełnej bibliotece,
    // i to CICHO: pusta lista opcji nieistniejącego elementu wygląda jak brak presetów.
    // `state.trigPresets` jest tym, z czego hub rysuje kafle, więc obie powierzchnie mówią to samo.
    sel: null, nameField: null,
    names: function () { try { return (state.trigPresets || []).map(p => p && p.name).filter(Boolean); } catch (e) { return []; } },
    selected: function () { try { return String((state.devices[state.activeDeviceId] || {}).cfgName || ""); } catch (e) { return ""; } },
    // Gdy nie ma czego wysłać, okno schodzi z drogi i wskazuje to, co to naprawia: kafel „+"
    // w hubie. Wcześniej było to pole nazwy w usuniętym rzędzie.
    focusId: "trigCfgHubAdd",
    title: ["Presety wyzwalaczy na Discordzie", "Trigger presets on Discord"],
    // The old wording spent a whole clause explaining that "profiles" and "trigger presets" are the
    // same thing. The bar next to it says "preset" now, so there is nothing left to reconcile.
    intro: ["Preset wyzwalaczy to same reguły „próg → klawisz”: bez osi, myszy i MIDI. Na forum #zestawy leżą pod tagiem ⌨️ Mapowanie.",
            "A trigger preset is nothing but the “threshold → key” rules: no axes, mouse or MIDI. On the #zestawy forum they sit under the ⌨️ Mapowanie tag."],
    share: ["Podziel się tym presetem", "Share this preset"],
    browseSub: ["Otworzy kanał #zestawy w przeglądarce. Filtruj tagiem ⌨️ Mapowanie: to są właśnie presety wyzwalaczy.",
                "Opens the #zestawy channel in your browser. Filter by the ⌨️ Mapowanie tag: those are the trigger presets."],
    load: ["Wczytaj plik lub odnośnik", "Load a file or link"],
    loadSub: ["Plik z dysku albo odnośnik z posta. Podgląd bezpieczeństwa i możliwość cofnięcia.",
              "A file from disk or a link from a post. A safety preview, and it can be undone."],
    foot: ["Twoje presety leżą w katalogu Library/Profiles obok aplikacji.",
           "Your presets live in the Library/Profiles folder next to the app."],
    noneSaved: ["Najpierw zapisz obecne reguły jako preset. Pokażę, gdzie.",
                "Save the current rules as a preset first. I will show you where."],
    noneAtAll: ["Nie masz jeszcze żadnych wyzwalaczy do wysłania.", "You have no triggers to send yet."],
    hasContent: function () { try { return (state.rules || []).length > 0; } catch (e) { return false; } },
    // Zdanie prowadzi do kafla „+” w hubie, bo tam się teraz zapisuje — dawny rząd z polem nazwy
    // i przyciskiem „Zapisz” już nie istnieje.
    flashSave: ["Najpierw zapisz te reguły jako preset kaflem „+ Zapisz obecne jako preset…” nad listą.",
                "Save these rules as a preset first with the “+ Save the current one as a preset…” tile above the list."],
    flashEmpty: ["Najpierw ułóż wyzwalacze, potem zapisz je jako konfigurację.",
                 "Build some triggers first, then save them as a configuration."]
  },
  axis: {
    sel: "posePresetSelect", nameField: "posePresetName",
    title: ["Presety osi 3D na Discordzie", "3D axis presets on Discord"],
    // The honest version of "how do I find these on the forum". An axis preset gets NO module tag
    // (rf-39g says why: axis tuning is not a module — it feeds triggers, motion, MIDI and the pads
    // alike), so the kind is in the thread title instead. Pointing at a tag that does not exist
    // would send people looking for nothing.
    intro: ["Preset osi to samo strojenie kapsla: kanały, filtr, czułość, odwrócenie i tor sygnału; działa pod każdą grą. Na forum #zestawy nie ma dla nich tagu modułu, więc rodzaj stoi w tytule wątku: „Preset osi 3D”.",
            "An axis preset is nothing but the capsule tuning: channels, filter, sensitivity, inversion and the signal chain; it works under any game. The #zestawy forum has no module tag for those, so the kind stands in the thread title instead: “3D axis preset”."],
    share: ["Podziel się tym presetem osi", "Share this axis preset"],
    browseSub: ["Otworzy kanał #zestawy w przeglądarce. Szukaj wątków z „Preset osi 3D” w tytule, bo tagu modułu te presety nie mają.",
                "Opens the #zestawy channel in your browser. Look for threads with “3D axis preset” in the title, because those presets carry no module tag."],
    load: ["Wczytaj plik lub odnośnik", "Load a file or link"],
    loadSub: ["Plik z dysku albo odnośnik z posta. Obecne osie zapiszę wcześniej jako preset, żeby dało się do nich wrócić.",
              "A file from disk or a link from a post. I will save your current axes as a preset first, so you can go back to them."],
    foot: ["Twoje presety osi leżą w katalogu Library/AxisPresets obok aplikacji.",
           "Your axis presets live in the Library/AxisPresets folder next to the app."],
    noneSaved: ["Najpierw zapisz obecne osie jako preset. Pokażę, gdzie.",
                "Save the current axes as a preset first. I will show you where."],
    noneAtAll: ["Najpierw zapisz obecne osie jako preset. Pokażę, gdzie.",
                "Save the current axes as a preset first. I will show you where."],
    // Axes always have SOME value (the capsule is tuned one way or another), so there is no
    // "nothing to send" case here — only "nothing saved yet".
    hasContent: function () { return true; },
    flashSave: ["Najpierw zapisz te osie jako preset: wpisz nazwę i kliknij „Zapisz”.",
                "Save these axes as a preset first: type a name and hit “Save”."],
    flashEmpty: ["Najpierw zapisz te osie jako preset: wpisz nazwę i kliknij „Zapisz”.",
                 "Save these axes as a preset first: type a name and hit “Save”."]
  },
  bundle: {
    sel: null, nameField: null,
    title: ["Zestawy na kilka kapsli na Discordzie", "Multi-capsule sets on Discord"],
    intro: ["Zestaw na kilka kapsli to konfiguracja WSZYSTKICH Twoich kapsli w jednym pliku, z rolą przy każdym („kierowanie”, „skok i strzał”). Osoba, która go wczyta, przypisze swoje kapsle do Twoich ról. Na forum #zestawy takie wątki mają tag 👥 Kilka kapsli.",
            "A multi-capsule set is the configuration of ALL your capsules in one file, with a role written next to each (“steering”, “jump and shoot”). Whoever loads it assigns their own capsules to your roles. On the #zestawy forum those threads carry the 👥 Kilka kapsli tag."],
    share: ["Podziel się tym zestawem", "Share this set"],
    browseSub: ["Otworzy kanał #zestawy w przeglądarce. Filtruj tagiem 👥 Kilka kapsli: to zestawy na dwa i więcej kapsli.",
                "Opens the #zestawy channel in your browser. Filter by the 👥 Kilka kapsli tag: those are the sets for two or more capsules."],
    load: ["Wczytaj plik lub odnośnik", "Load a file or link"],
    loadSub: ["Plik z dysku albo odnośnik z posta. Po podglądzie bezpieczeństwa zapytam, który Twój kapsel bierze którą rolę.",
              "A file from disk or a link from a post. After the safety preview I will ask which of your capsules takes which role."],
    foot: ["Role kapsli opisujesz w kreatorze, w kroku „Plik”.",
           "You describe the capsule roles in the wizard, in the “File” step."],
    noneSaved: ["Masz jeden kapsel, więc na kilka kapsli nie ma czego wysłać.",
                "You have one capsule, so there is no multi-capsule set to send."],
    noneAtAll: ["Masz jeden kapsel, więc na kilka kapsli nie ma czego wysłać.",
                "You have one capsule, so there is no multi-capsule set to send."],
    hasContent: function () { return false; },
    flashSave: ["Zestaw na kilka kapsli wymaga co najmniej dwóch: sparuj drugi na ekranie Połączenie.",
                "A multi-capsule set needs at least two: pair a second one on the Connection screen."],
    flashEmpty: ["Zestaw na kilka kapsli wymaga co najmniej dwóch: sparuj drugi na ekranie Połączenie.",
                 "A multi-capsule set needs at least two: pair a second one on the Connection screen."]
  },
  pack: {
    sel: null, nameField: null,
    title: ["Paczki akcji REST na Discordzie", "REST action packs on Discord"],
    intro: ["Paczka niesie wywołania HTTP tej aplikacji razem z ruchami, które je odpalają, bez tokenów i haseł: te zostają u Ciebie. Na forum #zestawy leżą pod tagiem 🌐 REST API.",
            "A pack carries this application's HTTP calls together with the movements that fire them, without tokens or passwords: those stay with you. On the #zestawy forum they sit under the 🌐 REST API tag."],
    share: ["Podziel się tą paczką", "Share this pack"],
    browseSub: ["Otworzy kanał #zestawy w przeglądarce. Filtruj tagiem 🌐 REST API: to są właśnie paczki akcji.",
                "Opens the #zestawy channel in your browser. Filter by the 🌐 REST API tag: those are the action packs."],
    load: ["Wczytaj plik lub odnośnik", "Load a file or link"],
    loadSub: ["Plik z dysku albo odnośnik z posta. Paczka wejdzie do TEJ aplikacji, z przeglądem każdej akcji przed dodaniem.",
              "A file from disk or a link from a post. The pack goes into THIS application, with every action shown before it is added."],
    foot: ["Paczka nie leży w bibliotece. To plik, który pobierasz i wysyłasz.",
           "A pack does not live in the library. It is a file you download and send."],
    noneSaved: ["Ta aplikacja nie ma jeszcze żadnej akcji do wysłania.",
                "This application has no actions to send yet."],
    noneAtAll: ["Ta aplikacja nie ma jeszcze żadnej akcji do wysłania.",
                "This application has no actions to send yet."],
    hasContent: function () { return false; },
    flashSave: ["Dodaj najpierw akcję do tej aplikacji.", "Add an action to this application first."],
    flashEmpty: ["Dodaj najpierw akcję do tej aplikacji.", "Add an action to this application first."]
  }
};
// …i rodzaje, które własnych zdań nie mają: dopisane z szablonu i NIGDY nad istniejącymi. Dzięki
// temu rodzaj dołożony do rejestru pojawia się w tym oknie tego samego dnia, a nie wtedy, gdy ktoś
// napisze mu dziesięć zdań — a napisane wcześniej zdania zostają nietknięte.
(function () {
  const R = (typeof RF_KINDS !== "undefined") ? RF_KINDS : (window.RF_KINDS || {});
  for (const id in R) {
    const K = R[id];
    if (!K.share || !K.shareId || PDC_KINDS[K.shareId]) continue;
    PDC_KINDS[K.shareId] = _pdcGeneric(K);
  }
})();

// Which button opens which kind — the fallback for a caller that forgot to hand its own element in,
// so aria-expanded still returns to false on the right button. The REST one is not here: its card is
// rebuilt on every change, so that button can only ever be passed in as ctx.opener.
const PDC_OPENER_ID = {
  setup: "setupShare", trig: "profDiscord", axis: "posePresetDiscord", bundle: "bundleDiscord"
};
function _pdcK(kind) { return PDC_KINDS[kind] || PDC_KINDS.trig; }
function _pdcTx(pair) { return _gl(pair[0], pair[1]); }
function _pdcCaps() { try { return Object.keys(state.devices || {}).length; } catch (e) { return 0; } }

// The saved things this kind can send, and which one is picked. Read off the <select> that sits
// next to the button rather than fetched again: it is refreshed on every save and delete, so it
// cannot disagree with what the person is looking at.
function _pdcNames(kind, ctx) {
  // A setup is never picked from a list — it IS the current configuration, so there is always
  // exactly one thing to send and the "nothing saved yet" branch never applies.
  if (kind === "setup") return ["*"];
  if (kind === "pack") {
    const a = ctx && ctx.api;
    return (a && Array.isArray(a.actions) && a.actions.length) ? [a.id] : [];
  }
  // A bundle is not saved anywhere — it is built from the capsules that exist right now, so
  // "is there anything to send" means "are there at least two of them".
  if (kind === "bundle") {
    try { return (Object.keys(state.devices || {}).length >= 2) ? ["*"] : []; } catch (e) { return []; }
  }
  // Rodzaj może podać własne źródło listy zamiast pola na ekranie — patrz `trig` wyżej, którego
  // biblioteka mieszka w pamięci, odkąd rząd presetów zniknął z Mapowania.
  const K = _pdcK(kind);
  if (typeof K.names === "function") return K.names() || [];
  const s = document.getElementById(K.sel);
  if (!s) return [];
  return Array.prototype.map.call(s.options, function (o) { return o.value; })
    .filter(function (v) { return !!v; });
}
function _pdcSelected(kind, ctx) {
  if (kind === "pack") return (ctx && ctx.api) ? ctx.api.id : "";
  if (kind === "bundle" || kind === "setup") return "";
  // POZYCJA WSKAZANA PRZEZ WYWOŁUJĄCEGO wygrywa z tą, którą nosi kapsel. Biblioteka globalna
  // otwiera to okno z konkretnego wiersza („podziel się TYM"), a bez tego okno mówiłoby o presecie,
  // który akurat siedzi na kapslu — czyli o czymś innym niż to, co człowiek kliknął.
  if (ctx && ctx.target) return String(ctx.target);
  const K = _pdcK(kind);
  if (typeof K.selected === "function") return K.selected() || "";
  const s = document.getElementById(K.sel);
  return (s && s.value) || "";
}
// What the picked thing is CALLED, for the "the wizard writes a post about …" line.
function _pdcLabel(kind, ctx) {
  // The name the author typed above the button — empty until they do, which the subtitle handles.
  if (kind === "setup") {
    const n = document.getElementById("setupName");
    return n ? (n.value || "").trim() : "";
  }
  if (kind === "pack") return (ctx && ctx.api) ? (ctx.api.name || "?") : "";
  if (kind === "bundle") {
    const roles = (typeof rfPostRoles === "function") ? rfPostRoles() : [];
    return roles.length ? roles.join(" · ") : "";
  }
  return _pdcSelected(kind, ctx);
}

function rfShareHubClose() {
  const back = _pdcBack;
  if (!back) return;
  _pdcBack = null;
  document.removeEventListener("keydown", back._onKey, true);
  if (_pdcOpener) { try { _pdcOpener.setAttribute("aria-expanded", "false"); } catch (e) {} }
  _pdcOpener = null;
  back.classList.add("out");
  setTimeout(function () { try { back.remove(); } catch (e) {} }, 160);
  try { if (_pdcPrevFocus && _pdcPrevFocus.focus) _pdcPrevFocus.focus(); } catch (e) {}
  _pdcPrevFocus = null;
}

// GDZIE MA PAŚĆ ZDANIE, KTÓRYM OKNO SCHODZI Z DROGI. `flashTrigMsg` pisze do `#trigMsg`, a ten
// element stoi w panelu „Konfiguracja" Mapowania — z listy presetów (zakładka „Biblioteka", w
// KAŻDYM module, łącznie z samym Mapowaniem) jest niewidoczny, bo nieaktywny panel ma `display:none`.
// Skutek: okno wymiany znikało i nie działo się NIC. Kliknięcie „Podziel się tym…" w module bez
// zapisanego presetu czytało się jak zepsuty przycisk — a tak stoi dziś sześć modułów na dziewięć.
// Gałąź `pack` obchodziła to własnym komunikatem, ale rodzaje dołożone przez rejestr (mysz, skaner,
// MIDI, usługi, koło, syntezator) wpadały do gałęzi `trig` i pisały w ciemno.
// Pytamy więc DOM, a nie nazwę rodzaju: pole na komunikat, którego nie widać, nie jest komunikatem.
function _pdcSay(text) {
  const box = document.getElementById("trigMsg");
  // `offsetParent` jest tu DOKŁADNIE tym testem, którego chcemy: element w nieaktywnym panelu
  // zgłasza się jako niewidoczny, a o to właśnie pytamy.
  if (box && box.offsetParent && typeof flashTrigMsg === "function") { flashTrigMsg(text); return; }
  // Czaszka mówi tam, gdzie stoisz. `rfSkullSay`, nie notka w rogu: to ODPOWIEDŹ na kliknięcie,
  // a odpowiedź ma być w drodze (rf-06-modals), zwłaszcza gdy okno właśnie zniknęło sprzed oczu.
  if (typeof rfSkullSay === "function") { rfSkullSay(text, {tone: "danger"}); return; }
  if (typeof rfToast === "function") rfToast(text, {tone: "danger"});
}

// Sharing needs a saved thing, because that is what travels — the wizard downloads the FILE, not
// whatever happens to be in the editor. With nothing saved, opening a wizard whose picker is empty
// would be a dead end, so the window steps aside and points at the field that fixes it.
function _pdcShare(kind, ctx) {
  const K = _pdcK(kind), names = _pdcNames(kind, ctx);
  if (!names.length) {
    rfShareHubClose();
    const n = document.getElementById(K.focusId || K.nameField || "");
    if (n) { try { n.focus(); } catch (e) {} }
    const say = K.hasContent() ? K.flashSave : K.flashEmpty;
    _pdcSay(_pdcTx(say));
    return;
  }
  rfShareHubClose();
  // RODZAJ Z WŁASNYM KREATOREM (dziś tylko koło, `ownWizard` w rejestrze) idzie do NIEGO. Powód
  // jest w rf-46f i jest dobry: preset koła mieści się w TREŚCI wpisu, w bloku kodu, więc nie
  // potrzebuje załącznika — a cały ostatni krok wspólnego kreatora jest o załączniku. Drzwi
  // zostają jedne, różni się tylko to, co za nimi stoi.
  {
    const R = (typeof RF_KINDS !== "undefined") ? RF_KINDS : (window.RF_KINDS || {});
    for (const id in R) {
      const KK = R[id];
      if (KK.shareId !== kind || !KK.ownWizard) continue;
      const nm = _pdcSelected(kind, ctx) || names[0];
      const A = (typeof rfKindAdapter === "function") ? rfKindAdapter(KK) : null;
      let p = null;
      try { p = A && A.findPreset(nm); } catch (e) { p = null; }
      if (p && typeof whPresetShare === "function") { whPresetShare(p); return; }
      return;
    }
  }
  if (typeof rfShareOpen !== "function") return;
  // A bundle has no "which one" — it is every capsule you have, right now.
  if (kind === "bundle") { rfShareOpen({kind: "bundle"}); return; }
  // Neither does a setup: the wizard reads the fields next to the button it came from.
  if (kind === "setup") { rfShareOpen({kind: "setup"}); return; }
  rfShareOpen({kind: kind, target: _pdcSelected(kind, ctx) || names[0]});
}

function _pdcItem(host, icon, title, sub, onClick, href) {
  const el = document.createElement(href ? "a" : "button");
  el.className = "pdc-item";
  if (href) { el.href = href; el.target = "_blank"; el.rel = "noopener noreferrer"; }
  else { el.type = "button"; }
  const ic = document.createElement("span");
  ic.className = "bic " + icon + " pdc-ic"; ic.setAttribute("aria-hidden", "true");
  const tx = document.createElement("span"); tx.className = "pdc-tx";
  const t = document.createElement("span"); t.className = "pdc-t"; t.textContent = title;
  const s = document.createElement("span"); s.className = "pdc-s"; s.textContent = sub;
  tx.appendChild(t); tx.appendChild(s);
  el.appendChild(ic); el.appendChild(tx);
  // A modifier or middle click on the forum row keeps its normal meaning (open in a new tab the way
  // the browser wants); a plain click also closes this window, because the answer is elsewhere now.
  el.addEventListener("click", function (e) {
    if (href && (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) return;
    if (!href) e.preventDefault();
    if (onClick) onClick();
    else rfShareHubClose();
  });
  host.appendChild(el);
  return el;
}

// kind: "setup" | "trig" | "axis" | "bundle" | "pack".  ctx (for "pack"): {api: <the REST application>}.
function rfShareHubOpen(kind, ctx) {
  if (_pdcBack) return;
  const K = _pdcK(kind);
  kind = PDC_KINDS[kind] ? kind : "trig";
  _pdcPrevFocus = document.activeElement;
  const names = _pdcNames(kind, ctx), label = _pdcLabel(kind, ctx);

  const back = document.createElement("div");
  back.className = "rfk-back pdc-back"; back.setAttribute("role", "presentation");
  const card = document.createElement("div");
  card.className = "rfk-card pdc-card";
  card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", _pdcTx(K.title));

  const head = document.createElement("div"); head.className = "rfk-head";
  const h = document.createElement("h3"); h.className = "rfk-title";
  h.textContent = _pdcTx(K.title);
  const x = document.createElement("button"); x.type = "button"; x.className = "rfk-x";
  x.setAttribute("aria-label", _gl("Zamknij", "Close")); x.textContent = "×";
  x.addEventListener("click", rfShareHubClose);
  head.appendChild(h); head.appendChild(x);

  const body = document.createElement("div"); body.className = "pdc-body";
  const intro = document.createElement("p"); intro.className = "rfs-intro";
  intro.textContent = _pdcTx(K.intro);
  body.appendChild(intro);

  // 1 — send mine out. The subtitle names the file that will actually go, because "share this one"
  // is a promise about one specific thing and the picker is a few pixels away.
  // With no name yet, a preset points at the list it would take the first item from — a setup has
  // no such list, only a name still to be typed, and the wizard asks for it in its first step.
  const noPick = (kind === "setup")
    ? _gl("Kreator poprowadzi: nazwa, tagi, podpis i plik do przeciągnięcia.",
          "The wizard walks you through: name, tags, signature and the file to drag in.")
    : _gl("Nie masz nic wybranego, więc kreator weźmie pierwszy z listy. Zmienisz to w kroku 1.",
          "Nothing is picked, so the wizard takes the first one on the list; you change that in step 1.");
  const shareSub = !names.length
    ? _pdcTx(K.hasContent() ? K.noneSaved : K.noneAtAll)
    : (kind === "bundle"
        ? (_gl("Wyjdzie zestaw na ", "The set going out covers ") + _pdcCaps() +
           _gl(" kapsle", " capsules") + (label ? (": " + label) : "") +
           _gl(". Role opiszesz w pierwszym kroku kreatora.", ". You write the roles in the wizard's first step."))
        : (label ? _gl("Kreator ułoży post o „", "The wizard writes a post about “") + label +
                   _gl("”: tytuł, tagi i plik do przeciągnięcia.", "”: title, tags and the file to drag in.")
                 : noPick));
  const first = _pdcItem(body, "bic-mega", _pdcTx(K.share), shareSub,
    function () { _pdcShare(kind, ctx); });
  if (!names.length) first.classList.add("dim");

  // 2 — go and look. A channel link, not the server's front door: somebody who already belongs
  // here lands in #zestawy with the tag filter in front of them.
  _pdcItem(body, "bic-eye", _gl("Przeglądaj forum ↗", "Browse the forum ↗"),
    _pdcTx(K.browseSub), null, _pdcForum());

  // 3 — bring one back. The counterpart of "go and look": the whole point of finding something on
  // the forum is having it here. One window answers that however the file arrived — picked off the
  // disk, pasted as a link or dropped on the app — with every gate in place.
  _pdcItem(body, "bic-import", _pdcTx(K.load), _pdcTx(K.loadSub), function () {
    rfShareHubClose();
    if (typeof rfLinkOpen === "function") {
      // A bundle needs no wording of its own in the link window: it IS the setup route, and the
      // sniffer sends it to the bundle importer, which is where the role question lives.
      rfLinkOpen(kind === "pack" ? {kind: "pack", api: (ctx && ctx.api)}
                                 : {kind: (kind === "bundle") ? "setup" : kind});
    }
  });

  // 4 — how any of this works. Deliberately the last row and visually quieter: somebody who came
  // here to send a file should not have to step over a lesson. It carries a „zacznij tu" chip until
  // it has been opened once, which is the one moment it is worth interrupting for.
  const howto = _pdcItem(body, "bic-book", _gl("Jak działa dzielenie się?", "How does sharing work?"),
    _gl("Minuta czytania: co wychodzi z komputera, co nie i jak wraca poprawione.",
        "A minute of reading: what leaves your computer, what does not, and how it comes back improved."),
    function () {
      rfShareHubClose();
      if (typeof rfShareHowTo === "function") rfShareHowTo();
    });
  howto.classList.add("pdc-quiet");
  if (typeof rfShareHowToSeen === "function" && !rfShareHowToSeen()) {
    const badge = document.createElement("span");
    badge.className = "pdc-badge"; badge.textContent = _gl("zacznij tu", "start here");
    howto.appendChild(badge);
  }

  const foot = document.createElement("div"); foot.className = "rfk-foot";
  // Getting the file onto the disk is a fair reason to be standing here — a post is not the only
  // way to hand somebody a setup. The hub dispatches to the existing exporters, same as the
  // wizard's download button, so every gate (the "what to include" question, the empty-pack
  // refusal) stays exactly where it was. Hidden when there is nothing to write out.
  if (names.length) {
    const dl = document.createElement("button");
    dl.type = "button"; dl.className = "btn sm";
    dl.textContent = _gl("Pobierz plik .json", "Download the .json");
    // Polish + a dictionary entry, NOT _gl(): a title written with _gl() freezes in whatever
    // language the window opened in, because the i18n walker only ever translates from Polish.
    dl.title = "Zapisze plik tam, gdzie lądują Twoje pobrane pliki";
    dl.addEventListener("click", function () {
      rfShareHubClose();
      try {
        if (kind === "setup") { if (typeof setupExport === "function") setupExport(); }
        else if (kind === "bundle") { if (typeof bundleExport === "function") bundleExport(); }
        else if (kind === "pack") { if (typeof restExportActions === "function") restExportActions(ctx && ctx.api); }
        else if (typeof rfLibDownload === "function") {
          // Szuflada z rejestru, nie „trig albo pose": tamten warunek znał dwa rodzaje z sześciu
          // i każdemu innemu podsuwał pobranie z listy osi 3D.
          const R = (typeof RF_KINDS !== "undefined") ? RF_KINDS : (window.RF_KINDS || {});
          let lib = "";
          for (const id in R) if (R[id].shareId === kind) lib = R[id].lib || "";
          if (lib) rfLibDownload(lib, _pdcSelected(kind, ctx) || names[0]);
        }
      } catch (e) {}
    });
    foot.appendChild(dl);
  }
  const note = document.createElement("span"); note.className = "rfk-note";
  note.textContent = _pdcTx(K.foot);
  // A channel link resolves to nothing for somebody who is not on the server yet — the invite is
  // the second door, exactly as it is at the end of the wizard.
  const inv = document.createElement("a"); inv.className = "rfk-out";
  inv.href = _pdcInvite(); inv.target = "_blank"; inv.rel = "noopener noreferrer";
  // Word for word the sentence the post wizard (rf-39f), the wheel's post window (rf-46f) and the
  // „Zgłoś problem" window (rf-47b) use. „Dołącz ↗" said less and read as a fourth kind of door.
  inv.textContent = _gl("Nie jesteś jeszcze na serwerze? Dołącz zaproszeniem ↗",
                        "Not on the server yet? Join with the invite ↗");
  foot.appendChild(note); foot.appendChild(inv);

  card.appendChild(head); card.appendChild(body); card.appendChild(foot);
  back.appendChild(card);

  back.addEventListener("mousedown", function (e) { if (e.target === back) rfShareHubClose(); });
  back._onKey = function (e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); rfShareHubClose(); return; }
    const f = Array.prototype.filter.call(
      card.querySelectorAll("a[href],button:not([disabled])"),
      function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    // A list of choices is a list: the arrows walk it, the way they do in a menu.
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const items = Array.prototype.slice.call(card.querySelectorAll(".pdc-item"));
      if (!items.length) return;
      e.preventDefault();
      const at = items.indexOf(document.activeElement);
      const to = (e.key === "ArrowDown")
        ? (at < 0 ? 0 : (at + 1) % items.length)
        : (at < 0 ? items.length - 1 : (at - 1 + items.length) % items.length);
      try { items[to].focus(); } catch (err) {}
      return;
    }
    if (e.key !== "Tab") return;
    const firstEl = f[0], lastEl = f[f.length - 1];
    if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
  };
  document.addEventListener("keydown", back._onKey, true);

  document.body.appendChild(back);
  _pdcBack = back;
  _pdcOpener = (ctx && ctx.opener) || document.getElementById(PDC_OPENER_ID[kind] || PDC_OPENER_ID.trig);
  if (_pdcOpener) { try { _pdcOpener.setAttribute("aria-expanded", "true"); } catch (e) {} }
  try { if (typeof applyLang === "function") applyLang(back); } catch (e) {}
  setTimeout(function () { try { first.focus(); } catch (e) {} }, 30);
}

// The buttons that live in static-ish markup. The REST one is wired where its card is built
// (rf-36), because that card is re-rendered every time the application changes.
function initShareHub() {
  const wire = function (id, kind) {
    const b = document.getElementById(id);
    if (!b) return;
    b.addEventListener("click", function (e) {
      // The setup one is an <a href> pointing straight at the forum, and it keeps that meaning:
      // a modifier or middle click opens the channel the way the browser wants, a plain click
      // opens this window instead. Same rule the forum row inside the window follows.
      if (b.tagName === "A") {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
      }
      rfShareHubOpen(kind, {opener: b});
    });
  };
  wire("setupShare", "setup");
  wire("profDiscord", "trig");
  wire("posePresetDiscord", "axis");
  wire("bundleDiscord", "bundle");
}

// ---- the exchange row at the top of the Library tab --------------------------
// The small „Wymiana" buttons open the window above, because standing at a save bar leaves the
// intent open: send this one out, go and look, bring one back. These two tiles have ALREADY said
// which of those it is — the hero tile already IS the intent, so it goes straight to the wizard,
// while the small „Wymiana" buttons open the hub. A window that asks a question you answered by
// clicking is a toll gate, not a choice.
function initExchangeHero() {
  // THE ADDRESSES ARE ASSIGNED, NOT TRUSTED FROM THE MARKUP. All three of these are real <a> tags so
  // that a middle click, „open in new tab" and „copy link address" behave the way people expect —
  // but the href written into the HTML is only a placeholder that keeps them links before this runs.
  // Every community address lives in rf-00-core; a literal left in the markup is a second copy, and
  // the day somebody edits one of them the stale one wins silently.
  const browse = document.getElementById("xhBrowse");
  if (browse) browse.href = _pdcForum();
  const setupShare = document.getElementById("setupShare");
  if (setupShare) setupShare.href = _pdcForum();
  // The third room. It is not part of the exchange (nothing loadable lives there), so it is a quiet
  // line rather than a tile — but it is the only place in the app that says #pochwal-się exists.
  const showcase = document.getElementById("xhShowcase");
  if (showcase) {
    showcase.href = RF_SHOWCASE_URL;
    // The channel NAME is filled in here too, for the same reason the address is: it sits in its own
    // `data-noi18n` span (a proper name, not a word to translate), and a literal left in the markup
    // would be a second copy of something that lives on somebody else's server.
    const nm = showcase.querySelector("[data-noi18n]");
    if (nm) nm.textContent = RF_SHOWCASE_NAME;
  }

  const take = document.getElementById("xhTake");
  if (take) {
    take.addEventListener("click", function () {
      // No options: the one import window defaults to the setup route, and its sniffer sends a
      // bundle, a preset or a REST pack wherever it belongs anyway.
      if (typeof rfLinkOpen === "function") rfLinkOpen();
    });
  }
  const share = document.getElementById("xhShare");
  if (share) {
    share.addEventListener("click", function () {
      // No options here either: „share yours" does not say WHICH of the five kinds, so the wizard
      // opens on the step that asks exactly that.
      if (typeof rfShareOpen === "function") rfShareOpen();
    });
  }
  const how = document.getElementById("xhHowto");
  if (how) {
    // Same chip, same rule as the „how does sharing work" row inside the window: worth interrupting
    // for exactly once. The hero is static markup and never re-renders, so the click takes it off.
    if (typeof rfShareHowToSeen === "function" && !rfShareHowToSeen()) {
      const badge = document.createElement("span");
      badge.className = "xh-badge"; badge.textContent = _gl("zacznij tu", "start here");
      how.appendChild(badge);
    }
    how.addEventListener("click", function () {
      const b = how.querySelector(".xh-badge");
      if (b) { try { b.remove(); } catch (e) {} }
      if (typeof rfShareHowTo === "function") rfShareHowTo();
    });
  }
  rfZestawyTiers();
}

// PIĘTRA ekranu Zestawy (UX 261120 L4c). Piętro 2: „Udostępnianie” w karcie wymiany i „Gra i opis”
// w pasku zapisu zestawu; piętro 3: „Zaawansowane” na dole ekranu. Auto-zestawy rejestruje rf-39o.
function rfZestawyTiers() {
  if (typeof rfTier !== "function") return;
  const g = function (id) { return document.getElementById(id); };
  rfTier(g("xhShareFold"), "zestawy.udostepnianie", {
    sum: function () { return _gl("kreator posta na forum, #pochwal-się, jak to działa", "forum post wizard, #pochwal-się, how it works"); },
    changed: function () { return 0; } });
  const more = rfTier(g("setupMoreFold"), "zestawy.graopis", {
    sum: function () {
      const v = ["setupFor", "setupExe", "setupDesc"].map(function (id) { return ((g(id) || {}).value || "").trim(); }).filter(Boolean);
      return v.length ? v.join(" · ") : _gl("nie wpisano", "not filled in");
    },
    changed: function () { return 0; } });
  // Pola wypełnia też kreator wymiany i wczytanie zestawu (bez zdarzeń), więc nagłówek dogania je co chwilę.
  ["setupFor", "setupExe", "setupDesc"].forEach(function (id) { const e = g(id); if (e) e.addEventListener("input", function () { more(); }); });
  rfTier(g("zsAdv"), "zestawy.zaawansowane");
}

window.rfShareHubOpen = rfShareHubOpen;
window.rfShareHubClose = rfShareHubClose;
window.initExchangeHero = initExchangeHero;
