"use strict";
/* SKANER EKRANU — „Czym sterujesz skanerem": wyzwalacze, którymi człowiek prowadzi skaner.

   ZGŁOSZENIE WŁAŚCICIELA (12.09): „w skanerze wyzwalaczem może być nie tylko kliknięcie, ale też
   przechylenie czy coś. […] aby użytkownik mógł użyć konkretnego typu wyzwalacza skrojonego pod
   siebie do wyzwolenia danej akcji. ważne dla osób które np nie mają możliwości kliknięcia" oraz —
   po pytaniu o zasięg — „połącz z wyzwalaczem mapowania, czyli user zostanie przeniesiony do
   mapowania pod nowy wyzwalacz (albo wybierze z listy dostępnych). i wyjaśnij użytkownikowi co
   robi i jak to będzie działać. coś jak w synth można połączyć się z jakimś mapowaniem już
   istniejącym w mapowaniu".

   SKANER NIE MA WŁASNEGO SILNIKA WYZWALACZY i mieć nie będzie. Sygnał przychodzi regułą Mapowania
   z akcją `scan:sygnal` / `scan:cofnij` / `scan:stop` — dokładnie tak samo, jak przychodzi
   naciśnięcie klawisza czy przycisku pada. Ta sekcja jest FASADĄ nad tymi regułami: pokazuje te,
   które już są, dopisuje gotowe i OTWIERA Mapowanie na właściwej regule. Drugi komplet progów
   i histerez, utrzymywany równolegle z pierwszym, dawałby przy rozjeździe objaw „u mnie działa,
   w Mapowaniu nie".

   TRZY DROGI DO WYZWALACZA — bo trzy są realne i każda pasuje do kogoś innego:
     ① GOTOWY RUCH   — wybierasz z katalogu, reguła powstaje kompletna. Dla kogoś, kto nie chce
                       wiedzieć, co to próg.
     ② TO, CO JUŻ MASZ — wskazujesz istniejący wyzwalacz, a skaner zaczyna za nim chodzić
                       (`source.kind:"trigger"`, silnik: `_cond_over` czyta `over` tamtej reguły —
                       bez rekurencji, cykle są bezpieczne). Stroisz RAZ, w jednym miejscu.
                       To jest dokładnie ten ruch, co „Połącz z mapowaniem" w bramce Syntha
                       (rf-24-gate-ui.js) — z tą różnicą, że tam warunek CZYTA regułę, a tu
                       osobna reguła sygnału ZA NIĄ CHODZI.
     ③ WŁASNY        — przenosimy człowieka do Mapowania, do edytora otwartego na NOWEJ regule,
                       już wycelowanej w wybrany sygnał skanera. Wzorzec 1:1 z Kontrolera
                       (`padNewRule`, rf-43-controller-ui.js) — celowanie idzie przez `after(d)`,
                       bo `openEditor` może NAJPIERW zapytać o niezapisany szkic.

   ⚠️ REGUŁY SĄ WSPÓLNE Z MAPOWANIEM. Kasowanie stąd kasuje NAPRAWDĘ — dlatego idzie przez
   `ruleDeleteWithUndo` (toast z „↶ Cofnij"), a nie przez pytanie bez odwrotu. Wyłączenie
   (przełącznik) zostaje bezpieczną drogą pośrednią: wyłączona reguła nic nie wysyła, ale zostaje
   do obejrzenia.

   ⚠️ JĘZYK: wszystko tu powstaje w chwili rysowania przez `_scanT`, więc nie ma ani jednego klucza
   w słowniku i nie ma jak zostawić klucza martwego. Ceną jest hak w `setLang` (rf-01-i18n.js) —
   bez niego sekcja zamarza w języku, w którym ją narysowano. */

/* ---------------------------------------------------------------------------------------------
   KATALOG GOTOWCÓW
   ---------------------------------------------------------------------------------------------
   `wymaga` mówi, jakiej sprawności potrzeba: "przycisk", "ruch" albo "nagranie". To nie jest
   ozdoba — z piętnastu pozycji rozwijaka (dziewięć stąd + sześć z `GESTURE_PRESETS`) TRZY stoją
   na przycisku kapsla, a osoba, dla której ta sekcja powstała, przycisku nacisnąć NIE MOŻE.
   Bez tego pola lista wygląda na piętnaście dróg, a dla niej jest ich dwanaście — i nie ma jak
   tego odróżnić inaczej niż próbując każdej po kolei.

   PROGI A SUFIT CZUJNIKA: żyroskop to ±250 °/s (131 LSB = 1 °/s), więc próg obrotu powyżej ~220
   to ruch, którego żadna ręka nie wykona — reguła nigdy nie zadziała i nic tego nie powie.
   Liczby niżej są dobrane z tym sufitem w głowie; `test_scan_signals.py` tego pilnuje.

   ⚠️ PROGI KĄTOWE LICZĄ SIĘ OD WYŚRODKOWANEJ POZYCJI, nie od kapsla leżącego płasko. Kapsel na
   głowie albo przy wózku startuje z innego kąta — bez wyśrodkowania „35°" bywa albo nieosiągalne,
   albo przekroczone w spoczynku. Sekcja mówi o tym człowiekowi we wstępie; tu jest ta sama uwaga
   dla kogoś, kto dopisuje nową pozycję.

   DLACZEGO SĄ TU POZYCJE, KTÓRYCH NIE MA W `GESTURE_PRESETS`: silnik od dawna umie „utrzymaj
   pozycję" (`behavior:"dwell"` — strzela RAZ po nieprzerwanym spełnieniu warunku) i „bezruch"
   (`spin` poniżej progu ciszy żyroskopu), ale ani jeden gotowiec w całej aplikacji tego nie
   składał. Dla kogoś z drżeniem albo spastycznością to bywa jedyna droga: nie trzeba trafić
   w moment — wystarczy wytrwać. Ceną jest OPÓŹNIENIE równe czasowi trzymania i opisy muszą
   o nim mówić, bo przy jadącym pasku to ono decyduje, czy człowiek trafi w to, co chciał. */
