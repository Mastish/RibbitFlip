"use strict";
// ============================================================================
//  SYNTEZATOR: stan po stronie APLIKACJI, nie po stronie przeglądarki
//
//  Silnik dźwięku (WebAudio, rf-21..rf-25) i cały model padów zostają tam, gdzie były — w tej
//  karcie. Zmienia się JEDNO: gdzie leży odpowiedź na pytanie „co ten syntezator gra". Do dziś
//  leżała wyłącznie w localStorage, czyli w jednej przeglądarce na jednym profilu. Skutki widać
//  było dopiero wtedy, kiedy było już za późno: drugie okno w innej przeglądarce zastawało pusty
//  syntezator, wyczyszczenie danych strony kasowało brzmienia bezpowrotnie, a kopia katalogu
//  Settings/ — jedyna kopia, którą ktokolwiek robi — nie niosła ich wcale.
//
//  Od teraz źródłem prawdy jest `Settings/ribbitflip_synth.json`, a localStorage zostaje jako
//  PODRĘCZNA KOPIA: czytana natychmiast (żeby pętla dźwięku nie zastała pustego modelu przez te
//  kilka milisekund, które trwa pytanie do serwera) i jako ratunek, gdy serwera nie ma.
//
//  TRZY RZECZY, KTÓRE ŁATWO TU ZEPSUĆ, A KAŻDA PSUJE SIĘ PO CICHU:
//
//  1. ZAPISUJE TYLKO ZWYKŁY PANEL. Ta sama strona chodzi w trzech rolach: panel, okno nakładki
//     (`?overlay=1`) i ściąga w osobnym oknie (`?view=overview`). Wszystkie trzy uruchamiają
//     `initPad`, więc wszystkie trzy potrafiłyby wysłać zapis — a dwa okna piszące naraz to jedno
//     okno nadpisujące drugie. Nakładka ma na to własną, mocniejszą blokadę (rf-41 odmawia KAŻDEGO
//     żądania innego niż odczyt), ściąga nie ma żadnej, więc bramka stoi tutaj i obejmuje obie.
//
//  2. DWA ZWYKŁE PANELE NARAZ = OSTATNI PISZĄCY WYGRYWA. Świadomie: synchronizacja dwóch okien
//     edytujących ten sam syntezator to osobna funkcja (kto wygrywa, co z niezapisanymi zmianami,
//     co pokazać drugiemu oknu), a nie efekt uboczny zapisu do pliku. Tak samo działa dziś każda
//     inna konfiguracja w tej aplikacji.
//
//  3. `padSave()` WOŁA SIĘ PRZY KAŻDYM RUCHU SUWAKA. Stąd debounce i pilnowanie, żeby dwa zapisy
//     nie leciały równolegle — bez tego seria dotknięć pokrętła to seria żądań, które mogą dojść
//     w innej kolejności, niż wyszły, i plik dostaje stan sprzed ostatniej zmiany.
//
//  Po rf-20 (padState/padApplyState/padLoad), przed rf-23 (initPad woła `padLoadAsync`).
// ============================================================================

const SYNTH_SAVE_DEBOUNCE_MS = 800;   // tyle po ostatnim ruchu suwaka; krócej = seria żądań
const SYNTH_KEEPALIVE_MAX = 60000;   // zapas pod limitem 64 KiB na wszystkie żądania keepalive

// Czy TO okno ma prawo zapisywać (patrz punkt 1 w nagłówku). Adres czytamy sami, zamiast pożyczyć
// `RF_OVL` (rf-41) i `IS_OVERVIEW` (rf-05): ten plik ładuje się przed rf-41, więc odwołanie do
// tamtej stałej w chwili wczytywania byłoby sięgnięciem do jeszcze martwej nazwy. Źródło prawdy
// jest zresztą to samo — adres okna.
function synthMirrorAllowed() {
  try { return !/[?&](overlay=1|view=overview)/.test(location.search || ""); }
  catch (e) { return false; }
}

// Kopia w przeglądarce. Osobno od `padSave()`, bo przy wczytaniu z serwera odświeżamy WYŁĄCZNIE
// kopię — wysłanie tego z powrotem byłoby echem stanu, który dopiero co stamtąd przyszedł.
function _synthCacheWrite() {
  try { localStorage.setItem("ribbitflip.pad", JSON.stringify(padState())); } catch (e) {}
}
function _synthCacheRaw() {
  try { return localStorage.getItem("ribbitflip.pad") || ""; } catch (e) { return ""; }
}

