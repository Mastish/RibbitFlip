"use strict";
// ========================= THE LIBRARY — everything you saved =========================
// Three kinds of saved thing live in Library/ and used to be managed from three different tabs
// through three different dropdowns: complete setups, trigger presets, 3D-axis presets. A dropdown
// tells you a name and nothing else, so "load the one I made last week" meant loading candidates
// until one looked right — a destructive way to browse.
//
// This is the same data as a list: what each entry is for, who made it, which sections it carries,
// when it was saved. Loading, downloading and deleting sit on the row itself, and downloading is
// what the dropdowns never allowed — sending somebody a saved setup used to mean loading it over
// your own configuration first.
//
// Nothing here writes: the server side (GET /library) only reads files. Saving still happens where
// it always did, next to the thing being saved.

// SZUFLADY LICZONE Z REJESTRU RODZAJÓW (rf-49-kinds), nie wypisane drugi raz z ręki. Do 2026-08-31
// stała tu własna lista sześciu pozycji, a obok niej trzy własne mapy adresów — i to jest dokładnie
// ten wzorzec, przez który dołożenie rodzaju wymagało pamiętania o piętnastu miejscach, a trzy
// ostatnie rodzaje przeszły przez sześć. Kolejność bierze się z kolejności w rejestrze: zestawy,
// potem presety modułów w kolejności, w jakiej moduły stoją w nawigacji.
//
// ⚠️ SĄ TU TAKŻE trzy rodzaje, które NIE są plikami w katalogu: presety koła, sceny syntezatora
// i układy okien nakładek (`inSettings: true` w rejestrze). Do 2026-08-31 nie było ich w Bibliotece
// w ogóle, choć nagłówek nad listą mówił „wszystko, co masz zapisane na tym komputerze" — trzy
// rodzaje na dziewięć czyniły to zdanie nieprawdą. Serwer oddaje je z magazynów (`_LIBRARY_STORES`)
// w tej samej kopercie, co pliki, więc ta lista nie musi wiedzieć, skąd pochodzą.
//
// Etykieta szuflady mówi „preset" wprost. Te same pliki nazywały się kiedyś profilem w jednej
// zakładce, presetem w podpowiedzi obok i nijak tutaj — i właśnie dlatego „co jest konfiguracją,
// a co presetem" było uczciwym pytaniem.
function _rflKindList() {
  const R = (typeof RF_KINDS !== "undefined") ? RF_KINDS : (window.RF_KINDS || {});
  const out = [];
  for (const id in R) {
    const K = R[id];
    // `bundle` dzieli szufladę z zestawem (leży w tym samym katalogu i w tej samej liście),
    // a `pack` nie leży nigdzie — obu nie ma tu być jako osobnej pozycji.
    if (!K.lib || id === "bundle") continue;
    // Moduł wyłączony przy starcie (--disable, rf-00b): bez szuflady. Jego presety leżą dalej na
    // dysku, ale wczytać ich teraz nie ma dokąd — trasy modułu odpowiadają 404.
    if (K.tab && typeof rfModTabOff === "function" && rfModTabOff(K.tab) && !(K.alsoTab && !rfModTabOff(K.alsoTab))) continue;
    out.push({k: K.lib, pl: K.pl.many, en: K.en.many});
  }
  return out;
}
const RFL_KINDS = _rflKindList();
function _rflApiMap(field) {
  const R = (typeof RF_KINDS !== "undefined") ? RF_KINDS : (window.RF_KINDS || {});
  const out = {};
  for (const id in R) {
    const K = R[id];
    if (!K.lib || id === "bundle") continue;
    const v = (K.api || {})[field];
    if (v) out[K.lib] = v;
  }
  return out;
}
const RFL_LOAD = _rflApiMap("load");
const RFL_DEL = _rflApiMap("del");
// Zestaw nie ma tu wpisu i to jest celowe: „zapisz obecne jako zestaw" ma własną kartę z nazwą,
// grą i opisem, a ten pasek zapisuje POJEDYNCZY moduł. Rejestr zna adres `/setup/save`, więc
// wykluczenie jest jawne, a nie przez przemilczenie.
const RFL_SAVE = (function () { const m = _rflApiMap("save"); delete m.setup; return m; })();

// Jedno zdanie na rodzaj: co ta szuflada trzyma i czego wczytanie pozycji dotknie, a czego nie.
// ⚠️ TO ZDANIE MA JEDNO ŹRÓDŁO (rejestr rodzajów, `explain`), bo pada w DWÓCH miejscach: tutaj,
// nad listą, i w kreatorze posta, w kroku „co wysyłasz". Do 2026-08-31 stały w tych dwóch miejscach
// dwa różne zdania o tym samym („Same reguły próg → klawisz. Wczytanie podmienia wyzwalacze…"
// kontra „…Po wczytaniu podmieniają wyzwalacze…") i już się od siebie oddalały.
const RFL_EXPLAIN = (function () {
  const R = (typeof RF_KINDS !== "undefined") ? RF_KINDS : (window.RF_KINDS || {});
  const out = {};
  for (const id in R) {
    const K = R[id];
    if (!K.lib || id === "bundle" || !K.explain) continue;
    out[K.lib] = K.explain;
  }
  return out;
})();