const SKAN_ZRODLA_WLASNE = [
  {
    // ZACHOWANIE „JEDNORAZOWO", NIE „DOKŁADNIE N PUKNIĘĆ". Do 12.09 stało tu `taps` z crossings 1,
    // a ta gałąź silnika podejmuje decyzję dopiero NA KOŃCU okna (600 ms), sprawdzając, czy nie
    // przyszło drugie puknięcie. W module Myszy `taps` ma sens, bo trzeba odróżnić 1/2/3 puknięcia
    // na jednym przycisku. Tutaj jest to jedyna pozycja na przycisku, więc okno nic nie kupowało,
    // a kosztowało 0,6 s zwłoki KAŻDEGO sygnału — w module, którego cała idea to „liczy się chwila,
    // w której człowiek celował". Przy pasku skokowym co 900 ms to prawie całe pole obok.
    key: "tap", wymaga: "przycisk", label: "Puknięcie w kapsel", labelEn: "A tap on the capsule",
    desc: "Najprostsze: jedno naciśnięcie przycisku kapsla.",
    descEn: "The simplest one: a single press of the capsule's button.",
    rule: {
      source: { kind: "button", any: true, holdMs: 250 }, abs: false, cmp: ">", threshold: 0,
      thresholdHi: null, behavior: "once"
    }
  },
  {
    key: "tilt-right", wymaga: "ruch", label: "Przechylenie w prawo", labelEn: "A lean to the right",
    desc: "Kapsel odchylony w bok o jakieś 35°. Dla rąk i szyj, którym łatwiej przechylić niż nacisnąć.",
    descEn: "The capsule leaned sideways by about 35°. For hands and necks that find leaning easier than pressing.",
    rule: {
      source: { kind: "filter", metric: "roll" }, abs: false, cmp: ">", threshold: 35,
      thresholdHi: null, behavior: "once"
    }
  },
  {
    key: "tilt-left", wymaga: "ruch", label: "Przechylenie w lewo", labelEn: "A lean to the left",
    desc: "To samo w drugą stronę — dobre na „cofnij”, bo jest przeciwieństwem sygnału.",
    descEn: "The same the other way — good for stepping back, because it is the opposite of the signal.",
    rule: {
      source: { kind: "filter", metric: "roll" }, abs: false, cmp: "<", threshold: -35,
      thresholdHi: null, behavior: "once"
    }
  },
  {
    key: "nod", wymaga: "ruch", label: "Skinienie w przód", labelEn: "A nod forward",
    desc: "Pochylenie kapsla do przodu. Przy kapslu na głowie to zwykłe kiwnięcie.",
    descEn: "The capsule tipped forward. Worn on the head, that is an ordinary nod.",
    rule: {
      source: { kind: "filter", metric: "pitch" }, abs: false, cmp: ">", threshold: 30,
      thresholdHi: null, behavior: "once"
    }
  },
  {
    key: "nod-back", wymaga: "ruch", label: "Odchylenie w tył", labelEn: "A lean back",
    desc: "Para do skinienia — dla kogoś, komu ruch w tył wychodzi pewniej niż w przód.",
    descEn: "The partner to the nod — for anybody whose backward movement is the surer one.",
    rule: {
      source: { kind: "filter", metric: "pitch" }, abs: false, cmp: "<", threshold: -30,
      thresholdHi: null, behavior: "once"
    }
  },
  {
    // Bezkierunkowe: `tilt` to jedna liczba „jak daleko od pionu", bez pytania w którą stronę.
    // Dla ruchu, który nie powtarza się co do kierunku (ataksja, ruchy mimowolne) cztery strony
    // są gorsze od jednej liczby.
    key: "tilt-any", wymaga: "ruch", label: "Wychylenie w dowolną stronę", labelEn: "A lean in any direction",
    desc: "Odchyl kapsel jakkolwiek — nieważne, w którą stronę. Gdy ruch nie wychodzi zawsze tak samo.",
    descEn: "Lean the capsule any way at all — the direction does not matter. For when the movement does not come out the same way twice.",
    rule: {
      source: { kind: "filter", metric: "tilt" }, abs: false, cmp: ">", threshold: 40,
      thresholdHi: null, behavior: "once"
    }
  },
  {
    // PRÓG, NIE ZAKRES. Kusi, żeby napisać „od 25° do 65°" i tak było w pierwszej wersji — ale
    // zakres każe trafić DWA razy: nie przechylić za mało ORAZ nie za mocno. Komu drży ręka,
    // ten przestrzeli górną granicę i nie dostanie nic, bez słowa wyjaśnienia. Zakres ma sens
    // wyłącznie wtedy, gdy na jednej osi mają siedzieć dwa różne wyzwalacze („lekko" i „mocno").
    key: "hold-right", wymaga: "ruch", label: "Przytrzymane przechylenie w prawo",
    labelEn: "A held lean to the right",
    // ⚠️ OPIS MUSI MÓWIĆ O OPÓŹNIENIU. Przytrzymanie z natury WYSYŁA SYGNAŁ PÓŹNIEJ — półtorej
    // sekundy po tym, jak ruch się zaczął. Przy „Zatrzymaj" i „Cofnij" to nie ma znaczenia, ale
    // przy „Sygnał" pasek przez ten czas jedzie dalej, a poprawka „wyprzedzenie" sięga tylko
    // 600 ms. Pierwsza wersja opisu mówiła „nie musisz trafić w moment" i było to zdanie prawdziwe
    // o ODPORNOŚCI NA DRŻENIE, a fałszywe o CELOWANIU — czyli mylące dokładnie tam, gdzie boli.
    desc: "Przechyl w bok i wytrzymaj półtorej sekundy. Nie musisz trafić w moment — ale sygnał idzie dopiero po tym czasie, więc przy jadącym pasku trzeba zacząć wcześniej. Najlepiej sprawdza się przy „Cofnij” i „Zatrzymaj”, a przy „Sygnał” — z wolnym paskiem.",
    descEn: "Lean sideways and hold it for a second and a half. You do not have to catch a moment — but the signal only goes after that time, so with a moving bar you have to start early. It suits Step back and Stop best; for Signal, pair it with a slow bar.",
    rule: {
      source: { kind: "filter", metric: "roll" }, abs: false, cmp: ">", threshold: 25,
      thresholdHi: null, behavior: "dwell", dwellMs: 1500
    }
  },
  {
    key: "hold-nod", wymaga: "ruch", label: "Przytrzymane skinienie", labelEn: "A held nod",
    desc: "Pochyl do przodu i wytrzymaj półtorej sekundy. Przypadkowe kiwnięcie nie wystarczy — ale sygnał idzie dopiero po tym czasie, więc przy jadącym pasku trzeba zacząć wcześniej.",
    descEn: "Tip forward and hold it for a second and a half. An accidental nod is not enough — but the signal only goes after that time, so with a moving bar you have to start early.",
    rule: {
      source: { kind: "filter", metric: "pitch" }, abs: false, cmp: ">", threshold: 20,
      thresholdHi: null, behavior: "dwell", dwellMs: 1500
    }
  },
  {
    // 900 LSB to ta sama liczba, przy której filtr uznaje kapsel za nieruchomy i zeruje dryf
    // żyroskopu (`STILL_GYRO` w ribbitflip_monitor.py) — czyli próg ciszy zmierzony przez sprzęt,
    // a nie wymyślony tutaj. `dwell` strzela RAZ na epizod i uzbraja się dopiero po ruchu, więc
    // kapsel leżący na stole nie zamienia się w powtarzacz — ale JEDEN sygnał i tak wyśle, i to
    // trzeba powiedzieć wprost, bo inaczej wygląda na awarię.
    key: "still", wymaga: "ruch", label: "Znieruchomienie", labelEn: "Going still",
    desc: "Przestań się ruszać na dwie i pół sekundy. Dla kogoś, komu ruch przychodzi sam, a bezruch jest wysiłkiem — więc znaczy „chcę”. Sygnał idzie po tym czasie, więc do „Sygnał” nadaje się tylko przy wolnym pasku; do „Cofnij” i „Zatrzymaj” pasuje zawsze. Uwaga: odłożony kapsel też znieruchomieje i raz zadziała.",
    descEn: "Stop moving for two and a half seconds. For anybody whose movement comes by itself and whose stillness is the effort — so stillness is what means “yes”. The signal goes after that time, so for Signal it only suits a slow bar; for Step back and Stop it always fits. Note: a capsule you put down goes still too, and will fire once.",
    rule: {
      source: { kind: "filter", metric: "spin" }, abs: false, cmp: "<", threshold: 900,
      thresholdHi: null, behavior: "dwell", dwellMs: 2500
    }
  }
];

// Nazwa i opis gotowca w języku panelu. Gotowce z `GESTURE_PRESETS` (rf-12c) nie mają pary
// angielskiej — tam napisy są polskie i tłumaczy je walker i18n po kluczu; tu wychodzą przez
// `_scanT`, który przy braku drugiej wersji odda pierwszą.
function _skanNazwa(z) { return _scanT(z.label, z.labelEn || z.label); }
function _skanOpis(z) { return _scanT(z.desc || "", z.descEn || z.desc || ""); }

