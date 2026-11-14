"use strict";
// ============================================================================
//  NAKŁADKI NAD GRĄ — ZARZĄDZANIE Z PANELU (ekran „Nakładka")
//
//  DLACZEGO POWSTAŁO. Do 2026-08-31 wszystko, co da się nakładce ustawić, dało się ustawić
//  WYŁĄCZNIE w niej samej — w szufladzie ⚙ pod jej paskiem. Panel miał jeden rząd przycisków:
//  pokaż / schowaj / ＋ / ✕. To znaczyło, że żeby zmienić cokolwiek w oknie, trzeba je najpierw
//  postawić NAD GRĄ, potem trafić w pasek szeroki na pół centymetra, a przy „przepuszczaj
//  kliknięcia" jeszcze wcelować w jedyny kawałek okna, który przyjmuje mysz. Rozstawienie trzech
//  okien pod stream to była wtedy wędrówka: otwórz, ustaw, zamknij, otwórz następne.
//  Dlatego całe zarządzanie nakładkami odbywa się w nakładce, a także w oknie „Nakładka” na stronie
//  aplikacji: zmiana proporcji, wielkości, układów, dodawanie kolejnych nakładek pod kapsel
//  i edytowanie każdej z osobna.
//
//  CO ZMIENIŁO SIĘ 2026-09-01. Ekran przestał odpowiadać na „pokaż mi wszystkie konfiguracje
//  naraz", a zaczął na „pozwól mi skonfigurować nakładkę". Trzy ruchy:
//    • ŚCIĄGA wszystkich kapsli zeszła na własną zakładkę (rf-49p), bo była tłem dla pracy,
//      a nie pracą;
//    • rząd jednakowych pigułek „które okno ustawiasz" zastąpiła GALERIA (rf-41d): kafelek na
//      okno, w proporcji i szerokości prawdziwego okna, ze schematem tego, co w nim stoi — plus
//      ŻYWA MINIATURA wybranego okna, czyli ta sama strona, którą Windows postawi nad grą;
//    • edytor rozpadł się na dwie zakładki: „Nakładka" (co to za okno, co w nim jest, gdzie stoi
//      i jak duże) oraz „Wygląd" (motyw, obrys, tło, przezroczystość, rozmiary). Podgląd stoi
//      NAD zakładkami, więc nie znika przy ich przełączaniu i widać na żywo, co robi każdy suwak.
//
//  …I ZNÓW JEDNA ZAKŁADKA (2026-09-09): w „Wyglądzie” zostało tylko jedno okienko, więc przeszło
//  pod „Ustawienia tego okna”; mniej klikania i bardziej intuicyjnie. Podział z 09-01 miał sens, dopóki „Wygląd" trzymał dwie
//  kolumny; po tym, jak rozmiary elementów zeszły do wierszy zawartości, została w nim JEDNA karta
//  na jedną kolumnę — czyli zakładka po to, żeby pokazać jedną rzecz. Karta „Wygląd tego okna"
//  stoi teraz POD kartą ustawień, na tej samej zakładce, a pasek ma trzy pozycje: Nakładka ·
//  Ściąga · ℹ. Sama karta jest nietknięta: to przeniesienie, nie przepisanie.
//
//  PODZIAŁ PRACY — cztery różne czasowniki, żeby żaden nie udawał drugiego:
//    • PASEK W NAGŁÓWKU (#ovlBtns, rf-41)  — POKAŻ / SCHOWAJ, ＋ nowe okno, ✕ usuń.
//    • GALERIA (rf-41d)                    — KTÓRE OKNO EDYTUJĘ (wybór, nie przełącznik: kliknięcie
//      kafelka niczego nie otwiera ani nie zamyka) i JAK ONO WYGLĄDA. Są tu też okna KOŁA przy
//      kursorze, których w pasku świadomie nie ma (serwer pomija je we wszystkich listach okien),
//      bo one też mają wygląd, a od 08-31 to jedyne miejsce, w którym się go wybiera.
//    • EDYTOR (rf-41c)                     — wszystkie ustawienia wybranego okna, te same, co
//      w szufladzie ⚙ tego okna. Jedna wartość, dwa miejsca do jej ustawienia; oba czytają
//      i piszą przez /overlay, więc nie mają jak się rozjechać.
//    • TEN PLIK                            — kto tu w ogóle jest, co jest wybrane i jak się zapisuje.
//
//  ⚠️ OKNA, KTÓRYCH JESZCZE NIE MA, TRZEBA DOPYTAĆ PO NAZWIE. `GET /overlay` wymienia wyłącznie
//  okna już utworzone, a okno koła pomija zawsze (patrz `state()` w ribbitflip_monitor.py) — ale
//  `GET /overlay?win=d0~kolo` odpowiada i NIE tworzy okna. Odpowiedź niesie wtedy ustawienia
//  FABRYCZNE, czyli dokładnie to, co człowiek zobaczy przy pierwszym pokazaniu. Dzięki temu
//  kafelek i miniatura pokazują coś także na świeżej instalacji, na której nikt jeszcze nakładki
//  nie włączył — zamiast pustego prostokąta z napisem „czekam".
//
//  Po rf-41 (OVL.state, ovlGet/ovlPost, OVL_THEMES, OVL_RATIOS) i po initTabs (karta wchodzi do
//  panelu `#tab-wszystkie`, który powstaje dopiero tam). Przed initOvlLayoutBar — pasek nazwanych
//  układów montuje się pod nagłówkiem TEJ karty. Przed initRestTabs, który rozdaje karty na
//  zakładki po znacznikach `data-rfpc-shared` / `data-rfpc-pane` wpisanych tutaj.
// ============================================================================

