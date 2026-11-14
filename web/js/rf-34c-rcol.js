"use strict";
// ==================================================================================================
// PRAWA KOLUMNA — MAŁY PODGLĄD NA ŻYWO (kula 3D, jedno zdanie stanu, pas naciśnięć)
//
// Kolumna odpowiada kątem oka na „czy kapsel żyje”, a nie „ile LSB”. Do 2026-08-29 stały tu cztery
// pełne karty podglądu (nieczytelne w 274 px), potem miniatura z kulą, dwoma przebiegami kanałów
// i filtrem 3D. UX 261120 L23 („mniej naraz”) zostawia MAŁĄ kulę (ok. 140 px) ze zdaniem stanu
// i pas naciśnięć: wykresy kanałów 0–2, 3–5 i filtra żyją wyłącznie w Czujniku (duże karty, ta
// sama oś czasu), dokąd prowadzi „Zobacz szczegóły”. Poza Czujnikiem rusza się jeden obrazek.
//
// GDZIE JEST RESZTA. Przycisk „Steruj ręcznie”, „Zobacz szczegóły” i mysz na kuli: rf-34d
// (wejście). Pełna kula w kaflu: rf-34e (`drawPose3D` z rf-14, to samo, co duża karta). Pas
// naciśnięć: rf-34f. Przód kapsla: rf-41e.
//
// SKĄD DANE. Kula z `POSE.drawnQ` / `tiltDeg` / `angVelDps` (rf-14, liczone co klatkę także przy
// schowanej dużej karcie); pas naciśnięć z `VB().btnPresses` (rf-08).
//
// KIEDY RYSUJEMY. Raz na klatkę woła nas `frame()` z rf-09 (jedna pętla rAF na aplikację):
//   1. zwinięty prawy panel (`body.rp-collapsed`) albo siatka poza ekranem → wychodzimy od razu
//      (jeden test `offsetParent` na `#rfMiniGrid`, nie na każdym kaflu),
//   2. dławik ~30 Hz dla kuli i pasa,
//   3. kula ma własny podpis stanu `_poseSig` (rusza się też bez nowej próbki: szukanie, kółko
//      obrotów, poświata diody), pas naciśnięć klucz stanu bufora `_lastKey`.
(function (global) {
  const MINI_HZ = 30;                    // ile razy na sekundę odświeżamy kulę i pas naciśnięć
  const MIN_DT = 1000 / MINI_HZ;
  let _last = 0;
  // KLUCZ STANU DLA PASA NACIŚNIĘĆ. Streszcza wszystko, co może zmienić ten obrazek: koniec okna
  // czasu, jego długość, pauzę i rozmiar siatki. W symulacji zmienia się co klatkę (dane płyną);
  // w trybie LIVE z uśpionym kapslem stoi, więc pas schodzi do odświeżenia raz na sekundę.
  // KULI TU NIE MA: ona rysuje orientację, a nie bufor próbek (patrz `_poseSig` niżej).
  let _lastKey = "", _lastFull = 0;

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  // Kafel z płótnem. Podpis (`title`) jest ETYKIETĄ, więc tłumaczy go walker i18n; bez podpisu kafel
  // niesie samo płótno (kula: jej stan mówi zdanie pod spodem, patrz `_say`).
  function mini(title, canvasId, canvasCls) {
    const box = el("div", "rf-mini");
    if (title) box.appendChild(el("div", "rf-mini-t", title));
    const c = document.createElement("canvas");
    c.className = canvasCls; c.id = canvasId;
    c.setAttribute("aria-hidden", "true");   // obraz bez treści do odczytania, opis niesie podpis
    box.appendChild(c);
    return box;
  }


  // ---- budowa sekcji ----------------------------------------------------------------------------
  function build() {
    const wrap = document.createElement("div");
    wrap.className = "rf-lvgrid"; wrap.id = "rfMiniGrid";
    // Druga połowa miniatury (wejście) mieszka w rf-34d i ładuje się PO tym pliku — ale `build()`
    // leci dopiero z bootstrapu, więc w tym miejscu jest już na swoim miejscu.
    const NS0 = global.rfRcolMini;
    // UX 261120 L23 („mniej naraz”): w kolumnie zostaje MAŁA kula (ok. 140 px) i jedno zdanie stanu.
    // Wykresy kanałów 0–2, 3–5 i filtra 3D są tylko w Czujniku (duże karty), dokąd prowadzi
    // „Zobacz szczegóły”. Poza Czujnikiem w polu widzenia rusza się jeden obrazek, nie cztery.
    const mPose = mini("", "rfMiniPose", "rf-puck");
    mPose.classList.add("rf-mini-pose");
    const say = el("p", "rf-mini-say"); say.id = "rfMiniSay";
    say.setAttribute("data-noi18n", "");   // zdanie składa `_say()` przez _gl, w bieżącym języku
    mPose.appendChild(say);
    wrap.appendChild(mPose);
    // „STERUJ RĘCZNIE" TUŻ POD KULĄ (2026-08-31).
    // Stał na samym dole miniatury, pod pasem naciśnięć
    // — czyli o cztery kafle od jedynej rzeczy, której dotyczy. Wzrok szedł po kuli, a ręka po
    // przycisku dwieście pikseli niżej, i przy zwiniętych wykresach potrafił wyjechać poza ekran.
    // Wiersz nadal idzie NA CAŁĄ SZEROKOŚĆ siatki (`grid-column:1/-1` w 20-cols.css): przycisk
    // dotyczy całego podglądu, bo ręka rusza kapslem, więc drgają wszystkie cztery obrazki naraz.
    // Buduje go rf-34d (wejście, nie rysowanie) — pytamy przez namespace, bo tamten plik ładuje się
    // PO tym; `build()` leci dopiero z bootstrapu, więc w tym miejscu jest już na swoim miejscu.
    const acts = el("div", "rf-mini-acts");
    if (NS0 && NS0.manualBtn) acts.appendChild(NS0.manualBtn());
    wrap.appendChild(acts);
    // NACIŚNIĘCIA I PRZYCISKI KAPSLA ZARAZ POD „STERUJ RĘCZNIE" (2026-08-31).
    // W widoku live sam diagram kliknięć stoi pod orientacją 3D.
    // Kolejność niesie treść: bierzesz kapsel do ręki,
    // naciskasz jego przycisk TYMI przyciskami, a pas pod spodem w tej samej chwili rysuje kreskę
    // i czas trzymania — pętla „zrobiłem / widzę wynik" zamyka się bez przenoszenia wzroku.
    // W trybie LIVE ani przycisku „Steruj ręcznie", ani pasa przycisków kapsla nie ma (jedno i
    // drugie jest podtrybem SYMULACJI — `syncManual` w rf-34d), więc pod kulą zostaje sam pas
    // naciśnięć. Dokładnie o to prosi drugie zdanie zlecenia i wychodzi to samo z tej jednej
    // kolejności — bez drugiego układu na drugi tryb.
    if (NS0 && NS0.laneRow) wrap.appendChild(NS0.laneRow());
    if (NS0 && NS0.vpActs) wrap.appendChild(NS0.vpActs());
    // PRZÓD KAPSLA (rf-41e, 2026-09-29) — na końcu, bo odpowiada na inne pytanie niż kula:
    // nie „co płynie z czujnika”, tylko „gdzie ten okrągły kapsel ma przód i czy w niego mierzę”.
    // To ta sama kropla, co w nakładce, z tymi samymi ustawieniami kapsla; klik rozwija je pod
    // rysunkiem (wspólny komponent `frontSettingsHtml`), więc zmiana tu jest zmianą nad grą.
    // Budowa i rysowanie mieszkają w rf-41e (limit 500 linii na plik, .github/CONTRIBUTING.md).
    if (typeof frontRailTile === "function") wrap.appendChild(frontRailTile());
    return wrap;
  }


  // OKNO CZASU wspólne z Czujnikiem: suwak „Okno" i „Pauza" stamtąd rządzą też pasem naciśnięć,
  // więc kreska naciśnięcia leży na tej samej osi co wykresy w Czujniku.
  function _span(B) {
    if (!B) return null;
    const end = (typeof state !== "undefined" && state.paused && state.frozenTs != null) ? state.frozenTs : B.nowTs;
    if (end == null) return null;
    const win = (typeof state !== "undefined" && state.windowSec) || 10;
    return { end, win, start: end - win };
  }

  // ---- kula ---------------------------------------------------------------------------------------
  function _puck(c) {
    if (!c) return;
    if (typeof POSE === "undefined") return;
    // PEŁNA KULA, ZAWSZE (2026-08-30, etap 9b). Rysuje ją `drawPose3D` z rf-14 przez
    // `rf-34e-mini-pose.js` — ta sama funkcja, co dużą kartę w Czujniku, tylko z innym płótnem.
    // Ten plik nie ma o niej nic do powiedzenia poza „nie ja".
    // `drawMiniPose` (rf-12) NIE JEST tu już wołane, ale zostaje w kodzie: rysuje kule na kaflach
    // kapsli w module Kontroler i w ściądze, więc to nie jest osierocona funkcja.
    const NSx = global.rfRcolMini;
    if (NSx && NSx.drawPoseBig) { NSx.drawPoseBig(c); return; }
    // Awaryjnie (rf-34e nie wstało) — stary, mały wariant, żeby kafel nie został pustym prostokątem.
    c._poseHits = null;                       // bez liter osi nie ma czego chwytać (patrz rf-14b)
    const fn = (POSE.view2d && typeof drawMiniPose2D === "function") ? drawMiniPose2D
      : (typeof drawMiniPose === "function" ? drawMiniPose : null);
    if (!fn) return;
    fn(c, { quat: POSE.drawnQ, tilt: POSE.tiltDeg, twist: POSE.twistDps });
  }

  // KULA NIE MIESZKA W BUFORZE PRÓBEK, WIĘC NIE WOLNO JEJ PYTAĆ O JEGO ZEGAR (2026-09-06).
  // Klucz stanu z `frame()` (koniec okna czasu = `nowTs`) trzymał do 2026-09-06 także kulę — i to
  // był błąd, bo kula ma WŁASNE źródło ruchu, niezależne od tego, czy właśnie przyszła próbka:
  //   • „szukam urządzenia" (`scanning`) to animacja z `loadingChoreo` (rf-09) liczona z zegara,
  //     a pakietów w tym stanie NIE MA — `nowTs` stoi na zerze od startu strony. Klucz nie zmieniał
  //     się więc ani razu i cała kula schodziła do awaryjnego odświeżenia RAZ NA SEKUNDĘ, podczas
  //     gdy duża karta w Czujniku rysowała tę samą choreografię co klatkę. Zgłoszenie
  //     (2026-09-06, zrzut ze strzałkami „to działa płynnie" / „to klatkuje"): dokładnie ta różnica,
  //   • wirujące kółko obrotów i poświata plakietki diody też chodzą z zegara, nie z próbek.
  // Odpowiedź na „czy obrazek się zmienił" musi więc iść z POSE, a nie z bufora. `null` znaczy
  // „animacja w toku — rysuj bezwarunkowo"; string znaczy „tyle wiem o obrazku, porównaj".
  // Kwaternion kwantujemy do 1/2048: to ~0,03° obrotu, czyli ~0,1 px na kuli tego kafla — ruch
  // poniżej tego progu i tak nie ma jak wyjść na ekran, a stojący kapsel przestaje kosztować.
  // Odczyty pod kulą zaokrągla `_pn` (rf-14) do pełnych stopni, więc te same trzy liczby w kluczu
  // dają DOKŁADNIE moment, w którym napis się zmienia.
  let _poseKey = "";
  function _poseSig() {
    if (typeof POSE === "undefined") return null;             // rf-14 jeszcze nie wstało — rysuj
    const B = (typeof VB === "function") ? VB() : null;
    if (B && B.scanning) return null;                         // choreografia szukania — własny zegar
    if ((POSE.angVelDps || 0) > 3) return null;               // kółko obrotów kręci się i pulsuje
    const D = (typeof state !== "undefined" && state.devices)
      ? state.devices[POSE.dev || state.viewDev || state.activeDeviceId || "d0"] : null;
    const led = D && D.led;                                   // poświata po zmianie diody: 600 ms (rf-14)
    if (led && led.at && (((typeof performance !== "undefined") ? performance.now() : Date.now()) - led.at) < 700) return null;
    const q = POSE.drawnQ || [1, 0, 0, 0], u = POSE.upS || [0, 0, 1];
    // `drawnQ` odpowiada za KULĘ, `upS` + `twistAngle` za WIDOK 2D (bańka i wskazówka w `drawPose2D`
    // idą wprost z nich, a nie z kwaternionu). Obie trójki w jednym podpisie, bo widok przełącza się
    // pod ręką i podpis pilnujący tylko jednej z nich zamroziłby drugi obrazek.
    return (Math.round(q[0] * 2048) + "," + Math.round(q[1] * 2048) + "," +
            Math.round(q[2] * 2048) + "," + Math.round(q[3] * 2048)) +
      "|" + (Math.round(u[0] * 1024) + "," + Math.round(u[1] * 1024) + "," + Math.round(u[2] * 1024)) +
      "|" + Math.round((POSE.twistAngle || 0) * 2048) +
      "|" + (POSE.mode || "") + (POSE.view2d ? "2d" : "3d") + (POSE.mirror ? "m" : "") +
      "|" + Math.round(POSE.tiltDeg || 0) + "|" + Math.round(POSE.twistDps || 0) +
      "|" + Math.round(POSE.angVelDps || 0) +
      "|" + (led ? (led.on ? 1 : 0) : "-");
  }
  // Awaryjne odświeżenie raz na sekundę — z tego samego powodu, co przy `_lastFull` niżej:
  // motyw jasny/ciemny, `prefers-reduced-motion` i przełączenie widoku 2D/3D zmieniają obrazek
  // po swojemu i nie mają jak wejść do podpisu. Sekunda kosztuje jedną kulę, a nie zostawia
  // sfery w starych kolorach do najbliższego ruchu kapsla.
  let _poseLast = 0;
  function _poseDraw(now) {
    const c = document.getElementById("rfMiniPose");
    if (!c) return;
    const sig = _poseSig();
    if (sig !== null && sig === _poseKey && now - _poseLast < 1000) return;
    _poseKey = sig || "";                                     // po animacji pierwszy stały obrazek się przebije
    _poseLast = now;
    try { _puck(c); } catch (e) { }
  }

  // ---- jedno zdanie stanu pod kulą (UX 261120 L23) -----------------------------------------------
  // „Kapsel reaguje na ruch.” albo „Nie widzę ruchu kapsla.”: odpowiedź na „czy żyje” bez czytania
  // liczb. Ruch = prędkość kątowa ponad próg albo zmiana pochylenia o ponad 1,5° od ostatniego
  // odczytu; po 3 s spokoju zdanie przechodzi na „nie widzę”. Szukanie i uśpienie to też „nie widzę”.
  // DOM ruszany tylko przy zmianie napisu (porównanie gotowego zdania, więc zmiana języka też się łapie).
  let _sayAt = -1e9, _sayTilt = null, _sayTxt = "", _sayOn = null, _sayChk = 0;
  function _say(now) {
    if (now - _sayChk < 250) return;
    _sayChk = now;
    const p = document.getElementById("rfMiniSay");
    if (!p || typeof POSE === "undefined") return;
    const B = (typeof VB === "function") ? VB() : null;
    const dead = !!(B && (B.scanning || B.parked));
    const t = +POSE.tiltDeg || 0;
    if (!dead && ((POSE.angVelDps || 0) > 6 || (_sayTilt != null && Math.abs(t - _sayTilt) > 1.5))) _sayAt = now;
    _sayTilt = t;
    const on = !dead && now - _sayAt < 3000;
    const txt = on ? _gl("Kapsel reaguje na ruch.", "The capsule reacts to motion.")
                   : _gl("Nie widzę ruchu kapsla.", "I see no capsule motion.");
    if (txt === _sayTxt && on === _sayOn) return;
    _sayTxt = txt; _sayOn = on;
    p.textContent = txt;
    p.classList.toggle("on", on);
  }

  // ---- jedna klatka -------------------------------------------------------------------------------
  // Wołane z `frame()` w rf-09. Najtańsze wyjścia idą pierwsze: brak siatki na ekranie, potem dławik.
  function frame() {
    // ⚠️ ZWINIĘTY PRAWY PANEL NIE ZERUJE `offsetParent`. Podgląd chowa się siatką `1fr → 0fr`
    // z `overflow:hidden` na `.rf-lvinner` — czyli kafle są PRZYCIĘTE, a nie usunięte z układu:
    // mają dalej swoją wysokość, `offsetParent` niepuste i `clientHeight` 52 px, więc rysowałyby
    // się dalej, tyle że w nikogo. Klasa na `body` odpowiada na to jednym spojrzeniem i bez
    // dotykania układu (odczyt `getBoundingClientRect` w pętli klatek wymuszałby przeliczenie).
    if (document.body.classList.contains("rp-collapsed")) return;
    const g = document.getElementById("rfMiniGrid");
    if (!g || !g.offsetParent) return;
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
    if (now - _last < MIN_DT) return;
    _last = now;
    // Siatka bezpieczeństwa dla przycisku trybu ręcznego. Właściwym źródłem prawdy jest hak
    // w `vpUpdateUi` (rf-14b) — natychmiastowy i wołany dokładnie wtedy, gdy stan się zmienia.
    // Ale `vpUpdateUi()` leci też RAZ przy starcie rf-14b, czyli ZANIM rf-34b zbuduje prawą
    // kolumnę: tamto wywołanie nie ma czego odświeżyć. Tu kosztuje jedno porównanie liczb,
    // a domyka i tę dziurę, i powrót z rozwiniętego panelu. Sama funkcja mieszka w rf-34d (wejście).
    const NS = global.rfRcolMini;
    if (NS && NS.syncManual) try { NS.syncManual(); } catch (e) { }
    // KULA PRZED BRAMKĄ KLUCZA, i to nie jest kwestia kolejności linijek tylko tego, że ona pyta
    // o co innego: klucz niżej streszcza BUFOR PRÓBEK (to, co widać na przebiegach i pasie
    // naciśnięć), a kula rysuje ORIENTACJĘ, która rusza się także wtedy, gdy żadna próbka nie
    // przyszła — patrz `_poseSig`. Własny dławik ma wspólny (`_last` wyżej), żeby oba obrazki
    // dalej „migały" w jednym rytmie.
    _poseDraw(now);
    _say(now);
    // Kropla przodu żyje (fale, oddech), więc rysuje się w rytmie kuli, a nie z bramki bufora niżej.
    if (typeof frontRailDraw === "function") frontRailDraw(now);
    // Klucz stanu PO `syncManual` — przycisk trybu ręcznego ma swoją własną siatkę bezpieczeństwa
    // i nie może wypaść razem z rysowaniem.
    const B0 = (typeof VB === "function") ? VB() : null, sp0 = _span(B0);
    const key = (sp0 ? sp0.end + "|" + sp0.win : "-") + "|" +
      ((typeof state !== "undefined" && state.paused) ? 1 : 0) + "|" +
      g.clientWidth + "x" + g.clientHeight;
    if (key === _lastKey && now - _lastFull < 1000) return;
    _lastKey = key; _lastFull = now;
    if (NS.drawLane) try { NS.drawLane(document.getElementById("rfMiniBtn")); } catch (e) { }  // pas naciśnięć (rf-34f)
  }

  // Namespace ROZSZERZANY, nie nadpisywany: `rf-34d-mini-input.js` dokłada do tego samego obiektu
  // `moreBtn`, `manualBtn` i `syncManual`. Nadpisanie (`= { … }`) skasowałoby czyjąś połowę
  // w zależności od kolejności ładowania — pułapka kolejności ładowania z .github/CONTRIBUTING.md.
  const NS = global.rfRcolMini = global.rfRcolMini || {};
  NS.build = build; NS.frame = frame;
  // DWA DROBIAZGI WYSTAWIONE DLA rf-34f (pas naciśnięć wyprowadzony do osobnego pliku po
  // przekroczeniu 500 linii — .github/CONTRIBUTING.md). `span` MUSI być współdzielone,
  // a nie przepisane: to jest TO SAMO okno czasu, na którym leżą przebiegi, i dwie kopie tej
  // arytmetyki rozjechałyby pas z wykresami nad nim przy pierwszej zmianie suwaka „Okno".
  NS._el = el; NS._span = _span;
})(window);