/* Trzy role. Nie „lista reguł z rozwijakiem roli" — trzy pudełka, bo pytanie człowieka brzmi
   „czym robię TO", a nie „co robi ta reguła". Przy okazji widać, czego jeszcze nie ma: para
   sygnał + cofnij to jeden akt konfiguracji, a pomyłka bez cofania znaczy czekanie na kolejny
   przebieg paska. */
const SKAN_SYGNALY = [
  {
    spec: "scan:sygnal", ikona: "🎯",
    pl: "Sygnał", en: "Signal",
    celPl: "zatrzymuje pasek i wybiera", celEn: "stops the bar and picks",
    pustoPl: "Bez tego skaner nie ruszy. To jest ten jeden ruch, którym prowadzisz wszystko.",
    pustoEn: "Without this the scanner will not move. This is the one movement that drives everything."
  },
  {
    spec: "scan:cofnij", ikona: "↶",
    pl: "Cofnij", en: "Step back",
    celPl: "wraca o krok, gdy pasek uciekł", celEn: "goes back a step when the bar overshot",
    pustoPl: "Warto mieć. Bez cofania pomyłka znaczy czekanie na kolejny przebieg paska.",
    pustoEn: "Worth having. Without it a mistake means waiting for the bar to come round again."
  },
  {
    spec: "scan:stop", ikona: "⏹",
    pl: "Zatrzymaj", en: "Stop",
    celPl: "przerywa skanowanie", celEn: "breaks off scanning",
    // ⚠️ NIE piszemy tu „wyjście awaryjne" ani „przechodzi zawsze". Zatrzymanie faktycznie nie
    // pyta o włącznik modułu Skaner (`_gate_for` przepuszcza `scan:stop`), ale przechodzi przez
    // te same dwie bramki, co każda inna akcja: główny przełącznik wyjścia („Wstrzymane") i sam
    // emiter klawiszy. Nazwanie go wyjściem awaryjnym byłoby obietnicą, której ta droga nie
    // spełnia — a człowiek, który na niej polega, dowiedziałby się o tym w najgorszej chwili.
    pustoPl: "Przerywa jazdę paska. Nie pyta o włącznik modułu — ale jak każda akcja potrzebuje włączonego głównego przełącznika wyjścia.",
    pustoEn: "Breaks off the sweep. It does not ask about the module switch — but like every action it needs the master output switch to be on."
  }
];

// Który sygnał ma teraz otwarty panel dodawania. Jeden naraz — dwa otwarte pytałyby o to samo.
let _skanDodajDo = null;
// Co jest wybrane w rozwijakach panelu. Trzymane POZA drzewem DOM, bo sekcja przerysowuje się
// z wielu powodów (echo reguł ze strumienia, zmiana języka, przełącznik modułu), a wybór człowieka
// nie może przy tym zniknąć. Bez tego trzeba by blokować odświeżanie przy otwartym panelu — a to
// gubiło „↶ Cofnij" po skasowaniu wyzwalacza.
let _skanWybRuch = "";
let _skanWybRef = "";

/* Zachowanie i czasy dla wyzwalacza POŁĄCZONEGO z innym.
   `source.kind:"trigger"` czyta w silniku SUROWY STAN WARUNKU tamtej reguły (`over`), a nie
   chwilę, w której tamta reguła wystrzeliła. Dla „jednorazowo" to jedno i to samo, ale przy
   „po odczekaniu" i przy liczeniu puknięć `over` zapala się na pierwszym zboczu — DŁUGO przed
   akcją. Gdyby nasza reguła stała sztywno na „jednorazowo", połączenie z wyzwalaczem
   „Długie przytrzymanie przycisku" (0,6 s) strzelałoby przy najlżejszym muśnięciu, a połączenie
   z „Podwójnym kliknięciem" — przy pierwszym kliknięciu. Zabezpieczenie, dla którego ktoś ten
   wyzwalacz zrobił, zniknęłoby bez słowa. Dlatego przepisujemy zachowanie ODMIERZAJĄCE CZAS
   albo LICZĄCE (`dwell`, `multi`, `taps`) wraz z jego czasami.
   Reszta (`hold`, `continuous`, `latch`) celowo NIE — sygnał skanera jest impulsem i nie ma czego
   trzymać; `hold` przy akcji nieprzytrzymywalnej po cichu zamienia się w powtarzanie co
   `intervalMs`, czyli w powtarzacz zamiast wyzwalacza. */
function _skanZachowanieZa(x) {
  const b = String((x && x.behavior) || "once");
  if (b === "dwell") return { behavior: "dwell", dwellMs: (x.dwellMs != null ? x.dwellMs : 500) };
  if (b === "multi" || b === "taps") {
    return {
      behavior: b,
      crossings: (x.crossings != null ? x.crossings : 2),
      windowMs: (x.windowMs != null ? x.windowMs : 600)
    };
  }
  return { behavior: "once" };
}

function _skanZrodla() {
  const gp = (typeof GESTURE_PRESETS !== "undefined") ? GESTURE_PRESETS : [];
  // Gotowce Mapowania nie mają pola `wymaga` — wyliczamy je z reguły, żeby katalog pozostał jeden
  // i żeby dopisanie pozycji tam nie wymagało pamiętania o tym pliku.
  return SKAN_ZRODLA_WLASNE.concat(gp.map(function (z) {
    const kind = ((z.rule || {}).source || {}).kind;
    return Object.assign({}, z, { wymaga: z.wymaga || (kind === "button" ? "przycisk" : kind === "gesture" ? "nagranie" : "ruch") });
  }));
}

function scanSignalsHtml() {
  // Sama skorupa. Treść buduje `scanSignalsSync()` — patrz uwaga o języku w nagłówku pliku.
  // Piętro 2 (UX 261120 L4d): blok to zwinięty zwijak, a jego nagłówek mówi, czym są dziś ustawione
  // trzy role (`_skanPodsumowanie`). Brak sygnału widać też w linii gotowości, a jej „Ustaw sygnał”
  // otwiera ten zwijak (rf-50d). Tytuł pisze `scanSignalsSync` w obu językach, stąd data-noi18n.
  return `<details class="cardfold inset sk-sygnaly" id="scanSygnalFold"><summary><span id="scanSignalsTytul" data-noi18n>Czym sterujesz skanerem</span></summary>
    <div class="cardfold-body"><div class="sk-wyzw" id="scanSignals"></div></div></details>`;
}

/* Nagłówek zwiniętego bloku: rola i pierwszy czynny wyzwalacz („Sygnał: Puknięcie · Cofnij: brak”). */
function _skanPodsumowanie() {
  return SKAN_SYGNALY.map(function (rola) {
    const r = _skanReguly(rola.spec).filter(function (x) { return x.enabled !== false; });
    const nazwa = r.length ? _skanOpisZrodla(r[0]) + (r.length > 1 ? " +" + (r.length - 1) : "") : _scanT("brak", "none");
    return _scanT(rola.pl, rola.en) + ": " + nazwa;
  }).join(" · ");
}
let _skanFoldSync = null;

/* Reguły TEGO kapsla, których akcją jest sygnał skanera. Czytamy ze `state.rules`, czyli z tego
   samego miejsca, z którego czyta Mapowanie — nie z własnej kopii. */
// ⚠️ PORÓWNANIE BEZ WIELKOŚCI LITER. `specIsScan` (rf-10) używa `/^scan:/i`, więc reguła zapisana
// jako „Scan:sygnal" — a taka przyjeżdża z cudzego pliku przez import — jest dla reszty aplikacji
// w pełni prawidłowym sygnałem skanera. Porównanie dosłowne wyrzucało ją ze WSZYSTKICH trzech
// pudełek i JEDNOCZEŚNIE wycinało z listy „wyzwalacz, który już masz": reguła działała, a w panelu
// nie było jej nigdzie.
function _skanReguly(spec) {
  const r = Array.isArray(state.rules) ? state.rules : [];
  return r.filter(function (x) {
    if (!x || typeof specIsScan !== "function" || !specIsScan(x.keySpec)) return false;
    return spec ? (String(x.keySpec).trim().toLowerCase() === spec) : true;
  });
}

