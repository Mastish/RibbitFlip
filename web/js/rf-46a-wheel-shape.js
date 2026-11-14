"use strict";
// ===================== KOŁO WYBORU — KSZTAŁT WYCINKA (geometria SVG) =====================
// Czysta geometria koła: nic tutaj nie dotyka DOM-u, nie wie, czyje to koło, ani skąd wzięły się
// dane. Wynikiem jest ŚCIEŻKA — napis `d` dla <path> — bo od 2026-08-26 koło rysuje się wektorem,
// a nie na płótnie.
//
// DLACZEGO WEKTOR, A NIE CANVAS (celowo): w makiecie było to o wiele
// ładniejsze i działało o wiele płynniej. Canvas przerysowywał WSZYSTKO co klatkę i każdy ruch —
// wskazanie, rozkwit, wysunięcie wycinka — musiał być liczony ręcznie, klatka po klatce, przy
// dwóch kapslach naraz. W SVG każdy wycinek jest osobnym elementem, więc te same ruchy robi CSS
// na GPU (tylko transform i opacity), a pakiet z serwera zmienia wyłącznie klasy i atrybuty.
// Prototyp koła (poza repozytorium) udowodnił to na oczach; ten plik jest
// portem jego geometrii, funkcja po funkcji.
//
// PODGLĄD NIE KŁAMIE, bo ładny renderer JEST rendererem produkcyjnym: ta sama ścieżka rysuje scenę
// w karcie, ściągę w panelu, nakładkę nad grą i okienko przy kursorze.
//
// KOLEJNOŚĆ ŁADOWANIA: PRZED rf-46-wheel.js, bo ono woła stąd wszystko — i przed rf-46b/c/d/e.

// ------------------------------------------------------------------------------------------
//  WYGLĄD WYCINKA — wielkość, odstęp i zaokrąglenie („look")
// ------------------------------------------------------------------------------------------
// Trzy liczby, wszystkie o KSZTAŁCIE koła, a nie o tym, co robi. Lustro RadialMenu.SIZE_* /
// GAP_* / CORNER_* — przychodzą w pakiecie („look"), dokładnie z tego powodu, dla którego
// przychodzi „dz": okno nakładki to osobna strona bez karty ustawień, więc nie ma kogo o to spytać.
//
// ODSTĘP WYCINA SIĘ Z WNĘTRZA wycinka, nie z granicy między nimi. Granice są tym, po czym silnik
// celuje; rysunek nie ma prawa ich przesunąć, bo wtedy ręka celowałaby w brzeg, którego serwer
// w tym miejscu nie widzi. Przy odstępie 0 wycinki stykają się bokami, jak dawniej.
//
// ZAOKRĄGLENIE JEST W PIKSELACH koła o średnicy 420 px i skaluje się z promieniem rysunku:
// stałe 10 px zjadłoby małe koło i zniknęło w dużym.
//
// WIELKOŚĆ (`size`) to ŚREDNICA koła w pikselach ekranu i jedna odpowiedź dla wszystkich
// powierzchni: okienko przy kursorze buduje się wokół niej, widżet na ściądze i w nakładce rysuje
// się do niej, a scena w karcie pokazuje ją w naturze.
const WHEEL_GAP_DEF = 3, WHEEL_GAP_MIN = 0, WHEEL_GAP_MAX = 8;
const WHEEL_CORNER_DEF = 10, WHEEL_CORNER_MIN = 0, WHEEL_CORNER_MAX = 14;
const WHEEL_SIZE_DEF = 360, WHEEL_SIZE_MIN = 120, WHEEL_SIZE_MAX = 640;
// WIELKOŚĆ PISMA — KROTNOŚĆ, nie liczba pikseli. Lustro RadialMenu.FONT_MIN/MAX/DEF.
//
// Piksela nie da się tu podać, bo pism jest kilka i każde liczy się z czegoś innego: nazwa
// wycinka z GRUBOŚCI pasma, ikona z tej samej grubości, a treść środka z promienia martwej
// strefy. Człowiek, który ustawiłby „13 px", ustawiłby to jednemu z nich i rozstroił resztę.
// Krotność rusza wszystkimi naraz i zostawia proporcje, w których koło zostało narysowane.
//
// PO CO: koło czyta się kątem oka, i tak samo często z telewizora po drugiej stronie pokoju, jak
// z monitora na biurku — a sufit, który rysunek nakłada na nazwę (15 px), został dobrany do tego
// drugiego przypadku.
const WHEEL_FONT_DEF = 1, WHEEL_FONT_MIN = 0.7, WHEEL_FONT_MAX = 1.6;
// PRÓG, PONIŻEJ KTÓREGO OZDOBNIKI ZACZYNAJĄ MALEĆ — promień najmniejszego koła, jakie dopuszczał
// prototyp (średnica 320 px, czyli jego `SIZE_MIN`). Powyżej tego progu zaokrąglenie, wysunięcie
// wycinka, ścieg i kropki mają DOKŁADNIE tyle pikseli, ile w makiecie, niezależnie od wielkości
// koła — tak samo jak tam. Poniżej (kafel ściągi bywa i 90-pikselowy, a suwak wielkości schodzi
// do 120 px) maleją razem z kołem, bo stałe 10 px zaokrąglenia zjadłoby taki wycinek w całości.
const WHEEL_LOOK_REF_R = 142;
// MARGINES WOKÓŁ KOŁA — wartość wprost z prototypu (`PAD = 18`). Musi być, bo wskazany wycinek
// WYSUWA SIĘ na zewnątrz, a przy motywach z poświatą wychodzi jeszcze dalej. Stały, nie procentowy:
// w prototypie koło o średnicy 320 i 680 px ma dokładnie ten sam odstęp od krawędzi, i właśnie
// dlatego duże koło wygląda tam na pełniejsze niż nasze liczone procentem.
//
// NA MAŁYCH KAFLACH margines schodzi razem z nimi (6% boku): stałe 18 px zjadłoby dwie piąte
// rysunku o boku 90 px, a taki kafel bywa na ściądze.
const WHEEL_PAD = 18;
function _whPad(box) { return Math.min(WHEEL_PAD, box * 0.06); }
// Ile miejsca musi mieć okno albo kafel, żeby koło o średnicy `size` nie zostało przycięte.
// Zapas 12% boku, czyli odrobinę więcej niż margines rysunku — okno przy kursorze dostaje wtedy
// koło w pełnej, zamówionej średnicy i ani jedna zapisana wielkość okna nie wymaga przeliczenia.
const WHEEL_BOX_K = 1 / 0.88;
// Poniżej tej średnicy koło przestaje mieć miejsce na ozdobniki: okruszki i zdanie w środku znikają,
// zostają ikony i nazwy. „Za dużo elementów" na małym rysunku to nie bogactwo, tylko plama.
const WHEEL_SMALL_PX = 180;