// DO KTÓREGO MODUŁU NALEŻY SZUFLADA. Biblioteka pokazuje od etapu 3 wszystkie rodzaje NARAZ, więc
// każdy wiersz musi umieć powiedzieć, gdzie się tę pozycję EDYTUJE — i tą samą ikoną, którą moduł
// ma w nawigacji. Stąd też panel opisu bierze adaptera (rf-49 `rfCfgIdEntry`): to on wie, kto nosi
// tę konfigurację i co ona ustawia. Zestaw nie ma modułu — jest o całej aplikacji naraz.
// …i też liczone z rejestru, z tego samego powodu, co lista szuflad wyżej. `ownLabel` (osie 3D)
// i `card` (dokąd dojechać w zakładce, gdy moduł nie ma własnej kolumny presetów) siedzą przy
// swoim rodzaju w rejestrze, bo są faktami O TYM RODZAJU, a nie o tej liście.
const RFL_MOD = (function () {
  const R = (typeof RF_KINDS !== "undefined") ? RF_KINDS : (window.RF_KINDS || {});
  const out = {};
  for (const id in R) {
    const K = R[id];
    if (!K.lib || id === "bundle") continue;
    out[K.lib] = {
      tab: K.tab || undefined, key: K.key || undefined, png: K.icon || "vault",
      pl: (K.mod && K.mod.pl) || K.pl.many, en: (K.mod && K.mod.en) || K.en.many,
      ownLabel: !!K.ownLabel, card: K.card || undefined
    };
  }
  return out;
})();
// Etykieta modułu czytana z ŻYWEGO przycisku nawigacji, gdy tylko istnieje: po przełączeniu na
// angielski walker przepisał już przycisk, a kopia z tablicy zostałaby po polsku.
function _rflModLabel(kind) {
  const m = RFL_MOD[kind]; if (!m) return kind;
  if (m.tab && !m.ownLabel) {
    const b = document.querySelector('.tab-btn[data-tab="' + m.tab + '"]');
    const s = b && b.querySelector("span:not(.rfic):not(.tab-dot):not(.tab-emoji)");
    if (s && s.textContent) return s.textContent;
  }
  return _gl(m.pl, m.en);
}
function _rflModIcon(kind) {
  const m = RFL_MOD[kind];
  const s = document.createElement("span");
  // ⚠️ NIE `lib-ic` — ta klasa jest już zajęta przez ikonę biblioteki BRZMIEŃ (megafon,
  // 10-icons-controls.css) i nadpisywała każdą ikonę modułu megafonem.
  s.className = "rfic rfl-ic tab-ic-" + ((m && m.png) || "vault");
  s.setAttribute("aria-hidden", "true");
  return s;
}
// Adapter modułu dla tej szuflady — albo `null`, gdy moduł nie doszedł (okno nakładki, ukryta
// zakładka przed montażem). Bez adaptera panel opisu pokazuje sam plik, bez „kto to nosi".
function _rflAdapter(kind) {
  const m = RFL_MOD[kind];
  if (!m || !m.tab || typeof rfCfgIdEntry !== "function") return null;
  const e = rfCfgIdEntry(m.tab);
  return (e && e.adapter) || null;
}

let _rflKind = "setup";      // do której szuflady odnoszą się NARZĘDZIA pod listą (opis + zapis)
let _rflPick = "";           // filtr modułu: "" = wszystko, inaczej rodzaj z RFL_KINDS
let _rflData = null;
let _rflFilter = "";         // wpisana fraza wyszukiwania
let _rflSel = null;          // { kind, name } — pozycja opisana po prawej

function _rflDate(sec) {
  if (!sec) return "";
  try {
    const d = new Date(sec * 1000);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay
      ? _gl("dzisiaj ", "today ") + d.toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit"})
      : d.toLocaleDateString(undefined, {day: "2-digit", month: "2-digit", year: "numeric"});
  } catch (e) { return ""; }
}

function _rflSize(b) {
  if (!b) return "";
  return b < 1024 ? b + " B" : Math.round(b / 1024) + " kB";
}

// Which parts of the configuration a saved setup carries. "What will loading it change?" is the
// question people hesitate over, and until now the only way to find out was to load it.
const _RFL_GROUP = {
  rules: ["wyzwalacze", "triggers"], trigEnabled: null,
  mouse: ["sterowanie ruchem", "motion control"], midi: ["MIDI/OSC", "MIDI/OSC"],
  pose: ["osie 3D", "3D axes"], power: ["bateria", "battery"], pad: ["synth", "synth"],
  // Serwer wysyłał `scan` w `groups` od 13.09, a ta mapa go nie znała — panel opisu zestawu
  // „Sol Cesto (skaner)" wymieniał więc same wyzwalacze, choć wczytanie podmienia też skaner (02.10).
  scan: ["skaner ekranu", "screen scanner"]
};