/* Jak nazwać regułę. Świadomie TYMI SAMYMI słowami, co Mapowanie (`ruleSrcLabel` z rf-10), a nie
   własnym słownikiem: człowiek, którego za chwilę tam przeniesiemy, ma zobaczyć ten sam napis.
   Poprzednia wersja miała własną tablicę, w której „Pochylenie" znaczyło `pitch`, podczas gdy
   w Mapowaniu to samo słowo znaczy `tilt`. */
function _skanOpisZrodla(r) {
  const etykieta = String((r && r.label) || "").trim();
  if (etykieta) return etykieta;
  if (typeof ruleSrcLabel === "function") return ruleSrcLabel(r);
  return _scanT("Wyzwalacz", "Trigger");
}

/* Czy ten wyzwalacz JEST DZIŚ MARTWY — i dlaczego. Reguła może być spełniona i nie zrobić nic
   z dwóch powodów, których po samej nazwie nie widać: jest wyłączona albo siedzi na warstwie innej
   niż aktywna (silnik traktuje taką DOKŁADNIE jak wyłączoną — zwalnia trzymane klawisze, zeruje
   liczniki, gasi przełącznik). Bez tej etykiety człowiek łączy się z wyzwalaczem, który nigdy nie
   zadziała, i nie ma jak się o tym dowiedzieć inaczej niż próbując na sobie. */
function _skanMartwa(r) {
  if (!r) return "";
  if (r.enabled === false) return _scanT("wyciszony", "muted");
  if (typeof ruleOffLayer === "function" && ruleOffLayer(r)) {
    return _scanT("warstwa ", "layer ") + (+(r.layer || 0));
  }
  return "";
}

/* Druga linijka wiersza: warunek i zachowanie, tak jak widać je w Mapowaniu.
   Przy wyzwalaczu POŁĄCZONYM z innym (`source.kind:"trigger"`) warunek brzmi dokładnie tak samo,
   jak nazwa wiersza („⟶ Moje skinienie"), bo obie składa ten sam `ruleRefLabel`. Powtórzone pod
   sobą wygląda jak usterka renderowania, więc wtedy zostaje samo zachowanie. */
function _skanOpisJak(r, nazwa) {
  const cz = [];
  if (typeof ruleCondLabel === "function") {
    const w = ruleCondLabel(r);
    if (w && w !== nazwa) cz.push(w);
  }
  if (typeof ruleBehLabel === "function") cz.push(ruleBehLabel(r));
  // Powód martwoty na SAMYM KOŃCU, bo to informacja o stanie, nie o ruchu — ale w tej samej
  // linijce, żeby dało się ją przeczytać bez szukania.
  const martwa = _skanMartwa(r);
  if (martwa) cz.push("⚠ " + martwa);
  return cz.filter(Boolean).join(" · ");
}

/* Czy moduł, od którego zależy ten sygnał, jest włączony. `scan:` odpowiada na włącznik MODUŁU
   Skaner, a NIE na grupę „Mapowanie" — poprzednia wersja ostrzegała o tej drugiej i mówiła
   człowiekowi nieprawdę. `scan:stop` przechodzi zawsze, bo awaryjne zatrzymanie nie może zależeć
   od tego, co ktoś wcześniej wyłączył.

   ⚠️ PYTAMY O STAN, NIE O KLASĘ CSS. Pierwsza wersja czytała `.on` z `#scanEnable` i pokazywała
   ostrzeżenie ZAWSZE przy pierwszym wejściu w zakładkę: karta rysuje się przed odpowiedzią
   serwera na `GET /scan`, a klasę dokłada dopiero `_scanRysujWlacznik()` po tej odpowiedzi.
   `_SCAN.enabled` jest jedyną prawdą — a `scanCfgArrived` i `_scanRysujWlacznik` wołają teraz
   `scanSignalsSync()`, więc pas pojawia się i znika w tej samej chwili, co przełącznik. */
function _skanModulWlaczony() {
  if (typeof _SCAN === "object" && _SCAN && typeof _SCAN.enabled === "boolean") return _SCAN.enabled;
  const w = document.getElementById("scanEnable");
  if (!w) return true;
  return w.classList.contains("on") || !!w.checked;
}

/* ------------------------------------------------------------------------------------------
   PRZENIESIENIE DO MAPOWANIA
   ------------------------------------------------------------------------------------------
   `openEditor` może NAJPIERW zapytać „Porzucić niezapisany wyzwalacz?" i zwraca obietnicę z tym,
   czy drzwi faktycznie się otworzyły. Dlatego na zakładkę przechodzimy PO odpowiedzi — inaczej
   „Wróć do edycji" zostawiałoby człowieka w Mapowaniu, którego nie wybierał. Celowanie nowej
   reguły idzie przez `after(d)` (wzorzec z rf-43): ustawienie `keySpec` zaraz po wywołaniu
   trafiłoby w STARY szkic, a odświeżony `_draftBase` sprawia, że akcja wpisana przez aplikację
   nie liczy się jako zmiana człowieka. */
function _skanDoMapowania() {
  const b = document.querySelector('[data-tab="mapowanie"]');
  if (b) b.click();
  const ed = document.getElementById("ruleEditor");
  if (ed && ed.scrollIntoView) try { ed.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) { }
}

/* „Wróć do edycji" TEŻ PRZENOSI DO MAPOWANIA — i to nie jest niekonsekwencja.
   `openEditor` zwraca `false`, gdy człowiek odpowiedział, że chce zostać przy niezapisanym szkicu.
   Ten szkic stoi w edytorze, w zakładce Mapowanie. Zatrzymanie się wtedy na karcie skanera dawało
   kliknięcie, po którym NIC się nie działo i nic tego nie tłumaczyło — a „wróć do edycji" znaczy
   dosłownie „zabierz mnie do tamtej edycji". Więc zabieramy, tylko nie na nową regułę. */
function _skanNiezapisany() {
  _skanDoMapowania();
  _scanToast(_scanT("Najpierw dokończ wyzwalacz, który masz otwarty w Mapowaniu.",
    "Finish the trigger you have open in Mapping first."));
}

function _skanEdytujWMapowaniu(r) {
  if (typeof openEditor !== "function") { _skanDoMapowania(); return; }
  Promise.resolve(openEditor(r)).then(function (ok) {
    if (ok === false) { _skanNiezapisany(); return; }
    _skanDoMapowania();
  });
}

function _skanNowyWMapowaniu(spec) {
  if (typeof openEditor !== "function") {
    _scanToast(_scanT("Edytor Mapowania nie jest gotowy.", "The Mapping editor is not ready."));
    return;
  }
  Promise.resolve(openEditor(null, function (d) {
    d.keySpec = spec;
    // `noAction` musi zostać fałszem: akcję WŁAŚNIE nadaliśmy, a flaga znaczy świadome
    // „nic nie naciskam" i tylko namieszałaby przy zapisie.
    d.noAction = false;
    state._draftBase = JSON.stringify(d);
    if (typeof renderEditor === "function") renderEditor();
    if (typeof _edFocusFirst === "function") _edFocusFirst();
  })).then(function (ok) {
    if (ok === false) { _skanNiezapisany(); return; }
    _skanDoMapowania();
    _scanToast(_scanT("Ustaw ruch i zapisz — wrócisz tu gotowym wyzwalaczem.",
      "Set the movement and save — you will come back here with a finished trigger."));
  });
}

