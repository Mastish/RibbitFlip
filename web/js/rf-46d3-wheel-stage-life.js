"use strict";
// ========= KOŁO WYBORU — SCENA PODGLĄDU: CYKL ŻYCIA, TRYBY I KOMUNIKATY =========
// Co się na scenie właśnie dzieje i dlaczego: który z trzech układów jest wybrany, czym scena
// jest napędzana (mysz czy kapsel), jaki motyw pokazuje, czy koło STOI, co się stanie po
// kliknięciu i co scena o tym wszystkim mówi słowami.
//
// CYKL ŻYCIA KOŁA NA SCENIE (2026-08-26: w prototypie koło pokazywało się po kliknięciu
// z animacją, a w aplikacji tego brakowało). Do tej pory koło stało otwarte
// NA STAŁE, więc chwili otwarcia po prostu nie było — a razem z nią nie było rozkwitu, czyli
// jedynej rzeczy, którą to koło robi na powitanie. Teraz scena zaczyna ZAMKNIĘTA i:
//   • klik           — otwiera koło na środku sceny (tryb klikany: kolejny klik wybiera),
//   • przytrzymanie  — otwiera je POD KURSOREM (tryb trzymany: puszczenie wybiera),
//   • wybór liścia, anulowanie i Esc — zwijają je z powrotem,
//   • zmiana W EDYTORZE (fokus wiersza, dodanie wycinka, suwak wyglądu) otwiera je sama
//     i ZOSTAWIA otwarte: przy ustawianiu koła trzeba widzieć, co się ustawia, a otwieranie go
//     ręcznie po każdym drgnięciu suwaka byłoby pracą, której nikt nie prosił (whStageWake).
//
// OSTATNI Z TRÓJKI rf-46d / rf-46d2 / rf-46d3 — woła obydwa i zamyka plik startem sceny
// (whInitStage, uruchamiany przez initWheel z rf-46b).

let _whHoldTimer = null;

