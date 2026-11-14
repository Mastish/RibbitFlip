"use strict";
// ===================== KOŁO WYBORU — SCENA PODGLĄDU (GEOMETRIA I RYSUNEK) =====================
// Lewa kolumna zakładki „Koło wyboru": żywe koło, po którym da się wodzić myszą, wchodzić
// w podmenu i „wybierać" wycinki — albo które pokazuje NA ŻYWO, co robi prawdziwy kapsel.
// Forma przeniesiona z prototypu koła (poza repozytorium).
//
// TRZY PLIKI NA JEDNĄ SCENĘ (podział 2026-08-26, twardy limit 800 linii z reguły organizacji JS —
// scena miała ich 847). Granice są tematyczne, nie arytmetyczne, i każdy plik odpowiada na inne
// pytanie:
//   rf-46d  (ten plik) — ILE MIEJSCA i CO NARYSOWAĆ: skala sceny, jej pudło, pakiet podglądu
//                        i pętla rysowania.
//   rf-46d2-wheel-stage-aim.js  — GDZIE CELUJE RĘKA: kąt, odległość, trafiony wycinek i dziennik
//                        ostatnich wyborów.
//   rf-46d3-wheel-stage-life.js — CO SIĘ WŁAŚNIE DZIEJE: układ sceny, źródło podglądu, motyw,
//                        otwieranie i zamykanie koła, sandbox wyboru, komunikaty i start.
// Wszystkie trzy piszą do jednego stanu (`state.wheelStage`, deklarowanego tutaj) i wołają się
// nawzajem po nazwach globalnych — tak jak reszta aplikacji, bez modułów ES.
//
// DWA ŹRÓDŁA, JEDEN RYSUNEK. Przełącznik „Podgląd: Myszą · Kapslem" wybiera, co scena pokazuje:
//   • MYSZĄ  — lokalna symulacja. ⚠️ NIC Z NIEJ NIE WYCHODZI: nie woła silnika, nie przechodzi
//     przez bramkę symulacji, nie dotyka uzbrojenia i nie naciska ani jednego klawisza. Cała
//     symulacja żyje w przeglądarce i kończy się wpisem w „Ostatnich wyborach". Gdyby było inaczej,
//     ustawianie koła oznaczałoby wysyłanie kilkudziesięciu przypadkowych skrótów do systemu.
//   • KAPSLEM — ten sam strumień, którym żyje ściąga i nakładka (`wheelLive` z pakietu SSE).
//     Trzymasz prawdziwy kapsel, pochylasz go i widzisz DUŻE koło zamiast kafelka w rogu. Mysz
//     wtedy niczym nie steruje, bo steruje ręka.
//
// RYSUJE PRAWDZIWY RENDERER (rf-46, SVG) — ten sam, co nakładka nad grą. „Podgląd nie kłamie" nie
// jest tu obietnicą, tylko konsekwencją: to jest ten rysunek, a nie jego ładniejszy kuzyn.
//
// STAN JEST WSPÓLNY Z EDYTOREM. Scena chodzi po `state.wheelPath` — po tym samym poziomie drzewa,
// który pokazuje lista wycinków. Wejście w podmenu na scenie przestawia listę, a kliknięcie
// wycinka zaznacza jego wiersz. Dwa niezależne „gdzie jestem" byłyby dwiema odpowiedziami na
// pytanie, które ma jedną.

// TRZY UKŁADY SCENY: po połowie z edycją (domyślnie), rozłożona na całą kartę, zwinięta do zera.
// Stan pamiętany, bo to preferencja pracy, a nie widok chwili.
const WH_STAGE_KEY = "rf.wheel.stage";
const WH_STAGE_MODES = ["wide", "zoom", "mini"];
// …i czym scena jest napędzana. Też pamiętane: kto podłączył kapsel, żeby patrzeć na duże koło,
// nie chce przestawiać tego przy każdym wejściu w zakładkę.
const WH_SRC_KEY = "rf.wheel.src";
const WH_SRC_MODES = ["mouse", "puck"];
// Ile ostatnich wyborów pamięta dziennik. Pięć: tyle mieści się na scenie bez zasłaniania koła,
// a i tak chodzi o „czy trafiłem w to, co chciałem", a nie o historię sesji.
const WH_LOG_MAX = 5;
// Po tylu milisekundach wciśnięty przycisk przestaje być kliknięciem, a zaczyna być TRZYMANIEM:
// koło przeskakuje pod kursor, dokładnie tak, jak robi to prawdziwe koło przy kursorze.
const WH_STAGE_HOLD_MS = 260;

