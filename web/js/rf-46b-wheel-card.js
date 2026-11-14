"use strict";
// ===================== KOŁO WYBORU — KARTA USTAWIEŃ =====================
// Zakładka „Koło wyboru" (własna, między Mapowaniem a Myszą). Od 2026-08-26 karta ma układ
// przeniesiony z prototypu koła (poza repozytorium): po lewej ŻYWA
// SCENA podglądu, po prawej kolumna zwijanych sekcji, w których się edytuje.
//
// DLACZEGO TAK, A NIE JAK BYŁO: poprzednia karta była listą suwaków z małym kwadratem podglądu
// w rogu. Koło jest rysunkiem — stroi się je patrząc na koło, nie na pola. Forma pochodzi
// z prototypu; ta karta ją przenosi, ze świadomymi różnicami opisanymi w rf-46d (scena rysuje
// PRAWDZIWYM rendererem, a nie SVG-iem prototypu) i tutaj (źródłem prawdy zostaje serwer per
// kapsel; z prototypu NIE wchodzą jego cztery motywy SVG ani ręczna plakietka wycinka).
//
// PO POŁOWIE NA SZEROKOŚĆ (2026-08-26). Scena i kolumna edycji dostają po
// równo: przy takim podziale koło w NATURALNEJ wielkości mieści się na scenie w większości ustawień
// (nie trzeba go pomniejszać, żeby zobaczyć prawdę), a wiersz wycinka ma tyle miejsca, ile
// potrzebuje na emoji, nazwę, kolor, akcję i szybki wybór bez ścisku. Gdy w danej chwili potrzeba
// więcej jednego albo drugiego, jeden przycisk rozkłada scenę na całą kartę albo chowa ją do zera
// — patrz rf-46d, a stan zapamiętuje się między wejściami w zakładkę.
//
// PIĘĆ PLIKÓW NA JEDEN TEMAT, granice tematyczne, nie arytmetyczne:
//   rf-46a-wheel-shape.js — KSZTAŁT wycinka, paleta i rozkwit. Czysta geometria.
//   rf-46-wheel.js        — RYSUNEK. Ładuje go też nakładka i okienko przy kursorze.
//   rf-46b (ten plik)     — KARTA: układ, sekcje, rozmowa z serwerem, okienko przy kursorze.
//   rf-46c-wheel-tree.js  — LISTA WYCINKÓW: drzewo, okruszki, wiersze.
//   rf-46d-wheel-stage.js — SCENA: podgląd, wskazywanie myszą, sandbox wyboru.
//   rf-46e-wheel-io.js    — ZESTAWY STARTOWE i ZAPIS (eksport/import JSON).
// Powód podziału jest zawsze ten sam: twardy limit 800 linii z reguły organizacji JS.
//
// KOLEJNOŚĆ ŁADOWANIA: rf-46a → rf-46 → rf-46b → rf-46c → rf-46d → rf-46e, a wszystkie przed
// rf-40-boot.js, który wywołuje initWheel.

// ------------------------------------------------------------------------------------------
//  UKŁAD KARTY
// ------------------------------------------------------------------------------------------
// PRZEŁĄCZNIK ON ZOSTAJE W NAGŁÓWKU karty, a nie w sekcji „Sterowanie": tak wygląda każdy inny
// moduł (Mysz, MIDI, Kontroler), a sekcje są zwijane — przełącznik schowany w zwiniętej sekcji
// byłby jedyną rzeczą w aplikacji, której nie widać, dopóki się jej nie odkryje.
function wheelCardHtml() {
  return `<div class="card wh-card" id="wheelCard" data-stage="wide">
    <div class="head"><h2><span class="rfic hd-ic hd-ic-radial" aria-hidden="true"></span>Koło wyboru</h2>
      <!-- Bez podpisu „przytrzymaj przycisk kapsla, pochyl, puść” (UX 261120, P-G1-09): tytuł karty
           zabiera rf-49m, więc podpis wisiał sam w pustym pasku i opisywał jeden z pięciu sposobów,
           nie ten wybrany. Sposób mówi zdanie pod listą trybów (_whModeNote). -->
      <!-- PLAKIETKA „wyłączone / włączone · N wycinków" STĄD ZNIKŁA 2026-09-02 (audyt UX #37).
           Odkąd rf-49m przenosi przełącznik On do paska modułu, ten sam fakt stał na ekranie
           cztery razy: przełącznik w pasku, ta plakietka, przełącznik na kaflu kapsla i zdanie
           pod listą wycinków. Zostają dwa przełączniki, bo odpowiadają na różne pytania („czy
           koło tego kapsla jest włączone" i „czy któregokolwiek"); plakietka powtarzała pierwszy
           z nich słowem, a liczbę wycinków mówi teraz jedno zdanie (whCountLabel) w pasie kafli. -->
      <div class="rf-toggle" id="wheelEnable" role="switch" aria-checked="false" tabindex="0"
        title="Włącz albo wyłącz moduł Koło wyboru. Działa niezależnie od Mapowania, Myszy, MIDI i OSC."><span class="rf-tg-lbl off">Wył.</span><span class="rf-tg-knob"></span><span class="rf-tg-lbl on">Wł.</span></div></div>
    <!-- BEZ AKAPITU WSTĘPNEGO (2026-09-04): „przytrzymaj, pochyl, puść" mówi już podpis w nagłówku,
         a podmenu, puste wycinki i podgląd tłumaczy zakładka ℹ — trzy linijki nad każdym wejściem
         powtarzały jedno i drugie. -->
    <!-- KTO CO MA. Pas kafli — jeden na kapsel, w każdym jego własne koło — plus nagłówek nazywający
         ten kapsel, którego ustawienia są pod spodem (rf-46h). Ta sama forma co „Kontroler": tam
         kafel jest padem, bo pad bywa wspólny; tu kafel jest kapslem, bo koła nikt nie dzieli. -->
    ${typeof wheelCapsHtml === "function" ? wheelCapsHtml() : ""}
    <div class="wh-body" id="whBody">
      ${typeof whStageHtml === "function" ? whStageHtml() : ""}
      <div class="wh-edit" id="whEdit">
        <button type="button" class="wh-stage-tab" id="whStageTab"
          title="Pokaż podgląd koła">⤢ Podgląd</button>
        <!-- SEKCJA „PRESETY" STĄD ZNIKŁA 2026-09-02 (audyt UX #25/#26). Była DRUGĄ biblioteką tego
             samego: te same trzy presety fabryczne stały tu z plakietką „Z APLIKACJI" i czterema
             akcjami, a w zakładce „Biblioteka" — z plakietką i czterema INNYMI akcjami. Żaden inny
             moduł nie ma listy presetów w Konfiguracji; ta jedna kazała pamiętać, w której z dwóch
             list czego szukać. Znikła z nią cała jej maszyneria rysowania (siatka kafli, ich
             akcje i okna) — ZOSTAŁO w rf-46e zaplecze, z którego korzysta Biblioteka przez adapter
             rf-46k: magazyn presetów, wczytanie, import JSON i wymiana przez forum.
             „↺ Przywróć fabryczne" przeniosło się do nagłówka listy w Bibliotece
             (whMountLibFactory w rf-46k) — to jedyna akcja tej sekcji, której wspólny komponent
             nie zna. -->
        ${_whSec("wycinki", "🍰", "Wycinki i podmenu",
        `<div class="wh-crumbs" id="whCrumbs"></div>
           <div class="wh-slices" id="whSlices"></div>
           <div class="wh-bar wh-bar-wrap">
             <button class="btn rf-cta" id="whAdd"><span class="bic bic-plus" aria-hidden="true"></span>Dodaj wycinek</button>
             <button class="btn sm" id="whAddEmpty"
               title="Dodaj puste pole: wycinek bez akcji. Wybranie go nic nie wysyła, koło po prostu się zamyka. To bezpieczne miejsce na puszczenie przycisku, gdy ręka zjedzie w bok."><span class="bic bic-plus" aria-hidden="true"></span>puste pole</button>
             <span class="wh-count" id="whCount"></span>
           </div>
           <div class="wh-note" id="whNote">—</div>`, true)}
        ${_whTier("wyglad", "Wygląd", whLookSecHtml())}
        ${_whTier("sterowanie", "Sterowanie", whCtrlSecHtml())}
        ${_whTier("gdzie", "Gdzie pokazywać koło", whCursorSecHtml())}
        <!-- PIĘTRO 3 (UX 261120 L4e): jedno „Zaawansowane” na dole kolumny. Strojenie sterowania,
             kształt podmenu i zapis zmienia rzadko kto: żadne z trzech fabrycznych kół tych
             ustawień nie niesie. -->
        <details class="cardfold adv" id="whAdv"><summary>Zaawansowane</summary><div class="cardfold-body">
          ${_whAdvGrp("strojenie", "Strojenie sterowania", whCtrlTuneHtml())}
          ${_whAdvGrp("podmenu", "Podmenu",
          `<div class="wh-tiles wh-tiles-one" id="whSubTiles"></div>
           <div class="wh-mode-note" id="whSubNote">—</div>
           <div class="wh-row" id="whSubOpenRow" style="display:none"><span class="wh-fl">Czas otwarcia podmenu</span>
             <input type="range" id="whSubOpen" min="150" max="800" step="10" value="300" data-def=""
               title="Jak długo trzeba wskazywać wycinek z podmenu, zanim otworzy się ono samo. Dotyczy trzymanego przycisku — tam nie ma czym kliknąć.">
             <span class="wh-val" id="whSubOpenV">0,3 s</span></div>`)}
          ${_whAdvGrp("zapis", "Zapis", typeof whSaveSecHtml === "function" ? whSaveSecHtml() : "")}
        </div></details>
      </div>
    </div>
  </div>`;
  // (Poradnik pisania makr stał TUTAJ, na spodzie karty. Od 2026-08-31 stoi na spodzie zakładki
  // „Informacje" tego modułu — wstawia go `buildFrame` w rf-49m z pola `macroGuide` w rf-49j.
  // Przycisk „poradnik" przy polu makra wycinka prowadzi tam przez `whOpenMacroGuide` w rf-46c.)
}

// Jedna sekcja kolumny edycji. Zwijana, bo sekcji jest siedem, a większość dnia pracuje się
// w dwóch — i pamięta swój stan, żeby nie trzeba jej było rozwijać przy każdym wejściu w zakładkę.
const WH_SEC_KEY = "rf.wheel.sec.";
function _whSec(id, ico, title, inner, openDef) {
  let open = openDef;
  try {
    const v = localStorage.getItem(WH_SEC_KEY + id);
    if (v === "1") open = true; else if (v === "0") open = false;
  } catch (e) { /* prywatny tryb przeglądarki — zostaje wartość domyślna */ }
  return `<details class="wh-sec" data-sec="${id}"${open ? " open" : ""}>
    <summary><span class="wh-sec-ic" aria-hidden="true">${ico}</span>${title}</summary>
    <div class="wh-sec-in">${inner}</div></details>`;
}

// PIĘTRO 2 (UX 261120 L4e): filcowy zwijak z wartościami w nagłówku (rfTier w initWheel).
// Ustawiane raz: żadne z trzech fabrycznych kół nie zmienia wyglądu, sterowania ani miejsca.
function _whTier(id, title, inner) {
  return `<details class="cardfold inset wh-fold" id="whFold-${id}" data-sec="${id}"><summary>${title}</summary>
    <div class="cardfold-body wh-fold-in">${inner}</div></details>`;
}
// Grupa w „Zaawansowane” (piętro 3): nagłówek i treść, bez osobnego zwijaka.
function _whAdvGrp(id, title, inner) {
  return `<section class="wh-adv-grp" data-sec="${id}"><h3 class="wh-adv-h">${title}</h3>${inner}</section>`;
}