// "1 reguł" is the kind of thing that makes an interface read like a translation. Polish takes
// three forms, and which one depends on the last digit — except in the teens, where it does not.
function _rflRules(n) {
  const v = Math.abs(n || 0), t = v % 10, h = v % 100;
  const pl = (v === 1) ? "reguła" : (t >= 2 && t <= 4 && (h < 12 || h > 14)) ? "reguły" : "reguł";
  return v + " " + _gl(pl, v === 1 ? "rule" : "rules");
}


// (`_rflBtn` — fabryczka przycisków wiersza — usunięta w etapie 3 razem z kaflami: przyciski stoją
//  teraz w panelu opisu i buduje je `_ldBtn` w rf-39i2.)

function _rflDownload(kind, name) {
  fetch("/library/item?kind=" + encodeURIComponent(kind) + "&name=" + encodeURIComponent(name))
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res || !res.ok || !res.item) { setupFlash(_gl("Nie udało się odczytać pliku", "Could not read the file")); return; }
      const base = (typeof rfSetupFileBase === "function") ? rfSetupFileBase(name) : name;
      const blob = new Blob([JSON.stringify(res.item, null, 2)], {type: "application/json;charset=utf-8"});
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = "ribbitflip-" + kind + "-" + base + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      setupFlash(_gl("Pobrano „", "Downloaded “") + name + "”");
    })
    .catch(function () { setupFlash(_gl("Serwer nieosiągalny", "Server unreachable")); });
}

