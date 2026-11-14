"use strict";
// ===================== KOŁO WYBORU — RYSUNEK (SVG) =====================
// Przytrzymaj przycisk kapsla, pochyl kapsel w stronę wycinka, puść. To, co było pod spodem,
// zostaje wysłane. Jak koło broni w grach.
//
// PO CO TO JEST: jeden przycisk ma tyle znaczeń, ile wycinków ustawisz. Kapsel ma dokładnie jeden
// przycisk, więc bez koła każda nowa akcja wymaga nowego gestu do wymyślenia i zapamiętania.
// Z kołem wybór jest widoczny na ekranie w chwili, w której się go dokonuje.
//
// WYCINEK MOŻE OTWIERAĆ PODMENU. Wtedy nie wysyła nic, tylko pokazuje swoje dzieci — na tym samym
// pierścieniu („Zastąp koło"), łukiem tuż nad sobą („Łuk nad wycinkiem") albo pełną obręczą dookoła
// („Pełna obręcz"). Głębiej niż trzy poziomy koło nie schodzi.
//
// WYCINEK MOŻE TEŻ BYĆ PUSTY — bez akcji, bez makra i bez dzieci. Wybranie go nic nie wysyła:
// koło po prostu się zamyka, dokładnie tak, jak przy anulowaniu. To bezpieczne miejsce na
// puszczenie przycisku dla ręki, która nie utrzyma kierunku, więc rysuje się spokojniej niż
// reszta (bez ikony, bez krążka, neutralne podświetlenie), a środek koła mówi nad nim wprost
// „nic nie wysyła".
//
// GDZIE MIESZKA LOGIKA: w silniku (RadialMenu w ribbitflip_monitor.py). Przeglądarka niczego nie
// odlicza i o niczym nie decyduje — rysuje to, co przychodzi w pakiecie „wheel", a akcja i tak
// musi przejść przez bramkę „Uzbrojone" po stronie serwera.
//
// ⚙️ WEKTOR, NIE PŁÓTNO (2026-08-26). Do tej pory koło rysował canvas i każdy
// jego ruch — wskazanie, rozkwit, wysunięcie wycinka — trzeba było liczyć ręcznie, klatka po
// klatce, przy dwóch kapslach naraz. Teraz każdy wycinek jest osobnym elementem SVG: pakiet
// z serwera zmienia KLASY I ATRYBUTY istniejących węzłów, a płynność robi CSS na GPU. Przebudowa
// drzewa zdarza się wyłącznie wtedy, gdy zmienia się LICZBA wycinków albo pasm — nie 25 razy na
// sekundę. Wzorzec przeniesiony z prototypu koła (poza repozytorium).
//
// TEN PLIK TO RYSUNEK i nic więcej: jedna funkcja używana przez ściągę w panelu, nakładkę nad grą,
// okienko przy kursorze i scenę w karcie. Karta ustawień siedzi w rf-46b — nakładka ładuje TEN
// plik i nie potrzebuje tamtego.

// Geometria — LUSTRO stałych z RadialMenu (SCALE_DEG/DEAD/REL po stronie serwera). Rysunek musi
// pokazywać tę samą martwą strefę, w której silnik naprawdę nic nie wybiera, inaczej człowiek
// puszczałby przycisk „na wycinku", którego serwer nie widzi.
const WHEEL_DEAD_DEF = 0.34;
const WHEEL_DEAD_MIN = 0.10;
const WHEEL_DEAD_MAX = 0.70;
const WHEEL_MAX_SLICES = 16;   // lustro RadialMenu.MAX_SLICES
const WHEEL_MIN_SLICES = 2;
const WHEEL_MAX_DEPTH = 3;     // lustro RadialMenu.MAX_DEPTH — korzeń, podmenu, pod-podmenu
const WHEEL_ICON_MAX = 4;      // lustro RadialMenu.ICON_MAX
const WHEEL_REP_MAX = 20;      // lustro RadialMenu.REP_MAX — ile razy wycinek może nacisnąć akcję

// GEOMETRIA PASM — lustro RadialMenu.BAND_GAP / BAND_MIN. Rysunek normalnie NICZEGO tu nie liczy:
// granice pasm przychodzą gotowe w pakiecie („geom"), bo to silnik decyduje, które pochylenie trafia
// w którą obręcz. Ta funkcja istnieje wyłącznie dla sceny w karcie, która musi zbudować pakiet,
// zanim serwer cokolwiek przyśle — i dlatego liczy DOKŁADNIE to samo, co band_geom w silniku.
const WHEEL_BAND_GAP = 0.06;
const WHEEL_BAND_MIN = 0.30;
const WHEEL_MAX_BANDS = 3;     // lustro RadialMenu.MAX_BANDS
const WHEEL_ARC_PER = 30;      // lustro RadialMenu.ARC_PER_DEG
const WHEEL_ARC_MAX = 300;     // lustro RadialMenu.ARC_MAX_DEG
function wheelBandGeom(dz, nb) {
  nb = Math.max(1, nb | 0);
  dz = Math.max(WHEEL_DEAD_MIN, Math.min(WHEEL_DEAD_MAX, +dz || WHEEL_DEAD_DEF));
  const t = Math.max(WHEEL_BAND_MIN, 1 - dz);
  const outer = dz + nb * t + (nb - 1) * WHEEL_BAND_GAP;
  const k = outer > 0 ? 1 / outer : 1;
  const r0 = dz * k, tk = t * k, gp = WHEEL_BAND_GAP * k;
  const out = [];
  for (let i = 0; i < nb; i++) { const a = r0 + i * (tk + gp); out.push([a, a + tk]); }
  return out;
}

// Konfiguracja AKTYWNEGO kapsla — jeden obiekt, tak jak state.mouse i state.midi. Wartości tylko
// na czas, zanim przyjdzie odpowiedź serwera (wheelFetchState): to on jest źródłem prawdy.
state.wheel = state.wheel || { enabled: false, holdMs: 300, confirm: "release", confirmMs: 600, showWhere: "overlay", submenuMode: "replace", subOpenMs: 300, iconChips: false, look: wheelLook(null), slices: [] };
state.wheelDev = null;          // czyja konfiguracja siedzi w state.wheel (patrz wheelFetchState)
state.wheelFocus = -1;          // który wiersz edytujesz — scena podświetla właśnie ten
state.wheelPath = [];           // który POZIOM drzewa edytujesz (indeksy rodziców, od korzenia)
// …i który wiersz ma otwarty edytor makra. JEDEN na całą listę, bo rejestrator klawiszy (rf-32)
// pracuje na jednym celu naraz — szesnaście równoległych pól byłoby pytaniem „do którego z nich
// właśnie nagrywam", na które nie ma dobrej odpowiedzi.
state.wheelSeqRow = -1;

// PIĘĆ SPOSOBÓW STEROWANIA KOŁEM. Kolejność jak w silniku (RadialMenu.CONFIRM_MODES), a opisy są
// pisane od strony ręki, nie od strony kodu. „release" stoi pierwszy i jest domyślny.
const WHEEL_MODES = [
  ["release", "Trzymaj przycisk i puść", "Hold the button and let go"],
  ["tilt-hold", "Pochyl i przytrzymaj", "Lean and hold it there"],
  ["tilt-click", "Pochyl i kliknij", "Lean, then click"],
  ["click", "Kliknij, pochyl, kliknij", "Click, lean, click"],
  ["cycle", "Przełączaj kliknięciami", "Step through it with clicks"],
];
// Tryby, w których koło otwiera się SAMYM pochyleniem.
// ⚠️ „cycle" WYPADŁ STĄD 2026-09-06 (lustro gałęzi `_try_open` w silniku): koło klikane włącza
// KLIKNIĘCIE, nie przechył w dół. Tryb dla rąk, które nie potrafią celować pochyleniem, zaczynał
// się do tej pory od pochylenia.
const WHEEL_MODES_LEAN = ["tilt-hold", "tilt-click"];
// …a tu został: czekanie dalej jest jedynym sposobem, w jaki tryb klikany cokolwiek zatwierdza.
const WHEEL_MODES_WAIT = ["tilt-hold", "cycle"];
// PRÓG OTWARCIA BEZ PRZYCISKU — lustro RadialMenu.OPEN_MAG / OPEN_GAP / OPEN_CAP i jego _open_bar.
// Rysunek sam z niego nie korzysta; potrzebuje go SCENA w karcie, bo to ona musi otworzyć koło
// myszą dokładnie tam, gdzie otworzyłoby je pochylenie ręki. Gdyby liczyła własny próg, „Pochyl
// i przytrzymaj" na podglądzie zachowywałoby się inaczej niż w grze — a podgląd jest po to, żeby
// się nie zachowywało.
const WHEEL_OPEN_MAG = 0.8;
const WHEEL_OPEN_GAP = 0.15;
const WHEEL_OPEN_CAP = 0.95;
function wheelOpenBar(dz) {
  const d = Math.max(WHEEL_DEAD_MIN, Math.min(WHEEL_DEAD_MAX, +dz || WHEEL_DEAD_DEF));
  return Math.min(WHEEL_OPEN_CAP, Math.max(WHEEL_OPEN_MAG, d + WHEEL_OPEN_GAP));
}
// PO ILU KOŁO SIĘ PODDAJE — lustro RadialMenu.OPEN_TIMEOUT, w milisekundach (silnik liczy
// w sekundach, przeglądarka w ms i zamiana w jedną stronę jest tu tańsza niż dwa zapisy tej samej
// liczby). Potrzebuje go scena w karcie: w trybie klikanym koło obudzone i zostawione samo sobie
// zasypia po tym czasie, i podgląd musi to pokazać, bo to jest cała cena pomyłkowego kliknięcia.
const WHEEL_OPEN_TIMEOUT_MS = 8000;

