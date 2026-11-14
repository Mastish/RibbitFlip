"use strict";
// ============================================================================
//  NAKŁADKI: nazwane UKŁADY OKIEN — „Stream", „Trening"
//
//  Adapter wspólnego komponentu tożsamości (rf-49-cfgid.js) dla całego zestawu okien nakładek.
//  Okna są bytami od dnia, w którym kapsel dostał ich kilka: każde ma własne miejsce, rozmiar,
//  wygląd i zawartość. Brakowało piętra wyżej — nazwy dla CAŁEGO EKRANU. „Stream" to nakładka dla
//  widzów plus dwa małe okienka z boku; „Trening" to jedna wielka ściąga. Dziś przejście między
//  nimi znaczy: przeciągnij, zmień rozmiar, przełącz motyw, powtórz dla każdego okna — kilka minut
//  za każdym razem i za każdym razem trochę inaczej.
//
//  PIERWSZY ADAPTER, W KTÓRYM NOŚNIKIEM NAZWY NIE JEST KAPSEL. Wyzwalacze, mysz, MIDI i koło
//  opisują JEDEN kapsel, więc ich nazwa wisi przy kapslu i pasek stoi w jego karcie. Układ okien
//  jest o EKRANIE: „Stream" to rozstawienie okien wszystkich kapsli naraz i przypisanie go do
//  któregokolwiek z nich byłoby kłamstwem. Stąd trzy różnice wobec sąsiednich adapterów:
//    • nazwa mieszka na wierzchu pliku nakładek (`layoutName`), nie w konfiguracji kapsla,
//    • pasek jest JEDEN, w karcie „Wszystkie urządzenia — ściąga", obok przycisków nakładek,
//    • „Skopiuj na…" NIE ISTNIEJE — nie ma drugiego kapsla, na który można by skopiować ekran
//      (komponent chowa tę listę sam, gdy adapter nie ma `copyTo`).
//
//  UKŁAD NIE NIESIE `open`. Ta sama zasada, co „konfiguracja nie niesie przełączników": układ mówi,
//  JAK okna wyglądają i GDZIE stoją, a nie CZY są na ekranie. Wczytanie „Treningu" ma przestawić
//  okna, a nie zapalić komuś nakładkę nad grą w środku meczu. Odcisk liczy dokładnie to, co układ
//  niesie — ani jednego pola więcej (patrz dwie zasady w nagłówku rf-49).
//
//  OKNA KOŁA (`d0~kolo`) SĄ POZA UKŁADAMI: nie mają miejsca na ekranie (chodzą za kursorem),
//  włącza się je w karcie „Koło wyboru" i serwer celowo pomija je we wszystkich listach okien.
//  Wciągnięcie ich tutaj zrobiłoby drugie miejsce, w którym ustawia się to samo okno.
//
//  Po rf-41 (OVL.state, ovlGet/ovlPost, ovlPanelSync) — z niego czyta stan i przez niego pisze.
//  Montowanie czeka na initTabs: karta #overviewCard powstaje dopiero tam (patrz rf-40-boot).
// ============================================================================