/* ------------------------------------------------------------------------------------------
   BUDOWANIE REGUŁY
   ------------------------------------------------------------------------------------------
   Jedno miejsce, w którym powstaje PEŁNY kształt reguły. Pole pominięte tutaj zapisuje się jako
   `undefined` i wraca z serwera jako coś innego — sanityzator buduje nowy słownik z zamkniętej
   listy kluczy i robi to BEZ jednego błędu w konsoli. */
function _skanNowaRegula(spec, szkic, etykieta) {
  const r = szkic || {};
  return {
    id: "scan-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    label: etykieta || "", enabled: true,
    source: JSON.parse(JSON.stringify(r.source || { kind: "button", any: true, holdMs: 250 })),
    abs: !!r.abs, cmp: r.cmp || ">", threshold: (r.threshold != null ? r.threshold : 0),
    thresholdHi: (r.thresholdHi != null ? r.thresholdHi : null), neg: false,
    extraConditions: [], match: "all", layer: 0,
    keySpec: spec, sequence: "", glow: true, noAction: false,
    behavior: r.behavior || "once",
    windowMs: (r.windowMs != null ? r.windowMs : 600),
    crossings: (r.crossings != null ? r.crossings : 1),
    dwellMs: (r.dwellMs != null ? r.dwellMs : 600),
    intervalMs: (r.intervalMs != null ? r.intervalMs : 100)
  };
}

/* Czy nowy wyzwalacz odpala się TYM SAMYM RUCHEM, co któryś z już przypisanych — tylko do innej
   roli. To jest pułapka wpisana w sam katalog: „Przechylenie w prawo" (roll > 35) i „Przytrzymane
   przechylenie w prawo" (roll > 25) to dla kapsla jeden i ten sam ruch. Kto doda pierwsze do
   „Sygnał", a drugie do „Cofnij", tym jednym przechyleniem zrobi obie rzeczy naraz i zobaczy pasek
   zachowujący się losowo. Nie blokujemy — bywa to świadomy wybór, np. przy różnych progach — ale
   trzeba to powiedzieć w chwili, w której się dzieje. */
function _skanKolizja(nowa) {
  const src = (nowa && nowa.source) || {};
  if (src.kind !== "filter") return null;
  const kier = String(nowa.cmp || ">").indexOf("<") >= 0 ? "-" : "+";
  const spec = String(nowa.keySpec || "").toLowerCase();
  let trafiona = null;
  _skanReguly().forEach(function (x) {
    if (trafiona || !x || x.id === nowa.id) return;
    const s = x.source || {};
    if (s.kind !== "filter" || s.metric !== src.metric) return;
    if (String(x.keySpec || "").toLowerCase() === spec) return;     // ta sama rola — to nie kolizja
    const k = String(x.cmp || ">").indexOf("<") >= 0 ? "-" : "+";
    if (k === kier) trafiona = x;
  });
  return trafiona;
}

function _skanDopisz(regula) {
  if (!Array.isArray(state.rules)) state.rules = [];
  state.rules.push(regula);
  if (typeof commitRules === "function") commitRules();
  _skanDodajDo = null;
  _skanWybRuch = "";
  _skanWybRef = "";
  scanSignalsSync();
  const zderzenie = _skanKolizja(regula);
  if (zderzenie) {
    _scanToast(_scanT(
      "Uwaga: „" + _skanOpisZrodla(zderzenie) + "” odpala się tym samym ruchem. Jeden ruch zrobi dwie rzeczy naraz.",
      "Careful: “" + _skanOpisZrodla(zderzenie) + "” goes off on the same movement. One movement will do two things at once."));
  }
}

/* ------------------------------------------------------------------------------------------
   RYSOWANIE
   ------------------------------------------------------------------------------------------ */
function _skanPrzycisk(klasa, napis, tytul, onClick, fk) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = klasa;
  b.textContent = napis;
  if (tytul) { b.title = tytul; b.setAttribute("aria-label", tytul); }
  if (fk) b.dataset.fk = fk;
  b.addEventListener("click", onClick);
  return b;
}

/* FOKUS PRZEŻYWA PRZERYSOWANIE.
   Każda akcja w tej sekcji przebudowuje ją przez `innerHTML = ""`, więc element, na którym stało
   skupienie klawiatury, przestaje istnieć i fokus spada na `<body>`. Dla kogokolwiek, kto chodzi
   po panelu Tabem — a to jest sekcja pisana dla ludzi, którzy myszy mogą nie mieć — znaczy to
   powrót na początek dokumentu po KAŻDYM kliknięciu przełącznika. Stąd `data-fk`: trwały
   identyfikator kontrolki, po którym odnajdujemy ją w nowym drzewie.
   ⚠️ Klucz musi przeżyć zmianę stanu, więc nie może go opisywać („przel-on"); opisuje MIEJSCE. */
function _skanZapamietajFokus() {
  const a = document.activeElement;
  const host = document.getElementById("scanSignals");
  if (!a || !host || !host.contains(a)) return null;
  return a.dataset ? (a.dataset.fk || null) : null;
}

function _skanPrzywrocFokus(fk) {
  if (!fk) return;
  const host = document.getElementById("scanSignals");
  if (!host) return;
  const el = host.querySelector('[data-fk="' + fk.replace(/"/g, '\\"') + '"]');
  if (el && el.focus) try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) { } }
}

/* ⚠️ WIERSZ TRZYMA `id`, NIGDY OBIEKTU REGUŁY — i to nie jest ostrożność na wyrost.
   Strumień serwera przysyła komunikat `rules` z PEŁNĄ listą i rf-08 podmienia wtedy CAŁĄ tablicę:
   `state.rules = D.rules`. Nowe obiekty, nowe referencje. Przychodzi to m.in. jako echo naszego
   własnego zapisu, czyli ułamek sekundy po każdym dodaniu wyzwalacza. Wiersz, który zamknął
   w domknięciu `r`, od tej chwili przestawia SIEROTĘ: `r.enabled = false` wykonuje się bez błędu,
   `commitRules()` wysyła niezmienioną listę i przełącznik wraca na swoje miejsce, jakby kliknięcia
   nie było. Złapał to dopiero harness klikający naprawdę — bo w konsoli nie pada ani jedno słowo. */
function _skanRegula(id) {
  return (Array.isArray(state.rules) ? state.rules : []).find(function (x) { return x && x.id === id; });
}

