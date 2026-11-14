"use strict";
// ============================================================================
//  SYNTEZATOR: nazwane SCENY — „Ambient pad", „Perkusja dwóch kapsli"
//
//  Adapter wspólnego komponentu tożsamości (rf-49-cfgid.js) dla całej zakładki Synth. Pady grające
//  są bytami od dawna: każdy ma własne brzmienie, własne osie każdego kapsla, własną bramkę
//  i własne efekty. Brakowało piętra wyżej — nazwy dla CAŁEGO SYNTEZATORA. „Ambient pad" to jeden
//  pad z długim ogonem i wibratem; „Perkusja dwóch kapsli" to dwa pady, dwa kapsle i bramka
//  rytmiczna. Dziś przejście między nimi znaczy: przestaw brzmienie, zakres, skalę, warunki bramki
//  i przypisania kapsli, dla każdego pada osobno — kilkanaście minut i za każdym razem trochę
//  inaczej.
//
//  DRUGI ADAPTER, W KTÓRYM NOŚNIKIEM NAZWY NIE JEST KAPSEL (po układach okien, rf-49f). Syntezator
//  jest JEDEN na aplikację: te same pady grają ze wszystkich kapsli naraz, a każdy pad ma w sobie
//  mapę „który kapsel steruje mną i przez które osie". Przypisanie tej nazwy do któregokolwiek
//  kapsla byłoby kłamstwem, więc — jak przy nakładkach:
//    • nazwa mieszka na wierzchu stanu syntezatora (`XPAD.configName`), nie w konfiguracji kapsla,
//    • pasek jest JEDEN, pod nagłówkiem karty „Pady grające",
//    • „Skopiuj na…" NIE ISTNIEJE — nie ma drugiego kapsla, na który można by skopiować
//      syntezator (komponent chowa tę listę sam, gdy adapter nie ma `copyTo`).
//
//  SCENA NIE NIESIE PRZEŁĄCZNIKA. Ta sama zasada, co „konfiguracja nie niesie przełączników"
//  (apply_setup, MOUSE_PRESET_SKIP) i „układ nie niesie `open`" (rf-49f): scena mówi, JAK
//  syntezator gra, a nie CZY wolno mu zabrzmieć. Wczytanie „Perkusji" ma przestawić pady, a nie
//  zagrać komuś w słuchawkach w środku rozmowy. Gdyby `enabled` weszło do odcisku, samo włączenie
//  padów zapalałoby „zmienione" — ostrzeżenie, które świeci zawsze i którego nikt po tygodniu nie
//  czyta (patrz dwie zasady w nagłówku rf-49).
//
//  MAPY KAPSLI JADĄ W SCENIE — i to jest różnica wobec profilu myszy, która pomija wszystko, co
//  jest „decyzją o tym kapslu przy tym biurku". Powód jest w danych, nie w zasadzie: mapa `dev`
//  pada mówi, PRZEZ KTÓRE OSIE kapsel prowadzi TEN instrument, czyli jest częścią brzmienia, a nie
//  ustawieniem sprzętu. Precedens jest zresztą starszy od tej zmiany: sekcja `pad` w zestawie
//  niesie te mapy od zawsze (rf-28, `env.pad = padState()`), więc scena, która by ich nie niosła,
//  zapamiętywałaby MNIEJ niż plik, który każdy może sobie wyeksportować.
//
//  Po rf-20b (lustro stanu na serwerze), rf-24/rf-25 (rysowanie kart padów i brzmień) i rf-49.
// ============================================================================

