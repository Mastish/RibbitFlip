// WSPÓLNY PRZEBIEG HEADLESS PO PANELU.
//
// Uruchomienie (git-bash, z katalogu repo):
//   NODE_PATH="$(npm root -g)" node tests/ux_walk_harness.cjs [url] [--baseline] [--shots DIR] [--iter N]
//     url        — instancja panelu, domyślnie http://127.0.0.1:8813/ (symulacja, kapsel „Triki 1”)
//     --baseline — zapisz linię bazową polskich węzłów w EN do tests/ux_walk_baseline.json i NIE
//                  uruchamiaj asercji iteracji (używane RAZ przed iteracją 1; potem plik aktualizuje
//                  się tylko W DÓŁ, ręcznie, po każdej iteracji)
//     --shots    — katalog na zrzuty pełnostronicowe (domyślnie C:/tmp/rf_walk)
//     --iter N   — uruchom asercje tylko iteracji 1..N (domyślnie wszystkie zarejestrowane)
//
// Wymaga: działającej instancji panelu i globalnego @playwright/test (NODE_PATH). NIE jest wpięty
// w zestaw testów py (tests/test_*.py), bo potrzebuje żywej instancji — to samodzielny skrypt.
// Kod wyjścia: 0 = wszystko PASS, 1 = przynajmniej jeden FAIL, 2 = instancja niedostępna.
//
// Co robi: w PL i EN przechodzi 13 ekranów nawigacji + Przegląd, klika pod-zakładki modułów
// (Konfiguracja / Biblioteka / Informacje), rozwija <details>, zbiera console.error / pageerror,
// w EN liczy widoczne węzły tekstowe z polskimi diakrytykami w #rfMain poza [data-noi18n]
// (próg = linia bazowa z tests/ux_walk_baseline.json), a potem uruchamia asercje kolejnych
// iteracji (checksIter1, checksIter2, … — każda iteracja dopisuje swoją funkcję i rejestruje ją
// w ITERS; iteracja 1 jest w trzech funkcjach: checksIter1 = 1.1–1.5, checksIter1b = 1.6–1.10,
// checksIter1c = 1.11–1.14, każda wołana z końca poprzedniej; iteracja 2: checksIter2 = 2.1–2.5,
// checksIter2b = 2.6–2.10 (wołana z końca checksIter2), checksIter2c = 2.11–2.13 (wołana z końca
// checksIter2b; 2.13 przechodzi 13 ekranów jeszcze raz i liczy węzły z cudzysłowami: PL bez „X",
// EN bez „ i bez ” sierocego; iteracja 3: checksIter3 = 3.1–3.3, checksIter3b = 3.4–3.5 (wołana z
// końca checksIter3) — mierzą KOLOR I ROZMIAR, nie treść: wspólne `contrastAll(page,sel)` liczy
// kontrast WCAG wobec pierwszego nieprzezroczystego tła przodka (rozumie też `color(srgb …)`, którym
// Chromium zwraca color-mix), `checkInk` sprawdza jeden selektor, `measureTx` szerokość i liczbę
// wierszy; 3.4 tylko NAJEŻDŻA kursorem na wybraną pozycję nawigacji, 3.5 przestawia rozmiar okna
// (1440 / 1920 / 1280) i na końcu wraca do 1440x900; checksIter3c = 3.6-3.10, wołana z końca
// checksIter3b: 3.7 podmienia `--dcol` na `.ovl-cap` (styl inline, przywracany po pomiarze),
// 3.8 przestawia `state.power.parked` i woła `renderPowerState()` — bez klikania „Uśpij”,
// 3.6 zmienia na chwilę szerokość okna na 1380 i też wraca do 1440x900; checksIter3d = 3.11,
// wołana z końca checksIter3c: najeżdża syntetycznym `mouseover` na dymki i mierzy `#rf-tip`
// — klasa `rf-tip-long` ma się pojawiać dokładnie wtedy, gdy WIDOCZNY tekst ma > 160 znaków).
// Iteracja 4: checksIter4 = 4.1-4.5 — 4.1 czyta macierz „Przegląd" i porównuje komórkę dźwięku
// z kropką Synth w nawigacji; 4.2 i 4.3 otwierają edytor wyzwalacza i KLIKAJĄ „Zapisz" z pustą
// akcją (zapis odbija się o walidację, nic nie wychodzi na serwer), a każdy scenariusz kończy
// „Anuluj"; 4.3 odpowiada na dialog „Porzucić niezapisany wyzwalacz?" obiema drogami i woła
// padNewRule() na ekranie Kontroler; 4.5 podmienia state.rules na [] LOKALNIE, rysuje pusty
// stan i przywraca poprzednią listę (renderRules nie zapisuje — zapisuje dopiero commitRules).
// checksIter4b = 4.6-4.7, wołana z końca checksIter4: 4.6 czyta dymek #armBtn i PODMIENIA LOKALNIE
// `_hkState` (stan skrótu stopu awaryjnego) + woła `_hkRender()` — bez POST /hotkey i bez klikania
// „Zmień skrót"; na koniec przywraca stan sprzed pomiaru. 4.7 przechodzi 8 modułów i czyta zdanie
// bloku stanu `.rfpc-state-tx`, ale sprawdza tylko te, których nośnik nie ma jeszcze nazwy (na
// cudzej instancji część modułów nazwę nosi i zdanie jest wtedy inne).
// Iteracja 5: checksIter5 = 5.1-5.5 (dostępność) — tylko to, co ma działać na każdym ekranie i w obu
// językach: nazwy i opisy dostępne przełączników i pozycji nawigacji plus trzy krótkie przebiegi
// fokusu (rfAlert, „Edytuj kapsel", edytor wyzwalacza), każdy zamykany Escape. Pełne przebiegi
// klawiaturowe mają osobne skrypty: tests/modal_focus_harness.cjs, devedit_focus_harness.cjs,
// rule_editor_focus_harness.cjs, tabs_dots_a11y_harness.cjs (uruchamiane ręcznie, jak ten).
// 5.5 przestawia LOKALNIE state.trigEnabled tylko w tabs_dots_a11y_harness — tutaj wcale.
// checksIter5b = 5.6-5.10, wołana z końca checksIter5: dymek przy fokusie (5.6; pełny przebieg
// z myszą i dialogiem ma tests/tooltip_focus_headless.cjs), fałda „Widoczność modułów" otwierana
// i zamykana z klawiatury (5.7 — ŻADEN przełącznik nie jest klikany, zmienia się tylko
// localStorage), nazwy suwaków progu (5.8), etykiety pól paska zapisu zestawu (5.9) i regiony
// aria-live bąbla czaszki (5.10 — rfSkullNote wołane wprost, sam DOM). checksIter5c = 5.11-5.13,
// wołana z końca checksIter5b: nawigacja z klawiatury (strzałki, Home/End, jedno Tab na wyjście —
// przechodzenie po pozycjach otwiera ekrany, tak samo jak walk wyżej), aria-pressed na przyciskach
// segmentowych edytora (jedno kliknięcie „Ciągłe" przestawia SZKIC, edytor zamyka „Anuluj") oraz
// jeden widoczny h1 na moduł i trzy landmarki kolumn (5.13).
// Iteracja 6 („Informacja zwrotna i stany") NIE MA tu własnych asercji: prawie każda jej pozycja
// wymaga kliknięcia, które zapisałoby coś na serwerze, więc mieszkają w osobnych skryptach.
// Iteracja 7: checksIter7 = 7.1-7.9 + 7.16 — jedyna funkcja, która PRZESTAWIA ROZMIAR OKNA
// (1024x700, 1280x800, 1440x900, 1920x1080 i osobno 1280/1440 dla ekranu dwukolumnowego) i mierzy
// geometrię: brak poziomego przewijania dokumentu, `header.offsetHeight === 77`, `.rfpc-head`
// widoczny i klikalny po `scrollTo(0,600)` (oraz poniżej pasa kapsli), `--rf-strip-h` zgodne
// z układem kolumn, `.wh-val` w sekcji, listy `#miList`/`#rulesList`/`#padRulesList` bez
// przepełnienia, trzy przebiegi miniatury w pasie podglądu, kubek poza przyciskiem stopki,
// prawa kolumna „Nakładki" w karcie i żywa pętla klatek. Na końcu WRACA do 1440x900 i na
// Mapowanie. Pomiary wydajności (LayoutCount, fps przy 4x CPU, czas startu) są poza tym plikiem:
// tests/boot_timing_harness.mjs, perf_frame_layout.cjs, axis_plots_idle_harness.cjs,
// cv_memo_probe.cjs, fonts_preload_harness.cjs, ui_narrow_strip_harness.cjs,
// rcol_strip_harness.cjs, header_wrap_harness.cjs, wheel_layout_harness.mjs.
// Skrypt NIC nie zapisuje na serwerze: klika tylko nawigację,
// pod-zakładki, details, otwiera i zamyka edytory inline przyciskiem Anuluj; 1.7 przestawia
// state.midi.enabled/oscEnabled LOKALNIE (czyste rysowanie) i przywraca; 2.2 woła setLang(l,false)
// (bez zapisu w localStorage; POST /ui-lang, który setLang wysyła, jest przechwycony jak przy starcie)
// i przywraca język, a wiersz MIDI rysuje tymczasowo tylko wtedy, gdy instancja nie ma żadnego; 2.5 robi
// to samo na ekranie Synth (pady przerysowane przez padRelang — bez padSave) i sprawdza „Wielkość" nakładki
// (data-i18n-en); 2.8 otwiera okno „Z szablonu…" wprost (restAddApiFromTemplate — sam DOM) i zamyka je; 2.6 klika
// „Wyślij” na ekranie Połączenie, ale POST /command jest ZASTUBOWANY (W.stubPost — odpowiedź udaje serwer
// lokalnie, żądanie nie wychodzi) i podaje zdarzenie SSE "cmd" do onCmd() wprost; rfToast pokazuje jedno
// zdanie serwera (tylko DOM). Każdy POST = FAIL, poza stubami i poza
// trzema, które panel wysyła SAM, bez klikania: /ui-lang przy starcie (_reportLang w rf-01),
// /overlay {act:"open"|"close"} przy wejściu na ekran Nakładka i zejściu z niego (podgląd na żywo
// okna nakładki — _ovgLiveApply / _ovgLiveClose w rf-41d; w headless okno i tak nie powstaje) oraz
// /gesture/watch {on:true|false}, gdy na ekranie stoi nagrywarka gestów (żywy wykres ruchu, rf-12d).
// Od 16.10 także dwa, które widać dopiero na ŚWIEŻEJ kopii Settings/: /scan-preset/seed {…,"restore":false,
// "sync":true} przy budowie karty skanera (rf-50j `loadScanPresets`) i /device?dev=… {"cap":"…"}, gdy
// kapsel nie ma jeszcze wylosowanego kapsla (rf-08 `_ensureCap`).
// Wszystkie są PRZECHWYTYWANE LOKALNIE (context.route → odpowiedź udająca serwer) i nigdy nie docierają
// do instancji: Settings/ jest wspólne z panelem używanym na co dzień, a puszczone dalej zostawiały po sobie
// ribbitflip_ui.json {"lang":"en"} (każdy przebieg kończy się w EN) i windows.d0.open=true w
// ribbitflip_overlay.json (zejście z Nakładki bez „close").
//
// Styl asercji: check(name, cond, detail) → „PASS name” / „FAIL name — detail”, jak w tests/*.py.
const { chromium } = require("@playwright/test");
const { rfBezPierwszegoStartu } = require("./_rf_pierwszy_start.cjs");
const fs = require("fs");
const path = require("path");
const REPO = path.dirname(__dirname);
const BASE_FILE = path.join(__dirname, "ux_walk_baseline.json");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return (i >= 0 && argv[i + 1]) ? argv[i + 1] : d; };
const URL = argv.find(a => /^https?:\/\//.test(a)) || "http://127.0.0.1:8813/";
const BASELINE = flag("--baseline");
const SHOTS = opt("--shots", "C:/tmp/rf_walk");
const MAX_ITER = parseInt(opt("--iter", "99"), 10);

// 13 ekranów lewej nawigacji + Przegląd = 14. Przyciski nawigacji mają klasy "tab-btn rnav-btn".
const TABS = ["mapowanie","kolo","mysz","kontroler","midi","osc","restapi","pad",
              "konfiguracje","ustawienia","wszystkie","czujnik","polaczenie"];
const MODS = new Set(["mapowanie","kolo","mysz","kontroler","midi","osc","restapi","pad"]);
const PL_RE = /[ąćęłńóśźż]/i;

let nPass = 0, nFail = 0;
function check(name, cond, detail) {
  if (cond) { nPass++; console.log("PASS " + name); }
  else { nFail++; console.log("FAIL " + name + (detail !== undefined ? " — " + String(detail).slice(0, 300) : "")); }
  return !!cond;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// --- nawigacja -----------------------------------------------------------------------------
async function goTab(page, t) {
  await page.evaluate(t => document.querySelector(`button.tab-btn[data-tab="${t}"]`)?.click(), t);
  await sleep(400);
}
async function goPane(page, t, k) {
  await page.evaluate(([t, k]) => document.getElementById(`rfpcTab-${t}-${k}`)?.click(), [t, k]);
  await sleep(150);
}
async function openDetails(page) {
  await page.evaluate(() => document.querySelectorAll("details:not([open])").forEach(d => d.open = true));
}
// Widoczne węzły tekstowe z polskimi diakrytykami w #rfMain (poza [data-noi18n]) — do linii bazowej EN.
async function polishNodes(page) {
  return page.evaluate(() => {
    const root = document.getElementById("rfMain") || document.body;
    const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
    const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (!t) continue;
      const p = n.parentElement; if (!p || !vis(p)) continue;
      if (p.closest("[data-noi18n],script,style")) continue;
      if (/[ąćęłńóśźż]/i.test(t)) out.push(t.slice(0, 80));
    }
    return out;
  });
}

// --- przebieg bazowy (14 ekranów × 2 języki) --------------------------------------------------
async function walk(browser, lang, baseline) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Bez pytania pierwszego startu i zaproszenia do przewodnika (wspólny pomocnik), które stałyby w rogu zrzutów.
  await rfBezPierwszegoStartu(ctx);
  await ctx.addInitScript(l => { localStorage.setItem("ribbitflip.lang", l); }, lang);
  // Edytor ręczny otwierają drzwi „Ustaw ręcznie” pod wyborem ruchu (UX 261120): na pustym Mapowaniu
  // wybór jest pustym stanem listy, przy regułach otwiera go „Nowy wyzwalacz”.
  await ctx.addInitScript(() => {
    window.__rfStartBtn = () => { const a = document.getElementById("addRule");
      return (a && a.offsetParent) ? a : document.getElementById("trigDoorManual"); };
    window.__rfNewRule = () => { if (!document.getElementById("trigStart")) __rfNewRule();
      document.getElementById("trigDoorManual")?.click(); };
  });
  const page = await ctx.newPage();
  const errs = [], posts = [];
  page.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  page.on("pageerror", e => errs.push(String(e).slice(0, 200)));
  // POST-y własne panelu (nie z klikania): /ui-lang przy starcie i /overlay open/close z podglądu
  // na żywo ekranu Nakładka (rf-41d). Wszystko inne = ktoś zapisał na serwerze = FAIL.
  // POST-y ZASTUBOWANE przez asercje iteracji (W.stubPost): odpowiedź udaje serwer, żądanie nigdy nie
  // wychodzi — liczą się jako przechwycone, nie jako zapis (2.6: POST /command z ekranu Połączenie).
  const stubbed = new Map();                                   // re.source → { re, body }
  const ownPost = r => /\/ui-lang$/.test(r.url())
    || (/\/overlay$/.test(r.url()) && /"act":"(open|close)"/.test(r.postData() || ""))
    // …i /gesture/watch, wysyłane samo, gdy na ekranie stoi nagrywarka gestów: prosi kapsel
    // o żywy wykres ruchu i NIC nie zapisuje (strumień gaśnie sam, gdy nikt nie odświeża).
    // Przechwytywane mimo to, żeby przebieg nie zostawiał żywej instancji z włączonym
    // strumieniem 25 zdarzeń na sekundę. Adres niesie ?dev=, więc bez kotwicy $.
    || /\/gesture\/watch(\?|$)/.test(r.url())
    // …i /scan-preset/seed {…,"restore":false,"sync":true}, wysyłane przy budowie karty skanera
    // (rf-50j `loadScanPresets`: zestawy z aplikacji nadążają za wersją, raz na start strony). Na świeżej
    // kopii zasiewa bibliotekę, więc też odpowiadamy lokalnie — prawdziwą listą z GET /scan-presets.
    || (/\/scan-preset\/seed$/.test(r.url()) && /"restore":false,"sync":true/.test(r.postData() || ""))
    // …i /device?dev=… {"cap":"…"}: kapsel bez wylosowanego kapsla dostaje go przy pierwszym spotkaniu
    // (rf-08 `_ensureCap`), czyli na świeżej kopii Settings/. Odpowiedź {ok:true}.
    || (/\/device\?dev=[^&]+$/.test(r.url()) && /^\{"cap":"[^"]*"\}$/.test(r.postData() || ""))
    // /ui-active {"dev":…}: panel mówi serwerowi, który kapsel jest aktywny (rf-11); pamięć na czas
    // sesji serwera, nic nie trafia do Settings/. Odpowiedź {ok:true}.
    || /\/ui-active$/.test(r.url())
    || [...stubbed.values()].some(s => s.re.test(r.url()));
  page.on("request", r => { if (r.method() === "POST" && !ownPost(r)) posts.push(r.url() + " " + (r.postData() || "").slice(0, 60)); });
  // Własne POST-y panelu odpowiadamy lokalnie (nie zapisują nic w Settings/ — patrz nagłówek): /ui-lang
  // dostaje {ok,lang}, /overlay open/close — {ok:true} + prawdziwy stan z GET /overlay, żeby ovlPanelSync
  // narysował to samo, co po odpowiedzi serwera. Inny act w /overlay przechodzi dalej i liczy się jako FAIL.
  const intercepted = [];
  await ctx.route(/\/(ui-lang|ui-active|overlay|gesture\/watch|scan-preset\/seed|device\?dev=[^&]+)(\?|$)/, async route => {
    const r = route.request();
    if (r.method() !== "POST" || !ownPost(r)) return route.continue();
    intercepted.push(r.url().replace(/^.*\//, "/") + " " + (r.postData() || "").slice(0, 40));
    let body = { ok: true, lang };
    if (/\/gesture\/watch(\?|$)/.test(r.url())) body = { ok: true, watch: /"on":\s*true/.test(r.postData() || "") };
    // `URL` jest tu napisem z adresem instancji (przesłania konstruktor), stąd replace, a nie new URL().
    if (/\/overlay$/.test(r.url())) {
      let st = {};
      try { st = await (await ctx.request.get(URL.replace(/\/?$/, "/overlay"))).json(); } catch (e) { }
      body = { ok: true, error: null, ...st };
    }
    if (/\/scan-preset\/seed$/.test(r.url())) {
      let st = {};
      try { st = await (await ctx.request.get(URL.replace(/\/?$/, "/scan-presets"))).json(); } catch (e) { }
      body = { ok: true, added: 0, updated: 0, ...st };
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(URL, { waitUntil: "load" }); await sleep(1500);   // NIGDY networkidle (SSE /stream)
  const dir = path.join(SHOTS, lang); fs.mkdirSync(dir, { recursive: true });
  const perScreen = {}, samples = {};
  for (const t of TABS) {
    await goTab(page, t);
    if (MODS.has(t)) { for (const k of ["cfg", "lib", "info"]) await goPane(page, t, k); }
    await openDetails(page);
    await page.screenshot({ path: path.join(dir, `walk_${t}.png`), fullPage: true });
    if (lang === "en") { const pn = await polishNodes(page); perScreen[t] = pn.length; samples[t] = pn.slice(0, 12); }
    if (MODS.has(t)) await goPane(page, t, "cfg");
  }
  await goTab(page, "przeglad"); await sleep(400);
  await page.screenshot({ path: path.join(dir, "walk_przeglad.png"), fullPage: true });
  if (lang === "en") { const pn = await polishNodes(page); perScreen.przeglad = pn.length; samples.przeglad = pn.slice(0, 12); }
  await page.keyboard.press("Escape");
  check(`[${lang}] 0 console.error / pageerror na 14 ekranach`, errs.length === 0, errs.slice(0, 3).join(" | "));
  if (lang === "en") {
    const total = Object.values(perScreen).reduce((a, b) => a + b, 0);
    if (baseline) {
      fs.writeFileSync(BASE_FILE, JSON.stringify({ createdAt: new Date().toISOString().slice(0, 10), url: URL, total, perScreen, samples }, null, 1));
      console.log(`BASELINE zapisana: ${BASE_FILE} — total=${total} ` + JSON.stringify(perScreen));
    } else if (fs.existsSync(BASE_FILE)) {
      const base = JSON.parse(fs.readFileSync(BASE_FILE, "utf8"));
      const worse = Object.keys(perScreen).filter(k => perScreen[k] > (base.perScreen[k] ?? 0)).map(k => `${k}: ${perScreen[k]} > ${base.perScreen[k] ?? 0} (${samples[k].join(" / ")})`);
      check(`[en] polskie węzły w EN: ${total} ≤ linia bazowa ${base.total}`, total <= base.total, worse.join(" ; "));
      if (total < base.total) console.log(`INFO [en] polskich węzłów mniej niż w linii bazowej (${total} < ${base.total}) — można obniżyć tests/ux_walk_baseline.json`);
    } else check("[en] istnieje tests/ux_walk_baseline.json (uruchom z --baseline)", false);
  }
  // W.stubPost(re, body): od tej chwili POST pod adres pasujący do `re` dostaje `body` (JSON 200)
  // lokalnie i jest liczony jako przechwycony; W.unstubPost(re) zdejmuje stub. Ponowny stubPost z tym
  // samym `re` podmienia odpowiedź. GET pod ten sam adres przechodzi dalej.
  const stubPost = async (re, body) => {
    if (stubbed.has(re.source)) await page.unroute(stubbed.get(re.source).re);
    stubbed.set(re.source, { re, body });
    await page.route(re, route => {
      const r = route.request();
      if (r.method() !== "POST") return route.continue();
      intercepted.push(r.url().replace(/^.*\//, "/") + " (stub) " + (r.postData() || "").slice(0, 40));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stubbed.get(re.source).body) });
    });
  };
  const unstubPost = async (re) => { if (stubbed.has(re.source)) { await page.unroute(stubbed.get(re.source).re); stubbed.delete(re.source); } };
  return { page, ctx, errs, posts, intercepted, stubPost, unstubPost };
}

// --- asercje iteracji ---------------------------------------------------------------------
// Każda iteracja dopisuje checksIterN(page, lang, W) i rejestruje ją w ITERS. W = wynik walk()
// (errs, posts). Scenariusze kończą się Anuluj / Escape, żaden nie zapisuje na serwerze.
const $ids = (page, sel) => page.$$eval(sel, els => els.map(e => e.id));
const $txt = (page, sel) => page.$eval(sel, e => (e.textContent || "").replace(/\s+/g, " ").trim()).catch(() => null);

async function checksIter1(page, lang, W) {
  const en = lang === "en";
  const L = `[${lang}] 1.`;
  // 1.1 — Anuluj przed akcją główną (jak rfModal): edytor wyzwalacza i edytor MIDI/OSC
  await goTab(page, "mapowanie");
  // „Nowy wyzwalacz” otwiera wybór ruchu (UX 261120); edytor ręczny otwierają drzwi „Ustaw ręcznie”.
  await page.evaluate(() => __rfNewRule()); await sleep(400);
  check(L + "1 edytor wyzwalacza: .ed-actions = [edCancel, edSave]",
    JSON.stringify(await $ids(page, ".ed-actions button")) === '["edCancel","edSave"]', JSON.stringify(await $ids(page, ".ed-actions button")));
  await page.evaluate(() => document.getElementById("edCancel")?.click()); await sleep(200);
  // closeEditor (rf-12) chowa #ruleEditor (display:none), nie usuwa go z DOM — więc sprawdzamy widoczność.
  check(L + "1 edytor wyzwalacza zamknięty po Anuluj",
    await page.evaluate(() => { const e = document.getElementById("ruleEditor"); return !e || getComputedStyle(e).display === "none"; }));
  await goTab(page, "midi");
  await page.evaluate(() => document.getElementById("miAdd")?.click()); await sleep(400);
  check(L + "1 edytor MIDI: .mie-actions = [mieCancel, mieSave, mieTest]",
    JSON.stringify(await $ids(page, ".mie-actions button")) === '["mieCancel","mieSave","mieTest"]', JSON.stringify(await $ids(page, ".mie-actions button")));
  // 1.12 (runda 2): nagłówek nowego mapowania ma PNG .bic-plus zamiast tekstowego „➕” (był jako ➕, więc grep planu go nie łapał)
  const mh = await page.evaluate(() => { const h = document.querySelector("#miEditor .mie-head"); if (!h) return null;
    const ic = h.querySelector(".bic-plus"); return { txt: (h.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30), ic: !!ic, w: ic ? ic.getBoundingClientRect().width : 0 }; });
  check(L + "12 nagłówek edytora MIDI: .bic-plus (szer.>0) + „Nowe mapowanie”/„New mapping”, bez ➕", !!mh && mh.ic && mh.w > 0 && !/➕|\+/.test(mh.txt) && /^(Nowe mapowanie|New mapping)/.test(mh.txt), JSON.stringify(mh));
  await page.evaluate(() => document.getElementById("mieCancel")?.click()); await sleep(200);

  // 1.2 — Mysz/Kontroler: chip „○ wyłączony” + zdanie, gdzie jest przełącznik; /wyłącz/ dokładnie raz
  const mouseOn = await page.evaluate(() => !!(window.state && state.mouse && state.mouse.enabled));
  if (mouseOn) console.log("INFO 1.2 pominięte — sterowanie ruchem jest włączone na instancji (state.mouse.enabled)");
  else {
    // Mysz od UX 261120 (P-G2-09) nie ma chipa ani zdania: stan mówi linia gotowości nad kartą.
    await goTab(page, "mysz"); await sleep(1300);
    const rl = (await $txt(page, "#rfReadyMysz")) || "";
    check(L + "2 mysz: linia gotowości mówi „" + (en ? "The mouse is on" : "Mysz włączona") + "” z przyciskiem „" + (en ? "Turn the mouse on" : "Włącz Mysz") + "”",
      (en ? /The mouse is on/.test(rl) && /Turn the mouse on/.test(rl) : /Mysz włączona/.test(rl) && /Włącz Mysz/.test(rl)), rl);
    for (const [tab, st, nt, nounPl, nounEn] of [["kontroler", "#kState", "#kNote", /drążek|krzyżak/, /the stick|the d-pad/]]) {
      await goTab(page, tab);
      const s = ((await $txt(page, st)) || "") + " " + ((await $txt(page, nt)) || "");
      const hits = (s.match(en ? /disabled/gi : /wyłącz/gi) || []).length;
      check(L + `2 ${tab}: ${en ? "/disabled/" : "/wyłącz/"} dokładnie raz w chipie+zdaniu`, hits === 1, s);
      check(L + `2 ${tab}: zdanie mówi o przełączniku On i o ${en ? nounEn : nounPl}`, /\bOn\b/.test(s) && (en ? nounEn : nounPl).test(s), s);
    }
  }

  // 1.3 — hub kapsli mówi „kapsel”, nie „urządzenie”
  check(L + "3 .devices-h b = " + (en ? "Triki capsules" : "Kapsle Triki"),
    (await $txt(page, ".devices-h b")) === (en ? "Triki capsules" : "Kapsle Triki"), await $txt(page, ".devices-h b"));
  check(L + "3 #deviceAddBtn = " + (en ? "Add a capsule" : "Dodaj kapsel"),
    (await $txt(page, "#deviceAddBtn .dp-add-txt")) === (en ? "Add a capsule" : "Dodaj kapsel"), await $txt(page, "#deviceAddBtn .dp-add-txt"));
  const rcol = await page.$eval(".rf-rcol", e => e.innerText).catch(() => "");
  const badWord = en ? /device/i : /urządzeni/i;
  check(L + "3 prawa kolumna bez " + (en ? "„device”" : "„urządzeni…”"), !badWord.test(rcol),
    (rcol.split("\n").filter(l => badWord.test(l)).slice(0, 4).join(" | ")));

  // 1.4 — nagłówki poradnika mówią o module, nie o zakładce
  await goTab(page, "midi"); await goPane(page, "midi", "info"); await sleep(300);
  const h4 = await page.$$eval("#tab-midi h4", els => els.map(e => e.textContent.trim()));
  check(L + "4 #tab-midi h4 bez „zakładk”", h4.length > 0 && !h4.some(t => /zakładk/i.test(t)), h4.filter(t => /zakładk/i.test(t)).join(" | "));
  if (en) check(L + "4 #tab-midi h4 zawiera „What is this module for?”", h4.includes("What is this module for?"), h4.slice(0, 4).join(" | "));
  else check(L + "4 #tab-midi h4 zawiera „Do czego służy ten moduł?”", h4.includes("Do czego służy ten moduł?"), h4.slice(0, 4).join(" | "));
  await goPane(page, "midi", "cfg");

  // 1.5 — akcje w wierszu MIDI/OSC: ikony jak w Mapowaniu; kosz w tej samej linii
  for (const [tab, list] of [["midi", "#miList"], ["osc", "#oscList"]]) {
    await goTab(page, tab);
    // Lista OSC na instancji testowej bywa pusta — wtedy rysujemy JEDNO tymczasowe mapowanie lokalnie
    // (renderMidiList w rf-16 tylko maluje state.midi.mappings, nic nie wysyła) i po asercjach je zdejmujemy.
    const tmp = await page.evaluate(([list]) => {
      if (document.querySelector(`${list} .mi-rowacts`) || typeof renderMidiList !== "function") return false;
      const ms = (state.midi.mappings = state.midi.mappings || []);
      ms.push({ id: "uxwalk-tmp", enabled: true, src: "tilt", dest: list === "#oscList" ? "osc" : "cc", cc: 1, addr: "/uxwalk", min: 0, max: 1 });
      renderMidiList(); return true;
    }, [list]);
    if (tmp) await sleep(250);
    const rows = await page.$$eval(`${list} .mi-rowacts`, els => els.map(r => [...r.querySelectorAll("button[data-act]")].map(b => ({
      act: b.dataset.act, txt: b.textContent.trim(), al: b.getAttribute("aria-label"), bin: !!b.querySelector(".bic-bin"), top: Math.round(b.getBoundingClientRect().top) }))));
    if (!rows.length) { console.log(`INFO 1.5 ${tab}: brak mapowań na instancji (${list} pusty) — asercje pominięte`); continue; }
    const r = rows[0], by = a => r.find(b => b.act === a) || {};
    check(L + `5 ${tab} edit: tylko ikona, aria-label ` + (en ? "Edit" : "Edytuj"), by("edit").txt === "" && by("edit").al === (en ? "Edit" : "Edytuj"), JSON.stringify(by("edit")));
    check(L + `5 ${tab} test: „▷”, aria-label ` + (en ? "Test the mapping" : "Testuj mapowanie"), by("test").txt === "▷" && by("test").al === (en ? "Test the mapping" : "Testuj mapowanie"), JSON.stringify(by("test")));
    check(L + `5 ${tab} del: ikona kosza .bic-bin`, by("del").bin === true, JSON.stringify(by("del")));
    const tops = r.map(b => b.top);
    check(L + `5 ${tab} trzy przyciski w jednej linii`, Math.max(...tops) - Math.min(...tops) <= 2, tops.join(","));
    await page.$eval(`${list} .mi-rowhead`, e => e.scrollIntoView()).catch(() => {});
    const row = await page.$(`${list} .mi-row`);
    if (row) await row.screenshot({ path: path.join(SHOTS, lang, `iter1_5_${tab}_row.png`) }).catch(() => {});
    if (tmp) await page.evaluate(() => { state.midi.mappings = (state.midi.mappings || []).filter(m => m.id !== "uxwalk-tmp"); renderMidiList(); });
  }
  // Porcja 2 iteracji 1 (1.6–1.10) — osobna funkcja, ale wołana STĄD, żeby `--iter 1` i etykieta
  // „checksIter1 bez wyjątku" nadal obejmowały całą iterację.
  await checksIter1b(page, lang, W);
}

async function checksIter1b(page, lang, W) {
  const en = lang === "en";
  const L = `[${lang}] 1.`;
  const cssOf = (sel, prop, pseudo) => page.evaluate(([sel, prop, pseudo]) => {
    const e = document.querySelector(sel); if (!e) return null;
    return getComputedStyle(e, pseudo || null)[prop];
  }, [sel, prop, pseudo || ""]);

  // 1.6 — Synth: zdanie „zapisz go jako scenę” i przycisk „Utwórz scenę” mówią tym samym rzeczownikiem;
  // Mysz nadal „Utwórz preset”. Przycisk jest tylko przy bezimiennej konfiguracji — gdy instancja ma
  // nazwaną scenę, sprawdzamy słownik adaptera (to samo źródło, z którego rf-49j3 bierze napis).
  for (const [tab, adapter, pl, enTxt] of [["pad", "SYNTH_SCENE_ADAPTER", "Utwórz scenę", "Create a scene"], ["mysz", "MOUSE_CFG_ADAPTER", "Utwórz preset", "Create a preset"]]) {
    await goTab(page, tab); await goPane(page, tab, "cfg"); await sleep(200);
    const want = en ? enTxt : pl;
    const btn = await $txt(page, `#tab-${tab} .rfpc-state-acts button`);
    if (btn !== null) check(L + `6 ${tab}: przycisk bloku stanu = „${want}”`, btn === want, btn);
    else {
      console.log(`INFO 1.6 ${tab}: konfiguracja ma nazwę (brak przycisku bloku stanu) — sprawdzam słownik adaptera`);
      // adaptery to `const` w skrypcie (nie na window) — dosięga ich tylko eval
      const viaW = await page.evaluate(a => { try { return _cfgW(eval(a), "createBtn"); } catch (e) { return "ERR " + e.message; } }, adapter);
      check(L + `6 ${tab}: _cfgW(${adapter},"createBtn") = „${want}”`, viaW === want, viaW);
    }
    if (tab === "pad") {
      const body = await page.$eval("#tab-pad", e => e.innerText).catch(() => "");
      check(L + "6 pad: ekran Synth bez „Utwórz preset”/„Create a preset”", !/Utwórz preset|Create a preset/.test(body));
      if (btn !== null) check(L + "6 pad: zdanie nad przyciskiem mówi o scenie", en ? /as a scene/.test(body) : /Zapisz go jako scenę/.test(body));
    }
  }

  // 1.7 — MIDI/OSC: stan modułu mówi JEDNA linia gotowości pod nagłówkiem (#rfReadyMidi/#rfReadyOsc,
  // UX 261120 B3). Stopek #miArmNote/#oscArmNote i pudła #miLoopHint nie ma, a pusty dziennik milczy,
  // dopóki nic nie może wyjść. Stan przełączamy LOKALNIE (czyste rysowanie, 0 POST) i przywracamy.
  for (const [tab, card, line, flag, proto, re] of [
      ["midi", "#midiCard", "#rfReadyMidi", "enabled", "midi", en ? /The MIDI module is on/ : /Moduł MIDI włączony/],
      ["osc", "#oscCard", "#rfReadyOsc", "oscEnabled", "osc", en ? /The OSC module is on/ : /Moduł OSC włączony/]]) {
    await goTab(page, tab);
    const r = await page.evaluate(([card, line, flag, proto, reSrc]) => {
      const re = new RegExp(reSrc);
      const was = state.midi[flag];
      const paint = () => { if (typeof iologRender === "function") iologRender(proto); rfReady.tick(); };
      state.midi[flag] = false; paint();
      const host = document.querySelector(line);
      const row = host ? [...host.querySelectorAll(".rf-ready-it")].find(e => re.test(e.textContent)) : null;
      const out = { notes: document.querySelectorAll("#miArmNote,#oscArmNote,#miLoopHint").length,
        line: !!host && !host.hidden, rowNo: !!(row && row.classList.contains("no")),
        empty: [...document.querySelectorAll(card + " .iolog-empty")].map(e => e.textContent) };
      state.midi[flag] = was; paint();
      return out;
    }, [card, line, flag, proto, re.source]);
    check(L + `7 ${tab}: stopek stanu pod listą nie ma`, r.notes === 0, JSON.stringify(r));
    check(L + `7 ${tab}: linia gotowości ma wiersz „moduł włączony” z krzyżykiem`, r.line && r.rowNo, JSON.stringify(r));
    check(L + `7 ${tab}: pusty dziennik milczy przy wyłączonym module`, r.empty.length === 0, JSON.stringify(r));
  }

  // 1.8 — Zestawy: karta nazywa się „Biblioteka wszystkich modułów”; pigułka modułu zostaje „Biblioteka”.
  await goTab(page, "konfiguracje");
  const h2s = await page.$$eval("#tab-konfiguracje h2", els => els.filter(e => e.getBoundingClientRect().height > 0).map(e => e.textContent.replace(/\s+/g, " ").trim()));
  check(L + "8 #tab-konfiguracje h2: żaden nie brzmi dokładnie „" + (en ? "Library" : "Biblioteka") + "”", h2s.length > 0 && !h2s.includes(en ? "Library" : "Biblioteka"), h2s.join(" | "));
  check(L + "8 #tab-konfiguracje h2 zawiera „" + (en ? "Library of all modules" : "Biblioteka wszystkich modułów") + "”", h2s.includes(en ? "Library of all modules" : "Biblioteka wszystkich modułów"), h2s.join(" | "));
  await goTab(page, "mapowanie");
  const pill = await page.$$eval("#tab-mapowanie .rfpc-tab", els => els.map(e => [e.textContent.trim(), e.getAttribute("aria-label") || ""]).find(p => /^(Biblioteka|Library)$/.test(p[0])) || null);
  check(L + "8 mapowanie: pigułka „" + (en ? "Library" : "Biblioteka") + "” z aria-label o presetach modułu",
    !!pill && pill[0] === (en ? "Library" : "Biblioteka") && (en ? /^Library: .*module/i : /^Biblioteka: Zapisane presety tego modułu/).test(pill[1]), JSON.stringify(pill));

  // 1.9 — trzy małe foldy dzielą znacznik .stnote-fold: bez trójkąta przeglądarki, „▸” w --pink jak .rail-fold.
  // Prawa kolumna nie ma już .rail-fold (UX 261120 L23), więc wzorcem jest sam token --pink.
  const railColor = (await cssOf(".rail-fold>summary", "color", "::before"))
    || await page.evaluate(() => { const e = document.createElement("i"); e.style.color = "var(--pink)"; document.body.appendChild(e);
      const c = getComputedStyle(e).color; e.remove(); return c; });
  const foldOk = async (name, sel) => {
    const ls = await cssOf(sel, "listStyleType"); const ct = await cssOf(sel, "content", "::before"); const col = await cssOf(sel, "color", "::before");
    check(L + `9 ${name}: list-style none, ::before „▸” w kolorze .rail-fold (${railColor})`, ls === "none" && ct === '"▸"' && col === railColor, JSON.stringify({ ls, ct, col }));
  };
  await goTab(page, "mysz"); await foldOk("mysz #mAccelFold", "#mAccelFold>summary");
  // Połączenie: dawny tekstowy zwijak „Zaawansowane: częstotliwość strumienia” to od UX 261120 L4b
  // karta w „Zaawansowane” (#connAdv, details.cardfold.adv); jego wygląd pilnuje test_tiers.
  await goTab(page, "polaczenie");
  check(L + "9 polaczenie #connAdv: jedno „Zaawansowane” na dole ekranu",
    await page.evaluate(() => { const a = document.getElementById("connAdv"); return !!a && a.classList.contains("adv") && !!document.getElementById("pwWake") && a.contains(document.getElementById("pwWake")); }));
  await goTab(page, "mapowanie");
  await page.evaluate(() => __rfNewRule()); await sleep(400);
  // fold „konkretny bit” rysuje się tylko dla warunku „przycisk” — przełącznik rodzaju źródła (data-ck)
  // przerysowuje edytor lokalnie (renderEditor), nic nie wysyła; Anuluj na końcu porzuca szkic.
  await page.evaluate(() => document.querySelector('#ruleEditor .seg-sm button[data-ck="button"]')?.click()); await sleep(300);
  if (await page.$(".ed-btn-adv>summary")) await foldOk("edytor .ed-btn-adv", ".ed-btn-adv>summary");
  else check(L + "9 edytor: warunek „przycisk” rysuje .ed-btn-adv", false, "brak .ed-btn-adv po kliknięciu data-ck=button");
  await page.evaluate(() => document.getElementById("edCancel")?.click()); await sleep(200);

  // 1.10 — Przegląd: ostatnia kolumna nadal „Dźwięk (Synth)” / „Sound (Synth)” (nazwa zostaje, komentarz w rf-45).
  await goTab(page, "przeglad"); await sleep(400);
  const lastTh = await page.$$eval(".dm-tab thead th .dm-hlbl", els => els.length ? els[els.length - 1].textContent.replace(/\s+/g, " ").trim().toUpperCase() : null);
  check(L + "10 Przegląd: ostatni nagłówek = " + (en ? "SOUND (SYNTH)" : "DŹWIĘK (SYNTH)"), lastTh === (en ? "SOUND (SYNTH)" : "DŹWIĘK (SYNTH)"), lastTh);
  await page.keyboard.press("Escape"); await sleep(200);
  // Porcja 3 iteracji 1 (1.11–1.14) — jak wyżej: osobna funkcja, wołana stąd.
  await checksIter1c(page, lang, W);
}

async function checksIter1c(page, lang, W) {
  const en = lang === "en";
  const L = `[${lang}] 1.`;

  // 1.11 — placeholder wyszukiwarki Zestawów pisany jak w Bibliotekach modułów: mała litera + wielokropek.
  await goTab(page, "konfiguracje");
  const ph = await page.$eval("#libFind", e => e.placeholder).catch(() => null);
  check(L + "11 #libFind.placeholder", ph === (en ? "search by name, game or author…" : "szukaj po nazwie, grze albo autorze…"), ph);
  await goTab(page, "mapowanie"); await goPane(page, "mapowanie", "lib"); await sleep(200);
  const phq = await page.$eval("#tab-mapowanie input.rfpc-q", e => e.placeholder).catch(() => null);
  check(L + "11 Mapowanie › Biblioteka input.rfpc-q.placeholder", phq === (en ? "search presets…" : "szukaj presetu…"), phq);

  // 1.12 / 1.13 — jedna ikona „dodaj" (.bic-plus PNG) i zero emoji na przyciskach Usług; Koło bez „+ …".
  // Zbieramy WSZYSTKIE przyciski ekranu (także w ukrytych panelach), bo instancja testowa może mieć
  // 0 aplikacji — wtedy pod-zakładki Akcje/Wyzwalacze/Ustawienia i wiersze akcji w ogóle nie istnieją.
  const btnScan = (t) => page.evaluate(t => [...document.querySelectorAll(`#tab-${t} button, #rfpc-${t} button`)].map(b => ({
      txt: (b.textContent || "").replace(/\s+/g, " ").trim(), cls: b.className || "",
      plus: !!b.querySelector(".bic-plus"),
      bicW: [...b.querySelectorAll(".bic")].map(i => i.getBoundingClientRect().width),
      vis: b.getBoundingClientRect().width > 0 })), t);
  const PLUS_LBL = /^(Dodaj API|Dodaj pierwsze API|Nowa akcja|Dodaj wyzwalacz|Dodaj poświadczenie|Nowa zmienna|Dodaj wszystkie|puste pole|podmenu|Add API|Add the first API|New action|Add trigger|Add credential|New variable|Add all|empty slice|submenu)$/;
  // Instancja testowa ma 0 aplikacji REST, więc pod-zakładki Akcje/Wyzwalacze/Ustawienia, „Nowa akcja”,
  // „Dodaj wyzwalacz” i „Test połączenia” nie istniałyby w DOM — dokładamy aplikację LOKALNIE do
  // _ra3Cfg().apis (bez _ra3Save → 0 POST), klikamy jej pod-zakładki (klik = _ra3SyncTabs, czysty
  // render) i po skanie ją zdejmujemy. Sejf zostaje zamknięty — „Dodaj poświadczenie” nadal tylko statycznie.
  const restTmp = (on) => page.evaluate(on => {
    const cfg = (typeof _ra3Cfg === "function") ? _ra3Cfg() : null; if (!cfg) return false;
    if (!Array.isArray(cfg.apis)) cfg.apis = [];
    if (on) { cfg.apis.push({ id: "uxwalk-tmp", name: "uxwalk", baseUrl: "http://127.0.0.1:9/", headers: [], credId: "", timeoutMs: 10000, actions: [], triggers: [] }); _ra3Tab["uxwalk-tmp"] = "actions"; }
    else { cfg.apis = cfg.apis.filter(a => a && a.id !== "uxwalk-tmp"); delete _ra3Tab["uxwalk-tmp"]; }
    restRenderApis(); return true; }, on);
  for (const t of ["restapi", "kolo"]) {
    await goTab(page, t); await goPane(page, t, "cfg"); await sleep(250);
    let all;
    if (t === "restapi" && await restTmp(true)) {
      await sleep(150); all = await btnScan(t);
      for (const st of ["triggers", "settings"]) {
        await page.evaluate(st => document.querySelector('.ra-app[data-id="uxwalk-tmp"] .ra-st[data-st="' + st + '"]')?.click(), st); await sleep(150);
        all = all.concat(await btnScan(t));
      }
      const wantApp = en ? ["New action", "Add trigger", "Connection test"] : ["Nowa akcja", "Dodaj wyzwalacz", "Test połączenia"];
      check(L + "12/13 restapi (aplikacja lokalna): Nowa akcja / Dodaj wyzwalacz / Test połączenia narysowane", wantApp.every(w => all.some(b => b.txt === w)), all.filter(b => /akcj|action|wyzwal|trigger|test/i.test(b.txt)).map(b => b.txt).join(" | "));
      await restTmp(false); await sleep(100);
    } else all = await btnScan(t);
    const plusStart = all.filter(b => /^[+＋➕]/.test(b.txt) && !/ovl-add|ovg-new/.test(b.cls) && !/Zapisz|Save/.test(b.txt));
    check(L + `12 ${t}: żaden przycisk nie zaczyna się od „+"/„＋"/„➕" (poza .ovl-add/.ovg-new i „Zapisz…")`, plusStart.length === 0, plusStart.map(b => b.txt).join(" | "));
    const addBtns = all.filter(b => PLUS_LBL.test(b.txt));
    check(L + `12 ${t}: przyciski „dodaj" istnieją i każdy ma .bic-plus (${addBtns.length})`, addBtns.length > 0 && addBtns.every(b => b.plus), JSON.stringify(addBtns.map(b => [b.txt, b.plus])));
    if (en) check(L + `12 ${t}: EN — etykiety „dodaj" bez polskiego`, !addBtns.some(b => /^(Dodaj|Nowa|puste pole|podmenu)/.test(b.txt)), addBtns.map(b => b.txt).join(" | "));
    if (t === "restapi") {
      // ▶ Wyślij / 👁 Podgląd w wierszu akcji nie są na liście 1.13 (plan wymienia 🔓 🔁 🗑 🔌 📦 🗁 ⭳ ⚡ 🎯 ⚙) — poza asercją.
      // Spis treści poradnika (`.g-toc-poz`, rf-39b) powtarza nagłówki sekcji RAZEM z ich emoji
      // („🎬 OBS Studio", „🔔 Powiadomienie…") — to nawigacja po nagłówkach, a nagłówków 1.13 nie rusza.
      const emo = all.filter(b => /\p{Extended_Pictographic}/u.test(b.txt) && !/ra-run|ra-prev|g-toc-poz/.test(b.cls));
      check(L + "13 restapi: żaden przycisk nie ma emoji w etykiecie", emo.length === 0, emo.map(b => b.txt).join(" | "));
      if (en) { const plb = all.filter(b => /Odblokuj|Dodaj|Eksportuj|Połącz|Sejf|Zmień hasło|Usuń sejf/.test(b.txt));
        check(L + "13 restapi: EN — bez „Odblokuj/Dodaj/Eksportuj/Połącz…”", plb.length === 0, plb.map(b => b.txt).join(" | ")); }
      const withIc = all.filter(b => b.vis && b.bicW.length);
      check(L + `13 restapi: widoczne .bic mają niezerową szerokość (${withIc.length} przycisków)`, withIc.length > 0 && withIc.every(b => b.bicW.every(w => w > 0)), JSON.stringify(withIc.map(b => [b.txt, b.bicW])));
      // UX 261120 B3: główny przycisk Usług to „Wybierz szablon”, własna aplikacja to „Dodaj własne API”
      const want = en ? ["Pick a template", "Add your own API", "Connect", "Folder", "Export"] : ["Wybierz szablon", "Dodaj własne API", "Połącz", "Folder", "Eksportuj"];
      check(L + "13 restapi: Wybierz szablon / Dodaj własne API / Połącz / Folder / Eksportuj na ekranie", want.every(w => all.some(b => b.txt === w)), all.filter(b => b.vis).map(b => b.txt).join(" | "));
    }
  }

  // 1.14 — jednozdaniowe dymki bez kropki na końcu. rf-05 zdejmuje title i przepisuje go do data-rftip,
  // więc zbieramy oba atrybuty; „jedno zdanie" = kończy się kropką i nie ma w środku granicy zdania.
  // `.lib-desc` to OPIS pozycji biblioteki (autorski tekst presetu, np. zestawy skanera z RFScan.ZESTAWY),
  // pokazany też w dymku — proza autora, nie dymek interfejsu, więc reguła 1.14 go nie dotyczy.
  const tipScan = (t) => page.evaluate(t => [...document.querySelectorAll(`#tab-${t} [data-rftip], #tab-${t} [title]`)]
      .filter(e => !e.classList.contains("lib-desc"))
      .map(e => (e.getAttribute("data-rftip") || e.getAttribute("title") || "").replace(/\s+/g, " ").trim())
      .filter(s => /\.$/.test(s) && !/[.!?…]\s+\S/.test(s)), t);
  // Runda 2: także Nakładka (dymki pustych modułów przez ovlTip → data-rftip), Czujnik (strojenie osi) i Połączenie (wybór strumieni CSV).
  for (const t of ["kolo", "restapi", "konfiguracje", "wszystkie", "czujnik", "polaczenie"]) {
    await goTab(page, t); if (MODS.has(t)) await goPane(page, t, "cfg"); await sleep(200);
    const bad = [...new Set(await tipScan(t))];
    check(L + `14 ${t}: 0 jednozdaniowych dymków z kropką na końcu`, bad.length === 0, bad.join(" | "));
  }
  // 1.2 (runda 2) → UX 261120 (P-G2-09): chipa #mState i stopki #mNote w karcie Myszy już nie ma,
  // stan mówi linia gotowości nad kartą. Pilnujemy, żeby nie wróciły jako drugi głos tego samego.
  await goTab(page, "mysz"); await goPane(page, "mysz", "cfg"); await sleep(200);
  const mb = await page.evaluate(() => ({ st: !!document.getElementById("mState"), no: !!document.getElementById("mNote"),
    ready: !!document.getElementById("rfReadyMysz") }));
  check(L + "2 Mysz: bez chipa #mState i stopki #mNote, jest linia gotowości #rfReadyMysz", !mb.st && !mb.no && mb.ready, JSON.stringify(mb));
  const tipOf = (id) => page.evaluate(id => { const e = document.getElementById(id); return e ? (e.getAttribute("data-rftip") || e.getAttribute("title") || "") : null; }, id);
  for (const [id, pl, enTxt] of [["seEmoji", "Systemowe menu wyboru emoji otworzysz skrótem Win + kropka", "Open the system emoji picker with Win + period"],
                                 ["poseRecenter", "Wyśrodkuj — wyzeruj obrót i ustaw bieżące położenie jako odniesienie", "Recenter — zero the rotation and set the current position as reference"],
                                 ["whDead", "Jak duży jest środek koła, w którym nic nie jest wskazane", "How big the middle of the wheel is — the part where nothing is being pointed at"]]) {
    const v = await tipOf(id);
    check(L + `14 #${id}: dymek = „${en ? enTxt : pl}"`, v === (en ? enTxt : pl), v);
  }
}

// ===== Iteracja 2 — parytet PL/EN i higiena słownika (porcja 1: 2.1–2.5) ==================
// Porcja 2/3 dopisuje 2.6–2.13 do checksIter2b, wołanej z końca tej funkcji (jak w iteracji 1).
async function checksIter2(page, lang, W) {
  const en = lang === "en";
  const L = `[${lang}] 2.`;
  // 2.1 — notka o touchpadzie (#mStickTpNote) w całości w języku panelu. Walker tłumaczy też węzły
  // ukryte, więc nie trzeba przełączać wyjścia drążka na „touchpad” (to zapisałoby na serwerze).
  await goTab(page, "kontroler"); await goPane(page, "kontroler", "cfg");
  const tp = (await $txt(page, "#mStickTpNote")) || "";
  if (en) check(L + "1 #mStickTpNote po angielsku (zaczyna się od „The capsule's tilt”, bez polskich fragmentów)",
    /^The capsule's tilt/.test(tp) && !/Pochylenie|podnosi się|Panel dotykowy|kliknięcie|powierzchnię|panelu/.test(tp) && /lifts off the pad — because a stick returns to centre/.test(tp), tp.slice(0, 120));
  else check(L + "1 #mStickTpNote po polsku (zaczyna się od „Pochylenie kapsla”)", /^Pochylenie kapsla = miejsce na panelu\./.test(tp) && /podnosi się z panelu/.test(tp), tp.slice(0, 120));

  // 2.2 — nazwy wierszy MIDI składane przez _gl: „Tilt → MIDI CC 1 · ch 1” / „Pochylenie → MIDI CC 1 · kan 1”;
  // zmiana języka (setLang lokalnie; /ui-lang jest przechwycone w walk()) przerysowuje listę, nagłówek
  // edytora i ściągę Przeglądu bez przeładowania. Gdy instancja nie ma mapowań, rysujemy jedno LOKALNIE.
  await goTab(page, "midi"); await goPane(page, "midi", "cfg");
  const tmp22 = await page.evaluate(() => {
    if (document.querySelector("#miList .mi-name") || typeof renderMidiList !== "function") return false;
    (state.midi.mappings = state.midi.mappings || []).push({ id: "uxwalk-tmp22", enabled: true, srcKind: "filter", metric: "tilt", dest: "cc", cc: 1, midiCh: 1, mode: "continuous" });
    renderMidiList(); return true;
  });
  if (tmp22) await sleep(250);
  const miName = () => $txt(page, "#miList .mi-name");
  const nm0 = await miName();
  const okEn = s => /^Tilt → MIDI CC \d+ · ch \d+$|^Tilt → /.test(s || "") && !/ kan |Nuta |Pochylenie/.test(s || "");
  const okPl = s => /^Pochylenie → MIDI CC \d+ · kan \d+$|^Pochylenie → /.test(s || "") && !/ ch \d|Note |Tilt/.test(s || "");
  if (nm0 == null) console.log("INFO 2.2 " + lang + ": brak wiersza #miList .mi-name — asercje pominięte");
  else {
    // Pierwszy wiersz na instancji może mieć własną nazwę (m.name) — wtedy patrzymy na .mi-arrow (src → dest).
    const nm = /→/.test(nm0) ? nm0 : ((await $txt(page, "#miList .mi-arrow")) || nm0);
    check(L + `2 #miList: nazwa wiersza ${en ? "„Tilt → MIDI CC n · ch n”" : "„Pochylenie → MIDI CC n · kan n”"}`, en ? okEn(nm) : okPl(nm), nm);
    // nagłówek edytora po „Edytuj”: ten sam napis + „✎ Editing:” / „✎ Edytujesz:”
    await page.evaluate(() => document.querySelector('#miList button[data-act="edit"]')?.click()); await sleep(300);
    const head = (await $txt(page, "#miEditor .mie-head")) || "";
    const mlab = await page.evaluate(() => { const w = document.getElementById("mieMetricW"); return w ? (w.childNodes[0].textContent || "").trim() : null; });
    check(L + `2 etykieta metryki w edytorze = „${en ? "Metric" : "Wielkość"}”`, mlab === (en ? "Metric" : "Wielkość"), mlab);
    check(L + `2 .mie-head = „${en ? "✎ Editing:" : "✎ Edytujesz:"} <nazwa>”`, head.startsWith(en ? "✎ Editing:" : "✎ Edytujesz:") && head.includes(nm.split(" → ")[0]) && !(en ? / kan |Nuta / : / ch \d|Note /).test(head), head);
    // przełączenie języka BEZ przeładowania (remember=false → localStorage nietknięte) i z powrotem
    await page.evaluate(l => setLang(l, false), en ? "pl" : "en"); await sleep(400);
    const nmX = /→/.test(nm0) ? await miName() : await $txt(page, "#miList .mi-arrow");
    const headX = (await $txt(page, "#miEditor .mie-head")) || "";
    check(L + `2 po setLang(${en ? "pl" : "en"}) lista przerysowana: ${en ? "„Pochylenie … kan”" : "„Tilt … ch”"}`, en ? okPl(nmX) : okEn(nmX), nmX);
    check(L + `2 po setLang(${en ? "pl" : "en"}) nagłówek edytora przerysowany`, headX.startsWith(en ? "✎ Edytujesz:" : "✎ Editing:") && (en ? okPl : okEn)(headX.replace(/^✎ [^:]+: /, "").replace(/✕$/, "").trim()), headX);
    await page.evaluate(l => setLang(l, false), lang); await sleep(400);
    check(L + "2 po powrocie języka nazwa wiersza jak na początku", (/→/.test(nm0) ? await miName() : await $txt(page, "#miList .mi-arrow")) === nm, await miName());
    await page.evaluate(() => document.getElementById("mieCancel")?.click()); await sleep(200);
    // ściąga Przeglądu: rysuje wiersze MIDI tylko przy włączonej grupie — przestawiamy LOKALNIE (czyste rysowanie) i przywracamy
    const wasOn = await page.evaluate(() => !!state.midi.enabled);
    if (!wasOn) await page.evaluate(() => { state.midi.enabled = true; renderOverview(); });
    await goTab(page, "przeglad"); await sleep(300);
    const ov = await page.$$eval(".ov-midi-row", els => els.map(e => (e.querySelector(".ov-midi-src")?.textContent || "") + " → " + (e.querySelector(".ov-midi-dest")?.textContent || ""))).catch(() => []);
    check(L + `2 ściąga Przeglądu: wiersz MIDI ${en ? "„Tilt → … ch”" : "„Pochylenie → … kan”"}`, ov.length > 0 && ov.every(s => en ? okEn(s) : okPl(s)), ov.join(" | "));
    await page.keyboard.press("Escape");
    if (!wasOn) await page.evaluate(() => { state.midi.enabled = false; renderOverview(); });
  }
  if (tmp22) await page.evaluate(() => { state.midi.mappings = (state.midi.mappings || []).filter(m => m.id !== "uxwalk-tmp22"); renderMidiList(); renderOverview(); });

  // 2.3 — placeholder „dla programu/gry” ma klucz
  await goTab(page, "konfiguracje");
  const ph = await page.$eval("#setupFor", e => e.placeholder).catch(() => null);
  check(L + `3 #setupFor.placeholder = „${en ? "for the program/game" : "dla programu/gry"}”`, ph === (en ? "for the program/game" : "dla programu/gry"), ph);

  // 2.4 — panel „Kapsle” na padzie do grania: nagłówek + podpowiedź (panel jest w DOM także przy wyłączonym Synthu;
  // lokalnie zdejmujemy .off i pokazujemy #playPads, potem przywracamy)
  await goTab(page, "pad"); await goPane(page, "pad", "cfg");
  const caps = await page.evaluate(() => {
    const offs = [...document.querySelectorAll(".pad-sec.off")]; offs.forEach(e => e.classList.remove("off"));
    const pp = document.getElementById("playPads"); const pd = pp ? pp.style.display : null; if (pp) pp.style.display = "grid";
    const h = document.querySelector(".playpad-caps .cap-h");
    const r = { head: h ? (h.firstChild && h.firstChild.nodeType === 3 ? h.firstChild.nodeValue.trim() : "") : null, hint: (document.querySelector(".playpad-caps .cap-h-hint")?.textContent || "").trim() };
    offs.forEach(e => e.classList.add("off")); if (pp) pp.style.display = pd;
    return r;
  });
  check(L + `4 .playpad-caps .cap-h = „${en ? "Capsules" : "Kapsle"}” + podpowiedź`, !!caps && caps.head === (en ? "Capsules" : "Kapsle") && caps.hint === (en ? "click a capsule to set its axes" : "kliknij kapsel, żeby ustawić jego osie"), JSON.stringify(caps));

  // 2.5 — zdublowane klucze: JEDNA definicja (efektywna wartość w przeglądarce, po Object.assign słowników modułowych)
  const eff = await page.evaluate(() => ({ u: I18N_EN["Usuń"], s: I18N_EN["Sposób"], p: I18N_EN["Przester"], pk: I18N_EN["Przycisk kapsla"], ms: I18N_EN["Martwa strefa"], k: I18N_EN["Klawisz dla kierunku GÓRA"] }));
  check(L + "5 I18N_EN w przeglądarce: Usuń=Delete, Sposób=How, Przester=Overdrive, Przycisk kapsla=Capsule button, Martwa strefa=Dead zone, Klawisz…=Key for UP",
    eff.u === "Delete" && eff.s === "How" && eff.p === "Overdrive" && eff.pk === "Capsule button" && eff.ms === "Dead zone" && eff.k === "Key for UP", JSON.stringify(eff));
  // Synth: parametr efektu „Drive” (oś Y / pokrętło), brzmienie „🤘 Overdrive”
  const syn = await page.evaluate(() => ({
    opts: [...document.querySelectorAll("#tab-pad select option")].map(o => o.textContent.trim()).filter(t => /^(Drive|Przester|🤘 Overdrive|🤘 Przester)$/.test(t)),
    fx: (typeof FX_PARAMS !== "undefined") ? FX_PARAMS.drive : null, y: (typeof PAD_Y_META !== "undefined") ? PAD_Y_META.drive.label : null }));
  check(L + `5 Synth: FX_PARAMS.drive / oś Y = „${en ? "Drive" : "Przester"}”, brzmienie „${en ? "🤘 Overdrive" : "🤘 Przester"}”`,
    syn.fx === (en ? "Drive" : "Przester") && syn.y === (en ? "Drive" : "Przester") && syn.opts.includes(en ? "Drive" : "Przester") && syn.opts.includes(en ? "🤘 Overdrive" : "🤘 Przester") && !syn.opts.includes(en ? "Przester" : "Drive"), JSON.stringify(syn));
  // Przełączenie języka BEZ przeładowania na ekranie Synth: setLang woła padRelang() (rf-24), które przerysowuje
  // pady — inaczej węzeł składany przez _gl zostaje w starym języku, a walker w EN podstawia „Overdrive" (para
  // BRZMIENIA) pod parametr „Przester". Parametr nigdy nie brzmi „Overdrive"; „🤘 Overdrive" to brzmienie.
  const synOpts = () => page.evaluate(() => [...document.querySelectorAll("#tab-pad select option")].map(o => o.textContent.trim()).filter(t => /^(Drive|Przester|Overdrive|🤘 Overdrive|🤘 Przester)$/.test(t)));
  await page.evaluate(l => setLang(l, false), en ? "pl" : "en"); await sleep(500);
  const synX = await synOpts();
  check(L + `5 po setLang(${en ? "pl" : "en"}) Synth przerysowany: parametr „${en ? "Przester" : "Drive"}”, brzmienie „${en ? "🤘 Przester" : "🤘 Overdrive"}”, nigdy „Overdrive”`,
    synX.includes(en ? "Przester" : "Drive") && synX.includes(en ? "🤘 Przester" : "🤘 Overdrive") && !synX.includes("Overdrive") && !synX.includes(en ? "Drive" : "Przester"), JSON.stringify(synX));
  await page.evaluate(l => setLang(l, false), lang); await sleep(500);
  const synB = await synOpts();
  check(L + "5 po powrocie języka opcje Synth jak na początku", JSON.stringify(synB) === JSON.stringify(syn.opts), JSON.stringify(synB));
  // „Wielkość": w rf-01 = „Metric" (metryka MIDI: Pochylenie/Obrót); nakładka mówi „Size" atrybutem
  // data-i18n-en na węźle (nie parą w słowniku, bo Object.assign przykrywałby metrykę). Edytor nakładki
  // (#ovmGeom) jest w DOM od startu (rf-41b montuje kartę), walker tłumaczy też węzły ukryte.
  const wk = await page.evaluate(() => ({ dict: I18N_EN["Wielkość"], ovm: (document.querySelector('#ovmGeom .ovm-fl[data-i18n-en="Size"]') || { textContent: null }).textContent }));
  check(L + `5 „Wielkość”: słownik = „Metric”, edytor nakładki = „${en ? "Size" : "Wielkość"}” (data-i18n-en)`,
    wk.dict === "Metric" && (wk.ovm == null || wk.ovm.trim() === (en ? "Size" : "Wielkość")), JSON.stringify(wk));
  if (wk.ovm == null) console.log("INFO 2.5 " + lang + ": brak #ovmGeom .ovm-fl[data-i18n-en] w DOM — sprawdzono tylko słownik");
  // Koło: „Sposób” → „How” (nie „Way”), wyzwalacz „Przycisk kapsla” → „Capsule button”
  await goTab(page, "kolo"); await goPane(page, "kolo", "cfg");
  const wh = await page.evaluate(() => ({
    fl: [...document.querySelectorAll("#tab-kolo .wh-fl")].map(e => e.textContent.trim()).filter(t => /^(How|Way|Sposób)$/.test(t)),
    trig: [...document.querySelectorAll("#tab-kolo select option")].map(o => o.textContent.trim()).filter(t => /^(Capsule button|The capsule's button|Przycisk kapsla)$/.test(t)) }));
  check(L + `5 Koło: .wh-fl „${en ? "How" : "Sposób"}” (nie „Way”), opcja „${en ? "Capsule button" : "Przycisk kapsla"}”`,
    wh.fl.includes(en ? "How" : "Sposób") && !wh.fl.includes("Way") && wh.trig.includes(en ? "Capsule button" : "Przycisk kapsla") && !wh.trig.includes("The capsule's button"), JSON.stringify(wh));
  // Mapowanie: przyciski usuwania = „Delete” (nie „Remove” — „Remove” zostaje tylko tam, gdzie kod podaje je jawnie przez _gl)
  await goTab(page, "mapowanie"); await goPane(page, "mapowanie", "cfg");
  // Świeża kopia Settings/ nie ma ani jednej reguły, więc i ani jednego kosza. Jak w 4.5: regułę
  // rysujemy LOKALNIE (renderRules nie zapisuje), czekamy na walker tłumaczeń i przywracamy listę.
  const rulesTmp = await page.evaluate(() => {
    if (!Array.isArray(state.rules) || state.rules.length || typeof renderRules !== "function") return false;
    window.__uxRulesKeep = state.rules.slice();
    state.rules = [{ id: "uxwalk-tmp25", label: "uxwalk", enabled: true, source: { kind: "filter", metric: "tilt" },
                     cmp: ">", threshold: 30, keySpec: "space", behavior: "once", extraConditions: [] }];
    renderRules(); return true;
  });
  if (rulesTmp) await sleep(300);
  const dels = await page.evaluate(() => [...new Set([...document.querySelectorAll("#tab-mapowanie button")].map(b => (b.getAttribute("aria-label") || b.title || b.textContent).trim()).filter(t => /^(Delete|Remove|Usuń)$/.test(t)))]);
  if (rulesTmp) await page.evaluate(() => { state.rules = window.__uxRulesKeep; delete window.__uxRulesKeep; renderRules(); });
  check(L + `5 Mapowanie: przyciski usuwania = „${en ? "Delete" : "Usuń"}”`, dels.length > 0 && dels.every(t => t === (en ? "Delete" : "Usuń")), JSON.stringify(dels));
  await checksIter2b(page, lang, W);
}

// ===== Iteracja 2 — porcja 2: 2.6–2.10 (komunikaty serwera, martwe klucze, capsule, pisownia UK, notka symulacji)
async function checksIter2b(page, lang, W) {
  const en = lang === "en";
  const L = `[${lang}] 2.`;

  // 2.6 + 2.10 — Połączenie › Komendy. POST /command jest ZASTUBOWANY (W.stubPost): odpowiedź to ten sam
  // JSON, który daje queue_command w ribbitflip_monitor.py, więc żadna komenda nie dociera do instancji.
  await goTab(page, "polaczenie");
  const cmdRes = () => $txt(page, "#cmdResult");
  const res0 = await page.evaluate(() => { const r = document.getElementById("cmdResult"); return r ? [r.textContent, r.className] : null; });
  // (a) zły hex → {ok:false,error:"Nieprawidłowy hex…"} → rf-32 pisze "✕ <error>", walker tłumaczy przez /^✕ (.+)$/
  await W.stubPost(/\/command(\?|$)/, { ok: false, error: "Nieprawidłowy hex (użyj par bajtów, np. 20 10 00)" });
  await page.evaluate(() => { const h = document.getElementById("cmdHex"); if (h) h.value = "zz"; document.getElementById("cmdSend")?.click(); });
  await sleep(400);
  const r1 = await cmdRes();
  check(L + `6 #cmdResult po hex „zz” = „${en ? "✕ Invalid hex (use byte pairs, e.g. 20 10 00)" : "✕ Nieprawidłowy hex (użyj par bajtów, np. 20 10 00)"}”`,
    r1 === (en ? "✕ Invalid hex (use byte pairs, e.g. 20 10 00)" : "✕ Nieprawidłowy hex (użyj par bajtów, np. 20 10 00)"), r1);
  // (b) poprawny hex w symulacji: serwer odpowiada {ok:true,queued} i publikuje zdarzenie SSE "cmd" z werdyktem;
  //     odpowiedź jest zastubowana, a zdarzenie podajemy do onCmd() wprost — ten sam ładunek, który składa
  //     _drain_commands_sim (rf-08 woła onCmd(m) dla t:"cmd").
  await W.stubPost(/\/command(\?|$)/, { ok: true, queued: "201000", uuid: "6e400004-b5a3-f393-e0a9-e50e24dcca9e" });
  await page.evaluate(() => { const h = document.getElementById("cmdHex"); if (h) h.value = "20 10 00"; document.getElementById("cmdSend")?.click(); });
  await sleep(300);
  await page.evaluate(() => onCmd({ t: "cmd", ts: 1, ok: true, sim: true, hex: "201000", uuid: "6e400004-b5a3-f393-e0a9-e50e24dcca9e", error: "symulacja — brak urządzenia (komenda nie wysłana)" }));
  await sleep(300);
  const r2 = await cmdRes();
  const want2 = en ? "○ simulation (no device): 201000 — simulation — no device (command not sent)"
                   : "○ symulacja (brak urządzenia): 201000 — symulacja — brak urządzenia (komenda nie wysłana)";
  check(L + `6/10 #cmdResult po „20 10 00” w symulacji = „${want2}”`, r2 === want2, r2);
  await W.unstubPost(/\/command(\?|$)/);
  // przywracamy wynik sprzed testu (linia jest częścią ekranu, który oglądają kolejne asercje)
  if (res0) await page.evaluate(([t, c]) => { const r = document.getElementById("cmdResult"); if (r) { r.textContent = t; r.className = c; } }, res0);
  // 2.10 — notka „W symulacji komendy nie są wysyłane…” cytuje TEN SAM prefiks, który pokazuje wynik
  const note = (await $txt(page, "#cmdSimNote")) || "";
  if (!note) console.log("INFO 2.10 " + lang + ": #cmdSimNote pusta (instancja nie w symulacji?) — asercja pominięta");
  else check(L + `10 #cmdSimNote cytuje „${en ? "○ simulation (no device)" : "○ symulacja"}”`,
    en ? (/says “○ simulation \(no device\)”\.$/.test(note) && !/symulacja/.test(note)) : /wynik powie „○ symulacja”\.$/.test(note), note.slice(-80));

  // 2.6 — zdania z serwera, które lądują w toastach (OSC, Kontroler › Wii, REST, OBS): słownik + wzorce w
  // przeglądarce, a jeden z nich przepuszczony przez prawdziwy rfToast (DOM #rfSkullNotes, walker tłumaczy).
  const srv = await page.evaluate(() => ["Nie ma takiego urządzenia OSC", "Port musi być z zakresu 1024-65535",
    "Więcej niż 8 urządzeń OSC nie da się dodać. Usuń któreś, żeby zrobić miejsce.", "Windows pokazuje grze najwyżej 4 kontrolery",
    "Nieprawidłowy URL", "Dozwolone tylko http/https", "Niedozwolony nagłówek: host", "Config zbyt duży (max 500 000 bajtów)",
    "Serwer pod tym adresem nie mówi WebSocketem (HTTP/1.1 404 Not Found)", "OBS przysłał ramkę binarną — nieobsługiwane",
    "brak połączenia", "Pusta komenda", "Za długa komenda (max 64 bajty)"].map(s => [s, _i18nTry(s)]));
  const stillPl = srv.filter(([s, t]) => t === s || /[ąćęłńóśźż]/i.test(t));
  check(L + "6 13 zdań błędów serwera (OSC / Wii / REST / OBS / komendy) mają angielskie brzmienie w przeglądarce", stillPl.length === 0, stillPl.map(x => x[0]).join(" | "));
  // Kontroler › Wii: port 80 w polu „port serwera” → panel przywraca stary port I mówi dlaczego (rf-44, zdanie
  // serwera przez rfToast → walker tłumaczy). Walidacja wraca PRZED fetch("/dsu"); stub jest tylko pasem bezpieczeństwa.
  await W.stubPost(/\/dsu(\?|$)/, {});
  const wii = await page.evaluate(async () => {
    const pi = document.querySelector("#padWiiSetup .ph-wii-port input"); if (!pi) return null;
    const before = pi.value; pi.value = "80"; pi.dispatchEvent(new Event("change"));
    await new Promise(r => setTimeout(r, 250));
    return { before, after: pi.value, toast: (document.querySelector("#rfSkullNotes")?.textContent || "").replace(/\s+/g, " ").trim() };
  });
  await W.unstubPost(/\/dsu(\?|$)/);
  if (!wii) console.log("INFO 2.6 " + lang + ": brak #padWiiSetup .ph-wii-port input (instancja bez kapsla?) — toast portu pominięty");
  else check(L + `6 Kontroler › Wii port 80 → toast „${en ? "Port must be in the 1024-65535 range" : "Port musi być z zakresu 1024-65535"}”, port przywrócony`,
    wii.after === wii.before && wii.toast.includes(en ? "Port must be in the 1024-65535 range" : "Port musi być z zakresu 1024-65535") && !(en && /zakresu/.test(wii.toast)), JSON.stringify(wii));
  await sleep(1200);

  // 2.7 — 18 martwych kluczy zdjętych ze słownika (żaden nie wrócił przez Object.assign słowników modułowych)
  const dead = await page.evaluate(() => ["Zakres OSC (min–max)", "Wszystkie mapowania (podgląd)", "Kontroler MIDI / OSC", "Czyj kapsel edytujesz?",
    "Wielkość okienka", "Zestawy startowe", "Presety wyzwalaczy:", "▶ Włącz mysz", "▶ Włącz gałkę", "▶ Włącz krzyżak", "⏹ Wyłącz",
    "Wybierz, czym steruje ruch kapsla", "Ruch kapsla → kursor Windows", "Wyjdź z pełnego ekranu (Esc)", "Schodkowa (4 progi)",
    "Zestaw konfiguracji (setup)", "Skokowe przejścia", "Usuń wybrany zestaw z biblioteki"].filter(k => k in I18N_EN));
  check(L + "7 I18N_EN w przeglądarce bez 18 martwych kluczy", dead.length === 0, dead.join(" | "));

  // 2.8 — EN: „capsule”, nie „puck”/„cap” (wszystkie węzły tekstowe body, także ukryte; „on a cap” = czapka,
  // „caps the” = czasownik); hub mówi „Triki capsules” / „Kapsle Triki”, stopka Myszy bez „puck”.
  const words = await page.evaluate(() => {
    const out = { puck: [], cap: [] }; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const p = n.parentElement; if (!p || p.closest("script,style")) continue;
      const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (!t) continue;
      if (/\bpucks?\b/i.test(t)) out.puck.push(t.slice(0, 60));
      if (/\bcaps?\b/i.test(t.replace(/\bon a cap\b|\bcaps the\b/gi, ""))) out.cap.push(t.slice(0, 60));
    }
    return out;
  });
  if (en) {
    check(L + "8 EN: 0 węzłów tekstowych z „puck” (także ukrytych)", words.puck.length === 0, words.puck.slice(0, 4).join(" | "));
    check(L + "8 EN: 0 węzłów tekstowych z „cap” = kapsel (poza „on a cap”)", words.cap.length === 0, words.cap.slice(0, 4).join(" | "));
    await goTab(page, "mysz"); await goPane(page, "mysz", "cfg");
    const attr = (await $txt(page, "#mAttr")) || "";
    check(L + "8 stopka Myszy (#mAttr) bez „puck”, z „capsule”", attr.length > 0 && !/\bpuck/i.test(attr) && /this particular capsule/.test(attr), attr.slice(0, 120));
  }
  const hub = await page.evaluate(() => (document.body.textContent || "").replace(/\s+/g, " "));
  check(L + `8 hub kapsli: „${en ? "Triki capsules" : "Kapsle Triki"}”, bez „${en ? "Triki devices" : "Urządzenia Triki"}”`,
    hub.includes(en ? "Triki capsules" : "Kapsle Triki") && !hub.includes(en ? "Triki devices" : "Urządzenia Triki"));
  // Okno „Z szablonu…" (Usługi › Aplikacje): wiersze są data-noi18n (treść katalogu, nie etykiety), więc
  // walker ich nie tłumaczy — język wybiera _ra5PackTxt przy budowie. Chip „4 akcje" / „4 actions" i opisy
  // paczek (rf-38, warstwa "en") bez „puck". Otwieramy wprost funkcją (sam DOM, żaden POST) i zamykamy.
  await goTab(page, "restapi");
  const tpl = await page.evaluate(() => {
    if (typeof restAddApiFromTemplate !== "function") return null;
    let m = null; try { m = restAddApiFromTemplate(); } catch (e) { return { err: String(e).slice(0, 120) }; }
    const rows = [...document.querySelectorAll(".ra-tpl-row")];
    const r = { n: rows.length, cnt: [...new Set(rows.map(x => (x.querySelector(".ra-tpl-cnt") || {}).textContent || ""))],
      puck: rows.map(x => x.textContent || "").filter(t => /\bpucks?\b/i.test(t)).length,
      pl: rows.map(x => (x.querySelector(".ra-tpl-cnt") || {}).textContent || "").filter(t => /akcj/.test(t)).length };
    try { if (m && typeof m.close === "function") m.close(); } catch (e) { }
    return r;
  });
  await page.keyboard.press("Escape"); await sleep(200);
  if (tpl == null) console.log("INFO 2.8 " + lang + ": brak restAddApiFromTemplate — okno szablonów pominięte");
  else check(L + `8 okno „Z szablonu…”: chip liczby akcji ${en ? "„n actions” (0 „akcje”)" : "„n akcje/akcji”"}, 0 „puck” w wierszach`,
    !tpl.err && tpl.n >= 5 && tpl.puck === 0 && (en ? (tpl.pl === 0 && tpl.cnt.every(t => /^\d+ actions?$/.test(t))) : tpl.cnt.every(t => /^\d+ akcj[aei]$/.test(t))), JSON.stringify(tpl));

  // 2.9 — pisownia brytyjska na ekranach: Mapowanie › Informacje („Behaviour”), Czujnik („Auto-centre gyro when still”)
  if (en) {
    await goTab(page, "mapowanie"); await goPane(page, "mapowanie", "info");
    const info = await page.evaluate(() => (document.getElementById("tab-mapowanie")?.textContent || "").replace(/\s+/g, " "));
    check(L + "9 Mapowanie › Informacje: „Behaviour”, bez „Behavior”", /\bBehaviour\b/.test(info) && !/\bBehavior\b/.test(info), (info.match(/.{0,30}\bBehavior\b.{0,30}/) || [""])[0]);
    await goPane(page, "mapowanie", "cfg");
    // „Auto-środkowanie przy bezruchu” siedzi w #mAutoTareFld (Mysz, w „Dostrajaniu ruchu”), nie na Czujniku
    await goTab(page, "mysz"); await goPane(page, "mysz", "cfg");
    const tare = (await $txt(page, "#mAutoTareFld")) || "";
    check(L + "9 Mysz #mAutoTareFld: „Auto-centre when still”, bez „center”", /Auto-centre when still/.test(tare) && !/\bcenter(ed)?\b/i.test(tare), tare);
    await goTab(page, "czujnik");
    const sens = await page.evaluate(() => (document.getElementById("tab-czujnik")?.textContent || "").replace(/\s+/g, " "));
    check(L + "9 Czujnik: bez „center”/„centered” (jest „centre”/„centred”)", sens.length > 0 && !/\bcenter(ed)?\b/i.test(sens), (sens.match(/.{0,30}\bcenter(ed)?\b.{0,30}/i) || [""])[0]);
  }
  await checksIter2c(page, lang, W);
}

// ===== Iteracja 2 — porcja 3: 2.11–2.13 (nazwa dostępna zakładki ℹ, wbudowane zestawy w Bibliotece, cudzysłowy)
async function checksIter2c(page, lang, W) {
  const en = lang === "en";
  const L = `[${lang}] 2.`;

  // 2.11 — zakładka ℹ modułu: nazwa dostępna „<nazwa> — <podpowiedź>” bez powtórzonego słowa. rf-05 zdejmuje
  // `title` do data-rftip (walker i18n tłumaczy oba atrybuty tak samo), więc „title == aria-label” z planu
  // sprawdzamy jako: title zdjęty, data-rftip === aria-label.
  await goTab(page, "mapowanie");
  const ib = await page.evaluate(() => { const b = document.getElementById("rfpcTab-mapowanie-info");
    return b ? { a: b.getAttribute("aria-label") || "", tip: b.getAttribute("data-rftip") || "", title: b.getAttribute("title") } : null; });
  const wantA = en ? "About: What this module does and how to use it" : "Informacje: Co robi ten moduł i jak z niego korzystać";
  check(L + `11 #rfpcTab-mapowanie-info aria-label = „${wantA}”`, !!ib && ib.a === wantA, ib && ib.a);
  check(L + "11 nazwa dostępna nie powtarza słowa (bez „Informacje — Informacje” / „About — About”)",
    !!ib && !/^Informacje — Informacje/.test(ib.a) && !/^About — About/.test(ib.a), ib && ib.a);
  check(L + "11 title == aria-label (rf-05 przeniósł title do data-rftip; data-rftip === aria-label)",
    !!ib && ib.title === null && ib.tip === ib.a, ib && (ib.title + " / " + ib.tip));

  // 2.12 — Zestawy › Biblioteka: wiersze „w aplikacji / built in” mają pole „dla” i opis tłumaczone (bez data-noi18n),
  // nazwa pliku zostaje polska; wiersze użytkownika zachowują data-noi18n na obu polach.
  // (ekran Zestawy = data-tab „konfiguracje”; lista Biblioteki wszystkich modułów to #libList)
  await goTab(page, "konfiguracje");
  const rows = await page.evaluate(() => [...document.querySelectorAll("#libList .lib-row")].map(r => ({
    name: r.querySelector(".lib-name")?.textContent || "", own: !!r.querySelector(".lib-chip.own"), kind: r.dataset.kind,
    ownTxt: r.querySelector(".lib-chip.own")?.textContent || "",
    forTxt: r.querySelector(".lib-for")?.textContent ?? null, forNo: !!r.querySelector(".lib-for[data-noi18n]"),
    desc: r.querySelector(".lib-desc")?.textContent || "", descNo: !!r.querySelector(".lib-desc[data-noi18n]") })));
  const builtIn = rows.filter(r => r.own && r.forTxt !== null);
  if (!builtIn.length) console.log("INFO 2.12 " + lang + ": brak wbudowanych zestawów (Presets/) na liście — asercje pominięte");
  else {
    const FOR = en ? ["any game (Xbox pad)", "Spotify, YouTube, any player"] : ["dowolna gra (pad Xbox)", "Spotify, YouTube, dowolny odtwarzacz"];
    const DESC = en ? /^(A general starting point|The capsule)/ : /^(Uniwersalny punkt wyjścia|Kapsel)/;
    check(L + `12 wbudowane zestawy (${builtIn.length}): plakietka „${en ? "built in" : "w aplikacji"}”`, builtIn.every(r => r.ownTxt === (en ? "built in" : "w aplikacji")), builtIn.map(r => r.ownTxt).join("|"));
    check(L + `12 wbudowane: .lib-for ∈ {${FOR.join(", ")}}, bez data-noi18n`, builtIn.every(r => FOR.includes(r.forTxt) && !r.forNo), builtIn.map(r => r.forTxt + (r.forNo ? "(noi18n)" : "")).join(" | "));
    check(L + `12 wbudowane: .lib-desc zaczyna się od ${DESC}, bez data-noi18n`, builtIn.every(r => DESC.test(r.desc) && !r.descNo), builtIn.map(r => r.desc.slice(0, 30)).join(" | "));
    check(L + "12 wbudowane: .lib-name nadal polska nazwa pliku (Pad na… / Media - …)", builtIn.every(r => /^(Pad na|Media - )/.test(r.name)), builtIn.map(r => r.name).join(" | "));
  }
  // tylko ZESTAWY użytkownika (kind=setup bez plakietki): fabryczne koła (Multimedia, Okna…) są `official`,
  // ale ich wiersz nosi chipy kapsli zamiast plakietki, więc po samym DOM nie da się ich odróżnić
  const user = rows.filter(r => r.kind === "setup" && !r.own && (r.forTxt !== null || r.desc));
  if (user.length) check(L + `12 zestawy użytkownika (${user.length}): pole „dla” i opis nadal pod data-noi18n`,
    user.every(r => (r.forTxt === null || r.forNo) && (!r.desc || r.descNo)), user.map(r => r.name).join(" | "));

  // 2.13 — cudzysłowy: na 13 ekranach (podzakładki cfg/lib/info, rozwinięte <details>) TreeWalker po #rfMain,
  // widoczne węzły poza [data-noi18n]. PL: 0 węzłów z „X" (ASCII zamykający). EN: 0 węzłów z „ oraz 0 z ” bez “
  // (cytat zamknięty w tym samym węźle — cytaty rozcięte elementem <b> liczą się per węzeł, stąd „bez “” tylko
  // gdy w węźle nie ma też otwierającego).
  const badPl = [], badEn = [];
  for (const t of TABS) {
    await goTab(page, t);
    const panes = MODS.has(t) ? ["cfg", "lib", "info"] : [null];
    for (const k of panes) {
      if (k) await goPane(page, t, k);
      await openDetails(page);
      const nodes = await page.evaluate(() => {
        const root = document.getElementById("rfMain") || document.body;
        const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
        const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) {
          const s = n.nodeValue.replace(/\s+/g, " ").trim(); if (!s || !/[„”“"]/.test(s)) continue;
          const p = n.parentElement; if (!p || !vis(p) || p.closest("[data-noi18n],script,style")) continue;
          // cytat rozcięty elementem (rf-34: „pochylenie > 30 <b>ORAZ</b> … skok”) — otwierający jest w bloku
          const blk = (p.closest("li,p,td,summary,label,h4,div") || p).textContent || "";
          out.push([s.slice(0, 90), /“/.test(blk)]);
        }
        return out;
      });
      for (const [s, blkEn] of nodes) {
        if (/„[^„”"“]*"/.test(s)) badPl.push(`${t}/${k || "-"}: ${s}`);
        if (en && (/„/.test(s) || (/”/.test(s) && !/“/.test(s) && !blkEn))) badEn.push(`${t}/${k || "-"}: ${s}`);
      }
    }
  }
  if (!en) check(L + "13 PL: 0 widocznych węzłów z „X\" (ASCII zamykający) na 13 ekranach", badPl.length === 0, badPl.slice(0, 4).join(" | "));
  else check(L + "13 EN: 0 widocznych węzłów z „ albo ” bez “ na 13 ekranach", badEn.length === 0, badEn.slice(0, 4).join(" | "));
  // Ekrany z audytu (OSC › Konfiguracja: pusty stan + dziennik; Połączenie): każdy cytat domknięty ” / “…”
  for (const [t, k] of [["osc", "cfg"], ["polaczenie", null]]) {
    await goTab(page, t); if (k) await goPane(page, t, k); await openDetails(page);
    const txt = await page.evaluate(t => (document.getElementById("tab-" + t)?.innerText || "").replace(/\s+/g, " "), t);
    const open = (txt.match(/„/g) || []).length + (txt.match(/“/g) || []).length, close = (txt.match(/”/g) || []).length;
    check(L + `13 ${t}${k ? " › " + k : ""}: cytaty domknięte (otwierających ${open} = zamykających ${close})`, open === close && (!en || !/„/.test(txt)), (txt.match(/.{0,25}[„“”].{0,25}/g) || []).slice(0, 5).join(" | "));
  }
}

// --- ITERACJA 3 (czytelność) ---------------------------------------------------------------
// Wspólne narzędzie kontrastu: kolor tekstu skomponowany na PIERWSZYM nieprzezroczystym tle
// przodka (tak jak skrypt sceptyka czytelności). Zwraca [{sel, i, color, bg, ratio, fontSize,
// text}] dla WIDOCZNYCH elementów pasujących do selektora; pusta tablica = elementu nie ma na
// tym ekranie. Chromium zwraca color-mix() jako `color(srgb …)`, więc parser rozumie oba zapisy.
async function contrastAll(page, sel, limit = 8) {
  return page.evaluate(([sel, limit]) => {
    const parse = (c) => {
      if (!c || c === "transparent") return [0, 0, 0, 0];
      let m = /^rgba?\(([^)]+)\)$/.exec(c);
      if (m) { const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
      m = /^color\(srgb\s+([^)]+)\)$/.exec(c);
      if (m) { const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; }
      return [0, 0, 0, 1];
    };
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
      return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const over = (fg, bg) => [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
    const bgOf = (el) => { const stack = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0) { stack.push(c); if (c[3] === 1) break; } }
      let out = [255, 255, 255]; for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out); return out; };
    const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden"; };
    const out = [];
    [...document.querySelectorAll(sel)].filter(vis).slice(0, limit).forEach((el, i) => {
      const cs = getComputedStyle(el);
      const fg = parse(cs.color), bg = bgOf(el);
      const comp = fg[3] < 1 ? over(fg, bg) : [fg[0], fg[1], fg[2]];
      const l1 = lum(comp), l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
      out.push({ sel, i, color: "rgb(" + comp.map(v => Math.round(v)).join(", ") + ")", raw: cs.color,
        bg: "rgb(" + bg.map(v => Math.round(v)).join(", ") + ")", ratio: Math.round(ratio * 100) / 100,
        fontSize: cs.fontSize, text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 28) });
    });
    return out;
  }, [sel, limit]);
}
// Jeden selektor → jedna asercja „istnieje, ma dokładnie ten kolor i przechodzi AA".
async function checkInk(page, L, sel, want, min = 4.5) {
  const r = await contrastAll(page, sel);
  return check(L + " " + sel + " → " + want + ", kontrast ≥ " + min,
    r.length > 0 && r.every(x => x.color === want && x.ratio >= min),
    r.length ? JSON.stringify(r.slice(0, 3)) : "brak widocznych elementów");
}
// To samo dla elementu, którego ta instancja NIE MA, bo zależy od konfiguracji (świeże Settings/:
// żadnego pada Wii, żadnego mapowania MIDI). `make` (w stronie) wstawia próbkę LOKALNIE, w prawdziwy
// kontener ekranu — tło i dziedziczone style są więc te same, co u elementu z prawdziwego życia —
// a `undo` ją zdejmuje. Nic nie idzie na serwer. Gdy element jest widoczny, próbki nie ma.
async function checkInkProbe(page, L, sel, want, make, undo, min = 4.5) {
  if ((await contrastAll(page, sel)).length) return checkInk(page, L, sel, want, min);
  const made = await page.evaluate(make);
  if (made) await sleep(200);
  const res = await checkInk(page, L + (made ? " (próbka)" : ""), sel, want, min);
  if (made) await page.evaluate(undo);
  return res;
}
// Szerokość i liczba wierszy widocznych bloków prozy — do 3.5 (miara czytania).
const measureTx = (page, sels) => page.evaluate(sels => {
  const out = [];
  for (const s of sels) for (const e of document.querySelectorAll(s)) {
    const r = e.getBoundingClientRect(); if (r.width <= 0) continue;
    const cs = getComputedStyle(e); const lh = parseFloat(cs.lineHeight) || 16;
    out.push([s, Math.round(r.width), cs.maxWidth, Math.round(e.scrollHeight / lh)]);
  }
  return out;
}, sels);

// Ekran + podzakładka „Konfiguracja": poprzednie iteracje zostawiają moduły na „Biblioteka"/„ℹ",
// a bloki mierzone niżej mieszkają w „Konfiguracji". Dla pozycji „Reszty" (Czujnik, Usługi…)
// goPane po prostu nic nie znajduje i zostaje sam ekran.
async function goCfg(page, t) { await goTab(page, t); await goPane(page, t, "cfg"); await sleep(150); }

async function checksIter3(page, lang, W) {
  const L = "[" + lang + "] 3.";
  const INK = "rgb(138, 95, 10)";     // --warn-ink #8a5f0a
  const LINK = "rgb(164, 16, 92)";    // --pink-d  #a4105c (a{} z 07-felt-core.css)

  // 3.1 — Przegląd: nazwa kapsla nosi kolor kapsla WMIESZANY w atrament (40%), nie surowy.
  await goTab(page, "przeglad"); await sleep(400);
  const caps = await contrastAll(page, ".dm-capname");
  check(L + "1 Przegląd: .dm-capname istnieje i każda przechodzi AA na kremie",
    caps.length > 0 && caps.every(c => c.ratio >= 4.5), JSON.stringify(caps.slice(0, 3)));
  // „Triki 1" (#ffcb05) to najgorszy przypadek całej palety DEV_COLORS: 40% daje rgb(122,100,19).
  const yellow = caps.find(c => /Triki/.test(c.text));
  if (yellow) check(L + "1 żółty kapsel: rgb(122, 100, 19) (color-mix 40%), nie #ffcb05",
    yellow.color === "rgb(122, 100, 19)" && yellow.ratio >= 5, JSON.stringify(yellow));
  else console.log("INFO 3.1 " + lang + ": brak kapsla „Triki” na liście — pomiar tylko zbiorczy");
  await page.keyboard.press("Escape"); await sleep(200);

  // 3.2 — poradniki „Jak połączyć…": linki dziedziczą różowy link aplikacji, plakietka jak .row .tag.stat.
  await goCfg(page, "midi"); await openDetails(page); await sleep(200);
  await checkInk(page, L + "2 MIDI", ".setup-body a", LINK, 4.5);
  // Kontroler nie ma już zwijanego „Pełny wirtualny pad…” (UX 261120 B3, P-G3-02): o sterowniku mówi linia gotowości.
  for (const t of ["midi", "osc"]) {
    if (t !== "midi") { await goCfg(page, t); await openDetails(page); await sleep(200); }
    const b = await contrastAll(page, ".setup-badge");
    check(L + "2 " + t + ": .setup-badge → " + INK + ", 11px, kontrast ≥ 4.5",
      b.length > 0 && b.every(x => x.color === INK && x.fontSize === "11px" && x.ratio >= 4.5), JSON.stringify(b.slice(0, 2)));
  }

  // 3.3 — bursztyn jako TEKST → --warn-ink (wartości suwaków, ostrzeżenie Wii, adresy OSC, wartość MIDI).
  await goCfg(page, "czujnik"); await openDetails(page); await sleep(300);
  await checkInk(page, L + "3 Czujnik", ".pcal-resp .num", INK);
  await checkInk(page, L + "3 Czujnik", "#pcalLive", INK);
  await goCfg(page, "kontroler"); await openDetails(page); await sleep(300);
  const unprobe = () => document.querySelectorAll("[data-uxprobe]").forEach(e => e.remove());
  // Ostrzeżenie Wii stoi w instrukcji pada Wii (rf-44 `_padWiiHowto`, wewnątrz .setup-body).
  await checkInkProbe(page, L + "3 Kontroler", ".ph-wii-warn b", INK, () => {
    const h = [...document.querySelectorAll("#tab-kontroler .setup-body")].find(e => e.getBoundingClientRect().width > 0)
      || document.querySelector("#tab-kontroler #padRightCol");
    if (!h) return false;
    const p = document.createElement("p"); p.className = "ph-wii-warn"; p.dataset.uxprobe = "1";
    p.innerHTML = "<b>Windows does not see this controller.</b> probe"; h.appendChild(p); return true;
  }, unprobe);
  await checkInk(page, L + "3 Kontroler", ".pl-you", INK);
  // Plakietka pada Wii: kopia widocznego .ov-padbox z data-kind="wii" (bez data-dev — nikt jej nie odświeży).
  await checkInkProbe(page, L + "3 Kontroler", '.ov-padbox[data-kind="wii"] .gpv-kind', INK, () => {
    const pb = [...document.querySelectorAll(".ov-padbox")].find(e => e.getBoundingClientRect().width > 0);
    if (!pb) return false;
    const c = pb.cloneNode(true); c.dataset.kind = "wii"; c.dataset.uxprobe = "1"; c.removeAttribute("data-dev");
    c.querySelectorAll("[id]").forEach(e => e.removeAttribute("id"));
    pb.parentNode.insertBefore(c, pb.nextSibling); return true;
  }, unprobe);
  await goCfg(page, "osc"); await sleep(300);
  await checkInk(page, L + "3 OSC", ".osc-dev-adr", INK);
  await goCfg(page, "midi"); await sleep(300);
  // Wartość na żywo ma tylko wiersz mapowania — mapowanie dokładamy lokalnie, jak w 2.2.
  await checkInkProbe(page, L + "3 MIDI", ".mi-liveval", INK, () => {
    if (typeof renderMidiList !== "function" || !state.midi) return false;
    (state.midi.mappings = state.midi.mappings || []).push({ id: "uxwalk-tmp33", enabled: true, srcKind: "filter", metric: "tilt", dest: "cc", cc: 1, midiCh: 1, mode: "continuous" });
    renderMidiList(); return true;
  }, () => { state.midi.mappings = (state.midi.mappings || []).filter(m => m.id !== "uxwalk-tmp33"); renderMidiList(); });
  // Bursztyn jako RYSUNEK zostaje jasny: suwak (accent-color) nie może pociemnieć razem z napisami.
  await goCfg(page, "czujnik"); await sleep(250);
  const acc = await page.evaluate(() => { const s = document.querySelector(".posecal input[type=range]");
    return s ? getComputedStyle(s).accentColor : null; });
  check(L + "3 suwaki strojenia nadal jasnobursztynowe (--az, nie --warn-ink)",
    acc === null || acc === "rgb(200, 151, 26)", acc);

  await checksIter3b(page, lang, W);
}

async function checksIter3b(page, lang, W) {
  const L = "[" + lang + "] 3.";

  // 3.4 — UX 261120 (P-G0-03): wybrana pozycja nawigacji to kremowa naszywka (--panel), róż = akcja.
  await goCfg(page, "midi"); await sleep(200);
  const nav = await page.evaluate(() => { const a = document.querySelector(".rnav-btn.active");
    return a ? { tab: a.dataset.tab, bg: getComputedStyle(a).backgroundColor } : null; });
  check(L + "4 .rnav-btn.active tło = rgb(250, 246, 238) (--panel, naszywka)", !!nav && nav.bg === "rgb(250, 246, 238)", JSON.stringify(nav));
  const navEl = await page.$(".rnav-btn.active");
  if (navEl) {
    await navEl.hover(); await sleep(250);
    const hov = await page.evaluate(() => getComputedStyle(document.querySelector(".rnav-btn.active")).backgroundColor);
    check(L + "4 ...a pod kursorem rgb(245, 238, 222) (--panel2)", hov === "rgb(245, 238, 222)", hov);
    await page.mouse.move(4, 4); await sleep(150);
  }
  const pill = await page.evaluate(() => { const a = document.querySelector(".rfpc-tab.on:not(.is-ic)");
    return a ? getComputedStyle(a).backgroundColor : null; });
  check(L + "4 pigułka .rfpc-tab.on (z napisem) to kremowa naszywka rgb(250, 246, 238)", pill === "rgb(250, 246, 238)", pill);
  const navC = await contrastAll(page, ".rnav-btn.active");
  check(L + "4 biały napis na wybranej pozycji ≥ 4,5", navC.length > 0 && navC[0].ratio >= 4.5, JSON.stringify(navC[0] || null));

  // 3.5 — miara czytania: proza 86ch, notki 78ch; nic z tej listy nie idzie na pełną szerokość kolumny.
  const WIDE = [".setup-body p", ".setup-body li", ".ra-lead"];            // 86ch
  const NARROW = [".setup-note", ".ra-note", ".mi-grouphint", ".rfpc-state-tx", ".pcal-hint", ".lib-explain"];  // 78ch
  for (const vp of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(vp); await sleep(400);
    for (const t of ["midi", "osc", "kontroler", "restapi", "konfiguracje", "czujnik"]) {
      await goCfg(page, t); await openDetails(page); await sleep(200);
      const wide = (await measureTx(page, WIDE)).filter(x => x[1] > 300);
      const narrow = (await measureTx(page, NARROW)).filter(x => x[1] > 300);
      // 86ch ≈ 600–690 px (proza 12–13 px), 78ch ≈ 480–600 px (notki 12 px) — sprawdzamy przedział,
      // bo `ch` zależy od rozmiaru pisma węzła, a nie od jednej liczby wpisanej w arkuszu.
      const okW = wide.every(x => /px$/.test(x[2]) && parseFloat(x[2]) >= 560 && parseFloat(x[2]) <= 700 && x[1] <= 700);
      const okN = narrow.every(x => /px$/.test(x[2]) && parseFloat(x[2]) >= 470 && parseFloat(x[2]) <= 600 && x[1] <= 620);
      if (wide.length) check(L + "5 @" + vp.width + " " + t + ": proza (" + wide.length + ") ma miarę 86ch (≤700 px)", okW, JSON.stringify(wide.slice(0, 3)));
      if (narrow.length) check(L + "5 @" + vp.width + " " + t + ": notki (" + narrow.length + ") mają miarę 78ch (≤620 px)", okN, JSON.stringify(narrow.slice(0, 3)));
      // Selektory wyżej pytają o `p` i `li`, więc akapit zapisany jako GOŁY węzeł tekstowy wprost
      // w `.setup-body` przechodziłby obok miary niezauważony (tak było w blokach „Jak połączyć…”
      // na MIDI i Kontrolerze). Ten warunek patrzy na to, czego tamte selektory nie widzą.
      const loose = await page.evaluate(() => {
        const out = [];
        for (const b of document.querySelectorAll(".setup-body")) {
          if (!b.offsetParent) continue;
          for (const n of b.childNodes) {
            if (n.nodeType !== 3 || n.nodeValue.replace(/\s+/g, " ").trim().length < 40) continue;
            const r = document.createRange(); r.selectNode(n);
            out.push([Math.round(r.getBoundingClientRect().width), n.nodeValue.trim().slice(0, 48)]);
          }
        }
        return out;
      });
      check(L + "5 @" + vp.width + " " + t + ": w „Jak połączyć…” nie ma prozy poza miarą",
        loose.every(x => x[0] <= 700), JSON.stringify(loose.slice(0, 3)));
      // Znacznik <p> pojawił się tu WYŁĄCZNIE po to, żeby akapit złapał miarę 86ch, więc nie może
      // przynieść ze sobą domyślnych marginesów przeglądarki (1em = 13 px): nagłówek stałby wtedy
      // bliżej cudzego bloku (12 px) niż własnego tekstu i grupowanie czytałoby się odwrotnie.
      // Mierzymy odstępy, a nie liczbę w arkuszu — collapsing marginesów widać dopiero w układzie.
      const rhythm = await page.evaluate(() => {
        const out = [];
        for (const b of document.querySelectorAll(".setup-body")) {
          if (!b.offsetParent) continue;
          const kids = [...b.children];
          for (let i = 1; i < kids.length - 1; i++) {
            if (kids[i].tagName !== "H4" || kids[i + 1].tagName !== "P") continue;
            const a = kids[i - 1].getBoundingClientRect(), h = kids[i].getBoundingClientRect(), p = kids[i + 1].getBoundingClientRect();
            out.push([Math.round(h.top - a.bottom), Math.round(p.top - h.bottom), kids[i].textContent.trim().slice(0, 22)]);
          }
        }
        return out;
      });
      if (rhythm.length) check(L + "5 @" + vp.width + " " + t + ": akapit trzyma rytm karty (odstęp pod h4 mniejszy niż nad)",
        rhythm.every(x => x[1] <= 6 && x[1] < x[0]), JSON.stringify(rhythm.slice(0, 3)));
    }
  }
  // Rozstrzygnięcie duplikatu uklad-09: .rfpc-state-tx na Usługach @1920 mieści się w dwóch wierszach…
  await page.setViewportSize({ width: 1920, height: 1080 }); await sleep(300);
  await goCfg(page, "restapi"); await sleep(250);
  const st1920 = (await measureTx(page, [".rfpc-state-tx"]))[0];
  check(L + "5 @1920 Usługi: .rfpc-state-tx ≤ 560 px i ≤ 2 wiersze (uklad-09)",
    !!st1920 && st1920[1] <= 560 && st1920[3] <= 2, JSON.stringify(st1920));
  // …a przy 1280 zdanie „Triki 1 ma ustawienia bez nazwy…" nie łamie się na trzy wiersze (gdyby
  // się łamało, plan przewiduje 88ch dla tego jednego selektora).
  await page.setViewportSize({ width: 1280, height: 800 }); await sleep(400);
  await goCfg(page, "mapowanie"); await sleep(250);
  const st1280 = (await measureTx(page, [".rfpc-state-tx"]))[0];
  check(L + "5 @1280 Mapowanie: .rfpc-state-tx ≤ 2 wiersze (albo brak paska przy pustym module)", !st1280 || st1280[3] <= 2, JSON.stringify(st1280));
  await page.setViewportSize({ width: 1440, height: 900 }); await sleep(300);

  await checksIter3c(page, lang, W);
}

// --- ITERACJA 3, druga porcja (3.6-3.10) ----------------------------------------------------
// Czerwień napisów, ＋ nakładki, zielenie stanu, strzałki kolejności koła i rozwinięte skróty.
// Wszystko lokalnie w DOM: 3.7 podmienia `--dcol` na `.ovl-cap` (styl inline, przywracany),
// 3.8 przestawia `state.power.parked` i woła `renderPowerState()` — żadnego kliknięcia w „Uśpij”
// i żadnego POST-a.
async function checksIter3c(page, lang, W) {
  const L = "[" + lang + "] 3.";
  const RED = "rgb(184, 38, 74)";     // --bad-ink #b8264a
  const GRN = "rgb(70, 120, 31)";     // --green-d #46781f
  const INK = "rgb(138, 95, 10)";     // --warn-ink #8a5f0a
  const en = lang === "en";

  // 3.6 — „Off” przy przelączniku KAŻDEGO modułu: czerwień do tekstu, 12 px (było --bad @11 px).
  const offs = [];
  for (const t of ["mapowanie", "kolo", "mysz", "kontroler", "midi", "osc", "restapi", "pad", "konfiguracje", "ustawienia"]) {
    await goCfg(page, t);
    const r = await contrastAll(page, ".rf-toggle:not(.on) .rf-tg-lbl.off", 6);
    for (const x of r) offs.push(Object.assign({ tab: t }, x));
  }
  check(L + "6 „Off” przelącznika modułu: " + RED + " i ≥ 4,5 na " + offs.length + " napisach",
    offs.length >= 6 && offs.every(x => x.color === RED && x.ratio >= 4.5),
    JSON.stringify(offs.filter(x => x.color !== RED || x.ratio < 4.5).slice(0, 3)) || JSON.stringify(offs.slice(0, 1)));
  // Próg z planu (5,5) dotyczy PAPIERU karty. Kafel kapsla w kole ma własne, ciemniejsze tło
  // (#f1e5c3) i tam ta sama czerwień daje 4,9 — nadal AA, ale nie 5,5; dlatego mocniejszy próg
  // jest pytany tylko o napisy stojące na --panel / --panel2.
  const onPaper = offs.filter(x => x.bg === "rgb(250, 246, 238)" || x.bg === "rgb(245, 238, 222)");
  check(L + "6 ...a na papierze karty (" + onPaper.length + ") sięga 5,3",
    onPaper.length >= 5 && onPaper.every(x => x.ratio >= 5.3),
    JSON.stringify(onPaper.filter(x => x.ratio < 5.3).slice(0, 3)));
  await goCfg(page, "midi");
  const lbl = await page.evaluate(() => { const e = document.querySelector("#miEnable .rf-tg-lbl.off");
    return e ? getComputedStyle(e).fontSize : null; });
  check(L + "6 ...i rośnie do 12 px", lbl === "12px", lbl);
  // Bliźniak z Mapowania, celowo mniejszy (14c-controller.css) — ale już nie poniżej 11 px.
  await goCfg(page, "kontroler");
  // 2026-09-08: lustro zniknęło — przyciski pada słuchają włącznika modułu w nagłówku karty.
  const mir = await page.evaluate(() => !!document.querySelector("#padTrigEnable"));
  check(L + "6 lustrzany przelącznik Kontrolera już nie istnieje (pad słucha nagłówka karty)", mir === false, mir);
  // Nagłówek modułu nie łamie się od większego napisu — ta sama wysokość przy 1440 i 1380.
  const headAt = async (w) => { await page.setViewportSize({ width: w, height: 900 }); await sleep(350);
    await goCfg(page, "kontroler");
    return page.evaluate(() => [...document.querySelectorAll("#tab-kontroler .card>.head")]
      .slice(0, 4).map(e => Math.round(e.getBoundingClientRect().height))); };
  const h1440 = await headAt(1440), h1380 = await headAt(1380);
  check(L + "6 nagłówki kart Kontrolera nie łamią się przy 1380 (te same wysokości co @1440)",
    h1440.length > 0 && JSON.stringify(h1440) === JSON.stringify(h1380), h1440 + " vs " + h1380);
  await page.setViewportSize({ width: 1440, height: 900 }); await sleep(300);
  // Stop awaryjny: pigułka stanu i „Wyłącz wszystko teraz” — dwa najczerwieńsze napisy panelu.
  await goCfg(page, "ustawienia");
  await checkInk(page, L + "6 Konfiguracja", "#hkPill", RED, 5.3);
  // UX 261120 B5a: „Wyłącz wszystko teraz” to czerwony filcowy `.btn.danger` (14d) z białym napisem.
  await checkInk(page, L + "6 Konfiguracja", "#hkPanicNow", "rgb(255, 255, 255)", 4.4);
  // „Usuń” w rzędzie działań pokazuje się tylko przy wybranej pozycji biblioteki — mierzymy, gdy jest.
  const dng = await contrastAll(page, ".rfpc-acts .btn.danger,.rfpc-state-acts .btn.danger,.lib-dacts .btn.danger", 4);
  if (dng.length) check(L + "6 „Usuń” w rzędzie działań: " + RED + ", ≥ 6,0",
    dng.every(x => x.color === RED && x.ratio >= 6.0), JSON.stringify(dng.slice(0, 2)));
  else console.log("INFO 3.6 " + lang + ": żaden rząd działań z „Usuń” nie jest teraz widoczny — kolor sprawdza test_ui_tabs (n5)");

  // 3.7 — Nakładka: ＋ nosi kolor kapsla na tle i obrysie, glif jest atramentem.
  await goTab(page, "wszystkie"); await sleep(600);
  const addBase = await contrastAll(page, ".ovl-add", 6);
  check(L + "7 Nakładka: glif ＋ w --ink (rgb(33, 31, 29)) i ≥ 4,5 na kolorze kapsla",
    addBase.length > 0 && addBase.every(x => x.color === "rgb(33, 31, 29)" && x.ratio >= 4.5),
    JSON.stringify(addBase.slice(0, 2)));
  if (addBase.length) {
    // Cała paleta DEV_COLORS, nie tylko kapsel, który akurat stoi na tej instancji.
    const saved = await page.evaluate(() => [...document.querySelectorAll(".ovl-cap")].map(e => e.style.getPropertyValue("--dcol")));
    for (const col of ["#ffcb05", "#a6d861", "#1f93c9", "#ec1a83"]) {
      await page.evaluate(c => document.querySelectorAll(".ovl-cap").forEach(e => e.style.setProperty("--dcol", c)), col);
      await sleep(120);
      const r = await contrastAll(page, ".ovl-add", 6);
      check(L + "7 ...także przy --dcol " + col,
        r.length > 0 && r.every(x => x.ratio >= 4.5), JSON.stringify(r.slice(0, 1)));
    }
    await page.evaluate(v => document.querySelectorAll(".ovl-cap").forEach((e, i) => {
      if (v[i]) e.style.setProperty("--dcol", v[i]); else e.style.removeProperty("--dcol"); }), saved);
  }

  // 3.8 — zielenie stanu. Kolor wrócił z atrybutu do arkusza, więc da się go w ogóle zmierzyć.
  await goCfg(page, "polaczenie"); await sleep(300);
  const pw = await page.evaluate(() => { const e = document.getElementById("pwState");
    return e ? { cls: e.className, inline: e.style.color } : null; });
  check(L + "8 Połączenie: #pwState ma klasę is-on i żadnego koloru w atrybucie",
    !!pw && /\bis-on\b/.test(pw.cls) && pw.inline === "", JSON.stringify(pw));
  await checkInk(page, L + "8 Połączenie", "#pwState", GRN, 4.5);
  // Stan „uśpiony” bez klikania „Uśpij”: przestawiamy model i przerysowujemy sam napis.
  await page.evaluate(() => { window.__rfPark = state.power.parked; state.power.parked = true; renderPowerState(); });
  await sleep(150);
  await checkInk(page, L + "8 Połączenie (uśpiony)", "#pwState", INK, 4.5);
  await page.evaluate(() => { state.power.parked = window.__rfPark; renderPowerState(); delete window.__rfPark; });
  await sleep(150);
  // Tag IMU w dzienniku surowych ramek — pojawia się dopiero, gdy przyjdą pakiety.
  await goCfg(page, "czujnik"); await sleep(2600);
  const imu = await contrastAll(page, ".row .tag.imu", 4);
  if (imu.length) check(L + "8 Czujnik: tag IMU rgb(55, 84, 30) i ≥ 6,1",
    imu.every(x => x.color === "rgb(55, 84, 30)" && x.ratio >= 6.1), JSON.stringify(imu.slice(0, 2)));
  else console.log("INFO 3.8 " + lang + ": dziennik surowych ramek pusty — tag IMU sprawdza test_ui_tabs (n12)");
  // „● symulacja” w główce arkusza — w panelu bywa zwinięta do zera, mierzymy, gdy widać.
  await goTab(page, "przeglad"); await sleep(500);
  const conn = await contrastAll(page, ".ov-conn.on", 4);
  if (conn.length) check(L + "8 Arkusz: „podłączony/symulacja” " + GRN + " i ≥ 4,5",
    conn.every(x => x.color === GRN && x.ratio >= 4.5), JSON.stringify(conn.slice(0, 2)));
  else console.log("INFO 3.8 " + lang + ": główka arkusza niewidoczna na tym ekranie — kolor sprawdza test_ui_tabs (n10/n11)");
  await page.keyboard.press("Escape"); await sleep(200);

  // 3.9 — ▴▾ kolejności wycinków: cel co najmniej 28×24 px (UX 261120, P-G1-10).
  await goCfg(page, "kolo"); await sleep(500);
  const ord = await page.evaluate(() => {
    const up = document.querySelector(".wh-up"), col = document.querySelector(".wh-ord"),
          row = document.querySelector(".wh-slice-main");
    return up ? { fs: getComputedStyle(up).fontSize, w: Math.round(up.getBoundingClientRect().width),
      h: Math.round(up.getBoundingClientRect().height), col: Math.round(col.getBoundingClientRect().height),
      row: Math.round(row.getBoundingClientRect().height) } : null; });
  if (ord) {
    check(L + "9 Koło: ▴ ma co najmniej 28×24 px",
      ord.w >= 28 && ord.h >= 24, JSON.stringify(ord));
    check(L + "9 ...kolumna ▴▾ to dwa takie cele, a wiersz wycinka nie urósł ponad 120 px",
      ord.col <= 52 && ord.row <= 120, JSON.stringify(ord));
  } else console.log("INFO 3.9 " + lang + ": koło bez wycinków — rozmiary sprawdza tests/test_wheel.py");

  // 3.10 — skróty rozwinięte w OBU językach (klucz EN przepisany razem z polskim napisem).
  // Etykieta jest krótka („oś:", nie „oś czujnika:") — patrz komentarz w rf-08-sse-ui.js: dłuższa
  // wersja łamała się na 3-4 wiersze kapitalików przy 1280-1440 px i rozpychała kartę kanału.
  const AX = en ? "axis:" : "oś:";
  const HINT = en ? "raw sensor counts (LSB) · auto-detect gravity/motion"
                  : "surowe odczyty czujnika (LSB) · auto-detekcja grawitacji/ruchu";
  await goCfg(page, "czujnik"); await sleep(400);
  const grps = await page.evaluate(() => [...document.querySelectorAll("#axes .grp")].map(e => e.textContent.trim()));
  check(L + "10 Czujnik: każdy kanał zaczyna się od „" + AX + "” (" + grps.length + ")",
    grps.length > 0 && grps.every(t => t.startsWith(AX)), JSON.stringify(grps.slice(0, 2)));
  const hint = await page.evaluate(() => (document.querySelector("#axesCard .hint") || {}).textContent);
  check(L + "10 ...a podpowiedź karty zbiorczej mówi, czym jest LSB", (hint || "").trim() === HINT, hint);
  // …i nie rozpycha nagłówka karty: `.grp` to kapitaliki 10 px w jednym wierszu z „CHn".
  for (const vw of [1280, 1440]) {
    await page.setViewportSize({ width: vw, height: 900 }); await sleep(450);
    const gl = await page.evaluate(() => [...document.querySelectorAll("#axes .axis .grp")].map(g => {
      const cs = getComputedStyle(g), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      return Math.round(g.getBoundingClientRect().height / lh);
    }));
    check(L + "10 @" + vw + " nagłówek kanału mieści etykietę osi w ≤ 2 wierszach",
      gl.length > 0 && gl.every(n => n <= 2), JSON.stringify(gl));
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await sleep(300);
  await goCfg(page, "polaczenie"); await sleep(300);
  const batt = await page.evaluate(() => (document.getElementById("pwBatt") || {}).parentElement?.textContent || "");
  check(L + "10 Połączenie: odczyt baterii mówi „Bluetooth”, nie „BLE”",
    batt.includes(en ? "Bluetooth queries" : "przez Bluetooth") && !/\bBLE\b/.test(batt), batt.trim());

  await checksIter3d(page, lang, W);
}

// --- ITERACJA 3, trzecia porcja (3.11) ------------------------------------------------------
// Szerokość dymka `#rf-tip`. Najdłuższe podpowiedzi mają 200-240 znaków i w 264 px stawały się
// ścianą 6-7 wierszy; rf-05 nakłada teraz klasę `rf-tip-long` (> 160 znaków PO tłumaczeniu),
// a 10-icons-controls.css daje jej 360 px. Asercje tylko NAJEŻDŻAJĄ kursorem (syntetyczny
// `mouseover`, potem `mouseout`) — dymek jest `pointer-events:none`, nic nie klikamy.
// Mierzymy tekst PO tłumaczeniu, bo EN bywa dłuższy niż PL (np. „Napęd części”: 177 zn. PL,
// 240 zn. EN), więc próg musi patrzeć na to, co użytkownik naprawdę czyta.
async function tipOf(page, sel) {
  return page.evaluate(async (sel) => {
    const el = document.querySelector(sel); if (!el) return null;
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: 240, clientY: 320 }));
    await new Promise(r => setTimeout(r, 120));
    const tp = document.getElementById("rf-tip");
    if (!tp || tp.style.display !== "block") return { shown: false };
    const cs = getComputedStyle(tp);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
    const inner = tp.getBoundingClientRect().height - parseFloat(cs.paddingTop)
      - parseFloat(cs.paddingBottom) - 2 * parseFloat(cs.borderTopWidth);
    const out = { shown: true, long: tp.classList.contains("rf-tip-long"), w: tp.offsetWidth,
      maxw: cs.maxWidth, lines: Math.max(1, Math.round(inner / lh)), len: (tp.textContent || "").length,
      right: Math.round(tp.getBoundingClientRect().right), vw: innerWidth };
    el.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    return out;
  }, sel);
}
// Ta sama próba na WSZYSTKICH dymkach ekranu: niezmiennik brzmi „klasa jest wtedy i tylko wtedy,
// gdy widoczny tekst ma > 160 znaków”, więc jedna pętla pilnuje i długich, i krótkich naraz.
async function tipSweep(page, limit = 14) {
  return page.evaluate(async (limit) => {
    const tp0 = document.getElementById("rf-tip");
    // Najdłuższe NAJPIERW, potem najkrótsze: próba ma zawierać obie strony progu, a pierwsze
    // kilkanaście węzłów w kolejności DOM to na każdym ekranie same krótkie etykiety pasków.
    const all = [...document.querySelectorAll("[data-rftip]")]
      .filter(e => e.getBoundingClientRect().width > 0)
      .sort((a, b) => (b.getAttribute("data-rftip") || "").length - (a.getAttribute("data-rftip") || "").length);
    const half = Math.max(1, Math.ceil(limit / 2));
    const els = [...new Set([...all.slice(0, half), ...all.slice(-half)])];
    const bad = []; let n = 0, nLong = 0;
    for (const el of els) {
      el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: 240, clientY: 320 }));
      await new Promise(r => setTimeout(r, 30));
      const tp = tp0 || document.getElementById("rf-tip");
      if (!tp || tp.style.display !== "block") continue;
      const len = (tp.textContent || "").length, long = tp.classList.contains("rf-tip-long"), w = tp.offsetWidth;
      n++; if (long) nLong++;
      if (long !== (len > 160) || w > 360 || (long && w <= 264)) bad.push({ len, long, w, t: (tp.textContent || "").slice(0, 40) });
      el.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    }
    return { n, nLong, bad };
  }, limit);
}
async function checksIter3d(page, lang, W) {
  const L = "[" + lang + "] 3.";

  // 3.11 — Synth: „🎳 Momentum” to najdłuższy dymek w aplikacji (240 zn. PL / 231 EN).
  await goCfg(page, "pad"); await sleep(300);
  const mom = await tipOf(page, ".pp-momentum");
  check(L + "11 Synth „🎳 Momentum”: dymek ma klasę rf-tip-long i 264 < szerokość ≤ 360",
    !!mom && mom.shown && mom.long && mom.w > 264 && mom.w <= 360, JSON.stringify(mom));
  check(L + "11 ...i mieści się w ≤ 5 wierszach (było 6-7)",
    !!mom && mom.lines <= 5 && mom.len > 160, JSON.stringify(mom));
  // Krótki sąsiad zostaje przy dawnej mierze — szerszy dymek dostają TYLKO długie zdania.
  const lat = await tipOf(page, ".pp-latch");
  check(L + "11 ...a krótki „∞ Zatrzask” nadal ≤ 264 px i bez klasy",
    !!lat && lat.shown && !lat.long && lat.w <= 264, JSON.stringify(lat));

  // Kontroler i Zestawy — dwa pozostałe dymki wymienione w planie.
  await goCfg(page, "kontroler"); await sleep(250);
  const drv = await tipOf(page, "#padPartDrive");
  if (drv && drv.shown) check(L + "11 Kontroler „Napęd części”: szerszy dymek, ≤ 5 wierszy",
    drv.long && drv.w > 264 && drv.w <= 360 && drv.lines <= 5, JSON.stringify(drv));
  else console.log("INFO 3.11 " + lang + ": #padPartDrive niewidoczny na tej instancji");
  await goCfg(page, "konfiguracje"); await sleep(250);
  const exe = await tipOf(page, "#setupExe");
  if (exe && exe.shown) check(L + "11 Zestawy „plik gry”: szerszy dymek, ≤ 5 wierszy",
    exe.long && exe.w > 264 && exe.w <= 360 && exe.lines <= 5, JSON.stringify(exe));
  else console.log("INFO 3.11 " + lang + ": #setupExe niewidoczny na tej instancji");

  // Niezmiennik na całych ekranach: klasa dokładnie wtedy, gdy tekst > 160 znaków, i nigdy > 360 px.
  let n = 0, nLong = 0; const bad = [];
  for (const t of ["pad", "kontroler", "mysz", "czujnik", "konfiguracje"]) {
    await goCfg(page, t);
    const r = await tipSweep(page, 14);
    n += r.n; nLong += r.nLong; for (const b of r.bad) bad.push(Object.assign({ tab: t }, b));
  }
  check(L + "11 próg 160 znaków trzyma się na " + n + " dymkach (" + nLong + " szerokich)",
    n >= 20 && bad.length === 0, JSON.stringify(bad.slice(0, 3)));
}

// ================================ ITERACJA 4 — użyteczność (4.1–4.5) ==========================
// Scenariusze edytora KOŃCZĄ SIĘ „Anuluj"/Escape, a puste stany rysuje się LOKALNIE (state.rules
// podmieniane w evaluate i przywracane) — żaden POST nie wychodzi, Settings/ jest wspólne.
async function checksIter4(page, lang, W) {
  const en = lang === "en";
  const L = "[" + lang + "] 4.";

  // 4.1 — Przegląd: kolumna „Dźwięk (Synth)" ma ODPOWIEDŹ, nie wieczne „sprawdzam…”,
  // i mówi to samo, co kropka Synth w nawigacji (obie czytają XPAD.enabled + wyciszenie kapsla).
  await goTab(page, "przeglad"); await sleep(800);
  const snd = await page.evaluate(() => {
    const c = document.querySelector('.dm-tg[data-col="sound"]:not(.dm-master)');
    const d = document.querySelector('.tab-dot[data-grp="pad"]');
    return c ? { unk: c.classList.contains("unknown"), on: c.classList.contains("on"),
                 lab: c.getAttribute("aria-label") || "", dot: d ? d.classList.contains("on") : null } : null;
  });
  check(L + "1 komórka „Dźwięk (Synth)” nie stoi w „sprawdzam…” (brak klasy unknown)",
    !!snd && !snd.unk, JSON.stringify(snd));
  check(L + "1 ...aria-label kończy się słowem stanu, nie „sprawdzam…”",
    !!snd && new RegExp((en ? "· (on|off)" : "· (włączone|wyłączone)") + "$").test(snd.lab), JSON.stringify(snd));
  check(L + "1 ...i zgadza się z kropką Synth w nawigacji",
    !!snd && snd.dot !== null && snd.on === snd.dot, JSON.stringify(snd));

  // 4.2 — odmowa zapisu mówi PRZY POLU, czego brakuje (pasek #trigMsg bywa 600 px nad widokiem).
  await goTab(page, "mapowanie");
  await page.evaluate(() => __rfNewRule()); await sleep(400);
  await page.evaluate(() => document.getElementById("edSave")?.scrollIntoView({ block: "center" })); await sleep(150);
  await page.evaluate(() => document.getElementById("edSave")?.click()); await sleep(250);
  const m1 = await page.evaluate(() => {
    const m = document.querySelector('#ruleEditor .ed-sec[data-sec="action"] .ed-sec-msg');
    const r = m && m.getBoundingClientRect();
    return { txt: m ? m.textContent.trim() : null, hidden: m ? m.getAttribute("aria-hidden") : null,
             inView: !!r && r.top >= 0 && r.bottom <= window.innerHeight,
             af: document.activeElement ? document.activeElement.id : null,
             err: !!document.querySelector("#ruleEditor .ed-sec.ed-sec-err") };
  });
  check(L + "2 pusta akcja: komunikat przy sekcji „Akcja”, w widoku, z obwódką",
    !!m1 && m1.txt === (en ? "Choose a key / action" : "Wybierz klawisz / akcję") && m1.inView && m1.err && m1.hidden === "true",
    JSON.stringify(m1));
  // Pole składni jest zwinięte pod „Wpisz ręcznie” (UX 261120, P-G1-08), więc fokus idzie na
  // „Naciśnij klawisz…”, a do pola tylko wtedy, gdy człowiek je rozwinął.
  check(L + "2 ...i fokus ląduje na wyborze klawisza", !!m1 && (m1.af === "edCap" || m1.af === "edKey"), JSON.stringify(m1));
  await page.evaluate(() => document.querySelector('#ruleEditor [data-am="seq"]')?.click()); await sleep(250);
  await page.evaluate(() => document.getElementById("edSave")?.click()); await sleep(250);
  const m2 = await page.evaluate(() => {
    const m = document.querySelector('#ruleEditor .ed-sec[data-sec="action"] .ed-sec-msg');
    return { txt: m ? m.textContent.trim() : null, af: document.activeElement ? document.activeElement.id : null };
  });
  check(L + "2 pusta sekwencja: własny komunikat i fokus w polu makra (wcześniej nie było żadnego)",
    !!m2 && m2.txt === (en ? "Enter a sequence" : "Wpisz sekwencję") && m2.af === "edSeq", JSON.stringify(m2));
  await sleep(2700);
  const m3 = await page.evaluate(() => ({
    msg: !!document.querySelector("#ruleEditor .ed-sec-msg"),
    err: !!document.querySelector("#ruleEditor .ed-sec.ed-sec-err") }));
  check(L + "2 ...po 2,6 s znika i komunikat, i obwódka", !m3.msg && !m3.err, JSON.stringify(m3));
  await page.evaluate(() => document.getElementById("edCancel")?.click()); await sleep(200);

  // 4.3 — niezapisany szkic nie znika bez pytania.
  const clean2 = await page.evaluate(async () => {
    __rfNewRule();
    await new Promise(r => setTimeout(r, 300));
    const id1 = state.editing;
    __rfNewRule();
    await new Promise(r => setTimeout(r, 300));
    return { id1, id2: state.editing, dlg: !!document.querySelector(".rfm-card") };
  });
  check(L + "3 dwa razy „Nowy wyzwalacz” bez zmian: bez pytania, nowy szkic",
    !clean2.dlg && clean2.id1 && clean2.id2 && clean2.id1 !== clean2.id2, JSON.stringify(clean2));
  const dirty = await page.evaluate(async () => {
    const e = document.getElementById("edLabel"); e.value = "X"; e.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    __rfNewRule();
    await new Promise(r => setTimeout(r, 400));
    const c = document.querySelector(".rfm-card");
    return { txt: c ? c.textContent.replace(/\s+/g, " ").trim() : null,
             btns: c ? [...c.querySelectorAll("button")].map(b => b.textContent.trim()) : null };
  });
  check(L + "3 wpisany szkic + „Nowy wyzwalacz” → pytanie o porzucenie",
    !!dirty.txt && new RegExp(en ? "Discard the unsaved trigger" : "Porzucić niezapisany wyzwalacz").test(dirty.txt),
    JSON.stringify(dirty).slice(0, 200));
  check(L + "3 ...z „Wróć do edycji” przed „Porzuć” (kolejność jak w rfModal)",
    !!dirty.btns && dirty.btns.length === 2 &&
    dirty.btns[0] === (en ? "Back to editing" : "Wróć do edycji") && dirty.btns[1] === (en ? "Discard" : "Porzuć"),
    JSON.stringify(dirty.btns));
  const back = await page.evaluate(async () => {
    [...document.querySelectorAll(".rfm-card button")][0].click();
    await new Promise(r => setTimeout(r, 350));
    return { label: state._draft && state._draft.label, dlg: !!document.querySelector(".rfm-card") };
  });
  check(L + "3 „Wróć do edycji” zostawia szkic nietknięty", back.label === "X" && !back.dlg, JSON.stringify(back));
  const drop = await page.evaluate(async () => {
    const idBefore = state.editing;
    __rfNewRule();
    await new Promise(r => setTimeout(r, 400));
    [...document.querySelectorAll(".rfm-card button")][1].click();
    await new Promise(r => setTimeout(r, 400));
    return { label: state._draft && state._draft.label, id: state.editing, idBefore,
             clean: JSON.stringify(state._draft) === state._draftBase };
  });
  check(L + "3 „Porzuć” otwiera czysty, NOWY szkic (i odświeża migawkę)",
    drop.label === "" && drop.id && drop.id !== drop.idBefore && drop.clean, JSON.stringify(drop));
  // Ta sama droga przez „Edytuj" w wierszu reguły — tylko jeśli instancja ma jakąś regułę.
  const viaRow = await page.evaluate(async () => {
    const b = document.querySelector('#rulesList .rule [data-a=edit]');
    if (!b) return { skip: true };
    const e = document.getElementById("edLabel"); e.value = "Y"; e.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    b.click();
    await new Promise(r => setTimeout(r, 400));
    const dlg = !!document.querySelector(".rfm-card");
    if (dlg) { [...document.querySelectorAll(".rfm-card button")][0].click(); await new Promise(r => setTimeout(r, 300)); }
    return { skip: false, dlg, label: state._draft && state._draft.label };
  });
  if (viaRow.skip) console.log("INFO 4.3 " + lang + ": instancja nie ma reguły w #rulesList — „Edytuj” pominięte");
  else check(L + "3 „Edytuj” w wierszu pyta tak samo i „Wróć do edycji” zostawia szkic",
    viaRow.dlg && viaRow.label === "Y", JSON.stringify(viaRow));
  // 4.3 (runda 1) — „✋ Nagraj gest" / „⚙ Ustaw ręcznie" przy BRUDNYM szkicu: dopóki nie padnie
  // odpowiedź, te drzwi nie mogą nic po sobie zostawić. Zapamiętany tryb nowej reguły był
  // przestawiany PRZED pytaniem, więc „Wróć do edycji" i tak zmieniało to, w czym otworzy się
  // następny zwykły „+ Nowy wyzwalacz". Sprawdzamy obie odpowiedzi i oddajemy stan zastany.
  const gmode = await page.evaluate(async () => {
    if (typeof gestNewRule !== "function") return { skip: true };
    // Tryb nowej reguły NIE jest już zapamiętywany (UX 261120, P-G1-05): drzwi ustawiają go na
    // jedno otwarcie, potem wraca „advanced”, a localStorage zostaje pusty.
    const LS = "ribbitflip.gest.mode", orig = GEST.mode, origLs = localStorage.getItem(LS);
    const want = orig === "simple" ? "advanced" : "simple";
    const dirtyIt = () => { const e = document.getElementById("edLabel");
                            e.value = "Z"; e.dispatchEvent(new Event("input", { bubbles: true })); };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    if (typeof closeEditor === "function") closeEditor();   // zaczynamy od czystego stanu
    openEditor(null); await wait(250); dirtyIt(); await wait(150);
    gestNewRule(want); await wait(400);
    const asked = !!document.querySelector(".rfm-card");
    [...document.querySelectorAll(".rfm-card button")][0]?.click(); await wait(350);
    const afterBack = { mode: GEST.mode, ls: localStorage.getItem(LS), label: state._draft && state._draft.label };
    dirtyIt(); await wait(150);
    gestNewRule(want); await wait(400);
    [...document.querySelectorAll(".rfm-card button")][1]?.click(); await wait(400);
    const afterDrop = { mode: GEST.mode, ls: localStorage.getItem(LS) };
    GEST.mode = orig;                                  // oddajemy stan zastany (tylko lokalnie)
    if (origLs === null) localStorage.removeItem(LS); else localStorage.setItem(LS, origLs);
    return { skip: false, orig, origLs, want, asked, afterBack, afterDrop };
  });
  if (gmode.skip) console.log("INFO 4.3 " + lang + ": gestNewRule niedostępne");
  else {
    check(L + "3 „Nagraj gest” przy brudnym szkicu też pyta o porzucenie", gmode.asked, JSON.stringify(gmode));
    check(L + "3 ...a „Wróć do edycji” zostawia szkic i nic nie zapamiętuje",
      gmode.afterBack.mode === "advanced" && gmode.afterBack.ls === null && gmode.afterBack.label === "Z",
      JSON.stringify(gmode));
    check(L + "3 ...natomiast „Porzuć” otwiera edytor w wybranym trybie, ale go nie zapamiętuje",
      gmode.afterDrop.mode === "advanced" && gmode.afterDrop.ls === null, JSON.stringify(gmode));
  }
  await page.evaluate(() => document.getElementById("edCancel")?.click()); await sleep(250);
  check(L + "3 po „Anuluj” migawka szkicu jest zdjęta (5.4 rozpozna czysty stan)",
    await page.evaluate(() => state._draftBase === null && state._draft === null));
  // Kontroler: programowe wycelowanie w przycisk pada NIE liczy się jako zmiana.
  await goTab(page, "kontroler"); await sleep(400);
  const pad1 = await page.evaluate(async () => {
    if (typeof padNewRule !== "function") return { skip: true };
    padNewRule("pad:b");
    await new Promise(r => setTimeout(r, 400));
    return { skip: false, dlg: !!document.querySelector(".rfm-card"), key: state._draft && state._draft.keySpec,
             clean: JSON.stringify(state._draft) === state._draftBase };
  });
  if (pad1.skip) console.log("INFO 4.3 " + lang + ": padNewRule niedostępne");
  else {
    check(L + "3 Kontroler: nowa reguła pada celuje w przycisk (`after` nie ginie w opakowaniu rf-43)",
      !pad1.dlg && /^pad:/.test(pad1.key || ""), JSON.stringify(pad1));
    check(L + "3 ...a wypełniony przez aplikację przycisk nie robi szkicu „brudnym”", pad1.clean, JSON.stringify(pad1));
    const pad2 = await page.evaluate(async () => {
      padNewRule("pad:x");
      await new Promise(r => setTimeout(r, 400));
      return { dlg: !!document.querySelector(".rfm-card"), key: state._draft && state._draft.keySpec };
    });
    check(L + "3 ...drugi klik bez zmian też nie pyta", !pad2.dlg && pad2.key === "pad:x", JSON.stringify(pad2));
    await page.evaluate(() => document.getElementById("edCancel")?.click()); await sleep(200);
  }
  await page.keyboard.press("Escape");

  // 4.4 — pierwsze uruchomienie w symulacji: hub nie każe potrząsać kapslem, którego nie ma.
  const hint = await page.evaluate(() => {
    const e = document.querySelector(".rf-rcol .devices-hint") || document.querySelector(".devices-hint");
    const f = document.getElementById("feedHint");
    return { h: e ? e.textContent.replace(/\s+/g, " ").trim() : null, f: f ? f.textContent.trim() : null };
  });
  check(L + "4 podpowiedź hubu zaczyna się od „Symulacja:” / „Simulation:” i nie każe potrząsać",
    !!hint.h && hint.h.startsWith(en ? "Simulation:" : "Symulacja:") && !/Potrząśnij|Shake it/.test(hint.h),
    JSON.stringify(hint).slice(0, 220));
  check(L + "4 ...i wskazuje „Steruj ręcznie” pod kulą",
    !!hint.h && new RegExp(en ? "Take control" : "Steruj ręcznie").test(hint.h), JSON.stringify(hint).slice(0, 220));
  check(L + "4 ...a pozostałe karty symulacji bez zmian (#feedHint)",
    hint.f === (en ? "synthetic stream — simulation" : "strumień syntetyczny — symulacja"), JSON.stringify(hint.f));

  // 4.5 — pusty stan listy wyzwalaczy bez „CH0–CH5" i „0x21". Rysowany LOKALNIE i przywracany.
  await goTab(page, "mapowanie"); await sleep(300);
  const empty = await page.evaluate(async () => {
    const keep = state.rules.slice();
    state.rules = []; renderRules();
    await new Promise(r => setTimeout(r, 400));
    const t = (document.getElementById("rulesList").innerText || "").replace(/\s+/g, " ").trim();
    state.rules = keep; renderRules();
    return t;
  });
  check(L + "5 pusty stan nie mówi „CH0–CH5” ani „0x21”", !/CH0|0x21/.test(empty), empty.slice(0, 160));
  // Od UX 261120 (P-G1-01) pusty stan pyta o ruch i daje sześć kafli plus dwoje drzwi.
  check(L + "5 ...pyta, co ma zrobić kapsel, i daje gotowe ruchy oraz dwie inne drogi",
    empty.includes(en ? "What should the capsule do?" : "Co ma zrobić kapsel?") &&
    empty.includes(en ? "Lean left" : "Pochyl w lewo") &&
    empty.includes(en ? "Set up manually" : "Ustaw ręcznie"), empty.slice(0, 200));
  if (en) check(L + "5 ...i w EN nie ma w nim polskich słów", !PL_RE.test(empty), empty.slice(0, 200));
  await sleep(200);

  await checksIter4b(page, lang, W);
}

// --- ITERACJA 4, druga porcja (4.6-4.7) -----------------------------------------------------
// 4.6 czyta dymek głównego przełącznika (#armBtn) i PODMIENIA LOKALNIE stan skrótu stopu
// awaryjnego (`_hkState` + `_hkRender()` — bez POST /hotkey, bez klikania „Zmień skrót"), na
// koniec przywracając stan sprzed pomiaru. 4.7 przechodzi 8 modułów i czyta zdanie bloku stanu
// `.rfpc-state-tx` — sprawdza tylko te moduły, których nośnik NIE MA jeszcze nazwy (na cudzej
// instancji część z nich nazwę nosi i wtedy zdanie jest inne). Nic nie klika i nic nie zapisuje.
async function checksIter4b(page, lang, W) {
  const en = lang === "en";
  const L = "[" + lang + "] 4.";

  // 4.6 — podpowiedź „Uzbrojone" mówi też, czym wyjść awaryjnie. Kombinacja jest doklejana tylko
  // wtedy, gdy skrót naprawdę działa; instancja testowa ma available=false, więc bez dopisku.
  const tip0 = await page.evaluate(() => {
    const b = document.getElementById("armBtn");
    return b ? { tip: b.getAttribute("data-rftip") || b.title || "", hk: (typeof rfHotkeyKeys === "function") ? rfHotkeyKeys() : "brak" } : null;
  });
  check(L + "6 dymek #armBtn zaczyna się od zdania o głównym przełączniku",
    !!tip0 && tip0.tip.startsWith(en ? "Master output switch." : "Główny przełącznik wyjścia."), JSON.stringify(tip0));
  check(L + "6 ...a bez działającego skrótu nie obiecuje stopu awaryjnego",
    !!tip0 && (tip0.hk ? true : !/Stop awaryjny|Emergency stop/.test(tip0.tip)), JSON.stringify(tip0));
  const tipHk = await page.evaluate(async () => {
    const keep = JSON.parse(JSON.stringify(_hkState));
    const read = () => { const b = document.getElementById("armBtn"); return b ? (b.getAttribute("data-rftip") || b.title || "") : ""; };
    _hkState = { enabled: true, available: true, combo: "alt+r+f", reason: "", check: null }; _hkRender();
    await new Promise(r => setTimeout(r, 150));
    const a = read();
    _hkState = { enabled: true, available: true, combo: "ctrl+alt+q", reason: "", check: null }; _hkRender();
    await new Promise(r => setTimeout(r, 150));
    const b2 = read();
    _hkState = keep; _hkRender();
    await new Promise(r => setTimeout(r, 150));
    return { a, b2, back: read() };
  });
  check(L + "6 działający skrót dopisuje kombinację na końcu dymka",
    tipHk.a.endsWith(en ? "Emergency stop from the keyboard: Alt + R + F." : "Stop awaryjny z klawiatury: Alt + R + F."), JSON.stringify(tipHk));
  check(L + "6 ...i zmienia się razem ze skrótem (dymek nie ma wpisanego „Alt+R+F”)",
    tipHk.b2.endsWith(en ? "Emergency stop from the keyboard: Ctrl + Alt + Q." : "Stop awaryjny z klawiatury: Ctrl + Alt + Q."), tipHk.b2);
  check(L + "6 ...a po przywróceniu stanu skrótu dymek wraca do jednego zdania",
    tipHk.back === tip0.tip, JSON.stringify([tipHk.back, tip0.tip]));

  // 4.7 — zdanie „<kapsel> ma ustawienia bez nazwy…" nazywa to, co zapisujesz, TYM SAMYM słowem,
  // co przycisk pod nim. Sprawdzane tylko tam, gdzie nośnik naprawdę nie ma jeszcze nazwy.
  const NOUN = {
    kolo: en ? /save it as a new wheel/i : /zapisz je jako nowe koło/i,
    pad: en ? /save it as a scene/i : /zapisz go jako scenę/i,
  };
  const DFLT = en ? /save (them|it) as a preset/i : /zapisz (je|to) jako preset/i;
  // …i przycisk POD tym zdaniem (rf-49j3 `paintCfgState`, `words.createBtn`). Do rundy 1 asercja
  // czytała samo zdanie i przepuszczała rozjazd: na Kole zdanie mówiło „nowe koło", a przycisk
  // tuż pod nim „Utwórz preset".
  const BTN = {
    kolo: en ? /^Create a wheel$/i : /^Utwórz koło$/i,
    pad: en ? /^Create a scene$/i : /^Utwórz scenę$/i,
  };
  const BTN_DFLT = en ? /^Create a preset$/i : /^Utwórz preset$/i;
  const NONAME = en ? /(unnamed|no name yet|no saved preset yet)/i : /bez nazwy|nie ma jeszcze nazwy|nie mają jeszcze zapisanego presetu/;
  let seen = 0;
  for (const t of ["mapowanie", "kolo", "mysz", "kontroler", "midi", "osc", "restapi", "pad"]) {
    await goCfg(page, t); await sleep(200);
    const st = await page.evaluate((tab) => {
      const p = document.querySelector("#tab-" + tab + " .rfpc-state-tx");
      const b = document.querySelector("#tab-" + tab + " .rfpc-state-acts button");
      return { tx: p ? p.textContent.replace(/\s+/g, " ").trim() : null,
               btn: b ? b.textContent.replace(/\s+/g, " ").trim() : null };
    }, t);
    const tx = st.tx;
    if (!tx || !NONAME.test(tx)) continue;      // nośnik nosi nazwę — inne zdanie, nie ta pozycja
    seen++;
    check(L + "7 " + t + ": przycisk pod zdaniem nazywa TO SAMO, co zdanie",
      !!st.btn && (BTN[t] || BTN_DFLT).test(st.btn), t + ": „" + st.btn + "” pod „" + tx.slice(0, 120) + "”");
    check(L + "7 " + t + ": zdanie „bez nazwy” nazywa nośnik tak samo, co przycisk pod nim",
      (NOUN[t] || DFLT).test(tx), tx.slice(0, 180));
    check(L + "7 " + t + ": ...i nie mówi już „konfigurację” o czymś, co zapisuje się jako preset",
      !(en ? /an unnamed configuration/ : /ma konfigurację bez nazwy/).test(tx), tx.slice(0, 180));
  }
  check(L + "7 przynajmniej jeden moduł bez nazwy do zbadania", seen > 0, "zbadanych: " + seen);
  await sleep(150);
}

async function checksIter5(page, lang, W) {
  const en = lang === "en";
  const L = `[${lang}] 5.`;
  // Ciężkie przebiegi klawiaturowe iteracji 5 mają własne skrypty (tests/modal_focus_harness.cjs,
  // devedit_focus_harness.cjs, rule_editor_focus_harness.cjs, tabs_dots_a11y_harness.cjs). Tutaj
  // zostaje to, co ma działać na KAŻDYM ekranie i w obu językach: nazwy i opisy dostępne.
  // Żaden scenariusz nie zapisuje — dialogi zamykamy Escape, edytor Escape (czysty szkic).
  const active = () => page.evaluate(() => { const a = document.activeElement; return a ? { id: a.id, cls: String(a.className || ""), card: !!(a.closest && a.closest(".rfm-card")) } : null; });

  // 5.1 — rfModal trzyma fokus i oddaje go nadawcy
  await goTab(page, "mapowanie");
  await page.evaluate(() => { __rfStartBtn().focus(); rfAlert("Test"); });
  await sleep(350);
  check(L + "1 rfAlert zabiera fokus do .rfm-card", (await active())?.card === true, JSON.stringify(await active()));
  await page.keyboard.press("Tab"); await sleep(100);
  check(L + "1 Tab nie wychodzi z karty", (await active())?.card === true, JSON.stringify(await active()));
  await page.keyboard.press("Escape"); await sleep(400);
  check(L + "1 Escape oddaje fokus nadawcy (#addRule albo „Ustaw ręcznie”)", ["addRule", "trigDoorManual"].includes((await active())?.id), JSON.stringify(await active()));

  // 5.2 — okno „Edytuj kapsel" jest dialogiem i wpuszcza fokus (bez Zapisz/Usuń)
  const dev = await page.evaluate(() => { const p = document.querySelector(".rf-rcol .devpill[data-dev]"); return p ? p.dataset.dev : null; });
  if (!dev) console.log("INFO 5.2 pominięte — brak pigułki kapsla w prawej kolumnie");
  else {
    await page.evaluate(d => document.querySelector(`.rf-rcol .devpill[data-dev="${d}"] .dp-edit`).click(), dev);
    await sleep(450);
    check(L + "2 #devEdit ma role=dialog, aria-modal i aria-labelledby=deTitle",
      await page.evaluate(() => !!document.querySelector('#devEdit [role="dialog"][aria-modal="true"][aria-labelledby="deTitle"]')));
    check(L + "2 fokus wszedł do #deName", (await active())?.id === "deName", JSON.stringify(await active()));
    await page.keyboard.press("Escape"); await sleep(400);
    check(L + "2 Escape chowa okno", await page.evaluate(() => getComputedStyle(document.getElementById("devEdit")).display === "none"));
  }

  // 5.3 — Żaden przełącznik modułu nie nazywa się „OffOn"
  const tgs = [];
  for (const t of ["mapowanie", "kolo", "mysz", "kontroler", "midi", "osc", "restapi", "pad", "konfiguracje"]) {
    await goTab(page, t);
    tgs.push(...await page.$$eval(".rf-toggle[role=switch]", els => els.map(e => ({
      id: e.id, cls: String(e.className || ""), al: e.getAttribute("aria-label") || "", tip: e.getAttribute("data-rftip") || "",
      txt: (e.textContent || "").replace(/\s+/g, "").trim() }))));
  }
  const seen = new Map(); tgs.forEach(t => seen.set((t.id || "") + "|" + t.al, t));
  const list = [...seen.values()];
  check(L + `3 ${list.length} przełączników role=switch — każdy ma nazwę dostępną`,
    list.length > 0 && list.every(t => t.al.length > 2), JSON.stringify(list.filter(t => t.al.length <= 2).slice(0, 4)));
  check(L + "3 żaden nie nazywa się „OffOn”",
    list.every(t => !/^Off ?On$/i.test(t.al)), JSON.stringify(list.filter(t => /^Off ?On$/i.test(t.al)).slice(0, 4)));
  // Nieczynny .wh-caps-sw (koło bez dwóch wycinków, klasa `dis` + aria-disabled) ma w dymku POWÓD
  // („Dodaj wycinki, zanim włączysz koło") — to opis stanu, nie druga nazwa; czytnik dostaje go jako
  // opis obok nazwy. Na świeżej kopii Settings/ koło nie ma wycinków, więc to jest właśnie ten stan.
  check(L + "3 nazwa == dymek (poza .wh-caps-sw, który dokleja slot)",
    list.every(t => /wh-caps-sw/.test(t.cls) ? (/\bdis\b/.test(t.cls) ? t.tip.length > 2 : t.al.startsWith(t.tip)) : (!t.tip || t.al === t.tip)),
    JSON.stringify(list.filter(t => !/wh-caps-sw/.test(t.cls) && t.tip && t.al !== t.tip).slice(0, 3)));
  const trig = list.find(t => t.id === "trigEnable");
  check(L + "3 #trigEnable: nazwa zaczyna się od zdania o module Mapowanie",
    !!trig && (en ? /^Turn the Mapping module on or off/ : /^Włącz albo wyłącz moduł Mapowanie/).test(trig.al), trig && trig.al);
  const caps = list.find(t => /wh-caps-sw/.test(t.cls));
  check(L + "3 .wh-caps-sw nadal ma sufiks z nazwą slotu („— d0”)",
    !!caps && /— \w+$/.test(caps.al), caps && caps.al);

  // 5.4 — edytor wyzwalacza: fokus wchodzi, Escape zamyka czysty szkic i oddaje fokus
  await goTab(page, "mapowanie");
  await page.evaluate(() => { __rfStartBtn().focus(); __rfNewRule(); });
  await sleep(500);
  const edSt = () => page.evaluate(() => ({ disp: getComputedStyle(document.getElementById("ruleEditor")).display,
    editing: state.editing, mode: state._edMode, dirty: JSON.stringify(state._draft) !== state._draftBase,
    hasLbl: !!document.getElementById("edLabel"), hasGest: !!document.getElementById("edGesture"),
    dlg: !!document.querySelector(".rfm-card") }));
  check(L + "4 „Ustaw ręcznie” → fokus na #edLabel", (await active())?.id === "edLabel",
    JSON.stringify(await active()) + " " + JSON.stringify(await edSt()));
  await page.keyboard.press("Escape"); await sleep(400);
  check(L + "4 Escape zamyka czysty szkic i oddaje fokus na #addRule albo „Ustaw ręcznie”",
    (await page.evaluate(() => getComputedStyle(document.getElementById("ruleEditor")).display)) === "none" && ["addRule", "trigDoorManual"].includes((await active())?.id),
    JSON.stringify(await active()) + " " + JSON.stringify(await edSt()));

  // 5.5 — stan modułu w nawigacji ma opis, nie tylko kolor
  const descOf = t => page.evaluate(t => {
    const b = document.querySelector(`button.tab-btn[data-tab="${t}"]`); if (!b) return null;
    return (b.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean)
      .map(id => { const n = document.getElementById(id); return n ? n.textContent.trim() : ""; }).join(" ").trim();
  }, t);
  const capsRe = en ? /(On|Off) for the selected capsule/ : /(Włączony|Wyłączony) na wybranym kapslu/;
  const sharedRe = en ? /(On|Off), shared by every capsule/ : /(Włączony|Wyłączony), wspólny dla wszystkich kapsli/;
  for (const t of ["mapowanie", "kolo", "mysz", "kontroler", "midi", "osc", "pad"])
    check(L + `5 „${t}”: opis przycisku mówi o stanie na wybranym kapslu`, capsRe.test(await descOf(t)), await descOf(t));
  check(L + "5 „restapi”: opis mówi „wspólny dla wszystkich kapsli”", sharedRe.test(await descOf("restapi")), await descOf("restapi"));
  check(L + "5 opis NIE wszedł do nazwy pozycji (WCAG 2.5.3)",
    !capsRe.test(await page.evaluate(() => { const b = document.querySelector('button.tab-btn[data-tab="mapowanie"]');
      return b.getAttribute("aria-label") || (b.textContent || "").replace(/\s+/g, " ").trim(); })));
  await sleep(150);
  await checksIter5b(page, lang, W);
}

// Iteracja 5, pozycje 5.6-5.10. Nic tu nie zapisuje: fałda widoczności otwiera się i zamyka
// klawiszem (żaden przełącznik nie jest klikany), edytor wyzwalacza zamyka „Anuluj", a notka
// czaszki (5.10) powstaje wprost przez rfSkullNote — to sam DOM, bez żądania.
async function checksIter5b(page, lang, W) {
  const en = lang === "en";
  const L = `[${lang}] 5.`;
  const active = () => page.evaluate(() => { const a = document.activeElement; return a ? { id: a.id, cls: String(a.className || ""), tab: a.getAttribute("data-tab") } : null; });
  const tipNow = () => page.evaluate(() => { const t = document.getElementById("rf-tip");
    return { disp: t ? t.style.display : "brak", txt: t ? t.textContent.replace(/\s+/g, " ").trim() : "" }; });

  // 5.6 — dymek pokazuje się TAKŻE przy fokusie z klawiatury (WCAG 1.4.13)
  await goTab(page, "mapowanie");
  const kbTip = await page.evaluate(() => {
    const b = document.querySelector(".rf-rcol .devpill .dp-act[data-rftip]") || document.querySelector("#rfMain button[data-rftip]");
    if (!b) return null;
    b.focus();
    return { al: b.getAttribute("aria-label") || "", tip: b.getAttribute("data-rftip") || "" };
  });
  await sleep(200);
  if (!kbTip) console.log("INFO 5.6 pominięte — brak przycisku z dymkiem na tym ekranie");
  else {
    const t1 = await tipNow();
    check(L + "6 fokus z klawiatury pokazuje dymek", t1.disp === "block", JSON.stringify(t1));
    check(L + "6 ...z tym samym tekstem, co nazwa dostępna przycisku",
      !!kbTip.al && t1.txt === kbTip.al.replace(/\s+/g, " ").trim(), JSON.stringify({ t1, al: kbTip.al }));
    await page.keyboard.press("Shift"); await sleep(120);
    check(L + "6 sam modyfikator (Shift) nie chowa dymka", (await tipNow()).disp === "block", JSON.stringify(await tipNow()));
    await page.keyboard.press("Escape"); await sleep(150);
    check(L + "6 Escape chowa dymek", (await tipNow()).disp === "none", JSON.stringify(await tipNow()));
  }
  // Pole tekstowe z podpowiedzią NIE dostaje dymka na fokusie — przykrywałby to, co człowiek pisze.
  await goTab(page, "konfiguracje");
  await page.evaluate(() => document.getElementById("setupExe")?.focus()); await sleep(200);
  check(L + "6 pole tekstowe z podpowiedzią nie zasłania się dymkiem",
    (await tipNow()).disp !== "block", JSON.stringify(await tipNow()));
  await page.evaluate(() => document.activeElement.blur());

  // 5.7 — „Widoczność modułów": fokus wchodzi do szuflady i wraca na oko po Escape
  await goTab(page, "mapowanie");
  await page.evaluate(() => document.getElementById("tabVisBtn").focus());
  await page.keyboard.press("Enter"); await sleep(500);
  const opened = await page.evaluate(() => ({ open: /\bopen\b/.test(document.getElementById("tabVisWrap").className),
    inBox: !!(document.activeElement.closest && document.activeElement.closest("#tabVisBox")),
    isTg: !!(document.activeElement.matches && document.activeElement.matches('#tabVisBox input.tv-tg:not([disabled])')) }));
  check(L + "7 Enter na oku otwiera fałdę i stawia fokus na pierwszym przełączniku",
    opened.open && opened.inBox && opened.isTg, JSON.stringify(opened) + " " + JSON.stringify(await active()));
  await page.keyboard.press("Escape"); await sleep(600);
  const closed = await page.evaluate(() => ({ open: /\bopen\b/.test(document.getElementById("tabVisWrap").className),
    act: document.activeElement.id }));
  check(L + "7 Escape zamyka fałdę i oddaje fokus oku", !closed.open && closed.act === "tabVisBtn", JSON.stringify(closed));

  // 5.8 — suwak progu w warunku wyzwalacza ma nazwę dostępną
  await goTab(page, "mapowanie");
  await page.evaluate(() => __rfNewRule()); await sleep(500);
  const thr1 = await page.evaluate(() => { const r = document.querySelector("#ruleEditor [data-cf=thrRange]"); return r ? r.getAttribute("aria-label") : null; });
  check(L + "8 suwak progu ma nazwę dostępną", thr1 === (en ? "Threshold" : "Próg"), String(thr1));
  const thr2 = await page.evaluate(() => {
    const s = document.querySelector("#ruleEditor select[data-cf=cmp]");
    if (!s || ![...s.options].some(o => o.value === "in")) return null;
    s.value = "in"; s.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  });
  if (thr2) {
    await sleep(400);
    const both = await page.$$eval("#ruleEditor input[type=range][data-cf^=thrRange]", els => els.map(e => e.getAttribute("aria-label")));
    check(L + "8 przy zakresie oba suwaki mówią „od” i „do”",
      JSON.stringify(both) === JSON.stringify(en ? ["From (x)", "To (y)"] : ["Od (x)", "Do (y)"]), JSON.stringify(both));
  } else console.log("INFO 5.8 wariant zakresu pominięty — warunek bez opcji „w zakresie”");
  await page.evaluate(() => document.getElementById("edCancel")?.click()); await sleep(350);
  await page.evaluate(() => { const c = document.querySelector(".rfm-card button"); if (c) c.click(); }); await sleep(250);

  // 5.9 — pola paska „Zapisz zestaw" i wyszukiwarka Biblioteki mają etykiety dostępne
  await goTab(page, "konfiguracje");
  const labs = await page.evaluate(() => ["setupName", "setupFor", "setupExe", "setupDesc", "libFind"]
    .map(id => { const e = document.getElementById(id); return { id, al: e ? (e.getAttribute("aria-label") || "") : null }; }));
  check(L + "9 wszystkie pięć pól ma aria-label", labs.every(x => x.al && x.al.length > 2), JSON.stringify(labs));
  check(L + "9 nazwa pola pliku gry jest krótka (nie 200-znakowa podpowiedź)",
    (labs.find(x => x.id === "setupExe")?.al || "").length < 40, labs.find(x => x.id === "setupExe")?.al);
  if (en) check(L + "9 etykiety przetłumaczone (bez polskich znaków)",
    labs.every(x => !/[ąćęłńóśźż]/i.test(x.al || "")), JSON.stringify(labs));

  // 5.10 — bąbel czaszki mówi przez region aria-live, który istniał PRZED wiadomością
  // (Że region jest PUSTY na starcie, sprawdza tests/tooltip_focus_headless.cjs — tutaj przebieg
  // zdążył już pokazać notkę i region trzyma jej treść, jak każdy region aria-live.)
  const live0 = await page.evaluate(() => { const p = document.getElementById("rfNoteLive"), a = document.getElementById("rfNoteLiveAlert");
    const host = document.getElementById("rfSkullNotes");
    return { p: !!p, pRole: p && p.getAttribute("role"), pLive: p && p.getAttribute("aria-live"),
             a: !!a, aRole: a && a.getAttribute("role"), aLive: a && a.getAttribute("aria-live"),
             inHost: !!(host && p && host.contains(p)), onBody: !!(p && p.parentElement === document.body) }; });
  check(L + "10 oba regiony istnieją i stoją POZA znikającym #rfSkullNotes",
    live0.p && live0.a && live0.pRole === "status" && live0.pLive === "polite"
    && live0.aRole === "alert" && live0.aLive === "assertive" && !live0.inHost && live0.onBody, JSON.stringify(live0));
  await page.evaluate(() => window.rfSkullNote("Test odczytu")); await sleep(250);
  const said = await page.evaluate(() => ({ live: document.getElementById("rfNoteLive").textContent,
    role: document.querySelector(".rss-bubble")?.getAttribute("role"),
    aria: document.querySelector(".rss-bubble")?.getAttribute("aria-live") }));
  check(L + "10 notka trafia do regionu, a bąbel nie jest już drugim regionem",
    said.live === "Test odczytu" && !said.role && !said.aria, JSON.stringify(said));
  await sleep(150);
  await checksIter5c(page, lang, W);
}

// Iteracja 5, pozycje 5.11-5.13. Nic tu nie zapisuje: strzałki w nawigacji przechodzą po ekranach
// (to samo, co robi walk wyżej), edytor wyzwalacza zamyka „Anuluj", a jedyne kliknięcie w środku
// edytora przestawia pole SZKICU (nie ma zapisu bez „Zapisz wyzwalacz").
async function checksIter5c(page, lang, W) {
  const en = lang === "en";
  const L = `[${lang}] 5.`;
  const navInfo = () => page.evaluate(() => {
    const LISTS = ["rfNavTop", "rfNavMod", "rfNavPlay", "rfNavTools", "rfNavApp"];
    const B = [...document.querySelectorAll(LISTS.map(id => "#" + id + " .tab-btn").join(", "))];
    const vis = B.filter(b => b.offsetParent !== null);
    return {
      orient: LISTS.map(id => document.getElementById(id)?.getAttribute("aria-orientation")),
      ctrlBad: B.filter(b => b.getAttribute("aria-controls") !== "tab-" + b.dataset.tab).map(b => b.dataset.tab),
      zero: vis.filter(b => b.tabIndex === 0).map(b => b.dataset.tab),
      minus: vis.filter(b => b.tabIndex === -1).length,
      last: vis.length ? vis[vis.length - 1].dataset.tab : "",
    };
  });

  // 5.11 — nawigacja jako tablist: strzałki chodzą po pozycjach, Tab z niej wychodzi
  await goTab(page, "mapowanie");
  const n0 = await navInfo();
  check(L + "11 wszystkie pięć list nawigacji jest zadeklarowanych jako pionowe",
    n0.orient.length === 5 && n0.orient.every(o => o === "vertical"), JSON.stringify(n0.orient));
  check(L + "11 każda pozycja mówi, którym panelem steruje (aria-controls)",
    n0.ctrlBad.length === 0, JSON.stringify(n0.ctrlBad));
  check(L + "11 roving tabindex: jeden przystanek Tab na całą nawigację (UX 261120)",
    n0.zero.length === 1 && n0.minus > 0, JSON.stringify(n0));
  await page.evaluate(() => document.querySelector('#rfNavMod .tab-btn[data-tab="mapowanie"]').focus());
  await page.keyboard.press("ArrowDown"); await sleep(350);
  const a1 = await page.evaluate(() => ({ f: document.activeElement?.dataset?.tab,
    sel: document.activeElement?.getAttribute("aria-selected"),
    open: document.querySelector(".tab-panel.active")?.id }));
  check(L + "11 strzałka w dół przechodzi na następną pozycję i otwiera jej ekran",
    a1.f === "kolo" && a1.sel === "true" && a1.open === "tab-kolo", JSON.stringify(a1));
  await page.keyboard.press("End"); await sleep(300);
  const a2 = await page.evaluate(() => document.activeElement?.dataset?.tab);
  check(L + "11 End skacze na ostatnią widoczną pozycję", a2 === n0.last, `${a2} vs ${n0.last}`);
  await page.keyboard.press("Home"); await sleep(250);
  await page.keyboard.press("ArrowUp"); await sleep(300);
  const a3 = await page.evaluate(() => document.activeElement?.dataset?.tab);
  check(L + "11 strzałka w górę z pierwszej pozycji zawija na ostatnią", a3 === n0.last, `${a3} vs ${n0.last}`);
  // wyjście Tabem: jedno naciśnięcie z aktywnej pozycji ma wyprowadzić z lewej kolumny
  await goTab(page, "mapowanie");
  // Jeden przystanek na całą nawigację (UX 261120) i link RibbitBeat (zwykły <a>, poza tablistem)
  // = dwa przystanki. Przed zmianą 5.11 było ich trzynaście, od 2026-10-03 cztery.
  await page.evaluate(() => document.querySelector("#rfNavMod .tab-btn.active")?.focus());
  let taps = 0, outNav = false;
  while (taps < 6 && !outNav) {
    await page.keyboard.press("Tab"); await sleep(180); taps++;
    outNav = await page.evaluate(() => !document.activeElement?.closest?.("#rfRail"));
  }
  check(L + "11 dwa Tab wyprowadzają z nawigacji (było trzynaście)", outNav && taps <= 2,
    "naciśnięć=" + taps + " " + await page.evaluate(() => document.activeElement?.className || ""));

  // 5.12 — przyciski segmentowe mówią, który jest wybrany
  await page.evaluate(() => __rfNewRule());
  await sleep(700);
  const seg = await page.evaluate(() => {
    const q = s => [...document.querySelectorAll(s)];
    return {
      open: getComputedStyle(document.getElementById("ruleEditor")).display,
      noPressed: q("#ruleEditor .seg button").filter(b => !b.hasAttribute("aria-pressed")).map(b => b.textContent.trim()),
      noType: q("#ruleEditor .seg button").filter(b => b.type !== "button").length,
      mismatch: q("#ruleEditor .seg button").filter(b => (b.getAttribute("aria-pressed") === "true") !== b.classList.contains("on")).length,
      // Grupy z pozycji 5.12: źródło warunku, zachowanie, rodzaj akcji. Pasek trybu edycji
      // (rf-12e) i „Sposób nagrywania" (rf-12d) doszły z nagrywaniem gestów już PO planie i mają
      // własny widoczny podpis — ich nazwanie to osobna zmiana razem z ich kluczami EN.
      groups: q("#ruleEditor .seg").filter(g => g.querySelector("button[data-ck],button[data-b],button[data-am]"))
        .filter(g => !g.getAttribute("aria-label")).length,
      h: q("#ruleEditor .ed-sec-h").map(x => x.tagName),
    };
  });
  check(L + "12 każdy przycisk segmentowy edytora ma aria-pressed i type=button",
    seg.open === "block" && seg.noPressed.length === 0 && seg.noType === 0, JSON.stringify(seg));
  check(L + "12 ...zgodne z tym, który jest zapalony", seg.mismatch === 0, String(seg.mismatch));
  check(L + "12 każda grupa segmentowa ma nazwę", seg.groups === 0, String(seg.groups));
  check(L + "13 sekcje edytora to H3 (pod h1 modułu i h2 karty)",
    seg.h.length > 0 && seg.h.every(t => t === "H3"), JSON.stringify(seg.h));
  await page.evaluate(() => document.querySelector('#ruleEditor .seg-beh button[data-b="continuous"]')?.click());
  await sleep(350);
  const beh2 = await page.evaluate(() => [...document.querySelectorAll("#ruleEditor .seg-beh button")]
    .map(b => b.dataset.b + ":" + b.getAttribute("aria-pressed")));
  check(L + "12 wybór innego zachowania przenosi aria-pressed",
    beh2.length === 0 || (beh2.includes("continuous:true") && beh2.includes("once:false")), JSON.stringify(beh2));
  await page.evaluate(() => document.getElementById("edCancel")?.click());
  await sleep(400);
  check(L + "12 edytor zamknięty „Anuluj” (nic nie poszło na serwer)",
    await page.evaluate(() => getComputedStyle(document.getElementById("ruleEditor")).display === "none"), "");

  // 5.13 — jeden widoczny h1 na moduł + landmarki
  const lm = await page.evaluate(() => ({
    rail: document.getElementById("rfRail")?.getAttribute("role"),
    railLbl: document.getElementById("rfRail")?.getAttribute("aria-label"),
    main: document.getElementById("rfMain")?.getAttribute("role"),
    rcol: document.getElementById("rfRcol")?.getAttribute("role"),
    rcolLbl: document.getElementById("rfRcol")?.getAttribute("aria-label"),
  }));
  check(L + "13 lewa kolumna to landmark nawigacji z nazwą",
    lm.rail === "navigation" && lm.railLbl === (en ? "Navigation" : "Nawigacja"), JSON.stringify(lm));
  check(L + "13 środek to treść, prawa kolumna to uzupełnienie z nazwą",
    lm.main === "main" && lm.rcol === "complementary" && !!lm.rcolLbl, JSON.stringify(lm));
  const MODS = ["mapowanie", "kolo", "mysz", "kontroler", "midi", "osc", "restapi", "pad"];
  const bad = [];
  for (const t of MODS) {
    await goTab(page, t);
    const h1 = await page.evaluate(() => [...document.querySelectorAll("h1")]
      .filter(h => h.offsetParent !== null).map(h => h.textContent.replace(/\s+/g, " ").trim()));
    const lbl = await page.evaluate(t => (document.querySelector(`button.tab-btn[data-tab="${t}"] span:not(.rfic):not(.tab-dot):not(.tab-emoji)`)?.textContent || "").trim(), t);
    if (h1.length !== 1 || h1[0] !== lbl) bad.push(`${t}: ${JSON.stringify(h1)} vs „${lbl}”`);
  }
  check(L + "13 każdy moduł ma dokładnie jeden widoczny h1 = swoją nazwę", bad.length === 0, bad.join(" | "));
  await goTab(page, "mapowanie");
  await sleep(150);
}


// ================================================================== ITERACJA 7 ==================
// Układ, responsywność i wydajność. Wszystko tutaj mierzy GEOMETRIĘ na czterech szerokościach okna
// (1024x700, 1280x800, 1440x900, 1920x1080) — najczęstsze laptopy plus jeden monitor. Żaden
// scenariusz niczego nie klika poza nawigacją i podzakładkami: zmiana rozmiaru okna, scroll
// i odczyt prostokątów nie wysyłają na serwer ani jednego bajtu.
// ⚠️ NA KOŃCU WRACAMY DO 1440x900 i na Mapowanie — kolejne asercje (i drugi język) zastają
// dokładnie takie okno, jakie zastawały dotąd.
async function checksIter7(page, lang, W) {
  const L = "[" + lang + "] 7.";
  const VIEWS = [[1024, 700], [1280, 800], [1440, 900], [1920, 1080]];
  const g = async (fn, arg) => page.evaluate(fn, arg);

  for (const [w, h] of VIEWS) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(500);
    const V = `@${w}`;

    // 7.1 + 7.8 + 7.13 — pasek górny jednowierszowy, dokument bez poziomego przewijania
    await goTab(page, "kolo");
    await sleep(250);
    const base = await g(() => ({
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      headerH: document.querySelector("header").offsetHeight,
      topbar: getComputedStyle(document.documentElement).getPropertyValue("--topbar-h").trim(),
      strip: getComputedStyle(document.documentElement).getPropertyValue("--rf-strip-h").trim(),
      // „Strona projektu” stoi w okienku „Pomoc i społeczność” (UX 261120 L23): w pasku liczy się #helpBtn.
      lbl: getComputedStyle(document.querySelector("#helpBtn .btn-lbl")).display,
      name: (document.getElementById("helpBtn").getAttribute("aria-label") || "").length,
    }));
    check(L + "1 " + V + " dokument bez poziomego przewijania", base.over <= 0, JSON.stringify(base));
    check(L + "8 " + V + " pasek górny stoi w jednym wierszu (77 px)",
      base.headerH === 77 && base.topbar === "77px", JSON.stringify(base));
    check(L + "8 " + V + " link paska ma nazwę dostępną także po ukryciu etykiety",
      base.name > 0 && (w > 1100 || base.lbl === "none"), JSON.stringify(base));
    // --rf-strip-h: zero tam, gdzie podgląd JEST kolumną; zmierzona wysokość tam, gdzie jest pasem
    check(L + "1 " + V + " --rf-strip-h zgodne z układem kolumn",
      w >= 1280 ? base.strip === "0px" : parseFloat(base.strip) > 40, JSON.stringify(base));

    // 7.1 — nagłówek modułu zostaje widoczny po przewinięciu strony
    await g(() => window.scrollTo(0, 600));
    await sleep(300);
    const hd = await g(() => {
      const el = [...document.querySelectorAll(".rfpc-head")].find(e => e.offsetParent);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const rc = document.querySelector(".rf-rcol");
      const mid = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      return {
        top: Math.round(r.top), h: Math.round(r.height),
        hit: !!(mid && mid.closest && mid.closest(".rfpc-head")),
        rcolBottom: rc && getComputedStyle(rc).position !== "static" ? Math.round(rc.getBoundingClientRect().bottom) : null,
        // Od 1280 px podgląd jest KOLUMNĄ z prawej (--rf-strip-h: 0), a nie pasem nad treścią: jej dół
        // leży przy dole okna i „top ≥ dół paska" nie ma wtedy sensu. Liczy się, czy prostokąty się
        // nakładają — dla pasa to dokładnie ten sam warunek, dla kolumny: czy nagłówek nie wchodzi pod nią.
        overlap: (() => { if (!rc || getComputedStyle(rc).position === "static") return false;
          const q = rc.getBoundingClientRect();
          return r.left < q.right - 1 && q.left < r.right - 1 && r.top < q.bottom - 1 && q.top < r.bottom - 1; })(),
        vh: window.innerHeight,
      };
    });
    check(L + "1 " + V + " nagłówek modułu widoczny i klikalny po scrollu",
      !!hd && hd.top >= 0 && hd.top + hd.h <= hd.vh && hd.hit === true, JSON.stringify(hd));
    check(L + "1 " + V + " ...i nie chowa się pod pasem kapsli",
      !!hd && !hd.overlap, JSON.stringify(hd));
    await g(() => window.scrollTo(0, 0));
    await sleep(150);

    // 7.6 — wartości suwaków „Wygląd koła" mieszczą się w wierszu i w sekcji
    await openDetails(page);
    await sleep(250);
    const wh = await g(() => [...document.querySelectorAll(".wh-val")].filter(e => e.offsetParent).map(e => {
      const r = e.getBoundingClientRect(), row = e.closest(".wh-row"), sec = e.closest(".wh-sec,details.cardfold");
      return [Math.round(r.right),
        row ? Math.round(row.getBoundingClientRect().right) : null,
        sec ? Math.round(sec.getBoundingClientRect().right) : null,
        sec && sec.classList.contains("adv") ? 0 : 7];   // „Zaawansowane” jest bez ramki: margines 0
    }));
    const whBad = wh.filter(v => (v[1] != null && v[0] > v[1] + 1) || (v[2] != null && v[0] > v[2] - v[3]));
    check(L + "6 " + V + " wartości suwaków Koła mieszczą się w sekcji (" + wh.length + " szt.)",
      wh.length > 0 && whBad.length === 0, JSON.stringify(whBad.slice(0, 3)));

    // 7.3 + 7.7 — listy mapowań MIDI i reguł nie wychodzą z karty
    const lists = [];
    for (const [tab, sel] of [["midi", "#miList"], ["osc", "#miList"], ["mapowanie", "#rulesList"], ["kontroler", "#padRulesList"]]) {
      await goTab(page, tab);
      await sleep(250);
      const r = await g(sel => {
        const el = document.querySelector(sel);
        if (!el || !el.offsetParent) return null;
        const kids = [...el.children].filter(k => k.offsetParent);
        const box = el.getBoundingClientRect();
        return { sel, over: el.scrollWidth - el.clientWidth,
          out: kids.filter(k => k.getBoundingClientRect().right > box.right + 1).length,
          cols: getComputedStyle(el).gridTemplateColumns.split(" ").length };
      }, sel);
      if (r) lists.push(r);
    }
    check(L + "3 " + V + " listy mapowań i reguł nie przepełniają karty",
      lists.length > 0 && lists.every(r => r.over <= 0 && r.out === 0), JSON.stringify(lists));
    // Poniżej 1600 px lista mapowań i lista reguł mają JEDEN tor — wiersz nie mieści się w dwóch.
    if (w <= 1440) {
      check(L + "7 " + V + " ...i mają wtedy jedną kolumnę",
        lists.every(r => r.cols === 1), JSON.stringify(lists));
    }

    // 7.5 — trzy przebiegi miniatury mieszczą się w poziomym pasie podglądu
    if (w < 1280) {
      const strip = await g(() => {
        const gr = document.getElementById("rfMiniGrid");
        const rc = document.querySelector(".rf-rcol");
        if (!gr || !rc || !gr.offsetParent) return null;
        const rb = rc.getBoundingClientRect();
        const sc = [...gr.querySelectorAll("canvas.rf-scope")].filter(e => e.offsetParent)
          .map(e => e.getBoundingClientRect());
        return { n: sc.length, bottom: Math.round(Math.max(...sc.map(r => r.bottom))),
          minW: Math.round(Math.min(...sc.map(r => r.width))), rcolBottom: Math.round(rb.bottom) };
      });
      // UX 261120 L23: wykresy kanałów i filtra są tylko w Czujniku, w pasie została sama kula.
      check(L + "5 " + V + " pas podglądu bez przebiegów (są w Czujniku)",
        !strip || strip.n === 0, JSON.stringify(strip));
    }

    // 7.9 — pigułka „Kup mi kawę" nie siada na przycisku stopki
    await g(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(350);
    const foot = await g(() => {
      const k = document.querySelector(".rf-kofi-btn") || document.querySelector(".rf-kofi");
      const f = document.querySelector(".foot-help");
      if (!k || !f) return null;
      const a = k.getBoundingClientRect(), b = f.getBoundingClientRect();
      return { hit: !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom) };
    });
    check(L + "9 " + V + " kubek nie zasłania przycisku stopki",
      !foot || foot.hit === false, JSON.stringify(foot));
    await g(() => window.scrollTo(0, 0));
    await sleep(150);
  }

  // 7.2 — prawa kolumna ekranu dwukolumnowego („Nakładka") nie wystaje poza kartę
  for (const [w, h] of [[1280, 800], [1440, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(400);
    await goTab(page, "wszystkie");
    await sleep(500);
    const sp = await g(() => {
      const el = document.querySelector(".rfpc-split");
      if (!el) return null;
      const body = el.querySelector(".rfpc-body"), col = el.querySelector(".rfpc-col-r");
      if (!body || !col) return null;
      const br = body.getBoundingClientRect(), cr = col.getBoundingClientRect();
      const l = el.querySelector(".rfpc-shared-l");
      return { bodyR: Math.round(br.right), colR: Math.round(cr.right),
        cols: getComputedStyle(body).gridTemplateColumns.split(" ").length,
        sharedPos: l ? getComputedStyle(l).position : null,
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    check(L + `2 @${w} prawa kolumna Nakładki mieści się w karcie`,
      !!sp && sp.colR <= sp.bodyR + 1 && sp.over <= 0, JSON.stringify(sp));
    // @1280 środkowa kolumna ma 724 px — dwie kolumny się nie mieszczą i układ ma zejść do jednej.
    check(L + `2 @${w} liczba kolumn odpowiada szerokości PANELU`,
      !!sp && (w === 1280 ? sp.cols === 1 && sp.sharedPos === "static"
        : sp.cols === 2 && sp.sharedPos === "sticky"), JSON.stringify(sp));
  }

  // 7.16 — pętla klatek żyje po odroczeniu pierwszej klatki do rAF
  await page.setViewportSize({ width: 1440, height: 900 });
  await sleep(300);
  await goTab(page, "czujnik");
  await sleep(600);
  const alive = await g(async () => {
    const c = document.getElementById("scopeAccel") || document.querySelector(".live-rail canvas");
    if (!c) return null;
    const w0 = c.width;
    await new Promise(r => setTimeout(r, 400));
    return { w: w0, cw: c.clientWidth, dpr: window.devicePixelRatio || 1 };
  });
  check(L + "16 pętla klatek żyje (płótno oscyloskopu ma rozmiar)",
    !!alive && alive.w > 0 && Math.abs(alive.w - Math.round(alive.cw * alive.dpr)) <= Math.ceil(alive.cw * 0.02),
    JSON.stringify(alive));

  await goTab(page, "mapowanie");
  await sleep(200);
}

// Iteracja 6 („Informacja zwrotna i stany") własnych asercji tutaj NIE MA — jej pozycje mierzy się
// klikaniem, które zapisywałoby na serwerze, więc mają osobne skrypty. Dlatego lista jest parami
// {numer, funkcja}, a nie samą tablicą: numer w komunikacie ma zgadzać się z numerem iteracji.
const ITERS = [
  { n: 1, fn: checksIter1 }, { n: 2, fn: checksIter2 }, { n: 3, fn: checksIter3 },
  { n: 4, fn: checksIter4 }, { n: 5, fn: checksIter5 }, { n: 7, fn: checksIter7 },
];

// --- main ---------------------------------------------------------------------------------
(async () => {
  try { const r = await fetch(URL.replace(/\/?$/, "/health")); if (!r.ok) throw new Error(String(r.status)); }
  catch (e) { console.error("Instancja niedostępna: " + URL + " (" + e.message + ") — uruchom panel na tym porcie"); process.exit(2); }
  const browser = await chromium.launch({ headless: true });
  for (const lang of ["pl", "en"]) {
    const W = await walk(browser, lang, BASELINE);
    if (!BASELINE) {
      for (const it of ITERS) {
        if (it.n > MAX_ITER) continue;
        try { await it.fn(W.page, lang, W); }
        catch (e) { check(`[${lang}] checksIter${it.n} bez wyjątku`, false, e.message); }
      }
    }
    check(`[${lang}] 0 POST do serwera (własne /ui-lang i /overlay open/close przechwycone lokalnie: ${W.intercepted.length})`, W.posts.length === 0, W.posts.join(" | "));
    await W.ctx.close();
  }
  await browser.close();
  console.log(`TOTAL PASS=${nPass} FAIL=${nFail}`);
  process.exit(nFail ? 1 : 0);
})();