// ILE SCENY ZAJMUJE KOŁO — i to jest jedyna rzecz, w której scena PRZESTAJE być podglądem 1:1
// (2026-08-26: podgląd menu kołowego był za małym obszarem).
//
// Scena nie rysuje koła w jego prawdziwej średnicy. Rysowała — i przy ustawieniu 120 px robiła się
// polem z kropką pośrodku, a przy 640 px i tak musiała je pomniejszyć, żeby się zmieściło; czyli
// wierność co do piksela obowiązywała i tak tylko w jedną stronę. Scena jest od tego, żeby
// zobaczyć KSZTAŁT i wycelować w wycinek, a jedno i drugie potrzebuje miejsca. Rzeczywistą
// wielkość w pikselach mówi podpis pod sceną.
//
// ⚠️ ALE SUWAK MUSI BYĆ WIDAĆ. Pierwsze podejście dawało kołu STAŁE 85% boku sceny niezależnie od
// ustawienia, więc wyglądało, że wielkość koła nie działa: koło zawsze było wielkie, niezależnie
// od suwaka. Podgląd, na którym suwak nic nie robi, uczy, że suwak
// nic nie robi. Skala sceny zostaje więc UMOWNA, ale nie stała: cały zakres suwaka rozciąga się
// na udział sceny, od ćwiartki boku przy najmniejszym kole do prawie całego boku przy największym.
// Ruch suwaka widać na oczach, a proporcje między ustawieniami zostają zachowane.
const WH_STAGE_FILL_MIN = 0.25;   // udział boku sceny przy WHEEL_SIZE_MIN (120 px)
const WH_STAGE_FILL_MAX = 0.92;   // …i przy WHEEL_SIZE_MAX (640 px)
function whStageFill(size) {
  const s = wheelLook({ size: size }).size;
  const span = Math.max(1, WHEEL_SIZE_MAX - WHEEL_SIZE_MIN);
  const t = Math.max(0, Math.min(1, (s - WHEEL_SIZE_MIN) / span));
  return WH_STAGE_FILL_MIN + t * (WH_STAGE_FILL_MAX - WH_STAGE_FILL_MIN);
}
// ŚREDNICA, jakiej scena żąda od rysunku. Jedna odpowiedź dla wszystkich trzech układów sceny
// (pół karty, cała karta, zwinięta) i dla obu źródeł podglądu — liczona ZAWSZE z bieżącego
// pojemnika i z bieżącego ustawienia, nigdy zapamiętana: „Powiększ" zmienia pudło, suwak zmienia
// udział, a wskazywanie ma iść za jednym i drugim w tej samej klatce.
//
// Górne 92% i tak przechodzi jeszcze przez sufit rysunku (`box/2 - margines` w rf-46), więc na
// małej scenie koło zmieści się w całości razem z wysuniętym wycinkiem — także wtedy, gdy stoją
// na niej trzy obręcze naraz.
function whStageSizePx(host, look) {
  if (!host) return 0;
  const box = Math.min(host.clientWidth || 0, host.clientHeight || 0);
  return box > 1 ? box * whStageFill(wheelLook(look).size) : 0;
}

// GDZIE SCENA MA SIĘ ZATRZYMAĆ PRZY PRZEWIJANIU — liczone POZA tym plikiem, patrz `--wh-top`
// w 03-triggers.css. Stał tu do 14.09 własny pomiar (`whStageTopPx`/`whStageTopSync`): brał pasek
// zakładek aplikacji, a po przebudowie na trzy kolumny (2026-08-29) takiego paska nie ma —
// pomiar spadał na sam nagłówek i scena zatrzymywała się 67 px ZA WYSOKO, czyli swoim paskiem
// przycisków („Powiększ", „Zwiń", motywy, źródło) pod paskiem modułu. Tę samą liczbę zgadywały
// osobno jeszcze trzy inne moduły, więc mieszka teraz w JEDNEJ zmiennej dla całej aplikacji:
// `--rf-sticky-top` (22-modtabs.css) składa zmierzone wysokości paska aplikacji, pasa kapsli
// i paska modułu. Scena czyta ją w arkuszu, bo korzystają z niej DWIE rzeczy naraz: miejsce
// zatrzymania i wysokość (ma sięgać od tego miejsca do dołu okna).