const RF_OVM_I18N = {
  "Nakładki nad grą": "Overlays over the game",
  "okna nad grą: pokaż, dołóż, ustaw każde z osobna": "windows over the game: show, add, set each one up",
  "koło przy kursorze": "wheel at the pointer",
  "Okienko z kołem wyboru — chodzi za kursorem, więc nie ma własnego miejsca ani rogu do ciągnięcia. Tutaj wybierasz jego wygląd.":
    "The window with the selection wheel — it follows the pointer, so it has no place of its own and no corner to drag. Here is where you choose its look.",
  "Nie ma jeszcze żadnego kapsla, więc nie ma czego pokazywać nad grą. Sparuj kapsel w „Połączeniu”.":
    "There is no capsule yet, so there is nothing to show over the game. Pair one in “Connection”.",
  "Na tym komputerze nie da się otworzyć okna nakładki: ": "This machine cannot open an overlay window: ",
  "na ekranie": "on screen",
  "schowane": "hidden",
  "Każde okno ma własne ustawienia, nawet jeśli pokazuje ten sam kapsel.":
    "Every window has its own settings, even when it shows the same capsule.",
};
try { Object.assign(I18N_EN, RF_OVM_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

const OVM_WHEEL_SUF = "~kolo";        // lustro OVERLAY_WHEEL_SUFFIX w ribbitflip_monitor.py
let _ovmSel = "";                     // id okna, które edytuje panel („" = jeszcze żadne)
const _ovmCfg = Object.create(null);  // wid → config okna, którego serwer nie wymienia w liście
let _ovmCfgAsked = 0;                 // kiedy ostatnio o nie pytaliśmy (ms), żeby nie odpytywać w kółko

// ------------------------------------------------------------------------------------------
//  CO W OGÓLE ISTNIEJE
// ------------------------------------------------------------------------------------------
function _ovmState() { return (typeof OVL !== "undefined" && OVL.state) ? OVL.state : null; }
function _ovmCaps() {
  return Object.values((typeof state !== "undefined" && state.devices) || {})
    .sort((a, b) => (a.meta.slot || 0) - (b.meta.slot || 0));
}
function ovmIsWheelWid(wid) { return String(wid || "").slice(-OVM_WHEEL_SUF.length) === OVM_WHEEL_SUF; }

// Wszystkie okna, jakie panel ma prawo pokazać — zwykłe (z odpowiedzi serwera) plus jedno okno
// koła na kapsel. Kolejność jak w pasku: kapslami, w każdym od najstarszego okna.
// `cfg` bywa `null` dla okna, o które jeszcze nie zdążyliśmy zapytać — kafelek wtedy jest,
// a edytor mówi „czekam", zamiast rysować ustawienia wzięte z sufitu.
function ovmWindows() {
  const s = _ovmState(), wins = (s && s.windows) || {};
  const out = [];
  for (const d of _ovmCaps()) {
    const dev = d.meta.dev, name = d.meta.name || dev, color = d.meta.color || "#8aa0b5";
    const mine = (typeof ovlWinsOf === "function") ? ovlWinsOf(dev) : [];
    const list = mine.length ? mine : [dev];      // kapsel bez nakładki ma jedno okno „do zrobienia"
    list.forEach((wid, i) => {
      const w = wins[wid] || {};
      out.push({
        wid: wid, dev: dev, cap: name, color: color, wheel: false,
        exists: !!wins[wid], running: !!w.running,
        title: (typeof ovlWinTitle === "function")
          ? ovlWinTitle(name, w.label, i, list.length) : name,
        // Okno nieutworzone nie ma configu w stanie panelu — bierzemy dopytany (fabryczny), żeby
        // kafelek i miniatura pokazywały to, co będzie, a nie pustkę.
        cfg: w.config || _ovmCfg[wid] || null,
      });
    });
    // OKNO KOŁA — zawsze jedno na kapsel i zawsze na końcu jego grupy. Jest tu nawet wtedy, gdy
    // koło jest wyłączone: wygląd ustawia się z wyprzedzeniem, a nie w chwili, gdy okno błyska
    // pod kursorem przez pół sekundy.
    const wwid = dev + OVM_WHEEL_SUF;
    out.push({
      wid: wwid, dev: dev, cap: name, color: color, wheel: true,
      exists: !!_ovmCfg[wwid], running: false,
      title: name + " · " + _cvT("koło przy kursorze"),
      cfg: _ovmCfg[wwid] || null,
    });
  }
  return out;
}
function ovmWindowOf(wid) { return ovmWindows().find(w => w.wid === wid) || null; }

// OKNA BEZ USTAWIEŃ W STANIE — dopytujemy po nazwie, raz na 4 s (ten sam rytm, co odpytanie
// panelu). Dotyczy dwóch przypadków: okien koła (serwer nie wymienia ich nigdy) i okien, których
// jeszcze nie było (świeża instalacja, kapsel bez ani jednej nakładki). Zapytanie o okno, którego
// nie ma, NIE tworzy go — zwraca ustawienia fabryczne.
function ovmCfgFetch(force) {
  if (typeof ovlGet !== "function") return;
  const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  if (!force && (now - _ovmCfgAsked) < 4000) return;
  _ovmCfgAsked = now;
  const s = _ovmState(), have = (s && s.windows) || {};
  const want = [];
  for (const d of _ovmCaps()) {
    const dev = d.meta.dev;
    want.push(dev + OVM_WHEEL_SUF);
    const mine = (typeof ovlWinsOf === "function") ? ovlWinsOf(dev) : [];
    if (!mine.length && !have[dev]) want.push(dev);
  }
  for (const wid of want) {
    ovlGet(wid).then(s2 => {
      if (!s2 || !s2.window || !s2.window.config) return;
      const before = JSON.stringify(_ovmCfg[wid] || null);
      _ovmCfg[wid] = s2.window.config;
      if (before !== JSON.stringify(s2.window.config)) ovmSync();
    }).catch(() => { /* brak aplikacji — pasek stanu i tak to powie */ });
  }
}

// ------------------------------------------------------------------------------------------
//  KARTY
// ------------------------------------------------------------------------------------------
// Trzy karty, bo trzy różne miejsca na ekranie:
//   #ovmCard     — STAŁA: nagłówek, pasek okien, galeria i podgląd. Stoi NAD zakładkami
//                  (`data-rfpc-shared`), więc przełączanie „Nakładka ↔ Ściąga" jej nie rusza.
//                  ⚠️ To nie jest kosmetyka: ramka podglądu przeładowuje się przy KAŻDEJ zmianie
//                  rodzica w DOM, więc przepinana między zakładkami gasłaby po każdym kliknięciu.
//   #ovmCfgCard  — zakładka „Nakładka", u góry: czym to okno jest, co w nim stoi, gdzie i jak duże.
//   #ovmLookCard — TA SAMA zakładka, pod tamtą: skóra okna (motyw, obrys, tło, przezroczystość,
//                  rozmiary). Osobna karta, bo to inne pytanie — ale nie osobna zakładka, bo jedna
//                  karta nie ma po co mieć własnego kliknięcia (2026-09-09, patrz nagłówek pliku).
function initOvlManage() {
  if (typeof RF_OVL !== "undefined" && RF_OVL) return;   // w oknie nakładki panelu nie ma
  if (document.getElementById("ovmCard")) return;
  const panel = document.getElementById("tab-wszystkie");
  const ovCard = document.getElementById("overviewCard");
  if (!panel) return;
  const card = document.createElement("div");
  card.className = "card ovm-card";
  card.id = "ovmCard";
  // ⚠️ NAPISY STAŁE PISZEMY PO POLSKU, BEZ `_cvT`. Ta karta powstaje RAZ, przy starcie panelu,
  // a `_cvT` tłumaczy w chwili budowy — więc w sesji uruchomionej po angielsku wpisałoby tu
  // angielski na sztywno i przełącznik języka nie miałby czego cofnąć: walker (rf-01) zna pary
  // POLSKI→angielski i pamięta oryginał tylko tych węzłów, które sam przetłumaczył. Napisy stałe
  // idą więc przez walkera, a `_cvT`/`_gl` zostają wyłącznie tam, gdzie tekst powstaje przy KAŻDYM
  // rysowaniu (kafelki, zdania edytora) i gdzie `ovmRelang` przerysuje je po zmianie języka.
  card.dataset.rfpcShared = "right";
  card.innerHTML =
    `<div class="head"><h2><span class="ovm-hd-ic" id="ovmHdIc" aria-hidden="true"></span>` +
      `Nakładki nad grą</h2>` +
      `<span class="hint">okna nad grą: pokaż, dołóż, ustaw każde z osobna</span>` +
      // PASEK OKIEN — ten sam, co stał w nagłówku ściągi (rysuje go rf-41 przez `#ovlBtns`).
      // BEZ ETYKIETY „Nakładka nad grą": tam była potrzebna, bo przyciski stały obok „Otwórz
      // w oknie" i trzeba było powiedzieć, który guzik otwiera co. Tutaj nazwa karty mówi to samo
      // dwa centymetry w lewo, a rysunek nakładki jest już przy niej — drugi raz byłby echem.
      `<span class="ovl-group" id="ovlGroup">` +
        `<span id="ovlBtns" class="ovl-btns"></span>` +
      `</span></div>` +
    // PEŁNY EKRAN ZASŁANIA NAKŁADKĘ (UX 261120 B5b, P-G6-11). Najczęstszy powód „nakładka nie
    // działa", a ekran o nim milczał. Cicha linijka, nie czerwony komunikat `rfNeedHtml`: niczego
    // nie brakuje, to wskazówka o ustawieniu gry. Pasek układów (rf-49f) staje pod nią.
    `<div class="ovm-hint ovm-fsnote" id="ovmFsNote"><span class="rfic info-ic" aria-hidden="true"></span>` +
      `<span>Gra na pełnym ekranie zasłoni nakładkę. W ustawieniach gry wybierz „Okno bez ramki”.</span></div>` +
    // Galeria „Które okno ustawiasz” zeszła do „Zaawansowane” (UX 261120 L4b, niżej). Zdanie
    // o stanie nakładek (#ovmNote, też „nie da się otworzyć okna”) zostaje na wierzchu.
    `<div class="ovm-body">` +
      `<div class="ovm-note" id="ovmNote"></div>` +
    `</div>`;
  if (ovCard && ovCard.parentNode === panel) panel.insertBefore(card, ovCard);
  else panel.insertBefore(card, panel.firstChild);
  {const ic = document.getElementById("ovmHdIc");
   if (ic && typeof OVL_ICON === "string") ic.innerHTML = OVL_ICON;}

  // KARTA PODGLĄDU — LEWA KOLUMNA EKRANU (2026-09-01, druga iteracja; zlecenie: „chcę to mieć tak
  // przebudowane, żebym widział po lewej podgląd, a po prawej parametry/kolejność"). Osobna karta,
  // a nie połowa tamtej, bo rf-49p stawia bloki stałe w kolumnach po znaczniku — i tylko dzięki
  // temu podgląd może się PRZYKLEIĆ, gdy prawa kolumna jest dłuższa niż ekran.
  // ⚠️ Wstawiana PRZED kartą prawą i nigdzie potem nie przenoszona: niesie ramkę `<iframe>`,
  // a ta ładuje się od nowa przy każdej zmianie rodzica.
  {const prev = document.createElement("div");
   prev.className = "card ovm-card ovm-prev-card";
   prev.id = "ovmPrevCard";
   prev.dataset.rfpcShared = "left";
   prev.innerHTML = `<div class="ovm-body">` +
     (typeof ovgPrevHtml === "function" ? ovgPrevHtml() : "") + `</div>`;
   card.parentNode.insertBefore(prev, card);}

  // Dwie karty edytora. Wstawiane ZARAZ ZA kartą stałą, w kolejności, w której mają stać na
  // ekranie: najpierw ustawienia, pod nimi wygląd. Obie deklarują tę samą zakładkę („main"), więc
  // rf-49p przenosi je razem i w tej samej kolejności — a gdyby initRestTabs nie doszedł (ma
  // własny bezpiecznik), stoją tak samo, bo tu już tak stoją.
  const mk = (id, pane, html) => {
    const c = document.createElement("div");
    c.className = "card ovm-card ovm-edit-card";
    c.id = id;
    c.dataset.rfpcPane = pane;
    c.innerHTML = html;
    card.parentNode.insertBefore(c, card.nextSibling);
    return c;
  };
  // Kolejność wstawiania odwrotna, bo każda ląduje TUŻ ZA kartą stałą.
  // UX 261120 L4b: „Wygląd tego okna” nie jest już osobną kartą, tylko zwijakiem w karcie
  // ustawień (ovmEditorCfgHtml). Za nią piętro 3: jedno „Zaawansowane” z wyborem okna (galeria)
  // i nazwą okna. Galeria nie niesie ramki <iframe>, więc może stać w zakładce, nie w bloku stałym.
  {const adv = document.createElement("details");
   adv.className = "cardfold adv"; adv.id = "ovmAdv"; adv.dataset.rfpcPane = "main";
   adv.innerHTML = `<summary>Zaawansowane</summary><div class="cardfold-body">` +
     (typeof ovgPickHtml === "function" ? ovgPickHtml() : "") +
     (typeof ovmEditorNameHtml === "function" ? `<div class="ovm-advname">` + ovmEditorNameHtml() + `</div>` : "") +
     `</div>`;
   card.parentNode.insertBefore(adv, card.nextSibling);}
  if (typeof ovmEditorCfgHtml === "function") mk("ovmCfgCard", "main", ovmEditorCfgHtml());

  if (typeof ovgWire === "function") ovgWire();
  if (typeof ovmEditorWire === "function") ovmEditorWire(document);
  ovmCfgFetch(true);
  ovmSync();
  ovmTiersInit();
}

// KTÓRE OKNO EDYTUJEMY. Wybór jest świadomy — kliknięcie kafelka niczego nie otwiera ani nie
// zamyka. Okno bez ustawień w stanie dopytujemy od razu: edytor bez nich nie ma czego pokazać.
function ovmSelect(wid) {
  if (!wid || _ovmSel === wid) return;
  _ovmSel = wid;
  if (!_ovmCfg[wid]) ovmCfgFetch(true);
  ovmSync();
}

// Jedyne wejście stanu: woła to `ovlPanelSync` z rf-41 po KAŻDEJ odpowiedzi serwera o nakładkach
// (odpytanie co 4 s, przełącznik, dodanie i usunięcie okna, zmiana ustawień z szuflady).
function ovmSync() {
  const card = document.getElementById("ovmCard"); if (!card) return;
  const wins = ovmWindows();
  // Wybór przeżywa przerysowanie, ale nie przeżywa zniknięcia okna (usunięte, kapsel odpięty).
  if (!wins.some(w => w.wid === _ovmSel)) _ovmSel = wins.length ? wins[0].wid : "";
  if (typeof ovgSync === "function") ovgSync(wins, _ovmSel);
  const s = _ovmState();
  const note = document.getElementById("ovmNote");
  if (note) {
    note.classList.toggle("is-bad", !!(s && s.avail === false));
    note.textContent = !wins.length
      ? _cvT("Nie ma jeszcze żadnego kapsla, więc nie ma czego pokazywać nad grą. Sparuj kapsel w „Połączeniu”.")
      : (s && s.avail === false)
        ? _cvT("Na tym komputerze nie da się otworzyć okna nakładki: ") + ((s && s.reason) || "—")
        : _cvT("Każde okno ma własne ustawienia, nawet jeśli pokazuje ten sam kapsel.");
  }
  if (typeof ovmEditorSync === "function") ovmEditorSync(ovmWindowOf(_ovmSel));
  ovmCfgFetch(false);
}

// ZAPIS. Panel pisze przez tę jedną drogę — a pisze do OKNA (`win`), nigdy do kapsla: dwie
// nakładki jednego kapsla mają dwa komplety ustawień i `dev` trafiłby zawsze w pierwszą z nich.
//
// Trzy rzeczy naraz, w tej kolejności: (1) zapisz u siebie, żeby suwak nie skakał pod palcem,
// (2) poślij z opóźnieniem, bo suwak to kilkadziesiąt zmian na sekundę, (3) po odpowiedzi dopytaj
// o PEŁNY stan — odpowiedź na `config` opisuje jedno okno, a `ovlPanelSync` karmi się całością
// i podanie mu jednego okna wyzerowałoby przyciski obok.
let _ovmSaveT = null, _ovmPend = null;
function _ovmMerge(base, patch) {
  const out = Object.assign({}, base || {}, patch);
  if (patch.show) out.show = Object.assign({}, (base && base.show) || {}, patch.show);
  if (patch.scaleParts) out.scaleParts = Object.assign({}, (base && base.scaleParts) || {}, patch.scaleParts);
  return out;
}
function _ovmFlush() {
  clearTimeout(_ovmSaveT); _ovmSaveT = null;
  const p = _ovmPend; _ovmPend = null;
  if (!p) return;
  ovlPost({ win: p.wid, dev: (ovmWindowOf(p.wid) || {}).dev || "", act: "config", config: p.patch })
    .then(j => {
      if (j && j.ok === false && j.error && typeof rfToast === "function") {
        rfToast(j.error, { tone: "danger", ms: 5000 });
      }
      // Karta koła (rf-46b) trzyma własną kopię ustawień tego okna i nie odpytuje jej w kółko —
      // po zmianie stąd trzeba jej powiedzieć, żeby jej suwak nie pokazywał wczorajszej liczby.
      if (ovmIsWheelWid(p.wid) && typeof whCurFetch === "function") { try { whCurFetch(); } catch (e) {} }
      // …i miniatura, która czyta ustawienia z serwera własnym odpytaniem co 3 s. Bez tego suwak
      // ruszałby podglądem z opóźnieniem do trzech sekund, czyli „nie na bieżąco".
      if (typeof ovgPoke === "function") { try { ovgPoke(); } catch (e) {} }
      if (typeof ovlGet === "function" && typeof ovlPanelSync === "function") {
        ovlGet().then(st => { if (st) ovlPanelSync(st); });
      }
    });
}
function ovmSend(wid, patch, now) {
  const w = ovmWindowOf(wid); if (!w) return;
  const cfg = _ovmMerge(w.cfg || {}, patch);
  // Kopia u siebie — także dla okien, których serwer nie wymienia (koło, okno jeszcze nieutworzone).
  const s = _ovmState();
  if (!w.wheel && s && s.windows && s.windows[wid]) s.windows[wid].config = cfg;
  else _ovmCfg[wid] = cfg;
  if (typeof ovmEditorSync === "function") ovmEditorSync(ovmWindowOf(wid));
  if (typeof ovgSync === "function") ovgSync(ovmWindows(), _ovmSel);
  // Czekająca zmiana INNEGO okna leci natychmiast, zamiast przepaść: zmiana kafelka w trakcie
  // ruchu suwakiem zdarza się właśnie wtedy, gdy się porównuje dwa okna, a cicho porzucona
  // wartość byłaby ustawieniem, które „samo się cofnęło".
  if (_ovmPend && _ovmPend.wid !== wid) _ovmFlush();
  _ovmPend = { wid: wid, patch: _ovmMerge(_ovmPend ? _ovmPend.patch : null, patch) };
  clearTimeout(_ovmSaveT);
  if (now) _ovmFlush(); else _ovmSaveT = setTimeout(_ovmFlush, 220);
}

// Zmiana języka: napisy tej karty składane są `_cvT`/`_gl` w chwili rysowania, więc bez
// przerysowania zostałyby w języku, w którym powstały (patrz lista wywołań w `setLang`).
function ovmRelang() {
  if (typeof ovgRelang === "function") ovgRelang();
  ovmSync();
}

// ===== UX 261120 L4b: piętra ekranu Nakładka =====
// Piętro 2: „Miejsce i wielkość” (#ovmGeomSec) i „Wygląd tego okna” (#ovmLookFold), zwinięte,
// z bieżącymi wartościami wybranego okna w nagłówku. Piętro 3: „Zaawansowane” (#ovmAdv) z galerią
// okien i nazwą. Domyślne to wartości nowego okna z serwera (OVERLAY_DEFAULTS); położenia nie ma
// czym porównać, więc liczą się tylko przełączniki.
const OVM_LOOK_DEF = { theme: "bare", outline: "dark", bg: false, opacity: 90, scale: 100, baseW: 400 };
function _ovmCur() { const w = ovmWindowOf(_ovmSel); return (w && w.cfg) ? w : null; }
function _ovmLookOf(c) {
  return { theme: c.theme || "bare", outline: c.outline || "dark", bg: !!(c.show && c.show.bg),
    opacity: Math.round(+c.opacity || 100), scale: Math.round(+c.scale || 100), baseW: Math.round(+c.baseW || 400) };
}
function _ovmLookPatch(v) {
  return { theme: v.theme, outline: v.outline, show: { bg: !!v.bg }, opacity: v.opacity, scale: v.scale, baseW: v.baseW };
}
function ovmTiersInit() {
  if (typeof rfTier !== "function") return;
  const $ = id => document.getElementById(id);
  rfTier($("ovmGeomSec"), "nakladka.miejsce", {
    sum: () => {
      const w = _ovmCur(); if (!w) return "";
      const c = w.cfg, sz = $("ovmSizeV"), out = [];
      if (sz && sz.textContent.trim() && sz.textContent.trim() !== "—") out.push(sz.textContent.trim());
      out.push((c.x != null && c.y != null) ? "X " + c.x + " · Y " + c.y : _cvT("jeszcze nie postawione"));
      out.push(c.onTop !== false ? _gl("na wierzchu", "on top") : _gl("pod innymi oknami", "behind other windows"));
      if (c.clickThrough) out.push(_gl("przepuszcza kliknięcia", "lets clicks through"));
      return out.join(" · ");
    },
    changed: () => { const w = _ovmCur(); if (!w || w.wheel) return 0; return (w.cfg.onTop === false ? 1 : 0) + (w.cfg.clickThrough ? 1 : 0); },
    reset: () => { const w = _ovmCur(); if (w) ovmSend(w.wid, { onTop: true, clickThrough: false }, true); },
    take: () => { const w = _ovmCur(); return w ? { wid: w.wid, onTop: w.cfg.onTop !== false, clickThrough: !!w.cfg.clickThrough } : null; },
    restore: s => { if (s && ovmWindowOf(s.wid)) ovmSend(s.wid, { onTop: s.onTop, clickThrough: s.clickThrough }, true); },
  });
  rfTier($("ovmLookFold"), "nakladka.wyglad", {
    sum: () => {
      const w = _ovmCur(); if (!w) return "";
      const v = _ovmLookOf(w.cfg);
      const th = (typeof OVL_THEMES !== "undefined" ? OVL_THEMES : []).find(t => t.k === v.theme);
      return [th ? _cvT(th.label) : v.theme, _gl("przezroczystość ", "opacity ") + v.opacity + "%",
        _gl("rozmiar ", "size ") + v.scale + "%"].join(" · ");
    },
    changed: () => {
      const w = _ovmCur(); if (!w || w.wheel) return 0;
      const v = _ovmLookOf(w.cfg); let n = 0;
      for (const k in OVM_LOOK_DEF) if (v[k] !== OVM_LOOK_DEF[k]) n++;
      return n;
    },
    reset: () => { const w = _ovmCur(); if (w && !w.wheel) ovmSend(w.wid, _ovmLookPatch(OVM_LOOK_DEF), true); },
    take: () => { const w = _ovmCur(); return w ? { wid: w.wid, v: _ovmLookOf(w.cfg) } : null; },
    restore: s => { if (s && ovmWindowOf(s.wid)) ovmSend(s.wid, _ovmLookPatch(s.v), true); },
  });
  rfTier($("ovmAdv"), "nakladka.zaawansowane", {
    changed: () => { const w = _ovmCur(); return (w && !w.wheel && w.cfg.label) ? 1 : 0; },
  });
}
// (koniec sekcji L4b)
