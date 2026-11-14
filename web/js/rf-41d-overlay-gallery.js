"use strict";
// ============================================================================
//  NAKŁADKI — GALERIA OKIEN I ŻYWA MINIATURA (górna, stała część ekranu „Nakładka")
//
//  DLACZEGO POWSTAŁO. Ekran „Nakładka" odpowiadał do 2026-09-01 na pytanie „pokaż mi wszystkie
//  konfiguracje naraz": pod kartą zarządzania stała ściąga wszystkich kapsli obok siebie, a wybór
//  okna do ustawiania był rzędem jednakowych pigułek. Żeby zobaczyć, jak wygląda TA nakładka —
//  jak duża jest, co w niej stoi, czy napisy będą czytelne nad ciemną grą — trzeba ją było
//  postawić nad grą i tam obejrzeć. Teraz strona służy odwrotnie: daje podgląd
//  (rozmiarów i konfiguracji) każdej wersji nakładki z osobna i pozwala ją
//  skonfigurować. Ściąga zeszła na własną zakładkę (rf-49p), a jej miejsce zajęło to.
//
//  DWIE POWIERZCHNIE, DWIE ROLE — i to jest cały podział pracy w tym pliku:
//
//    • KAFELKI (prawa strona) mówią „ILE ich jest i JAK SIĘ MAJĄ DO SIEBIE". Są schematami, nie
//      zdjęciami: prostokąt w proporcji okna, szeroki proporcjonalnie do prawdziwej szerokości
//      w obrębie kapsla, a w nim klocki włączonych elementów w wysokościach idących za suwakami
//      rozmiaru. Schemat rysuje się z samego configu, więc kafelków może stać dwadzieścia i nie
//      kosztują nic.
//
//    • MINIATURA (lewa strona) mówi „JAK TO NAPRAWDĘ WYGLĄDA". Jest ŻYWA i jest PRAWDĄ, bo to ta
//      sama strona, którą Windows postawi nad grą (`?overlay=1&…&preview=1`, patrz RF_OVL_PREVIEW
//      w rf-41) — w prawdziwym rozmiarze okna, tylko pomniejszona. Nie ma tu drugiego rysowania
//      nakładki, które mogłoby się z prawdziwym rozjechać; jest jedno, oglądane przez lupę.
//      Kosztuje tyle, co cała strona, więc żywa jest DOKŁADNIE JEDNA: ta wybrana.
//
//  ⚠️ RAMKA NIE ZNOSI PRZENOSZENIA W DOM. Przeglądarka ładuje `<iframe>` od nowa za każdym razem,
//  gdy zmieni mu się rodzic — więc ten blok stoi w JEDNYM miejscu drzewa (nad zakładkami, patrz
//  `shared` w rf-49p) i przy zmianie zakładki jest chowany klasą, nigdy przepinany. Stąd też
//  bierze się cała reszta: podgląd zostaje na ekranie, kiedy zakładka pod nim zmienia się
//  z „Nakładka" na „Wygląd", i dlatego widać na żywo, co robi każdy suwak.
//
//  Po rf-41 (kanon list, ovlGet/ovlPost) i rf-41b (ovmWindows/ovmSelect/ovmSend — kto tu jest
//  i co jest wybrane). Sam nie trzyma stanu poza tym, jaka ramka aktualnie stoi.
// ============================================================================