// Loading your own file replaces what you have just as thoroughly as an import does, so it gets the
// same way back. A setup snapshot has to be taken BEFORE the request — afterwards the server already
// holds the new configuration and there is nothing left to remember. Triggers and axes are read from
// the page, so those wait until the answer is in and only fire when it succeeded.
async function _rflLoad(kind, name, it) {
  // A multi-capsule set among the setups (the server marks it): /setup/load cannot apply it, and
  // pretending otherwise would end in "ok:false" with nothing said about roles. It goes through
  // the same door a bundle file from disk does — analysis, safety modal, role mapping — which is
  // also what makes the built-in two-capsule starting point loadable at all.
  if (kind === "setup" && it && it.bundle) {
    fetch("/library/item?kind=setup&name=" + encodeURIComponent(name))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok || !res.item) { rfToast(_gl("Nie udało się wczytać.", "Could not load."), {tone: "danger"}); return; }
        // Zrzuty plansz (`obrazy`, od 02.10) są dla KOGOŚ INNEGO — tutaj leżą już na dysku, więc
        // wysyłanie ich z powrotem na ten sam serwer byłoby megabajtami po nic i mylącym dymkiem.
        if (res.item && res.item.obrazy) { res.item = Object.assign({}, res.item); delete res.item.obrazy; }
        if (typeof bundleImportObj === "function") bundleImportObj(res.item);
      })
      .catch(function () { setupFlash(_gl("Serwer nieosiągalny", "Server unreachable")); });
    return;
  }
  // CO STRACISZ — pytanie przed wymianą CAŁEJ konfiguracji (rf-29f). Do 13.09 „Wczytaj zestaw"
  // w Bibliotece był jedynym miejscem w aplikacji, gdzie jedno kliknięcie wymieniało wszystkie
  // moduły BEZ ŻADNEGO pytania: presety pojedynczych modułów pytają od dawna (`rfCfgIdAskLoad`),
  // a rzecz, która wymienia je wszystkie naraz, nie pytała wcale. Sekcje bierzemy z wpisu listy
  // (`it.groups` — to samo, co pokazuje „Co wymieni po wczytaniu"), kapsel jest jeden: ten,
  // którego dotyczy `/setup/load`, czyli aktywny.
  if (kind === "setup") {
    if (typeof rfSetupGuard === "function") {
      const G = await rfSetupGuard({name: name, groups: (it && it.groups) || [], devs: null});
      if (!G) return;                  // anulowano — nic nie zapisane, nic nie wczytane
    }
    await _rfUndoStash("setup");
  }
  // Mysz też PRZED zapytaniem, i z tego samego powodu co zestaw — tylko ostrzej: silnik rozgłasza
  // `mouse_cfg` już w trakcie obsługi żądania, więc migawka zrobiona po odpowiedzi zapamiętałaby
  // konfigurację, którą właśnie wczytujemy, i „Cofnij" nie miałoby dokąd wrócić.
  if (kind === "mouse") await _rfUndoStash("mouse");
  // Mapowania tak samo i z tego samego powodu: silnik rozgłasza `midi_cfg` już w trakcie obsługi
  // żądania, więc migawka zrobiona po odpowiedzi zapamiętałaby zestaw, który właśnie wczytujemy.
  if (kind === "midi") await _rfUndoStash("midi");
  fetch(RFL_LOAD[kind], {method: "POST", headers: {"Content-Type": "application/json"},
                         body: JSON.stringify({name: name})})
    .then(function (r) { return r.json(); })
    .then(async function (j) {
      // A failure has to be as loud as a success, or a green bubble that sometimes does not
      // appear is the only signal — and "nothing happened" reads as "I misclicked".
      if (!j || !j.ok) {
        rfToast(((j && j.error) || _gl("Nie udało się wczytać.", "Could not load.")), {tone: "danger"});
        return;
      }
      if (kind === "profile") {
        // Triggers land in place — the list re-renders and nothing else in the panel changes.
        await _rfUndoStash("rules");
        state.rules = j.rules || [];
        if (typeof renderRules === "function") renderRules();
        _rfUndoShowToast(_gl("Wczytano preset wyzwalaczy „", "Loaded the trigger preset “") + name + "”.");
        return;
      }
      if (kind === "mouse") {
        // Ustawienia ruchu lądują na miejscu — karta Mysz przerysowuje się z odpowiedzi, tak jak
        // po wczytaniu profilu z paska tożsamości, i nic poza nią w panelu się nie zmienia.
        // Migawka do cofnięcia jest już zrobiona — patrz wyżej, PRZED zapytaniem.
        if (j.config && typeof onMouseCfg === "function") onMouseCfg(j.config, true);
        if (typeof loadMousePresets === "function") loadMousePresets();
        _rfUndoShowToast(_gl("Wczytano profil myszy „", "Loaded the mouse preset “") + name + "”.");
        return;
      }
      if (kind === "midi") {
        // Lista mapowań ląduje na miejscu — obie karty (MIDI i OSC) przerysowują się z odpowiedzi,
        // tak jak po wczytaniu zestawu z paska tożsamości. Edytor mapowania trzyma KOPIĘ wiersza
        // ze starej listy, więc musi zniknąć, zanim lista się wymieni (i zanim jego bramka zjadłaby
        // odpowiedź) — patrz applyPreset w rf-49d. Migawka jest już zrobiona, PRZED zapytaniem.
        if (state.midiEditing && typeof closeMidiEditor === "function") closeMidiEditor();
        if (j.config && typeof onMidiCfg === "function") onMidiCfg(j.config);
        if (typeof loadMidiPresets === "function") loadMidiPresets();
        _rfUndoShowToast(_gl("Wczytano zestaw mapowań „", "Loaded the mapping preset “") + name + "”.");
        return;
      }
      if (kind === "rest") {
        // Zestaw akcji ląduje na miejscu — zakładka Usług przerysowuje się z odpowiedzi, tak jak
        // po wczytaniu z Biblioteki modułu. Scalanie zrobił już serwer (`apply_rest_preset`), więc
        // przełącznik modułu i adres OBS-a zostały nietknięte; tu tylko wpuszczamy wynik w panel,
        // przez ten sam sanitizer, co przy starcie.
        try {
          if (j.config && typeof _raSanCfg === "function") RESTAPI.cfg = _raSanCfg(j.config);
          if (typeof restRenderApis === "function") restRenderApis();
          if (typeof _raRenderHeader === "function") _raRenderHeader();
          if (typeof restCfgSync === "function") restCfgSync();
          if (window.updateTabDots) updateTabDots();
        } catch (e) { }
        rfToast(_gl("Wczytano preset usług sieciowych „", "Loaded the network-service preset “") + name + "”.",
                {tone: "ok"});
        return;
      }
      if (kind === "pose" && j.config && typeof applyPoseConfig === "function") {
        await _rfUndoStash("pose");
        applyPoseConfig(j.config);
        _rfUndoShowToast(_gl("Wczytano preset osi 3D „", "Loaded the 3D axis preset “") + name + "”.");
        return;
      }
      // A whole setup touches every group, so the panel is re-read from the server. The undo offer
      // has to survive that reload, which is what the pending flag is for (see _rfUndoInit).
      // `padAdoptState` (rf-20b) zapisuje kopię w przeglądarce ORAZ stan po stronie aplikacji.
      // Od chwili, w której Settings/ jest źródłem prawdy dla syntezatora, odświeżenie strony
      // kilka linijek niżej wczytałoby stary stan i syntezator z tego zestawu by nie dojechał.
      try { if (j.pad) await padAdoptState(j.pad); } catch (e) {}
      // The name has to survive the reload with the flag, or the note that greets the user
      // afterwards can only say "a setup" — and by then the list is gone from the screen.
      try { localStorage.setItem("ribbitflip.undo.pending", JSON.stringify({name: name})); } catch (e) {}
      try { localStorage.setItem("ribbitflip.lib.sel", JSON.stringify({kind: kind, name: name})); } catch (e) {}
      // Scena „kaseta wsuwa się, szpule, Wczytane" — gra po przeładowaniu, z kasetą tego zestawu (rf-28e).
      try { if (typeof rfKasetaZapowiedz === "function") rfKasetaZapowiedz(it && it.cassette, name); } catch (e) {}
      // Loading your OWN set leaves the group switches exactly as an import does (apply_setup never
      // flips them). The box „Włącz od razu po wczytaniu" in the description panel (rf-39i2) is the
      // same remembered answer the import preview reads: ticked, the switches the server reports as
      // off here are flipped now; unticked, the note with „Włącz teraz" follows the reload (rf-29e).
      if (typeof rfArmAfterLoad === "function") {
        await rfArmAfterLoad(j, (typeof rfArmPref === "function") && rfArmPref());
      } else {
        try { localStorage.setItem("ribbitflip.undo.switchesBy", JSON.stringify(j.switchesKeptBy || [])); } catch (e) {}
      }
      setupFlash(_gl("Wczytano „", "Loaded “") + name + _gl("”, odświeżam…", "”, refreshing…"));
      setTimeout(function () { location.reload(); }, 650);
    })
    .catch(function () { setupFlash(_gl("Serwer nieosiągalny", "Server unreachable")); });
}