// TRZY SPOSOBY POKAZYWANIA PODMENU. Lustro RadialMenu.SUBMENU_MODES.
const WHEEL_SUB = [
  ["replace", "Zastąp koło", "Replace the wheel",
    "Dzieci wchodzą w miejsce rodzica, na tym samym pierścieniu. Zawsze się mieści, bo koło nie rośnie."],
  ["arc", "Łuk nad wycinkiem", "An arc above the slice",
    "Dzieci wychodzą krótkim łukiem tuż nad rodzicem. Widać całą drogę naraz, więc łatwiej wrócić."],
  ["ring", "Pełna obręcz", "A whole second ring",
    "Dzieci obejmują całe koło drugą obręczą. Duże cele — dla rąk, którym trudno trafić w wąski łuk."],
];

// O ILE wysuwa się wskazany wycinek wzdłuż dwusiecznej, w pikselach koła o średnicy 420 px.
// Wysunięcie jest jedyną rzeczą, którą widać KĄTEM OKA — kolor trzeba porównać, ruch nie.
const WHEEL_PUSH = 6;
const WHEEL_STITCH_IN = 4.5;   // wcięcie ściegu w głąb wycinka, w tych samych pikselach
const WHEEL_STAGGER_MS = 22;   // opóźnienie kolejnego wycinka przy rozkwicie
// CZAS ROZKWITU — lustro `--w-anim` z 17-wheel.css. JS potrzebuje tej liczby wyłącznie po to, żeby
// wiedzieć, KIEDY sprzątnąć rysunek po zwinięciu; sam ruch robi CSS.
const WHEEL_ANIM_MS = 280;
// Zwinięcie jest krótsze od rozkwitu (0,55) — dokładnie jak w prototypie. Zapas 40 ms to margines
// na klatkę, w której przeglądarka dopiero startuje animację: sprzątnięcie rysunku co do
// milisekundy ucinałoby jej ostatni ułamek i zniknięcie znów byłoby skokiem.
const WHEEL_CLOSE_MS = Math.round(WHEEL_ANIM_MS * 0.55) + 40;

// Prośba systemowa „mniej ruchu". Pytana przy każdym zamknięciu, a nie zapamiętana raz: człowiek
// przestawia ją w trakcie pracy aplikacji i nie ma powodu, żeby to wymagało restartu.
function whLessMotion() {
  try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  catch (e) { return false; }
}

// ------------------------------------------------------------------------------------------
//  RYSUNEK — jeden dla wszystkich powierzchni
// ------------------------------------------------------------------------------------------
// (host, st, labels, opts) — `host` to zwykły <div>, `st` to DOKŁADNIE to, co przychodzi w pakiecie
// „wheel": open/idx/n/mag/ang/dz/confirm/cyc/cd/labels/where/mode/crumbs/bands/sel/geom/chips/clk/look.
//
// RYSUNEK NIE LICZY GEOMETRII PASM. Granice („geom") i zawartość każdego z nich („bands") liczy
// SILNIK i przysyła gotowe, bo to on decyduje, w co trafia pochylenie. Gdyby przeglądarka liczyła
// to sama, wystarczyłaby jedna poprawka po jednej stronie, żeby człowiek celował w obręcz, której
// serwer w tym miejscu nie widzi.
//
// DWA KROKI, I TO JEST CAŁA WYDAJNOŚĆ TEGO PLIKU: _whBuild przebudowuje drzewo (rzadko — tylko gdy
// zmienia się liczba wycinków, pasm albo geometria), _whPaint przestawia klasy i teksty (często).
// Pakiet leci 25 razy na sekundę przy dwóch kapslach naraz; przebudowa DOM-u w tym tempie to
// dokładnie to, czego trzeba tu unikać.
function wheelSvgInto(host, st, labels, opts) {
  opts = opts || {};
  // POJEMNIK BEZ WYMIARU TO NIE JEST MAŁY POJEMNIK. Zwinięty do zera (układ właśnie się przestawia,
  // pudło ma jeszcze wysokość 0) dawał przez `Math.max(60, …)` sześćdziesięciopikselową kropkę
  // wrysowaną w pasek o wysokości jednego piksela — rysunek, w który nie da się celować, bo jego
  // środek leży na krawędzi. Tak właśnie wyglądało „Powiększ nie działa": scena rozkładała się na
  // całą kartę, ale jej wysokość zostawała zerowa, a koło robiło się kropką. Czekamy więc na
  // pierwszy realny wymiar — obserwator pojemnika (whWatchBox) i tak zawoła nas ponownie.
  const cw = host.clientWidth || 0, ch = host.clientHeight || 0;
  if (cw < 2 || ch < 2) return;
  const box = Math.max(60, Math.min(cw, ch));
  const look = wheelLook(st.look);
  // ŻĄDANA ŚREDNICA to normalnie `look.size` — tyle koło ma mieć NA EKRANIE W GRZE. Powierzchnia,
  // która świadomie rysuje w innej skali, podaje swoją przez `opts.size`: scena podglądu wypełnia
  // nią swoje pudło, bo tam chodzi o kształt i o celowanie, a nie o wierność co do piksela
  // (rzeczywistą wielkość mówi wtedy podpis pod sceną — patrz whStageNote w rf-46d).
  const want = (+opts.size > 0) ? +opts.size : look.size;
  // PROMIEŃ = pół boku bez marginesu (patrz WHEEL_PAD w rf-46a), nigdy więcej niż połowa zamówionej
  // średnicy. Margines jest STAŁY, tak jak w prototypie — margines liczony procentem sprawiał, że
  // im większa scena, tym więcej pustego wokół koła, i to jest jeden z powodów, dla których duże
  // koło w aplikacji wyglądało na mniejsze niż w makiecie.
  const R = Math.min(box / 2 - _whPad(box), want / 2);
  const dzf = Math.max(WHEEL_DEAD_MIN, Math.min(WHEEL_DEAD_MAX, +st.dz || WHEEL_DEAD_DEF));
  const geom = (Array.isArray(st.geom) && st.geom.length) ? st.geom : [[dzf, 1]];
  let bands = (Array.isArray(st.bands) && st.bands.length) ? st.bands : null;
  if (!bands) {
    // Pakiet sprzed podmenu (bez „bands") rysuje się dokładnie jak dawniej: jedno pasmo złożone
    // z „labels" i „n".
    const cnt = Math.max(1, st.n | 0), it = [];
    for (let i = 0; i < cnt; i++)
      it.push({ label: (labels && labels[i]) || "", icon: "", color: "", sub: false });
    bands = [{ items: it, openIdx: null, full: true, a0: 0, a1: 360 }];
  }
  const nb = Math.min(geom.length, bands.length);
  const key = _whKey(box, R, look, geom, bands, nb, !!st.chips);
  let S = host._wh;
  if (!S || S.key !== key) S = _whBuild(host, box, R, look, geom, bands, nb, !!st.chips, key);
  // WYGLĄD POWIERZCHNI podmienia same tokeny --w-* (patrz 17-wheel.css), więc rysunek nie zna
  // kolorów i nie musi ich znać. Scena w karcie mówi wprost, który wygląd pokazuje; nakładka
  // czyta swój własny motyw; ściąga w panelu ma zawsze kremową kartę.
  const surf = opts.look || _whSurfaceLook();
  if (S.root.dataset.look !== surf) S.root.dataset.look = surf;
  _whPaint(host, S, st, geom, bands, nb, R, box, opts);
}