const RF_OVG_I18N = {
  "Które okno ustawiasz": "Which window you are setting up",
  "Podgląd nakładki": "Overlay preview",
  "Wybierz okno obok, żeby zobaczyć jego podgląd.": "Choose a window alongside to see its preview.",
  "Tło podglądu": "Preview backdrop",
  "Ciemna gra": "Dark game",
  "Jasna gra": "Light game",
  "Umowne tło zamiast gry — nad grą nakładka nie ma żadnego tła, wycina je Windows. Przełącz, żeby sprawdzić czytelność wyglądu i obrysu.":
    "A stand-in for the game — over a game the overlay has no background at all, Windows cuts it away. Switch it to check the look and the outline for legibility.",
  "Miniatura udaje przezroczystość: prawdziwą robi Windows, więc widać ją dopiero w otwartym oknie.":
    "The thumbnail imitates transparency: the real thing is done by Windows, so it shows only in an open window.",
  "pomniejszone do": "scaled to",
  "prawdziwy rozmiar": "actual size",
  "Koło wyboru stoi w podglądzie na stałe; nad grą pojawia się na czas wybierania.":
    "The selection wheel stands here all the time; over a game it appears for as long as the choice lasts.",
  "nowa nakładka": "new overlay",
  "Nowa nakładka tego kapsla — pusta kopia albo gotowy szablon":
    "One more overlay for this capsule — a plain copy or a ready-made template",
  "Kopia tej nakładki": "A copy of this overlay",
  "Tylko kontroler": "Controller only",
  "Tylko koło wyboru": "Selection wheel only",
  "Tylko wyzwalacze": "Triggers only",
  "Tylko orientacja": "Orientation only",
  "sam rysunek pada, ze wszystkimi kapslami": "the pad drawing alone, with every capsule on it",
  "samo koło, przy krawędzi ekranu": "the wheel alone, by the edge of the screen",
  "sama lista reguł, słupkiem przy boku": "the rule list alone, a column by the side",
  "sama kula orientacji": "the orientation ball alone",
  "jeszcze nie utworzona": "not created yet",
  "na ekranie": "on screen",
  "nakładka kontrolera": "controller overlay",
  "Nowa nakładka tego kontrolera — sam rysunek pada, ze wszystkimi kapslami, które na nim grają":
    "One more overlay for this controller — the pad drawing alone, with every capsule that plays on it",
};
try { Object.assign(I18N_EN, RF_OVG_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

// ------------------------------------------------------------------------------------------
//  SCHEMAT KAFELKA — z czego rysujemy prostokąt
// ------------------------------------------------------------------------------------------
// ILE MIEJSCA ZABIERA KAŻDA CZĘŚĆ. To nie są piksele, tylko wagi: kafelek ma 120 px wysokości,
// a nakładka bywa i 900, więc jedyne, co da się uczciwie pokazać, to PROPORCJE między klockami.
// Liczby wzięte z tego, jak te elementy wychodzą w kolumnie ściągi przy 100% (kula i pad są
// kwadratowe i największe, nagłówek to jeden wiersz). Mnożą się przez suwaki `scaleParts`, więc
// podkręcenie „orientacji" na 180% widać w kafelku od razu.
const OVG_WEIGHT = { head: 12, pose: 34, motion: 22, press: 14, pad: 30, wheel: 30, rules: 26, graph: 16, midi: 14 };
// Kolejność klocków bierze się z USTAWIEŃ TEGO OKNA (`ovlOrderOf` w rf-41), więc kafelek pokazuje
// także to, co ktoś poprzestawiał. Ta lista jest tylko drogą awaryjną, gdyby rf-41 nie doszedł.
const OVG_ORDER = ["head", "pose", "motion", "press", "pad", "wheel", "rules", "midi"];

// SZABLONY NOWEGO OKNA. Nakładka kontrolera osobno i nakładka koła osobno,
// ale mogą być też wbudowane w nakładkę kapsla. Więc nie nowy RODZAJ
// okna (to byłoby okno, którego nie da się nie mieć), tylko zwykła nakładka z gotowo ustawionym
// kompletem elementów. `show` jedzie w całości: serwer scala je
// z kopią źródła klucz po kluczu (_sanitize_overlay_win), więc wypisanie samych `true` zostawiłoby
// włączone wszystko, co miał oryginał.
function _ovgShow(on) {
  const out = {};
  for (const p of (typeof OVL_PARTS !== "undefined" ? OVL_PARTS : [])) out[p.key] = false;
  for (const k of (on || [])) out[k] = true;
  return out;
}
// ⚠️ SZABLON NIE PODAJE ROZMIARU i to nie jest przeoczenie: od 2026-09-01 okno mierzy się samo
// (`ovlAutoFit` w rf-41), więc wpisana tu szerokość i wysokość zostałyby nadpisane przy pierwszym
// pokazaniu — czyli byłyby obietnicą, której szablon nie dotrzymuje. Szablon mówi, CO w oknie stoi;
// jak duże ma być, wynika z tego samo.
const OVG_TEMPLATES = [
  { k: "copy", label: "Kopia tej nakładki", hint: "to samo, co „Dołóż okno” wyżej", cfg: null },
  // ⚠️ `cfg` tej pozycji to DROGA AWARYJNA dla kapsla wpiętego w żaden kontroler. Kapsel wpięty
  // w jakikolwiek dostaje zamiast tego `_ovgCtlCfg` (patrz `_ovgAdd`), czyli pełną nakładkę
  // kontrolera z wierszem „kto na nim gra".
  { k: "pad", label: "Tylko kontroler", hint: "sam rysunek pada, ze wszystkimi kapslami",
    cfg: { label: "kontroler", show: _ovgShow(["pad", "pad.who"]) } },
  { k: "wheel", label: "Tylko koło wyboru", hint: "samo koło, przy krawędzi ekranu",
    cfg: { label: "koło", show: _ovgShow(["wheel"]) } },
  { k: "rules", label: "Tylko wyzwalacze", hint: "sama lista reguł, słupkiem przy boku",
    cfg: { label: "wyzwalacze", show: _ovgShow(["rules", "cond", "fires"]) } },
  { k: "pose", label: "Tylko orientacja", hint: "sama kula orientacji",
    cfg: { label: "orientacja", show: _ovgShow(["pose"]) } },
];

let _ovgIfWid = "";       // które okno stoi w ramce (żeby nie przeładowywać jej przy każdym syncu)
let _ovgBg = "dark";      // umowne tło pod miniaturą — patrz rf-ovl-preview w 15-overlay.css
let _ovgTileSig = "";     // sygnatura kafelków (przerysowanie tylko przy realnej zmianie)
let _ovgMenu = null;      // otwarte menu szablonów (jedno naraz)

// ------------------------------------------------------------------------------------------
//  PODGLĄD NA ŻYWO — PRAWDZIWE OKNO, NIE MINIATURA
// ------------------------------------------------------------------------------------------
// Aktualnie edytowana nakładka otwiera się od razu w nowym oknie: wyglądem osobnego okna
// i tak steruje się z głównego, a tylko w osobnym oknie działa przezroczystość itp.
//
// I to jest sedno: PRZEZROCZYSTOŚĆ ROBI WINDOWS, nie strona (pomiar z 2026-08-31, LWA_COLORKEY
// razem z LWA_ALPHA). Ramka w panelu może ją tylko UDAWAĆ — przygasić treść tak, żeby suwak nie
// wyglądał na zepsuty — a udawanie nie odpowiada na jedyne pytanie, które się tu zadaje: „czy
// przez to będzie widać grę". Otwarte okno odpowiada, bo jest tą odpowiedzią.
//
// Zasady, żeby ekran nie zaczął rozstawiać okien komuś na biurku:
//   • zamykamy WYŁĄCZNIE to, co sami otworzyliśmy. Okno, które ktoś postawił nad grą świadomie
//     (pasek „Pokaż nad grą", zasobnik, poprzednia sesja), zostaje — także wtedy, gdy akurat je
//     ustawiamy;
//   • jedno naraz: zmiana kafelka zamyka poprzednie, wyjście z ekranu zamyka wszystko nasze;
//   • okna KOŁA nie otwieramy nigdy. Ono chodzi za kursorem i pokazuje się na czas wybierania —
//     otwarte „na podgląd" siedziałoby pod wskaźnikiem przez cały czas ustawiania;
//   • wszystko to daje się wyłączyć jednym przełącznikiem, który pamięta swój stan.
const OVG_LIVE_KEY = "ribbitflip.ovg.live";
let _ovgLive = true;      // czy otwierać ustawiane okno naprawdę
let _ovgLiveFor = null;   // dla którego okna podjęliśmy już decyzję (null = jeszcze dla żadnego)
let _ovgOpened = "";      // które okno otworzyliśmy MY (tylko takie wolno nam zamknąć)
let _ovgOpenedAt = 0;     // kiedy (ms): do kilku sekund po otwarciu serwer może jeszcze mówić „nie stoi"
try { _ovgLive = localStorage.getItem(OVG_LIVE_KEY) !== "0"; } catch (e) { /* brak pamięci przeglądarki */ }

// ------------------------------------------------------------------------------------------
//  ZNACZNIKI
// ------------------------------------------------------------------------------------------
// ⚠️ NAPISY STAŁE PO POLSKU, BEZ `_cvT` — z tego samego powodu, co w rf-41b: ten blok powstaje raz,
// przy starcie panelu, a walker i18n (rf-01) umie cofnąć tylko to, co sam przetłumaczył.
// DWA ZNACZNIKI, DWIE KOLUMNY EKRANU (2026-09-01, druga iteracja). Zlecenie: „chcę to mieć tak
// przebudowane, żebym widział po lewej podgląd, a po prawej parametry/kolejność itp." Do tej pory
// podgląd i kafelki stały obok siebie w JEDNEJ karcie, a ustawienia leciały pod nią przez całą
// szerokość — więc przy dłuższej liście trzeba było przewijać, a podgląd uciekał w górę.
// Teraz podgląd jest OSOBNĄ kartą, którą rf-49p stawia w lewej kolumnie ekranu i przykleja
// (`data-rfpc-shared="left"`), a kafelki i cała reszta idą w prawą.
function ovgPrevHtml() {
  return `<div class="ovg-prev" id="ovgPrev">` +
    `<div class="ovg-prev-hd"><span class="ovg-prev-lbl">Podgląd nakładki</span>` +
      `<span class="ovg-scale" id="ovgScaleTag"></span></div>` +
    `<div class="ovg-stage" id="ovgStage">` +
      `<div class="ovg-none" id="ovgNone"></div>` +
    `</div>` +
    `<div class="ovg-meta"><b class="ovg-meta-nm" id="ovgMetaNm">—</b>` +
      `<span class="ovg-meta-dim" id="ovgMetaDim"></span></div>` +
    `<div class="ovg-row"><span class="ovg-bg-lbl">Tło podglądu</span>` +
      `<span class="ovm-pills" id="ovgBgPick">` +
        `<button type="button" class="ovm-pill ovg-bg on" data-bg="dark">Ciemna gra</button>` +
        `<button type="button" class="ovm-pill ovg-bg" data-bg="light">Jasna gra</button>` +
      `</span>` +
    `</div>` +
    // PODGLĄD W PRAWDZIWYM OKNIE (UX 261120 B5b, decyzja D20). Samoczynne otwieranie zostaje, ale
    // jako dźwignia z nazwą i zdaniem, które mówi, co się dzieje: różowy przycisk „Otwieraj na
    // żywo" wyglądał jak druga akcja „pokaż nad grą", a był przełącznikiem.
    `<label class="rf-swrow ovg-live-sw"><input type="checkbox" class="rf-swi" id="ovgLive"${_ovgLive ? " checked" : ""}>` +
      `<span class="rf-swrow-tx">Podgląd w prawdziwym oknie` +
        `<small>Dopóki jesteś na tym ekranie, ustawiane okno stoi otwarte. Zamknie się, gdy stąd wyjdziesz.</small></span></label>` +
    `<div class="ovg-hint" id="ovgHint"></div>` +
  `</div>`;
}
function ovgPickHtml() {
  return `<div class="ovg-pick" id="ovgPick">` +
    `<span class="ovm-pick-lbl">Które okno ustawiasz</span>` +
    `<div class="ovg-groups" id="ovgGroups"></div>` +
  `</div>`;
}

// Jeden schemat okna — prostokąt w proporcji `w:h` z klockami włączonych części.
function _ovgBoxHtml(w) {
  const c = w.cfg || {};
  const sh = c.show || {}, sp = c.scaleParts || {};
  const ww = Math.max(1, Math.round(+c.w || 0)) || 400;
  const hh = Math.max(1, Math.round(+c.h || 0)) || 560;
  const theme = c.theme || "bare";   // the server default is "bare" for every window kind
  const lbl = {};
  for (const p of (typeof OVL_PARTS !== "undefined" ? OVL_PARTS : [])) lbl[p.key] = p.label;
  // OKNO KOŁA MA JEDNĄ TREŚĆ i nie przechodzi przez `show` — serwer buduje je pod samo koło.
  // Rysujemy więc kółko, a nie stos klocków, bo stos jednego klocka wygląda jak pomyłka.
  const blocks = w.wheel
    ? `<span class="ovg-blk ovg-blk-wheel" data-part="wheel"></span>`
    : ((typeof ovlOrderOf === "function") ? ovlOrderOf(c) : OVG_ORDER).filter(k => sh[k]).map(k => {
        const sc = Math.max(40, Math.min(250, +sp[k] || 100)) / 100;
        return `<span class="ovg-blk" data-part="${k}" style="flex:${(OVG_WEIGHT[k] * sc).toFixed(1)}">` +
          `<i>${esc(lbl[k] || k)}</i></span>`;
      }).join("");
  const empty = (!w.wheel && !blocks)
    ? `<span class="ovg-blk-none">—</span>` : "";
  // `has-wheel` mówi CSS-owi, że w tym pudełku stoi pierścień, a nie stos klocków — i tylko takie
  // pudełko staje się KONTENERem zapytań rozmiarowych (24-overlay-gallery.css). Tylko takie, bo
  // `container-type:size` odcina wpływ treści na rozmiar pudełka: tu jest to prawdą z definicji
  // (bok liczy się z `aspect-ratio` i z szerokości kafelka), ale nie jest rzeczą, którą warto
  // obiecywać za każdy kafelek naraz.
  return `<span class="ovg-box${(c.show && c.show.bg) ? " has-bg" : ""}${w.wheel ? " has-wheel" : ""}" ` +
    `data-theme="${esc(theme)}" style="aspect-ratio:${ww}/${hh}">${blocks}${empty}</span>`;
}

// Nazwa okna w kafelku — to samo, co w dawnych pigułkach (rf-41b): nazwa kapsla stoi w etykiecie
// grupy nad kafelkami, więc kafelek nosi wyłącznie to, co go RÓŻNI od sąsiada.
function _ovgOwnName(w, wins) {
  if (w.wheel) return _cvT("koło przy kursorze");
  const own = ((w.cfg && w.cfg.label) || "").trim();
  if (own) return own;
  const mine = wins.filter(x => x.dev === w.dev && !x.wheel);
  const nth = mine.indexOf(w) + 1;
  return mine.length > 1 ? (_gl("nakładka ", "overlay ") + nth) : _gl("nakładka", "overlay");
}

// CZY TO OKNO ZROBIONO DLA KONTROLERA (2026-09-11) — i dla którego. Odpowiedź musi przejść przez
// REJESTR: zapisany identyfikator pada, którego już nie ma (kontroler usunięto), robi z okna
// zwykłą nakładkę kapsla, a nie sierotę w grupie, do której nie da się wejść.
function _ovgPadOf(w) {
  const pid = ((w && w.cfg && w.cfg.pad) || "").trim();
  if (!pid) return "";
  if (typeof padById !== "function" || !padById(pid)) return "";
  return pid;
}
// KONTROLERY, KTÓRE MAJĄ WŁASNY RZĄD. Każdy z rejestru, w który wpięty jest choć jeden kapsel —
// także taki BEZ nakładki: rząd z samym ＋ jest tym, co pokazuje, że taką nakładkę w ogóle da się
// zrobić. Pusty kontroler pomijamy, bo nie miałby czego rysować.
function _ovgCtlPads() {
  if (typeof padList !== "function" || typeof padMembers !== "function") return [];
  return padList().filter(p => padMembers(p.id).length);
}

function _ovgTiles(wins, sel) {
  const host = document.getElementById("ovgGroups"); if (!host) return;
  const ctl = _ovgCtlPads();
  const sig = wins.map(w => {
    const c = w.cfg || {};
    return [w.wid, w.title, w.running ? 1 : 0, c.w, c.h, c.theme, (c.show && c.show.bg) ? 1 : 0,
            c.pad || "", JSON.stringify(c.show || {}), JSON.stringify(c.scaleParts || {})].join("~");
  }).join("|") + "#" + sel +
    // Skład kontrolerów jest częścią obrazka: chipy w nagłówku grupy i sam fakt jej istnienia
    // biorą się z rejestru, więc wpięcie kapsla musi przerysować pas tak samo jak zmiana okna.
    "#" + ctl.map(p => [p.id, p.name || "", padMembers(p.id).join(",")].join("~")).join("|");
  if (host._sig === sig) return;
  host._sig = sig;
  _ovgTileSig = sig;

  // JEDEN KAFELEK — ten sam w rzędzie kapsla i w rzędzie kontrolera, bo to ten sam byt oglądany
  // z dwóch stron. `scope` to zbiór okien, w obrębie którego liczy się szerokość kafelka: rząd ma
  // pokazywać proporcje między SWOIMI oknami, nie między wszystkimi w aplikacji.
  const tile = (w, scope) => {
    const on = (w.wid === sel);
    // SZEROKOŚĆ KAFELKA IDZIE ZA PRAWDZIWĄ SZEROKOŚCIĄ OKNA w obrębie rzędu — o to prosi
    // „podgląd rozmiarów": pasek 900 px ma być na tym rzędzie wyraźnie szerszy od słupka 300 px.
    // Sufit i podłoga są po to, żeby jedno bardzo szerokie okno nie zdusiło reszty do kresek.
    const maxW = Math.max.apply(null, scope.map(x => +((x.cfg || {}).w) || 400));
    const tw = Math.round(Math.max(74, Math.min(150, 150 * ((+((w.cfg || {}).w) || 400) / (maxW || 400)))));
    const c = w.cfg || {};
    // Wymiar w pikselach CSS — bo tyle okno ma NA EKRANIE, a to jest liczba, którą ludzie mają
    // na myśli, mówiąc „okno na 400". W ustawieniach siedzą piksele fizyczne (patrz `_ovgFit`).
    const dpr0 = window.devicePixelRatio || 1;
    const dim = (c.w && c.h) ? (Math.round(c.w / dpr0) + "×" + Math.round(c.h / dpr0))
                             : _cvT("jeszcze nie utworzona");
    return `<button type="button" class="ovg-tile${on ? " on" : ""}${w.wheel ? " is-wheel" : ""}" ` +
      `data-win="${esc(w.wid)}" role="tab" aria-selected="${on ? "true" : "false"}" ` +
      `style="--tw:${tw}px">` +
      _ovgBoxHtml(w) +
      `<span class="ovg-tile-nm">${esc(_ovgOwnName(w, scope))}</span>` +
      `<span class="ovg-tile-dim">${esc(dim)}</span>` +
      (w.running ? `<span class="ovg-tile-on" title="${_cvT("na ekranie")}"></span>` : "") +
      `</button>`;
  };

  let html = "", cap = null;
  const flush = () => { if (cap !== null) html += `</div></div>`; };
  // RZĘDY KAPSLI — bez okien zrobionych dla kontrolera: te mają własny rząd niżej i stanie
  // w dwóch naraz znaczyłoby, że jedno kliknięcie wybiera dwa różne kafelki.
  const capWins = wins.filter(w => !_ovgPadOf(w));
  for (const w of capWins) {
    if (w.cap !== cap) {
      flush(); cap = w.cap;
      html += `<div class="ovg-grp" style="--dcol:${esc(w.color)}">` +
        `<span class="ovg-cap">${esc(w.cap)}</span><div class="ovg-tiles" role="tablist">`;
    }
    html += tile(w, capWins.filter(x => x.dev === w.dev));
  }
  // ＋ NA KOŃCU KAŻDEJ GRUPY — ale dopisany po pętli, bo grupę zamyka dopiero następny kapsel.
  // Prostsze: wstawiamy go przy zamykaniu grupy, więc pętla wyżej zna tylko kafelki okien.
  flush();
  // RZĘDY KONTROLERÓW (2026-09-11). Osobne od kapsli, bo odpowiadają na inne pytanie: kapsel to
  // JEDNA ręka, kontroler to JEDEN GRACZ, którego gra widzi — i chipy w nagłówku mówią, z których
  // rąk on się składa. To jest całe wytłumaczenie tej nakładki; dwa chipy w nagłówku znaczą „to
  // okno pokazuje oba" tak samo, jak dwa chipy w pudełku w zakładce „Kontroler".
  for (const p of ctl) {
    const mem = padMembers(p.id);
    const mine = wins.filter(w => _ovgPadOf(w) === p.id);
    const lab = (typeof padLabel === "function") ? padLabel(p.id) : p.id;
    html += `<div class="ovg-grp ovg-grp-ctl" data-pad="${esc(p.id)}" data-dev="${esc(mem[0] || "")}">` +
      `<span class="ovg-cap ovg-cap-ctl">${esc(lab)}` +
        mem.map(d => `<span class="ovg-capchip" style="--dcol:${esc(padCapColor(d))}">` +
          `<i aria-hidden="true"></i>${esc(padCapName(d))}</span>`).join("") +
      `</span><div class="ovg-tiles" role="tablist">`;
    for (const w of mine) html += tile(w, mine);
    html += `</div></div>`;
  }
  host.innerHTML = html;
  // Dopiero teraz ＋ do każdej grupy: nie da się go wpleść w pętlę, bo grupa kończy się na
  // kapslu NASTĘPNYM, a `＋` należy do bieżącego.
  for (const g of host.querySelectorAll(".ovg-grp")) {
    const row = g.querySelector(".ovg-tiles"); if (!row) continue;
    const isCtl = g.classList.contains("ovg-grp-ctl");
    let dev = g.dataset.dev || "";
    if (!isCtl) {
      const first = row.querySelector(".ovg-tile[data-win]"); if (!first) continue;
      const wobj = wins.find(x => x.wid === first.dataset.win); if (!wobj) continue;
      dev = wobj.dev;
    }
    if (!dev) continue;
    const b = document.createElement("button");
    b.type = "button"; b.className = "ovg-new" + (isCtl ? " ovg-new-ctl" : "");
    b.dataset.dev = dev;
    // ＋ W RZĘDZIE KONTROLERA NIE OTWIERA MENU SZABLONÓW. Rodzaj okna jest tu już rozstrzygnięty
    // przez rząd, w którym stoi ten przycisk — menu z pytaniem „co w nim postawić" kazałoby
    // odpowiadać drugi raz na to samo. Jedno kliknięcie, gotowa nakładka kontrolera.
    if (isCtl) b.dataset.pad = g.dataset.pad || "";
    b.title = isCtl ? _cvT("Nowa nakładka tego kontrolera — sam rysunek pada, ze wszystkimi kapslami, które na nim grają")
                    : _cvT("Nowa nakładka tego kapsla — pusta kopia albo gotowy szablon");
    b.setAttribute("aria-label", b.title);
    b.innerHTML = `<span class="ovg-new-plus" aria-hidden="true">＋</span>` +
      `<span class="ovg-new-lbl">${esc(_cvT(isCtl ? "nakładka kontrolera" : "nowa nakładka"))}</span>`;
    row.appendChild(b);
  }
  if (typeof applyLang === "function") try { applyLang(host); } catch (e) { /* i18n nie doszło */ }
}

// ------------------------------------------------------------------------------------------
//  MINIATURA
// ------------------------------------------------------------------------------------------
// RAMKA POWSTAJE RAZ NA OKNO. Każde `src=` to pełne załadowanie strony (cała aplikacja, własny
// strumień), więc zmieniamy ją wyłącznie przy zmianie WYBRANEGO okna — a nie przy każdym syncu,
// który leci co 4 s.
function _ovgFrame(w) {
  const stage = document.getElementById("ovgStage"); if (!stage) return;
  const none = document.getElementById("ovgNone");
  const wid = w ? w.wid : "";
  if (_ovgIfWid !== wid) {
    _ovgIfWid = wid;
    const old = stage.querySelector("iframe"); if (old) old.remove();
    if (w) {
      const f = document.createElement("iframe");
      f.className = "ovg-frame";
      f.id = "ovgFrame";
      f.setAttribute("tabindex", "-1");
      f.setAttribute("aria-hidden", "true");   // to jest OBRAZEK; treść czyta się z kafelków i edytora
      f.setAttribute("scrolling", "no");
      // ⚠️ `view=overview` MUSI TU BYĆ i to nie jest ozdoba: to ono zostawia na stronie samą
      // ściągę (body.overview-only, rf-40). Bez niego ramka ładuje CAŁY panel — z nawigacją,
      // paskiem górnym i kolumną kapsli — a skin nakładki chowa tylko to, co znał w 2026-08.
      // Adres jest lustrem tego, który buduje `OverlayWindow.open` w ribbitflip_monitor.py:
      // podgląd ma być tą samą stroną, a nie stroną podobną.
      f.dataset.load = "/?view=overview&overlay=1&preview=1&dev=" + encodeURIComponent(w.dev) +
                       "&win=" + encodeURIComponent(w.wid) + (w.wheel ? "&wheel=1" : "");
      f.addEventListener("load", () => { ovgBackdrop(_ovgBg); });
      stage.appendChild(f);
      _ovgFrameLoad();
    }
  }
  if (none) none.hidden = !!w;
  if (!w) { _ovgFit(null); return; }
  _ovgFit(w);
}

// ADRES DOSTAJE RAMKA, KTÓRĄ WIDAĆ. Karta podglądu jest `data-rfpc-shared`, czyli stoi w DOM-ie na
// każdym ekranie — a każde `src=` to załadowanie CAŁEJ aplikacji jeszcze raz, z własnym strumieniem.
// Robione od razu, przy pierwszym syncu, kończyło się przerwanym żądaniem (`net::ERR_ABORTED`
// w konsoli przy każdym starcie panelu) i sekundą pracy na coś, na co nikt jeszcze nie patrzył.
// Adres czeka więc w `data-load` do pierwszego wejścia na ekran „Nakładka".
function _ovgFrameLoad() {
  if (!_ovgOnScreen()) return;
  const f = document.getElementById("ovgFrame");
  if (!f || f.getAttribute("src")) return;
  const u = f.dataset.load || "";
  if (u) f.src = u;
}

// POMNIEJSZENIE. Ramka dostaje PRAWDZIWY rozmiar okna w pikselach i jest skalowana — nie odwrotnie.
// To jedyny sposób, żeby podgląd mówił coś o rozmiarze: przy ramce rozciągniętej na szerokość
// pudełka litery byłyby zawsze tak samo duże, a pytanie „czy to się da przeczytać w kącie ekranu"
// jest właśnie pytaniem o stosunek liter do okna.
function _ovgFit(w) {
  const stage = document.getElementById("ovgStage");
  const f = document.getElementById("ovgFrame");
  const tag = document.getElementById("ovgScaleTag");
  if (!stage) return;
  if (!f || !w) { if (tag) tag.textContent = ""; return; }
  const c = w.cfg || {};
  // ⚠️ RAMKĘ SIĘ USTAWIA W PIKSELACH CSS, A `w`/`h` SĄ FIZYCZNE. Na ekranie skalowanym 150%
  // okno o `w=600` ma 400 px CSS — i to w takiej szerokości układa się jego treść. Ramka szeroka
  // na 600 px CSS pokazywałaby ten sam obraz UŁOŻONY INACZEJ: napisy zawijałyby się w innych
  // miejscach niż nad grą, czyli podgląd kłamałby dokładnie o tym, po co się na niego patrzy.
  const dpr = window.devicePixelRatio || 1;
  const ww = Math.max(1, Math.round((+c.w || 400) / dpr));
  const hh = Math.max(1, Math.round((+c.h || 560) / dpr));
  const availW = Math.max(80, stage.clientWidth - 2);
  const availH = Math.max(80, stage.clientHeight - 2);
  const k = Math.min(availW / ww, availH / hh, 1);
  f.style.width = ww + "px";
  f.style.height = hh + "px";
  f.style.transform = "scale(" + k.toFixed(4) + ")";
  // Wyśrodkowanie liczymy tutaj, a nie flexem: element ze `scale` zajmuje w układzie SWÓJ pełny
  // rozmiar (400×560), więc pudełko centrowałoby prostokąt, którego nie widać.
  f.style.marginLeft = Math.round((availW - ww * k) / 2) + "px";
  f.style.marginTop = Math.round((availH - hh * k) / 2) + "px";
  if (tag) tag.textContent = (k >= 0.999)
    ? _cvT("prawdziwy rozmiar")
    : (_cvT("pomniejszone do") + " " + Math.round(k * 100) + "%");
}

// ⚠️ MINIATURA NIE ZAPISUJE WIELKOŚCI — i przez chwilę zapisywała (2026-09-01, cofnięte tego
// samego dnia). Powód: w ramce nie ma paska nakładki, bo miniatura niczym nie steruje — a pasek
// stoi W UKŁADZIE okna i zabiera swoje kilkanaście pikseli. Pomiar z ramki wychodził więc
// systematycznie o pasek za niski, czyli dokładnie tak, jak wyglądał zgłoszony błąd („na dole nie
// starczy"). Wielkość liczy wyłącznie okno, gdy stoi na ekranie — a przy „Podglądzie w prawdziwym oknie" stoi
// tam sekundę po wybraniu kafelka.

// Umowne tło pod miniaturą. Klasa idzie WPROST do dokumentu ramki — obie strony są tego samego
// pochodzenia, a przeładowanie ramki po to, żeby zmienić jeden kolor, gasiłoby podgląd na sekundę.
function ovgBackdrop(kind) {
  _ovgBg = (kind === "light") ? "light" : "dark";
  for (const b of document.querySelectorAll(".ovg-bg")) b.classList.toggle("on", b.dataset.bg === _ovgBg);
  const f = document.getElementById("ovgFrame");
  try {
    const d = f && f.contentDocument;
    if (d) d.documentElement.classList.toggle("rf-ovl-bg-light", _ovgBg === "light");
  } catch (e) { /* ramka jeszcze się ładuje — dołoży to jej `load` */ }
}

// ------------------------------------------------------------------------------------------
//  PODGLĄD NA ŻYWO — OTWIERANIE I ZAMYKANIE
// ------------------------------------------------------------------------------------------
// Jedno wejście: „wybrano okno W". Wołane z `ovgSync`, ale robi coś TYLKO przy zmianie wyboru —
// sync leci co 4 s i otwieranie okna na każdy tik byłoby otwieraniem okna w kółko (a także:
// odbieraniem człowiekowi możliwości zamknięcia go ręcznie).
// ⚠️ TYLKO NA WŁASNYM EKRANIE. `ovgSync` chodzi co 4 s niezależnie od tego, gdzie się stoi —
// bez tego warunku panel otwierałby okno nad grą zaraz po starcie, komuś, kto na ekran „Nakładka"
// w tej sesji w ogóle nie wszedł. Otwiera się to, co się właśnie ustawia, a ustawia się tam.
function _ovgOnScreen() {
  const p = document.getElementById("tab-wszystkie");
  return !!(p && p.classList.contains("active"));
}
function _ovgLiveApply(w) {
  if (!_ovgOnScreen()) return;
  const wid = w ? w.wid : "";
  if (_ovgLiveFor === wid) return;
  _ovgLiveFor = wid;
  _ovgLiveClose();
  if (!_ovgLive || !w || w.wheel) return;
  // Nie ma jak otworzyć (brak przeglądarki na silniku Chromium) — pasek stanu karty już to mówi,
  // a druga wiadomość o tym samym byłaby zrzędzeniem.
  const s = (typeof OVL !== "undefined" && OVL.state) ? OVL.state : null;
  if (s && s.avail === false) return;
  // JUŻ STOI, BO KTOŚ TAK CHCIAŁ. Nie zapisujemy go jako „nasze" — czyli nie zamkniemy go przy
  // zmianie kafelka ani przy wyjściu z ekranu. Zamykanie cudzego okna dlatego, że się na nie
  // popatrzyło, byłoby najgorszym rodzajem pomocy.
  if (w.running) return;
  if (typeof ovlPost !== "function") return;
  _ovgOpened = w.wid; _ovgOpenedAt = Date.now();
  ovlPost({ act: "open", win: w.wid, dev: w.dev }).then(x => {
    if (x && x.error) {
      _ovgOpened = "";
      if (typeof rfToast === "function") rfToast(x.error, { tone: "danger", ms: 5000 });
    }
    if (typeof ovlPanelSync === "function") try { ovlPanelSync(x); } catch (e) { }
  });
}
function _ovgLiveClose() {
  const wid = _ovgOpened; _ovgOpened = "";
  if (!wid || typeof ovlPost !== "function") return;
  ovlPost({ act: "close", win: wid }).then(x => {
    if (typeof ovlPanelSync === "function") try { ovlPanelSync(x); } catch (e) { }
  });
}
// Wyjście z ekranu „Nakładka" (rf-34 `setTab`) i zamknięcie panelu. Okno otwarte NA PODGLĄD ma
// żyć tyle, co ekran, na którym się je ustawiało — inaczej zostałoby nad grą, choć nikt o nie
// nie prosił, i wyglądałoby na nakładkę, która „sama się włączyła".
function ovgLiveLeave() { _ovgLiveFor = null; _ovgLiveClose(); }
// …i wejście na niego: decyzja o oknie zapada dopiero tutaj, więc wejście musi ją wywołać.
// Wołane z rf-34 `setTab` PO nadaniu panelowi klasy `active` — wcześniej `_ovgOnScreen` odpuści.
function ovgLiveEnter() {
  _ovgFrameLoad();
  _ovgLiveFor = null;
  if (typeof ovmWindowOf === "function" && typeof _ovmSel !== "undefined") _ovgLiveApply(ovmWindowOf(_ovmSel));
}
// ⚠️ PRZY ZAMYKANIU STRONY ZWYKŁY `fetch` BYWA PORZUCONY — przeglądarka ubija żądania odchodzącej
// karty. Złapane na odświeżeniu panelu: okno zostawało na ekranie, a nowa strona zastawała je
// otwarte i (słusznie) uznawała za cudze, więc nie zamykała go już nigdy. `sendBeacon` jest do
// dokładnie tego: oddaje żądanie systemowi i przeżywa śmierć strony.
window.addEventListener("pagehide", () => {
  const wid = _ovgOpened; _ovgOpened = "";
  if (!wid) return;
  const body = JSON.stringify({ act: "close", win: wid });
  try {
    if (navigator.sendBeacon &&
        navigator.sendBeacon("/overlay", new Blob([body], { type: "application/json" }))) return;
  } catch (e) { /* poniżej jest droga awaryjna */ }
  try { fetch("/overlay", { method: "POST", headers: { "Content-Type": "application/json" },
                            body: body, keepalive: true }); } catch (e) { }
});

// Przełącznik. Wyłączenie zamyka to, co już otworzyliśmy; włączenie otwiera bieżące okno od razu,
// bo inaczej trzeba by kliknąć kafelek dwa razy, żeby przełącznik cokolwiek zrobił.
function ovgLiveToggle(on) {
  _ovgLive = (typeof on === "boolean") ? on : !_ovgLive;
  try { localStorage.setItem(OVG_LIVE_KEY, _ovgLive ? "1" : "0"); } catch (e) { }
  const b = document.getElementById("ovgLive");
  if (b && b.checked !== _ovgLive) b.checked = _ovgLive;
  const cur = _ovgLiveFor;
  _ovgLiveFor = null;
  _ovgLiveApply(typeof ovmWindowOf === "function" ? ovmWindowOf(cur) : null);
}

// PIGUŁKA OKNA W TRZECH STANACH (UX 261120 B5b, P-G6-10 i F-G6-01). Pigułka zawsze mówi CZYNNOŚĆ:
//   "show" — okno nie stoi: „Pokaż nad grą",
//   "keep" — okno stoi, bo otworzył je ten ekran na podgląd (zniknie przy wyjściu): „Zostaw nad grą";
//            kliknięcie niczego nie zamyka, tylko zwalnia okno z `_ovgOpened`, więc zostaje,
//   "hide" — okno stoi na stałe: „Schowaj".
// Każde przełączenie z pigułki albo `#ovmPower` też zwalnia okno (`ovgRelease`): okno, które ktoś
// świadomie schował i pokazał, nie jest już „podglądem" i wyjście z ekranu nie może go zamknąć.
function ovgWinMode(wid, running) {
  if (!running) return "show";
  return (wid && wid === _ovgOpened) ? "keep" : "hide";
}
function ovgRelease(wid) {
  if (wid && wid === _ovgOpened) _ovgOpened = "";
}
function ovgKeep(wid) {
  ovgRelease(wid);
  if (typeof rfSay === "function")
    rfSay(_gl("Okno zostaje nad grą także po wyjściu z tego ekranu.", "The window stays over the game after you leave this screen too."), { tone: "ok" });
  if (typeof ovlPanelSync === "function") try { ovlPanelSync(); } catch (e) { }
}
// Okno „nasze" zamknięte gdzie indziej (zasobnik, ✕ w samym oknie) przestaje być nasze. Bez tego
// ponowne pokazanie go z zasobnika zostawiałoby je na liście do zamknięcia przy wyjściu. Kilka
// sekund łaski po otwarciu, bo odpowiedź serwera bywa sprzed otwarcia; w razie wątpliwości okno
// raczej zostaje na ekranie, niż znika komuś spod ręki.
function _ovgDropStale(wins) {
  if (!_ovgOpened || Date.now() - _ovgOpenedAt < 6000) return;
  const w = (wins || []).find(x => x.wid === _ovgOpened);
  if (!w || !w.running) _ovgOpened = "";
}

// „PRZECZYTAJ USTAWIENIA TERAZ". Woła to rf-41b po każdym zapisie: własne odpytanie ramki chodzi
// co 3 s, a prośba brzmiała „aktualizuje na bieżąco".
function ovgPoke() {
  const f = document.getElementById("ovgFrame");
  try {
    const fn = f && f.contentWindow && f.contentWindow.rfOvlPreviewRefresh;
    if (typeof fn === "function") fn();
  } catch (e) { /* ramka w trakcie ładowania — sama przeczyta na starcie */ }
}

// ⚠️ MINIATURA NIE ZAPISUJE WIELKOŚCI — a przez chwilę zapisywała (2026-09-01, cofnięte tego
// samego dnia po zgłoszeniu „na dole nie starczy"). Powód: w ramce nie ma paska nakładki, bo
// miniatura niczym nie steruje — a pasek stoi W UKŁADZIE okna i zabiera swoje kilkanaście pikseli.
// Pomiar z ramki wychodził więc systematycznie o pasek za niski. Wielkość liczy wyłącznie okno,
// gdy stoi na ekranie (`ovlAutoFit` w rf-41) — a przy „Podglądzie w prawdziwym oknie" stoi tam sekundę po
// wybraniu kafelka.

// Podświetlenie części z edytora („najedź na wiersz — element mignie w nakładce"). Do 2026-09-01
// zapalało się na ściądze pod spodem; ściąga zeszła na własną zakładkę, więc pytanie „który to
// prostokąt" odpowiada teraz miniatura — czyli to samo okno, o którym mowa.
function ovgHighlight(part, on) {
  const f = document.getElementById("ovgFrame");
  try {
    const fn = f && f.contentWindow && f.contentWindow.rfOvlPreviewHighlight;
    if (typeof fn === "function") fn(part, on);
  } catch (e) { /* jw. */ }
}

// ------------------------------------------------------------------------------------------
//  SZABLONY PRZY ＋
// ------------------------------------------------------------------------------------------
function _ovgCloseMenu() {
  if (!_ovgMenu) return;
  const m = _ovgMenu; _ovgMenu = null;
  if (m.btn) m.btn.setAttribute("aria-expanded", "false");
  if (m.el && m.el.parentNode) m.el.parentNode.removeChild(m.el);
}
function _ovgOpenMenu(btn) {
  if (_ovgMenu && _ovgMenu.btn === btn) { _ovgCloseMenu(); return; }
  _ovgCloseMenu();
  const el = document.createElement("div");
  el.className = "ovg-menu";
  el.setAttribute("role", "menu");
  // POZYCJA „Tylko kontroler" NAZYWA KONKRETNY KONTROLER, gdy grają na nim dwa kapsle albo więcej
  // (2026-09-11) — „Kontroler 1 · Triki 3 + Triki 5" mówi w jednej linii i CO powstanie, i czemu
  // warto: nazwa wymienia obie ręce, które będzie widać na jednym rysunku. Przy jednym kapslu
  // zostaje stara nazwa, bo nie ma tam czego wymieniać.
  const dev0 = btn.dataset.dev || "";
  const pid0 = (typeof gpvPadId === "function") ? gpvPadId(dev0) : "";
  const mem0 = (pid0 && typeof padMembers === "function") ? padMembers(pid0) : [];
  el.innerHTML = OVG_TEMPLATES.map(t => {
    let label = _cvT(t.label), hint = _cvT(t.hint);
    if (t.k === "pad" && mem0.length > 1) {
      label = (typeof padLabel === "function") ? padLabel(pid0) : label;
      hint = mem0.map(d => padCapName(d)).join(" + ");
    }
    return `<button type="button" class="ovg-menu-it" role="menuitem" data-tpl="${t.k}">` +
      `<b>${esc(label)}</b><i>${esc(hint)}</i></button>`;
  }).join("");
  btn.parentNode.insertBefore(el, btn.nextSibling);
  // ⚠️ MENU MUSI STAĆ PRZY SWOIM PRZYCISKU, a samo `position:absolute` tego nie załatwia: bez
  // ustawionego przodka menu liczy się od pierwszego pozycjonowanego elementu wyżej (zmierzone:
  // `.ovm-body`) i lądowało 300 px w lewo, 150 px w górę od ＋, na cudzych kafelkach. Pas kafelków
  // jest `position:relative` (24-overlay-gallery.css), więc obie rzeczy liczą się od tego samego
  // pudełka i wystarczy przepisać `offsetLeft/offsetTop` przycisku.
  const row = btn.parentNode;
  const room = row.clientWidth || 0;
  el.style.top = (btn.offsetTop + btn.offsetHeight + 4) + "px";
  // …a jeśli przy prawej krawędzi się nie mieści, równamy do prawego boku przycisku, zamiast
  // wypychać pas w bok paskiem przewijania.
  const w = el.offsetWidth || 214;
  el.style.left = Math.max(0, Math.min(btn.offsetLeft, room - w)) + "px";
  btn.setAttribute("aria-expanded", "true");
  _ovgMenu = { btn: btn, el: el, dev: btn.dataset.dev };
  const first = el.querySelector(".ovg-menu-it"); if (first) try { first.focus(); } catch (e) { }
}
function _ovgAdd(dev, tplKey, btn) {
  const t = OVG_TEMPLATES.find(x => x.k === tplKey) || OVG_TEMPLATES[0];
  if (btn) btn.disabled = true;
  const body = { act: "add", dev: dev };
  if (t.cfg) body.config = t.cfg;
  // „Tylko kontroler" ROBI NAKŁADKĘ KONTROLERA (2026-09-11), a nie okno z połową pada. Ten szablon
  // zawsze opisywał jedną rzecz — „sam rysunek pada" — i dopiero teraz może jej dotrzymać, bo
  // rysunek umie pokazać cały kontroler. Identyfikator pada bierze się z kapsla, na którym
  // kliknięto ＋; kapsel wpięty w nic nie ma czego opisać, więc zostaje stary, gołe okno z padem.
  if (tplKey === "pad") {
    const pid = (typeof gpvPadId === "function") ? gpvPadId(dev) : "";
    if (pid && typeof padById === "function" && padById(pid)) body.config = _ovgCtlCfg(pid);
  }
  return ovlPost(body).then(x => {
    if (btn) btn.disabled = false;
    if (x && x.error && typeof rfToast === "function") rfToast(x.error, { tone: "danger", ms: 5000 });
    // Świeże okno od razu staje się tym ustawianym — po to się je robi. `ovmSelect` sam wywoła
    // sync, ale stan okien przychodzi w tej samej odpowiedzi, więc najpierw karmimy nim panel.
    if (typeof ovlPanelSync === "function") try { ovlPanelSync(x); } catch (e) { }
    if (x && x.win && typeof ovmSelect === "function") ovmSelect(x.win);
    return x;
  });
}

// NAKŁADKA KONTROLERA (2026-09-11) — jedno kliknięcie, bez pytań.
//
// Okno powstaje jak każde inne, czyli NA KAPSLU: to on ma slot, katalog profilu i miejsce na
// ekranie. Nowe jest tylko `pad` — etykieta mówiąca „zrobiono je dla Kontrolera N", z której
// biorą się tytuł okna i rząd w galerii. Właścicielem zostaje pierwszy kapsel wpięty w ten
// kontroler; to bez znaczenia dla treści, bo rysunek i tak scala wszystkie (`ovlPadBox` w rf-41).
//
// Zawartość: sam pad i wiersz „kto na nim gra". Żadnego nagłówka — nazwa kapsla nad rysunkiem,
// na którym świecą przyciski KILKU kapsli, byłaby podpisem pod cudzym zdjęciem; od nazwania okna
// jest jego własny pasek, który mówi „Kontroler N".
function _ovgCtlCfg(padId) {
  return { pad: padId, padScope: "all", label: "",
           show: _ovgShow(["pad", "pad.who"]) };
}
function _ovgAddCtl(dev, padId, btn) {
  if (!dev || !padId) return Promise.resolve(null);
  if (btn) btn.disabled = true;
  return ovlPost({ act: "add", dev: dev, config: _ovgCtlCfg(padId) }).then(x => {
    if (btn) btn.disabled = false;
    if (x && x.error && typeof rfToast === "function") rfToast(x.error, { tone: "danger", ms: 5000 });
    if (typeof ovlPanelSync === "function") try { ovlPanelSync(x); } catch (e) { }
    if (x && x.win && typeof ovmSelect === "function") ovmSelect(x.win);
    return x;
  });
}

// ------------------------------------------------------------------------------------------
//  PODPIĘCIE I SYNC
// ------------------------------------------------------------------------------------------
// Nasłuchy na DOKUMENCIE, filtrowane po `.ovg-prev` / `.ovg-pick`: od 2026-09-01 te dwa bloki
// stoją w RÓŻNYCH kolumnach ekranu (i w różnych kartach), a nasłuch przypięty do jednej z nich
// nie widziałby drugiej.
function ovgWire() {
  document.addEventListener("click", e => {
    if (!e.target.closest || !e.target.closest(".ovg-prev,.ovg-pick,.ovg-menu")) return;
    const bg = e.target.closest(".ovg-bg");
    if (bg) { ovgBackdrop(bg.dataset.bg); return; }
    if (e.target.closest(".ovg-live-sw")) return;   // dźwignię obsługuje `change` niżej
    const it = e.target.closest(".ovg-menu-it");
    if (it) { const dev = _ovgMenu && _ovgMenu.dev, b = _ovgMenu && _ovgMenu.btn;
      _ovgCloseMenu(); if (dev) _ovgAdd(dev, it.dataset.tpl, b); return; }
    const nw = e.target.closest(".ovg-new");
    if (nw) {
      if (nw.dataset.pad) { _ovgCloseMenu(); _ovgAddCtl(nw.dataset.dev, nw.dataset.pad, nw); return; }
      _ovgOpenMenu(nw); return;
    }
    const t = e.target.closest(".ovg-tile");
    if (t && typeof ovmSelect === "function") { _ovgCloseMenu(); ovmSelect(t.dataset.win); }
  });
  // Menu zamyka się jak każde inne okienko aplikacji: kliknięciem obok i Esc.
  document.addEventListener("click", e => {
    if (!_ovgMenu) return;
    if (e.target.closest(".ovg-menu") || e.target.closest(".ovg-new")) return;
    _ovgCloseMenu();
  }, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && _ovgMenu) _ovgCloseMenu(); });
  document.addEventListener("change", e => { if (e.target && e.target.id === "ovgLive") ovgLiveToggle(!!e.target.checked); });
  // Pudełko podglądu zmienia rozmiar razem z oknem panelu i z chowaniem paneli bocznych, a od
  // jego rozmiaru zależy pomniejszenie ramki. ResizeObserver zamiast nasłuchu `resize`, bo panele
  // boczne zwijają się bez zmiany rozmiaru okna.
  const stage = document.getElementById("ovgStage");
  if (stage && typeof ResizeObserver === "function") {
    new ResizeObserver(() => {
      try { _ovgFit(typeof ovmWindowOf === "function" ? ovmWindowOf(_ovgIfWid) : null); } catch (e) { }
    }).observe(stage);
  }
}