const RF_OVLLAY_I18N = {
  "Układ:": "Layout:",
  "Wybierz układ okien nakładek": "Choose a layout for the overlay windows",
};
try { Object.assign(I18N_EN, RF_OVLLAY_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

state.overlayLayouts = [];     // [{name, windows:{wid:cfg}}] — lustro rejestru z serwera
state.overlayLayoutMax = 24;   // sufit z serwera (OVERLAY_LAYOUT_MAX); nie zgadujemy go tutaj

// ------------------------------------------------------------------------------------------
//  ODCISK — dokładnie to, co układ niesie
// ------------------------------------------------------------------------------------------
// Lustro `sanitize_overlay_layout` z serwera. Brakuje tu JEDNEGO pola configu okna i to jest cała
// treść tej listy: `open`. Gdyby weszło, każde otwarcie i zamknięcie nakładki zapalałoby
// „zmienione" — czyli ostrzeżenie, które świeci zawsze i którego nikt po tygodniu nie czyta.
const OVL_LAY_FIELDS = [
  "x", "y",                         // miejsce na ekranie — esencja układu
  "w", "h", "opacity", "scale",     // rozmiar i widoczność
  "theme", "outline",               // wygląd
  "clickThrough", "onTop", "followCursor",
  // PASEK OKNA należy do układu z tego samego powodu, co „przepuszczaj kliknięcia": „Stream" to
  // okna bez paska, ustawione raz i oddane widzom, a „Trening" to okna, które się przesuwa ręką
  // w trakcie. Bez tego pola wczytanie układu zostawiałoby paski takie, jakie akurat były.
  "winBar",
  "label",                          // nazwa okna: „Stream" ma inne podpisy niż „Trening"
  "hideScale",
];
const OVL_LAY_BOOLS = ["clickThrough", "onTop", "followCursor", "hideScale", "winBar"];
const OVL_LAY_TEXTS = ["theme", "outline", "label"];

// Liczba jako tekst. Wszystkie liczby w configu okna są CAŁKOWITE (serwer je zaokrągla w
// `_sanitize_overlay_win`), więc toFixed(0) — bez tego 400 z pliku i 400.0 z formularza byłyby
// dwiema różnymi wartościami. `null` w x/y znaczy „jeszcze nigdzie nie postawione" i NIE jest zerem:
// zero to lewy górny róg pierwszego monitora, a to zupełnie inna odpowiedź.
function _ovlLayNum(v) {
  if (v === undefined || v === null || v === "") return "";
  const n = +v;
  return isNaN(n) ? String(v) : n.toFixed(0);
}
// Klucze podsłownika (`show`, `scaleParts`) bierzemy z DOMYŚLNYCH USTAWIEŃ, które przysyła serwer —
// tak jak rf-49c bierze swoje z MOUSE_KEYS. To ta sama lista, przez którą przechodzą obie strony
// porównania, więc pole dołożone w przyszłości pojawi się w obu naraz. Bez odpowiedzi serwera
// (harness, pierwszy rysunek) liczymy z samego słownika: obie strony i tak są kompletne, bo obie
// przeszły przez `_sanitize_overlay_win`.
function _ovlLaySubKeys(name, o) {
  const d = ((typeof OVL !== "undefined" && OVL.state) || {}).defaults;
  const src = (d && typeof d[name] === "object" && d[name]) ? d[name] : (o || {});
  return Object.keys(src).sort();
}
function overlayLayoutWinFingerprint(cfg) {
  const o = cfg || {};
  const parts = OVL_LAY_FIELDS.map(function (k) {
    if (OVL_LAY_TEXTS.indexOf(k) >= 0) return (o[k] === undefined || o[k] === null) ? "" : String(o[k]);
    if (OVL_LAY_BOOLS.indexOf(k) >= 0) return o[k] ? "1" : "0";
    return _ovlLayNum(o[k]);
  });
  const sh = (o.show && typeof o.show === "object") ? o.show : {};
  const sp = (o.scaleParts && typeof o.scaleParts === "object") ? o.scaleParts : {};
  parts.push(_ovlLaySubKeys("show", sh).map(function (k) { return k + ":" + (sh[k] ? "1" : "0"); }).join(","));
  parts.push(_ovlLaySubKeys("scaleParts", sp).map(function (k) { return k + ":" + _ovlLayNum(sp[k]); }).join(","));
  return parts.join("|");
}
// Cały układ. Id okien SORTOWANE, bo kolejność kluczy w słowniku jest przypadkiem historii (kto
// kiedy dodał okno), a nie treścią układu — bez sortowania te same okna dawałyby dwa różne odciski.
function overlayLayoutFingerprint(windows) {
  const w = (windows && typeof windows === "object") ? windows : {};
  return Object.keys(w).sort()
    .map(function (wid) { return wid + "=" + overlayLayoutWinFingerprint(w[wid]); })
    .join("\n");
}

// ------------------------------------------------------------------------------------------
//  BIEŻĄCY EKRAN
// ------------------------------------------------------------------------------------------
// Okno koła po id. Serwer i tak nie przysyła ich w `state().windows`, ale odcisk jest liczony
// z tego, co przyszło — a obrona przed cudzym błędem jest tańsza niż nadzieja, że go nie będzie.
const OVL_LAY_WHEEL_SUFFIX = "~kolo";
function _ovlLayIsWheel(wid) { return String(wid || "").slice(-OVL_LAY_WHEEL_SUFFIX.length) === OVL_LAY_WHEEL_SUFFIX; }
function _ovlLayState() { return (typeof OVL !== "undefined" && OVL.state) ? OVL.state : null; }
// {wid: cfg} okien, które stoją TERAZ. `null` = jeszcze nie wiemy (panel nie dostał odpowiedzi) —
// wtedy pasek milczy, zamiast twierdzić cokolwiek o czymś, czego nie widział.
function overlayLayoutCurrent() {
  const s = _ovlLayState();
  if (!s || !s.windows || typeof s.windows !== "object") return null;
  const out = {};
  Object.keys(s.windows).forEach(function (wid) {
    if (_ovlLayIsWheel(wid)) return;
    const c = (s.windows[wid] || {}).config;
    if (c) out[wid] = c;
  });
  return out;
}
function _ovlLayDevOf(wid) { return String(wid || "").split("~")[0]; }
function _ovlLayDevName(dev) {
  const D = ((typeof state !== "undefined" && state.devices) || {})[dev];
  const m = (D && D.meta) || {};
  return m.name || m.label || dev;
}
function _ovlLayDevsOf(windows) {
  const seen = [];
  Object.keys(windows || {}).forEach(function (wid) {
    const d = _ovlLayDevOf(wid);
    if (seen.indexOf(d) < 0) seen.push(d);
  });
  return seen;
}
// Odmiana po polsku — te zdania są liczone („1 okno", „2 okna", „5 okien") i stoją w oknie
// z pytaniem o zgodę, więc muszą brzmieć jak zdanie, a nie jak wydruk.
function _ovlLayPl(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (n === 1) return one;
  if (b >= 2 && b <= 4 && (a < 10 || a >= 20)) return few;
  return many;
}
function _ovlLayWins(n) { return n + " " + _ovlLayPl(n, _gl("okno", "window"), _gl("okna", "windows"), _gl("okien", "windows")); }
function _ovlLayCaps(n) { return n + " " + _ovlLayPl(n, _gl("kapslu", "capsule"), _gl("kapslach", "capsules"), _gl("kapslach", "capsules")); }
function _ovlLaySize(windows) {
  const w = windows || {};
  return _ovlLayWins(Object.keys(w).length) + " " + _gl("na", "on") + " " + _ovlLayCaps(_ovlLayDevsOf(w).length);
}

// ------------------------------------------------------------------------------------------
//  ROZMOWA Z SERWEREM
// ------------------------------------------------------------------------------------------
function _ovlLayPost(url, body, done) {
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
               body: JSON.stringify(body || {}) })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || j.ok === false || j.error) {
        return done((j && j.error) || _gl("Serwer odmówił zapisu.", "The server refused the save."), null);
      }
      done(null, j);
    })
    .catch(function () { done(_gl("Nie udało się porozmawiać z aplikacją.", "Could not reach the application."), null); });
}
// KAŻDA odpowiedź o układach niesie i listę układów, i świeży stan nakładek. Oba są tu wchłaniane
// od razu, bo nakładki nie mają zdarzenia w strumieniu — panel pyta o nie sam, co 4 s (rf-41),
// a czekanie tyle na przyciski, które właśnie zniknęły albo powstały, wygląda na zawieszenie.
function _ovlLayAbsorb(j) {
  if (!j) return;
  if (Array.isArray(j.items)) state.overlayLayouts = j.items;
  if (j.max) state.overlayLayoutMax = +j.max || state.overlayLayoutMax;
  if (j.windows && typeof ovlPanelSync === "function") {
    try { ovlPanelSync(j); return; } catch (e) { /* panel jeszcze nie stoi */ }
  }
  ovlLayoutSync();
}
// LISTA UKŁADÓW — jeden pobór dla paska. Treść, nie same nazwy: „zmienione" to porównanie dwóch
// stron (patrz `fingerprintPreset`).
function loadOverlayLayouts(done) {
  return fetch("/overlay-layouts").then(function (r) { return r.json(); })
    .then(function (j) {
      state.overlayLayouts = (j && Array.isArray(j.items)) ? j.items : [];
      if (j && j.max) state.overlayLayoutMax = +j.max || state.overlayLayoutMax;
      ovlLayoutSync();
      if (typeof done === "function") done();
    })
    .catch(function () { if (typeof done === "function") done(); });
}