// WYGLĄD: jak koło wygląda — nic o tym, co robi. Motyw okienka przy kursorze stoi tu, a nie
// w „Gdzie pokazywać koło": tamta sekcja odpowiada na pytanie GDZIE, ta na pytanie JAK.
function whLookSecHtml() {
  return `<div class="wh-row"><span class="wh-fl">Wielkość koła</span>
      <input type="range" id="whSize" data-def="" data-sum aria-label="Wielkość koła" min="120" max="640" step="10" value="360"
        title="Średnica koła w pikselach ekranu. Jedna liczba na wszystkie miejsca: okienko przy kursorze, nakładkę nad grą i podgląd obok.">
      <span class="wh-val" id="whSizeV">360 px</span></div>
    <div class="wh-row"><span class="wh-fl">Odstęp wycinków</span>
      <input type="range" id="whGap" data-def="" min="0" max="8" step="0.5" value="3"
        title="Przerwa między sąsiednimi wycinkami, w stopniach. Zero = wycinki stykają się, tak jak koło wyglądało wcześniej.">
      <span class="wh-val" id="whGapV">3°</span></div>
    <div class="wh-row"><span class="wh-fl">Zaokrąglenie rogów</span>
      <input type="range" id="whCorner" data-def="" min="0" max="14" step="1" value="10"
        title="Promień zaokrąglenia narożników wycinka. Działa tylko wtedy, gdy wycinki mają odstęp.">
      <span class="wh-val" id="whCornerV">10 px</span></div>
    <div class="wh-row"><span class="wh-fl">Wielkość pisma</span>
      <input type="range" id="whFont" data-def="" data-sum aria-label="Wielkość pisma" min="70" max="160" step="5" value="100"
        title="Nazwy wycinków, ikony i treść środka naraz — w procentach tego, co rysunek policzy sam. Podnieś, gdy czytasz koło z drugiego końca pokoju.">
      <span class="wh-val" id="whFontV">100%</span></div>
    <div class="wh-mode-note" id="whLookNote">—</div>
    <div class="wh-row"><label class="wh-chk" title="Pod ikoną wycinka rysuje się kółko w jego kolorze. Na kole bez kolorów to tylko szare monety, dlatego domyślnie wyłączone.">
      <input type="checkbox" id="whChips" data-def=""> Kolorowe kółka pod ikonami</label></div>
    <!-- STYL (kremowa karta / ciemna / sama treść / neon / szkło) STĄD ZNIKNĄŁ 2026-08-31. Stały tu
         i nad sceną dwa komplety pięciu przycisków od jednej wartości — motywu okienka przy
         kursorze — a to jest ustawienie OKNA, nie koła: nad grą koło bierze wygląd tej nakładki,
         w której akurat stoi, więc jeden przycisk w karcie koła i tak nie mówił prawdy o
         pozostałych oknach. Ta karta opisuje teraz KSZTAŁT koła (te cztery suwaki wyżej), a styl
         wybiera się przy oknie. Zdanie niżej mówi, gdzie. -->
    <div class="wh-mode-note" id="whLookWinNote">—</div>`;
}

// STEROWANIE: czym otwierasz koło i czym zatwierdzasz. Wszystkie cztery czasy w jednym miejscu,
// bo pytanie brzmi „ile ma trwać ruch ręki", a nie „ile ma trwać ta jedna kontrolka".
function whCtrlSecHtml() {
  return `<div class="wh-row"><span class="wh-fl">Sposób</span>
      <select id="whConfirm" data-def="" aria-label="Sposób" title="Czym otwierasz koło i czym zatwierdzasz wybór. Wybierz ruch, który Twojej ręce przychodzi najłatwiej.">
        ${WHEEL_MODES.map(m => `<option value="${m[0]}">${m[1]}</option>`).join("")}
      </select></div>
    <div class="wh-mode-note" id="whModeNote">—</div>
    <div class="wh-row" id="whTrigCalRow" style="display:none"><span class="wh-fl">Pozycja zerowa</span>
      <button type="button" class="btn sm" id="whTrigCal"
        title="Ustaw obecne położenie kapsla jako neutralne. To ta sama kalibracja, co na ekranie „Mysz” — jedna pozycja zerowa dla całej aplikacji.">⌖ Wyśrodkuj kapsel</button></div>`;
}

// PIĘTRO 3 sterowania (L4e): czasy, wyzwalacz, siła i martwa strefa. Wiersze pokazuje i chowa
// whSync zależnie od sposobu, tak jak wcześniej; zmieniło się tylko miejsce.
function whCtrlTuneHtml() {
  return `<!-- CZAS PRZYTRZYMANIA ZNACZY W KAŻDYM TRYBIE COŚ INNEGO — i do 2026-09-02 pisał we wszystkich
         pięciu to samo, także w „Pochyl i przytrzymaj", gdzie przycisku nie ma w ogóle (audyt UX
         #28). W silniku (RadialMenu) holdMs jest czytane trzy razy i za każdym razem o czym
         innym: w „release" to próg OTWARCIA koła, w obu trybach klikanych granica między
         KLIKNIĘCIEM a przytrzymaniem (click = held &lt; hold), a w „cycle" skrót „wyślij od razu"
         (longp). W „tilt-hold" nie jest czytane wcale — koło otwiera stałe OPEN_MS pochylenia,
         a zatwierdza „Czas do zatwierdzenia". Etykietę i podpowiedź przepisuje whSync, wiersz
         w tamtym jednym trybie znika. -->
    <div class="wh-row" id="whHoldRow"><span class="wh-fl" id="whHoldLbl">Czas przytrzymania</span>
      <input type="range" id="whHold" data-def="" min="150" max="5000" step="10" value="300"
        title="Jak długo trzeba trzymać przycisk, zanim pokaże się koło. Krócej = szybciej, ale zwykłe kliknięcie łatwiej wtedy pomylić z otwarciem koła.">
      <span class="wh-val" id="whHoldV">0,3 s</span></div>
    <div class="wh-row" id="whAlwaysRow" style="display:none"><label class="wh-chk" title="Koło stoi na ekranie bez przerwy, więc klikanie od razu przesuwa wybór. Wyłączone: pojawia się dopiero po przechyleniu kapsla w dół i chowa po wyborze.">
      <input type="checkbox" id="whAlways" checked data-def=""> Koło zawsze widoczne</label></div>
    <div class="wh-mode-note" id="whAlwaysNote" style="display:none">—</div>
    <!-- WYZWALACZ. Tylko w trybie klikanym: tam wycinki lecą po kolei, więc kierunek nic nie
         niesie i wystarczy sygnał dwustanowy. W czterech pozostałych pochylenie WSKAZUJE, więc nie
         może jednocześnie naciskać. -->
    <div class="wh-row" id="whTrigRow" style="display:none"><span class="wh-fl">Czym przesuwasz wybór</span>
      <select id="whTrigger" data-def="" title="Czym przesuwa się wybór: przyciskiem kapsla albo samym pochyleniem. Pochylenie jest dla kogoś, kto nie ma jak nacisnąć — kapsel na czapce, przy głowie, przypięty do ubrania.">
        <option value="button">Przycisk kapsla</option>
        <!-- data-noi18n + _wheelT, bo goły klucz „Pochylenie" w słowniku to nazwa osi („Tilt");
             tu znaczy ruch, nie oś — „A lean". Zmianę języka dogrywa whRelang(). -->
        <option value="tilt" data-noi18n>${_wheelT("Pochylenie", "A lean")}</option>
      </select></div>
    <div class="wh-row" id="whTrigAxisRow" style="display:none"><span class="wh-fl">Kierunek</span>
      <select id="whTrigAxis" data-def="" title="Skinienie w dół jest łatwiejsze i mniej męczące niż przechył na bok, a przy części niepełnosprawności ruch boczny szyi jest niedostępny">
        <option value="any">Dowolny kierunek</option>
        <option value="pitch">Tylko w przód i w tył</option>
        <option value="roll">Tylko na boki</option>
      </select></div>
    <div class="wh-row" id="whTrigMagRow" style="display:none"><span class="wh-fl">Siła pochylenia</span>
      <input type="range" id="whTrigMag" data-def="" min="30" max="90" step="5" value="55"
        title="Jak mocno trzeba pochylić kapsel, żeby to się liczyło jako naciśnięcie. Za nisko — wyzwoli się samo; za wysoko — będzie nieosiągalne.">
      <span class="wh-val" id="whTrigMagV">55%</span></div>
    <div class="wh-mode-note" id="whTrigNote" style="display:none">—</div>
    <div class="wh-row" id="whWaitRow" style="display:none"><span class="wh-fl">Czas do zatwierdzenia</span>
      <input type="range" id="whWait" data-def="" min="200" max="3000" step="50" value="600"
        title="Ile trzeba wytrzymać na wybranym wycinku (albo odczekać po ostatnim kliknięciu), żeby wybór poszedł do systemu">
      <span class="wh-val" id="whWaitV">0,6 s</span></div>
    <div class="wh-row"><span class="wh-fl">Martwa strefa</span>
      <input type="range" id="whDead" data-def="" min="10" max="70" step="1" value="34"
        title="Jak duży jest środek koła, w którym nic nie jest wskazane">
      <span class="wh-val" id="whDeadV">34%</span></div>
    <div class="wh-mode-note" id="whDeadNote">—</div>`;
}

// ------------------------------------------------------------------------------------------
//  GDZIE POKAZYWAĆ KOŁO — jeden wybór zamiast trzech niezależnych przełączników
// ------------------------------------------------------------------------------------------
// PROBLEM, KTÓRY TO ROZWIĄZUJE: koło umie się narysować w trzech miejscach — na ściądze w panelu,
// w nakładkach nad grą i w osobnym okienku wokół kursora. Do tej pory każde z nich włączało się
// osobno, więc najzwyklejsze ustawienie („chcę koło pod kursorem") dawało DWA koła naraz: jedno
// pod ręką, drugie w rogu ekranu, w tej samej chwili. To nie jest bogatszy widok, tylko ten sam
// wybór narysowany dwa razy — a patrzy się i tak w jedno miejsce.
//
// CO Z NAKŁADKAMI: przy „Przy kursorze" nakładki po prostu NIE RYSUJĄ koła — tłumienie siedzi
// w rysowaniu (wheelOverviewFrame), nie w konfiguracji okien. Twoje „pokaż koło" w szufladzie
// nakładki zostaje nietknięte, więc powrót do „W nakładkach" przywraca dokładnie to, co było.
//
// WIELKOŚĆ OKIENKA NIE MA JUŻ WŁASNEGO SUWAKA. Miała go do 2026-08-26 i to był drugi suwak od
// jednej pozornie rzeczy: człowiek ustawiał „wielkość okienka" i dziwił się, że koło na ściądze
// zostaje takie samo. Teraz jedna liczba — „Wielkość koła" w sekcji Wygląd (`look.size`) — opisuje
// średnicę wszędzie, a okno jest po prostu budowane wokół niej.
const WH_CUR_SUF = "~kolo";        // lustro OVERLAY_WHEEL_SUFFIX w ribbitflip_monitor.py
// WYGLĄDÓW OKIENKA KOŁA TA KARTA JUŻ NIE ZNA. Do 2026-08-31 stała tu lista `WH_CUR_LOOKS`
// (kody i etykiety z RF_LOOKS + własne podpowiedzi) i rysowała dwa komplety przycisków. Wygląd
// należy do OKNA, więc i lista, i podpowiedzi „jak ten motyw wygląda pod kołem" przeniosły się
// tam, gdzie okna się ustawia: `OVL_WHEEL_THEMES` w rf-41-overlay.js, rysowane przez rf-41b.
// Lustro RadialMenu.SHOW_WHERE w ribbitflip_monitor.py.
const WH_WHERE = [
  ["cursor", "Przy kursorze", "At the pointer",
    "Koło pokazuje się w okienku wokół wskaźnika myszy — tam, gdzie i tak patrzysz w chwili wyboru"],
  ["overlay", "W nakładkach", "In the overlays",
    "Koło pokazuje się w nakładkach nad grą, tam gdzie je postawisz"],
  ["both", "W obu", "In both",
    "Koło pokazuje się jednocześnie przy kursorze i w nakładkach"],
  // CZWARTE MIEJSCE — PO CO ONO JEST. „Przy kursorze" zakłada dwie rzeczy naraz: że kursor w ogóle
  // jest tam, gdzie patrzysz, i że ręka umie trafić w koło, które za każdym razem stoi gdzie indziej.
  // Ani jedno, ani drugie nie jest oczywiste. Koło skaczące pod kursorem jest dla części rąk
  // trudniejsze niż koło, które ZAWSZE stoi w tym samym miejscu — trafia się w nie z pamięci ruchu,
  // bez szukania oczami. A kapsel na czapce albo przy głowie w ogóle nie prowadzi kursora (jest
  // wyzwalaczem, nie myszą), więc „przy kursorze" znaczyłoby dla niego „w przypadkowym miejscu
  // ekranu" — tam, gdzie mysz akurat została porzucona.
  ["center", "Na środku ekranu", "In the middle of the screen",
    "Koło pokazuje się w okienku na środku ekranu — zawsze w tym samym miejscu, nieruchomo"],
];