// ------------------------------------------------------------------------------------------
//  ZMIANA ROZMIARU POJEMNIKA
// ------------------------------------------------------------------------------------------
// Koło ma rosnąć i maleć razem z tym, w czym siedzi — a siedzi w czterech różnych rzeczach:
// w kolumnie ściągi (szerokość zmienia się przy przeciąganiu panelu), w oknie nakładki (zmienia
// się myszą), w scenie karty (trzy układy: pół karty, cała karta, zwinięta) i w okienku przy
// kursorze. GEOMETRIA JEST PRZELICZANA, a nie skalowana przekształceniem: przy skalowaniu razem
// z kołem rosłyby kreski i litery, a w prototypie koło o średnicy 320 i 680 px ma dokładnie te
// same 1,6 px obrysu.
//
// Pętla klatek i tak przelicza pojemnik przy każdym pakiecie, więc obserwator NIE jest tu jedyną
// drogą — jest drogą SZYBKĄ I PEWNĄ: przerysowuje w tej samej klatce, w której zmienił się układ
// (bez mrugnięcia rozciągniętym rysunkiem), i działa też wtedy, gdy pakietów akurat nie ma —
// bo koło stoi otwarte, a ręka niczym nie rusza.
function whWatchBox(el, fn) {
  if (!el || el._whRO || typeof ResizeObserver !== "function") return;
  el._whRO = new ResizeObserver(() => { try { fn(); } catch (e) { /* pojemnik zniknął */ } });
  el._whRO.observe(el);
}

// Który z trzech wyglądów ma TA powierzchnia. Panel ma jeden i tylko jeden (kremowa karta);
// nakładka trzyma swój na <html data-theme>, bo tam jest jedna nakładka na okno.
function _whSurfaceLook() {
  try {
    if (typeof RF_OVL !== "undefined" && RF_OVL)
      return document.documentElement.getAttribute("data-theme") || "felt";
  } catch (e) { /* brak dostępu do dokumentu — zostaje wartość domyślna */ }
  return "felt";
}

// SYGNATURA STRUKTURY: co musi się zmienić, żeby drzewo trzeba było zbudować od nowa. Wskazanie,
// odliczanie i okruszki JEJ NIE ZMIENIAJĄ — i o to chodzi.
function _whKey(box, R, look, geom, bands, nb, chips) {
  // `fontScale` JEST W SYGNATURZE, mimo że nie zmienia liczby wycinków: rozmiar pisma wpisuje się
  // w atrybut `font-size` przy BUDOWIE drzewa, więc bez tego suwak nie ruszyłby niczym, dopóki
  // ktoś nie dodałby wycinka. Zaokrąglenie do setnych, bo suwak chodzi co 5%.
  const p = [Math.round(box), Math.round(R * 10), look.gapDeg, look.corner,
             Math.round((look.fontScale || 1) * 100), chips ? 1 : 0];
  for (let b = 0; b < nb; b++) {
    const bd = bands[b] || {}, it = bd.items || [];
    p.push(it.length, bd.full === false ? 0 : 1, Math.round((+bd.a0 || 0) * 10),
      Math.round((bd.a1 == null ? 360 : +bd.a1) * 10),
      Math.round(geom[b][0] * 1000), Math.round(geom[b][1] * 1000));
    // Ikona i kolor zmieniają KSZTAŁT węzła (chip pod ikoną, druga linia napisu), więc należą tutaj;
    // sama NAZWA nie — ta podmienia się w _whPaint, bez ruszania drzewa. „empty" też: puste pole
    // rysuje się BEZ ikony i bez krążka, więc jego węzeł ma inną budowę niż zwykłego wycinka.
    for (const s of it) p.push((s.icon ? 1 : 0) + (s.color ? 2 : 0) + (s.sub ? 4 : 0) + (s.back ? 8 : 0)
      + (s.empty ? 16 : 0));
  }
  return p.join(",");
}