let _synthTimer = null;      // odliczanie debounce
let _synthInflight = false;  // zapis w drodze — drugi czeka, nie leci obok
let _synthPending = false;   // …i po powrocie tamtego ma polecieć jeszcze raz (trailing flush)

function _synthPost(url, body, opts) {
  const o = opts || {};
  const init = { method: "POST", headers: { "Content-Type": "application/json" },
                 body: JSON.stringify(body || {}) };
  // `keepalive` = „dowieź to nawet, jeśli strona właśnie znika". Potrzebne w dwóch miejscach:
  // przy zamykaniu karty i przy imporcie zestawu, który zaraz po zapisie odświeża stronę.
  // Fetch odrzuca żądanie z `keepalive`, gdy treść ma ponad 64 KiB, a błąd ginął w `.catch`:
  // duży stan Syntha (wiele własnych brzmień) nie docierał wtedy wcale. Powyżej progu idzie
  // zwykłe żądanie, a wołający, który zaraz przeładuje stronę, czeka na nie (padAdoptState).
  if (o.keepalive && _synthBytes(init.body) < SYNTH_KEEPALIVE_MAX) init.keepalive = true;
  return fetch(url, init).then(function (r) { return r.json(); });
}
function _synthBytes(s) {
  try { return new TextEncoder().encode(s).length; } catch (e) { return String(s || "").length * 3; }
}

// JEDEN ZAPIS STANU. Wywoływane przez `padSave()` (rf-20) po każdej zmianie w syntezatorze.
function _synthSendNow(opts) {
  if (!synthMirrorAllowed()) return;
  if (_synthInflight && !(opts || {}).keepalive) { _synthPending = true; return; }
  _synthInflight = true;
  _synthPost("/synth", { state: padState() }, opts)
    .catch(function () { /* serwer nieosiągalny — kopia w przeglądarce i tak jest zapisana */ })
    .then(function () {
      _synthInflight = false;
      if (_synthPending) { _synthPending = false; _synthSendNow(); }
    });
}

// Kolejka z debounce. NIE zapisuje od razu: „przesuń suwak głośności" to kilkadziesiąt wywołań
// `padSave()` w sekundę, a plik ustawień ma dostać stan, na którym palec się zatrzymał.
function padStoreQueue() {
  if (!synthMirrorAllowed()) return;
  if (_synthTimer) clearTimeout(_synthTimer);
  _synthTimer = setTimeout(function () { _synthTimer = null; _synthSendNow(); }, SYNTH_SAVE_DEBOUNCE_MS);
}

// Dowieź to, co czeka w kolejce. Zamknięcie karty w środku odliczania debounce'u gubiłoby ostatnią
// zmianę — a to jest dokładnie ta zmiana, którą człowiek właśnie zrobił i zapamiętał.
function padStoreFlush() {
  if (!_synthTimer) return;
  clearTimeout(_synthTimer); _synthTimer = null;
  _synthSendNow({ keepalive: true });
}
try { window.addEventListener("pagehide", padStoreFlush); } catch (e) { /* harness bez okna */ }