state.wheelStage = {
  open: false,        // czy koło STOI na scenie (patrz „cykl życia" w rf-46d3)
  hover: null,        // {band, idx} albo null (martwa strefa / pudło)
  over: false,        // czy kursor jest w ogóle nad sceną
  down: 0,            // kiedy wciśnięto przycisk (0 = nie jest wciśnięty)
  held: false,        // …i czy przytrzymanie zdążyło przenieść koło pod kursor
  ox: 0, oy: 0,       // przesunięcie środka koła względem środka sceny
  px: 0, py: 0,       // ostatnia pozycja kursora w pojemniku
  // ODLICZANIE W TRYBACH, KTÓRE ZATWIERDZAJĄ CZEKANIEM („Pochyl i przytrzymaj", „Przełączaj
  // kliknięciami"). Liczone TU, w przeglądarce, dokładnie tak jak liczy je silnik — inaczej
  // podgląd tych dwóch trybów pokazywałby koło, którego nie da się w nim zatwierdzić, czyli
  // tłumaczyłby, że tryb nie działa.
  cd: 0,              // 0..1 — to samo pole, które w pakiecie z silnika niesie `cd`
  cdT: 0,             // kiedy odliczanie ruszyło (0 = nie liczy)
  cdKey: "",          // …i czego dotyczy: zmiana celu ZERUJE zegar, tak jak w silniku
  clicks: -1,         // „Przełączaj kliknięciami": ile razy klik przesunął wybór (-1 = nic)
  // …i czy koło klikane SŁUCHA, czy śpi — lustro RadialMenu._awake. Osobne pole od `open`
  // dokładnie z tego samego powodu, co w silniku: koło „zawsze widoczne" stoi na scenie bez
  // przerwy, więc `open` nie umie odpowiedzieć na pytanie „czy klik coś teraz wybierze".
  awake: false,
  wakeT: 0,           // kiedy je obudzono — stąd liczy się poddanie (OPEN_TIMEOUT)
  cycOff: false,      // …i czy TO naciśnięcie zdążyło już wyłączyć koło przytrzymaniem
  // PRÓG UZBROJENIA. `true` znaczy „to wychylenie NIE MA PRAWA otworzyć koła", i tak właśnie
  // scena zaczyna — lustro RadialMenu._lean_used, który od 2026-08-27 startuje tak samo. Zdejmuje
  // to wyłącznie powrót kursora do martwej strefy: bez tego wjazd myszą z boku sceny otwierał koło
  // z już trafionym wycinkiem i po chwili sam go wybierał (zmierzone, zgłoszenie „koło otwiera się
  // i od razu wybiera").
  leanUsed: true,
  log: [],
};