// KTÓRE MIEJSCA POTRZEBUJĄ OSOBNEGO OKNA — jedno pytanie, jedna odpowiedź. Do 2026-09-06 ten warunek
// stał przepisany z ręki w trzech miejscach (`where === "cursor" || where === "both"`), więc dołożenie
// czwartego miejsca znaczyłoby poprawienie go w trzech — a pominięcie jednego dawałoby kartę, która
// okno otwiera, ale jego ustawień nie pokazuje. Okno jest zawsze TO SAMO (<dev>~kolo); miejsca różnią
// się wyłącznie tym, gdzie się je stawia.
function whWantsWin(where) {
  return where === "cursor" || where === "both" || where === "center";
}

// JAK SIĘ NAZYWA TO OKNO W ZDANIU. Jedno okno, dwa sposoby stawiania — a zdania o nim muszą umieć
// powiedzieć oba, bo „okienko przy kursorze" o oknie stojącym nieruchomo pośrodku byłoby po prostu
// nieprawdą czytaną przez kogoś, kto właśnie wybrał środek ekranu.
function _whWinName(where) {
  return (where === "center")
    ? _wheelT("Okienko na środku ekranu", "The window in the middle of the screen")
    : _wheelT("Okienko przy kursorze", "The window at the pointer");
}

function whCursorSecHtml() {
  return `<div class="wh-cursec" id="whCurSec">
    <div class="wh-cur-head">
      <span class="wh-cur-title">Miejsce</span>
      <div class="seg seg-sm wh-where" id="whWhereSeg" role="group" aria-label="Gdzie pokazywać koło" data-def="overlay">
        ${WH_WHERE.map(w => `<button type="button" data-v="${w[0]}" title="${w[3]}">${w[1]}</button>`).join("")}
      </div>
    </div>
    <div class="wh-cur-note" id="whCurNote">—</div>
    <div class="wh-cur-body" id="whCurBody">
      <!-- STYL OKIENKA WRÓCIŁ DO KARTY KOŁA (2026-09-06), ale w INNE miejsce niż to, z którego znikł
           2026-08-31. Wtedy stał w sekcji „Wygląd" i był tam obcy: „Wygląd" opisuje KSZTAŁT koła
           (średnicę, odstępy, rogi, pismo), a styl jest skórą OKNA — tego, co leży pod kołem. Skoro
           więc okno pojawia się dopiero po wybraniu miejsca z okienkiem, jego skóra ma stać tuż pod
           tym wyborem: jedna decyzja („chcę okienko") i od razu druga, która z niej wynika. Wybór na
           ekranie „Nakładka" zostaje — to ta sama wartość okna, tylko oglądana od strony okien.
           Nad przezroczystością, bo najpierw się wybiera CO stoi pod kołem, a dopiero potem jak mocno
           to całe przygasa. Lista kodów i podpowiedzi jest jedna dla całej aplikacji
           (OVL_WHEEL_THEMES w rf-41-overlay.js) — drugi zestaw etykiet od tej samej wartości był
           dokładnie tym, co poprzednio kazało ten wiersz usunąć. Osłona „typeof" jest po to, że
           nakładka ładuje inny zestaw plików i tej listy tam nie ma (wzorzec z rf-41c).
           ⚠️ Bez odwrotnych apostrofów w tym komentarzu — cała funkcja jest jednym literałem
           szablonowym, więc taki znak zamknąłby go w środku HTML-a. -->
      <div class="wh-cur-row" id="whCurThemeRow">
        <span class="wh-fl">Styl okienka</span>
        <div class="ovm-themes wh-themes" id="whCurThemes" role="group" aria-label="Styl okienka koła">
          ${(typeof OVL_WHEEL_THEMES !== "undefined" ? OVL_WHEEL_THEMES : []).map(t =>
            `<button type="button" class="ovm-theme" data-theme="${t.k}" title="${t.hint}">`
            + `<span class="ovl-thumb ovl-thumb-${t.k}" aria-hidden="true"><b></b><b></b><b></b></span>`
            + `<span class="ovm-th-lbl">${t.label}</span></button>`).join("")}
        </div>
      </div>
      <div class="wh-row"><span class="wh-fl">Przezroczystość</span>
        <input type="range" id="whCurOpacity" data-def="" min="20" max="100" step="1" value="100"
          title="Jak mocno koło przygasa nad grą. 100% = pełna moc koloru.">
        <span class="wh-val" id="whCurOpacityV">100%</span></div>
      <div class="wh-cur-note" id="whCurSizeNote">—</div>
    </div>
  </div>`;
}

// ------------------------------------------------------------------------------------------
//  DROBIAZGI JĘZYKOWE
// ------------------------------------------------------------------------------------------
// Sekundy, nie milisekundy: „0,25 s" czyta się od razu, „250" wymaga rachunku. Przecinek, bo to
// polski panel (ten sam wzorzec co _mDwellSec w rf-31c). Dwa miejsca po przecinku, nie jedno:
// suwak chodzi co 10 ms, więc przy jednym „250" i „300" wyglądałyby identycznie.
function _whSec2(ms) {
  const v = Math.max(0, +ms || 0) / 1000;
  const s = v.toFixed(2).replace(/0$/, "").replace(/\.$/, "");
  return ((typeof _lang !== "undefined" && _lang === "en") ? s : s.replace(".", ",")) + " s";
}

// Polska odmiana po liczbie: 1 wycinek · 2-4 wycinki · 5+ wycinków (i tak samo dla dziesiątek,
// stąd reszta z dzielenia przez 100). Bez tego panel pisze „Dodaj jeszcze 2 wycinek".
function _whWycinki(n) {
  n = Math.abs(n | 0);
  const d = n % 10, s = n % 100;
  if (n === 1) return "1 wycinek";
  if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return n + " wycinki";
  return n + " wycinków";
}

// ILE WYCINKÓW MA TO KOŁO — JEDNO ZDANIE NA CAŁĄ ZAKŁADKĘ (audyt UX #31, 2026-09-02).
// Do tej pory każde miejsce liczyło po swojemu: kafel presetu, okna z pytaniem i Biblioteka
// podawały SUMĘ z podmenu („7 wycinków"), a pas kafli i lista — sam pierwszy pierścień
// („4 wycinki"). Obie liczby są prawdziwe i obie są odpowiedziami na inne pytanie, ale postawione
// obok siebie w jednym module czytają się jak usterka: to samo koło ma raz 7, a raz 4 wycinki.
// Forma jest ta, którą wpis na forum miał od początku (_whPresetLine w rf-46f): najpierw to, w co
// celuje ręka, a w nawiasie to, co jest schowane poziom niżej.
function _whTally(slices) {
  const list = Array.isArray(slices) ? slices
    : ((slices && (slices.slices || (slices.config && slices.config.slices))) || []);
  let all = 0;
  const walk = (l) => (l || []).forEach(s => { all++; if (s.children) walk(s.children); });
  walk(list);
  return { top: list.length, sub: all - list.length, all: all };
}
function whCountLabel(slices) {
  const t = _whTally(slices);
  const head = _wheelT(_whWycinki(t.top), t.top + (t.top === 1 ? " slice" : " slices"));
  return t.sub
    ? head + _wheelT(" (+" + t.sub + " w podmenu)", " (+" + t.sub + " in submenus)")
    : head;
}

// Liczba z przecinkiem dziesiętnym — ten sam powód co wyżej.
function _whNum(v, d) {
  const s = Number(v).toFixed(d == null ? 1 : d).replace(/\.0$/, "");
  return (typeof _lang !== "undefined" && _lang === "en") ? s : s.replace(".", ",");
}

// KOMUNIKAT KARTY. Osobny od flashTrigMsg (rf-12), bo tamten pisze do #trigMsg, a #trigMsg stoi
// w zakładce Mapowanie — odkąd koło ma własną zakładkę, jego komunikaty trafiały w miejsce, którego
// nikt w tej chwili nie ogląda. Toast siedzi na scenie, czyli tam, gdzie patrzy ręka.
let _whToastT = null;
function whToast(msg, bad) {
  const el = document.getElementById("whToast");
  // Bez sceny (karta jeszcze nie stoi) mówi wspólny bąbel, a nie pasek Mapowania (UX 261120).
  if (!el) { if (typeof rfSay === "function") rfSay(msg, { tone: bad ? "danger" : undefined }); return; }
  el.textContent = String(msg || "");
  el.classList.toggle("bad", !!bad);
  el.classList.add("show");
  clearTimeout(_whToastT);
  _whToastT = setTimeout(() => el.classList.remove("show"), 2300);
}

// Jedno zdanie pod listą trybów: co konkretnie ma zrobić ręka.
function _whModeNote(m) {
  if (m === "tilt-hold") return _wheelT(
    "Bez przycisku: mocno pochyl kapsel, a pokaże się koło; utrzymaj wskazanie na jednym wycinku, aż wypełni się łuk, i akcja pójdzie sama. Wyprostowanie kapsla zamyka koło bez akcji.",
    "No button at all: lean the capsule hard and the wheel appears; keep pointing at one slice until the ring fills and the action goes out by itself. Straightening the capsule closes it with nothing sent.");
  if (m === "tilt-click") return _wheelT(
    "Mocno pochyl kapsel, a pokaże się koło i zostanie otwarte samo; wskaż wycinek pochyleniem i kliknij przycisk, żeby go wysłać. Wyprostowanie kapsla zamyka koło bez akcji.",
    "Lean the capsule hard and the wheel appears and stays open on its own; point at a slice by leaning and click the button to send it. Straightening the capsule closes it with nothing sent.");
  if (m === "click") return _wheelT(
    "Kliknij przycisk, żeby otworzyć koło — zostanie otwarte samo, bez trzymania. Wskaż wycinek pochyleniem i kliknij drugi raz. Kliknięcie przy kapslu ustawionym prosto anuluje.",
    "Click the button to open the wheel — it stays open on its own, with nothing to hold. Point at a slice by leaning and click a second time. A click with the capsule held level cancels.");
  if (m === "cycle") return _wheelT(
    "Dla rąk, którym celowanie pochyleniem sprawia trudność — jedyny tryb, w którym pochylanie NIE ZNACZY NIC. Wszystko robi ten sam przycisk, a koło mówi w środku, co znaczy teraz: pierwszy klik WŁĄCZA koło (nic przy tym nie wybierając), każdy następny przechodzi na kolejny wycinek, odczekanie wysyła wybrany, a przytrzymanie przycisku WYŁĄCZA koło bez wysyłania czegokolwiek.",
    "For hands that find aiming by lean hard — the one mode where leaning means NOTHING. It is all the same button, and the middle of the wheel says which meaning is next: the first click SWITCHES THE WHEEL ON (picking nothing), every further click steps to the next slice, waiting sends the one you stopped on, and holding the button SWITCHES THE WHEEL OFF without sending anything.");
  return _wheelT(
    "Przytrzymaj przycisk kapsla, aż pokaże się koło, pochyl w stronę wycinka i puść przycisk. Puszczenie przy kapslu ustawionym prosto nie wysyła nic.",
    "Hold the capsule button until the wheel appears, lean towards a slice and let the button go. Letting go with the capsule held level sends nothing.");
}