function _skanWiersz(rWej) {
  const id = rWej.id;
  const r = rWej;
  const w = document.createElement("div");
  w.className = "sk-sygnal" + (r.enabled ? "" : " sk-sygnal-off");

  const przel = _skanPrzycisk(
    "sk-przel sk-przel-maly" + (r.enabled ? " sk-wl" : ""), "",
    _scanT("Włącz albo wycisz ten wyzwalacz", "Switch this trigger on or mute it"),
    function () {
      const x = _skanRegula(id);
      if (!x) { scanSignalsSync(); return; }
      x.enabled = !x.enabled;
      if (typeof commitRules === "function") commitRules();
      scanSignalsSync();
    }, "przel:" + id);
  przel.innerHTML = '<span class="sk-przel-galka"></span>';
  przel.setAttribute("role", "switch");
  przel.setAttribute("aria-checked", r.enabled ? "true" : "false");

  const tekst = document.createElement("div");
  tekst.className = "sk-sygnal-tekst";
  const opisNazwy = _skanOpisZrodla(r);
  const nazwa = document.createElement("span");
  nazwa.className = "sk-sygnal-zrodlo";
  nazwa.textContent = opisNazwy;
  nazwa.title = opisNazwy;
  const jak = document.createElement("span");
  jak.className = "sk-sygnal-jak";
  // Kolumna ma 340 px, więc dłuższy warunek jest ucinany wielokropkiem (CSS). Dymek z pełnym
  // tekstem jest tu jedyną drogą do reszty zdania — bez niego „po 1500 ms spe…" nie znaczy nic.
  jak.textContent = _skanOpisJak(r, opisNazwy);
  jak.title = jak.textContent;
  tekst.appendChild(nazwa);
  tekst.appendChild(jak);

  const edy = _skanPrzycisk("btn sm sk-sygnal-edyt", "✎",
    _scanT("Otwórz ten wyzwalacz w Mapowaniu — próg, czas, warunki dodatkowe",
      "Open this trigger in Mapping — threshold, timing, extra conditions"),
    function () {
      const x = _skanRegula(id);
      if (!x) { scanSignalsSync(); return; }
      _skanEdytujWMapowaniu(x);
    }, "edyt:" + id);

  const usun = _skanPrzycisk("btn sm sk-sygnal-usun", "✕",
    _scanT("Usuń ten wyzwalacz — zniknie też z Mapowania (da się cofnąć)",
      "Delete this trigger — it goes from Mapping too (can be undone)"),
    function () {
      const x = _skanRegula(id);
      if (!x) { scanSignalsSync(); return; }
      // Kasowanie jest PRAWDZIWE: ta reguła żyje w Mapowaniu. Idzie tą samą drogą, co kosz
      // w Mapowaniu i w Kontrolerze — z toastem „↶ Cofnij", bo odwracalność jest lepszą
      // ochroną niż pytanie, na które i tak odpowiada się odruchowo.
      //
      // ⚠️ JEDEN WYJĄTEK, I TO NIE Z OSTROŻNOŚCI. „↶ Cofnij" żyje osiem sekund w bąbelku, który
      // trzeba KLIKNĄĆ. Osoba sterująca komputerem wyłącznie skanerem właśnie skasowała jedyny
      // sposób, żeby cokolwiek kliknąć — bąbelek jest dla niej nieosiągalny z definicji. Tu i tylko
      // tu pytamy najpierw, bo cofnięcia realnie nie ma.
      const ostatniSygnal = String(x.keySpec || "").trim().toLowerCase() === "scan:sygnal"
        && x.enabled !== false
        && _skanReguly("scan:sygnal").filter(function (y) { return y.enabled !== false; }).length <= 1;
      const kasuj = function () {
        if (typeof ruleDeleteWithUndo === "function") { ruleDeleteWithUndo(x); scanSignalsSync(); return; }
        const i = state.rules.indexOf(x);
        if (i >= 0) state.rules.splice(i, 1);
        if (typeof commitRules === "function") commitRules();
        scanSignalsSync();
      };
      if (!ostatniSygnal || typeof rfConfirm !== "function") { kasuj(); return; }
      rfConfirm(_scanT(
        "To jedyny sposób, w jaki dajesz skanerowi sygnał. Po usunięciu nie będzie czym go prowadzić — a „↶ Cofnij” trzeba kliknąć w ciągu ośmiu sekund.",
        "This is the only way you give the scanner a signal. With it gone there is nothing left to drive it — and “↶ Undo” has to be clicked within eight seconds."),
        {
          tone: "danger",
          confirmLabel: _scanT("Usuń mimo to", "Delete anyway"),
          cancelLabel: _scanT("Zostaw", "Keep it")
        }).then(function (ok) { if (ok) kasuj(); });
    }, "usun:" + id);

  w.appendChild(przel);
  w.appendChild(tekst);
  w.appendChild(edy);
  w.appendChild(usun);
  return w;
}

/* Panel dodawania: trzy drzwi, każde z jednym zdaniem o tym, co się stanie. Rozwija się pod
   pudełkiem TEJ roli, więc nie trzeba osobno pytać „do czego to przypisać" — odpowiedzią jest
   miejsce, w które człowiek kliknął. */