function whStageHtml() {
  return `<div class="wh-stage" id="whStage">
    <div class="wh-stage-top">
      <span class="wh-stage-live">na żywo</span>
      <!-- WYGLĄD ZNIKŁ STĄD 2026-08-31: tu zostaje tylko koło obszywane, a styl zmienia się
           w nakładce. Nad sceną i w sekcji „Wygląd" stały dwa
           komplety pięciu przycisków od JEDNEJ wartości — motywu okna — a wygląd należy do OKNA,
           nie do koła: to samo koło wygląda inaczej w każdej nakładce, nad którą stoi. Scena
           rysuje więc jeden wygląd, ten obszywany ściegiem („Jasny"), a styl wybiera się tam,
           gdzie mieszka okno: w ustawieniach nakładki (⚙ w oknie nad grą albo ekran „Nakładka"
           w panelu, karta „Nakładki nad grą"). -->
      <span class="wh-stage-sp"></span>
      <span class="seg seg-sm wh-src" id="whSrcSeg" role="group" aria-label="Czym sterować podglądem">
        <button type="button" data-v="mouse" title="Wodzisz myszą po scenie. To symulacja: nic z niej nie idzie do systemu.">Myszą</button>
        <button type="button" data-v="puck" title="Scena pokazuje na żywo koło z prawdziwego kapsla — trzymasz przycisk i pochylasz, tak jak w grze">Kapslem</button>
      </span>
      <button type="button" class="wh-stage-btn" id="whZoom"
        title="Rozłóż podgląd na całą kartę (Esc wraca)">⤢ Powiększ</button>
      <button type="button" class="wh-stage-btn" id="whMini"
        title="Zwiń podgląd i oddaj całą szerokość edycji">⤡ Zwiń</button>
    </div>
    <!-- SCENA ŁAPIE OGNISKO. Nie ozdobnik: bez tego jedyną drogą do koła jest mysz, a koło wyboru
         buduje się właśnie po to, żeby dało się je obsłużyć ręką, która myszą nie steruje. Strzałki
         przechodzą po wycinkach, Enter/Spacja WYBIERA OD RAZU (bez przytrzymywania — wymuszony hold
         jest barierą przy drżeniu i słabym chwycie, więc ścieżka klawiaturowa świadomie go omija),
         Esc zamyka. Etykieta mówi to samo, co widać, bo dla czytnika ekranu jest jedyną treścią,
         zanim cokolwiek zostanie wskazane. -->
    <div class="wh-scene" id="whScene" data-look="felt" data-src="mouse" tabindex="0" role="group"
         aria-label="Podgląd koła wyboru. Strzałki przechodzą po wycinkach, Enter wybiera, Escape zamyka.">
      <div class="wh-canvas" id="whPreview" aria-label="Podgląd koła wyboru"></div>
      <!-- OGŁOSZENIA DLA CZYTNIKA EKRANU: zmiana wskazanego wycinka i sam wybór. Osobny element od
           dziennika i od toastu, bo te dwa mówią o CZYM INNYM (historia i komunikat aplikacji), a
           trzy naraz w jednym obszarze „na żywo" czytałyby się jedno przez drugie. -->
      <p class="sr-only" id="whSay" aria-live="polite" aria-atomic="true"></p>
      <div class="wh-scene-hint" id="whSceneHint"></div>
      <!-- DWA OKRĘGI, BO SĄ DWA PROGI — i to jest cała treść tego rysunku.
           • WEWNĘTRZNY (whArmRing) = martwa strefa: miejsce, w którym trzeba STANĄĆ, żeby
             wychylenie w ogóle zaczęło coś znaczyć (uzbrojenie, S.leanUsed).
           • ZEWNĘTRZNY (whOpenRing) = próg otwarcia: linia, którą trzeba PRZEKROCZYĆ, żeby koło
             stanęło (_open_bar w silniku, wheelOpenBar w rysunku).
           ⚠️ To NIE JEST ten sam promień. Pierwsza wersja rysowała wyłącznie martwą strefę i
           podpisywała ją „odsunięcie otwiera koło" — a otwarcie następuje dopiero 2,1× dalej
           (38% promienia wobec 80%). Człowiek wyjeżdżał poza narysowany okrąg, nic się nie działo
           i wyglądało to na zepsute (kursor poza kołem, a nadal nic się nie włącza). Rysunek ma pokazywać oba progi, bo oba istnieją. -->
      <div class="wh-open-ring" id="whOpenRing" hidden aria-hidden="true"><span></span></div>
      <div class="wh-arm-ring" id="whArmRing" hidden aria-hidden="true"></div>
      <!-- ZAPROSZENIE. Stoi na środku zamkniętej sceny i mówi, czym się ją otwiera. Treść wpisuje
           whStageNote (dwa języki), bo ten sam element gaśnie, kiedy koło stanie. -->
      <div class="wh-scene-open" id="whScenePrompt"><b></b><span></span></div>
      <div class="wh-scene-off" id="whSceneOff" hidden>
        <p id="whSceneOffTx">Włącz koło, żeby zobaczyć podgląd z kapsla.</p>
        <button type="button" class="btn sm" id="whSceneOffBtn">Pokaż przełącznik On</button>
      </div>
      <aside class="wh-log" id="whLog" aria-live="polite">
        <h4>Ostatnie wybory</h4>
        <ol id="whLogList"><li class="wh-log-none">jeszcze nic nie wybrano</li></ol>
      </aside>
      <div class="wh-toast" id="whToast" role="status" aria-live="polite"></div>
    </div>
    <div class="wh-scene-note" id="whSceneNote">—</div>
  </div>`;
}