function wheelLook(raw) {
  const s = (raw && typeof raw === "object") ? raw : {};
  const g = +s.gapDeg, c = +s.corner, z = +s.size, f = +s.fontScale;
  return {
    size: isFinite(z) ? Math.max(WHEEL_SIZE_MIN, Math.min(WHEEL_SIZE_MAX, z)) : WHEEL_SIZE_DEF,
    gapDeg: isFinite(g) ? Math.max(WHEEL_GAP_MIN, Math.min(WHEEL_GAP_MAX, g)) : WHEEL_GAP_DEF,
    corner: isFinite(c) ? Math.max(WHEEL_CORNER_MIN, Math.min(WHEEL_CORNER_MAX, c)) : WHEEL_CORNER_DEF,
    // BRAK POLA ZNACZY 1,0 — czyli „pismo takie, jakie rysunek policzy sam". Tak samo czyta to
    // silnik i tak samo je zapisuje: konfiguracja sprzed tego suwaka nie ma prawa się zmienić
    // przez samo otwarcie panelu (patrz _sanitize_look w ribbitflip_monitor.py).
    fontScale: isFinite(f) ? Math.max(WHEEL_FONT_MIN, Math.min(WHEEL_FONT_MAX, f)) : WHEEL_FONT_DEF
  };
}
// PISMO PO SUWAKU — z sufitem, który liczy się z MIEJSCA, a nie z samej krotności.
//
// Mnożenie w gołej postaci wystarczyłoby do 1,0 (podgląd byłby wtedy identyczny), ale przy 1,6
// i wąskim paśmie napis wyszedłby poza swój wycinek — a to jest dokładnie ta rzecz, której suwak
// wielkości pisma nie ma prawa zrobić. Sufit `room` to grubość pasma (albo średnica środka), więc
// pismo rośnie tak długo, jak ma gdzie.
//
// ⚠️ `Math.max(base, room)` NIE JEST tu ozdobnikiem: przy bardzo małym kole sama wartość bazowa
// bywa już większa niż `room` (ma własną podłogę czytelności), a bez tego sufit ZMNIEJSZYŁBY
// pismo przy krotności 1,0 — czyli suwak, którego nikt nie ruszył, zmieniłby rysunek.
function _whFs(base, fs, room) {
  return Math.min(base * (fs > 0 ? fs : 1), Math.max(base, room));
}
// Bok okna albo kafla, w którym koło o tej średnicy zmieści się w całości.
function wheelBoxPx(size) { return Math.round(wheelLook({ size: size }).size * WHEEL_BOX_K); }