// STAN Z ZEWNĄTRZ (import zestawu, cofnięcie importu, wczytanie z biblioteki). Wszystkie te drogi
// zapisywały dotąd samo localStorage i odświeżały stronę — po przeniesieniu źródła prawdy na
// serwer odświeżenie wczytałoby STARY stan z pliku i import syntezatora przepadłby bez słowa.
// `keepalive`, bo odświeżenie jest tuż za tym wywołaniem.
//
// DWIE BRAMKI, zanim cokolwiek się zapisze:
//   • stan BEZ ANI JEDNEGO PADA nie jest syntezatorem, tylko śladem zapisu z karty, w której Synth
//     nie był wczytany (edycja Essential, moduł wyłączony przy starcie). Takie pliki już istnieją,
//     a przyjęcie ich kasuje pady i własne brzmienia, więc są odrzucane bez słowa: zestaw wchodzi,
//     Synth zostaje, jaki był. Stary płaski stan (v2, jeden pad bez tablicy) przechodzi, jak
//     w `padApplyState`.
//   • PLIK NIE WŁĄCZA WYJŚĆ (ta sama zasada, co `apply_setup` po stronie serwera i scena w rf-49g):
//     `enabled` z pliku jest zastępowane bieżącym stanem przełącznika. Nie usuwane, bo stan bez
//     `enabled` po przeładowaniu zostawiłby przełącznik w położeniu domyślnym, czyli wyłączył
//     Synth komuś, kto go miał włączonego.
function _padEnabledNow() {
  try { if (XPAD._loaded) return !!XPAD.enabled; } catch (e) {}
  try { const c = JSON.parse(_synthCacheRaw() || "null"); if (c && typeof c.enabled === "boolean") return c.enabled; }
  catch (e) {}
  return false;   // nieznany = wyłączony: włącza człowiek, nie plik
}
// Zwraca obietnicę, która zawsze się spełnia (także po błędzie i najpóźniej po 5 s): wołający
// czeka na nią przed `location.reload()`, bo duży stan leci bez `keepalive` (patrz _synthPost).
function padAdoptState(blob) {
  if (!blob || typeof blob !== "object") return Promise.resolve();
  if (!padBlobHasPads(blob)) return Promise.resolve();
  blob = Object.assign({}, blob, { enabled: _padEnabledNow() });
  try { localStorage.setItem("ribbitflip.pad", JSON.stringify(blob)); } catch (e) {}
  if (!synthMirrorAllowed()) return Promise.resolve();
  if (_synthTimer) { clearTimeout(_synthTimer); _synthTimer = null; }   // stary stan już nieaktualny
  const sent = _synthPost("/synth", { state: blob }, { keepalive: true }).catch(function () {});
  return Promise.race([sent, new Promise(function (res) { setTimeout(res, 5000); })]);
}

// WCZYTANIE PRZY STARCIE. Kolejność jest tu treścią, nie szczegółem:
//   1. podręczna kopia OD RAZU i synchronicznie — żeby nic (pętla dźwięku, rysowanie kart) nie
//      zastało syntezatora bez ani jednego pada,
//   2. serwer ma stan  → on wygrywa i odświeżamy nim kopię,
//   3. serwer pusty, a kopia coś ma → to jest pierwsze uruchomienie po tej zmianie: wypychamy
//      kopię na serwer JEDEN raz (migracja) i od tej pory prawda jest tam,
//   4. oba puste → domyślny syntezator, bez zapisu (pusty plik ustawień to nie jest stan, który
//      warto utrwalać; utrwali się przy pierwszej zmianie).
// `done` woła się DOKŁADNIE RAZ, także gdy serwera nie ma — inaczej zakładka Synth nigdy by się
// nie narysowała.
function padLoadAsync(done) {
  // Wołane spoza pętli bootu, więc jej `try/catch` już tego nie łapie — a błąd połknięty w ciszy
  // znaczyłby zakładkę Synth, która po prostu jest pusta i nic o tym nie mówi.
  const fin = function () {
    // Pasek scen mógł się już zamontować (boot woła `initSynthCfgBar` zaraz po `initPad`, a stan
    // przyjeżdża później) — i wtedy pokazuje nazwę sprzed wczytania, czyli pustą. Jedno odświeżenie
    // tutaj jest tańsze niż pasek, który mówi „bez nazwy" o scenie, którą właśnie wczytał.
    try { if (typeof synthScenesSync === "function") synthScenesSync(); } catch (e) {}
    try { if (typeof done === "function") done(); }
    catch (e) { try { console.error("[RibbitFlip] Synth: rysowanie zakładki nie wykonało się:", e); } catch (_) {} }
  };
  const hadLocal = !!_synthCacheRaw();
  padLoad();                                   // krok 1 — podłoga z przeglądarki
  let f = null;
  try { f = fetch("/synth"); } catch (e) { f = null; }
  if (!f) { fin(); return; }
  f.then(function (r) { return r.json(); })
    .then(function (j) {
      const srv = (j && j.state && typeof j.state === "object") ? j.state : null;
      if (srv) {                                // krok 2 — serwer jest źródłem prawdy
        padApplyState(srv);
        _synthCacheWrite();
      } else if (hadLocal && synthMirrorAllowed()) {
        _synthSendNow();                        // krok 3 — migracja, jeden raz
      }
      fin();
    })
    .catch(function () { fin(); });             // brak serwera: zostaje to, co wczytała kopia
}