// ------------------------------------------------------------------------------------------
//  BUDOWA DRZEWA
// ------------------------------------------------------------------------------------------
function _whBuild(host, box, R, look, geom, bands, nb, chips, key) {
  const cx = box / 2, cy = box / 2;
  // OZDOBNIKI SĄ W PIKSELACH, NIE W PROCENTACH PROMIENIA — i to jest port z prototypu, nie drobiazg.
  // Zaokrąglenie narożnika, wysunięcie wskazanego wycinka, wcięcie ściegu i kropki podmenu mają tam
  // te same wartości przy kole o średnicy 320 i 680 px; suwak „Zaokrąglenie" ustawia PIKSELE, więc
  // musi znaczyć to samo niezależnie od tego, jak duże jest koło. Skalowanie ich w górę razem
  // z promieniem robiło z dużego koła jego własną, grubszą karykaturę — i to jest jeden z powodów,
  // dla których duże koło w karcie nie wyglądało jak w makiecie.
  //
  // W DÓŁ skalujemy nadal: na kaflu ściągi o boku 90 px zaokrąglenie 10 px zjadłoby cały wycinek.
  const k = Math.min(1, R / WHEEL_LOOK_REF_R);    // skala ozdobników — tylko w dół (patrz rf-46a)
  const corner = look.corner * k;
  const stitchIn = Math.max(2, WHEEL_STITCH_IN * k);
  const push = Math.max(2, WHEEL_PUSH * k);
  const small = (R * 2) < WHEEL_SMALL_PX;
  const e = (typeof esc === "function") ? esc : (s => String(s));
  let sl = "";
  const nodes = [];
  for (let b = 0; b < nb; b++) {
    const bd = bands[b] || {}, items = bd.items || [];
    const n = Math.max(1, items.length);
    const r0 = geom[b][0] * R, r1 = geom[b][1] * R, ring = Math.max(1, r1 - r0);
    const segs = _whSegs(bd, n);
    // IKONY I ETYKIETY. Do ośmiu wycinków napisy leżą poziomo, tak jak leżały zawsze. Od dziewięciu
    // w górę łuk wycinka robi się węższy niż jedno słowo, więc napisy obracają się WZDŁUŻ PROMIENIA:
    // mierzy je wtedy GRUBOŚĆ pasma, która z liczbą wycinków w ogóle się nie zmienia. Na lewej
    // połowie tekst dostaje dodatkowe 180°, inaczej połowa nazw stałaby do góry nogami.
    const radial = n >= 9;
    // ROZMIAR PISMA rośnie z GRUBOŚCIĄ pasma, ale ma SUFIT. Skalowanie wprost z promieniem koła
    // (tak liczył canvas) dawało przy dużym kole napisy wielkości nagłówka, które nie mieściły się
    // w wycinku i kończyły wielokropkiem po trzech literach. Sufit 15 px na nazwę i 30 px na ikonę
    // to wartości z prototypu — tam, gdzie powstał docelowy wygląd.
    // …a na samym końcu przechodzi przez suwak „Wielkość pisma" (look.fontScale). Sufit liczony
    // z grubości pasma pilnuje, żeby przy 1,6 napis nie wyszedł poza swój wycinek — patrz _whFs
    // w rf-46a. Przy 1,0 obie liczby są co do piksela takie, jak były.
    const fsL = _whFs(_whClamp(ring * 0.2, 9.5, 15), look.fontScale, ring * 0.46);
    const fsI = _whFs(_whClamp(ring * 0.32, 13, 30), look.fontScale, ring * 0.62);
    for (let i = 0; i < n; i++) {
      const it = items[i] || {};
      const g = _whGapA(segs[i], look.gapDeg);
      const d = whSectorPath(cx, cy, r0, r1, g.a0, g.a1, corner);
      const ds = whStitchPath(cx, cy, r0, r1, g.a0, g.a1, corner, stitchIn);
      const off = _whPt(0, 0, push, segs[i].c);
      // PUSTE POLE — wycinek bez akcji, bez makra i bez dzieci. Rysuje się SPOKOJNIEJ od reszty
      // i to nie jest ozdoba: ono ma wyglądać na miejsce, w którym nic się nie stanie, żeby oko
      // znalazło je wtedy, gdy ręka zjeżdża w bok i trzeba gdzieś wylądować. Stąd brak ikony
      // (nawet przy włączonych krążkach — ikona obiecuje działanie) i brak własnego koloru:
      // podświetlenie ma być neutralne, a nie w barwie akcentu, którą reszta koła mówi
      // „to zaraz pójdzie". Sam kolor zostaje w konfiguracji nietknięty; nie jest rysowany.
      const mt = !!it.empty;
      const col = mt ? "" : _whCol(it.color);
      const ico = mt ? "" : String(it.icon || "");
      const hasIco = !!ico;
      // Tusz na krążku pod ikoną — liczony z JEGO koloru, nie z motywu (patrz _whInk).
      const inkA = chips ? (' fill="' + _whInk(col) + '"') : "";
      let inner = '<path class="wh-fill" d="' + d + '"/>';
      if (ds) inner += '<path class="wh-stitch" d="' + ds + '"/>';
      inner += '<path class="wh-tint" d="' + d + '"/>';
      const P = (r, a) => _whPt(cx, cy, r, a);
      if (radial) {
        if (hasIco) {
          const p = P(r0 + ring * 0.26, segs[i].c);
          if (chips) inner += '<circle class="wh-chip" cx="' + _whF2(p[0]) + '" cy="' + _whF2(p[1])
            + '" r="' + _whF2(fsI * 0.72) + '"/>';
          inner += '<text class="wh-ico" x="' + _whF2(p[0]) + '" y="' + _whF2(p[1])
            + '" font-size="' + _whF2(fsI * 0.85) + '"' + inkA + '>' + e(ico) + '</text>';
        }
        const lr = r0 + ring * (hasIco ? 0.66 : 0.5);
        const q = P(lr, segs[i].c);
        const a = ((segs[i].c % 360) + 360) % 360;
        const rot = (a > 180) ? (a + 90) : (a - 90);
        inner += '<text class="wh-lab" x="' + _whF2(q[0]) + '" y="' + _whF2(q[1])
          + '" font-size="' + _whF2(fsL) + '" data-maxw="' + _whF2(ring * (hasIco ? 0.62 : 0.86))
          + '" transform="rotate(' + _whF2(rot) + ' ' + _whF2(q[0]) + ' ' + _whF2(q[1]) + ')"></text>';
      } else {
        const lr = (r0 + r1) / 2;
        const q = P(lr, segs[i].c);
        // Ile miejsca ma napis: cięciwa wycinka na jego wysokości, ale nigdy tyle, żeby wejść
        // w martwą strefę — środek koła ma własną treść i dwa napisy jeden na drugim to plama.
        const chord = 2 * lr * Math.sin(((g.a1 - g.a0) / 2) * Math.PI / 180);
        // Ile miejsca ma napis: cięciwa wycinka na jego wysokości, ograniczona grubością pasma
        // i tym, żeby nie wejść w martwą strefę — środek koła ma własną treść, a dwa napisy jeden
        // na drugim to plama, nie informacja.
        const maxw = Math.max(28, Math.min(chord * 0.9, ring * 1.7, 2 * (lr - r0) - 4));
        if (hasIco) {
          const py = q[1] - fsI * 0.55;
          if (chips) inner += '<circle class="wh-chip" cx="' + _whF2(q[0]) + '" cy="' + _whF2(py)
            + '" r="' + _whF2(fsI * 0.72) + '"/>';
          inner += '<text class="wh-ico" x="' + _whF2(q[0]) + '" y="' + _whF2(py)
            + '" font-size="' + _whF2(fsI) + '"' + inkA + '>' + e(ico) + '</text>';
          inner += '<text class="wh-lab" x="' + _whF2(q[0]) + '" y="' + _whF2(q[1] + fsL * 1.05)
            + '" font-size="' + _whF2(fsL) + '" data-maxw="' + _whF2(maxw) + '"></text>';
        } else {
          inner += '<text class="wh-lab" x="' + _whF2(q[0]) + '" y="' + _whF2(q[1])
            + '" font-size="' + _whF2(fsL) + '" data-maxw="' + _whF2(maxw) + '"></text>';
        }
      }
      // KROPKI-ZAPOWIEDŹ: wycinek, który otwiera podmenu, dostaje trzy kropki przy krawędzi
      // zewnętrznej. Wzięte z Neverwinter Nights i z tego samego powodu: mówią „tu jest coś dalej",
      // ZANIM się tam wejdzie. Bez nich jedynym sposobem sprawdzenia byłoby wejście.
      if (it.sub) {
        // Odsunięcie od krawędzi, promień kropki i rozstaw — wartości z prototypu (9 px, 2,2 px,
        // maks. 6°), przeskalowane razem z resztą ozdobników. ODDECH (kropki pulsują, gdy wycinek
        // jest wskazany) ma opóźnienie wpisane w każdą kropkę z osobna: w CSS trzeba by go było
        // wybrać przez `nth-of-type`, a to liczy WSZYSTKIE okręgi w wycinku — razem z krążkiem
        // pod ikoną, który wtedy przesuwa numerację.
        const dr = r1 - Math.max(3, 9 * k);
        const rd = Math.max(1, 2.2 * k);
        const sp = Math.min(6, (g.a1 - g.a0) * 0.22);
        for (let m = -1; m <= 1; m++) {
          const p = P(dr, segs[i].c + m * sp);
          inner += '<circle class="wh-dot" cx="' + _whF2(p[0]) + '" cy="' + _whF2(p[1])
            + '" r="' + _whF2(rd) + '" style="animation-delay:' + ((m + 1) * 120) + 'ms"/>';
        }
      }
      const org = (b === 0) ? (_whF2(cx) + "px " + _whF2(cy) + "px")
        : (() => { const pb = geom[b - 1]; const p = P((pb[0] + pb[1]) / 2 * R, segs[i].c);
                   return _whF2(p[0]) + "px " + _whF2(p[1]) + "px"; })();
      // KOLEJNOŚĆ ROZKWITU. Korzeń rozwija się PO KOLEI, od pierwszego wycinka — tak jak czyta się
      // listę. Obręcz dzieci rozkwita OD ŚRODKA na boki, bo tam stoi rodzic i stamtąd wzrok
      // zaczyna. Opóźnienie jest wpisane w węzeł raz, przy budowie: pasmo dzieci i tak powstaje
      // dopiero w chwili, w której ma rozkwitnąć, więc nie ma tu dwóch różnych przypadków.
      const del = (b === 0) ? (i * WHEEL_STAGGER_MS)
        : (Math.round(Math.abs(i - (n - 1) / 2)) * WHEEL_STAGGER_MS);
      sl += '<g class="wh-sl' + (mt ? " is-empty" : "") + '" data-b="' + b + '" data-i="' + i + '" role="menuitem"'
        + (col ? ' style="--sc:' + e(col) + '"' : "") + '>'
        + '<g class="wh-sl-anim" style="animation-delay:' + del + 'ms;transform-origin:' + org + '">'
        + '<g class="wh-sl-hover" style="--ox:' + _whF2(off[0]) + 'px;--oy:' + _whF2(off[1]) + 'px">'
        + inner + '</g></g></g>';
      nodes.push({ b: b, i: i });
    }
  }
  // ŚRODEK: obręcz martwej strefy, jej ścieg i łuk odliczania. Odliczanie biegnie WOKÓŁ ŚRODKA,
  // a nie po krawędzi wycinka: w chwili czekania patrzy się w środek koła, bo tam stoi nazwa tego,
  // co zaraz pójdzie.
  const rd0 = geom[0][0] * R;
  const hubR = Math.max(6, rd0 - 2);
  const core = '<g class="wh-hub-g" style="transform-origin:' + _whF2(cx) + 'px ' + _whF2(cy) + 'px">'
    + '<circle class="wh-hub-ring" cx="' + _whF2(cx) + '" cy="' + _whF2(cy) + '" r="' + _whF2(hubR) + '"/>'
    + '<circle class="wh-hub-stitch" cx="' + _whF2(cx) + '" cy="' + _whF2(cy) + '" r="' + _whF2(hubR - Math.max(2.5, 5 * k)) + '"/>'
    + '<circle class="wh-dwell" cx="' + _whF2(cx) + '" cy="' + _whF2(cy) + '" r="' + _whF2(hubR - Math.max(2, 4 * k))
    + '" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></g>';
  // WSKAZÓWKA — dokąd pochylony jest kapsel. Jedna kreska o STAŁEJ długości, skracana i obracana
  // przekształceniem: dzięki temu przejście między pakietami (25 Hz) wygładza CSS, zamiast skakać.
  const needle = '<g class="wh-needle" style="transform-origin:' + _whF2(cx) + 'px ' + _whF2(cy) + 'px">'
    + '<line class="wh-needle-l" x1="' + _whF2(cx) + '" y1="' + _whF2(cy) + '" x2="' + _whF2(cx)
    + '" y2="' + _whF2(cy - R) + '"/>'
    + '<circle class="wh-needle-d" cx="' + _whF2(cx) + '" cy="' + _whF2(cy - R) + '" r="' + _whF2(Math.max(1.6, 3 * k)) + '"/></g>';

  // `--wh-r` = promień koła w pikselach. Potrzebuje go CSS motywu „Szkło": rozmyta tarcza pod SVG
  // musi mieć dokładnie ten promień, którym narysowane są wycinki, a jest elementem HTML-owym,
  // więc sama go nie zna (patrz `.wh-svg::before` w 17-wheel.css).
  host.innerHTML = '<div class="wh-svg' + (small ? " is-small" : "") + '" style="width:' + box + 'px;height:' + box + 'px;--wh-r:' + _whF2(R) + 'px">'
    + '<svg viewBox="0 0 ' + box + ' ' + box + '" width="' + box + '" height="' + box + '" role="menu" aria-label="Koło wyboru">'
    // KOLEJNOŚĆ JEST TREŚCIĄ: wskazówka idzie PRZED środkiem, więc tarcza martwej strefy ją
    // przykrywa. Rysowana po nim przekreślałaby dokładnie tę nazwę, na którą człowiek w tej chwili
    // patrzy — a wewnątrz strefy i tak prześwituje, bo tarcza jest półprzezroczysta, i dalej
    // tłumaczy „pochylam, a nic się nie dzieje".
    + '<g class="wh-ring">' + sl + needle + core + '</g></svg>'
    // Bok i pismo środka — proporcje z prototypu (1,66 promienia; pismo 0,17 promienia, od 10,5
    // do 17 px). Reszta treści środka skaluje się z tym pismem, bo jest podana w „em" — więc
    // suwak wielkości pisma wystarczy przyłożyć TUTAJ, żeby ruszył okruszki, nazwę i podpowiedź
    // naraz. Sufitem jest średnica środka: treść ma zostać w tarczy martwej strefy, a nie wyjść
    // na wycinki.
    + '<div class="wh-hub" style="width:' + _whF2(hubR * 1.66) + 'px;height:' + _whF2(hubR * 1.66)
    + 'px;font-size:' + _whF2(_whFs(Math.max(10.5, Math.min(hubR * 0.17, 17)), look.fontScale, hubR * 0.34))
    + 'px"><div class="wh-hub-in"></div></div></div>';

  const root = host.firstElementChild;
  const S = {
    key: key, root: root, box: box, R: R, nb: nb, small: small,
    sl: Array.prototype.slice.call(root.querySelectorAll(".wh-sl")),
    hub: root.querySelector(".wh-hub-in"),
    dwell: root.querySelector(".wh-dwell"),
    needle: root.querySelector(".wh-needle"),
    hubBox: root.querySelector(".wh-hub"),
    txt: [], sel: null, open: false, nbSeen: 0, hubHtml: null, ox: 0, oy: 0,
  };
  S.labs = S.sl.map(g => g.querySelector(".wh-lab"));
  _whFitStitches(root);
  return (host._wh = S);
}