// CO ROBI SUWAK `holdMs` W TYM TRYBIE — [etykieta, podpowiedź] albo `null`, gdy nie robi nic.
// Trzy różne role i jedno pole w konfiguracji, bo silnik naprawdę czyta tę jedną liczbę na trzy
// sposoby (RadialMenu._tick_release i _tick_modern): próg otwarcia, granica „to jeszcze było
// kliknięcie" i skrót „wyślij od razu". Jedna etykieta na wszystkie trzy była nieprawdziwa
// w czterech przypadkach na pięć.
function _whHoldRole(m) {
  // „Pochyl i przytrzymaj" — przycisku nie ma w ogóle. Koło otwiera stały OPEN_MS mocnego
  // pochylenia (nie ma na to suwaka i celowo: próg musi być wyraźnie wyżej niż zwykłe sterowanie),
  // a zatwierdza „Czas do zatwierdzenia" wyżej. Wiersz znika, zamiast kłamać.
  if (m === "tilt-hold") return null;
  if (m === "click" || m === "tilt-click") return [
    _wheelT("Najdłuższe kliknięcie", "Longest click"),
    _wheelT("Naciśnięcie krótsze niż tyle liczy się jako KLIKNIĘCIE i o czymś decyduje; dłuższe przepada. Podnieś, jeśli palec schodzi z przycisku wolniej, niż aplikacja się spodziewa.",
      "A press shorter than this counts as a CLICK and decides something; a longer one is thrown away. Raise it if your finger leaves the button more slowly than the app expects.")];
  if (m === "cycle") return [
    _wheelT("Przytrzymanie wyłącza koło", "Hold switches it off"),
    _wheelT("Przycisk trzymany dłużej niż tyle WYŁĄCZA koło i nic nie wysyła — to jest wyjście z trybu klikanego. Krótsze naciśnięcia włączają koło i przesuwają wybór, więc podnieś tę wartość, jeśli zwykłe kliknięcia bywają brane za przytrzymanie.",
      "Holding the button longer than this SWITCHES THE WHEEL OFF and sends nothing — this is the way out of the clicking mode. Shorter presses switch it on and step the choice, so raise this if ordinary clicks get taken for a hold.")];
  return [
    // „Hold time" — to samo brzmienie, co para w rf-01-i18n: jeden napis, jedno tłumaczenie.
    _wheelT("Czas przytrzymania", "Hold time"),
    _wheelT("Jak długo trzeba trzymać przycisk, zanim pokaże się koło. Krócej = szybciej, ale zwykłe kliknięcie łatwiej wtedy pomylić z otwarciem koła.",
      "How long the button has to be held before the wheel appears. Shorter is quicker, but then an ordinary click is easier to mistake for opening the wheel.")];
}

// CO SIĘ DZIEJE, GDY WSKAZANIE STOI W MARTWEJ STREFIE — a to zależy od trybu i do 2026-09-02
// podpis mówił we wszystkich pięciu jedno: „W trybie »Trzymaj przycisk i puść« puszczenie w tej
// strefie anuluje wybór" (audyt UX #29). W czterech pozostałych trybach nie ma czego puszczać,
// więc zdanie opisywało cudze ustawienie. Każda odpowiedź jest lustrem silnika: `_tick_release`
// (puszczenie w środku nie wysyła), `_tick_modern` (pochylenie z powrotem do środka zamyka koło),
// `_decide_click` (klik w środku cofa o poziom, a na korzeniu anuluje) i `_tick_cycle` (po
// otwarciu pochylenie już niczego nie wskazuje).
function _whDeadNote(m) {
  if (m === "tilt-hold" || m === "tilt-click") return _wheelT(
    "Powrót wskazania do tej strefy ZAMYKA koło i nic nie wysyła — tak samo jak wyprostowanie kapsla.",
    "Bringing the aim back into it CLOSES the wheel and sends nothing — exactly as straightening the capsule does.");
  if (m === "click") return _wheelT(
    "Kliknięcie przy wskazaniu w tej strefie cofa o poziom wyżej, a na pierwszym pierścieniu anuluje i zamyka koło.",
    "A click with the aim inside it goes back up one level, and on the first ring it cancels and closes the wheel.");
  if (m === "cycle") return _wheelT(
    "W tym trybie wybór przesuwają kliknięcia, a pochylenie nie znaczy nic: strefa wyznacza tu tylko wielkość środka koła — czyli ile miejsca ma zdanie, które w środku mówi, co robi teraz przycisk.",
    "In this mode clicks step the choice and a lean means nothing: here the zone only sets how big the middle of the wheel is — that is, how much room the sentence in it has to say what the button does next.");
  return _wheelT(
    "Puszczenie przycisku, gdy wskazanie stoi w tej strefie, anuluje wybór i nic nie wysyła.",
    "Letting the button go while the aim sits inside it cancels the choice and sends nothing.");
}

// Kształt podmenu w konfiguracji, z zabezpieczeniem na literówkę w cudzym pliku.
function whSubMode() {
  const v = state.wheel && state.wheel.submenuMode;
  return WHEEL_SUB.some(s => s[0] === v) ? v : "replace";
}
// Czy w kole JEST jakiekolwiek podmenu — rekurencyjnie, bo może siedzieć dopiero na drugim poziomie.
function whHasSub(list) {
  return (Array.isArray(list) ? list : []).some(
    s => (s.children && s.children.length) ? true : false);
}
// Zdanie pod kaflami „Podmenu" — TYLKO to, czego nie mówi sam kafel.
// ⚠️ Do 2026-09-02 zaczynało się od opisu wybranego kształtu, czyli od tego samego zdania, które
// stoi na jego kaflu dwa centymetry wyżej, przepisanego innymi słowami (audyt UX #34). Dwa opisy
// jednej rzeczy każą je porównać i szukać różnicy, której nie ma. Kafle zostają — to one dają
// wybór między trzema kształtami — a to miejsce mówi wyłącznie o skutkach, których na kaflu nie
// widać: o suficie trzech obręczy i o tym, że tryb klikany i tak rysuje jeden pierścień.
// Pusty łańcuch znaczy „nie ma nic do dodania" i wtedy wiersz znika (patrz whSync).
function _whSubNote(sub, mode) {
  let t = "";
  if (sub !== "replace") t += _wheelT(
    "Dalej niż trzy obręcze koło nie schodzi — przy głębszym drzewie najstarsza obręcz chowa się, a rysunek zmniejsza całość, żeby wszystko zmieściło się w nakładce.",
    "The wheel never draws more than three rings — deeper in, the oldest one is folded away and the drawing scales the whole thing down so it still fits the overlay.");
  if (mode === "cycle") t += (t ? " " : "") + _wheelT(
    "W trybie „Przełączaj kliknięciami” koło i tak rysuje jeden pierścień naraz, a w podmenu pierwszą pozycją jest „↩ Wstecz” — klikaniem nie da się celować w drugą obręcz.",
    "In “Step through it with clicks” the wheel draws one ring at a time anyway, and inside a submenu the first position is “↩ Back” — clicking cannot aim at a second ring.");
  return t;
}

// Wygląd koła: co widać, gdy nie ma się jeszcze intuicji, którą z trzech liczb właśnie się rusza.
function _whLookNote(lk) {
  if (lk.gapDeg <= 0.2) return _wheelT(
    "Bez odstępu wycinki stykają się bokami, a zaokrąglenie nie ma czego zaokrąglać — to jest dokładnie ten rysunek, który koło miało wcześniej. Zwiększ odstęp, żeby wycinki stały się osobnymi kształtami.",
    "With no gap the slices touch and there are no corners to round — this is exactly the drawing the wheel had before. Raise the gap to turn the slices into separate shapes.");
  return _wheelT(
    "Odstęp wycina się ze ŚRODKA wycinka, nie z granicy między wycinkami: celuje się dokładnie tam, gdzie się celowało, tylko rysunek zostawia przerwę. W nakładce „Sama treść” przerwy są wycięte do gry.",
    "The gap is taken out of the MIDDLE of a slice, not off the border between two: you aim exactly where you aimed before, the drawing simply leaves a gap. In the “No card” overlay the gaps are cut through to the game.");
}