// ------------------------------------------------------------------------------------------
//  PAKIET PODGLĄDU
// ------------------------------------------------------------------------------------------
// Pakiet „wheel" złożony z konfiguracji — dokładnie tego samego kształtu, co przysyła silnik.
// Podgląd nie ma własnego rysunku ani własnej geometrii: buduje wsad i oddaje go tej samej
// funkcji, która rysuje w nakładce.
function whPreviewState() {
  const W = state.wheel;
  const mode = W.confirm || "release";
  const cyc = (mode === "cycle");
  // „cycle" rysuje się jak „Zastąp koło", tak samo jak w silniku (_tick_cycle): druga obręcz
  // byłaby obręczą, w którą klikaniem nie da się wycelować.
  const sub = cyc ? "replace" : whSubMode();
  const lv = whLevels();
  let win, vis;
  if (sub === "replace") { win = lv.length - 1; vis = [lv[win]]; }
  else if (lv.length > WHEEL_MAX_BANDS) { win = lv.length - WHEEL_MAX_BANDS; vis = lv.slice(win); }
  else { win = 0; vis = lv.slice(0); }
  const path = state.wheelPath || [];
  const dz = W.deadzone || WHEEL_DEAD_DEF;
  const geom = wheelBandGeom(dz, vis.length);
  const bands = [];
  let prevC = null;
  for (let i = 0; i < vis.length; i++) {
    // `empty` — lustro RadialMenu.is_empty (i whIsEmptySlice w rf-46c). Pakiet z silnika niesie tę
    // flagę, więc podgląd musi ją nieść też: inaczej puste pole rysowałoby się na scenie jak
    // zwykły wycinek i człowiek zobaczyłby je dopiero w grze.
    const items = vis[i].map(s => ({
      label: s.label || "", icon: s.icon || "", color: _whCol(s.color),
      sub: !!(s.children && s.children.length), back: false,
      empty: whIsEmptySlice(s)
    }));
    const n = Math.max(1, items.length);
    const openIdx = (i + 1 < vis.length) ? path[win + i] : null;
    let full = true, a0 = 0, a1 = 360;
    const centres = [];
    if (sub === "arc" && i > 0 && prevC) {
      const pc = prevC[path[win + i - 1]] || 0;
      const per = Math.min(WHEEL_ARC_PER, WHEEL_ARC_MAX / n);
      a0 = pc - (per * n) / 2; a1 = pc + (per * n) / 2; full = false;
      for (let j = 0; j < n; j++) centres.push(a0 + per * (j + 0.5));
    } else {
      const step = 360 / n;
      for (let j = 0; j < n; j++) centres.push(j * step);
    }
    prevC = centres;
    bands.push({ items: items, openIdx: (openIdx == null ? null : openIdx), full: full, a0: a0, a1: a1 });
  }
  const last = bands.length - 1;
  const cur = bands[last].items;
  // WSKAZANIE: kursor, gdy jest nad sceną; poza tym wiersz, który się właśnie edytuje. Dwie drogi
  // do tej samej odpowiedzi, bo tak samo pyta się o nią z dwóch stron karty.
  const S = state.wheelStage;
  let sel = null;
  if (S.over && S.hover) sel = S.hover;
  else if (state.wheelFocus >= 0 && state.wheelFocus < cur.length) sel = { band: last, idx: state.wheelFocus };
  const segs = sel ? _whSegs(bands[sel.band], Math.max(1, (bands[sel.band].items || []).length)) : null;
  const mid = sel ? (geom[sel.band][0] + geom[sel.band][1]) / 2 : 0;
  // WSKAZÓWKA. Gdy ręka jest na scenie, kreska idzie DOKŁADNIE za kursorem — to jest jej jedyne
  // zadanie i tak robi to prototyp. Dopiero gdy myszy nad sceną nie ma, wskazówka kładzie się na
  // środku pasma edytowanego wiersza: wtedy nie pokazuje ręki, tylko odpowiada „ten wiersz to ten
  // wycinek", a kreska do samej krawędzi wskazywałaby przy trzech obręczach nie to pasmo.
  const aim = (S.over && whStageSrc() === "mouse") ? _whStageAim(document.getElementById("whPreview"), { look: W.look }) : null;
  return {
    // „open" jest tu PRAWDĄ O SCENIE, a nie stałą: rysunek rozpoznaje po niej zbocze otwarcia
    // i właśnie na nim gra rozkwit (patrz _whPaint → _whBloom w rf-46).
    open: !!S.open, idx: sel ? sel.idx : -1, n: cur.length,
    mag: cyc ? 0 : (aim ? aim.mag : (sel ? mid : 0)),
    ang: aim ? aim.ang : ((sel && segs && segs[sel.idx]) ? segs[sel.idx].c : 0),
    // ODLICZANIE JEST PRAWDZIWE. Stało tu zamrożone na 62%, żeby w ogóle było je widać przy
    // ustawianiu trybu — ale zamrożony pasek postępu mówi „coś się liczy" i nigdy się nie kończy,
    // więc „Pochyl i przytrzymaj" wyglądał na tryb, który na podglądzie nie działa. Teraz liczy
    // je _whStageTick (rf-46d3) tym samym zegarem, co silnik, i po jego upływie wybór NAPRAWDĘ
    // zapada — w piaskownicy, czyli w dzienniku, a nie w systemie.
    confirm: mode, cyc: cyc, dz: dz,
    // CZY KOŁO KLIKANE SŁUCHA — to samo pole, co w pakiecie z silnika. Bez niego rysunek na
    // scenie nie miałby jak przygasnąć ani powiedzieć w środku „kliknij, żeby włączyć", czyli
    // podgląd uczyłby trybu, którego w grze nie ma.
    wake: cyc ? !!S.awake : false,
    cd: (WHEEL_MODES_WAIT.indexOf(mode) >= 0) ? Math.max(0, Math.min(1, S.cd || 0)) : 0,
    chips: !!W.iconChips, mode: sub, crumbs: whCrumbLabels(),
    look: wheelLook(W.look),
    bands: bands, geom: geom, sel: sel
  };
}