// ŚCIEG O RÓWNYCH KRESKACH. Sztywny wzór „5 4" nie domyka się na zamkniętej ścieżce: przy szwie
// zostaje kikut kreski, a krótki wycinek dostaje inną gęstość niż długi — obszycie wygląda wtedy
// na zrobione po łebkach, i to widać nawet wtedy, gdy nie wiadomo dlaczego. Mierzymy więc realny
// obwód i rozciągamy wzór tak, żeby zmieściła się w nim CAŁKOWITA liczba powtórzeń.
//
// Tutaj, a nie w CSS, bo długość gotowej ścieżki liczy przeglądarka. I tylko przy budowie drzewa:
// pakiet leci 25 razy na sekundę, a ta pętla mierzy każdy wycinek z osobna.
function _whFitStitches(root) {
  const els = root.querySelectorAll(".wh-stitch, .wh-hub-stitch");
  for (const el of els) {
    if (!el.getTotalLength) continue;
    let len = 0;
    try { len = el.getTotalLength(); } catch (e) { continue; }   // motywy bez ściegu też tu wchodzą
    if (!(len > 1)) continue;
    const per = 9;                                   // kreska 5 + przerwa 4
    const n = Math.max(4, Math.round(len / per));
    const s = len / (n * per);
    // Trzy miejsca po przecinku, nie dwa: przy zaokrągleniu do setnych wzór rozjeżdża się o ułamek
    // kreski na całym obwodzie i szew znów przestaje się domykać.
    el.style.strokeDasharray = (5 * s).toFixed(3) + " " + (4 * s).toFixed(3);
  }
}

// ------------------------------------------------------------------------------------------
//  MALOWANIE — klasy, teksty, przekształcenia
// ------------------------------------------------------------------------------------------
function _whPaint(host, S, st, geom, bands, nb, R, box, opts) {
  const cyc = !!st.cyc;
  const cd = Math.max(0, Math.min(1, +st.cd || 0));
  const mag = Math.max(0, Math.min(1, +st.mag || 0));
  const idx = (st.idx == null) ? -1 : (st.idx | 0);
  // Stary pakiet nie zna pasm, więc wskazanie odnosi się do najgłębszego z nich.
  const sel = st.sel || (idx >= 0 ? { band: nb - 1, idx: idx } : null);
  // ROZKWIT: koło pojawia się skokiem, a skok w polu widzenia czyta się jak błysk, nie jak „oto
  // koło". Klasa zdejmowana po animacji, żeby kolejny pakiet jej nie powtarzał — powtarzany przy
  // każdym ruchu ręki rozkwit byłby migotaniem, nie animacją.
  if (st.open && !S.open) _whBloom(S, "wh-open");
  else if (st.open && nb > S.nbSeen) _whBloom(S, "wh-grow");
  S.open = !!st.open;
  S.nbSeen = nb;
  // KOŁO UŚPIONE („Przełączaj kliknięciami"). Stoi na ekranie, ale nie słucha: dopiero kliknięcie
  // je budzi. Bez tej różnicy w WYGLĄDZIE rysunek wyglądałby dokładnie tak samo w stanie, w którym
  // klik wybiera, i w stanie, w którym klik tylko włącza — a to jest jedyna rzecz, którą w tym
  // trybie trzeba wiedzieć. Zdanie w środku mówi to samo słowami; przygaszenie mówi to z odległości,
  // z której napisu już nie widać (nakładka nad grą, telewizor).
  _whCls(S.root, "wh-sleep", cyc && !!st.open && !st.wake);

  for (let j = 0; j < S.sl.length; j++) {
    const g = S.sl[j];
    const b = +g.dataset.b, i = +g.dataset.i;
    const bd = bands[b] || {}, it = (bd.items || [])[i] || {};
    const openIdx = (bd.openIdx == null) ? -1 : (bd.openIdx | 0);
    const on = !!sel && sel.band === b && sel.idx === i;
    const isOpen = (i === openIdx);
    // PASMO RODZICÓW PRZYGASA, gdy nad nim stoi otwarte pasmo dzieci: patrzy się na to, co się
    // właśnie wybiera, a nie na drogę, którą się tu przyszło. Otwarty rodzic zostaje jasny, bo to
    // on jedyny tłumaczy, skąd wzięła się obręcz nad nim.
    const dim = (b < nb - 1) && !isOpen;
    _whCls(g, "on", on);
    _whCls(g, "openp", isOpen);
    _whCls(g, "dim", dim);
    const lab = S.labs[j];
    if (lab) {
      const want = String(it.label || (i + 1));
      if (lab._want !== want) { lab._want = want; lab.textContent = want; lab._fit = false; }
    }
    // Puste pole mówi to WPROST także czytnikowi ekranu: bez tego jego jedynym śladem byłby
    // spokojniejszy kolor, czyli dokładnie ta informacja, której czytnik nie przekaże.
    const aria = String(it.label || (i + 1)) + (it.sub ? ", podmenu" : "")
      + (it.empty ? ", " + _wheelT("puste pole, nic nie wysyła", "empty slice, sends nothing") : "")
      + (isOpen ? ", otwarty" : "");
    if (g._aria !== aria) { g._aria = aria; g.setAttribute("aria-label", aria); }
  }
  // Przycinanie napisów mierzy się PO wstawieniu do dokumentu — tylko wtedy znamy realną szerokość
  // glifów wybranego kroju. Szacowanie po liczbie znaków myli się o kilkanaście procent.
  _whFitLabels(S);

  // ODLICZANIE — łuk wokół środka, który wypełnia się w trybach zatwierdzających CZEKANIEM. Bez
  // niego czekanie jest nie do odróżnienia od zawieszenia, a to jedyna rzecz, jakiej człowiek
  // w tej chwili potrzebuje: ile jeszcze.
  if (S.dwell) {
    const off = Math.round(100 - cd * 100);
    if (S._cd !== off) {
      S._cd = off;
      S.dwell.setAttribute("stroke-dashoffset", String(off));
      _whCls(S.dwell, "run", cd > 0.01);
    }
  }
  // WSKAZÓWKA. W trybie „Przełączaj kliknięciami" jej NIE MA (serwer nie przysyła wychylenia):
  // pokazywałaby, gdzie stoi ręka, a wybór jest gdzie indziej — to jedyny sposób, żeby rysunek
  // skłamał o tym, co się zaraz stanie.
  if (S.needle) {
    const show = mag > 0.02 && !cyc;
    // KĄT PODAWANY DO OBROTU MUSI BYĆ CIĄGŁY, nigdy modulo 360 — inaczej przejście CSS animuje
    // różnicę 358° zamiast 2° i wskazówka jedzie naokoło (patrz whUnwrapDeg w rf-46a). Schowana
    // wskazówka zeruje akumulator: po ponownym pokazaniu ma stanąć tam, gdzie jest ręka, a nie
    // dojechać tam z miejsca sprzed przerwy.
    S._ang = show ? whUnwrapDeg(S._ang, st.ang) : null;
    const tr = show ? ("rotate(" + _whF2(S._ang) + "deg) scaleY(" + _whF2(Math.max(0.02, mag)) + ")") : "";
    if (S._ntr !== tr) {
      S._ntr = tr;
      S.needle.style.display = show ? "" : "none";
      if (show) S.needle.style.transform = tr;
    }
    _whCls(S.needle, "hot", !!sel);
  }
  // ŚRODEK — nie etykieta koła, tylko odpowiedź na jedno pytanie: „co się stanie, gdy teraz
  // puszczę / kliknę". HTML, a nie SVG, bo tylko tam zawijanie i wielokropek są za darmo.
  const html = _whHubHtml(st, sel, bands, nb, S.small);
  if (S.hub && S.hubHtml !== html) { S.hubHtml = html; S.hub.innerHTML = html; }
  // Przesunięcie całości (scena w karcie stawia koło pod kursorem przy trzymaniu).
  const ox = +opts.ox || 0, oy = +opts.oy || 0;
  if (S.ox !== ox || S.oy !== oy) {
    S.ox = ox; S.oy = oy;
    S.root.style.transform = (ox || oy) ? ("translate(" + _whF2(ox) + "px," + _whF2(oy) + "px)") : "";
  }
}