// ------------------------------------------------------------------------------------------
//  SYNCHRONIZACJA KONTROLEK
// ------------------------------------------------------------------------------------------
function whSync() {
  const $ = id => document.getElementById(id), W = state.wheel;
  const mode = W.confirm || "release";
  const hv = $("whHoldV"); if (hv) hv.textContent = _whSec2(W.holdMs);
  const hr = $("whHold"); if (hr && +hr.value !== +W.holdMs) hr.value = W.holdMs;
  const cs = $("whConfirm"); if (cs && cs.value !== mode) cs.value = mode;
  const mn = $("whModeNote"); if (mn) mn.textContent = _whModeNote(mode);
  // CZAS PRZYTRZYMANIA — patrz komentarz przy wierszu w whCtrlSecHtml. Znika tam, gdzie silnik go
  // nie czyta, a gdzie czyta go o czymś innym, mówi o czym.
  const hold = _whHoldRole(mode);
  const hrow = $("whHoldRow"); if (hrow) hrow.style.display = hold ? "" : "none";
  const hl = $("whHoldLbl"); if (hl && hold) hl.textContent = hold[0];
  if (hr && hold) hr.title = hold[1];
  // Suwak czekania pokazuje się TYLKO tam, gdzie czekanie o czymkolwiek decyduje: nieaktywna
  // kontrolka na ekranie to pytanie, na które nie ma dobrej odpowiedzi.
  const wrow = $("whWaitRow");
  if (wrow) wrow.style.display = WHEEL_MODES_WAIT.indexOf(mode) >= 0 ? "" : "none";
  // KOŁO ZAWSZE WIDOCZNE — wyłącznie w trybie klikanym, i tylko tam ma się w ogóle pokazać.
  // W czterech pozostałych kierunek pochylenia NIESIE wybór, więc koło stojące bez przerwy
  // zasłaniałoby obraz przez cały czas, kiedy nikt go nie używa.
  const cyc = (mode === "cycle");
  const arow = $("whAlwaysRow"); if (arow) arow.style.display = cyc ? "" : "none";
  const an = $("whAlwaysNote");
  if (an) {
    an.style.display = cyc ? "" : "none";
    an.textContent = W.alwaysOn === false
      ? _wheelT("Wyłączonego koła nie widać wcale — stawia je na ekranie dopiero to samo kliknięcie, które je włącza. Dla kogoś, komu rysunek przeszkadza przez cały czas, kiedy z niego nie korzysta.",
        "A switched-off wheel is not on screen at all — the same click that switches it on is what puts it there. For somebody the drawing gets in the way of whenever they are not using it.")
      : _wheelT("Wyłączone koło stoi na ekranie przygaszone i mówi w środku, że czeka na kliknięcie. Widać, gdzie jest i co ma, zanim się je włączy — i tam samo zostaje po wysłaniu akcji.",
        "A switched-off wheel stands there dimmed, saying in the middle that it is waiting for a click. You can see where it is and what is on it before switching it on — and it stays in the same place after an action goes out.");
  }
  // WYZWALACZ — i cała reszta pól, które mają sens dopiero, gdy naciska pochylenie.
  const trg = (W.trigger === "tilt") ? "tilt" : "button";
  const byTilt = cyc && trg === "tilt";
  const _show = (id, on) => { const el = $(id); if (el) el.style.display = on ? "" : "none"; };
  _show("whTrigRow", cyc);
  _show("whTrigAxisRow", byTilt);
  _show("whTrigMagRow", byTilt);
  _show("whTrigCalRow", byTilt);
  _show("whTrigNote", cyc);
  const ts = $("whTrigger"); if (ts && ts.value !== trg) ts.value = trg;
  const tax = $("whTrigAxis");
  const axv = ["any", "pitch", "roll"].indexOf(W.triggerAxis) >= 0 ? W.triggerAxis : "any";
  if (tax && tax.value !== axv) tax.value = axv;
  const tmp = Math.round((+W.triggerMag > 0 ? +W.triggerMag : 0.55) * 100);
  const tmv = $("whTrigMagV"); if (tmv) tmv.textContent = tmp + "%";
  const tmr = $("whTrigMag"); if (tmr && +tmr.value !== tmp) tmr.value = tmp;
  const tn = $("whTrigNote");
  if (tn) {
    tn.textContent = byTilt
      ? _wheelT("Pochylenie w dowolną stronę zastępuje naciśnięcie przycisku — kierunek nic tu nie znaczy, bo wycinki i tak lecą po kolei. Zanim zaczniesz: ustaw kapsel tak, jak będzie noszony, i naciśnij „Wyśrodkuj kapsel”. Bez tego próg będzie albo nieosiągalny, albo wyzwoli się sam. Sprawdź też „Przytrzymanie wyłącza koło” wyżej: skinienie trwa dłużej niż klik palcem, a pochylenie utrzymane ponad ten czas wyłącza koło.",
        "A lean in any direction stands in for pressing the button — the direction means nothing here, because the slices come round in order anyway. Before you start: put the capsule where it will be worn and press “Centre the capsule”. Without that the threshold is either out of reach or trips by itself. Check “Hold switches it off” above as well: a nod lasts longer than a finger tap, and a lean held past that time switches the wheel off.")
      : _wheelT("Wybór przesuwa przycisk kapsla. Jeśli nie ma jak go nacisnąć — kapsel na czapce, przy głowie, przypięty do ubrania — przestaw wyzwalacz na pochylenie.",
        "The capsule's button steps the choice. If there is no way to press it — a capsule on a cap, by the head, clipped to clothing — switch the trigger over to leaning.");
  }
  const ab = $("whAlways");
  if (ab) {
    // WYZWALACZ Z POCHYLENIA WYMUSZA koło stojące na stałe (lustro RadialMenu._always_on): gestem
    // otwarcia byłby przechył i wyzwalaczem jest przechył, więc pierwszy ruch ręki robiłby obie
    // rzeczy naraz. Przełącznik pokazuje więc prawdę i nie daje jej zmienić, zamiast po cichu
    // kłamać, że jest wyłączony.
    const on = byTilt || W.alwaysOn !== false;
    if (ab.checked !== on) ab.checked = on;
    if (ab.disabled !== byTilt) ab.disabled = byTilt;
  }
  if (an && byTilt) {
    an.textContent = _wheelT("Przy wyzwalaczu z pochylenia koło stoi zawsze — nie da się tego wyłączyć, bo bez rysunku na ekranie nie ma jak sprawdzić, czy skinienie w ogóle przechodzi przez próg.",
      "With a lean for a trigger the wheel always stands there — that cannot be switched off, because without the drawing on screen there is no way to tell whether a nod is getting past the threshold at all.");
  }
  const wv = $("whWaitV"); if (wv) wv.textContent = _whSec2(W.confirmMs);
  const wr = $("whWait"); if (wr && +wr.value !== +W.confirmMs) wr.value = W.confirmMs;
  // MARTWA STREFA w procentach promienia — ułamek 0,34 nikomu nic nie mówi, „34%" mówi wszystko.
  const dzp = Math.round((W.deadzone || WHEEL_DEAD_DEF) * 100);
  const dv = $("whDeadV"); if (dv) dv.textContent = dzp + "%";
  const dr = $("whDead"); if (dr && +dr.value !== dzp) dr.value = dzp;
  const dn = $("whDeadNote");
  if (dn) {
    let t = _wheelT("Środek koła, w którym nic nie jest wskazane. ",
      "The middle of the wheel, where nothing is picked. ") + _whDeadNote(mode);
    if (WHEEL_MODES_LEAN.indexOf(mode) >= 0 && (W.deadzone || WHEEL_DEAD_DEF) + 0.15 > 0.8) {
      t += " " + _wheelT(
        "Przy tak dużej strefie otwarcie koła wymaga mocniejszego pochylenia, żeby próg otwarcia został wyraźnie poza nią.",
        "With a dead zone this big the wheel needs a harder lean to open, so that the opening bar stays clearly outside it.");
    }
    dn.textContent = t;
  }
  // PODMENU — kafle, przypis o skutkach, których na kaflu nie widać, i suwak czasu otwarcia.
  const sub = whSubMode();
  if (typeof whRenderSubTiles === "function") whRenderSubTiles(sub);
  const sn = $("whSubNote");
  if (sn) {
    const st = _whSubNote(sub, mode);
    sn.textContent = st;
    sn.style.display = st ? "" : "none";     // pusty przypis to pusty wiersz, a nie „brak danych"
  }
  // Suwak „Czas otwarcia podmenu" pokazuje się dopiero wtedy, gdy w kole JEST jakiekolwiek
  // podmenu — na płaskim kole nie ma czego otwierać.
  const anySub = whHasSub(W.slices);
  const sor = $("whSubOpenRow");
  if (sor) sor.style.display = anySub ? "" : "none";
  const sov = $("whSubOpenV"); if (sov) sov.textContent = _whSec2(W.subOpenMs || 300);
  const sor2 = $("whSubOpen"); if (sor2 && +sor2.value !== +(W.subOpenMs || 300)) sor2.value = W.subOpenMs || 300;
  const ch = $("whChips"); if (ch && ch.checked !== !!W.iconChips) ch.checked = !!W.iconChips;
  // WYGLĄD — trzy liczby kształtu.
  const lk = wheelLook(W.look);
  const sz = $("whSize"); if (sz && document.activeElement !== sz && +sz.value !== lk.size) sz.value = lk.size;
  const szv = $("whSizeV"); if (szv) szv.textContent = Math.round(lk.size) + " px";
  const gp = $("whGap"); if (gp && document.activeElement !== gp && +gp.value !== lk.gapDeg) gp.value = lk.gapDeg;
  const gpv = $("whGapV"); if (gpv) gpv.textContent = _whNum(lk.gapDeg, 1) + "°";
  const co = $("whCorner"); if (co && document.activeElement !== co && +co.value !== lk.corner) co.value = lk.corner;
  const cov = $("whCornerV"); if (cov) cov.textContent = Math.round(lk.corner) + " px";
  // WIELKOŚĆ PISMA w procentach: krotność 1,15 nikomu nic nie mówi, „115%" mówi wszystko —
  // ten sam zabieg co przy martwej strefie wyżej.
  const fpc = Math.round(lk.fontScale * 100);
  const fo = $("whFont"); if (fo && document.activeElement !== fo && +fo.value !== fpc) fo.value = fpc;
  const fov = $("whFontV"); if (fov) fov.textContent = fpc + "%";
  const ln = $("whLookNote"); if (ln) ln.textContent = _whLookNote(lk);
  const b = $("wheelEnable");
  if (b) { b.classList.toggle("on", !!W.enabled); b.setAttribute("aria-checked", W.enabled ? "true" : "false"); }
  const note = $("whNote");
  if (note) note.textContent = _whListNote(W);
  // (PLAKIETKA „wyłączone / włączone · N wycinków" ZNIKŁA 2026-09-02 — patrz wheelCardHtml.)
  whCurSync();     // opis okna „przy kursorze" mówi o stanie koła, więc zmienia się razem z nim
  // Zdanie pod sceną podaje między innymi WIELKOŚĆ KOŁA W GRZE — a to jest wprost ta liczba,
  // którą ustawia suwak wyżej (scena rysuje na swoją miarę, patrz whStageFill w rf-46d).
  // Bez tego wiersza zostawałoby na ekranie zdanie o poprzedniej wielkości.
  if (typeof whStageNote === "function") whStageNote();
  // „ZMIENIONE" jest odpowiedzią, która zmienia się przy KAŻDEJ edycji koła — czyli dokładnie
  // tutaj, razem z resztą karty. Od 2026-09-02 pytają o nią DWA widoki, nie trzy: podpis na kaflu
  // kapsla i ramka modułu (blok stanu Konfiguracji + lista Biblioteki). Trzeci — własny pasek koła
  // — zniknął razem z drugim kompletem przycisków zapisu (audyt UX #25).
  if (typeof _whCapsCfgSync === "function") _whCapsCfgSync();
  // Jedno wywołanie, ta sama chwila: dwa widoki tej samej nazwy nie mają jak pokazać dwóch
  // różnych odpowiedzi. `initPresetCols` opakowuje tę funkcję, więc samo przerysowuje listę.
  if (typeof wheelCfgColSync === "function") wheelCfgColSync();
  if (window.updateTabDots) updateTabDots();
  if (typeof _whTierSync === "function") _whTierSync();   // L4e: nagłówki zwijaków
}

// Zdanie pod listą wycinków: co się właściwie stanie i co jeszcze stoi na przeszkodzie.
function _whListNote(W) {
  const sl = W.slices || [];
  // „Bez akcji" liczymy tylko wśród LIŚCI: wycinek z podmenu nie ma wysyłać niczego.
  const bez = sl.filter(s => !(s.children && s.children.length)
    && !String(s.spec || "").trim() && !String(s.sequence || "").trim()).length;
  if (sl.length < WHEEL_MIN_SLICES) {
    const n = WHEEL_MIN_SLICES - sl.length;
    return _wheelT("Dodaj jeszcze " + _whWycinki(n) + ", żeby dało się włączyć koło.",
      "Add " + n + (n === 1 ? " more slice" : " more slices") + " to be able to switch the wheel on.");
  }
  // ⚠️ ZDANIA „Wyłączone. Przycisk kapsla działa jak zwykle…" TU JUŻ NIE MA (audyt UX #37,
  // 2026-09-02). Włączenie koła mówiły na tym jednym ekranie cztery rzeczy naraz: przełącznik
  // w pasku modułu, plakietka w nagłówku karty, przełącznik na kaflu kapsla i to zdanie. Zostają
  // dwa przełączniki (pasek = to, co się edytuje; kafel = każdy inny kapsel), a ten przypis mówi
  // o TREŚCI koła. Dlatego miejsce wyświetlania jest w nim opisane jako USTAWIENIE („ma się
  // pokazywać"), a nie jako stan chwili — inaczej przy wyłączonym kole obiecywałby nieprawdę.
  const wh = whWhere();
  // Gałąź „center" jest tu z tego samego powodu, co w _whWhereNote: bez niej nowe miejsce wpadałoby
  // w ostatnie „albo", czyli to zdanie obiecywałoby ściągę i nakładkę komuś, kto wybrał środek ekranu.
  const gdzie = (wh === "cursor") ? "w okienku przy kursorze myszy"
    : (wh === "both") ? "przy kursorze myszy i w nakładce nad grą"
      : (wh === "center") ? "w okienku na środku ekranu"
        : "na ściądze oraz w nakładce nad grą";
  const whereEn = (wh === "cursor") ? "in the window at the mouse pointer"
    : (wh === "both") ? "at the mouse pointer and in the overlay over the game"
      : (wh === "center") ? "in a window in the middle of the screen"
        : "on the cheat sheet and in the overlay over the game";
  let t = _wheelT(
    "Koło ma " + whCountLabel(sl) + " i ma się pokazywać " + gdzie + ".",
    "The wheel has " + whCountLabel(sl) + " and is set to show " + whereEn + ".");
  if (sl.length > 8) t += " " + _wheelT(
    "Im więcej wycinków, tym precyzyjniej trzeba celować — przy ośmiu i mniej trafia się bez patrzenia, przy szesnastu już nie.",
    "The more slices there are, the more precisely you have to aim — with eight or fewer you hit one without looking, with sixteen you do not.");
  // PUSTE POLA. Wcześniej stało tu zdanie o „wycinkach bez akcji, które tylko się podświetlają" —
  // opis usterki, którą wypadałoby naprawić. To jest ta sama liczba i celowa funkcja: miejsce,
  // w którym wolno puścić przycisk i nic się nie stanie.
  if (bez) t += " " + _wheelT(
    "Pustych pól (bez akcji i bez makra): " + bez + ". Wybranie takiego pola nic nie wysyła, koło "
    + "po prostu się zamyka. To bezpieczne miejsce na puszczenie przycisku, gdy ręka zjedzie w bok "
    + "albo gdy zmienisz zdanie.",
    "Empty slices (with neither an action nor a macro): " + bez + ". Picking one sends nothing, the "
    + "wheel simply closes. That is a safe place to let the button go when your hand drifts or when "
    + "you change your mind.");
  const kids = sl.filter(s => s.children && s.children.length).length;
  if (kids) t += " " + _wheelT(
    "Wycinki z podmenu: " + kids + " — te nie wysyłają nic, tylko pokazują listę poziom niżej.",
    "Slices that open a submenu: " + kids + " — those send nothing, they show the level below.");
  return t;
}