// Jedyne wejście stanu — woła to `ovmSync` (rf-41b) po każdej odpowiedzi serwera o nakładkach.
function ovgSync(wins, sel) {
  if (!document.getElementById("ovgGroups")) return;
  _ovgTiles(wins, sel);
  const w = wins.find(x => x.wid === sel) || null;
  _ovgDropStale(wins);
  _ovgFrame(w);
  _ovgLiveApply(w);
  {const b = document.getElementById("ovgLive");
   if (b && b.checked !== _ovgLive) b.checked = _ovgLive;}
  const nm = document.getElementById("ovgMetaNm");
  if (nm) nm.textContent = w ? w.title : "—";
  const dim = document.getElementById("ovgMetaDim");
  if (dim) {
    const c = (w && w.cfg) || null;
    const th = (typeof OVL_THEMES !== "undefined" ? OVL_THEMES : []).find(t => t.k === ((c && c.theme) || "bare"));
    const dpr1 = window.devicePixelRatio || 1;
    dim.textContent = c
      ? [(c.w && c.h) ? (Math.round(c.w / dpr1) + "×" + Math.round(c.h / dpr1) + " px") : "",
         (c.w && c.h && typeof ovlRatioOf === "function") ? ovlRatioOf(c.w, c.h) : "",
         th ? _cvT(th.label) : ""].filter(Boolean).join(" · ")
      : "";
  }
  // ZDANIE POD PODGLĄDEM mówi to, co w tej chwili najbardziej może zaskoczyć — po jednej rzeczy
  // naraz, od najważniejszej. Otwarte okno jest ważniejsze niż wszystko inne, bo to ono, a nie
  // miniatura, pokazuje prawdziwą przezroczystość.
  const hint = document.getElementById("ovgHint");
  if (hint) {
    hint.textContent = !w
      ? _cvT("Wybierz okno obok, żeby zobaczyć jego podgląd.")
      : (w.running && !w.wheel && w.wid === _ovgOpened)
        ? _cvT("To okno jest otwarte tylko na czas ustawiania. Kliknij „Zostaw nad grą”, żeby zostało.")
      : (w.running && !w.wheel)
        ? _cvT("Okno stoi otwarte na ekranie, więc przezroczystość robi Windows i widać ją naprawdę. Miniatura obok tylko ją udaje.")
        : (w.wheel || (w.cfg && w.cfg.show && w.cfg.show.wheel))
          ? _cvT("Koło wyboru stoi w podglądzie na stałe; nad grą pojawia się na czas wybierania.")
          : _cvT("Miniatura udaje przezroczystość: prawdziwą robi Windows, więc widać ją dopiero w otwartym oknie.");
  }
  const none = document.getElementById("ovgNone");
  if (none && !w) none.textContent = _cvT("Wybierz okno obok, żeby zobaczyć jego podgląd.");
}

// Zmiana języka — kafelki i zdania składane są `_cvT`/`_gl` przy rysowaniu (patrz `ovmRelang`).
function ovgRelang() {
  const host = document.getElementById("ovgGroups");
  if (host) host._sig = "";
}