async function _rflDelete(kind, name) {
  const what = _gl("„" + name + "” zostanie trwale usunięty.", "“" + name + "” will be permanently deleted.");
  if (typeof rfConfirm === "function") {
    const ok = await rfConfirm(what, {
      title: _gl("Usunąć z biblioteki?", "Delete from the library?"),
      icon: '<span class="rfm-bin"></span>', tone: "danger",
      confirmLabel: _gl("Usuń", "Delete"), cancelLabel: _gl("Anuluj", "Cancel")});
    if (!ok) return;
  }
  fetch(RFL_DEL[kind], {method: "POST", headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({name: name})})
    .then(function (r) { return r.json(); })
    .then(function () {
      setupFlash(_gl("Usunięto „", "Deleted “") + name + "”");
      rfLibReload();
      // The old dropdowns in the other tabs list the same files — keep them honest.
      try { if (typeof loadProfileList === "function" && kind === "profile") loadProfileList(""); } catch (e) {}
      try { if (typeof loadPosePresetList === "function" && kind === "pose") loadPosePresetList(""); } catch (e) {}
      try { if (typeof loadMousePresets === "function" && kind === "mouse") loadMousePresets(); } catch (e) {}
      try { if (typeof loadMidiPresets === "function" && kind === "midi") loadMidiPresets(); } catch (e) {}
    })
    .catch(function () { setupFlash(_gl("Serwer nieosiągalny", "Server unreachable")); });
}


// ---- saving a preset from here -----------------------------------------------
// The library could load, download and delete a preset but not make one: for that you had to know
// which OTHER tab it came from. Saving lives next to the list now, and it takes the same payloads
// the two original bars take (state.rules / poseCfgObj), so a preset saved here is the same file.
function _rflSave(kind, name, msgEl) {
  const url = RFL_SAVE[kind];
  if (!url) return;
  let body;
  if (kind === "profile") {
    body = {name: name, rules: (typeof state !== "undefined" && state.rules) || []};
  } else if (kind === "mouse") {
    // Całe state.mouse — serwer i tak odcina to, co zostaje przy kapslu (MOUSE_PRESET_SKIP),
    // więc wysyłanie mniej znaczyłoby tylko dwie listy wykluczeń zamiast jednej.
    body = {name: name, config: (typeof state !== "undefined" && state.mouse) || {}};
  } else if (kind === "midi") {
    // Całe state.midi — serwer i tak odcina to, co zostaje przy kapslu (MIDI_PRESET_SKIP),
    // więc wysyłanie mniej znaczyłoby tylko dwie listy wykluczeń zamiast jednej.
    body = {name: name, config: (typeof state !== "undefined" && state.midi) || {}};
  } else if (kind === "rest") {
    // Cały config Usług — serwer i tak odcina to, co zostaje przy tym komputerze
    // (REST_PRESET_SKIP: przełącznik i adres OBS-a), więc wysyłanie mniej znaczyłoby dwie listy
    // wykluczeń zamiast jednej.
    body = {name: name, config: (window.RESTAPI && RESTAPI.cfg) || {}};
  } else {
    if (typeof poseCfgObj !== "function") return;
    body = {name: name, config: poseCfgObj()};
  }
  // ⚠️ ZAPIS POD ISTNIEJĄCĄ NAZWĄ MUSI ODDAĆ OPIS, KTÓRY TEN PLIK JUŻ MA. Serwer zapisuje `desc`
  // z ciała zapytania, więc wysłanie samej treści skasowałoby zdanie autora po cichu i bez śladu
  // w interfejsie — wiersz po prostu przestałby je pokazywać. Ta sama pułapka i to samo lekarstwo,
  // co w `overwrite` adapterów huba (rf-49b/c/d); tu opis bierzemy z listy, którą to okno i tak
  // ma już wczytaną. Osie 3D nie mają opisu, więc ich to nie dotyczy.
  try {
    const had = ((_rflData && _rflData[kind]) || []).find(function (it) {
      return String(it.name || "").toLowerCase() === String(name || "").trim().toLowerCase();
    });
    if (had && had.desc) body.desc = had.desc;
  } catch (e) { /* lista jeszcze nie wczytana — nowy plik i tak nie ma czego oddawać */ }
  const say = function (t, bad) {
    if (!msgEl) { setupFlash(t); return; }
    msgEl.textContent = t;
    msgEl.classList.toggle("bad", !!bad);
    clearTimeout(msgEl._t);
    msgEl._t = setTimeout(function () { msgEl.textContent = ""; msgEl.classList.remove("bad"); }, 3200);
  };
  fetch(url, {method: "POST", headers: {"Content-Type": "application/json"},
              body: JSON.stringify(body)})
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || !j.ok) { say((j && j.error) || _gl("Nie udało się zapisać", "Could not save"), true); return; }
      say(_gl("Zapisano „", "Saved “") + name + "”");
      rfLibReload();
      // The dropdowns in the other tabs list the same files — keep them honest, exactly as delete does.
      try { if (typeof loadProfileList === "function" && kind === "profile") loadProfileList(name); } catch (e) {}
      try { if (typeof loadPosePresetList === "function" && kind === "pose") loadPosePresetList(name); } catch (e) {}
      // …a hub konfiguracji w karcie Mysz rysuje kafle z tych samych plików i liczy z nich „zmienione".
      try { if (typeof loadMousePresets === "function" && kind === "mouse") loadMousePresets(); } catch (e) {}
      // …a huby w kartach MIDI i OSC rysują kafle z tych samych plików i liczą z nich „zmienione".
      try { if (typeof loadMidiPresets === "function" && kind === "midi") loadMidiPresets(); } catch (e) {}
    })
    .catch(function () { say(_gl("Serwer nieosiągalny", "Server unreachable"), true); });
}