// ------------------------------------------------------------------------------------------
//  ADAPTER
// ------------------------------------------------------------------------------------------
const OVL_LAYOUT_ADAPTER = {
  idPrefix: "ovlay",
  // Napisy paska — jedyne dwa, które ten adapter nadpisuje. „Konfiguracja:" i „…dla tego kapsla"
  // byłyby tu nieprawdą: nazwa opisuje ekran, nie kapsel.
  barLabel: "Układ:",
  pickTitle: "Wybierz układ okien nakładek",
  // Zdania okien z pytaniem o zgodę mówią o EKRANIE, nie o kapslu, i o UKŁADZIE, nie o
  // konfiguracji. Bez tej podmiany „Kapsel od razu zacznie nosić tę nazwę" byłoby tu zwyczajnie
  // nieprawdą — a te okna czyta się dokładnie w chwili, w której podejmuje się decyzję.
  words: {
    onIt: ["na ekranie", "on screen"],
    onThis: ["na ekranie", "on screen"],       // „Zmiany zrobione NA EKRANIE przepadną."
    thisOne: ["ekran", "the screen"],          // „To, co EKRAN ma teraz (…)" — czasownik jest w szablonie
    takes: ["Okna od razu zaczną nosić tę nazwę.",
            "The windows start carrying that name right away."],
    remembers: ["Układ zapamiętuje ", "The layout remembers "],
    carries: ["Okna noszą teraz układ: ", "The windows now carry the layout: "],
    gone: ["tego układu nie ma już na liście", "this layout is no longer on the list"],
    askOverwrite: ["Nadpisać układ „", "Overwrite the layout “"],
    overwriteTip: ["Nadpisz układ „", "Overwrite the layout “"],
    askLoadTitle: ["Wczytać układ „", "Load the layout “"],
    saveAsTitle: ["Zapisz jako nowy układ", "Save as a new layout"],
    saveAsBtn: ["Zapisz układ", "Save the layout"],
    createBtn: ["Utwórz układ", "Create a layout"],   // na zapas: układów nie ma dziś w ramce modułu rf-49j
    saved: ["Zapisano układ: ", "Layout saved: "],
  },
  // Pusto, bo nazwa nie wisi na żadnym kapslu. Komponent nie woła tego nigdzie poza kopiowaniem
  // („Skopiuj na…"), którego ten adapter nie ma.
  getDev: function () { return ""; },
  devName: _ovlLayDevName,
  // PUSTA LISTA CELÓW = komponent chowa „Skopiuj na…" w całości. To nie jest brak funkcji, tylko
  // brak sensu: ekran jest jeden, więc nie ma dokąd go kopiować.
  listOtherDevs: function () { return []; },
  // Nazwa układu jest wspólna dla wszystkich okien, więc argument `dev` (którym komponent pyta
  // „kto jeszcze to nosi") jest tu bez znaczenia — i tak nigdy nie przychodzi, bo lista celów
  // jest pusta.
  getCfgName: function () { return String((_ovlLayState() || {}).layoutName || ""); },
  setCfgName: function (name, done) {
    // SAM PODPIS, osobną akcją POST /overlay — nie przez „config", który należy do JEDNEGO okna.
    // Zdjęcie nazwy nie rusza ani jednego okna: znaczy „to już nie jest ten układ", a nie
    // „posprzątaj mi ekran".
    ovlPost({ act: "layoutName", name: String(name || "") }).then(function (j) {
      if (!j || j.ok === false) {
        rfToast(_gl("Nie udało się zapisać nazwy układu.", "Could not save the layout name."), { tone: "danger" });
      } else {
        _ovlLayAbsorb(j);
      }
      if (typeof done === "function") done();
    });
  },
  // `null` = nie da się porównać (jeszcze nie wiemy, co stoi na ekranie, albo starszy serwer
  // przysłał same nazwy). Pasek wtedy MILCZY — patrz komentarz przy `st()` w rf-49.
  fingerprintCurrent: function () {
    const cur = overlayLayoutCurrent();
    return cur ? overlayLayoutFingerprint(cur) : null;
  },
  fingerprintPreset: function (p) {
    if (!p || !p.windows || typeof p.windows !== "object") return null;
    // Bieżącego ekranu nie znamy -> nie ma z czym porównywać. Mówimy „nie wiem", zamiast
    // ogłaszać „zmienione" o czymś, czego nie widzieliśmy.
    if (overlayLayoutCurrent() === null) return null;
    return overlayLayoutFingerprint(p.windows);
  },
  listPresets: function () { return state.overlayLayouts || []; },
  findPreset: function (name) {
    const k = rfCfgIdKey(name);
    if (!k) return null;
    return (state.overlayLayouts || []).find(function (p) {
      return rfCfgIdKey(p.name) === k;
    }) || null;
  },
  // MIGAWKĘ ROBI SERWER — panel wysyła samą nazwę. Panel rysuje z tego, co dostał ostatnim
  // odpytaniem (co 4 s), a przez ten czas okno mogło się przesunąć z zasobnika albo z własnej
  // szuflady. Zapisany ma być ekran, jaki JEST.
  saveAs: function (name, done) {
    _ovlLayPost("/overlay-layout/save", { name: name }, function (err, j) {
      if (err) return done(err);
      _ovlLayAbsorb(j);
      done(null);
    });
  },
  // Zapis i nadpisanie to ta sama prośba z inną nazwą — jedna migawka i jedna sanityzacja, więc
  // „Zapisz jako…" i „Zapisz zmiany" nie mogą się rozjechać.
  overwrite: function (name, done) { return OVL_LAYOUT_ADAPTER.saveAs(name, done); },
  applyPreset: function (p, done) {
    _ovlLayPost("/overlay-layout/apply", { name: p.name }, function (err, j) {
      if (err) return done(err);
      _ovlLayAbsorb(j);
      // Kapsle z układu, których teraz nie ma. Ciche pominięcie połowy układu czyta się jak
      // sukces i nim nie jest — więc mówimy o tym osobnym zdaniem, obok „Wczytano: …".
      const sk = (j && Array.isArray(j.skipped)) ? j.skipped : [];
      if (sk.length) {
        rfToast(_gl("Pominięto kapsle, których teraz nie ma: ", "Skipped capsules that are not here now: ")
                + sk.map(_ovlLayDevName).join(", "), { ms: 6000 });
      }
      done(null);
    });
  },
  // Co ten układ ROBI, w jednym kawałku zdania („…zostanie zastąpione (3 okna na 2 kapslach…)").
  describeCurrent: function () {
    const cur = overlayLayoutCurrent();
    return cur ? _ovlLaySize(cur) : _gl("okna nakładek", "the overlay windows");
  },
  // …a przy wczytywaniu to samo PLUS różnica: ile okien powstanie, ile zniknie, ile się
  // przestawi. Bez tego „wczytaj układ" jest skokiem w ciemno — a to jest jedyne działanie w tej
  // sekcji, które potrafi USUNĄĆ okno razem z jego miejscem i ustawieniami.
  describePreset: function (p) {
    const want = (p && p.windows) || {};
    const cur = overlayLayoutCurrent();
    let txt = _ovlLaySize(want);
    if (!cur) return txt;
    const devs = _ovlLayDevsOf(want);
    let made = 0, gone = 0, moved = 0;
    Object.keys(want).forEach(function (wid) {
      if (!cur[wid]) { made++; return; }
      if (overlayLayoutWinFingerprint(cur[wid]) !== overlayLayoutWinFingerprint(want[wid])) moved++;
    });
    Object.keys(cur).forEach(function (wid) {
      // Tylko kapsle, o których układ COŚ mówi: kapsel spoza układu zostaje nietknięty.
      if (!want[wid] && devs.indexOf(_ovlLayDevOf(wid)) >= 0) gone++;
    });
    const bits = [];
    if (made) bits.push(_ovlLayWins(made) + " " + _gl("do utworzenia", "to create"));
    if (gone) bits.push(_ovlLayWins(gone) + " " + _gl("do usunięcia", "to remove"));
    if (moved) bits.push(_ovlLayWins(moved) + " " + _gl("do przestawienia", "to rearrange"));
    if (bits.length) txt += ": " + bits.join(", ");
    // Kapsle z układu, których teraz nie ma. Powiedziane PRZED kliknięciem, nie po nim.
    const away = devs.filter(function (d) {
      return !((typeof state !== "undefined" && state.devices) || {})[d];
    });
    if (away.length) {
      txt += ". " + _gl("Kapsle, których teraz nie ma, zostaną pominięte: ",
                        "Capsules that are not here now will be skipped: ")
             + away.map(_ovlLayDevName).join(", ");
    }
    return txt;
  },
  describeKeeps: function () {
    return _gl("Okna nie otworzą się same: układ mówi, jak wyglądają i gdzie stoją, a nie czy są "
               + "na ekranie. Kapsle spoza układu i okno koła przy kursorze zostają bez zmian.",
               "The windows will not open by themselves: a layout says how they look and where they "
               + "stand, not whether they are on screen. Capsules outside the layout and the "
               + "wheel-at-the-cursor window stay as they are.");
  }
};