// ------------------------------------------------------------------------------------------
//  UKŁAD I ŹRÓDŁO
// ------------------------------------------------------------------------------------------
function whStageMode() {
  try {
    const v = localStorage.getItem(WH_STAGE_KEY);
    if (WH_STAGE_MODES.indexOf(v) >= 0) return v;
  } catch (e) { /* prywatny tryb przeglądarki */ }
  return "wide";
}
// `user` = przestawił to CZŁOWIEK przyciskiem, a nie odtworzenie stanu przy wejściu w zakładkę.
// Różnica jest jedna, ale istotna: rozłożona scena bywa wyższa niż to, co widać, więc po kliknięciu
// trzeba ją PRZYNIEŚĆ PRZED OCZY. Przy odtwarzaniu stanu przewijanie byłoby skokiem strony, o który
// nikt nie prosił — dlatego nie jest domyślne.
function whSetStageMode(m, user) {
  if (WH_STAGE_MODES.indexOf(m) < 0) m = "wide";
  const card = document.getElementById("wheelCard");
  if (card) card.dataset.stage = m;
  try { localStorage.setItem(WH_STAGE_KEY, m); } catch (e) {}
  const z = document.getElementById("whZoom");
  if (z) {
    z.textContent = (m === "zoom") ? "⤡ Zmniejsz" : "⤢ Powiększ";
    z.title = (m === "zoom") ? "Wróć do zwykłego układu (albo naciśnij Esc)"
      : "Rozłóż podgląd na całą kartę (Esc wraca)";
  }
  // Nowe pudło = nowy promień koła (patrz whStageSizePx). Rysunek i tak przeliczy się przez
  // obserwatora pojemnika, ale wołamy go tu wprost: przełączenie układu ma zdążyć w tej samej
  // klatce, a nie mrugnąć kołem w starej skali.
  const host = document.getElementById("whPreview");
  if (host && host.offsetParent) requestAnimationFrame(() => {
    if (host.offsetParent) whPreviewFrame();
  });
  if (user && m === "zoom") {
    const st = document.getElementById("whStage");
    if (st) try { st.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
    catch (e) { st.scrollIntoView(); }
  }
  whStageNote();
}

function whStageSrc() {
  try {
    const v = localStorage.getItem(WH_SRC_KEY);
    if (WH_SRC_MODES.indexOf(v) >= 0) return v;
  } catch (e) { /* prywatny tryb przeglądarki */ }
  return "mouse";
}
function whSetStageSrc(v) {
  if (WH_SRC_MODES.indexOf(v) < 0) v = "mouse";
  try { localStorage.setItem(WH_SRC_KEY, v); } catch (e) {}
  const sc = document.getElementById("whScene");
  if (sc) sc.dataset.src = v;
  const sg = document.getElementById("whSrcSeg");
  if (sg) sg.querySelectorAll("button").forEach(b => {
    const on = (b.dataset.v === v);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  // Przejście na kapsel kończy wszystko, co ręka zaczęła myszą: wskazanie, trzymanie, przesunięcie
  // koła i samo koło. Zostawione, wisiałoby nad rysunkiem, którym już nie steruje — a w drugą
  // stronę scena ma wrócić do zaproszenia, bo myszą znów trzeba je otworzyć.
  const S = state.wheelStage;
  S.open = false;
  S.hover = null; S.over = false; S.down = 0; S.held = false; S.ox = 0; S.oy = 0;
  S.clicks = -1; S.leanUsed = true;      // wraca ROZBROJONA — patrz leanUsed w rf-46d
  S.awake = false; S.wakeT = 0; S.cycOff = false;
  _whStageCdStop();
  clearTimeout(_whHoldTimer);
  _whStageShown(false);
  whStageNote();
}

// ------------------------------------------------------------------------------------------
//  WYGLĄD SCENY — JEDEN, OBSZYWANY ŚCIEGIEM
// ------------------------------------------------------------------------------------------
// Do 2026-08-31 scena pokazywała motyw OKIENKA przy kursorze i miała nad sobą pięć przycisków,
// a drugi taki komplet stał w sekcji „Wygląd" — dwa zestawy od jednej wartości. Teraz tu
// zostaje tylko koło obszywane, a styl zmienia się w nakładce. I tak jest uczciwiej, bo WYGLĄD NALEŻY DO OKNA: to samo koło rysuje się
// inaczej w każdej nakładce (bierze jej motyw — `_whSurfaceLook` w rf-46), więc jeden wybór
// w karcie koła i tak nie mówił prawdy o pozostałych oknach. Scena rysuje więc wygląd „Jasny" —
// kremową kartę ze ściegiem, tę samą, co reszta panelu — a styl wybiera się w ustawieniach
// nakładki: ⚙ w oknie nad grą albo karta „Nakładki nad grą" na ekranie „Nakładka" (rf-41b).
const WH_STAGE_LOOK = "felt";
function whStageTheme() { return WH_STAGE_LOOK; }

// ------------------------------------------------------------------------------------------
//  OTWIERANIE I ZAMYKANIE KOŁA NA SCENIE
// ------------------------------------------------------------------------------------------
// Jedno miejsce, w którym scena mówi „stoi" albo „nie stoi". Rozkwit i zwinięcie robi rysunek —
// tutaj zapada wyłącznie decyzja, a rysunek rozpoznaje ją po zboczu pola `open` w pakiecie.
function whStageOpen(mode, x, y) {
  const S = state.wheelStage;
  const host = document.getElementById("whPreview");
  if (typeof whCancelClose === "function") whCancelClose(host);
  // Świeży rysunek przy KAŻDYM otwarciu. Zostawiony po poprzednim kole wróciłby na ekran przez
  // jedną klatkę razem z poprzednim wskazaniem — i rozkwit nie miałby czego rozkwitać, bo
  // rysunek pamiętałby, że już był otwarty.
  if (host && !S.open) { host.innerHTML = ""; host._wh = null; }
  S.open = true;
  _whStageCdStop();
  // „Przełączaj kliknięciami" zaczyna od NICZEGO wskazanego (lustro `_clicks = 0` w silniku):
  // dopiero klik po obudzeniu stawia wybór na pierwszym wycinku.
  S.clicks = 0;
  // CZY OD RAZU SŁUCHA — lustro _open (usypia) i gałęzi „koło chowane" w _try_open (budzi).
  // Koło stojące na stałe nikt nie otwierał, więc czeka na budzące kliknięcie; koło chowanego
  // nie ma na ekranie, dopóki ktoś go nie włączy, więc TO SAMO kliknięcie stawia je i budzi —
  // dwa naciśnięcia na jedno włączenie byłyby podatkiem za to, że rysunku akurat nie widać.
  S.awake = !_whAlwaysOn();
  S.wakeT = Date.now();
  S.held = (mode === "hold");
  if (S.held && host && x != null) {
    S.ox = x - host.clientWidth / 2;
    S.oy = y - host.clientHeight / 2;
  } else { S.ox = 0; S.oy = 0; }
  // W „Przełączaj kliknięciami" koło otwiera się z NICZYM wskazanym, choćby kursor stał nad
  // wycinkiem: wybór chodzi tam wyłącznie klikaniem, a wskazanie wzięte z myszy byłoby wyborem,
  // którego nikt nie zrobił — i po odczekaniu poszłoby w świat.
  S.hover = (S.over && host && host.clientWidth && _whMode() !== "cycle")
    ? _whStageHit(host, whPreviewState(), S.px, S.py) : null;
  _whStageShown(true);
  whStageNote();
}

function whStageClose() {
  const S = state.wheelStage;
  if (!S.open) return;
  S.open = false;
  S.hover = null;
  S.held = false;
  S.awake = false;             // zamknięte koło niczego nie słucha — lustro _close w silniku
  S.ox = 0; S.oy = 0;
  _whStageCdStop();
  // Koło otwarte WYCHYLENIEM zamyka się przy kursorze, który wciąż jest wychylony — więc gdyby
  // próg otwarcia był jedynym warunkiem, następna klatka otworzyłaby je z powrotem i wybór
  // zapętliłby się w nieskończoność. Lustro `_lean_used` z silnika: kolejne otwarcie dopiero po
  // powrocie do środka.
  S.leanUsed = _whLeanMode();
  clearTimeout(_whHoldTimer);
  // Rysunek zwija sama pętla klatek (_whStageShut) — tutaj wystarczy zdjąć klasę, żeby
  // zaproszenie wróciło razem z zanikaniem koła, a nie dopiero po nim.
  _whStageShown(false);
  whStageNote();
}

// USYPIANIE („Przełączaj kliknięciami"). Koło przestaje słuchać, ale ZOSTAJE na scenie: to jest
// stan, w którym rysunek przygasa i mówi w środku „kliknij, żeby włączyć". Lustro _cyc_sleep
// z silnika w jego wariancie `keep=True` — koła, które stoi na stałe, nie ma czego zamykać.
// Dla koła CHOWANEGO usypianiem jest zwykłe zamknięcie (whStageClose), bo tam „nie słucham"
// i „nie ma mnie" to jeden stan.
function _whStageSleep() {
  const S = state.wheelStage;
  S.awake = false;
  S.clicks = 0;
  S.hover = null;
  S.wakeT = 0;
  _whStageCdStop();
  whStageNote();
}

// EDYCJA PRZY ZAMKNIĘTYM KOLE. Zmiana w edytorze ma być WIDOCZNA, więc sama otwiera koło — i
// zostawia je otwarte, bo przy ustawianiu patrzy się na koło, a nie na listę. Wołane z dwóch
// lejków: `commitWheel` (cokolwiek zmieniło konfigurację) i `whFocusRow` (kursor stanął na wierszu).
// Nic nie robi, gdy koło już stoi, gdy sceną steruje kapsel albo gdy karty w ogóle nie widać.
function whStageWake() {
  if (whStageSrc() !== "mouse") return;
  const S = state.wheelStage;
  if (S.open) return;
  const host = document.getElementById("whPreview");
  if (!host || !host.offsetParent) return;
  whStageOpen("click");
}

// ------------------------------------------------------------------------------------------
//  PIĘĆ SPOSOBÓW STEROWANIA — TAKŻE NA SCENIE
// ------------------------------------------------------------------------------------------
// ZGŁOSZENIE WŁAŚCICIELA (2026-08-26): „przechyl i poczekaj jako aktywacja jak testuję myszą to
// nie działa". Miał rację i było to gorsze niż brak podglądu: scena znała DWA gesty (klik otwiera,
// klik wybiera; przytrzymanie stawia koło pod kursorem), czyli dokładnie tryb „Kliknij, pochyl,
// kliknij" — i grała go niezależnie od tego, co było ustawione w sekcji „Sterowanie". Kto ustawił
// „Pochyl i przytrzymaj", dostawał podgląd, w którym nic nie odlicza i nic się nie zatwierdza,
// i uczył się z niego, że tryb jest zepsuty.
//
// TŁUMACZENIE RĘKI NA MYSZ jest jedno-jednoznaczne, bo silnik i tak widzi tylko parę (długość,
// kierunek): pochylenie kapsla = odległość kursora od środka koła. Więc:
//   • pochylenie „mocno"  = kursor za progiem otwarcia (wheelOpenBar, lustro _open_bar z silnika),
//   • wyprostowanie kapsla = powrót kursora do martwej strefy,
//   • przycisk kapsla      = lewy przycisk myszy.
// Reszta (odliczanie, zerowanie zegara przy zmianie celu, „nic nie kliknięto = nic nie idzie")
// jest przepisana z silnika krok w krok.
function _whMode() { return (state.wheel && state.wheel.confirm) || "release"; }
function _whLeanMode() { return WHEEL_MODES_LEAN.indexOf(_whMode()) >= 0; }
function _whWaitMode() { return WHEEL_MODES_WAIT.indexOf(_whMode()) >= 0; }
// KOŁO ZAWSZE WIDOCZNE — lustro RadialMenu._always_on(): tylko tryb klikany i tylko przy
// włączonym przełączniku. Scena musi je znać, bo w tym stanie nie ma czego otwierać ani zamykać;
// koło po prostu stoi, a klik od razu przesuwa wybór.
function _whAlwaysOn() { return _whMode() === "cycle" && (state.wheel || {}).alwaysOn !== false; }

// Jak daleko od środka koła jest kursor, w ułamku promienia — ta sama liczba, którą silnik dostaje
// jako `mag` z pochylenia kapsla. `null`, gdy nie ma czego mierzyć (kursor poza sceną, pudło bez
// wymiaru).
function _whStageMag() {
  const S = state.wheelStage;
  if (!S.over) return null;
  const host = document.getElementById("whPreview");
  if (!host || !host.clientWidth) return null;
  const aim = _whStageAim(host, { look: state.wheel && state.wheel.look });
  return aim ? aim.mag : null;
}

function _whStageCdStop() {
  const S = state.wheelStage;
  S.cd = 0; S.cdT = 0; S.cdKey = "";
}

// OKRĄG-CEL — martwa strefa narysowana przy ZAMKNIĘTYM kole. Widoczny wyłącznie tam, gdzie coś
// znaczy: w trybach otwieranych wychyleniem i tylko przy sterowaniu myszą (kapsel ma własny
// komunikat, patrz _whStageOff). Średnica bierze się z tej samej martwej strefy, którą liczy
// silnik, i z tego samego promienia, którym scena rysuje koło — inaczej pokazywałby cel w innym
// miejscu, niż silnik uzbraja.
//
// DWA STANY, ŻADNEGO OSTRZEŻENIA: przerywany i oddychający = „stań tutaj", akcent = „uzbrojone,
// możesz odsunąć". Handoff nazywa to wprost: okrąg jest celem, nie ostrzeżeniem.
function _whArmRingSync() {
  const el = document.getElementById("whArmRing");
  const op = document.getElementById("whOpenRing");
  if (!el) return;
  const S = state.wheelStage;
  const host = document.getElementById("whPreview");
  const show = !S.open && whStageSrc() === "mouse" && _whLeanMode() && host && host.clientWidth;
  if (el.hidden !== !show) el.hidden = !show;
  if (op && op.hidden !== !show) op.hidden = !show;
  // Scena wie, że stoją na niej okręgi — po tym CSS układa zaproszenie tak, żeby zdania nie leżały
  // w poprzek linii przerywanych.
  const sc0 = document.getElementById("whScene");
  if (sc0) _whCls(sc0, "has-arm", !!show);
  if (!show) return;
  const dz = Math.max(WHEEL_DEAD_MIN, Math.min(WHEEL_DEAD_MAX,
    +(state.wheel && state.wheel.deadzone) || WHEEL_DEAD_DEF));
  const R = _whStageR(host, { look: state.wheel && state.wheel.look });
  const d = Math.round(2 * dz * R);
  // PRÓG OTWARCIA liczony tą samą funkcją, co scena przy otwieraniu (wheelOpenBar = lustro
  // _open_bar z silnika) — inaczej narysowana linia byłaby w innym miejscu niż ta, którą silnik
  // naprawdę sprawdza, a to jest dokładnie ten błąd, dla którego ten okrąg powstał.
  const dOpen = Math.round(2 * wheelOpenBar(dz) * R);
  if (el._d !== d || (op && op._d !== dOpen)) {
    el._d = d;
    el.style.width = d + "px"; el.style.height = d + "px";
    if (op) { op._d = dOpen; op.style.width = dOpen + "px"; op.style.height = dOpen + "px"; }
    // Promienie idą do CSS, bo od nich zależy, gdzie stoją zdania: pierwsze pod celem, drugie pod
    // progiem otwarcia. Martwa strefa chodzi od 10% do 70% promienia, więc żaden stały odstęp nie
    // byłby dobry dla obu końców zakresu.
    const sc = document.getElementById("whScene");
    if (sc) {
      sc.style.setProperty("--wh-arm-r", (d / 2) + "px");
      sc.style.setProperty("--wh-open-r", (dOpen / 2) + "px");
    }
  }
  const armed = !S.leanUsed;
  _whCls(el, "is-armed", armed);
  if (op) {
    _whCls(op, "is-armed", armed);
    // Podpis na progu otwarcia pojawia się DOPIERO po uzbrojeniu, bo dopiero wtedy jest prawdziwy.
    // Przed uzbrojeniem przekroczenie tej linii nic nie robi i napis „przekrocz" byłby kolejną
    // instrukcją, która nie działa.
    const sp = op.firstElementChild;
    if (sp) {
      const t = armed ? _wheelT("przekrocz tę linię", "cross this line") : "";
      if (sp.textContent !== t) sp.textContent = t;
    }
  }
  // …i ta sama wiadomość na scenie, bo od niej zależy barwa napisu W CELU. Jedna klasa zamiast
  // drugiego warunku w CSS-ie: napis i okrąg mówią o tym samym stanie, więc mają zapalać się razem.
  if (sc0) _whCls(sc0, "is-armed-ring", armed);
}

// ZEGAR PIASKOWNICY — jedna klatka odliczania. Wołany z pętli rysowania (whPreviewFrame w rf-46d),
// bo tylko tam jest gwarancja, że tyka nawet wtedy, gdy ręka stoi w miejscu: cała rzecz polega na
// tym, żeby NIC nie robić i patrzeć, jak domyka się pierścień w środku koła.
//
// CO ZERUJE ZEGAR: zmiana wskazanego wycinka (inny cel = inna decyzja), zjazd do martwej strefy
// i każdy klik w trybie „Przełączaj kliknięciami". Dokładnie te trzy rzeczy zerują go w silniku.
function _whStageTick() {
  const S = state.wheelStage;
  const W = state.wheel || {};
  const mode = _whMode();
  // KOŁO ZAWSZE WIDOCZNE: nie ma gestu otwarcia, więc scena też ma go nie wymagać. Stoi od
  // wejścia w zakładkę i zostaje po wyborze — dokładnie tak, jak zachowuje się silnik.
  if (_whAlwaysOn() && whStageSrc() === "mouse") {
    if (!S.open) whStageOpen("click");
  }
  // OTWARCIE WYCHYLENIEM. W trybach bez przycisku koło pojawia się samo, gdy ręka wyjdzie poza
  // próg — na scenie znaczy to „kursor odjechał od środka". Póki poprzednie koło nie zostało
  // odwołane powrotem do środka, próg jest zablokowany (S.leanUsed).
  else if (_whLeanMode() && whStageSrc() === "mouse") {
    const mag = _whStageMag();
    if (mag != null) {
      const dz = +W.deadzone || WHEEL_DEAD_DEF;
      // UZBROJENIE: wyłącznie pobyt w martwej strefie. Zaproszenie mówi wtedy co innego („odsuń
      // kursor" zamiast „stań w okręgu"), więc zmiana progu musi je przerysować — inaczej napis
      // zostaje przy poprzednim stanie i każe zrobić coś, co już nie jest kolejnym krokiem.
      if (mag < dz && S.leanUsed) { S.leanUsed = false; whStageNote(); }
      if (!S.open && !S.leanUsed && mag >= wheelOpenBar(dz)) whStageOpen("lean");
      // WYPROSTOWANIE KAPSLA ZAMYKA KOŁO bez akcji — tak mówi opis trybu w karcie, więc tak ma
      // się zachować podgląd. Bez tego jedynym wyjściem z otwartego koła byłby Esc.
      else if (S.open && mag < dz && mode !== "cycle") {
        whStageClose();
        S.leanUsed = false;
        whToast(_wheelT("Anulowano (podgląd)", "Cancelled (preview)"));
        return;
      }
    }
  }
  if (!S.open || !_whWaitMode()) { _whStageCdStop(); return; }
  // CZEGO dotyczy odliczanie. W „Przełączaj kliknięciami" celem jest LICZNIK kliknięć, nie kursor:
  // po otwarciu ręka może leżeć gdziekolwiek, a wybór i tak przesuwa się klikaniem.
  const cyc = (mode === "cycle");
  // KOŁO KLIKANE, KTÓRE ŚPI ALBO NA KTÓRYM JESZCZE NIC NIE WYBRANO, po prostu stoi — lustro
  // gałęzi 2. i 4. w _tick_cycle. Nie ma czego zatwierdzać, więc łuk się nie rusza; obudzone
  // i zostawione samo sobie zasypia po OPEN_TIMEOUT, i to jest cała cena pomyłkowego kliknięcia.
  if (cyc && (!S.awake || S.clicks <= 0)) {
    _whStageCdStop();
    if (S.awake && (Date.now() - (S.wakeT || 0)) >= WHEEL_OPEN_TIMEOUT_MS) {
      _whStageSleep();
      whToast(_wheelT("Wyłączyło się samo — nikt nic nie wybrał (podgląd)",
        "Switched itself off — nothing was picked (preview)"));
    }
    return;
  }
  const key = cyc ? ("k" + S.clicks)
    : (S.hover ? (S.hover.band + ":" + S.hover.idx) : "");
  if (!cyc && !key) { _whStageCdStop(); return; }        // martwa strefa: nie ma czego liczyć
  // PUSTE POLE NIE ODLICZA — lustro tej samej reguły z silnika (_tick_modern, gałąź „tilt-hold").
  // Ono jest strefą odpoczynku: ręka może na nim stanąć i nic się nie stanie, więc biegnący łuk
  // mówiłby coś dokładnie odwrotnego. Koło zamknie się dopiero powrotem do środka albo klawiszem
  // Esc. W „Przełączaj kliknięciami" zegar biegnie dalej, bo TAM czekanie jest jedynym sposobem
  // zatwierdzenia i to ono zamyka koło (bez wysyłania czegokolwiek — patrz _whStageCommit).
  if (!cyc && _whStageHoverEmpty()) { _whStageCdStop(); return; }
  if (key !== S.cdKey) { S.cdKey = key; S.cdT = Date.now(); S.cd = 0; return; }
  // ILE MA TRWAĆ. Wycinek z podmenu otwiera się po „Czasie otwarcia podmenu", a nie po „Czasie do
  // zatwierdzenia" — to dwie różne obietnice i w silniku mają dwa różne zegary.
  const ms = Math.max(50, _whStageCdMs(cyc));
  S.cd = Math.max(0, Math.min(1, (Date.now() - S.cdT) / ms));
  if (S.cd < 1) return;
  _whStageCdStop();
  if (_whStageCommit() === "close") {
    // Przy „zawsze widocznym" wybór się kończy, a rysunek zostaje — lustro _close(keep=True).
    // I ZASYPIA: silnik po wysyłce otwiera koło od nowa (_open zeruje `_awake`), żeby następne
    // przypadkowe naciśnięcie znów tylko je włączyło.
    if (_whAlwaysOn()) { _whStageSleep(); return; }
    whStageClose(); return;
  }
  // KOŁO ZOSTAŁO (weszliśmy w podmenu albo wróciliśmy o poziom). W „Przełączaj kliknięciami" to
  // jest NOWY wybór, więc licznik kliknięć rusza od zera — lustro `self._clicks = 0` w _enter.
  // Bez tego zegar liczyłby dalej ten sam „k3" i co pół sekundy wchodziłby w podmenu i z niego
  // wracał, bez jednego kliknięcia. Zegar poddania też rusza od nowa: wejście w podmenu jest
  // czynnością, a nie bezczynnością.
  if (cyc) { S.clicks = 0; S.hover = null; S.wakeT = Date.now(); _whStageCdStop(); }
}

// ------------------------------------------------------------------------------------------
//  CZYTNIK EKRANU I KLAWIATURA
// ------------------------------------------------------------------------------------------
// Koło jest rysunkiem, więc samo z siebie nie mówi NIC. Dla kogoś, kto czyta ekran czytnikiem,
// „wskazany wycinek" bez zdania na głos nie istnieje — a to jest ta sama informacja, którą reszta
// ludzi bierze z podświetlenia. Stąd dwa komunikaty i ani jednego więcej: co jest wskazane i co
// zostało wybrane.
//
// „3 z 6" JEST CZĘŚCIĄ ZDANIA, nie ozdobą: koło nie ma początku ani końca, więc bez numeru nie da
// się usłyszeć, czy strzałka objechała już całość.
function whSay(txt) {
  const el = document.getElementById("whSay");
  if (!el) return;
  // Ten sam tekst dwa razy z rzędu bywa przez czytniki pomijany — kropka na końcu wymusza nową
  // treść, a w mowie nie słychać różnicy.
  el.textContent = (el.textContent === txt) ? txt + " " : txt;
}

// Nazwa i pozycja tego, co jest WSKAZANE. Z pakietu podglądu, a nie z listy wycinków: przy otwartym
// podmenu numeruje się bieżącą obręcz, a nie korzeń.
function _whSayHover() {
  const S = state.wheelStage;
  if (!S.open) return;
  if (!S.hover) { whSay(_wheelT("środek koła — nic nie wybrane", "the middle — nothing picked")); return; }
  const st = whPreviewState();
  const bd = (st.bands || [])[S.hover.band] || {};
  const items = bd.items || [];
  const it = items[S.hover.idx];
  if (!it) return;
  const name = it.label || _wheelT("bez nazwy", "unnamed");
  whSay(name + _wheelT(" — ", " — ") + (S.hover.idx + 1) + _wheelT(" z ", " of ") + items.length);
}

// Czy pod wskazaniem stoi PUSTE POLE. Czytane z pakietu podglądu, a nie z listy wycinków, bo
// pakiet jest jedynym miejscem, które wie, co widać na KTÓRYM paśmie — a rodzic z otwartą obręczą
// pustym polem nie jest, choćby sam nie miał akcji.
function _whStageEmptyAt(hv) {
  if (!hv) return false;
  const st = whPreviewState();
  const bd = (st.bands || [])[hv.band] || {};
  const it = (bd.items || [])[hv.idx];
  return !!(it && it.empty);
}
function _whStageHoverEmpty() { return _whStageEmptyAt(state.wheelStage.hover); }

// CZYM SKOŃCZYŁO SIĘ PRAWDZIWE KOŁO (pakiet „end" z silnika, dokładany wyłącznie do pakietu
// zamknięcia). Dziś jedna odpowiedź: puste pole. Scena mówi o tym tak samo, jak o wyborze zrobionym
// myszą — toastem i wpisem w dzienniku — bo z punktu widzenia człowieka to jest ta sama chwila,
// tylko raz zrobiona ręką na kapslu, a raz kursorem.
//
// ZNACZNIK NA PAKIECIE, nie osobny stan sceny: `wheelLive` żyje do następnego pakietu, a po
// zamknięciu koła następnego nie ma — bez tego pętla klatek pokazywałaby ten sam toast w kółko.
function _whStageEnd(live) {
  const end = live && live.end;
  if (!end || live._whEndDone) return;
  live._whEndDone = 1;
  if (end.why !== "empty") return;
  const path = Array.isArray(end.path) ? end.path.filter(x => x !== "") : [];
  whStageLog(path.length ? path : [_wheelT("bez nazwy", "unnamed")], "empty");
  whToast(_wheelT("Nic nie wysłano (puste pole)", "Nothing sent (empty slice)"));
}

// Ile trwa odliczanie dla TEGO celu. Osobna funkcja, bo odpowiedź zależy od tego, co jest pod
// wskazaniem: rodzic z dziećmi otwiera się „Czasem otwarcia podmenu", liść idzie „Czasem do
// zatwierdzenia". Poza tym nie da się na podglądzie ustawić ani jednego, ani drugiego.
function _whStageCdMs(cyc) {
  const W = state.wheel || {};
  const S = state.wheelStage;
  if (!cyc && S.hover) {
    const st = whPreviewState();
    const bd = (st.bands || [])[S.hover.band] || {};
    const it = (bd.items || [])[S.hover.idx];
    if (it && it.sub && S.hover.band === (st.bands.length - 1)) return +W.subOpenMs || 300;
  }
  return +W.confirmMs || 600;
}

// Komunikat „włącz koło" w trybie „Kapslem". BEZ automatycznego włączania: uzbrojenie wyjścia jest
// decyzją, a w symulacji przechodzi przez osobne pytanie (rfSimConfirmOn) — przycisk pokazuje więc
// przełącznik, zamiast go przestawiać.
//
// W SYMULACJI NIE MA CZEGO PRZYTRZYMAĆ. Zdanie „przytrzymaj przycisk kapsla" jest prawdziwe tylko
// przy kapslu na Bluetooth. W trybie testowym kapsel prowadzi się myszą (sterowanie ręczne), a jego
// przycisk ma tam własne guziki — i o tym scena dotąd milczała, więc kazała zrobić coś, czego w
// symulacji zrobić się nie da, i na tym kończyła rozmowę. Trzy różne braki, trzy różne zdania:
// koło wyłączone · nikt nie trzyma kapsla · ręka już go trzyma.
function _whStageOff(show) {
  const el = document.getElementById("whSceneOff");
  if (!el) return;
  if (el.hidden !== !show) el.hidden = !show;
  if (!show) return;
  const on = !!(state.wheel && state.wheel.enabled);
  const sim = (typeof vpSimMode === "function") && vpSimMode();
  const hand = sim && (typeof VPUCK !== "undefined") && VPUCK.on;
  const tx = document.getElementById("whSceneOffTx");
  if (tx) {
    tx.textContent = !on
      ? _wheelT("Włącz koło, żeby zobaczyć podgląd z kapsla.",
        "Switch the wheel on to see the preview from the capsule.")
      : !sim
        ? _wheelT("Koło jest włączone. Przytrzymaj przycisk kapsla i pochyl go, a koło pojawi się tutaj.",
          "The wheel is on. Hold the capsule button and lean it, and the wheel will appear here.")
        : hand
          ? _wheelT("Koło jest włączone. W sterowaniu ręcznym pochyl kulę, przytrzymaj „Przycisk kapsla” i puść. Tryby klikane obsłuż guzikiem „Kliknij”.",
            "The wheel is on. In manual control lean the sphere, hold “Capsule button” and let go. For the click modes use the “Tap” button.")
          : _wheelT("Koło jest włączone, ale symulacja rusza kapslem sama i nikt nie trzyma przycisku. Przejmij kapsel, a dostaniesz guziki „Przycisk kapsla” i „Kliknij”.",
            "The wheel is on, but the simulation moves the capsule on its own and nobody is holding the button. Take the capsule over and you get the “Capsule button” and “Tap” buttons.");
  }
  const bt = document.getElementById("whSceneOffBtn");
  if (bt) {
    // Przycisk robi to, czego BRAKUJE, a nie zawsze to samo: włącz koło albo przejmij kapsel.
    // Gdy ręka już trzyma kapsel, nie ma czego proponować i przycisk znika.
    const need = !on ? "toggle" : (sim && !hand ? "hand" : "");
    bt.dataset.need = need;
    bt.hidden = !need;
    bt.textContent = (need === "hand")
      ? _wheelT("Steruj ręcznie", "Take control")
      : _wheelT("Pokaż przełącznik On", "Show the On switch");
  }
}

// ------------------------------------------------------------------------------------------
//  SANDBOX — co się dzieje po kliknięciu
// ------------------------------------------------------------------------------------------
// Trzy odpowiedzi i ani jednej więcej: środek cofa poziom, wycinek z dziećmi otwiera podmenu,
// liść „wybiera się" — czyli ląduje w dzienniku i zaznacza swój wiersz w edytorze.
//
// ZWRACA „close" albo „stay": czy po tym wyborze koło ma zniknąć. Zamyka je WYBÓR LIŚCIA
// i ANULOWANIE — czyli te dwie rzeczy, które kończą gest także na prawdziwym kapslu. Wejście
// w podmenu i cofnięcie o poziom to droga W ŚRODKU gestu, więc koło zostaje.
function _whStageCommit() {
  const S = state.wheelStage;
  const st = whPreviewState();
  const hv = S.hover;
  if (!hv) {                                   // środek koła
    const p = state.wheelPath || [];
    if (p.length) {
      state.wheelPath = p.slice(0, -1);
      state.wheelFocus = -1;
      state.wheelSeqRow = -1;
      whRenderSlices(); whSync();
      return "stay";
    }
    whToast(_wheelT("Anulowano (podgląd)", "Cancelled (preview)"));
    return "close";
  }
  const bd = (st.bands || [])[hv.band] || {};
  const it = (bd.items || [])[hv.idx];
  if (!it) return "stay";
  const lv = whLevels();
  const deepest = st.bands.length - 1;
  // Kliknięcie w pasmo RODZICÓW (przy „Łuku" i „Pełnej obręczy" widać kilka naraz) cofa do jego
  // poziomu — inaczej jedyną drogą w górę byłby środek, a to nie jest to, co widzi ręka.
  if (hv.band < deepest) {
    const back = (state.wheelPath || []).length - (deepest - hv.band);
    state.wheelPath = (state.wheelPath || []).slice(0, Math.max(0, back));
    state.wheelFocus = -1;
    state.wheelSeqRow = -1;
    whRenderSlices(); whSync();
    return "stay";
  }
  const src = lv[lv.length - 1][hv.idx];
  if (src && Array.isArray(src.children) && src.children.length) {
    state.wheelPath = (state.wheelPath || []).concat([hv.idx]);
    state.wheelFocus = -1;
    state.wheelSeqRow = -1;
    S.hover = null;
    whRenderSlices(); whSync();
    return "stay";
  }
  whFocusRow(hv.idx);
  // PUSTE POLE kończy gest tak samo jak każdy inny liść — koło zwija się swoją zwykłą animacją —
  // ale mówi co innego, bo stało się co innego: nic nie poszło. To jest cała obietnica tego pola
  // i człowiek ma prawo dostać ją na ekranie, a nie domyślać się z braku efektu.
  if (it.empty) {
    whStageLog(whCrumbLabels().concat([it.label || _wheelT("bez nazwy", "unnamed")]), "empty");
    whToast(_wheelT("Nic nie wysłano (puste pole)", "Nothing sent (empty slice)"));
    whSay(_wheelT("Puste pole — nic nie wysłano", "An empty slice — nothing sent"));
    return "close";
  }
  whStageLog(whCrumbLabels().concat([it.label || _wheelT("bez nazwy", "unnamed")]));
  whToast(_wheelT("Podgląd: ", "Preview: ") + (it.label || _wheelT("bez nazwy", "unnamed")));
  whSay(_wheelT("Wybrano: ", "Picked: ") + (it.label || _wheelT("bez nazwy", "unnamed")));
  return "close";
}

// JEDEN KLIK W „PRZEŁĄCZAJ KLIKNIĘCIAMI". Na uśpionym kole BUDZI i nic poza tym (lustro _wake
// w silniku), a na obudzonym przesuwa wybór po BIEŻĄCEJ obręczy i wraca na początek — lustro
// `self.idx = 0 if self.idx < 0 else (self.idx + 1) % n`. Zegar rusza od nowa przy każdym
// kliknięciu, bo klik jest zboczem: człowiek, który jeszcze przebiera po wycinkach, nie chce,
// żeby wybór poszedł mu spod palca.
function _whStageStep() {
  const S = state.wheelStage;
  if (!S.awake) {
    S.awake = true;
    S.clicks = 0;
    S.hover = null;
    S.wakeT = Date.now();
    _whStageCdStop();
    whStageNote();
    whSay(_wheelT("Koło włączone — klikaj, żeby wybierać",
      "The wheel is on — click to choose"));
    return;
  }
  const st = whPreviewState();
  const last = Math.max(0, (st.bands || []).length - 1);
  const n = Math.max(1, (((st.bands || [])[last] || {}).items || []).length);
  const cur = (S.hover && S.hover.band === last) ? S.hover.idx : -1;
  S.hover = { band: last, idx: (cur < 0) ? 0 : ((cur + 1) % n) };
  S.clicks++;
  // …i odsuwa moment poddania, tak samo jak w silniku: zegar mierzy BEZCZYNNOŚĆ, a nie długość
  // całej rozmowy.
  S.wakeT = Date.now();
  _whStageCdStop();
  _whSayHover();
}

// PRZYTRZYMANIE W „PRZEŁĄCZAJ KLIKNIĘCIAMI" — jedyne wyjście z tego koła. Nad uśpionym nie ma
// czego wyłączać i wtedy przepada, dokładnie jak w silniku (gałąź 1. w _tick_cycle).
function _whStageCycHold() {
  const S = state.wheelStage;
  if (!S.awake) return false;
  if (_whAlwaysOn()) _whStageSleep();
  else whStageClose();
  whToast(_wheelT("Wyłączono bez wyboru (podgląd)", "Switched off with nothing picked (preview)"));
  whSay(_wheelT("Koło wyłączone — nic nie wysłano", "The wheel is off — nothing was sent"));
  return true;
}

// KOŁA JESZCZE NIE MA — poniżej dwóch wycinków scena nie ma czego narysować (audyt UX #32).
// Do 2026-09-02 stała wtedy jako pusty prostokąt wysokości okna, zapraszała „Kliknij, żeby
// otworzyć koło" (kliknięcie nic nie robiło) i podawała pod spodem średnicę koła, którego nie ma.
// Klasa na karcie zdejmuje jej wymuszoną wysokość (17-wheel.css), a zaproszenie zamienia się
// w jedno zdanie mówiące, czego brakuje.
function _whStageBare() {
  const sl = (typeof state !== "undefined" && state.wheel && state.wheel.slices) || [];
  const min = (typeof WHEEL_MIN_SLICES !== "undefined") ? WHEEL_MIN_SLICES : 2;
  return sl.length < min;
}

// Zdanie pod sceną: co to za rysunek i czego się po nim nie należy spodziewać.
function whStageNote() {
  const n = document.getElementById("whSceneNote");
  const puck = (whStageSrc() === "puck");
  const bare = _whStageBare();
  const card = document.getElementById("wheelCard");
  if (card) card.classList.toggle("wh-bare", bare);
  if (bare) {
    // JEDNO ZDANIE ZAMIAST TRZECH NIEPRAWD. Podpowiedź nad sceną i podpis pod nią milkną: obie
    // opisywały koło, a koła tu nie ma.
    const pr = document.getElementById("whScenePrompt");
    if (pr) {
      const b = pr.querySelector("b"), sp = pr.querySelector("span");
      if (b) b.textContent = _wheelT("Dodaj co najmniej dwa wycinki, a koło pojawi się tutaj.",
        "Add at least two slices and the wheel will appear here.");
      if (sp) sp.textContent = "";
    }
    const h = document.getElementById("whSceneHint");
    if (h) h.textContent = "";
    if (n) n.textContent = "";
    _whArmRingSync();
    return;
  }
  if (n) {
    let t = puck
      ? _wheelT("Podgląd z kapsla: to samo koło, które zobaczysz w nakładce, tylko duże. Mysz tu nic nie zmienia — steruje kapsel.",
        "The preview from the capsule: the very wheel the overlay shows, only big. The mouse changes nothing here — the capsule steers.")
      : _wheelT("Podgląd: klikaj śmiało, nic stąd nie idzie do gry.",
        "A preview: click away, nothing here reaches the game.");
    // WIELKOŚĆ W GRZE. Scena rysuje koło w skali umownej (patrz whStageFill), więc na pytanie
    // „ile ono naprawdę ma" nie odpowiada sama z siebie — a to pytanie ktoś zadaje przy każdym
    // ruchu suwaka. Odpowiedź jest więc w podpisie: liczba stąd, kształt ze sceny. Poprzednie
    // zdanie („Podgląd pomniejszony…") ostrzegało przed czymś, co teraz jest regułą, a nie
    // wypadkiem.
    const want = Math.round(wheelLook(state.wheel && state.wheel.look).size);
    t += " " + _wheelT(
      "W grze koło ma " + want + " px średnicy; tutaj jest dopasowane do wielkości sceny.",
      "In the game the wheel is " + want + " px across; here it is scaled to fit the stage.");
    n.textContent = t;
  }
  const open = !!state.wheelStage.open;
  const h = document.getElementById("whSceneHint");
  if (h) {
    // Podpowiedź NAD sceną mówi, co zrobić TERAZ — a więc co innego przy kole stojącym, a co
    // innego przy zamkniętym. Przy zamkniętym milknie, bo to samo mówi zaproszenie na środku,
    // a dwa napisy o tym samym to jeden za dużo.
    // W symulacji ta sama podpowiedź musi nazywać guziki, bo kapsla do przytrzymania nie ma —
    // i musi mówić TO SAMO, co komunikat na środku sceny (_whStageOff), inaczej dwa napisy nad
    // jednym rysunkiem każą zrobić dwie różne rzeczy.
    const sim = (typeof vpSimMode === "function") && vpSimMode();
    const hand = sim && (typeof VPUCK !== "undefined") && VPUCK.on;
    h.textContent = puck
      ? (!sim
        ? _wheelT("Trzymaj przycisk kapsla i pochylaj — koło pokaże się tak, jak w grze.",
          "Hold the capsule button and lean it — the wheel shows exactly as it does in the game.")
        : hand
          ? _wheelT("Pochyl kulę w sterowaniu ręcznym, przytrzymaj „Przycisk kapsla” i puść. Tryby klikane obsłuż guzikiem „Kliknij”.",
            "Lean the sphere in manual control, hold “Capsule button” and let go. For the click modes use the “Tap” button.")
          : _wheelT("Kapslem rusza teraz animacja symulacji. Przejmij go („Steruj ręcznie”), żeby samemu pochylać i naciskać przycisk.",
            "The simulation's animation is moving the capsule. Take it over (“Take control”) to lean it and press its button yourself."))
      : (open ? _whStageHintOpen() : "");
  }
  // ZAPROSZENIE na środku zamkniętej sceny. MÓWI TO, CO ROBI USTAWIONY TRYB — inaczej scena kazała
  // klikać w trybach, w których koło otwiera się wychyleniem, i pierwsze, czego uczyła, było
  // nieprawdą.
  const pr = document.getElementById("whScenePrompt");
  if (pr) {
    const b = pr.querySelector("b"), sp = pr.querySelector("span");
    const lean = !puck && _whLeanMode();
    // DWA ZDANIA DLA DWÓCH STANÓW PROGU. Dopóki koło jest rozbrojone, „odsuń kursor" jest
    // instrukcją, która NIE ZADZIAŁA — a napis każący zrobić coś bezskutecznego uczy, że podgląd
    // jest zepsuty. Najpierw więc cel („stań w środku"), a dopiero po uzbrojeniu — gest.
    const armed = !state.wheelStage.leanUsed;
    // Napis W ŚRODKU okręgu musi być KRÓTKI — dłuższy rozciąga się w poprzek linii przerywanej
    // i zamazuje to, co ten okrąg pokazuje. Całe zdanie stoi pod nim (`span`).
    const cyc = !puck && _whMode() === "cycle";
    if (b) b.textContent = cyc
      ? _wheelT("Kliknij, żeby włączyć koło", "Click to switch the wheel on")
      : !lean
        ? _wheelT("Kliknij, żeby otworzyć koło", "Click to open the wheel")
        : armed
          ? _wheelT("Teraz odsuń kursor", "Now move away")
          : _wheelT("Umieść kursor tutaj", "Put the pointer here");
    if (sp) sp.textContent = cyc
      // ⚠️ W TYM TRYBIE PRZYTRZYMANIE ROBI COŚ INNEGO NIŻ WSZĘDZIE INDZIEJ (wyłącza koło zamiast
      // stawiać je pod kursorem), więc zdanie o przenoszeniu byłoby tu instrukcją do cudzego trybu.
      ? _wheelT("kolejne kliknięcia przechodzą po wycinkach, a przytrzymanie wyłącza koło",
        "further clicks step through the slices, and holding switches the wheel off")
      : !lean
      ? _wheelT("albo przytrzymaj lewy przycisk, żeby stanęło pod kursorem",
        "or hold the left button to bring it under the pointer")
      // ⚠️ ZDANIE MUSI ZGADZAĆ SIĘ Z GEOMETRIĄ. Pierwsza wersja mówiła „odsunięcie otwiera koło"
      // przy okręgu narysowanym na martwej strefie — a otwarcie następuje 2,1× dalej, przy progu
      // otwarcia. Teraz każde z dwóch zdań nazywa SWÓJ okrąg.
      : armed
        ? _wheelT("powrót do środka zamyka; to samo robi wyprostowanie kapsla",
          "coming back to the middle closes it; straightening the capsule does the same")
        : _wheelT("stąd wychylenie zaczyna coś znaczyć — koło otwiera dopiero wyjazd poza zewnętrzny okrąg",
          "from here a lean starts to mean something — the wheel opens only once you pass the outer circle");
  }
  _whArmRingSync();
}

// CO ZROBIĆ Z KOŁEM, KTÓRE JUŻ STOI — zdanie inne dla każdego sposobu sterowania. Piaskownica gra
// ustawiony tryb (patrz _whStageTick), więc jedna podpowiedź „kliknij wycinek" byłaby instrukcją
// do trybu, którego akurat nie ma.
function _whStageHintOpen() {
  const m = _whMode();
  if (m === "tilt-hold") return _wheelT(
    "Wskaż wycinek i NIE RUSZAJ — pierścień w środku domyka się do końca i wybór idzie sam. Zjazd do środka anuluje.",
    "Point at a slice and HOLD STILL — the ring in the middle closes and the choice goes out by itself. Coming back to the middle cancels.");
  if (m === "cycle") {
    // TRZY ZDANIA W TRZECH STANACH, bo w tym trybie to samo naciśnięcie znaczy co innego w każdym
    // z nich. Jedno zdanie o wszystkich trzech naraz byłoby instrukcją do przeczytania, a nie
    // podpowiedzią do wykonania.
    if (!state.wheelStage.awake) return _wheelT(
      "Koło jest wyłączone — stoi przygaszone i czeka. Kliknij raz, żeby je włączyć; dopiero następne kliknięcia będą wybierać.",
      "The wheel is off — it stands there dimmed, waiting. Click once to switch it on; only the clicks after that choose anything.");
    return _wheelT(
      "Klikaj, żeby przechodzić po wycinkach, a po ostatnim kliknięciu odczekaj, aż domknie się pierścień w środku. Przytrzymanie przycisku wyłącza koło i nic nie wysyła.",
      "Click to step from slice to slice, then after the last click wait for the ring in the middle to close. Holding the button switches the wheel off and sends nothing.");
  }
  if (m === "tilt-click") return _wheelT(
    "Wskaż wycinek kursorem i kliknij, żeby go wybrać. Zjazd do środka zamyka koło.",
    "Point at a slice and click to pick it. Coming back to the middle closes the wheel.");
  return _wheelT("Kliknij wycinek, żeby go wybrać. Środek cofa, Esc zamyka koło.",
    "Click a slice to pick it. The middle goes back, Escape closes the wheel.");
}

function whStageRelang() { whStageLogPaint(); whStageNote(); _whStageOff(!document.getElementById("whSceneOff").hidden); }

// Konfiguracja przyszła od nowa (inny kapsel, import, zestaw) — dziennik poprzedniego koła nie ma
// już do czego się odnosić, a wskazanie wskazywałoby wycinek, którego nie ma.
function whStageReset() {
  const S = state.wheelStage;
  S.open = false;
  S.hover = null; S.held = false; S.down = 0; S.ox = 0; S.oy = 0; S.log.length = 0;
  S.clicks = -1; S.leanUsed = true;      // nowa konfiguracja = próg od nowa (rf-46d)
  S.awake = false; S.wakeT = 0; S.cycOff = false;
  _whStageCdStop();
  const host = document.getElementById("whPreview");
  // Bez animacji: to nie jest zamknięcie koła, tylko podmiana całej konfiguracji pod nim.
  if (host) { if (typeof whCancelClose === "function") whCancelClose(host); host.innerHTML = ""; host._wh = null; }
  _whStageShown(false);
  whStageLogPaint(); whStageNote();
}

// ------------------------------------------------------------------------------------------
//  START
// ------------------------------------------------------------------------------------------
function whInitStage() {
  const sc = document.getElementById("whScene");
  const host = document.getElementById("whPreview");
  if (!sc || !host) return;
  const S = state.wheelStage;
  const pt = (e) => {
    const r = host.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const hit = (x, y) => {
    if (!host.clientWidth) return null;
    return _whStageHit(host, whPreviewState(), x, y);
  };
  // W trybie „Kapslem" mysz niczym nie steruje: steruje ręka trzymająca kapsel, a drugi wskaźnik
  // na tym samym kole byłby dwiema odpowiedziami na pytanie „co jest wskazane".
  const mouseOn = () => whStageSrc() === "mouse";
  sc.addEventListener("mousemove", (e) => {
    if (!mouseOn()) return;
    const p = pt(e);
    S.px = p[0]; S.py = p[1]; S.over = true;
    // Zamknięte koło nie ma czego wskazywać — a wskazanie policzone „na zapas" ustawiłoby przy
    // otwarciu wycinek, po którym ręka przejechała kiedyś, zanim koło w ogóle stanęło.
    // W „Przełączaj kliknięciami" ruch myszy nie zmienia wyboru NIGDY: tam wybór chodzi
    // klikaniem, a druga odpowiedź na to samo pytanie byłaby dokładnie tym, przed czym ten tryb
    // ma chronić (ręka, która nie musi celować).
    if (_whMode() === "cycle") return;
    const was = S.hover;
    S.hover = S.open ? hit(p[0], p[1]) : null;
    // Zmiana wskazania idzie na głos — dla czytnika ekranu to jedyna informacja o tym, gdzie
    // stoi ręka. Tylko przy ZMIANIE: co klatkę byłby szum zamiast zdania.
    if (S.open && (!was || !S.hover || was.band !== S.hover.band || was.idx !== S.hover.idx)) {
      _whSayHover();
    }
  });
  sc.addEventListener("mouseleave", () => {
    S.over = false; S.hover = null; S.held = false; S.down = 0;
    // WYJŚCIE POZA SCENĘ ROZBRAJA. Kursor, który wróci, wróci gdziekolwiek — najczęściej przy
    // krawędzi, czyli od razu poza progiem otwarcia. Bez tego jeden ruch myszy przez scenę
    // otwierał koło z trafionym wycinkiem i po chwili sam go wybierał. Ten sam warunek, co w
    // silniku: uzbraja WYŁĄCZNIE pobyt w martwej strefie, nie samo pojawienie się ręki.
    S.leanUsed = true;
    _whStageCdStop();
    clearTimeout(_whHoldTimer);
    _whArmRingSync();
  });
  sc.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || !mouseOn()) return;
    if (e.target.closest("button")) return;      // przyciski sceny są przyciskami, nie kołem
    e.preventDefault();
    const p = pt(e);
    S.px = p[0]; S.py = p[1]; S.over = true;
    S.down = Date.now();
    S.cycOff = false;
    // Ta sama zasada, co przy ruchu myszy: w „Przełączaj kliknięciami" kursor NIE wskazuje.
    // Bez tego naciśnięcie przycisku ustawiałoby wskazanie z miejsca, w którym akurat leży ręka,
    // i klik przesuwałby wybór z niego — czyli wybór chodziłby po kole razem z myszą.
    if (_whMode() !== "cycle") S.hover = S.open ? hit(p[0], p[1]) : null;
    clearTimeout(_whHoldTimer);
    // PRZYTRZYMANIE W TRYBIE KLIKANYM WYŁĄCZA KOŁO — i mierzy się CZASEM Z USTAWIEŃ („Przytrzymanie
    // wyłącza koło"), a nie stałą sceny: to jest ta jedna liczba, którą ten suwak w tym trybie
    // ustawia, więc podgląd, który by jej nie czytał, nie pokazywałby jej skutku.
    if (_whMode() === "cycle") {
      const hm = Math.max(150, +((state.wheel || {}).holdMs) || 300);
      _whHoldTimer = setTimeout(() => {
        if (!S.down) return;
        if (_whStageCycHold()) S.cycOff = true;   // puszczenie po tym nie ma już nic do powiedzenia
      }, hm);
      return;
    }
    // TRZYMANIE. Dopiero po chwili koło przeskakuje pod kursor: zwykłe kliknięcie ma po prostu
    // wybrać, a rysunek skaczący pod każdy klik byłby celem uciekającym spod ręki.
    //
    // TYLKO W TRYBACH Z PRZYCISKIEM. W „Pochyl i przytrzymaj" oraz „Pochyl i kliknij" koło otwiera
    // samo WYCHYLENIE, a przycisk zatwierdza — przenoszenie rysunku pod kursor byłoby wtedy
    // trzecim znaczeniem tego samego naciśnięcia.
    if (_whLeanMode()) return;
    _whHoldTimer = setTimeout(() => {
      if (!S.down) return;
      // Przy ZAMKNIĘTYM kole to samo przytrzymanie je OTWIERA, i od razu pod kursorem — dokładnie
      // tak, jak robi prawdziwe koło przy kursorze, gdy wciśnie się przycisk kapsla.
      if (!S.open) { whStageOpen("hold", S.px, S.py); return; }
      S.held = true;
      S.ox = S.px - host.clientWidth / 2;
      S.oy = S.py - host.clientHeight / 2;
      S.hover = hit(S.px, S.py);
    }, WH_STAGE_HOLD_MS);
  });
  // Puszczenie łapiemy na oknie, nie na scenie: gest zaczęty na kole, a skończony nad kolumną
  // edycji, zostawiłby scenę w stanie „trzymam" bez wciśniętego przycisku.
  window.addEventListener("mouseup", (e) => {
    if (e.button !== 0 || !S.down) return;
    clearTimeout(_whHoldTimer);
    S.down = 0;
    S.held = false;
    S.ox = 0; S.oy = 0;
    if (!mouseOn()) return;
    const mode = _whMode();
    // CO ZNACZY KLIK, ZALEŻY OD TRYBU — i to jest cała naprawa zgłoszenia „przechyl i poczekaj
    // nie działa". Trzy różne odpowiedzi, każda przepisana z gałęzi silnika o tej samej nazwie.
    if (_whLeanMode()) {
      if (!S.open) {
        // W tych trybach przycisk NIE OTWIERA koła. Zamiast nie zrobić nic (co uczy, że podgląd
        // jest zepsuty), scena mówi, czym się je otwiera.
        if (S.over) whToast(_wheelT("Ten tryb otwiera koło wychyleniem — odsuń kursor od środka.",
          "This mode opens the wheel by leaning — move the pointer away from the middle."));
        return;
      }
      if (!S.over) return;
      if (mode === "tilt-hold") {                         // tu przycisku nie ma w ogóle
        whToast(_wheelT("W tym trybie nie klikasz — poczekaj, aż domknie się pierścień w środku.",
          "There is no clicking in this mode — wait for the ring in the middle to close."));
        return;
      }
      // „Pochyl i kliknij": wskazane pochyleniem, zatwierdzone przyciskiem.
      S.hover = hit(S.px, S.py);
      if (_whStageCommit() === "close") whStageClose();
      return;
    }
    // PRZEŁĄCZAJ KLIKNIĘCIAMI: to samo naciśnięcie znaczy trzy rzeczy, a przytrzymanie zabrało już
    // swoje wyżej. Zostają dwie: klik na uśpionym kole WŁĄCZA je (stawiając, jeśli go nie widać),
    // a na obudzonym przesuwa wybór o jeden.
    if (mode === "cycle") {
      if (S.cycOff) { S.cycOff = false; return; }   // to naciśnięcie już wyłączyło koło
      if (!S.over) return;
      if (!S.open) {
        whStageOpen("click");
        whSay(_wheelT("Koło włączone — klikaj, żeby wybierać", "The wheel is on — click to choose"));
        return;
      }
      _whStageStep();
      return;
    }
    // KOŁO ZAMKNIĘTE: krótki klik JE OTWIERA i na tym ten gest się kończy — wybiera dopiero
    // następne kliknięcie. Otwieranie i wybieranie jednym ruchem to gest trzymany, a ten ma
    // własną drogę (przytrzymanie wyżej).
    if (!S.open) { if (S.over) whStageOpen("click"); return; }
    if (S.over) {
      S.hover = hit(S.px, S.py);
      if (_whStageCommit() === "close") whStageClose();
    } else {
      // Puszczenie POZA sceną kończy gest tak samo, jak puszczenie w martwej strefie: anuluje.
      // Inaczej koło zostawałoby otwarte po ruchu, którego nikt nie dokończył nad nim.
      whToast(_wheelT("Anulowano (podgląd)", "Cancelled (preview)"));
      whStageClose();
    }
  });
  // ------------------------------------------------------------------------------------------
  //  KLAWIATURA NA SCENIE
  // ------------------------------------------------------------------------------------------
  // ŚCIEŻKA BEZ MYSZY I BEZ PRZYTRZYMYWANIA. Strzałki przechodzą po wycinkach BIEŻĄCEJ obręczy,
  // Enter/Spacja wybiera OD RAZU. To drugie jest decyzją, nie skrótem: wymuszony hold jest barierą
  // przy drżeniu i słabym chwycie, a koło wyboru budujemy między innymi dla takich rąk. Kto ma
  // dojść do wycinka klawiszem, ma go też móc wybrać klawiszem — bez wytrzymywania niczego.
  //
  // Klawisze idą TYLKO wtedy, gdy scena ma ognisko (nasłuch na niej, nie na dokumencie): to samo
  // wciśnięcie Enter gdzie indziej w zakładce należy do przycisku, na którym ktoś stoi.
  sc.addEventListener("keydown", (e) => {
    if (!mouseOn()) return;                       // podglądem steruje kapsel — klawisze milczą
    if (e.target.closest("button, input, select, textarea")) return;
    const k = e.key;
    const fwd = (k === "ArrowRight" || k === "ArrowDown");
    const back = (k === "ArrowLeft" || k === "ArrowUp");
    const pick = (k === "Enter" || k === " " || k === "Spacebar");
    if (!fwd && !back && !pick) return;
    e.preventDefault();
    // ZAMKNIĘTE KOŁO: pierwszy klawisz JE OTWIERA i na tym kończy — tak samo, jak pierwsze
    // kliknięcie. Inaczej Enter na zamkniętej scenie wybierałby wycinek, którego nikt nie widział.
    if (!S.open) { whStageOpen("click"); _whSayHover(); return; }
    // …a UŚPIONE koło klikane najpierw się WŁĄCZA, i też na tym kończy. Ta sama zasada, co przy
    // myszy: strzałka nad kołem, które nie słucha, ustawiałaby wybór, którego nikt nie zatwierdzi.
    if (_whMode() === "cycle" && !S.awake) { _whStageStep(); return; }
    const st = whPreviewState();
    const last = Math.max(0, (st.bands || []).length - 1);
    const items = (((st.bands || [])[last] || {}).items) || [];
    const n = items.length;
    if (!n) return;
    if (pick) {
      if (_whStageCommit() === "close") {
        // Po wysyłce koło stojące na stałe ZASYPIA (lustro _open po _close(keep=True)), a chowane
        // po prostu znika. Wejście w podmenu („stay") kończy się inaczej: koło żyje dalej.
        if (_whAlwaysOn()) _whStageSleep(); else whStageClose();
      } else if (_whMode() === "cycle") {
        S.clicks = 0; S.hover = null; S.wakeT = Date.now(); _whStageCdStop();
      }
      return;
    }
    const cur = (S.hover && S.hover.band === last) ? S.hover.idx : -1;
    const nx = fwd ? (cur < 0 ? 0 : (cur + 1) % n) : (cur < 0 ? n - 1 : (cur - 1 + n) % n);
    S.hover = { band: last, idx: nx };
    // Zegar rusza od nowa, tak jak przy kliknięciu w „Przełączaj kliknięciami": ręka, która jeszcze
    // przebiera po wycinkach, nie chce, żeby wybór poszedł jej spod palca.
    S.clicks = Math.max(S.clicks, 0) + 1;
    S.wakeT = Date.now();
    _whStageCdStop();
    _whSayHover();
  });

  const srcSeg = document.getElementById("whSrcSeg");
  if (srcSeg) srcSeg.onclick = (e) => {
    const t = e.target.closest("button[data-v]"); if (!t) return;
    whSetStageSrc(t.dataset.v);
  };
  const offBtn = document.getElementById("whSceneOffBtn");
  if (offBtn) offBtn.onclick = () => {
    // PRZEJĘCIE KAPSLA TO ZMIANA ŹRÓDŁA RUCHU, nie uzbrojenie wyjścia: po nim nic nowego nie
    // wychodzi do systemu (te same grupy, te same przełączniki), zmienia się tylko to, czy kapslem
    // rusza fala symulacji, czy ręka. Dlatego to jedno wolno zrobić przyciskiem od razu.
    if (offBtn.dataset.need === "hand") {
      if (typeof vpStart === "function") vpStart();
      return;
    }
    // Pokazujemy przełącznik, a NIE przestawiamy go: uzbrojenie wyjścia jest decyzją człowieka
    // i w symulacji ma własne pytanie (rfSimConfirmOn), którego przycisk podglądu nie ma prawa ominąć.
    const t = document.getElementById("wheelEnable");
    if (!t) return;
    try { t.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) { t.scrollIntoView(); }
    t.classList.add("wh-poke");
    setTimeout(() => t.classList.remove("wh-poke"), 1600);
  };
  const z = document.getElementById("whZoom");
  if (z) z.onclick = () => whSetStageMode(whStageMode() === "zoom" ? "wide" : "zoom", true);
  const mi = document.getElementById("whMini");
  if (mi) mi.onclick = () => whSetStageMode("mini", true);
  const tab = document.getElementById("whStageTab");
  if (tab) tab.onclick = () => whSetStageMode("wide", true);
  // Esc zdejmuje NAJWYŻSZĄ warstwę: najpierw stojące koło, dopiero potem powiększenie sceny.
  // Ten sam odruch, co przy każdym innym nałożonym oknie w aplikacji — i ta sama kolejność, co
  // w prototypie, gdzie Esc jest jedynym wyjściem z koła bez wybierania czegokolwiek.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const card = document.getElementById("wheelCard");
    if (!card || !card.offsetParent) return;
    if (state.wheelStage.open && whStageSrc() === "mouse") {
      whStageClose();
      whToast(_wheelT("Zamknięto (podgląd)", "Closed (preview)"));
      return;
    }
    if (whStageMode() !== "zoom") return;
    whSetStageMode("wide");
  });
  // Trzy układy sceny (pół karty / cała karta / zwinięta) zmieniają jej bok skokiem, a zmiana okna
  // przeglądarki płynnie. Koło ma iść za tym w tej samej klatce — patrz whWatchBox w rf-46.
  whWatchBox(host, () => { if (host.offsetParent) whPreviewFrame(); });
  // GDZIE ZATRZYMUJE SIĘ LEPKA SCENA — już nie liczone tutaj. Do 14.09 stał tu własny pomiar
  // (`whStageTopSync`) paska zakładek aplikacji, a po przebudowie na trzy kolumny (2026-08-29) tego
  // paska nie ma: pomiar spadał na sam nagłówek i scena parkowała 67 px ZA WYSOKO, czyli pod
  // paskiem modułu. Wysokość wszystkich trzech przyklejonych pasków niesie teraz jedna zmienna
  // dla całej aplikacji — `--rf-sticky-top` (22-modtabs.css, mierzy rf-40), a scena czyta ją
  // wprost w arkuszu (`--wh-top` w 03-triggers.css). Nie ma tu czego obserwować.
  whSetStageMode(whStageMode());
  whSetStageSrc(whStageSrc());
  whStageLogPaint();
  whStageNote();
}