// ------------------------------------------------------------------------------------------
//  RYSOWANIE SCENY
// ------------------------------------------------------------------------------------------
// Wołane co klatkę z updateDetail (rf-12). Rysunek i tak przebudowuje drzewo tylko przy zmianie
// struktury, więc „co klatkę" znaczy tu „kilka porównań i ewentualne przestawienie klas".
function whPreviewFrame() {
  const host = document.getElementById("whPreview");
  if (!host || !host.offsetParent) return;
  const src = whStageSrc();
  const D = state.devices[state.activeDeviceId || "d0"];
  const live = D && D.wheelLive;
  const S = state.wheelStage;
  // CZYM SKOŃCZYŁO SIĘ PRAWDZIWE KOŁO. Silnik dokłada „end" wyłącznie do pakietu zamknięcia
  // (patrz _close), więc pytamy o to przy każdej klatce, ZANIM zdecydujemy, co rysować — pakiet
  // zamknięcia mówi przecież „open: false". Dotyczy obu źródeł: w trybie „Kapslem" to jedyna
  // droga, a w trybie myszy stan z kapsla i tak wygrywa, gdy koło naprawdę stoi.
  if (typeof _whStageEnd === "function") _whStageEnd(live);
  let st, labels;
  if (src === "puck") {
    // KAPSLEM: pokazujemy dokładnie to, co dostaje nakładka — ani znaku więcej. Gdy koło jest
    // zamknięte (albo wyłączone), scena jest pusta i mówi dlaczego, zamiast rysować wymyśloną treść.
    const on = !!(live && live.open);
    _whStageOff(!on);
    if (!on) { _whStageShut(host); return; }
    st = live; labels = live.labels;
  } else {
    _whStageOff(false);
    // ZEGAR PIASKOWNICY. Tu, a nie we własnym setInterval: ta funkcja i tak biegnie w pętli klatek
    // (updateDetail w rf-12), a odliczanie ma się skończyć DOKŁADNIE w tej klatce, w której
    // dobiegło — nie w następnym pakiecie i nie po ruchu myszy. Może zamknąć koło, więc stoi
    // przed decyzją, co rysować.
    if (typeof _whStageTick === "function") _whStageTick();
    // OKRĄG-CEL. Po zegarze, bo to on uzbraja próg — a okrąg ma pokazać stan Z TEJ klatki, nie
    // z poprzedniej. Sama funkcja chowa się wszędzie tam, gdzie nie ma czego pokazywać.
    if (typeof _whArmRingSync === "function") _whArmRingSync();
    // Gdy koło NAPRAWDĘ jest otwarte, wygrywa stan z kapsla także w trybie myszy: nie ma sensu
    // rysować wyobrażenia obok czegoś, co dzieje się naprawdę.
    if (live && live.open) { st = live; labels = live.labels; }
    // Scena zamknięta — pusto i zaproszenie na środku. Rysunek zwija się animacją, a nie znika
    // skokiem: to ten sam ruch, tylko puszczony od końca.
    else if (!S.open) { _whStageShut(host); return; }
    else {
      st = whPreviewState();
      labels = (st.bands[st.bands.length - 1].items || []).map(x => x.label || "");
    }
  }
  // Koło wróciło, zanim zwijanie dobiegło końca (klik, rozmyśliłem się, klik) — rysunek zostaje.
  if (typeof whCancelClose === "function") whCancelClose(host);
  _whStageShown(true);
  const useOff = (src === "mouse" && S.held);
  try {
    wheelSvgInto(host, st, labels, {
      look: WH_STAGE_LOOK,        // jeden wygląd sceny — patrz rf-46d3; styl okna ustawia nakładka
      // Scena rysuje NA MIARĘ SCENY, nie na miarę gry — ale udział sceny bierze się z ustawionej
      // wielkości, więc suwak dalej widać (patrz whStageFill wyżej). `st.look` jest tu ważne:
      // w trybie „Kapslem" wielkość przychodzi w pakiecie od silnika, nie z pola w karcie.
      size: whStageSizePx(host, st && st.look),
      ox: useOff ? _whClampOff(host, st, S.ox, true) : 0,
      oy: useOff ? _whClampOff(host, st, S.oy, false) : 0,
    });
  } catch (e) { if (!host._werr) { host._werr = 1; console.error("[podgląd koła]", e); } }
}