const RF_SYNTHSC_I18N = {
  "Scena:": "Scene:",
  "Wybierz scenę syntezatora": "Choose a scene for the synth",
  "Utwórz scenę": "Create a scene",   // przycisk bloku stanu (words.createBtn) — siatka bezpieczeństwa dla walkera
  "szukaj sceny…": "search scenes…",           // words.libSearch, words.libSaveAs (Biblioteka)
  "+ Zapisz jako scenę…": "+ Save as a scene…",
};
try { Object.assign(I18N_EN, RF_SYNTHSC_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

state.synthScenes = [];    // [{name, state}] — lustro rejestru z serwera
state.synthSceneMax = 32;  // sufit z serwera (SYNTH_SCENE_MAX); nie zgadujemy go tutaj

// ------------------------------------------------------------------------------------------
//  CZEGO SCENA NIE NIESIE
// ------------------------------------------------------------------------------------------
// Dwa pierwsze pola są wycinane i z ZAPISU, i z ODCISKU; trzecie tylko z odcisku:
//   • `enabled`    — uzbrojenie dźwięku, patrz nagłówek. Zapisane, wczytanie sceny zapalałoby pady.
//   • `configName` — nazwa stoi NA WIERZCHU tego, co opisuje. Zapisana w scenie, każda scena
//                    wczytana pod inną nazwą byłaby „zmieniona" od pierwszej sekundy.
//   • `_v`         — numer formatu PLIKU, nie treść brzmienia. Zostaje w zapisanej scenie (żeby
//                    `padApplyState` umiał ją zmigrować), ale wypada z odcisku: bez tego dzień,
//                    w którym format skoczy na 6, zapali „zmienione" na wszystkich scenach naraz,
//                    choć ani jeden dźwięk się nie zmieni.
const SYNTH_SCENE_DROP = ["enabled", "configName"];
const SYNTH_FP_DROP = SYNTH_SCENE_DROP.concat(["_v"]);

// ------------------------------------------------------------------------------------------
//  ODCISK — dokładnie to, co scena niesie
// ------------------------------------------------------------------------------------------
// Stan syntezatora to zagnieżdżone drzewo (pady → mapy kapsli → warunki bramki → parametry
// brzmienia), więc odcisk liczy się REKURENCYJNIE, a nie z płaskiej listy pól jak w rf-49c. Dwie
// rzeczy robi inaczej niż `JSON.stringify`, i obie są tu konieczne:
//
//   1. KLUCZE SŁOWNIKÓW SORTOWANE. `customSounds`, `baseOverrides` i mapy `dev` są słownikami,
//      a kolejność kluczy w nich to przypadek historii (kto kiedy dodał brzmienie), nie treść.
//      Bez sortowania te same brzmienia dawałyby dwa różne odciski.
//   2. LICZBY PRZEZ toFixed(3). Suwak potrafi oddać 0.07 i 0.07000000000000001, a to jest ta sama
//      jasność — bez tego dotknięcie suwaka i powrót na miejsce zapalałoby „zmienione".
//
// Tekst zostaje tekstem (bez zamiany „12" na 12.000, którą robi rf-49c dla configu myszy): tam
// wszystkie pola są pokrętłami, tutaj tekstem bywa NAZWA PADA, a pad nazwany „1" i pad nazwany
// „1.0" muszą się różnić.
function _synthFp(v) {
  if (v === null || v === undefined) return "~";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(3) : "~";
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(_synthFp).join(",") + "]";
  if (typeof v !== "object") return JSON.stringify(String(v));
  return "{" + Object.keys(v).sort().map(function (k) {
    return JSON.stringify(k) + ":" + _synthFp(v[k]);
  }).join(",") + "}";
}
// Kopia bez wyliczonych pól. Robiona na PŁYTKIEJ kopii wierzchu, bo tylko tam te pola stoją —
// i nigdy na oryginale, który jest albo żywym stanem, albo rekordem z serwera.
function _synthStrip(state, keys) {
  const out = {};
  Object.keys(state || {}).forEach(function (k) { if (keys.indexOf(k) < 0) out[k] = state[k]; });
  return out;
}
function synthSceneFingerprint(state) {
  return _synthFp(_synthStrip(state, SYNTH_FP_DROP));
}
// TO, CO ZAPISUJEMY POD NAZWĄ: cały stan syntezatora bez przełącznika i bez własnej nazwy.
function synthSceneState() {
  return _synthStrip(padState(), SYNTH_SCENE_DROP);
}

// ------------------------------------------------------------------------------------------
//  CO TA SCENA ROBI — zdanie do okien z pytaniem o zgodę
// ------------------------------------------------------------------------------------------
// Odmiana po polsku: te zdania są liczone („1 pad", „2 pady", „5 padów") i stoją w oknie, które
// czyta się dokładnie w chwili podejmowania decyzji, więc muszą brzmieć jak zdanie, a nie wydruk.
function _synthPl(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (n === 1) return one;
  if (b >= 2 && b <= 4 && (a < 10 || a >= 20)) return few;
  return many;
}
function _synthCount(o, key) {
  const v = (o || {})[key];
  if (Array.isArray(v)) return v.length;
  return (v && typeof v === "object") ? Object.keys(v).length : 0;
}
function _synthDescribe(state) {
  const s = state || {};
  const bits = [];
  const pads = _synthCount(s, "pads");
  if (pads) bits.push(pads + " " + _synthPl(pads, _gl("pad grający", "play pad"),
                                                  _gl("pady grające", "play pads"),
                                                  _gl("padów grających", "play pads")));
  const snd = _synthCount(s, "customSounds");
  if (snd) bits.push(snd + " " + _synthPl(snd, _gl("własne brzmienie", "custom sound"),
                                               _gl("własne brzmienia", "custom sounds"),
                                               _gl("własnych brzmień", "custom sounds")));
  const ov = _synthCount(s, "baseOverrides");
  if (ov) bits.push(ov + " " + _synthPl(ov, _gl("przerobione brzmienie wbudowane", "edited built-in sound"),
                                            _gl("przerobione brzmienia wbudowane", "edited built-in sounds"),
                                            _gl("przerobionych brzmień wbudowanych", "edited built-in sounds")));
  const sq = _synthCount(s, "seqPads");
  if (sq) bits.push(sq + " " + _synthPl(sq, _gl("pad zaprogramowany", "programmed pad"),
                                            _gl("pady zaprogramowane", "programmed pads"),
                                            _gl("padów zaprogramowanych", "programmed pads")));
  const fx = _synthCount(s, "fxPads");
  if (fx) bits.push(fx + " " + _synthPl(fx, _gl("pad efektów", "effects pad"),
                                            _gl("pady efektów", "effects pads"),
                                            _gl("padów efektów", "effects pads")));
  return bits.length ? bits.join(", ") : _gl("pusty syntezator", "an empty synth");
}

// ------------------------------------------------------------------------------------------
//  ROZMOWA Z SERWEREM
// ------------------------------------------------------------------------------------------
function _synthScPost(url, body, done) {
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
function _synthScAbsorb(j) {
  if (!j) return;
  if (Array.isArray(j.scenes)) state.synthScenes = j.scenes;
  if (j.max) state.synthSceneMax = +j.max || state.synthSceneMax;
  synthScenesSync();
}
// LISTA SCEN — jeden pobór dla paska. Treść, nie same nazwy: „zmienione" to porównanie dwóch
// stron (patrz `fingerprintPreset`).
function loadSynthScenes(done) {
  return fetch("/synth-scenes").then(function (r) { return r.json(); })
    .then(function (j) {
      state.synthScenes = (j && Array.isArray(j.scenes)) ? j.scenes : [];
      if (j && j.max) state.synthSceneMax = +j.max || state.synthSceneMax;
      synthScenesSync();
      if (typeof done === "function") done();
    })
    .catch(function () { if (typeof done === "function") done(); });
}

// PO WYMIANIE CAŁEGO STANU trzeba narysować zakładkę od nowa: karty padów trzymają wartości
// w polach formularza, a te po `padApplyState` opisują pady, których już nie ma. Kolejność:
// najpierw ucisz to, co gra (stare pady mają własne szyny dźwięku i zostałyby wiszącym dźwiękiem),
// potem rysuj.
function _synthRerenderAll() {
  try { if (typeof killAllAudio === "function") killAllAudio(); } catch (e) {}
  // Edytor brzmień zamykamy, zanim cokolwiek narysujemy. Stał otwarty na brzmieniu z POPRZEDNIEJ
  // sceny — czyli na czymś, czego w bibliotece może już nie być — a „Zapisz" w tym stanie wskrzesiłby
  // usunięte brzmienie pod nazwą, której nikt w tej scenie nie widział. `cancelEdit` rysuje przy
  // okazji listę brzmień, więc osobne `renderSoundList` jest wtedy zbędne.
  let listDone = false;
  try { if (typeof cancelEdit === "function") { cancelEdit(); listDone = true; } } catch (e) {}
  try { if (!listDone && typeof renderSoundList === "function") renderSoundList(); } catch (e) {}
  try { if (typeof renderPlayPads === "function") renderPlayPads(); } catch (e) {}
  try { if (typeof renderSeqPads === "function") renderSeqPads(); } catch (e) {}
  try { if (typeof renderFxPads === "function") renderFxPads(); } catch (e) {}
  try { if (typeof padReflect === "function") padReflect(); } catch (e) {}
}

// ------------------------------------------------------------------------------------------
//  ADAPTER
// ------------------------------------------------------------------------------------------
const SYNTH_SCENE_ADAPTER = {
  idPrefix: "synth",
  // Napisy paska — „Konfiguracja:" i „…dla tego kapsla" byłyby tu nieprawdą: nazwa opisuje
  // syntezator całej aplikacji, nie kapsel.
  barLabel: "Scena:",
  pickTitle: "Wybierz scenę syntezatora",
  // Zdania okien z pytaniem o zgodę mówią o SYNTEZATORZE, nie o kapslu, i o SCENIE, nie
  // o konfiguracji. Bez tej podmiany „Kapsel od razu zacznie nosić tę nazwę" byłoby tu zwyczajnie
  // nieprawdą — a te okna czyta się dokładnie w chwili, w której podejmuje się decyzję.
  words: {
    onIt: ["w syntezatorze", "in the synth"],
    onThis: ["w syntezatorze", "in the synth"],   // „Zmiany zrobione W SYNTEZATORZE przepadną."
    thisOne: ["syntezator", "the synth"],         // „To, co SYNTEZATOR ma teraz (…)"
    takes: ["Syntezator od razu zacznie nosić tę nazwę.",
            "The synth starts carrying that name right away."],
    remembers: ["Scena zapamiętuje ", "The scene remembers "],
    carries: ["Syntezator gra teraz scenę: ", "The synth now plays the scene: "],
    gone: ["tej sceny nie ma już na liście", "this scene is no longer on the list"],
    askOverwrite: ["Nadpisać scenę „", "Overwrite the scene “"],
    overwriteTip: ["Nadpisz scenę „", "Overwrite the scene “"],
    askLoadTitle: ["Wczytać scenę „", "Load the scene “"],
    saveAsTitle: ["Zapisz jako nową scenę", "Save as a new scene"],
    saveAsBtn: ["Zapisz scenę", "Save the scene"],
    // Przycisk pod zdaniem „Zapisz go jako scenę" (noName) — ten sam rzeczownik, co to zdanie.
    createBtn: ["Utwórz scenę", "Create a scene"],
    // Biblioteka (rf-49j2 `paintFoot`): pole szukania i przycisk w stopce listy.
    libSearch: ["szukaj sceny…", "search scenes…"],
    libSaveAs: ["+ Zapisz jako scenę…", "+ Save as a scene…"],
    saved: ["Zapisano scenę: ", "Scene saved: "],
    // Trzy zdania panelu opisu w zakładce „Biblioteka" (rf-49j3). Syntezator jest jeden na
    // aplikację, więc „nosi ją kapsel, który edytujesz" i „wczytaj go na kapsel" byłyby tu
    // nieprawdą — nie ma kapsla, który by scenę nosił.
    inUse: ["Ta scena jest teraz włączona.", "This scene is in use right now."],
    toEdit: ["Żeby ją przerobić, najpierw ją wczytaj.", "To rework it, load it first."],
    loadHere: ["Wczytaj scenę", "Load the scene"],
    noName: ["Ten układ padów i brzmień nie ma jeszcze nazwy. Zapisz go jako scenę, a wrócisz do niego jednym kliknięciem.",
             "This layout of pads and sounds has no name yet. Save it as a scene and you can come back to it in one click."],
  },
  // Pusto, bo nazwa nie wisi na żadnym kapslu — syntezator jest jeden na aplikację. Komponent nie
  // woła tego nigdzie poza kopiowaniem („Skopiuj na…"), którego ten adapter nie ma.
  getDev: function () { return ""; },
  devName: function (dev) {
    const D = ((typeof state !== "undefined" && state.devices) || {})[dev];
    const m = (D && D.meta) || {};
    return m.name || m.label || dev;
  },
  // PUSTA LISTA CELÓW = komponent chowa „Skopiuj na…" w całości. To nie jest brak funkcji, tylko
  // brak sensu: syntezator jest jeden, więc nie ma dokąd go kopiować.
  listOtherDevs: function () { return []; },
  getCfgName: function () { return String((typeof XPAD !== "undefined" && XPAD.configName) || ""); },
  setCfgName: function (name, done) {
    // Nazwa jedzie tą samą drogą, co każda inna zmiana w syntezatorze — w lustrze stanu (rf-20b).
    // Osobny endpoint byłby drugim miejscem, w którym zapisuje się to samo pole. Zdjęcie nazwy nie
    // rusza ani jednego pada: znaczy „to już nie jest ta scena", a nie „wycisz mi syntezator".
    XPAD.configName = String(name || "");
    padSave();
    if (typeof done === "function") done();
  },
  fingerprintCurrent: function () { return synthSceneFingerprint(padState()); },
  fingerprintPreset: function (p) {
    // `null` = nie da się porównać (rekord bez treści, starszy serwer). Pasek wtedy MILCZY —
    // patrz komentarz przy `st()` w rf-49.
    return (p && p.state && typeof p.state === "object") ? synthSceneFingerprint(p.state) : null;
  },
  listPresets: function () { return state.synthScenes || []; },
  // ODŚWIEŻENIE LISTY Z SERWERA. Do 2026-08-31 nie było tu tej metody i nie było potrzebne: sceny
  // zapisywał wyłącznie ten adapter, a `_synthScAbsorb` wchłaniał odpowiedź od razu. Od chwili,
  // w której scena wchodzi także z PLIKU (rf-29d importuje ją wprost do `/synth-scene/save`),
  // lista musi umieć się przeładować na żądanie — inaczej świeżo wczytana scena nie pokazałaby
  // się w module do najbliższego odświeżenia strony.
  reloadPresets: function () { loadSynthScenes(); },
  findPreset: function (name) {
    const k = rfCfgIdKey(name);
    if (!k) return null;
    return (state.synthScenes || []).find(function (p) {
      return rfCfgIdKey(p.name) === k;
    }) || null;
  },
  // TREŚĆ WYSYŁA KLIENT, a nie serwer zdejmuje ją z lustra: lustro bywa o debounce w tyle (stan
  // leci tam ~0,8 s po ostatnim ruchu suwaka), więc scena zapisana z lustra byłaby sceną sprzed
  // ostatniej zmiany. Zapisany ma być syntezator, jaki JEST w chwili kliknięcia.
  saveAs: function (name, done) {
    _synthScPost("/synth-scene/save", { name: name, state: synthSceneState() }, function (err, j) {
      if (err) return done(err);
      _synthScAbsorb(j);
      done(null);
    });
  },
  // Zapis i nadpisanie to ta sama prośba z inną nazwą — jedna migawka i jedna walidacja koperty,
  // więc „Zapisz jako…" i „Zapisz zmiany" nie mogą się rozjechać.
  overwrite: function (name, done) { return SYNTH_SCENE_ADAPTER.saveAs(name, done); },
  // WCZYTANIE JEST CZYSTO LOKALNE — nie ma endpointu „wczytaj scenę" i nie jest potrzebny.
  // Treść sceny przyjechała już z GET /synth-scenes, a jedynym, co trzeba zrobić, jest wpuszczenie
  // jej w model przeglądarki (tam mieszka silnik dźwięku). Serwer dowiaduje się o tym tak samo,
  // jak o każdej innej zmianie w syntezatorze: przez lustro stanu z `padSave()`.
  applyPreset: function (p, done) {
    try {
      padApplyState(p.state);          // scena nie niesie `enabled` → przełącznik zostaje, jaki był
      XPAD.configName = String(p.name || "");
      padSave();
      _synthRerenderAll();
    } catch (e) {
      return done(_gl("Nie udało się wczytać tej sceny.", "Could not load this scene."));
    }
    done(null);
  },
  describeCurrent: function () { return _synthDescribe(padState()); },
  describePreset: function (p) { return _synthDescribe(p && p.state); },
  describeKeeps: function () {
    return _gl("Przełącznik padów zostaje bez zmian: scena mówi, jak syntezator gra, a nie czy "
               + "wolno mu zabrzmieć. Przypisania kapsli do padów jadą razem ze sceną, bo to one "
               + "decydują, przez które osie kapsel prowadzi dany instrument.",
               "The pads switch stays as it is: a scene says how the synth plays, not whether it "
               + "may sound. The capsule-to-pad assignments travel with the scene, because they "
               + "are what decides which axes a capsule steers an instrument through.");
  }
};

let _synthScBar = null;

// ------------------------------------------------------------------------------------------
//  PODPIĘCIE
// ------------------------------------------------------------------------------------------
// Pasek stoi POD nagłówkiem karty „Pady grające", czyli nad samymi padami i nad biblioteką
// brzmień — odpowiada na pytanie zadane w nagłówku: skoro to jest syntezator, to jak ten zestaw
// brzmień się nazywa i czy jest jeszcze taki, jak zapisany. Niżej przeczytałby go tylko ktoś, kto
// zjechał przez wszystkie karty padów.
//
// NIE MA GO W OKNIE NAKŁADKI ANI W ŚCIĄDZE (`?overlay=1`, `?view=overview`). Te okna uruchamiają
// ten sam kod, ale nie mają prawa zapisywać stanu syntezatora (patrz punkt 1 w nagłówku rf-20b),
// więc pasek z trzema przyciskami zapisu byłby tam obietnicą bez pokrycia. `synthMirrorAllowed`
// jest jedną odpowiedzią na oba pytania — kto zapisuje i kto pokazuje przyciski zapisu.
function initSynthCfgBar() {
  if (typeof synthMirrorAllowed === "function" && !synthMirrorAllowed()) return;
  const sec = document.getElementById("padSec");
  if (!sec || document.getElementById("synthCfgBar")) return;
  const head = sec.querySelector(".pad-sec-h");
  if (!head) return;
  _synthScBar = rfCfgIdCreate(SYNTH_SCENE_ADAPTER);
  head.insertAdjacentHTML("afterend", _synthScBar.barHtml());
  _synthScBar.wire();
  loadSynthScenes();
}

// Jedno wejście dla wszystkich, którzy zmieniają stan syntezatora: woła to `padLoadAsync` po
// wczytaniu stanu z serwera (rf-20b) i każda operacja na scenach. Tanie: `sync` porównuje HTML
// przed podmianą, więc nie zabiera ogniska z listy, na której ktoś właśnie stoi.
function synthScenesSync() {
  if (_synthScBar) _synthScBar.sync();
}

// ------------------------------------------------------------------------------------------
//  LINIA GOTOWOŚCI SYNTHA (F-G4-01, wspólny komponent rfReady z rf-28c)
// ------------------------------------------------------------------------------------------
// Żeby kapsel zagrał, musi się zgadzać kilka rzeczy naraz: moduł włączony, dźwięk odblokowany
// w przeglądarce (kontekst audio budzi się tylko po kliknięciu, więc po przeładowaniu panelu
// z włączonym Synthem ruch kapsla dawał ciszę bez słowa), co najmniej jeden pad grający z ruchu
// i połączony kapsel. Sterowanie „Uzbrojone” nie dotyczy Syntha (gra w przeglądarce), więc tego
// wiersza tu nie ma. Zamknięta bramka to stan zamierzony, nie brak: wiersz informacyjny.
// W pod-zakładce Brzmienia linii nie ma: to edytor z własnym odsłuchem (klik w „Testuj” sam
// odblokowuje dźwięk), a dwa rzędy linii zabrałyby miejsce liście brzmień i tarczy.
(function () {
  if (typeof window === "undefined" || !window.rfReady) return;
  function pads() { return (typeof XPAD !== "undefined" && XPAD.pads) || []; }
  rfReady.register({
    id: "rfReadySynth",
    anchor: function () { return rfReady.headOf("pad"); },
    empty: function () { const se = document.getElementById("soundEditor"); return !!(se && se.offsetParent); },
    allOk: ["Synth gra. Rusz kapslem albo przeciągnij palcem po padzie.",
            "Synth is playing. Move the capsule or drag across the pad."],
    rows: function () {
      const on = typeof XPAD !== "undefined" && !!XPAD.enabled;
      const ctx = typeof PadAudio !== "undefined" ? PadAudio.ctx : null;
      const rows = [{ok: on, pl: "Synth włączony", en: "Synth is on",
        fix: {pl: "Włącz Synth", en: "Turn Synth on", click: "#padEnable"}}];
      rows.push({ok: !!(ctx && ctx.state === "running"), pl: "Przeglądarka pozwala grać dźwięk", en: "The browser allows sound",
        fix: {pl: "Odblokuj dźwięk", en: "Unlock sound", run: function () { if (typeof PadAudio !== "undefined") PadAudio.resume(); }},
        steps: [["Przeglądarka wpuszcza dźwięk dopiero po kliknięciu na stronie. Jedno kliknięcie wystarczy do końca sesji.",
                 "The browser lets sound through only after a click on the page. One click lasts for the whole session."]]});
      const first = pads()[0];
      rows.push({ok: pads().some(function (p) { return p.motion; }),
        pl: "Kapsel gra na co najmniej jednym padzie", en: "A capsule plays at least one pad",
        fix: {pl: "Włącz na " + (first ? first.name : "padzie"), en: "Turn on for " + (first ? first.name : "the pad"),
          run: function () { if (!first) return; first.motion = true; if (typeof PadAudio !== "undefined") PadAudio.resume();
            if (typeof reflectPlayPads === "function") reflectPlayPads(); if (typeof padSave === "function") padSave(); }}});
      const shut = on && typeof _gateActive === "function"
        ? pads().find(function (p) { return p.motion && _gateActive(p.gate) && p._gateOpen === false; }) : null;
      if (shut) rows.push({ok: false, info: true,
        pl: "Pad „" + shut.name + "” czeka na swój warunek („Kiedy pad gra”)",
        en: "The pad “" + shut.name + "” is waiting for its condition (“When the pad plays”)"});
      rows.push(rfReady.capsuleRow());
      return rows;
    }
  });
})();