function _whCls(el, name, on) {
  if (el.classList.contains(name) !== !!on) el.classList.toggle(name, !!on);
}

// Rozkwit: klasa na czas animacji i ani chwili dłużej.
function _whBloom(S, cls) {
  // „wh-close" też schodzi: koło potrafi otworzyć się ZANIM dobiegnie zwijanie poprzedniego
  // (klik, rozmyśliłem się, klik). Zostawione, przykryłoby rozkwit własnym zanikaniem.
  S.root.classList.remove("wh-open", "wh-grow", "wh-close");
  // Wymuszenie przeliczenia — bez tego ponowne dodanie tej samej klasy nie zrestartuje animacji.
  void S.root.offsetWidth;
  S.root.classList.add(cls);
  clearTimeout(S._bloomT);
  S._bloomT = setTimeout(() => { if (S.root) S.root.classList.remove("wh-open", "wh-grow"); }, 520);
}

// ------------------------------------------------------------------------------------------
//  ZWINIĘCIE — jedno dla wszystkich powierzchni
// ------------------------------------------------------------------------------------------
// PO CO OSOBNA FUNKCJA: zamknięcie koła to jedyny moment, w którym rysunek musi jeszcze chwilę
// pożyć po tym, jak przestał być potrzebny. Każda powierzchnia (ściąga, nakładka, okienko przy
// kursorze, scena w karcie) czyści swój pojemnik SAMA i robiła to natychmiast — koło znikało
// skokiem, mimo że pojawiało się rozkwitem. Teraz mówi „zamknij", a sprzątanie dostaje w wywołaniu
// zwrotnym, po animacji.
//
// `host` to ten sam pojemnik, w który rysuje wheelSvgInto. Gdy nie ma czego zwijać (pusty pojemnik,
// prośba o mniej ruchu), sprzątanie idzie od razu — obietnica jest taka, że `done` zawsze zostanie
// wywołane dokładnie raz.
function whPlayClose(host, done) {
  const S = host && host._wh;
  const root = S && S.root;
  if (host && host._whCloseT) return;              // zwijanie już trwa — drugie by je zrestartowało
  if (!root || whLessMotion()) { if (done) done(); return; }
  clearTimeout(S._bloomT);
  root.classList.remove("wh-open", "wh-grow");
  root.classList.add("wh-close");
  host._whCloseT = setTimeout(() => {
    host._whCloseT = 0;
    if (done) done();
  }, WHEEL_CLOSE_MS);
}

// Koło wróciło, zanim zwijanie dobiegło końca. Bez tego rysunek zniknąłby chwilę PO tym, jak
// człowiek otworzył go z powrotem — i wyglądałoby to na zgubione kliknięcie.
function whCancelClose(host) {
  if (!host) return;
  if (host._whCloseT) { clearTimeout(host._whCloseT); host._whCloseT = 0; }
  const S = host._wh;
  if (S && S.root) S.root.classList.remove("wh-close");
}

// Wielokropek na napisach, które nie mieszczą się w swoim wycinku. Mierzone raz na tekst: pomiar
// przy każdym pakiecie kosztowałby przeliczenie układu 25 razy na sekundę, na każdym kapslu.
function _whFitLabels(S) {
  for (const t of S.labs) {
    if (!t || t._fit) continue;
    t._fit = true;
    const maxw = parseFloat(t.getAttribute("data-maxw")) || 60;
    if (!t.getComputedTextLength) continue;
    let len = 0;
    try { len = t.getComputedTextLength(); } catch (e) { continue; }
    if (!(len > maxw)) continue;
    let txt = String(t._want || t.textContent);
    while (txt.length > 1) {
      txt = txt.slice(0, -1);
      t.textContent = txt.replace(/\s+$/, "") + "…";
      try { if (t.getComputedTextLength() <= maxw) break; } catch (e) { break; }
    }
  }
}