function _skanPanelDodaj(spec) {
  const p = document.createElement("div");
  p.className = "sk-dodaj";

  // ① GOTOWY RUCH
  const d1 = document.createElement("div");
  d1.className = "sk-drzwi";
  d1.appendChild(_skanNaglowekDrzwi(_scanT("① Gotowy ruch", "① A ready-made movement")));
  const rzad1 = document.createElement("div");
  rzad1.className = "sk-drzwi-rzad";
  const selRuch = document.createElement("select");
  selRuch.className = "sk-wybor";
  selRuch.setAttribute("aria-label", _scanT("Wybierz gotowy ruch", "Choose a ready-made movement"));
  const pusty = document.createElement("option");
  pusty.value = "";
  pusty.textContent = _scanT("— wybierz ruch —", "— choose a movement —");
  selRuch.appendChild(pusty);
  // Grupy, a nie jedna płachta: człowiek bez możliwości naciśnięcia ma zobaczyć SWOJE drogi jako
  // pierwsze, zamiast trafiać na domyślne „Puknięcie w kapsel" — czyli dokładnie to, czego
  // zrobić nie może.
  const grupy = [
    { wymaga: "ruch", label: _scanT("Sam ruch kapsla — bez naciskania", "Capsule movement only — nothing to press") },
    { wymaga: "przycisk", label: _scanT("Wymaga przycisku na kapslu", "Needs the button on the capsule") },
    { wymaga: "nagranie", label: _scanT("Twój własny, nagrany gest", "Your own recorded gesture") }
  ];
  const zrodla = _skanZrodla();
  grupy.forEach(function (g) {
    const lista = zrodla.filter(function (z) { return z.wymaga === g.wymaga; });
    if (!lista.length) return;
    const og = document.createElement("optgroup");
    og.label = g.label;
    lista.forEach(function (z) {
      const o = document.createElement("option");
      o.value = z.key;
      o.textContent = _skanNazwa(z);
      og.appendChild(o);
    });
    selRuch.appendChild(og);
  });
  selRuch.value = _skanWybRuch;                  // przetrwa przerysowanie — patrz `_skanWybRuch`
  selRuch.dataset.fk = "sel1";
  // Opis wybranego ruchu NIE JEST ozdobą: mówi, czego ten wyzwalacz wymaga i gdzie przestaje być
  // dobrym pomysłem („sygnał idzie dopiero po tym czasie…"). Bez `aria-describedby` czytnik ekranu
  // przeczyta samą nazwę z listy i zgubi całe ostrzeżenie.
  selRuch.setAttribute("aria-describedby", "scanDrzwi1Opis");
  const domyslnyOpis = _scanT("Reguła powstanie gotowa — z progiem i czasem. Poprawisz ją później w Mapowaniu.",
    "The rule is created complete, threshold and timing included. You can refine it later in Mapping.");
  const opis1 = document.createElement("div");
  opis1.className = "sk-drzwi-opis";
  opis1.id = "scanDrzwi1Opis";
  opis1.setAttribute("aria-live", "polite");
  const odswiezOpis1 = function () {
    const z = zrodla.find(function (x) { return x.key === selRuch.value; });
    opis1.textContent = z ? _skanOpis(z) : domyslnyOpis;
  };
  odswiezOpis1();
  selRuch.addEventListener("change", function () { _skanWybRuch = selRuch.value; odswiezOpis1(); });
  const btn1 = _skanPrzycisk("btn sm", _scanT("Dodaj", "Add"), "", function () {
    const z = zrodla.find(function (x) { return x.key === selRuch.value; });
    if (!z) { _scanToast(_scanT("Najpierw wybierz ruch z listy.", "Pick a movement from the list first.")); return; }
    _skanDopisz(_skanNowaRegula(spec, z.rule, _skanNazwa(z)));
  });
  rzad1.appendChild(selRuch);
  rzad1.appendChild(btn1);
  d1.appendChild(rzad1);
  d1.appendChild(opis1);
  p.appendChild(d1);

  // ② TO, CO JUŻ MASZ
  const inne = (Array.isArray(state.rules) ? state.rules : []).filter(function (x) {
    return x && !(typeof specIsScan === "function" && specIsScan(x.keySpec));
  });
  const d2 = document.createElement("div");
  d2.className = "sk-drzwi";
  d2.appendChild(_skanNaglowekDrzwi(_scanT("② Wyzwalacz, który już masz", "② A trigger you already have")));
  if (!inne.length) {
    const pustoTxt = document.createElement("div");
    pustoTxt.className = "sk-drzwi-opis";
    pustoTxt.textContent = _scanT("Nie masz jeszcze żadnego innego wyzwalacza w Mapowaniu.",
      "You have no other trigger in Mapping yet.");
    d2.appendChild(pustoTxt);
  } else {
    const rzad2 = document.createElement("div");
    rzad2.className = "sk-drzwi-rzad";
    const selRef = document.createElement("select");
    selRef.className = "sk-wybor";
    selRef.dataset.fk = "sel2";
    selRef.setAttribute("aria-describedby", "scanDrzwi2Opis");
    selRef.setAttribute("aria-label", _scanT("Wybierz istniejący wyzwalacz", "Choose an existing trigger"));
    const p0 = document.createElement("option");
    p0.value = "";
    p0.textContent = _scanT("— wybierz wyzwalacz —", "— choose a trigger —");
    selRef.appendChild(p0);
    inne.forEach(function (x) {
      const o = document.createElement("option");
      o.value = x.id;
      // Powód martwoty PRZY NAZWIE, nie po fakcie: połączenie z wyciszonym wyzwalaczem albo
      // z takim spod innej warstwy jest martwe od pierwszej chwili i nic innego tego nie mówi.
      const m = _skanMartwa(x);
      o.textContent = _skanOpisZrodla(x) + (m ? "  ⚠ " + m : "");
      selRef.appendChild(o);
    });
    selRef.value = _skanWybRef;
    selRef.addEventListener("change", function () { _skanWybRef = selRef.value; });
    const btn2 = _skanPrzycisk("btn sm", _scanT("Połącz", "Link"), "", function () {
      // Po `id` i ze ŚWIEŻEJ listy — patrz uwaga przy `_skanRegula`: tablica reguł bywa podmieniana
      // pod nami przez strumień, a `inne` to migawka z chwili rysowania panelu.
      const x = _skanRegula(selRef.value);
      if (!x) { _scanToast(_scanT("Najpierw wybierz wyzwalacz z listy.", "Pick a trigger from the list first.")); return; }
      // Etykieta zostaje PUSTA celowo: `ruleSrcLabel` narysuje wtedy „⟶ <nazwa tamtej reguły>",
      // więc zmianę nazwy tamtego wyzwalacza od razu widać i tutaj.
      _skanDopisz(_skanNowaRegula(spec, Object.assign({
        source: { kind: "trigger", ref: x.id }, cmp: ">", threshold: 0
      }, _skanZachowanieZa(x)), ""));
    });
    rzad2.appendChild(selRef);
    rzad2.appendChild(btn2);
    d2.appendChild(rzad2);
  }
  const opis2 = document.createElement("div");
  opis2.className = "sk-drzwi-opis";
  opis2.id = "scanDrzwi2Opis";
  opis2.textContent = _scanT(
    "Skaner zacznie chodzić za tamtym wyzwalaczem — razem z jego odczekaniem i liczeniem powtórzeń. Tamten dalej robi swoje, nic mu nie zabieramy. Stroisz go raz, w jednym miejscu, a zmiana działa wszędzie. Tędy podepniesz też nagrany wcześniej gest.",
    "The scanner will follow that trigger — including its wait and its counting of repeats. It keeps doing its own job; we take nothing away from it. You tune it once, in one place, and the change applies everywhere. This is also the way to use a gesture you recorded earlier.");
  d2.appendChild(opis2);
  p.appendChild(d2);

  // ③ WŁASNY
  const d3 = document.createElement("div");
  d3.className = "sk-drzwi";
  d3.appendChild(_skanNaglowekDrzwi(_scanT("③ Zupełnie własny", "③ One of your own")));
  const rzad3 = document.createElement("div");
  rzad3.className = "sk-drzwi-rzad";
  rzad3.appendChild(_skanPrzycisk("btn sm sk-drzwi-szeroki",
    _scanT("Ustaw w Mapowaniu →", "Set it up in Mapping →"), "",
    function () { _skanNowyWMapowaniu(spec); }));
  d3.appendChild(rzad3);
  const opis3 = document.createElement("div");
  opis3.className = "sk-drzwi-opis";
  opis3.id = "scanDrzwi3Opis";
  opis3.textContent = _scanT(
    "Przejdziesz do Mapowania, do nowego wyzwalacza już wycelowanego w ten sygnał. Ustawisz ruch, próg i czas — albo nagrasz własny gest — zapiszesz i wrócisz tutaj.",
    "You will be taken to Mapping, to a new trigger already aimed at this signal. Set the movement, threshold and timing — or record your own gesture — save, and come back here.");
  d3.appendChild(opis3);
  p.appendChild(d3);

  return p;
}

function _skanNaglowekDrzwi(napis) {
  const h = document.createElement("div");
  h.className = "sk-drzwi-nazwa";
  h.textContent = napis;
  return h;
}

function _skanPudelkoRoli(s) {
  const box = document.createElement("div");
  box.className = "sk-rola";

  const glowa = document.createElement("div");
  glowa.className = "sk-rola-glowa";
  const ik = document.createElement("span");
  ik.className = "sk-rola-ikona";
  ik.setAttribute("aria-hidden", "true");
  ik.textContent = s.ikona;
  const nz = document.createElement("span");
  nz.className = "sk-rola-nazwa";
  nz.textContent = _scanT(s.pl, s.en);
  const cel = document.createElement("span");
  cel.className = "sk-rola-cel";
  cel.textContent = _scanT(s.celPl, s.celEn);
  glowa.appendChild(ik);
  glowa.appendChild(nz);
  glowa.appendChild(cel);
  box.appendChild(glowa);

  const lista = _skanReguly(s.spec);
  if (lista.length) {
    const host = document.createElement("div");
    host.className = "sk-rola-lista";
    lista.forEach(function (r) { host.appendChild(_skanWiersz(r)); });
    box.appendChild(host);
  } else {
    const pusto = document.createElement("div");
    pusto.className = "sk-rola-pusto";
    pusto.textContent = _scanT(s.pustoPl, s.pustoEn);
    box.appendChild(pusto);
  }

  const otwarty = (_skanDodajDo === s.spec);
  const dodaj = _skanPrzycisk("btn sm sk-rola-dodaj", otwarty ? _scanT("Zwiń", "Collapse")
    : (lista.length ? _scanT("+ dodaj drugi sposób", "+ add another way")
      : _scanT("+ wybierz sposób", "+ choose a way")), "", function () {
        _skanDodajDo = otwarty ? null : s.spec;
        scanSignalsSync();
      }, "dodaj:" + s.spec);
  dodaj.setAttribute("aria-expanded", otwarty ? "true" : "false");
  box.appendChild(dodaj);
  if (otwarty) box.appendChild(_skanPanelDodaj(s.spec));

  return box;
}