// ZGAŚNIĘCIE SCENY. Rysunek zwija się animacją (whPlayClose w rf-46) i dopiero potem pojemnik
// jest czyszczony. Wołane co klatkę, dopóki koło stoi zamknięte, więc musi być tanie: gdy nie ma
// czego zwijać, wychodzi od razu, zamiast raz na klatkę przepisywać pusty pojemnik.
function _whStageShut(host) {
  _whStageShown(false);
  if (!host._wh && !host.firstChild) return;
  if (typeof whPlayClose !== "function") { host.innerHTML = ""; host._wh = null; return; }
  whPlayClose(host, () => { host.innerHTML = ""; host._wh = null; });
}

// Czy na scenie COKOLWIEK stoi. Klasa steruje zaproszeniem i podpowiedzią — jedna odpowiedź dla
// obu źródeł podglądu, bo oba potrafią mieć puste koło i z tego samego powodu: nikt go nie otworzył.
function _whStageShown(on) {
  const sc = document.getElementById("whScene");
  if (!sc) return;
  if (sc.classList.contains("is-open") !== !!on) sc.classList.toggle("is-open", !!on);
}

// ------------------------------------------------------------------------------------------
//  ILE MIEJSCA DOSTAJE KOŁO NA SCENIE
// ------------------------------------------------------------------------------------------
// Koło trzymane pod kursorem nie może wyjechać poza scenę: człowiek straciłby połowę wycinków,
// a „nieskończona krawędź" (kursor za kołem nadal wskazuje) przestałaby cokolwiek znaczyć.
function _whClampOff(host, st, v, horiz) {
  const R = _whStageR(host, st);
  const half = (horiz ? host.clientWidth : host.clientHeight) / 2;
  const lim = Math.max(0, half - R - 6);
  return Math.max(-lim, Math.min(lim, v));
}

// Promień, jaki koło DOSTANIE na tej scenie — ta sama odpowiedź, co w rysunku (rf-46), bo
// wskazywanie i rysowanie muszą liczyć jedno. Ten sam wzór z tą samą żądaną średnicą: scena prosi
// o `whStageSizePx`, więc hit-test, wskazówka i przycięcie przesunięcia liczą z AKTUALNEJ skali,
// a nie z wielkości zapisanej w konfiguracji.
function _whStageR(host, st) {
  const box = Math.min(host.clientWidth || 0, host.clientHeight || 0);
  const want = whStageSizePx(host, st && st.look) || wheelLook(st && st.look).size;
  return Math.min(box / 2 - _whPad(box), want / 2);
}