// ------------------------------------------------------------------------------------------
//  ŚRODEK KOŁA
// ------------------------------------------------------------------------------------------
// Okruszki (którędy tu weszliśmy), nazwa wskazanego wycinka i jedno zdanie o tym, co się stanie.
// Kolejność jest odpowiedzią na trzy pytania w naturalnej kolejności: gdzie jestem, co wskazuję,
// co z tym zrobić. Na małym kole zostaje sama nazwa — trzy linijki w kółku o średnicy kciuka to
// nie informacja, tylko plama.
function _whHubHtml(st, sel, bands, nb, small) {
  const e = (typeof esc === "function") ? esc : (s => String(s));
  const cr = Array.isArray(st.crumbs) ? st.crumbs.filter(Boolean) : [];
  const bd = sel ? (bands[Math.max(0, Math.min(nb - 1, sel.band | 0))] || {}) : null;
  const it = bd ? (bd.items || [])[sel.idx] : null;
  // „release" po puszczeniu przycisku zachowuje się jak tryb klikany i mówi to wprost — inaczej
  // środek koła kazałby puszczać coś, co jest już puszczone.
  const cfm = st.clk ? "click" : (st.confirm || "release");
  let s = "";
  if (cr.length && !small) s += '<div class="wh-hub-crumb">↩ ' + e(cr.join(" ▸ ")) + "</div>";
  if (it) {
    // IKONA WSKAZANEGO WYCINKA powtórzona w środku — tak jak w prototypie i tak, jak robi to koło
    // broni w grach. Ta sama ikona jest na wycinku, ale wycinek stoi z boku pola widzenia, a oko
    // w chwili decyzji patrzy w środek. Na małym kole znika razem z resztą ozdobników.
    if (!small && it.icon && !it.empty) s += '<div class="wh-hub-ico">' + e(String(it.icon)) + "</div>";
    s += '<div class="wh-hub-title">' + e(String(it.label || "")) + "</div>";
    if (!small) {
      // PUSTE POLE ODPOWIADA WPROST. Środek koła istnieje po to, żeby odpowiedzieć na jedno
      // pytanie: „co się stanie, gdy teraz puszczę". Nad pustym polem odpowiedź brzmi „nic" —
      // i to jest cała odpowiedź, więc podpowiedź o puszczaniu i klikaniu byłaby tu myląca:
      // mówiłaby, JAK zatwierdzić coś, czego nie ma czym zatwierdzić.
      if (it.empty) s += '<div class="wh-hub-hint">' + e(_wheelT("nic nie wysyła", "sends nothing")) + "</div>";
      else if (it.back) s += '<div class="wh-hub-hint">' + e(_wheelT("wraca poziom wyżej", "goes one level up")) + "</div>";
      else if (it.sub) s += '<div class="wh-hub-hint">' + e(_wheelT("otwiera podmenu", "opens a submenu")) + "</div>";
      else {
        const hh = wheelCentreHint(cfm, !!st.cyc, 0, cr.length > 0, !!st.wake);
        if (hh) s += '<div class="wh-hub-hint">' + e(hh.join(" ")) + "</div>";
      }
    }
  } else if (!small && !st.idle) {
    // ŚRODEK SPOCZYNKOWEGO KOŁA MILCZY. Podpowiedzi mówią, co zrobić TERAZ („puść, by anulować"),
    // a nad kołem, którego nikt nie otworzył, nie ma czego puszczać ani anulować — zdanie z ręką
    // w środku byłoby jedyną nieprawdą na całej ściądze. Jak koło się otwiera, mówi to, co zawsze.
    const hh = wheelCentreHint(cfm, !!st.cyc, -1, cr.length > 0, !!st.wake);
    if (hh) s += '<div class="wh-hub-hint">' + e(hh.join(" ")) + "</div>";
  }
  return s;
}

// Dwie linijki w środku koła albo nic. Osobna funkcja, bo to jedyne miejsce, w którym rysunek
// musi wiedzieć, JAK koło jest sterowane — reszta wygląda tak samo we wszystkich pięciu trybach.
// `deep` = jesteśmy w podmenu, więc środek nie anuluje, tylko cofa o poziom.
// `wake` = koło klikane SŁUCHA (patrz `wake` w pakiecie); przy `false` śpi i czeka na obudzenie.
function wheelCentreHint(cfm, cyc, idx, deep, wake) {
  // TRYB KLIKANY MÓWI TYLKO O JEDNYM NACIŚNIĘCIU NARAZ, i to jest cała nauka tego trybu: to samo
  // naciśnięcie znaczy w nim trzy różne rzeczy, więc środek koła nazywa TĘ, która jest teraz
  // następna. Trzy zdania po kolei — „włącz", „wybieraj", „czekaj" — czyta się jak instrukcję;
  // wszystkie trzy naraz byłyby ulotką.
  if (cyc) {
    if (!wake) return [_wheelT("kliknij,", "click"), _wheelT("żeby włączyć", "to switch on")];
    // PRZYTRZYMANIE JEST W DRUGIEJ LINIJCE OD RAZU, a nie dopiero „gdy się przyda": to jedyne
    // wyjście z tego koła i człowiek ma je znać, ZANIM będzie go potrzebował. Bez tego wyjściem
    // z pomyłki jest czekanie, aż koło samo zaśnie — czyli nauka, że nie ma wyjścia.
    return (idx < 0)
      ? [_wheelT("klikaj, by wybierać", "click to choose"),
         _wheelT("przytrzymaj, by wyłączyć", "hold to switch off")]
      : [_wheelT("poczekaj, by zatwierdzić", "wait to confirm"),
         _wheelT("przytrzymaj, by wyłączyć", "hold to switch off")];
  }
  if (cfm === "click" || cfm === "tilt-click") {
    return (idx >= 0)
      ? [_wheelT("kliknij, by", "click to"), _wheelT("zatwierdzić", "confirm")]
      : (cfm === "click"
        ? [_wheelT("kliknij, by", "click to"),
           deep ? _wheelT("wrócić", "go back") : _wheelT("anulować", "cancel")]
        : [_wheelT("pochyl, by", "lean to"), _wheelT("wybrać", "choose")]);
  }
  if (cfm === "tilt-hold") {
    // Gdy coś jest wskazane, mówi to już łuk odliczania — dwa komunikaty naraz w kółku
    // o średnicy kciuka to jeden za dużo.
    return (idx >= 0) ? null
      : [_wheelT("pochyl, by", "lean to"), _wheelT("wybrać", "choose")];
  }
  return (idx < 0) ? [_wheelT("puść, by", "release to"), _wheelT("anulować", "cancel")] : null;
}

function _wheelT(pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; }

// ------------------------------------------------------------------------------------------
//  ŚCIĄGA I NAKŁADKA — jeden pojemnik na kapsel, w jego kolumnie
// ------------------------------------------------------------------------------------------
// Kod HTML kafla, wstawiany przez renderOverview (rf-11). Osobny element, a nie dorysowanie do
// widżetu ruchu: ruch i koło potrafią być otwarte naraz i mają w nakładce własne przełączniki.
function wheelOverviewHtml(dev) {
  const e = (typeof esc === "function") ? esc : (s => String(s));
  return `<div class="ov-wheel" data-dev="${e(dev)}" style="display:none" `
    + `title="${_wheelT("Koło wyboru — przytrzymaj przycisk kapsla, pochyl, puść",
                        "Selection wheel — hold the capsule button, lean, let go")}"></div>`;
}

// Wołane co klatkę z updateDetail (rf-12), gałąź ściągi. Element pojawia się i znika razem
// z kołem: zarezerwowany na stałe kwadrat zabierałby pół kolumny, żeby przez 99% czasu nie
// pokazywać niczego.
//
// GDZIE POKAZYWAĆ KOŁO wchodzi DOKŁADNIE TUTAJ (whDrawHere): przy wyborze „Przy kursorze" zwykła
// nakładka po prostu nie rysuje, mimo że jej własne „pokaż koło" zostaje włączone.
function wheelOverviewFrame(root) {
  root.querySelectorAll(".ov-wheel").forEach(c => {
    const D = state.devices[c.dataset.dev]; if (!D) return;
    const st = D.wheelLive;
    const live = !!(st && st.open) && whDrawHere(st);
    // KOŁO ZAMKNIĘTE TEŻ MA CO POKAZAĆ — swoje wycinki (wheelIdleState w rf-46g). W panelu stoi
    // więc w kolumnie na stałe, jak kula orientacji i kontroler; nad grą pojawia się jak dotąd
    // dopiero na czas wybierania (patrz whIdleHere niżej).
    const idle = (!live && whIdleHere() && typeof wheelIdleState === "function")
      ? wheelIdleState(D) : null;
    const on = live || !!idle;
    if (c._on !== on) {
      c._on = on;
      if (on) {
        // ZBOCZE OTWARCIA. Pojemnik pokazuje się DOKŁADNIE w tej chwili, a rysunek w nim jest
        // świeży (patrz sprzątanie niżej) — więc rozkwit gra sam z siebie: _whPaint widzi
        // „pakiet mówi otwarte, a ten rysunek jeszcze nie był otwarty".
        whCancelClose(c);
        c.style.display = "block";
      } else {
        // Nie ma czego pokazywać (nad grą po zamknięciu, wszędzie przy kole bez wycinków) = pusty
        // pojemnik, ale dopiero PO zwinięciu. Zostawiony rysunek wracałby na ekran przez jedną
        // klatkę przy następnym otwarciu, zanim przyjdzie nowy pakiet — i byłby to POPRZEDNI wybór.
        whPlayClose(c, () => {
          if (c._on) return;                       // wróciło w międzyczasie — nie sprzątamy żywego
          c.style.display = "none";
          c.innerHTML = "";
          c._wh = null;
          c._sig = "";
        });
      }
    }
    if (!on || !c.offsetParent) return;
    // ŻYWE ↔ SPOCZYNEK. Przełącznik jest jedną klasą, a przygaszenie robi przejście w CSS: koło
    // po wyborze nie znika, tylko cichnie, i to jest ta sama rzecz na ekranie, a nie druga.
    // whCancelClose zdejmuje przy okazji klatkę końcową zwijania (opacity 0), gdyby zdążyła wejść.
    if (c._idle !== !!idle) {
      c._idle = !!idle;
      c.classList.toggle("is-idle", !!idle);
      if (idle) whCancelClose(c);
      c._sig = "";
    }
    const draw = live ? st : idle;
    // Kolumna ściągi zmienia szerokość pod ręką (przeciąganie panelu, zmiana rozmiaru okna
    // nakładki) — kafel ma iść za nią natychmiast, a nie przy najbliższym pakiecie.
    whWatchBox(c.parentElement, () => {
      if (!c._on || !c.offsetParent) return;
      const s = (D.wheelLive && D.wheelLive.open && whDrawHere(D.wheelLive)) ? D.wheelLive
        : ((whIdleHere() && typeof wheelIdleState === "function") ? wheelIdleState(D) : null);
      if (!s) return;
      c._sig = "";                     // pojemnik ma inny rozmiar — rysunek trzeba przeliczyć
      _whFitBox(c, s);
      try { wheelSvgInto(c, s, s.labels); } catch (e) { /* zgłoszone niżej, przy rysowaniu klatki */ }
    });
    _whFitBox(c, draw);
    // SPOCZYNKOWEGO KOŁA NIE PRZERYSOWUJEMY 25 RAZY NA SEKUNDĘ. Ono się nie zmienia samo z siebie,
    // więc pętla klatek ma tu dokładnie tyle roboty, ile jest prawdziwych zmian: konfiguracja
    // (podpis z rf-46g) albo szerokość kolumny. Żywe koło idzie jak dotąd — każdy pakiet.
    if (idle) {
      const sig = draw.sig + "|" + (c._whBox || 0);
      if (c._sig === sig) return;
      c._sig = sig;
    } else c._sig = "";
    try { wheelSvgInto(c, draw, draw.labels); }
    catch (e) { if (!c._werr) { c._werr = 1; console.error("[koło wyboru " + D.meta.dev + "]", e); } }
  });
}