function scanSignalsSync() {
  const host = document.getElementById("scanSignals");
  if (!host) return;
  const fokus = _skanZapamietajFokus();          // przed zburzeniem drzewa — patrz `_skanZapamietajFokus`
  const tytul = document.getElementById("scanSignalsTytul");
  if (tytul) tytul.textContent = _scanT("Czym sterujesz skanerem", "What drives the scanner");
  host.innerHTML = "";

  // JEDNO ZDANIE I PRZYCISK NA WIERZCHU, WYJAŚNIENIE W ZWIJAKU (UX 261120, P-G2-02). Trzy akapity
  // stały przed pierwszym przyciskiem, a zdanie „najpierw wyśrodkuj kapsel" nie miało przycisku,
  // którym się to robi. Teraz: zdanie, „Wyśrodkuj kapsel" (wspólne `rfCenterCapsule`, rf-06)
  // i „Jak to działa?" z dawnymi akapitami. Zwijak pamięta otwarcie (`rfFold`), bo ta funkcja
  // buduje blok od nowa przy każdej zmianie reguł.
  const lead = document.createElement("div");
  lead.className = "sk-wyzw-lead";
  const lp = document.createElement("p");
  lp.textContent = _scanT("Sygnał to ruch kapsla zapisany w Mapowaniu. Zanim go ustawisz, wyśrodkuj kapsel przyciskiem pod podglądem.",
    "The signal is a capsule move saved in Mapping. Before you set it, centre the capsule with the button under the preview.");
  lead.appendChild(lp);
  // „Wyśrodkuj kapsel” stoi od L4d na piętrze 1, pod podglądem (#scanCenter, rf-50d): robi się go
  // po każdym założeniu kapsla, a ten blok jest zwinięty.
  host.appendChild(lead);

  // WYJAŚNIENIE — wymaganie mówiło o nim wprost („wyjaśnij użytkownikowi co robi i jak
  // to będzie działać"). Dwa zdania o tym, skąd bierze się sygnał, i jedno o skutku wspólnoty
  // z Mapowaniem, bo to ono zaskakuje: wyłączenie ucisza, usunięcie kasuje wszędzie.
  const jak = document.createElement("details");
  jak.className = "cardfold inset sk-wyzw-jak";
  const jakSum = document.createElement("summary");
  jakSum.textContent = _scanT("Jak to działa?", "How does it work?");
  jak.appendChild(jakSum);
  const wstep = document.createElement("div");
  wstep.className = "cardfold-body sk-wyzw-wstep";
  const w1 = document.createElement("p");
  w1.textContent = _scanT(
    "Skaner nie ma własnych wyzwalaczy — sygnał przychodzi z Mapowania, tak samo jak naciśnięcie klawisza w grze. Dzięki temu wyzwalaczem może być cokolwiek, co kapsel rozpozna: puknięcie, przechylenie głowy, obrót, przytrzymana pozycja albo nagrany gest.",
    "The scanner has no triggers of its own — the signal comes from Mapping, exactly like a key press in a game. That is why the trigger can be anything the capsule can recognise: a tap, a lean of the head, a turn, a held position or a recorded gesture.");
  const w2 = document.createElement("p");
  w2.className = "sk-wyzw-uwaga";
  w2.textContent = _scanT(
    "To te same wyzwalacze, które widzisz w Mapowaniu. Przełącznik obok wycisza wyzwalacz tylko dla skanera; ✕ kasuje go w całej aplikacji — z możliwością cofnięcia.",
    "These are the same triggers you see in Mapping. The switch next to one mutes it for the scanner only; ✕ deletes it across the whole app — with an undo.");
  // ZANIM COKOLWIEK Z TEGO ZADZIAŁA: kąty liczą się od WYŚRODKOWANEJ pozycji kapsla, nie od
  // leżącego płasko. Kapsel noszony na głowie albo przypięty do wózka startuje z innego kąta, więc
  // próg „35°" bywa wtedy albo nieosiągalny, albo przekroczony w spoczynku — i wyzwalacz strzela
  // sam. Karta koła mówi to wprost przy swoim progu; tu brakowało tego zdania, choć bolało tak samo.
  const w3 = document.createElement("p");
  w3.className = "sk-wyzw-uwaga";
  w3.textContent = _scanT(
    "Najpierw wyśrodkuj kapsel w tej pozycji, w której go nosisz — na głowie, przy wózku, w dłoni. Kąty liczą się od środka, więc bez tego próg bywa albo nie do osiągnięcia, albo przekroczony w spoczynku.",
    "First centre the capsule in the position you actually wear it in — on your head, on the chair, in your hand. Angles are measured from that centre, so without it a threshold is either out of reach or already exceeded at rest.");
  wstep.appendChild(w1);
  wstep.appendChild(w2);
  wstep.appendChild(w3);
  jak.appendChild(wstep);
  host.appendChild(jak);
  if (typeof rfFold === "function") rfFold(jak, "skaner.sygnal-jak");

  // Bramka. Mówimy o niej TYLKO wtedy, gdy realnie przeszkadza — i o właściwej.
  if (!_skanModulWlaczony() && _skanReguly().length) {
    const brama = document.createElement("div");
    brama.className = "sk-wyzw-brama";
    brama.textContent = _scanT(
      "Moduł Skaner jest wyłączony, więc sygnał i cofanie nie dojdą. Zatrzymanie przejdzie zawsze.",
      "The Scanner module is switched off, so the signal and stepping back will not get through. Stopping always does.");
    host.appendChild(brama);
  }

  SKAN_SYGNALY.forEach(function (s) { host.appendChild(_skanPudelkoRoli(s)); });

  // Jedne drzwi do pełnej listy — na wypadek, gdy ktoś chce zobaczyć wszystkie swoje wyzwalacze
  // obok siebie, a nie tylko te trzy role.
  const stopka = document.createElement("div");
  stopka.className = "sk-wyzw-stopka";
  stopka.appendChild(_skanPrzycisk("btn sm", _scanT("Otwórz Mapowanie", "Open Mapping"),
    _scanT("Wszystkie wyzwalacze tego kapsla, z pełnym edytorem",
      "Every trigger of this capsule, with the full editor"),
    function () { _skanDoMapowania(); }));
  host.appendChild(stopka);
  _skanPrzywrocFokus(fokus);
  if (!_skanFoldSync && typeof rfTier === "function")
    _skanFoldSync = rfTier(document.getElementById("scanSygnalFold"), "skaner.sygnal", { sum: _skanPodsumowanie });
  if (_skanFoldSync) _skanFoldSync();
}

function scanSignalsInit() {
  _skanDodajDo = null;
  scanSignalsSync();
}

/* Lista reguł przyszła ze strumienia (rf-08, komunikat `rules`) albo zmienił się włącznik modułu.
   Widok musi nadążyć, bo inaczej sekcja pokazuje wyzwalacz skasowany w Mapowaniu albo nie pokazuje
   dopisanego tam — a po „↶ Cofnij" nie pokazuje przywróconego.
   Odświeżamy TAKŻE przy otwartym panelu dodawania: wybór z rozwijaków żyje poza DOM
   (`_skanWybRuch` / `_skanWybRef`), więc przerysowanie go nie gubi. Pierwsza wersja miała tu
   wczesną ucieczkę `if (_skanDodajDo) return` i to ona zjadała cofnięcie. */
function scanSignalsOnRules() {
  if (!document.getElementById("scanSignals")) return;
  scanSignalsSync();
}

/* Przełączono kapsel. `state.rules` to już reguły NOWEGO kapsla, więc panel dodawania opisuje
   nieswoje rzeczy: wybrany wyzwalacz z drzwi ② należy do poprzedniego i „Połącz" odpowiedziałoby
   „najpierw wybierz", choć w rozwijaku coś stoi. Zamykamy panel i czyścimy wybór — to jedyny
   moment, w którym pamięć rozwijaków przestaje być pomocna. */
function scanSignalsOnDevice() {
  _skanDodajDo = null;
  _skanWybRuch = "";
  _skanWybRef = "";
  if (!document.getElementById("scanSignals")) return;
  scanSignalsSync();
}