// ------------------------------------------------------------------------------------------
//  PODSTAWY
// ------------------------------------------------------------------------------------------
// KANON KĄTA: 0 = godzina 12, rośnie zgodnie ze wskazówkami zegara. Tak liczy silnik (RadialMenu),
// więc tak liczy rysunek — dwa układy współrzędnych na jedno koło to koło, które wskazuje gdzie
// indziej, niż celuje ręka.
function _whRad(deg) { return deg * Math.PI / 180 - Math.PI / 2; }
function _whPt(cx, cy, r, deg) {
  const a = _whRad(deg);
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}
function _whF2(n) { return Math.round(n * 100) / 100; }
function _whClamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

// KĄT CIĄGŁY — jedyny kąt, jaki wolno podać do animowanego przekształcenia.
//
// Kierunek przychodzi ZNORMALIZOWANY do 0..360: tak liczy go silnik w pakiecie („ang") i tak samo
// liczy go scena z położenia kursora. Ale przejście CSS animuje LICZBĘ, nie kierunek — między
// 359° a 1° widzi różnicę 358 stopni i objeżdża z nią całe koło w drugą stronę. Pierwszy wycinek
// stoi na godzinie 12, czyli DOKŁADNIE na szwie 0/360, więc było to widać za każdym razem, gdy
// ręka przechodziła między pierwszym a ostatnim wycinkiem: wskazówka zamiast przeskoczyć o kilka
// stopni zataczała pełne koło.
//
// Dlatego rysunek trzyma AKUMULATOR: do poprzedniej wartości dokłada różnicę sprowadzoną do
// przedziału (-180°, 180°], czyli zawsze KRÓTSZĄ drogę. Wynik rośnie albo maleje bez końca i to
// jest w porządku — trafia wyłącznie do `rotate()`, któremu 721° znaczy to samo co 1°.
function whUnwrapDeg(prev, raw) {
  raw = +raw || 0;
  if (prev == null || !isFinite(prev)) return raw;
  let d = (raw - prev) % 360;
  if (d > 180) d -= 360;
  else if (d <= -180) d += 360;
  return prev + d;
}