// PRZEŁĄCZENIE JĘZYKA. Zdania tej karty składane są przez _gl() w chwili rysowania, więc chodzący
// po DOM-ie tłumacz ich nie ruszy. Wołane z setLang (rf-01).
function whRelang() {
  // Opcja „Pochylenie" wyzwalacza stoi na data-noi18n (goły klucz słownika to nazwa osi → „Tilt"),
  // więc przełączenie języka musi przepisać ją tutaj, a nie przez tłumacza.
  const tiltOpt = document.querySelector('#whTrigger option[value="tilt"]');
  if (tiltOpt) tiltOpt.textContent = _wheelT("Pochylenie", "A lean");
  whSync();
  // Przycisk „Przywróć fabryczne" w nagłówku listy Biblioteki jest składany przez _gl w chwili
  // rysowania (rf-46k), więc tłumacz chodzący po DOM-ie go nie ruszy — przepisujemy go sami.
  // (Siatka kafli presetów, którą trzeba tu było przerysowywać, zniknęła 2026-09-02.)
  if (typeof whLibFactoryRelang === "function") whLibFactoryRelang();
  if (typeof whStageRelang === "function") whStageRelang();
  // LISTA WYCINKÓW z tego samego powodu: jej plakietki („makro", „▸ n", „puste") składa _wheelT
  // w chwili rysowania. Po przerysowaniu wraca przez tłumacza jeszcze raz, bo setLang woła
  // applyLang PRZED tym hakiem — a statyczne podpowiedzi wierszy są w HTML-u po polsku i to
  // właśnie on je zamienia.
  if (typeof whRenderSlices === "function") {
    whRenderSlices();
    const box = document.getElementById("whSlices");
    if (box && typeof applyLang === "function") { try { applyLang(box); } catch (e) {} }
  }
}

// KAFLE „PODMENU" — trzy kształty z opisem, forma z prototypu. Kafel z opisem zamiast segmentu,
// bo różnica między nimi to nie nazwa, tylko to, co robią z ręką, i tego jednym słowem nie widać.
function whRenderSubTiles(sub) {
  const box = document.getElementById("whSubTiles"); if (!box) return;
  box.innerHTML = WHEEL_SUB.map(s =>
    `<button type="button" class="wh-tile${s[0] === sub ? " sel" : ""}" data-v="${s[0]}" title="${s[3]}">
      <span class="wh-tn">${s[1]}</span><span class="wh-td">${s[3]}</span></button>`).join("");
}

// ------------------------------------------------------------------------------------------
//  ZAPIS
// ------------------------------------------------------------------------------------------
// Ten sam wzorzec co mouseFetchState/postMouse (rf-15): serwer trzyma konfigurację per kapsel,
// karta trzyma jeden obiekt, a zapis wysyła CAŁOŚĆ — więc klik zrobiony przed przyjściem
// konfiguracji nowego kapsla nadpisałby ją ustawieniami poprzedniego.
// „Jeszcze wczytuję" na karcie pod pasem. Włączane Z OPÓŹNIENIEM (patrz wheelFetchState): na
// localhoście odpowiedź wraca w kilkanaście milisekund i mrugnięcie przy każdym kliknięciu byłoby
// gorsze od samego czekania. Sens ma dopiero wtedy, gdy serwer się ociąga — wtedy mówi, dlaczego
// pod nową nazwą stoją jeszcze stare wycinki.
function _whCardBusy(on) {
  const b = document.getElementById("whBody");
  if (!b) return;
  b.classList.toggle("is-busy", !!on);
  if (on) b.setAttribute("aria-busy", "true"); else b.removeAttribute("aria-busy");
}

function wheelFetchState(dev) {
  dev = dev || state.activeDeviceId || "d0";
  state.wheelDev = null;
  // KAFEL PRZESKAKUJE W CHWILI KLIKNIĘCIA (2026-09-10): po kliknięciu
  // «ustawiasz teraz» nie zmieniało się od razu, co było nieintuicyjne. Do tej pory
  // plakietka czekała na odpowiedź serwera, a rozumowanie brzmiało: karta należy do kapsla dopiero
  // wtedy, gdy przyjdzie jego konfiguracja. Tyle że kliknięcie jest ODPOWIEDZIĄ NA PYTANIE „którego
  // ustawiasz" i musi paść wtedy, kiedy pada pytanie — inaczej kafel wygląda na martwy i klika się
  // go drugi raz. Zapisu to nie psuje: `postWheel` odmawia, dopóki `state.wheelDev` nie zgadza się
  // z aktywnym kapslem, więc w tym oknie nic cudzego nie da się nadpisać. Pas rysuje wtedy kafle
  // z `D.wheelCfg` (rozgłoszenie `wheel_cfg`), czyli z prawdy, a nie z karty w trakcie wymiany.
  if (typeof wheelCapsSync === "function") wheelCapsSync();
  const slow = setTimeout(() => _whCardBusy(true), 120);
  return fetch("/wheel?dev=" + encodeURIComponent(dev)).then(r => r.json())
    .then(m => { if (m && !m.error) onWheelCfg(m); }).catch(() => {})
    // Okno „przy kursorze" jest per kapsel dokładnie tak samo jak reszta tej karty.
    .then(() => {
      clearTimeout(slow); _whCardBusy(false);
      state.wheelDev = dev; state.wheelWin = null; state.wheelWinUp = false; whCurFetch();
      // Drugie odświeżenie: teraz karta NAPRAWDĘ ma konfigurację tego kapsla, więc kafel może
      // pokazać to, co człowiek właśnie zmienił, zamiast ostatniego rozgłoszenia (_whCapsCfg).
      if (typeof wheelCapsSync === "function") wheelCapsSync();
    });
}

// Wycinki z odpowiedzi serwera, rekurencyjnie. Pola `icon`/`color`/`children` dopisujemy TYLKO gdy
// naprawdę są — dzięki temu koło zapisane, zanim podmenu istniały, wraca do serwera bajt w bajt
// takie, jakie przyszło.
function _whMapSlices(raw, depth) {
  return (Array.isArray(raw) ? raw : []).map(s => {
    const o = { label: String(s.label || ""), spec: String(s.spec || ""), sequence: String(s.sequence || "") };
    if (s.icon) o.icon = Array.from(String(s.icon)).slice(0, WHEEL_ICON_MAX).join("");
    if (_whCol(s.color)) o.color = String(s.color);
    const rep = parseInt(s.rep, 10) || 1;
    if (rep > 1) o.rep = Math.min(rep, WHEEL_REP_MAX);
    if (depth < WHEEL_MAX_DEPTH && Array.isArray(s.children) && s.children.length)
      o.children = _whMapSlices(s.children, depth + 1);
    return o;
  });
}

function onWheelCfg(m) {
  state.wheel = {
    enabled: !!m.enabled,
    holdMs: +m.holdMs || 300,
    confirm: WHEEL_MODES.some(x => x[0] === m.confirm) ? m.confirm : "release",
    confirmMs: +m.confirmMs || 600,
    deadzone: (+m.deadzone > 0 ? +m.deadzone : WHEEL_DEAD_DEF),
    // GDZIE POKAZYWAĆ KOŁO. Serwer dosyła to nawet do konfiguracji zapisanej, zanim ta opcja
    // istniała (przepisuje wtedy dotychczasowe zachowanie), więc karta nigdy nie zgaduje.
    showWhere: WH_WHERE.some(w => w[0] === m.showWhere) ? m.showWhere : "overlay",
    // PODMENU. Tak samo: brak pola = koło sprzed podmenu, czyli „Zastąp koło" i 300 ms.
    submenuMode: WHEEL_SUB.some(s => s[0] === m.submenuMode) ? m.submenuMode : "replace",
    subOpenMs: +m.subOpenMs || 300,
    iconChips: !!m.iconChips,
    // WYZWALACZ (tryb klikany). Brak pól = przycisk kapsla, czyli to, co koło robiło zawsze.
    trigger: (m.trigger === "tilt") ? "tilt" : "button",
    triggerAxis: (["any", "pitch", "roll"].indexOf(m.triggerAxis) >= 0) ? m.triggerAxis : "any",
    triggerMag: (+m.triggerMag > 0 ? +m.triggerMag : 0.55),
    // KOŁO ZAWSZE WIDOCZNE (tryb klikany). Brak pola = włączone, tak samo jak w silniku: to jest
    // domyślne zachowanie, a nie migracja starego.
    alwaysOn: m.alwaysOn !== false,
    // JAK NAZYWA SIĘ TO, CO KAPSEL MA NA SOBIE (rf-46j). Brak pola = koło ułożone ręcznie, nigdy
    // nie zapisane pod nazwą — i tak też się je pokazuje: bez etykiety, a nie jako brak danych.
    configName: String(m.configName || ""),
    // WYGLĄD. Brak pola = domyślny kształt z prototypu; sanityzację i tak robi serwer, tu tylko
    // dopełnienie, żeby suwaki miały co pokazać przed pierwszą odpowiedzią.
    look: wheelLook(m.look),
    slices: _whMapSlices(m.slices, 1)
  };
  state.wheelFocus = -1;
  state.wheelPath = [];      // konfiguracja przyszła od nowa — poziom sprzed niej mógł zniknąć
  state.wheelSeqRow = -1;    // …a razem z nim wycinek, do którego szło nagranie makra
  if (typeof stopSeqRec === "function") stopSeqRec();
  whRenderSlices(); whSync();
  // Pas kafli mówi, CZYJE to koło — a właśnie przyszło nowe, więc i kafel edytowanego kapsla,
  // i lista rozwijana, i nagłówek nad kartą mają się do niego dostroić (rf-46h).
  if (typeof wheelCapsSync === "function") wheelCapsSync();
  if (typeof whStageReset === "function") whStageReset();
}