let _ovlLayBar = null;

// ------------------------------------------------------------------------------------------
//  PODPIĘCIE
// ------------------------------------------------------------------------------------------
// Pasek stoi POD nagłówkiem karty „Nakładki nad grą" (rf-41b), czyli dokładnie tam, gdzie są
// przyciski nakładek, lista okien i edytor każdego z nich: to jedyne miejsce w panelu, w którym
// widać wszystkie okna naraz, a układ jest właśnie o wszystkich naraz. (Do 2026-08-31 wisiał pod
// nagłówkiem ściągi — bo tam wtedy stały przyciski nakładek; przeniósł się razem z nimi.)
// W oknie samej nakładki go NIE MA — tam ta karta też istnieje, ale okno nakładki jest tylko do
// czytania (rf-41 blokuje mu każdy zapis), więc pasek z czterema przyciskami zapisu byłby tam
// obietnicą bez pokrycia.
function initOvlLayoutBar() {
  if (typeof RF_OVL !== "undefined" && RF_OVL) return;
  // Karta zarządzania, a gdyby jej nie było (starszy układ, wyłączony ekran) — ściąga, tak jak
  // przed 2026-08-31. Pasek bez własnej karty milczałby zupełnie, a nazwa układu jest jedyną
  // rzeczą, która w ogóle mówi, co teraz stoi na ekranie.
  const card = document.getElementById("ovmCard") || document.getElementById("overviewCard");
  if (!card || document.getElementById("ovlayCfgBar")) return;
  const head = card.querySelector(".head");
  if (!head) return;
  _ovlLayBar = rfCfgIdCreate(OVL_LAYOUT_ADAPTER);
  // Pod linijką o pełnym ekranie (rf-41b), jeśli jest: ona dotyczy paska okien w nagłówku.
  const fs = card.querySelector(":scope > .ovm-fsnote");
  (fs || head).insertAdjacentHTML("afterend", _ovlLayBar.barHtml());
  _ovlLayBar.wire();
  loadOverlayLayouts();
}

// Jedno wejście dla wszystkich, którzy zmieniają stan nakładek: rf-41 woła to z `ovlPanelSync`,
// czyli po KAŻDEJ odpowiedzi serwera o nakładkach — po odpytaniu co 4 s, po przełączniku, po
// dodaniu i usunięciu okna, po zmianie ustawień z szuflady. Tanie: sync porównuje HTML przed
// podmianą.
function ovlLayoutSync() {
  if (_ovlLayBar) _ovlLayBar.sync();
}
