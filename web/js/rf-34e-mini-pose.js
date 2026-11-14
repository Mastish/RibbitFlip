"use strict";
// ==================================================================================================
// MINIATURA PODGLĄDU — KAFEL ORIENTACJI W TRYBIE RĘCZNYM (powiększona, PEŁNA kula 3D)
//
// DLACZEGO. Etap 8 dał małej kuli mysz: przy włączonym sterowaniu ręcznym da się nią pochylać
// kapslem wprost z prawej kolumny. Przy włączonym sterowaniu ręcznym kafel
// „Orientacja 3D” ma pokazywać pełną orientację 3D z osiami, tak jak w czujnikach.
//
// I to nie jest kaprys estetyczny. Miniaturę rysuje `drawMiniPose` (rf-12) — obrazek bez liter osi,
// bez odczytów i bez podpisu trybu. Jako WSKAŹNIK („drga / nie drga") jest w sam raz, ale jako STER
// jest kaleki: sterowanie ręczne stoi na uchwytach osi (chwyć „X" i zakręć kapslem wokół niej),
// a uchwytu, którego nie widać, nie da się złapać. Kula, która przyjmuje rękę, musi pokazywać to,
// co ta ręka może chwycić — inaczej połowa gestów z dużej karty po prostu nie istnieje.
//
// ---------------------------------------------------------------------------------------------
// ANI JEDNEJ LINII RYSOWANIA TUTAJ. Powiększoną kulę rysuje `drawPose3D()` z rf-14 — DOKŁADNIE ta
// sama funkcja, co dużą kartę w zakładce Czujnik, tylko z płótnem w parametrze (patrz uzasadnienie
// nad nią). Sfera z siatką południków, złoty południk zerowy, znacznik „przód", sześć liter osi
// z aureolą, wskaźnik obrotów, plakietka diody, odczyt „pochylenie / obrót / prędkość" i podpis
// trybu filtra to razem ~140 linii; w dwóch egzemplarzach rozjechałyby się przy pierwszej poprawce
// (dokładnie tak, jak rozjechała się macierz widoku między `drawPose3D` a `drawMiniPose` — patrz
// komentarz przy `POSE_E` w rf-14). Ten plik wnosi WYŁĄCZNIE trzy rzeczy:
//   1. odpowiedź na pytanie „czy teraz duża" (`poseIsBig`) — jedno źródło dla rysowania i dla CSS,
//   2. brak odczytów pod kulą (od UX 261120 L23 kafel ma tylko zdanie stanu, patrz `_ensure`),
//   3. przełączanie klas i dostępności przy zmianie trybu (`poseSync`).
//
// ---------------------------------------------------------------------------------------------
// DOSTĘPNOŚĆ IDZIE ZA ROLĄ, A ROLA SIĘ ZMIENIŁA. Dopóki kafel był ilustracją („drga / nie drga"),
// `aria-hidden="true"` było słuszne: treść niesie podpis kafla, a w kolejce Tab nie ma tam czego
// robić. Teraz to STER — ten sam, co duża kula: przyjmuje klawiaturę (strzałki — pochylanie,
// Q/E — obrót, spacja — przycisk kapsla, 0 — wypoziomuj, Esc — koniec), więc MUSI dać się
// sfokusować, a element schowany przed czytnikiem i jednocześnie fokusowalny to sprzeczność.
// Dostaje więc `tabindex="0"` i tę samą etykietę, co duża kula w `ribbitflip_dashboard.html`
// (ten sam napis, więc i ten sam klucz w rf-01-i18n — bez dopisywania tłumaczeń).
// ⚠️ SPACJA NIE KOLIDUJE Z PAUZĄ. Globalny skrót w rf-09 brzmi
// `if(e.code==="Space"&&e.target===document.body)`, a sfokusowane płótno jest celem zdarzenia,
// więc oscyloskopy się nie zatrzymują. Ctrl+B / Ctrl+\ (panele) przechodzą bokiem, bo nasłuch kuli
// obsługuje wyłącznie klawisze bez Ctrl. Sprawdzone, nie założone.
//
// NASŁUCHY MYSZY SIĘ NIE PRZEPINAJĄ. `vpWireSphere` jest wołane RAZ na płótno (rf-34d) i od etapu 9
// z `{axis:true,keys:true}` — te same możliwości, co duża kula. W formie małej gałąź osi i tak
// nic nie robi, bo `rf-34c` ustawia wtedy `canvas._poseHits = null` („rysowałem, liter nie ma"),
// a nasłuch klawiszy nigdy się nie odezwie, bo bez `tabindex` płótno fokusu nie przyjmuje.
// Jeden komplet nasłuchów na cały czas życia strony zamiast odpinania i podpinania przy każdym
// przełączeniu trybu — mniej stanu, zero szans na osierocony nasłuch.
// ==================================================================================================
(function (global) {
  const NS = global.rfRcolMini = global.rfRcolMini || {};

  // JEDNA FORMA, ZAWSZE (2026-08-30, etap 9b). Pierwsza wersja powiększała kulę dopiero przy
  // włączonym trybie ręcznym i zwijała ją po wyłączeniu. Po porównaniu obu form
  // wybrana została pełna kula na stałe.
  //
  // To jest lepsze niż wygodne. Kafel, który zmienia rozmiar, przesuwa WSZYSTKO pod sobą (u nas
  // o 276 px), więc przycisk, który się właśnie kliknęło, ucieka spod kursora. Do tego od etapu 9b
  // chwyt sam włącza tryb (`vpEngage` w rf-14b) — nie ma już stanu „kula nieczynna", w którym
  // mała forma byłaby uczciwa. Funkcja zostaje jako JAWNA ODPOWIEDŹ na pytanie „czy pełna kula",
  // żeby rf-34c nie musiał wiedzieć, że odpowiedź brzmi teraz zawsze tak samo.
  NS.poseIsBig = function () { return true; };

  // ODCZYTÓW POD KULĄ JUŻ NIE MA (UX 261120 L23). Kafel ma ok. 140 px i jedno zdanie stanu
  // („reaguje” / „nie widzę ruchu”, rf-34c `_say`); liczby pochylenia i nazwa trybu filtra są na
  // dużej karcie w Czujniku. `drawPose3D` dostaje id, których w DOM nie ma, więc nie pisze nic
  // (i nie pisze też do odczytów dużej karty, co zrobiłby bez tych id).
  function _ensure(c) { return c && c.parentNode; }

  // Wołane z `_puck()` w rf-34c, raz na klatkę miniatury (dławik 30 Hz zostaje jego).
  // `filter:false` — krok filtra robi duża karta (`drawPose3D()` w rf-09); powtórzenie tutaj
  // podwoiłoby wygładzanie EMA. ⚠️ OD 2026-09-05 duża karta idzie PO miniaturze: `frame()` ma
  // najpierw wszystkie odczyty geometrii, a dopiero potem zapisy do DOM-u, a `drawPose3D()`
  // przepisuje wiersz odczytu. Kula miniatury rysuje więc stan przefiltrowany w POPRZEDNIEJ
  // klatce — 16 ms różnicy na obrazku obok drugiego obrazka tej samej kuli.
  NS.drawPoseBig = function (c) {
    _ensure(c);
    if (typeof drawPose3D !== "function") return;
    drawPose3D(c, { filter: false, info: "rfMiniPoseInfo", axis: "rfMiniPoseAxis", short: true });
  };

  // STAN PAMIĘTANY W LICZBIE, DOM RUSZANY TYLKO NA ZMIANIE — ten sam powód, co przy `syncManual`
  // w rf-34d: `poseSync()` leci raz na klatkę jako siatka bezpieczeństwa, a przepisywanie klas
  // 30 razy na sekundę budziłoby MutationObserver walkera i18n bez żadnego pożytku.
  let _st = -1;
  NS.poseSync = function () {
    const c = document.getElementById("rfMiniPose");
    if (!c) return;
    const on = 1;                                 // forma jest stała — patrz `poseIsBig`
    if (on === _st) return;
    _st = on;
    const box = _ensure(c);
    // KLASA IDZIE NA SIATKĘ, NIE NA KAFEL, i to nie jest kosmetyka. Pełna kula zmienia układ
    // TRZECH rzeczy naraz: kula bierze cały wiersz, kafel filtra też (inaczej zostaje po nim pusta
    // połowa wiersza — dziura, nie układ), a poniżej 1280 px cała sztuczka musi się cofnąć, bo tam
    // siatka jest poziomym pasem czterech kolumn. Wszystkie trzy reguły potrzebują jednego
    // przełącznika na WSPÓLNYM przodku; klasa na samym kaflu nie sięgnęłaby sąsiada. Klasa zostaje
    // (a nie „wtapia się" w selektory bez niej), bo pas poniżej 1280 px MUSI umieć ją cofnąć.
    const g = document.getElementById("rfMiniGrid");
    if (g) g.classList.add("pose-big");
    if (box) box.classList.add("is-big");
    c.removeAttribute("aria-hidden");             // to już nie ilustracja, tylko ster — patrz nagłówek
    c.setAttribute("tabindex", "0");
    c.setAttribute("aria-label", "Orientacja 3D — w symulacji można chwycić kapsel myszą i sterować nim ręcznie");
  };
})(window);