// GDZIE KOŁO STOI NA STAŁE, a gdzie tylko na czas wybierania.
//
// W PANELU stoi zawsze: „Nakładka" jest ściągą, czyli spisem tego, co kapsel potrafi, i każdy inny
// moduł ma tam swój obrazek widoczny bez względu na to, czy akurat coś robi. Koło było wyjątkiem
// i to właśnie ono jest w tym spisie najtrudniejsze do wyobrażenia sobie z samych nazw.
//
// NAD GRĄ nie: tam obowiązuje decyzja z rf-41 (OVL_PARTS), że koło „nie zabiera miejsca, dopóki
// nie jest potrzebne" — okno nakładki ma być małe, a stały kwadrat na pół okna byłby zmianą, o
// którą nikt nie prosił. Kto chce mieć je nad grą na stałe, ma do tego okienko „Przy kursorze".
//
// ⚠️ WYJĄTEK: ŻYWA MINIATURA W PANELU (2026-09-01). Podgląd nakładki jest tą samą stroną, więc
// odpowiadałby „nad grą" i pokazywał pusty prostokąt przez cały czas poza jednym naciśnięciem —
// czyli dokładnie wtedy, gdy nikt na niego nie patrzy. Podgląd służy do USTAWIANIA (czy koło się
// zmieści, czy motyw jest czytelny), więc koło stoi w nim na stałe, a zdanie pod miniaturą mówi
// wprost, że nad grą pokaże się na czas wybierania.
function whIdleHere() {
  if (typeof RF_OVL_PREVIEW !== "undefined" && RF_OVL_PREVIEW) return true;
  return (typeof RF_OVL === "undefined") || !RF_OVL;
}

// WIELKOŚĆ KAFLA na ściądze i w zwykłej nakładce. Bez tego kafel był kwadratem o szerokości
// kolumny i koło rosło razem z nią, cokolwiek mówiło ustawienie wielkości — czyli suwak, który
// działał w jednym miejscu z trzech.
//
// OKIENKO PRZY KURSORZE jest wyjątkiem i nie przechodzi tędy: tam wielkość OKNA jest wielkością
// koła (serwer buduje je o boku policzonym z tej samej liczby), więc rysunek ma wypełnić okno.
function _whFitBox(c, st) {
  if (typeof RF_OVL_WHEEL !== "undefined" && RF_OVL_WHEEL) return;
  // SPOCZYNKOWE KOŁO JEST MINIATURĄ, NIE PODGLĄDEM WIELKOŚCI. Wierna wielkość ma sens w chwili
  // wyboru — wtedy odpowiada na pytanie „ile tego będzie na ekranie w grze". Koło stojące
  // w kolumnie odpowiada na inne: „co tu jest", więc oddaje miejsce reszcie kolumny i mieści się
  // w suficie z CSS (.ov-wheel, 13-dialogs-overview). Zdejmujemy wymiary wpisane w styl, zamiast
  // liczyć drugi sufit w JS — inaczej ta sama liczba żyłaby w dwóch plikach.
  if (st && st.idle) {
    if (c._whBox === -1) return;
    c._whBox = -1;
    c.style.width = ""; c.style.height = ""; c.style.maxHeight = "";
    return;
  }
  const want = wheelBoxPx(wheelLook(st && st.look).size);
  const room = (c.parentElement ? c.parentElement.clientWidth : 0) || want;
  const px = Math.max(90, Math.min(want, room));
  if (c._whBox === px) return;
  c._whBox = px;
  c.style.width = px + "px";
  c.style.height = px + "px";
  c.style.maxHeight = "none";
}

// ------------------------------------------------------------------------------------------
//  GDZIE POKAZYWAĆ KOŁO — pytanie, które zadaje RYSUNEK
// ------------------------------------------------------------------------------------------
// Sam wybór („Przy kursorze", „W nakładkach", „W obu") ustawia się w karcie, a karta mieszka
// w rf-46b. Te dwie funkcje zostają tutaj, bo pyta o nie wheelOverviewFrame powyżej — a nakładka
// ładuje rysunek BEZ karty. Gdyby siedziały w rf-46b, koło w nakładce rysowałoby się zawsze.
function whWhere() {
  const v = state.wheel && state.wheel.showWhere;
  return WH_WHERE.some(w => w[0] === v) ? v : "overlay";
}

// Czy koło ma się rysować w TEJ nakładce. Tłumienie siedzi w rysowaniu, a nie w konfiguracji okien:
// przełączenie miejsca ma działać natychmiast i dać się cofnąć, a przestawianie cudzych „pokaż
// koło" w szufladach nakładek byłoby zmianą, której nikt nie prosił. Ściąga w panelu rysuje ZAWSZE.
function whDrawHere(st) {
  if (typeof RF_OVL === "undefined" || !RF_OVL) return true;   // ściąga w panelu: zawsze
  // Brak pola „where" (stary serwer, pakiet sprzed zmiany) czyta się jak „rysuj" — czyli dokładnie
  // tak, jak było przed tą opcją. Nowa funkcja nie może wygasić koła komuś, kto jej nie ma.
  const where = (st && st.where) || "";
  // OKIENKO KOŁA rysuje wszędzie POZA „W nakładkach" — obejmuje to i „Przy kursorze", i „Na środku
  // ekranu", bo to jedno i to samo okno, tylko postawione raz pod ręką, a raz nieruchomo pośrodku.
  if (typeof RF_OVL_WHEEL !== "undefined" && RF_OVL_WHEEL) return where !== "overlay";
  // ZWYKŁA NAKŁADKA — LISTA POZYTYWNA, a nie „byle nie »przy kursorze«". Póki miejsca były trzy, jedno
  // wykluczenie starczało za wyliczenie; przy czwartym („center") ten sam warunek kazałby nakładce
  // rysować koło RÓWNOLEGLE z okienkiem na środku ekranu, czyli dawał dwa koła naraz — dokładnie tę
  // usterkę, dla której wybór miejsca w ogóle powstał. Wolno rysować tylko tam, gdzie wybór nakładkę
  // wymienia. Puste `where` zostaje po staremu („rysuj"), bo to stary pakiet, a nie czyjś wybór.
  return !where || where === "overlay" || where === "both";
}