function _rflRenderTools() {
  const ex = document.getElementById("libExplain");
  if (ex) {
    const t = RFL_EXPLAIN[_rflKind];
    ex.textContent = t ? _gl(t[0], t[1]) : "";
  }
  // A whole setup is saved with a name, a program, a description, an author and a revision — a row
  // far too wide to rebuild here, and it now lives in this very card (#setupSaveRow). So it is
  // SHOWN or HIDDEN with the drawer rather than pointed at: you cannot save a setup into the
  // drawer of trigger presets, and until now the only thing this spot could do was say so.
  const saveRow = document.getElementById("setupSaveRow");
  if (saveRow) saveRow.hidden = (_rflKind !== "setup");
  rfBundleRowSync();
  // „Auto-zestawy wg gry" (rf-39o) ma własną kartę w tej zakładce, obok Stopu awaryjnego i MCP —
  // to przełączniki CAŁEJ aplikacji, nie zawartość tej szuflady. Odświeżana stąd, bo pasek zapisu
  // i ta karta mówią o tym samym polu („gra.exe"), więc nie mogą się rozjechać.
  try { if (typeof rfGsRenderCard === "function") rfGsRenderCard(); } catch (e) {}
  const host = document.getElementById("libSave");
  if (!host) return;
  host.textContent = "";
  if (_rflKind === "setup") return;   // #libSave stays empty — the wide row below it says everything
  const lab = document.createElement("span"); lab.className = "setuplbl";
  // Etykieta per szuflada. Była ternarnym „wyzwalacze albo osie 3D", więc od czasu presetów myszy
  // szuflada profili myszy proponowała ZAPISAĆ OSIE 3D — zdanie nieprawdziwe akurat w miejscu,
  // w którym człowiek decyduje, co zapisuje. Mapa zamiast ternarnego: rodzaj bez wpisu dostaje
  // zdanie ogólne, a nie cudze.
  const _RFL_SAVE_LBL = {
    profile: ["Zapisz obecne wyzwalacze jako preset:", "Save the current triggers as a preset:"],
    pose: ["Zapisz obecne osie 3D jako preset:", "Save the current 3D axes as a preset:"],
    mouse: ["Zapisz obecne ustawienia ruchu jako preset:", "Save the current motion settings as a preset:"],
    midi: ["Zapisz obecny zestaw mapowań jako preset:", "Save the current mapping set as a preset:"],
    rest: ["Zapisz obecne akcje sieciowe jako preset:", "Save the current network actions as a preset:"]
  };
  const _lbl = _RFL_SAVE_LBL[_rflKind];
  lab.textContent = _lbl ? _gl(_lbl[0], _lbl[1])
                         : _gl("Zapisz obecne ustawienia jako preset:", "Save the current settings as a preset:");
  const inp = document.createElement("input");
  inp.type = "text"; inp.className = "lib-savename";
  inp.placeholder = _gl("nazwa presetu", "preset name");
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "btn sm primary";
  btn.textContent = _gl("Zapisz preset", "Save the preset");
  const msg = document.createElement("span"); msg.className = "setupmsg";
  msg.setAttribute("role", "status"); msg.setAttribute("aria-live", "polite");
  const go = async function () {
    const n = (inp.value || "").trim();
    if (!n) {
      msg.textContent = _gl("Podaj nazwę presetu", "Give the preset a name");
      msg.classList.add("bad");
      inp.focus();
      return;
    }
    // NADPISANIE JEST DECYZJĄ, jak przy zapisie zestawu (setupSave w rf-29). Lista tej szuflady
    // jest już w pamięci, więc kolizję widać bez pytania serwera; wielkość liter się nie liczy,
    // bo Windows nie rozróżnia jej w nazwach plików.
    const kind = _rflKind;
    const key = n.toLowerCase();
    const had = ((_rflData && _rflData[kind]) || []).find(function (it) {
      return String(it.name || "").trim().toLowerCase() === key;
    });
    if (had && typeof rfConfirm === "function") {
      const shown = String(had.name || n);
      const ok = await rfConfirm(
        had.official
          ? _gl("„" + shown + "” to preset wbudowany. Twoja wersja go zastąpi na liście; usuń ją, a wbudowany wróci.",
                "“" + shown + "” is a built-in preset. Your version replaces it in the list; delete yours and the built-in comes back.")
          : _gl("Preset o tej nazwie już jest w Bibliotece. Zapis go zastąpi, a starej wersji nie da się odzyskać.",
                "A preset with this name is already in the Library. Saving replaces it, and the old version cannot be recovered."),
        {title: _gl("Nadpisać preset „" + shown + "”?", "Overwrite the preset “" + shown + "”?"),
         icon: '<span class="bic bic-save" aria-hidden="true"></span>',
         tone: had.official ? "" : "danger",
         confirmLabel: had.official ? _gl("Zastąp na liście", "Replace in the list") : _gl("Nadpisz", "Overwrite"),
         cancelLabel: _gl("Anuluj", "Cancel")});
      if (!ok) { inp.focus(); return; }
    }
    _rflSave(kind, n, msg);
    inp.value = "";
  };
  btn.addEventListener("click", go);
  inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
  host.appendChild(lab); host.appendChild(inp); host.appendChild(btn); host.appendChild(msg);
}