// Jaki tusz położyć na kolorowym krążku pod ikoną. Emoji ma własne kolory, ale znaki typograficzne
// (▭ ✥ ↻) dziedziczą `fill`, więc na jasnym krążku muszą być ciemne. Port z prototypu (`inkOn`);
// brak koloru znaczy „krążek w barwie motywu", a tam biel jest bezpieczna.
function _whInk(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || ""));
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? "#211f1d" : "#ffffff";
}
// Kolor wycinka wolno wziąć wprost tylko wtedy, gdy naprawdę jest kolorem — cokolwiek innego
// idzie motywem, bo w nakładce „Sama treść" kolor spoza motywu zniknąłby razem z wycinanym tłem.
function _whCol(c) { return /^#[0-9a-fA-F]{6}$/.test(String(c || "")) ? String(c) : ""; }

// Wycinki pasma w stopniach. Pełne pasmo dzieli koło równo; łuk dzieci dostaje zakres policzony
// przez silnik („a0"/„a1") — rysunek NICZEGO tu nie wymyśla.
function _whSegs(bd, n) {
  const out = [];
  if (bd && bd.full === false) {
    const a0 = +bd.a0 || 0, a1 = (bd.a1 == null ? 360 : +bd.a1), wd = (a1 - a0) / n;
    for (let i = 0; i < n; i++)
      out.push({ a0: a0 + i * wd, a1: a0 + (i + 1) * wd, c: a0 + (i + 0.5) * wd });
  } else {
    const step = 360 / n;
    for (let i = 0; i < n; i++)
      out.push({ a0: i * step - step / 2, a1: i * step + step / 2, c: i * step });
  }
  return out;
}

// KĄTY RYSOWANE wycinka: jego własne granice zwężone o odstęp, po połowie z każdej strony.
// Odstęp nigdy nie zjada więcej niż 55% wycinka — przy szesnastu wycinkach i ośmiu stopniach
// przerwy zostałby sam odstęp, a koło zniknęłoby na rzecz przerw między niczym.
function _whGapA(seg, gapDeg) {
  const wd = seg.a1 - seg.a0;
  const g = Math.max(0, Math.min(+gapDeg || 0, wd * 0.55));
  return { a0: seg.a0 + g / 2, a1: seg.a1 - g / 2, c: seg.c };
}

// ------------------------------------------------------------------------------------------
//  ŚCIEŻKI — port z prototypu, funkcja w funkcję
// ------------------------------------------------------------------------------------------
// Ile realnie wynosi promień zaokrąglenia narożnika. Osobna funkcja, bo tej samej odpowiedzi
// potrzebuje ścieg — inaczej jego narożniki nie byłyby współśrodkowe z narożnikami wycinka
// i równy odstęp rozjeżdżałby się dokładnie na zaokrągleniu. Trzy ograniczenia, bo bez nich wąski
// wycinek z dużym „corner" produkuje ścieżkę, która zawija się sama w sobie i znika.
function _whCornerFit(r0, r1, span, corner) {
  const hs = Math.sin((span / 2) * Math.PI / 180);
  let c = Math.min(+corner || 0, (r1 - r0) * 0.45);
  if (r0 > 1) c = Math.min(c, r0 * hs * 0.85);
  c = Math.min(c, r1 * hs * 0.85);
  return Math.max(0, c);
}

// WYCINEK = PIERŚCIENIOWY SEKTOR z odstępem kątowym i zaokrąglonymi rogami.
//
// DLACZEGO NIE ZWYKŁE „dwa łuki i dwie proste": przy zaokrąglaniu trzeba SKRÓCIĆ oba łuki o kąt,
// pod jakim widać promień zaokrąglenia z danego promienia okręgu — asin(c/r), inny dla wewnętrznego
// i dla zewnętrznego. Bez tej kompensacji narożny łuk wyskakuje poza wycinek, a przy dużym odstępie
// ścieżka wywraca się do środka (łuk zaczyna się za swoim końcem).
//
// KIERUNEK OBIEGU: łuk wewnętrzny idzie w stronę rosnącego kąta (flaga sweep=1), zewnętrzny wraca
// (sweep=0). Wnętrze wycinka leży wtedy po lewej, więc WSZYSTKIE cztery narożniki są wypukłe i mają
// tę samą flagę sweep=0.
function whSectorPath(cx, cy, r0, r1, a0, a1, corner) {
  let span = a1 - a0;
  if (span <= 0.01) return "";
  // PEŁNY OKRĄG (jeden wycinek bez odstępu) trzeba przyciąć: łuk, którego początek pokrywa się
  // z końcem, przeglądarka pomija w całości i wycinek znika. Ścinamy pół stopnia.
  if (span > 359.5) { span = 359.5; a1 = a0 + span; }
  const c = _whCornerFit(r0, r1, span, corner);
  const DEG = Math.PI / 180;
  const d0 = (r0 > 1 && c > 0.4) ? Math.asin(_whClamp(c / r0, 0, 0.999)) / DEG : 0;
  const d1 = (c > 0.4) ? Math.asin(_whClamp(c / r1, 0, 0.999)) / DEG : 0;
  const P = (r, a) => { const p = _whPt(cx, cy, r, a); return _whF2(p[0]) + " " + _whF2(p[1]); };
  const R0 = _whF2(r0), R1 = _whF2(r1), C = _whF2(c);
  if (c <= 0.4) {
    const la = span > 180 ? 1 : 0;
    return "M " + P(r0, a0) +
      " A " + R0 + " " + R0 + " 0 " + la + " 1 " + P(r0, a1) +
      " L " + P(r1, a1) +
      " A " + R1 + " " + R1 + " 0 " + la + " 0 " + P(r1, a0) + " Z";
  }
  const laIn = (span - 2 * d0) > 180 ? 1 : 0;
  const laOut = (span - 2 * d1) > 180 ? 1 : 0;
  return "M " + P(r0, a0 + d0) +
    " A " + R0 + " " + R0 + " 0 " + laIn + " 1 " + P(r0, a1 - d0) +   // łuk wewnętrzny
    " A " + C + " " + C + " 0 0 0 " + P(r0 + c, a1) +                 // narożnik
    " L " + P(r1 - c, a1) +                                           // krawędź promieniowa
    " A " + C + " " + C + " 0 0 0 " + P(r1, a1 - d1) +
    " A " + R1 + " " + R1 + " 0 " + laOut + " 0 " + P(r1, a0 + d1) +  // łuk zewnętrzny
    " A " + C + " " + C + " 0 0 0 " + P(r1 - c, a0) +
    " L " + P(r0 + c, a0) +
    " A " + C + " " + C + " 0 0 0 " + P(r0, a0 + d0) + " Z";
}

// ŚCIEG — PRAWDZIWY równoległy offset obrysu wycinka o `d` do wewnątrz.
//
// DLACZEGO NIE „ten sam sektor z węższymi kątami": boczna krawędź wycinka to prosta przechodząca
// przez środek koła, więc odsunięcie jej o stały dystans NIE jest stałym wcięciem kątowym. Na
// promieniu r te same piksele to kąt asin(d/r) — przy wewnętrznym duży, przy zewnętrznym mały.
// Jedno wcięcie liczone z r0 daje ścieg, którego boki zbiegają do środka wycinka im dalej od
// centrum, i właśnie to widać jako krzywe obszycie.
//
// Narożniki: promień o `d` mniejszy niż w wycinku. Oba łuki mają wtedy wspólny środek, więc odstęp
// trzyma się także na zaokrągleniu, nie tylko na prostych odcinkach.
function whStitchPath(cx, cy, r0, r1, a0, a1, corner, d) {
  const nr0 = r0 + d, nr1 = r1 - d;
  if (nr1 - nr0 < 6 || d >= nr0) return "";
  let span = a1 - a0;
  if (span <= 0.01) return "";
  if (span > 359.5) { span = 359.5; a1 = a0 + span; }
  const DEG = Math.PI / 180;
  const da0 = Math.asin(_whClamp(d / nr0, 0, 0.999)) / DEG;
  const da1 = Math.asin(_whClamp(d / nr1, 0, 0.999)) / DEG;
  if (span - 2 * da0 <= 0.6) return "";
  const cSec = _whCornerFit(r0, r1, span, corner);
  const c = _whCornerFit(nr0, nr1, span - 2 * da0, Math.max(0, cSec - d));
  const P = (r, a) => { const p = _whPt(cx, cy, r, a); return _whF2(p[0]) + " " + _whF2(p[1]); };
  // Punkt na BOCZNEJ krawędzi ściegu, czyli na prostej równoległej do krawędzi wycinka: na
  // promieniu r leży pod kątem odsuniętym o asin(d/r) w stronę wnętrza.
  const S = (r, aEdge, sgn) => P(r, aEdge + sgn * Math.asin(_whClamp(d / r, 0, 0.999)) / DEG);
  const A0i = a0 + da0, A1i = a1 - da0, A0o = a0 + da1, A1o = a1 - da1;
  const R0 = _whF2(nr0), R1 = _whF2(nr1), C = _whF2(c);
  if (c <= 0.4) {
    return "M " + P(nr0, A0i) +
      " A " + R0 + " " + R0 + " 0 " + ((span - 2 * da0) > 180 ? 1 : 0) + " 1 " + P(nr0, A1i) +
      " L " + P(nr1, A1o) +
      " A " + R1 + " " + R1 + " 0 " + ((span - 2 * da1) > 180 ? 1 : 0) + " 0 " + P(nr1, A0o) + " Z";
  }
  const dc0 = Math.asin(_whClamp(c / nr0, 0, 0.999)) / DEG;
  const dc1 = Math.asin(_whClamp(c / nr1, 0, 0.999)) / DEG;
  const laIn = (span - 2 * da0 - 2 * dc0) > 180 ? 1 : 0;
  const laOut = (span - 2 * da1 - 2 * dc1) > 180 ? 1 : 0;
  return "M " + P(nr0, A0i + dc0) +
    " A " + R0 + " " + R0 + " 0 " + laIn + " 1 " + P(nr0, A1i - dc0) +
    " A " + C + " " + C + " 0 0 0 " + S(nr0 + c, a1, -1) +
    " L " + S(nr1 - c, a1, -1) +
    " A " + C + " " + C + " 0 0 0 " + P(nr1, A1o - dc1) +
    " A " + R1 + " " + R1 + " 0 " + laOut + " 0 " + P(nr1, A0o + dc1) +
    " A " + C + " " + C + " 0 0 0 " + S(nr1 - c, a0, 1) +
    " L " + S(nr0 + c, a0, 1) +
    " A " + C + " " + C + " 0 0 0 " + P(nr0, A0i + dc0) + " Z";
}