function postWheel() {
  const dev = state.wheelDev;
  if (!dev || dev !== (state.activeDeviceId || "d0")) return;   // cudza konfiguracja — nie zapisuj
  return fetch("/wheel?dev=" + encodeURIComponent(dev), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state.wheel)
  }).then(r => r.json()).then(m => {
    if (!m) return null;
    // Serwer zwraca konfigurację TAKĄ, JAKA JEST po jego własnych obcięciach. Przełącznik
    // przepisujemy z odpowiedzi, bo tylko on może się nie zgodzić z tym, co wysłaliśmy; pól
    // tekstowych nie ruszamy, żeby nie wyrywać kursora spod palców w trakcie pisania.
    if (typeof m.enabled === "boolean" && m.enabled !== state.wheel.enabled) {
      state.wheel.enabled = m.enabled; whSync();
    }
    if (m.error) whToast(m.error, true);
    return m;
  }).catch(() => null);
}
let _wheelT_timer = null;
function commitWheel() {
  // JEDYNY LEJEK ZMIAN CZŁOWIEKA. Wołany wyłącznie z uchwytów edycji (suwaki, pola, dodanie
  // i usunięcie wycinka) — nigdy przy starcie ani przy pakiecie z serwera. To czyni go właściwym
  // miejscem, żeby OTWORZYĆ koło na scenie: zmiana ma być widoczna w chwili, w której zapada,
  // a nie po ręcznym otwarciu podglądu (patrz whStageWake w rf-46d).
  if (typeof whStageWake === "function") whStageWake();
  clearTimeout(_wheelT_timer);
  _wheelT_timer = setTimeout(postWheel, 250);
}

// ------------------------------------------------------------------------------------------
//  OKNO „PRZY KURSORZE"
// ------------------------------------------------------------------------------------------
// Ustawienia tego okienka to zwykła konfiguracja nakładki i idą tym samym torem, co wszystkie inne
// (/overlay, act:"config") — nie ma tu drugiego magazynu ustawień, który mógłby się rozjechać
// z pierwszym. Otwiera je i zamyka SERWER, na podstawie wyboru „Gdzie pokazywać koło".
state.wheelWin = null;        // konfiguracja okna „<kapsel>~kolo" (null = jeszcze nie wczytana)
state.wheelWinUp = false;     // czy okno jest teraz otwarte
state.wheelWinAvail = null;   // czy nakładki w ogóle da się otworzyć (null = jeszcze nie wiemy)
state.wheelWinWhy = "";       // ...a jeśli nie, to dlaczego (słowami serwera)
let _whCurT = null;
let _whSizeMigrated = "";     // dla którego kapsla sprawdziliśmy już starą wielkość okna

function whCurDev() { return state.wheelDev || state.activeDeviceId || "d0"; }
function whCurWid() { return whCurDev() + WH_CUR_SUF; }

// Odczyt stanu okna. Pytamy PO NAZWIE, bo okno koła jest celowo pominięte w listach nakładek —
// jedno okno z dwoma przełącznikami w dwóch miejscach to okno, którego stanu nikt nie przewidzi.
function whCurFetch() {
  if (typeof ovlGet !== "function") return Promise.resolve();
  return ovlGet(whCurWid()).then(s => {
    if (!s) { state.wheelWinAvail = null; whCurSync(); return; }
    state.wheelWinAvail = (s.avail !== false);
    state.wheelWinWhy = String(s.reason || "");
    const w = s.window || {};
    state.wheelWin = w.config || null;
    state.wheelWinUp = !!w.running;
    _whAdoptOldSize();
    whCurSync();
  }).catch(() => {});
}

// MIGRACJA STAREJ WIELKOŚCI OKIENKA. Do 2026-08-26 wielkość mieszkała w konfiguracji okna („w"),
// a nie w kole; kto ją sobie przestawił, straciłby ją bez tego przy pierwszym otwarciu nowej karty.
// Robione RAZ na kapsel i tylko wtedy, gdy koło nadal ma wielkość domyślną: ustawienie zrobione
// świadomie w nowym suwaku nie ma prawa zostać nadpisane przez ślad po starym.
//
// DWIE WARTOŚCI ZNACZĄ „NIKT TEGO NIE RUSZAŁ": 360 px, czyli fabryczny bok okna sprzed zmiany
// (OVERLAY_WHEEL_DEFAULTS.w), oraz bok policzony z dzisiejszej wielkości domyślnej. Bez pierwszej
// z nich migracja odpalała KAŻDEMU, kto nigdy nie dotknął starego suwaka, i cicho zmniejszała mu
// koło z 360 na 317 px przy pierwszym wejściu w kartę.
const WH_WIN_OLD_DEF = 360;
function _whAdoptOldSize() {
  const dev = whCurDev();
  if (_whSizeMigrated === dev) return;
  _whSizeMigrated = dev;
  const cfg = state.wheelWin;
  if (!cfg || !state.wheel) return;
  const lk = wheelLook(state.wheel.look);
  if (Math.round(lk.size) !== WHEEL_SIZE_DEF) return;             // ktoś już ustawił swoją wielkość
  const oldBox = Math.round(+cfg.w || 0);
  if (!oldBox || oldBox === WH_WIN_OLD_DEF || oldBox === wheelBoxPx(WHEEL_SIZE_DEF)) return;
  const size = Math.max(WHEEL_SIZE_MIN, Math.min(WHEEL_SIZE_MAX, Math.round(oldBox * 0.88)));
  state.wheel.look = wheelLook({ size: size, gapDeg: lk.gapDeg, corner: lk.corner });
  whSync();
  postWheel();
}

function whCurSend(patch, now) {
  if (!state.wheelWin || typeof ovlPost !== "function") return;
  Object.assign(state.wheelWin, patch);
  whCurSync();
  clearTimeout(_whCurT);
  const go = () => ovlPost({ win: whCurWid(), dev: whCurDev(), act: "config", config: state.wheelWin });
  if (now) go(); else _whCurT = setTimeout(go, 220);
}

// GDZIE POKAZYWAĆ KOŁO. Wybór jest jeden i zapisuje się w konfiguracji koła (/wheel), a okienko
// przy kursorze otwiera i zamyka SERWER na jego podstawie. Zapis natychmiastowy, bez zwykłego
// opóźnienia: to nie jest wpisywanie w pole tekstowe, tylko przestawienie miejsca.
function whSetWhere(v) {
  if (WH_WHERE.every(w => w[0] !== v)) return;
  if (state.wheel.showWhere === v) return;
  state.wheel.showWhere = v;
  whSync();
  postWheel();
  // Prawda o samym oknie (czy wstało, jakie ma ustawienia) jest po stronie serwera.
  setTimeout(whCurFetch, 900);
}

// WIELKOŚĆ OKNA idzie za wielkością koła — jedna liczba, dwa skutki. Okno musi być odrobinę
// większe niż średnica, bo rysunek zajmuje 88% jego boku (patrz wheelBoxPx).
function whPushWinSize() {
  if (!state.wheelWin) return;
  const px = wheelBoxPx(wheelLook(state.wheel.look).size);
  if (Math.round(+state.wheelWin.w || 0) === px && Math.round(+state.wheelWin.h || 0) === px) return;
  whCurSend({ w: px, h: px });
}

function whCurSync() {
  const $ = id => document.getElementById(id);
  const sec = $("whCurSec"); if (!sec) return;
  const cfg = state.wheelWin || {}, dead = (state.wheelWinAvail === false);
  const where = whWhere(), wantsWin = whWantsWin(where);
  const up = !!state.wheelWinUp;
  const sg = $("whWhereSeg");
  if (sg) sg.querySelectorAll("button").forEach(x => {
    const on = (x.dataset.v === where);
    x.classList.toggle("on", on);
    x.setAttribute("aria-pressed", on ? "true" : "false");
  });
  sec.classList.toggle("is-on", wantsWin && !dead);
  sec.classList.toggle("is-dead", dead);
  // Ustawienia okienka mają sens tylko wtedy, gdy okienko w ogóle stoi. Przy „W nakładkach"
  // znikają zamiast gasnąć: wyszarzony suwak to pytanie, na które nie ma dobrej odpowiedzi.
  const body = $("whCurBody"); if (body) body.style.display = wantsWin ? "" : "none";
  // ZAPALONY STYL. „bare" nie jest tu zgadywaniem: to domyślny motyw KAŻDEGO okna po stronie serwera
  // (OVERLAY_WIN_DEFAULTS), więc okno bez zapisanego `theme` naprawdę nosi „Samą treść" — ta sama
  // wartość awaryjna, co w edytorze nakładek (rf-41c), żeby oba ekrany podświetlały ten sam przycisk.
  const ths = $("whCurThemes");
  if (ths) {
    const cur = cfg.theme || "bare";
    ths.querySelectorAll("button[data-theme]").forEach(b =>
      b.classList.toggle("on", b.dataset.theme === cur));
  }
  const op = Math.max(20, Math.min(100, +cfg.opacity || 100));
  const orr = $("whCurOpacity"); if (orr && document.activeElement !== orr && +orr.value !== op) orr.value = op;
  const ov = $("whCurOpacityV"); if (ov) ov.textContent = op + "%";
  const sn = $("whCurSizeNote");
  if (sn) sn.textContent = _wheelT(
    "Bok okienka bierze się z „Wielkości koła” w sekcji Wygląd: " + wheelBoxPx(wheelLook(state.wheel.look).size)
    + " px na koło o średnicy " + Math.round(wheelLook(state.wheel.look).size) + " px.",
    "The window's side comes from “Wheel size” in the Look section: " + wheelBoxPx(wheelLook(state.wheel.look).size)
    + " px for a wheel " + Math.round(wheelLook(state.wheel.look).size) + " px across.");
  // CO TU ROBI TO ZDANIE, SKORO PRZYCISKI STYLU SĄ JUŻ W KARCIE (2026-09-06). Do dziś prowadziło
  // na ekran „Nakładka", bo styl dawało się wybrać tylko tam; odkąd stoi w sekcji „Gdzie pokazywać
  // koło", wysyłanie kogokolwiek gdzie indziej byłoby wskazywaniem drogi do miejsca, w którym ta
  // osoba już jest. Zostaje jedyna rzecz, której same przyciski nie mówią: CZYM ten styl jest.
  // Bo w sekcji „Wygląd" — a to jest jej zdanie — cztery suwaki wyżej opisują KOŁO, i bez tego
  // rozróżnienia styl czytałby się jak piąty z nich. Styl ubiera OKNO, czyli to, co leży pod kołem;
  // koło samo wygląda wszędzie tak samo. Nazwa aktualnego wyglądu zostaje, bo sekcja „Wygląd" bywa
  // rozwinięta wtedy, gdy „Gdzie pokazywać koło" jest zwinięta — i odwrotnie.
  const lwn = $("whLookWinNote");
  if (lwn) {
    const ovl = (where === "overlay" || where === "both");
    const th = cfg.theme || "bare";
    const nazwa = ((typeof RF_LOOKS !== "undefined" ? RF_LOOKS : [])
      .find(l => l.k === th) || {}).label || th;
    const okienko = _wheelT(
      "Styl okienka („" + nazwa + "”) ubiera OKNO, a nie samo koło: mówi, co leży pod kołem — karta, "
      + "ciemna karta albo nic. Wybierasz go w sekcji „Gdzie pokazywać koło”.",
      "The window style (“" + _cvT(nazwa) + "”) dresses the WINDOW, not the wheel itself: it says what "
      + "lies under the wheel — a card, a dark card or nothing. You pick it in the “Where to show the wheel” section.");
    const gdzieIndziej = _wheelT(
      "W nakładkach nad grą koło bierze wygląd z ustawień danego okna.",
      "In the overlays over the game the wheel takes its look from that window's settings.");
    lwn.textContent = (wantsWin ? okienko : "") + (ovl ? (wantsWin ? " " : "") + gdzieIndziej : "");
  }
  const n = $("whCurNote");
  if (n) n.textContent = _whWhereNote(where, { dead: dead, up: up });
}