// Two capsules or more is the ONLY situation in which a multi-capsule set means anything, so the
// door to it appears exactly then and says how many it would carry. Counted the way the exchange
// window counts (rf-39l `_pdcCaps`), and defensively: `state` may not be populated on first paint.
function rfBundleRowSync() {
  const row = document.getElementById("bundleRow");
  if (!row) return;
  let n = 0;
  try { n = Object.keys((typeof state !== "undefined" && state.devices) || {}).length; } catch (e) { n = 0; }
  row.hidden = (n < 2 || _rflKind !== "setup");
  const tx = document.getElementById("bundleRowTxt");
  if (!tx) return;
  // "2 kapsle" but "5 kapsli" — the last-digit rule, same as _rflRules above.
  const t = n % 10, h = n % 100;
  const pl = (t >= 2 && t <= 4 && (h < 12 || h > 14)) ? "kapsle" : "kapsli";
  tx.textContent = _gl(
    "Masz " + n + " " + pl + ". Zestaw na kilka kapsli zapisze wszystkie naraz, z rolami.",
    "You have " + n + " capsules. A multi-capsule set saves them all at once, with roles.");
}

// FILTR MODUŁÓW — chipy z ikoną. Nazwa stoi tylko na chipie WYBRANYM, reszta ma ją w podpowiedzi
// i w etykiecie dla czytnika ekranu: pełne nazwy wszystkich rodzajów zajmowały w kolumnie 288 px
// trzy linijki i spychały listę pod krawędź ekranu. Liczba zostaje przy każdym, bo to ona mówi,
// czy w tej szufladzie w ogóle coś jest.
function _rflCounts() {
  document.querySelectorAll(".lib-kind").forEach(function (b) {
    // ⚠️ `|| ""` jest tu konieczne: chip „Wszystko" NIE MA atrybutu `data-kind`, więc
    // `getAttribute` zwraca `null`, a `null === ""` jest fałszem — bez tego chip domyślnie
    // wybrany nigdy nie dostawał swojej nazwy ani stanu „wciśnięty".
    const k = b.getAttribute("data-kind") || "";
    const on = (k === _rflPick);
    const n = (!k) ? _rflTotal() : ((_rflData && _rflData[k]) ? _rflData[k].length : 0);
    const c = b.querySelector("i");
    if (c) c.textContent = n;
    const name = k ? _rflModLabel(k) : _gl("Wszystko", "Everything");
    const lab = b.querySelector(".lib-kind-lab");
    if (lab) { lab.textContent = on ? name : ""; }
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.title = name + " (" + n + ")";
    b.setAttribute("aria-label", name + " (" + n + ")");
    b.hidden = !!k && n === 0 && !on;
  });
}
function _rflTotal() {
  if (!_rflData) return 0;
  let n = 0;
  RFL_KINDS.forEach(function (x) { n += (_rflData[x.k] || []).length; });
  return n;
}

// Zaznaczenie przeniesione przez przeładowanie strony (patrz `_rflLoad`). Wchodzi tylko wtedy, gdy
// pozycja NAPRAWDĘ jest jeszcze na liście — inaczej podświetlałaby wiersz, którego nie ma.
function _rflRestoreSel() {
  let s = null;
  try {
    s = JSON.parse(localStorage.getItem("ribbitflip.lib.sel") || "null");
    localStorage.removeItem("ribbitflip.lib.sel");
  } catch (e) { }
  if (!s || !s.kind || !s.name || _rflSel) return;
  const arr = (_rflData && _rflData[s.kind]) || [];
  if (!arr.some(function (x) { return x.name === s.name; })) return;
  if (typeof rfLibSelect === "function") rfLibSelect(s.kind, s.name, true);
}
function rfLibReload() {
  return fetch("/library").then(function (r) { return r.json(); })
    .then(function (res) {
      _rflData = (res && res.ok) ? res : {setup: [], profile: [], pose: [], mouse: []};
      // Podpowiedź kasety w pasku zapisu liczy się z tej listy (rf-28e): nazwa istniejącego zestawu
      // pokazuje jego kasetę, nowa nazwa dostaje kasetę najrzadziej używaną.
      try { if (typeof rfKasetaPoBibliotece === "function") rfKasetaPoBibliotece(_rflData); } catch (e) {}
      _rflCounts();
      rfLibRender();
      _rflRestoreSel();
    })
    .catch(function () {
      _rflData = {setup: [], profile: [], pose: [], mouse: []};
      _rflCounts();
      rfLibRender();
    });
}

function _rflChip(kind) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "lib-kind";
  if (kind) b.setAttribute("data-kind", kind);
  const name = kind ? _rflModLabel(kind) : _gl("Wszystko", "Everything");
  if (kind) b.appendChild(_rflModIcon(kind));
  const lab = document.createElement("span"); lab.className = "lib-kind-lab";
  lab.setAttribute("data-noi18n", "");     // etykieta składana z żywej nawigacji, walker jej nie tłumaczy
  lab.textContent = kind ? "" : name;
  b.appendChild(lab);
  const i = document.createElement("i"); i.textContent = "0";
  b.appendChild(i);
  b.title = name;
  b.setAttribute("aria-label", name);
  b.addEventListener("click", function () {
    _rflPick = kind;
    // NARZĘDZIA pod listą (opis rodzaju i zapis nowego) idą za filtrem. Przy „Wszystko" pokazują
    // zestaw: to jedyna rzecz w tej zakładce, która nie należy do żadnego pojedynczego modułu,
    // a jej pasek zapisu mieszka właśnie tutaj i nigdzie indziej.
    _rflKind = kind || "setup";
    _rflCounts();
    _rflRenderTools();
    rfLibRender();
  });
  return b;
}

function initLibrary() {
  const sw = document.getElementById("libKinds");
  if (!sw) return;
  sw.textContent = "";
  sw.appendChild(_rflChip(""));
  RFL_KINDS.forEach(function (x) { sw.appendChild(_rflChip(x.k)); });
  _rflRenderTools();
  rfBundleRowSync();
  const q = document.getElementById("libFind");
  if (q) {
    q.addEventListener("input", function () {
      _rflFilter = (q.value || "").trim();
      rfLibRender();
    });
  }
  // STRZAŁKI PO LIŚCIE i OD RAZU opis obok — dokładnie jak w liście presetów modułu (rf-49j),
  // bo to ten sam kształt i ta sama obietnica: lista i szczegóły stoją obok siebie, więc nie ma
  // czego potwierdzać Enterem.
  const host = document.getElementById("libList");
  if (host) {
    host.setAttribute("role", "listbox");
    host.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const rows = [].slice.call(host.querySelectorAll(".lib-row"));
      const i = rows.indexOf(document.activeElement);
      if (i < 0) return;
      const n = rows[i + (e.key === "ArrowDown" ? 1 : -1)];
      if (!n) return;
      e.preventDefault();
      rfLibSelect(n.dataset.kind, n.dataset.name);
    });
  }
  // `/` wchodzi do wyszukiwarki, gdy Biblioteka jest otwarta. Pojedyncza litera, więc pole
  // tekstowe ma pierwszeństwo — inaczej nie dałoby się wpisać ukośnika w żadną nazwę.
  window.addEventListener("keydown", function (e) {
    if (e.key !== "/" || e.ctrlKey || e.altKey || e.metaKey) return;
    const a = document.activeElement;
    if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
    const panel = document.getElementById("tab-konfiguracje");
    if (!panel || !panel.classList.contains("active") || !q) return;
    e.preventDefault(); q.focus(); q.select();
  });
  // ŻADNEJ STOPKI POD LISTĄ (usunięta 2026-09-02). Stały tu dwa przyciski, które nie robiły nic
  // własnego: każdy z nich wołał `.click()` na kafelku karty „Wymiana z innymi" stojącej DWADZIEŚCIA
  // CENTYMETRÓW WYŻEJ, w tej samej zakładce i na tym samym ekranie. To nie było drugie wejście, tylko
  // to samo wejście narysowane drugi raz — a „Wymiana" obok „Podziel się" mówiła dwa różne słowa na
  // jedną czynność. Zniknął razem z nimi także sam element #libFoot w markupie — pusty pojemnik ze
  // swoim `padding` zostawiłby pod listą pasek powietrza po czymś, czego już nie ma.
  rfLibReload();
}

// Everything in this card is composed with _gl() at render time, so the walker that translates the
// page on a language switch cannot put it back: a node rendered in English has no Polish original
// to restore. Re-rendering is the fix, and it is what the other _gl()-composed panels do too
// (miRelang, poseRelang, hkRelang) — setLang calls this the same way.
function rfLibRelang() {
  _rflRenderTools();
  _rflCounts();
  rfLibRender();
}

window.rfLibReload = rfLibReload;
window.rfLibRelang = rfLibRelang;
// Called from the device selector too (rf-11): pairing a second capsule is what makes a
// multi-capsule set possible, and the row has to notice without a tab switch.
window.rfBundleRowSync = rfBundleRowSync;
// The share wizard downloads a preset through this: writing the chosen file WITHOUT loading it over
// the author's own configuration is exactly what this already does, and reimplementing it there
// would be a second copy of the same fetch with its own bugs.
window.rfLibDownload = _rflDownload;