// Jedno zdanie o AKTUALNYM wyborze — zmienia się razem z segmentem, bo opis trzech miejsc naraz
// byłby ogólnikiem, którego nikt nie czyta.
function _whWhereNote(where, s) {
  s = s || {};
  const wantsWin = whWantsWin(where);
  // Zdanie o niedostępności mówi „okienka nakładki", a nie „okienka przy kursorze" — i dobrze:
  // brak jest brakiem SAMEJ możliwości otwarcia okna, ten sam przy kursorze i na środku ekranu.
  if (s.dead && wantsWin) {
    return _wheelT("Na tym komputerze nie da się otworzyć okienka nakładki: ",
      "This machine cannot open an overlay window: ") + (state.wheelWinWhy || "—");
  }
  let t;
  if (where === "cursor") {
    t = _wheelT(
      "Koło pokazuje się w okienku przy kursorze myszy; nakładki nad grą go wtedy nie rysują.",
      "The wheel appears in the window at the mouse pointer; the overlays over the game do not draw it then.");
  } else if (where === "both") {
    t = _wheelT(
      "Koło pokazuje się i w okienku przy kursorze, i w nakładkach nad grą.",
      "The wheel appears both in the window at the pointer and in the overlays over the game.");
  } else if (where === "center") {
    t = _wheelT(
      "Koło pokazuje się w okienku na środku ekranu; nakładki nad grą go wtedy nie rysują.",
      "The wheel appears in a window in the middle of the screen; the overlays over the game do not draw it then.");
  } else {
    t = _wheelT(
      "Koło pokazuje się na ściądze i w nakładkach nad grą; okienko przy kursorze jest zamknięte.",
      "The wheel appears on the cheat sheet and in the overlays over the game; the window at the pointer is closed.");
  }
  if (!state.wheel.enabled) {
    t += " " + _wheelT("Samo koło jest teraz wyłączone, więc nigdzie się nie pokaże — włącz je przełącznikiem u góry karty.",
      "The wheel itself is off right now, so it will not appear anywhere — switch it on at the top of this card.");
  } else if (wantsWin && !s.up) {
    // Nazwa okna wychodzi z _whWinName, bo to zdanie pokazuje się TAKŻE przy „Na środku ekranu" —
    // a wtedy „okienko przy kursorze się uruchamia" byłoby meldunkiem o oknie, którego nikt nie prosił.
    t += " " + _whWinName(where) + _wheelT(" się uruchamia…", " is starting up…");
  }
  return t;
}

// ------------------------------------------------------------------------------------------
//  START
// ------------------------------------------------------------------------------------------
function initWheel() {
  const card = document.getElementById("wheelCard");
  if (!card) return;                       // karty nie ma (nakładka / ściąga) — nie ma czego podpinać
  const $ = id => document.getElementById(id);
  const b = $("wheelEnable");
  if (b) b.onclick = () => {
    const want = !state.wheel.enabled;
    if (want && (state.wheel.slices || []).length < WHEEL_MIN_SLICES) {
      whToast(_wheelT("Koło potrzebuje co najmniej dwóch wycinków.",
        "The wheel needs at least two slices."), true);
      return;
    }
    const apply = () => { state.wheel.enabled = want; whSync(); postWheel(); };
    // W symulacji pierwsze włączenie wyjścia trzeba potwierdzić (rf-39f) — koło wysyła naprawdę.
    if (want && typeof rfSimConfirmOn === "function") rfSimConfirmOn(want, apply, "wheel"); else apply();
  };
  const hr = $("whHold");
  if (hr) hr.oninput = () => { state.wheel.holdMs = +hr.value; whSync(); commitWheel(); };
  const cs = $("whConfirm");
  if (cs) cs.onchange = () => { state.wheel.confirm = cs.value; whSync(); commitWheel(); };
  const wr = $("whWait");
  if (wr) wr.oninput = () => { state.wheel.confirmMs = +wr.value; whSync(); commitWheel(); };
  const dz = $("whDead");
  if (dz) dz.oninput = () => { state.wheel.deadzone = (+dz.value) / 100; whSync(); commitWheel(); };
  // PODMENU — kształt, czas otwarcia i kolorowe kółka.
  const st = $("whSubTiles");
  if (st) st.onclick = (e) => {
    const t = e.target.closest("button[data-v]"); if (!t) return;
    if (!WHEEL_SUB.some(s => s[0] === t.dataset.v)) return;
    state.wheel.submenuMode = t.dataset.v;
    whSync(); commitWheel();
  };
  const so = $("whSubOpen");
  if (so) so.oninput = () => { state.wheel.subOpenMs = +so.value; whSync(); commitWheel(); };
  const ch = $("whChips");
  if (ch) ch.onchange = () => { state.wheel.iconChips = !!ch.checked; whSync(); commitWheel(); };
  const ab = $("whAlways");
  if (ab) ab.onchange = () => { state.wheel.alwaysOn = !!ab.checked; whSync(); commitWheel(); };
  const ts = $("whTrigger");
  if (ts) ts.onchange = () => { state.wheel.trigger = ts.value; whSync(); commitWheel(); };
  const tax = $("whTrigAxis");
  if (tax) tax.onchange = () => { state.wheel.triggerAxis = tax.value; whSync(); commitWheel(); };
  const tmr = $("whTrigMag");
  if (tmr) tmr.oninput = () => {
    state.wheel.triggerMag = (+tmr.value || 55) / 100; whSync(); commitWheel();
  };
  // JEDNA POZYCJA ZEROWA W CAŁEJ APLIKACJI. Ten przycisk woła TĘ SAMĄ kalibrację, co „Kalibruj
  // (wyśrodkuj)" w zakładce „Mysz" — druga, własna neutralna koła byłaby drugą odpowiedzią na
  // pytanie „gdzie jest prosto", a kapsel ma jedno prosto.
  const tcal = $("whTrigCal");
  // Jedno „Wyśrodkuj kapsel” w całej aplikacji (rf-06 `rfCenterCapsule`): napis przy przycisku i bąbel.
  if (tcal) tcal.onclick = (e) => {
    if (typeof rfCenterCapsule === "function") rfCenterCapsule(e.currentTarget);
  };
  // WYGLĄD — trzy liczby kształtu. Wielkość dodatkowo przestawia okno przy kursorze.
  const _look = (patch) => {
    state.wheel.look = wheelLook(Object.assign({}, wheelLook(state.wheel.look), patch));
    whSync(); commitWheel();
  };
  const sz = $("whSize");
  if (sz) sz.oninput = () => { _look({ size: +sz.value }); whPushWinSize(); };
  const gp = $("whGap");
  if (gp) gp.oninput = () => _look({ gapDeg: +gp.value });
  const cr = $("whCorner");
  if (cr) cr.oninput = () => _look({ corner: +cr.value });
  // Suwak chodzi w PROCENTACH, konfiguracja trzyma KROTNOŚĆ — jedno dzielenie w jednym miejscu,
  // żeby po obu stronach kabla leżała ta sama liczba, co w silniku (RadialMenu.FONT_*).
  const ft = $("whFont");
  if (ft) ft.oninput = () => _look({ fontScale: (+ft.value) / 100 });
  // DWA PRZYCISKI, JEDNA FUNKCJA (whAddSlice w rf-46c): dokładają ten sam obiekt, bo puste pole to
  // zwykły wycinek, w którym jeszcze nic nie stoi. Różni je tylko to, gdzie ląduje kursor.
  const add = $("whAdd");
  if (add) add.onclick = () => whAddSlice(false);
  const adm = $("whAddEmpty");
  if (adm) adm.onclick = () => whAddSlice(true);
  // GDZIE POKAZYWAĆ KOŁO
  const sg = $("whWhereSeg");
  if (sg) sg.onclick = (e) => {
    const t = e.target.closest("button[data-v]"); if (!t) return;
    whSetWhere(t.dataset.v);
  };
  // STYL OKIENKA — BEZ ZWŁOKI (`now = true`). Zwłoka 220 ms w whCurSend jest dla suwaka, po którym
  // ręka jedzie i który po drodze wypluwa kilkadziesiąt wartości; tu jest jedno kliknięcie i jedna
  // wartość, a okno ma się przemalować w tej samej chwili, w której przycisk się zapala — inaczej
  // przez ćwierć sekundy karta pokazuje jeden styl, a okno nad grą drugi.
  const th = $("whCurThemes");
  if (th) th.onclick = (e) => {
    const t = e.target.closest("button[data-theme]"); if (!t) return;
    whCurSend({ theme: t.dataset.theme }, true);
  };
  const co = $("whCurOpacity");
  if (co) co.oninput = () => whCurSend({ opacity: +co.value });
  // Sekcje pamiętają, czy były rozwinięte — siedem sekcji rozwijanych od nowa przy każdym wejściu
  // w zakładkę to siedem kliknięć na powrót do tego, co się właśnie robiło.
  document.querySelectorAll("#whEdit details.wh-sec").forEach(d => {
    d.addEventListener("toggle", () => {
      try { localStorage.setItem(WH_SEC_KEY + d.dataset.sec, d.open ? "1" : "0"); } catch (e) {}
    });
  });
  _whTiersInit();
  if (typeof whInitStage === "function") whInitStage();
  if (typeof whInitIo === "function") whInitIo();
  if (typeof wheelCapsRender === "function") wheelCapsRender();
  whRenderSlices();
  whSync();
  // Wczytaj konfigurację TEGO kapsla tak samo, jak robi to przełączenie kapsla — dopóki
  // state.wheelDev nie wskazuje kapsla, postWheel celowo odmawia zapisu.
  wheelFetchState();
}

// ===== UX 261120 L4e: piętra karty koła =====
// Trzy zwijaki piętra 2 (Wygląd, Sterowanie, Gdzie pokazywać koło) i „Zaawansowane” na dole.
// Domyślne wartości stoją w HTML (`data-def`) i są lustrem RadialMenu.DEFAULTS w monitorze.
// „Przywróć domyślne” wpisuje je w kontrolki i woła ich własne nasłuchy, więc zapis idzie tą samą
// drogą co ręczna zmiana (commitWheel, whCurSend); cofnięcie robi to samo w drugą stronę.
let _whTierSyncs = [];
function _whResetCtrls(det) {
  det.querySelectorAll("[data-def]").forEach(el => {
    if (typeof rfTier.shown === "function" && !rfTier.shown(el, det)) return;
    const def = el.getAttribute("data-def");
    if (el.classList.contains("seg")) {
      const b = el.querySelector('button[data-v="' + def + '"]');
      if (b && !b.classList.contains("on")) b.click();
      return;
    }
    if (el.type === "checkbox") { if (el.checked === el.defaultChecked) return; el.checked = el.defaultChecked; }
    else if (el.tagName === "SELECT") {
      const o = Array.from(el.options).find(x => x.defaultSelected) || el.options[0];
      if (!o || el.value === o.value) return; el.value = o.value;
    } else { if (el.value === el.defaultValue) return; el.value = el.defaultValue; }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
function _whTiersInit() {
  if (typeof rfTier !== "function") return;
  const $ = id => document.getElementById(id);
  const reset = id => () => _whResetCtrls($(id));
  _whTierSyncs = [
    rfTier($("whFold-wyglad"), "kolo.wyglad", {
      reset: reset("whFold-wyglad"),
      sum: () => _wheelT("Koło ", "Wheel ") + (($("whSizeV") || {}).textContent || "")
        + " · " + _wheelT("pismo ", "lettering ") + (($("whFontV") || {}).textContent || "")
    }),
    rfTier($("whFold-sterowanie"), "kolo.sterowanie", { reset: reset("whFold-sterowanie") }),
    rfTier($("whFold-gdzie"), "kolo.gdzie", {
      reset: reset("whFold-gdzie"),
      sum: () => { const b = document.querySelector("#whWhereSeg button.on"); return b ? b.textContent.trim() : ""; }
    }),
    rfTier($("whAdv"), "kolo.zaawansowane", { reset: reset("whAdv") }),
  ];
}
// Po wpisaniu konfiguracji z serwera (whSync) nagłówki zwijaków nadążają od razu.
function _whTierSync() { for (const f of _whTierSyncs) try { f(); } catch (e) { } }
// (koniec sekcji L4e)
