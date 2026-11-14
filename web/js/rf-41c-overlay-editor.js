"use strict";
// ============================================================================
//  NAKŁADKI — EDYTOR JEDNEGO OKNA W PANELU (dwie karty pod galerią, rf-41b)
//
//  Te same ustawienia, co w szufladzie ⚙ tego okna, tylko z drugiej strony: tam ustawia się okno,
//  patrząc na grę pod nim, tu — nie ruszając go z miejsca i nie stawiając niczego nad grą. Jedna
//  wartość, dwa miejsca, żadnej trzeciej prawdy: obie strony czytają i piszą przez `/overlay`,
//  a panel po każdym zapisie dopytuje o pełny stan (patrz `ovmSend` w rf-41b).
//
//  DWIE KARTY, JEDNA POD DRUGĄ (2026-09-01 rozdzielenie, 2026-09-09 zejście z osobnej zakładki).
//  Granica między nimi biegnie tam, gdzie zmienia się PYTANIE:
//    • „Ustawienia tego okna" — CZYM to okno jest: jak się nazywa, co w nim stoi, gdzie i jak
//                    duże, czy trzyma się na wierzchu i czy przepuszcza kliknięcia.
//    • „Wygląd tego okna"     — JAK to wygląda: motyw, obrys, przyciemnione tło, przezroczystość
//                    i rozmiar całości.
//  Dwie karty zostają, bo pytania są dwa. Osobna ZAKŁADKA odpadła 09-09, bo
//  w wyglądzie było tylko jedno okienko, więc trafiło pod «Ustawienia tego
//  okna»: karta wygląda pod tamtą, a nie o jedno kliknięcie dalej. Znaczniki obu są nietknięte —
//  zmieniło się wyłącznie to, na którą zakładkę idą (rf-41b).
//  ZAWARTOŚĆ MA JEDNO MIEJSCE (od 2026-09-01) — listę bloków w karcie ustawień. Do tego dnia
//  była rozdana na trzy: oczy tutaj, suwaki rozmiaru w „Wyglądzie", pigułki „w wierszu reguły"
//  pomiędzy. „Wygląd" jest teraz wyłącznie o skórze okna i nic o jego zawartości nie mówi.
//
//  PODGLĄD STOI NAD OBIEMA KARTAMI (rf-41d + `shared` w rf-49p) — bez tego wybór motywu byłby
//  wyborem na ślepo. Od 09-09 nie musi już przeżywać przełączania zakładek, ale zostaje tam, gdzie
//  był: „Ściąga" go nie potrzebuje i nadal go nie dostaje.
//
//  WIELKOŚCI TU NIE MA (od 2026-09-01) — ani proporcji, ani pól „Szerokość/Wysokość". Okno mierzy
//  się samo: szerokość idzie za „Rozmiarem całości", wysokość za tym, co w nim włączone (patrz
//  `ovlAutoFit` w rf-41). Zostaje odczyt i położenie.
//
//  DLACZEGO NIE JEDEN WSPÓLNY KOD Z SZUFLADĄ. Wspólne są LISTY — części (OVL_PARTS), wyglądy
//  (RF_LOOKS → OVL_THEMES) i obrysy (OVL_OUTLINES), wszystkie w rf-41.
//  To one się rozjeżdżały (do 2026-08-27 dwie listy wyglądów nazywały ten sam kod inaczej).
//  Znaczniki są osobne, bo powierzchnie są osobne: szuflada to ciemny, wąski pasek nad grą
//  szeroki na jedną kolumnę, a to są karty panelu — jasne, dwukolumnowe, z tokenami panelu.
//
//  OKNO KOŁA POKAZUJE MNIEJ, I TO JEST TREŚĆ, NIE BRAK. Nie ma miejsca (chodzi za kursorem),
//  nie ma rozmiaru własnego (bok liczy się z „Wielkości koła" w karcie „Koło wyboru"), nie ma
//  wyboru części (jest w nim wyłącznie koło) i nie ma przełącznika kliknięć (zawsze przepuszcza,
//  bo stoi dokładnie pod wskaźnikiem). Wyszarzone kontrolki, których nie da się użyć, uczą, że
//  kontrolki nic nie robią — więc ich tu po prostu nie ma, a zdanie mówi, gdzie te rzeczy stoją.
//
//  Po rf-41 (kanon list) i rf-41b (karty, wybór okna, zapis). Nie ma własnego stanu poza tym,
//  które okno jest wybrane — całość rysuje się z configu, który przyszedł z serwera.
// ============================================================================

const RF_OVME_I18N = {
  "Ustawienia tego okna": "This window's settings",
  "Wygląd tego okna": "This window's look",
  "co to za okno, co w nim stoi i gdzie": "what this window is, what stands in it and where",
  "Nazwa": "Name",
  "Zawartość": "Contents",
  "Rozmiar": "Size",
  "Kliknij wiersz, żeby ustawić szczegóły; kolejność zmieniasz przeciąganiem.":
    "Click a row to set its details; drag to change the order.",
  "Przeciągnij, żeby zmienić kolejność. Strzałkami góra i dół też.":
    "Drag to change the order. The up and down arrows do it too.",
  "Powiększa całe okno naraz; pojedynczy element ma własny rozmiar w swoim wierszu.":
    "Enlarges the whole window at once; a single part has its own size in its row.",
  "Szerokość": "Width",
  "Ile miejsca w poziomie ma treść. Wąsko — opisy reguł się zawijają; szeroko — rysunki dostają powietrze. Wysokość okno dobiera samo.":
    "How much room the content gets side to side. Narrow — the rule descriptions wrap; wide — the drawings get air. The window picks its own height.",
  "Miejsce i wielkość": "Place and size",
  "Położenie": "Position",
  "jeszcze nie postawione": "not placed yet",
  "Okno jeszcze nigdzie nie stoi — postawi się samo przy pierwszym pokazaniu, przy prawej krawędzi ekranu.":
    "The window has no place yet — it will take one down the right-hand edge of the screen the first time it is shown.",
  "Przesuń o pół ekranu w prawo albo w dół, wpisując liczbę: to ta sama para, którą okno zapamiętuje po przeciągnięciu za pasek.":
    "Move it half a screen right or down by typing a number: this is the same pair the window remembers after being dragged by its bar.",
  "Trzymaj na wierzchu": "Keep on top",
  "Okno stoi nad grą i nad innymi oknami. Wyłącz, a schowa się pod nimi jak zwykłe okno.":
    "The window stands above the game and above other windows. Switch it off and it hides behind them like an ordinary window.",
  // PASEK OKNA (2026-09-03). Jedyne miejsce, z którego da się go WŁĄCZYĆ z powrotem — okno bez
  // paska nie ma czego kliknąć — więc zdanie pod przełącznikiem mówi to wprost.
  "Pasek okna (uchwyt do przesuwania i ⚙)": "Window bar (drag handle and ⚙)",
  "Pasek okna": "Window bar",
  "Pasek u góry nakładki: uchwyt do przesuwania, pinezka, ⚙ i ✕. Wyłączony — okno przesuwasz i ustawiasz wyłącznie stąd, a nad grą nie zostaje ani kawałek, który łapie mysz.":
    "The strip at the top of the overlay: the drag handle, the pin, ⚙ and ✕. Switched off, the window is moved and set up from here alone, and not a piece of it over the game catches the mouse.",
  "Wyłączony pasek znaczy: przesuwanie suwakami wyżej, reszta w tych zakładkach, zamykanie przyciskiem w nagłówku karty. Włączyć go z powrotem można tylko tutaj.":
    "A bar switched off means: moved with the sliders above, the rest on these tabs, closed with the button in the card's header. Here is the only place it can be switched back on.",
  // OTWÓRZ / ZAMKNIJ WYBRANE OKNO — w nagłówku karty ustawień, czyli przy oknie, o którym mowa.
  // („Pokaż nad grą" ma parę w rf-41 i celowo jej tu nie powtarzamy: to ten sam napis, co na
  //  przyciskach w pasku okien, i ma zostać jednym napisem.)
  "Postaw to okno nad grą — zmiany poniżej widać w nim od razu":
    "Put this window over the game — the changes below show in it at once",
  "Zamknij to okno. Jego miejsce, rozmiar i ustawienia zostają — otworzysz je tym samym przyciskiem.":
    "Close this window. Its place, size and settings stay — the same button opens it again.",
  // POŁOŻENIE SUWAKAMI (2026-09-03).
  "Suwaki sięgają krawędzi Twoich ekranów; pole obok przyjmuje każdą liczbę.":
    "The sliders reach the edges of your screens; the field alongside takes any figure.",
  // ZASTANE, ZŁAPANE 2026-09-01 PRZY SKANIE BRAKUJĄCYCH PAR: walker dopasowuje CAŁE węzły
  // tekstowe, a rysunek myszy siedzi w tym samym węźle co napis — więc para bez niego nie
  // trafiała w nic i przycisk zostawał po polsku także w sesji angielskiej.
  "🖱 Przepuszczaj kliknięcia": "🖱 Let clicks through",
  "Koło przy kursorze zawsze przepuszcza kliknięcia i zawsze stoi pod wskaźnikiem — dlatego nie ma tu ani miejsca, ani rogu do ciągnięcia. Wielkość bierze z „Wielkości koła” w karcie „Koło wyboru”.":
    "The wheel at the pointer always passes clicks through and always sits under the pointer — which is why there is neither a place nor a corner to drag here. Its size comes from “Wheel size” in the “Selection wheel” card.",
  "Wybierz okno powyżej, żeby zobaczyć jego ustawienia.": "Choose a window above to see its settings.",
  "pusto": "empty",
  "Nie ma ani jednego wyzwalacza — dopisz regułę w „Mapowaniu”, a ten element się zapali":
    "There is not a single trigger — add a rule in “Mapping” and this part lights up",
  "Nic nie mówi do kontrolera: ani reguła „pad:…”, ani drążek. Ustawisz to w „Kontrolerze”.":
    "Nothing is speaking to the controller: neither a “pad:…” rule nor the stick. That is set in “Controller”.",
  "Koło ma mniej niż dwa wycinki, więc nie ma z czego wybierać. Dodaj je w „Kole wyboru”.":
    "The wheel has fewer than two slices, so there is nothing to choose from. Add them in “Selection wheel”.",
  "Sterowanie ruchem jest na tym kapslu wyłączone — włączysz je w „Myszy”":
    "Motion control is switched off on this capsule — you switch it on in “Mouse”",
  "Nie ma ani jednego mapowania MIDI ani OSC": "There is not a single MIDI or OSC mapping",
  "Pokazuj": "Show",
  "cały kontroler": "the whole controller",
  "ten kapsel": "this capsule only",
  "Wszystkie kapsle wpięte w ten kontroler — każdy swoim kolorem":
    "Every capsule plugged into this controller — each in its own colour",
  "Tylko kapsel tego okna": "Only this window's capsule",
  "dopasuje się przy pierwszym pokazaniu": "it will fit itself the first time it is shown",
  "Okno dopasowuje się samo: szerokość idzie za „Szerokością” i „Rozmiarem całości”, wysokość za tym, co w nim włączone.":
    "The window fits itself: the width follows “Whole overlay”, the height follows whatever is switched on in it.",
  "Czekam na odpowiedź aplikacji…": "Waiting for the application…",
  "To okno powstanie przy pierwszym pokazaniu — ustawienia poniżej już teraz na nie czekają.":
    "This window will come into being the first time it is shown — the settings below are already waiting for it.",
};
try { Object.assign(I18N_EN, RF_OVME_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

// ------------------------------------------------------------------------------------------
//  ZAWARTOŚĆ — JEDNA LISTA ZAMIAST TRZECH MIEJSC
// ------------------------------------------------------------------------------------------
// DLACZEGO (2026-09-01): edytor nakładek ma wizualnie pozwalać edytować
// rozmieszczenie (drag'n'drop) i zawartość, intuicyjnie i bez
// zasypywania użytkownika nadmiarem informacji.
//
// Do tego dnia jedna sprawa — „co jest w oknie" — była rozdana na TRZY miejsca: oczy w zakładce
// „Nakładka", suwaki rozmiaru w zakładce „Wygląd" i dwie pigułki „w wierszu reguły" pomiędzy.
// Trzynaście jednakowych wierszy, z których nie dało się wyczytać, że „wykres" należy do
// „wyzwalaczy", a rozmiar tej samej rzeczy ustawia się o zakładkę dalej.
//
// Teraz jest JEDEN WIERSZ NA RZECZ, a wszystko o tej rzeczy siedzi w nim:
//   • uchwyt ⠿ — kolejność (przeciągnięciem albo strzałkami, gdy uchwyt ma ognisko),
//   • oko      — czy w ogóle widać,
//   • nazwa i rozmiar w procentach — jednym spojrzeniem,
//   • rozwinięcie — suwak rozmiaru i drobiazgi TEJ części („opis reguły", „liczby pod kulą").
//
// Rozwinięty jest najwyżej jeden wiersz (harmonijka): osiem otwartych wierszy to ta sama ściana
// kontrolek, od której się tu uciekało. Zwinięta lista ma osiem linijek i mieści się w oczach.
const OVM_GRIP_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="currentColor">' +
  '<circle cx="6" cy="4" r="1.35"/><circle cx="10" cy="4" r="1.35"/>' +
  '<circle cx="6" cy="8" r="1.35"/><circle cx="10" cy="8" r="1.35"/>' +
  '<circle cx="6" cy="12" r="1.35"/><circle cx="10" cy="12" r="1.35"/></svg>';

function _ovmBlocks() { return (typeof OVL_BLOCKS !== "undefined") ? OVL_BLOCKS : []; }
function _ovmSubs(key) { return (typeof ovlSubParts === "function") ? ovlSubParts(key) : []; }

// CO JEST PUSTE — czyli w czym użytkownik nic nie ma wprowadzone.
// Zawartość nie pokazuje modułów, w których użytkownik nie ma nic
// wprowadzone (żadnego mapowania): domyślnie są wygaszone.
//
// WYGASZAMY, NIE USUWAMY — i to jest cała różnica. Pozycja zdjęta z listy zabiera razem ze sobą
// odpowiedź na pytanie „a gdzie to było?": ktoś, kto właśnie dopisał pierwszą regułę, szukałby
// „wyzwalaczy" w miejscu, w którym ich nie ma. Wygaszona zostaje, mówi jednym słowem, czego jej
// brakuje, i włącza się sama, gdy tylko coś w tym module powstanie.
//
// Warunki są LUSTREM tego, co rysuje ściąga: dokładnie te same, po których kolumna zostawia puste
// miejsce. Inne dałyby wiersz świecący „pusto" nad elementem, który coś rysuje — albo odwrotnie.
// Jedno zdanie na pusty moduł: CZEGO w nim nie ma i GDZIE się to dopisuje. „Pusto" bez drugiej
// połowy zostawia człowieka z pytaniem, na które ta lista i tak nie odpowiada.
const _OVM_EMPTY_WHY = {
  rules: "Nie ma ani jednego wyzwalacza — dopisz regułę w „Mapowaniu”, a ten element się zapali",
  pad: "Nic nie mówi do kontrolera: ani reguła „pad:…”, ani drążek. Ustawisz to w „Kontrolerze”.",
  wheel: "Koło ma mniej niż dwa wycinki, więc nie ma z czego wybierać. Dodaj je w „Kole wyboru”.",
  motion: "Sterowanie ruchem jest na tym kapslu wyłączone — włączysz je w „Myszy”",
  midi: "Nie ma ani jednego mapowania MIDI ani OSC",
};
function _ovmEmptyBlocks(dev, cfg) {
  const out = Object.create(null);
  const D = (typeof state !== "undefined" && state.devices) ? state.devices[dev] : null;
  if (!D) return out;
  const rules = D.rules || [];
  out.rules = !rules.length;
  // KONTROLER: nic do niego nie mówi ani regułą (`pad:…`), ani drążkiem (kapsel wpięty w pada).
  const _mute = d => {
    const X = state.devices[d]; if (!X) return true;
    return !(X.rules || []).some(r => String((r && r.keySpec) || "").indexOf("pad:") === 0) && !X.padShare;
  };
  out.pad = _mute(dev);
  // …ALE PRZY PADZIE SCALONYM PYTAMY O CAŁY KONTROLER (2026-09-11). Kapsel, który sam nie mówi do
  // pada, a dzieli go z takim, który mówi, ma w tym oknie pełny rysunek — wygaszenie wiersza
  // „pusto" opisywałoby wtedy coś, czego na ekranie nie ma.
  if (out.pad && (!cfg || cfg.padScope !== "own")) {
    const pid = (typeof gpvPadId === "function") ? gpvPadId(dev) : "";
    const mem = (pid && typeof padMembers === "function") ? padMembers(pid) : [];
    if (mem.length > 1) out.pad = mem.every(_mute);
  }
  // KOŁO: mniej niż dwa wycinki to nie jest koło — lustro `wheelColumnHtml` (rf-46g).
  {const sl = (D.wheelCfg && Array.isArray(D.wheelCfg.slices)) ? D.wheelCfg.slices : [];
   out.wheel = sl.length < 2;}
  // RUCH: sterowanie ruchem nie jest na tym kapslu włączone — tak samo, jak w panelu (rf-12).
  out.motion = !(D.mouseLive && D.mouseLive.enabled);
  // MIDI/OSC: ani jednego mapowania.
  out.midi = !(((typeof state !== "undefined" && state.midi && state.midi.mappings) || []).length);
  return out;
}

function _ovmBlockHtml(p) {
  const subs = _ovmSubs(p.key);
  const scal = (typeof OVL_SCALE_PARTS !== "undefined" ? OVL_SCALE_PARTS : []).map(x => x.key);
  const hasScale = scal.indexOf(p.key) >= 0;
  return `<div class="ovm-blk" data-part="${p.key}">` +
    `<div class="ovm-blk-row">` +
      `<button type="button" class="ovm-grip" data-part="${p.key}" ` +
        `title="Przeciągnij, żeby zmienić kolejność. Strzałkami góra i dół też.">${OVM_GRIP_ICON}</button>` +
      `<button type="button" class="ovm-eye on" data-part="${p.key}" aria-pressed="true" ` +
        `title="Pokaż lub ukryj: ${p.label}">${OVL_EYE_ICON}</button>` +
      `<span class="ovm-blk-nm">${p.label}</span>` +
      `<span class="ovm-blk-empty" hidden>pusto</span>` +
      `<span class="ovm-blk-sz" data-val="${p.key}"></span>` +
      `<span class="ovm-blk-chev" aria-hidden="true"></span>` +
    `</div>` +
    `<div class="ovm-blk-body" hidden>` +
      (hasScale
        ? `<div class="ovm-row"><span class="ovm-fl">Rozmiar</span>` +
            `<input type="range" class="ovm-pscale" data-part="${p.key}" min="40" max="250" step="5" ` +
              `title="Rozmiar tego elementu — mnoży się z rozmiarem całości">` +
            `<span class="ovm-val" data-vals="${p.key}">100%</span></div>`
        : "") +
      // CZYJ WKŁAD WIDAĆ NA PADZIE (2026-09-11). Wiersz istnieje tylko przy „kontrolerze" i jest
      // UKRYTY, dopóki w ten kontroler nie są wpięte co najmniej dwa kapsle — przy jednym obie
      // odpowiedzi znaczą dokładnie to samo, a pytanie bez dwóch różnych odpowiedzi to nie wybór,
      // tylko kontrolka do przeczytania. Pokazuje się samo w chwili, w której zaczyna coś znaczyć.
      (p.key === "pad"
        ? `<div class="ovm-row ovm-padscope" id="ovmPadScope" hidden>` +
            `<span class="ovm-fl">Pokazuj</span>` +
            `<span class="ovm-pills">` +
              `<button type="button" class="ovm-pill ovm-pscope" data-scope="all" ` +
                `title="Wszystkie kapsle wpięte w ten kontroler — każdy swoim kolorem">cały kontroler</button>` +
              `<button type="button" class="ovm-pill ovm-pscope" data-scope="own" ` +
                `title="Tylko kapsel tego okna">ten kapsel</button>` +
            `</span></div>`
        : "") +
      // PRZÓD KAPSLA (rf-41e, 2026-09-29): ten sam komponent, co w prawej kolumnie panelu. Wszystko
      // w nim jest ustawieniem KAPSLA (przód, czułość, wygląd); okno decyduje tylko o oku i rozmiarze.
      (p.key === "front" && typeof frontSettingsHtml === "function" ? frontSettingsHtml("ovl") : "") +
      // NOTATKA GRACZA (2026-11-21): tekst dla tego okna, rysowany przez rf-41 `ovlNoteHtml`.
      (p.key === "note"
        ? `<label class="ovm-note-lbl" for="ovmNote">Twoja klawiszologia</label>` +
          `<textarea id="ovmNote" class="ovm-note" rows="5" maxlength="600" spellcheck="false" ` +
            `placeholder="Przycisk: skok&#10;Obrót w lewo: kucnij&#10;Potrząśnięcie: menu"></textarea>` +
          `<div class="ovm-hint">Jedna linijka to jedna rzecz. To, co stoi przed dwukropkiem, okno pokaże w ramce klawisza.</div>`
        : "") +
      (subs.length
        ? `<div class="ovm-subs">` + subs.map(x =>
            `<label class="ovm-chk ovm-sub-lbl"><input type="checkbox" class="ovm-sub" ` +
              `data-part="${x.key}"> ${x.label}</label>`).join("") + `</div>`
        : "") +
    `</div>` +
  `</div>`;
}

// ------------------------------------------------------------------------------------------
//  KARTA PIERWSZA — czym to okno jest
// ------------------------------------------------------------------------------------------
function ovmEditorCfgHtml() {
  return `<div class="head"><h2>Ustawienia tego okna</h2>` +
      `<span class="hint">co to za okno, co w nim stoi i gdzie</span>` +
      // OTWÓRZ ⇄ ZAMKNIJ, przy oknie, o którym mowa (2026-09-03): zamykanie,
      // tak samo jak otwieranie, działa przez stronę i tray. Pasek okien w nagłówku karty wyżej robi to
      // samo dla WSZYSTKICH okien naraz i pisze stan („na wierzchu"), a nie czasownik — więc gdy
      // okno stoi na ekranie, nie widać z niego, że kliknięcie je zamknie. Ten przycisk nazywa
      // czynność i dotyczy jednego okna: tego, którego ustawienia są pod spodem.
      // ⚠️ To NIE jest ✕ z paska: tamto usuwa okno razem z jego miejscem i ustawieniami, to tylko
      // zdejmuje je z ekranu. Dlatego stoi tutaj, a nie obok tamtego.
      `<button type="button" class="btn rf-cta ovm-power" id="ovmPower" hidden></button></div>` +
    `<div class="ovm-body"><div class="ovm-edit" id="ovmEdit" hidden>` +
    // UX 261120 L4b: piętra. Najpierw ZAWARTOŚĆ (co pokazać nad grą, decyzja przy każdej grze),
    // pod nią zwinięte „Miejsce i wielkość” i „Wygląd tego okna” (piętro 2). Nazwa okna i wybór
    // okna (galeria) stoją w „Zaawansowane” na dole ekranu (rf-41b, piętro 3). Zwijak miejsca
    // niesie id #ovmGeomSec, więc ovmEditorSync chowa go przy oknie koła jak dawny nagłówek.
    `<div class="ovm-cols ovm-cols-one">` +
      // ---- kolumna 2: zawartość okna ---------------------------------------------------------
      `<div class="ovm-col" id="ovmPartsCol">` +
        // PASEK OKNA = PIERWSZY WIERSZ ZAWARTOŚCI (UX 261120 B5b, decyzja D20). Odpowiada na to samo
        // pytanie, co lista pod nim (co stoi w tym oknie), więc stoi na jej górze, ale jako zwykły
        // wiersz z dźwignią: pełnoszeroki różowy przycisk wyglądał jak główna akcja karty.
        // Osobny pojemnik, nie `.ovm-blk` w `#ovmBlocks`: tamta lista jest przeciągana i jej
        // kolejność idzie do ustawień okna, a pasek kolejności nie ma.
        `<div class="ovm-sec">Zawartość</div>` +
        `<div class="ovm-blocks ovm-blocks-bar">` +
          `<label class="ovm-blk ovm-bar-row" title="${_cvT("Pasek u góry nakładki: uchwyt do przesuwania, pinezka, ⚙ i ✕. Wyłączony — okno przesuwasz i ustawiasz wyłącznie stąd, a nad grą nie zostaje ani kawałek, który łapie mysz.")}">` +
            `<span class="ovm-blk-nm">pasek okna</span>` +
            `<span class="ovm-bar-sub">uchwyt do przesuwania, pinezka i zamykanie</span>` +
            `<input type="checkbox" class="rf-swi sm" id="ovmBar" aria-label="Pasek okna"></label>` +
        `</div>` +
        `<div class="ovm-hint" id="ovmBarNote"></div>` +
        `<div class="ovm-blocks" id="ovmBlocks" role="list">` +
          _ovmBlocks().map(_ovmBlockHtml).join("") +
        `</div>` +
        `<div class="ovm-hint">Kliknij wiersz, żeby ustawić szczegóły; kolejność zmieniasz przeciąganiem.</div>` +
      `</div>` +
      `<details class="cardfold inset ovm-fold" id="ovmGeomSec"><summary>Miejsce i wielkość</summary>` +
        `<div class="cardfold-body"><div class="ovm-geom" id="ovmGeom">` +
          `<div class="ovm-row"><span class="ovm-fl" data-i18n-en="Size">Wielkość</span>` +   // „Wielkość" = „Metric" in rf-01 (MIDI); here: size
            `<span class="ovm-val ovm-val-wide" id="ovmSizeV">—</span></div>` +
          `<div class="ovm-hint" id="ovmSizeNote"></div>` +
          // POŁOŻENIE SUWAKAMI (2026-09-03): pozycję na stronie
          // ustawia się suwakami, a nie wpisaniem liczby. Do tego dnia stały tu dwa pola
          // liczbowe, w których trzeba było ZGADNĄĆ liczbę: nikt nie wie, że prawa krawędź
          // drugiego monitora to 3840, a wpisanie 4000 wywoziło okno poza ekran bez śladu, gdzie
          // ono jest. Suwak odpowiada na to sam swoim ZAKRESEM — biegnie od lewej krawędzi
          // najdalszego ekranu do prawej krawędzi minus szerokość okna, więc każde jego położenie
          // jest położeniem, w którym okno widać.
          // ⚠️ PIKSELE FIZYCZNE, nie CSS. `x`/`y` w ustawieniach są w przestrzeni, w której okna
          // stawia SetWindowPos (patrz `overlay_monitors_physical` w ribbitflip_monitor.py), a nie
          // w tej, w której chodzi kursor (`/screens`, mapka ekranów w „Myszy"). Granice biorą się
          // więc z `state().screens`, czyli z tej pierwszej — na ekranie skalowanym 150% te dwie
          // listy różnią się o połowę monitora.
          // Pole liczbowe zostaje obok suwaka i jest szersze niż jego zakres: precyzja co do
          // piksela i celowe wysunięcie okna za krawędź to dwie rzeczy, których suwak nie umie.
          `<div class="ovm-row ovm-posrow"><span class="ovm-fl">Położenie</span>` +
            `<span class="ovm-fl ovm-fl2 ovm-ax">X</span>` +
            `<input type="range" class="ovm-pos" id="ovmXr" min="-20000" max="20000" step="1">` +
            `<input type="number" class="ovm-num ovm-num-sm" id="ovmX" min="-20000" max="20000" step="10" inputmode="numeric" placeholder="X">` +
            `<span class="ovm-unit">px</span></div>` +
          `<div class="ovm-row ovm-posrow"><span class="ovm-fl"></span>` +
            `<span class="ovm-fl ovm-fl2 ovm-ax">Y</span>` +
            `<input type="range" class="ovm-pos" id="ovmYr" min="-20000" max="20000" step="1">` +
            `<input type="number" class="ovm-num ovm-num-sm" id="ovmY" min="-20000" max="20000" step="10" inputmode="numeric" placeholder="Y">` +
            `<span class="ovm-unit">px</span></div>` +
          `<div class="ovm-hint" id="ovmGeomNote"></div>` +
          // MAPKA EKRANÓW (2026-09-07, zgłoszenie: „nie widać podglądu ruchu w czasie rzeczywistym
          // okna"). Miniatura obok pokazuje, JAK okno wygląda, ale nie GDZIE stoi — a suwak rusza
          // prawdziwym oknem, które przy panelu na wierzchu bywa zasłonięte. Tu stoją Twoje monitory
          // w skali i prostokąt tego okna w kolorze kapsla, przerysowywany przy każdym ruchu suwaka
          // (bez czekania na echo serwera) — więc widać, dokąd okno idzie, zanim się je zobaczy.
          `<div class="ovm-map" id="ovmMap" role="img" aria-label="Położenie okna na ekranach"></div>` +
          `<div class="ovm-row ovm-switches">` +
            `<button type="button" class="btn sm ovm-tog" id="ovmTop" title="${_cvT("Okno stoi nad grą i nad innymi oknami. Wyłącz, a schowa się pod nimi jak zwykłe okno.")}">Trzymaj na wierzchu</button>` +
            `<button type="button" class="btn sm ovm-tog" id="ovmThru">🖱 Przepuszczaj kliknięcia</button>` +
          `</div>` +
        `</div></div></details>` +
    `</div>` +
    `<div class="ovm-empty" id="ovmEmpty" hidden></div>` +
  `</div>` + ovmEditorLookHtml() + `</div>`;
}

// Nazwa okna — piętro 3 (UX 261120 L4b): większość osób jej nie zmienia, a przy jednym oknie
// kapsla nie ma czego rozróżniać. Wstawia ją rf-41b do „Zaawansowane” razem z galerią okien.
function ovmEditorNameHtml() {
  return `<div class="ovm-row ovm-namerow" id="ovmNameRow"><span class="ovm-fl">Nazwa</span>` +
          `<input type="text" id="ovmLabel" maxlength="24" placeholder="np. drążek, klikanie" ` +
            `title="Po co ta nazwa: gdy kapsel ma kilka nakładek, to ona je rozróżnia — w pasku, w panelu i w menu przy zegarku"></div>`;
}

// ------------------------------------------------------------------------------------------
//  KARTA DRUGA — jak to okno wygląda (stoi POD pierwszą, ta sama zakładka; patrz nagłówek pliku)
// ------------------------------------------------------------------------------------------
// UX 261120 L4b: już nie osobna karta, tylko zwinięty zwijak (piętro 2) w karcie ustawień, pod
// „Miejscem i wielkością”. Wnętrze i id bez zmian; podgląd po lewej dalej pokazuje każdą zmianę.
function ovmEditorLookHtml() {
  return `<details class="cardfold inset ovm-fold" id="ovmLookFold"><summary>Wygląd tego okna</summary>` +
    `<div class="cardfold-body"><div class="ovm-edit" id="ovmLook" hidden>` +
    // JEDNA KOLUMNA, i to jest cała zmiana z 2026-09-01: druga trzymała „Rozmiary elementów",
    // czyli połowę odpowiedzi na pytanie zadawane w karcie wyżej. Rozmiar elementu siedzi teraz
    // w jego własnym wierszu, razem z okiem i drobiazgami — a tu zostało to, czym okno jest
    // pokryte, i nic więcej.
    `<div class="ovm-cols ovm-cols-one">` +
      `<div class="ovm-col">` +
        `<div class="ovm-themes" id="ovmThemes">` +
          (typeof OVL_THEMES !== "undefined" ? OVL_THEMES : []).map(t =>
            `<button type="button" class="ovm-theme" data-theme="${t.k}" title="${t.hint}">` +
              `<span class="ovl-thumb ovl-thumb-${t.k}" aria-hidden="true"><b></b><b></b><b></b></span>` +
              `<span class="ovm-th-lbl">${t.label}</span></button>`).join("") +
        `</div>` +
        `<div class="ovm-row" id="ovmOutlineRow"><span class="ovm-fl">Obrys:</span>` +
          `<span class="ovm-pills">` +
            (typeof OVL_OUTLINES !== "undefined" ? OVL_OUTLINES : []).map(o =>
              `<button type="button" class="ovm-pill ovm-outline" data-outline="${o.k}" ` +
                `title="${o.hint}">${o.label}</button>`).join("") +
          `</span></div>` +
        `<label class="ovm-chk"><input type="checkbox" id="ovmBg"> Przyciemnione tło pod treścią</label>` +
        `<div class="ovm-row" id="ovmOpacityRow"><span class="ovm-fl">Przezroczystość</span>` +
          `<input type="range" id="ovmOpacity" min="20" max="100" step="1">` +
          `<span class="ovm-val" id="ovmOpacityV">100%</span></div>` +
        // Treść zdania zależy od wyglądu i od tła (suwak przygasza KARTĘ, a przy „Samej treści"
        // nie ma czego przygaszać), więc wpisuje je `ovmEditorSync` — tak samo jak w szufladzie ⚙.
        `<div class="ovm-hint" id="ovmOpacityHint"></div>` +
        `<div class="ovm-row" id="ovmScaleRow"><span class="ovm-fl">Rozmiar całości</span>` +
          `<input type="range" id="ovmScale" min="60" max="200" step="5">` +
          `<span class="ovm-val" id="ovmScaleV">100%</span></div>` +
        `<div class="ovm-hint">Powiększa całe okno naraz; pojedynczy element ma własny rozmiar w swoim wierszu.</div>` +
        // SZEROKOŚĆ UKŁADU (2026-09-07). Drugi suwak, inne pytanie: nie „jak duże", tylko „ile miejsca
        // w poziomie". Liczba to piksele CSS układu (`baseW`); okno mnoży ją przez „Rozmiar całości"
        // i skalowanie ekranu samo (ovlAutoWidth w rf-41), więc pola z szerokością OKNA nadal nie ma.
        `<div class="ovm-row" id="ovmWidthRow"><span class="ovm-fl">Szerokość</span>` +
          `<input type="range" id="ovmWidth" min="240" max="1200" step="10">` +
          `<span class="ovm-val" id="ovmWidthV">400 px</span></div>` +
        `<div class="ovm-hint">Ile miejsca w poziomie ma treść. Wąsko — opisy reguł się zawijają; szeroko — rysunki dostają powietrze. Wysokość okno dobiera samo.</div>` +
      `</div>` +
    `</div>` +
    `<div class="ovm-empty" id="ovmLookEmpty" hidden></div>` +
  `</div></div></details>`;
}

// ------------------------------------------------------------------------------------------
//  POŁOŻENIE OKNA — GRANICE SUWAKÓW I ICH TEMPO
// ------------------------------------------------------------------------------------------
// SKĄD GRANICE. Z `state().screens`, czyli z listy monitorów W PIKSELACH FIZYCZNYCH — tej samej
// przestrzeni, w której serwer stawia okna (`overlay_monitors_physical`). NIE z `/screens`: tamta
// odpowiada w przestrzeni kursora i na ekranie skalowanym 150% mówi o połowie tych liczb, więc
// suwak kończyłby się w środku monitora. Minimum to lewy (górny) brzeg najdalszego ekranu,
// maksimum — prawy (dolny) brzeg minus bok okna, żeby każde położenie suwaka było położeniem,
// w którym okno naprawdę widać w całości.
// Aplikacja bez monitorów do wyliczenia (nie-Windows, nieudane wyliczenie) dostaje zakres
// awaryjny ±20000 — ten sam, którym serwer i tak przycina wartość.
function _ovmPosLimits(c) {
  const s = (typeof OVL !== "undefined" && OVL.state) ? OVL.state : null;
  const scr = (s && Array.isArray(s.screens)) ? s.screens : [];
  const w = Math.max(1, Math.round(+((c || {}).w) || 400));
  const h = Math.max(1, Math.round(+((c || {}).h) || 560));
  let lim = { x: [-20000, 20000], y: [-20000, 20000] };
  if (scr.length) {
    const x0 = Math.min.apply(null, scr.map(m => +m.x || 0));
    const y0 = Math.min.apply(null, scr.map(m => +m.y || 0));
    const x1 = Math.max.apply(null, scr.map(m => (+m.x || 0) + (+m.w || 0)));
    const y1 = Math.max.apply(null, scr.map(m => (+m.y || 0) + (+m.h || 0)));
    lim = { x: [x0, Math.max(x0, x1 - w)], y: [y0, Math.max(y0, y1 - h)] };
  }
  // Okno stojące POZA tym zakresem (wpisane ręcznie, przeciągnięte za krawędź, monitor odpięty)
  // rozciąga suwak do siebie zamiast parkować go na końcu skali: suwak, który pokazuje inną
  // liczbę niż pole obok, to dwie odpowiedzi na jedno pytanie.
  const cx = (c && c.x !== null && c.x !== undefined) ? Math.round(+c.x) : null;
  const cy = (c && c.y !== null && c.y !== undefined) ? Math.round(+c.y) : null;
  if (cx !== null && !isNaN(cx)) lim.x = [Math.min(lim.x[0], cx), Math.max(lim.x[1], cx)];
  if (cy !== null && !isNaN(cy)) lim.y = [Math.min(lim.y[0], cy), Math.max(lim.y[1], cy)];
  return lim;
}
// TEMPO. ~10 Hz: dość, żeby okno szło za palcem, i dziesięć razy mniej niż zdarzeń `input`
// z ciągniętego suwaka — a każdy zapis to `SetWindowPos` na prawdziwym oknie i wpis do pliku
// ustawień (ten ostatni i tak jest odroczony o sekundę, patrz `_save_soon` w monitorze).
let _ovmPosT = 0, _ovmPosPend = null, _ovmPosTm = null;
function _ovmPosFlush() {
  clearTimeout(_ovmPosTm); _ovmPosTm = null;
  const p = _ovmPosPend; _ovmPosPend = null;
  if (!p) return;
  _ovmPosT = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  ovmSend(p.wid, p.patch, true);
}
// MAPKA: monitory (z `OVL.state.screens`, piksele fizyczne — te same, w których stoi `x`/`y`) i
// prostokąt okna. Rysowana z konfiguracji, którą JUŻ się widzi na suwaku, nie z tej, którą serwer
// zdążył potwierdzić: `_ovmPosLive` woła ją z nałożoną poprawką, więc mapka idzie za palcem.
function _ovmMapDraw(c) {
  const el = document.getElementById("ovmMap"); if (!el) return;
  const s = (typeof OVL !== "undefined" && OVL.state) ? OVL.state : null;
  const scr = (s && Array.isArray(s.screens)) ? s.screens.filter(m => (+m.w || 0) > 0 && (+m.h || 0) > 0) : [];
  const hasXY = !!c && c.x !== null && c.x !== undefined && c.y !== null && c.y !== undefined;
  if (!scr.length || !c) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  const ww = Math.max(1, Math.round(+c.w || 400)), hh = Math.max(1, Math.round(+c.h || 560));
  const wx = hasXY ? Math.round(+c.x) : null, wy = hasXY ? Math.round(+c.y) : null;
  let x0 = Math.min.apply(null, scr.map(m => +m.x || 0)), y0 = Math.min.apply(null, scr.map(m => +m.y || 0));
  let x1 = Math.max.apply(null, scr.map(m => (+m.x || 0) + (+m.w || 0)));
  let y1 = Math.max.apply(null, scr.map(m => (+m.y || 0) + (+m.h || 0)));
  // Okno wysunięte za ekran zostaje na mapce — rozciągamy ją do niego, jak suwak do wartości.
  if (hasXY) { x0 = Math.min(x0, wx); y0 = Math.min(y0, wy); x1 = Math.max(x1, wx + ww); y1 = Math.max(y1, wy + hh); }
  const padX = Math.max(8, (x1 - x0) * 0.02), padY = Math.max(8, (y1 - y0) * 0.02);
  x0 -= padX; y0 -= padY; x1 += padX; y1 += padY;
  const W = Math.max(1, x1 - x0), H = Math.max(1, y1 - y0);
  const sw = Math.max(1, Math.round(W / 300));                  // 1 px kreski w skali mapki
  const esc = (v) => String(v).replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  let svg = `<svg viewBox="${x0} ${y0} ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`;
  scr.forEach((m, i) => {
    const fs = Math.max(12, Math.round(H / 7));
    svg += `<rect class="ovm-map-scr" x="${+m.x || 0}" y="${+m.y || 0}" width="${+m.w}" height="${+m.h}" stroke-width="${sw}"/>` +
           `<text class="ovm-map-lbl" x="${(+m.x || 0) + fs * 0.6}" y="${(+m.y || 0) + fs * 1.3}" font-size="${fs}">${i + 1}</text>`;
  });
  if (hasXY) svg += `<rect class="ovm-map-win" x="${wx}" y="${wy}" width="${ww}" height="${hh}" stroke-width="${sw}"/>`;
  svg += `</svg>`;
  el.innerHTML = svg;
  el.title = hasXY ? esc(wx + ", " + wy + " · " + ww + "×" + hh + " px") : "";
}
function _ovmPosLive(wid, patch) {
  // Mapka idzie za palcem: rysowana z tego, co suwak właśnie pokazuje, nie z echa serwera.
  try { const w = (typeof ovmWindowOf === "function") ? ovmWindowOf(wid) : null;
        if (w && w.cfg) _ovmMapDraw(Object.assign({}, w.cfg, (_ovmPosPend && _ovmPosPend.wid === wid) ? _ovmPosPend.patch : null, patch)); } catch (e) { }
  const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  _ovmPosPend = { wid: wid, patch: Object.assign({}, (_ovmPosPend && _ovmPosPend.wid === wid) ? _ovmPosPend.patch : null, patch) };
  if (now - _ovmPosT >= 100) { _ovmPosFlush(); return; }
  if (!_ovmPosTm) _ovmPosTm = setTimeout(_ovmPosFlush, 100 - (now - _ovmPosT));
}

// ------------------------------------------------------------------------------------------
//  PODPIĘCIE
// ------------------------------------------------------------------------------------------
// Jeden komplet nasłuchów na OBIE karty — każdy przycisk niesie swoją odpowiedź w atrybucie.
// Wszystko pisze przez `ovmSend`, więc kolejność i opóźnienie zapisu są w jednym miejscu (rf-41b),
// a nie rozsypane po dwudziestu kontrolkach. Nasłuchy siedzą na dokumencie i filtrują po
// `.ovm-edit-card`, bo rf-49p PRZENOSI obie karty po drzewie (z panelu na zakładkę) — nasłuch
// przypięty do samej karty musiałby przeżyć jej przeprowadzkę.
function ovmEditorWire(root) {
  const host = root || document;
  if (typeof frontSettingsWire === "function") frontSettingsWire(host);
  const inEd = (e) => !!(e.target.closest && e.target.closest(".ovm-edit-card"));
  const sel = () => (typeof ovmWindowOf === "function" ? ovmWindowOf(_ovmSel) : null);
  const cfg = () => (sel() || {}).cfg || null;

  host.addEventListener("click", e => {
    if (!inEd(e)) return;
    const w = sel(); if (!w) return;
    const c = cfg() || {};
    const th = e.target.closest(".ovm-theme");
    if (th) { ovmSend(w.wid, { theme: th.dataset.theme }, true); return; }
    const ou = e.target.closest(".ovm-outline");
    if (ou) { ovmSend(w.wid, { outline: ou.dataset.outline }, true); return; }
    const sw = e.target.closest(".ovm-eye,.ovm-chip2");
    if (sw) { ovmSend(w.wid, { show: { [sw.dataset.part]: !((c.show || {})[sw.dataset.part]) } }, true); return; }
    // Stoi PRZED testem na `.ovm-blk-row`, choć leży w rozwinięciu, a nie w wierszu: gdyby kiedyś
    // ten wiersz przeniesiono wyżej, kliknięcie w pigułkę zwijałoby blok zamiast wybierać zakres.
    const ps = e.target.closest(".ovm-pscope");
    if (ps) { ovmSend(w.wid, { padScope: ps.dataset.scope }, true); return; }
    // Przód kapsla ma własną obsługę (frontSettingsWire, rf-41e) — tu tylko nie zwijamy bloku.
    if (e.target.closest(".fs")) return;
    // ROZWINIĘCIE WIERSZA — całym wierszem, nie strzałką wielkości pięciu pikseli. Uchwyt i oko
    // mają swoje zadania i są z tego wyłączone (`closest` wyżej łapie je pierwszy).
    const row = e.target.closest(".ovm-blk-row");
    if (row && !e.target.closest(".ovm-grip")) { _ovmBlkOpen(row.parentNode); return; }
    if (e.target.closest("#ovmTop")) { ovmSend(w.wid, { onTop: (c.onTop === false) }, true); return; }
    if (e.target.closest("#ovmThru")) { ovmSend(w.wid, { clickThrough: !c.clickThrough }, true); return; }
    if (e.target.closest("#ovmBar")) { ovmSend(w.wid, { winBar: (c.winBar === false) }, true); return; }
    // OTWÓRZ ⇄ ZAMKNIJ. Nie przez `ovmSend` (to droga USTAWIEŃ jednego okna, z opóźnieniem
    // i scalaniem), tylko wprost — `toggle` z nazwą okna robi serwer, który wie, czy ono stoi,
    // i wraca z PEŁNYM stanem, więc panel odrysowuje kafelki i przyciski tą samą odpowiedzią.
    if (e.target.closest("#ovmPower")) {
      const b = e.target.closest("#ovmPower");
      // Ten sam trójstan, co pigułka w pasku okien (rf-41d `ovgWinMode`): „Zostaw nad grą" nic nie
      // zamyka, a każde inne kliknięcie zdejmuje z okna znacznik podglądu (F-G6-01).
      if (b.dataset.mode === "keep" && typeof ovgKeep === "function") { ovgKeep(w.wid); return; }
      if (typeof ovgRelease === "function") ovgRelease(w.wid);
      b.disabled = true;
      ovlPost({ act: "toggle", win: w.wid, dev: w.dev }).then(x => {
        b.disabled = false;
        if (x && x.error && typeof rfToast === "function") rfToast(x.error, { tone: "danger", ms: 5000 });
        if (typeof ovlPanelSync === "function") { try { ovlPanelSync(x); } catch (e2) { } }
      });
      return;
    }
  });
  // TŁO POD TREŚCIĄ to jedyna kontrolka tego edytora, która nie jest ani przyciskiem, ani suwakiem,
  // ani polem liczbowym — i dlatego wypadła z trzech nasłuchów obok, milcząc przy każdym kliknięciu
  // (znalezione przy poprawce przezroczystości 2026-08-31). Zapis natychmiastowy: to przełącznik,
  // a nie wartość, którą się dobiera w ruchu.
  host.addEventListener("change", e => {
    if (!inEd(e)) return;
    const w = sel(); if (!w) return;
    if (e.target.id === "ovmBg") { ovmSend(w.wid, { show: { bg: !!e.target.checked } }, true); return; }
    // Drobiazgi wewnątrz bloku („opis reguły", „liczby pod kulą") — ten sam `show`, co bloki,
    // tylko klucz z kropką. Jeden zapis, jedna droga.
    const sb = e.target.closest(".ovm-sub");
    if (sb) { ovmSend(w.wid, { show: { [sb.dataset.part]: !!e.target.checked } }, true); return; }
  });
  host.addEventListener("input", e => {
    if (!inEd(e)) return;
    const w = sel(); if (!w) return;
    const p = e.target.closest(".ovm-pscale");
    if (p) { ovmSend(w.wid, { scaleParts: { [p.dataset.part]: +p.value } }); return; }
    if (e.target.id === "ovmOpacity") { ovmSend(w.wid, { opacity: +e.target.value }); return; }
    if (e.target.id === "ovmScale") { ovmSend(w.wid, { scale: +e.target.value }); return; }
    if (e.target.id === "ovmWidth") { ovmSend(w.wid, { baseW: +e.target.value }); return; }
    if (e.target.id === "ovmLabel") { ovmSend(w.wid, { label: (e.target.value || "").slice(0, 24) }); return; }
    if (e.target.id === "ovmNote") { ovmSend(w.wid, { note: (e.target.value || "").slice(0, 600) }); return; }
    // SUWAKI POŁOŻENIA — jedyna kontrolka tego edytora, która rusza PRAWDZIWYM oknem w trakcie
    // ciągnięcia, więc jedyna, która ma własne tempo. Zwykłe `ovmSend` czeka 220 ms PO OSTATNIEJ
    // zmianie, a przy ciągniętym suwaku ta ostatnia zmiana nie nadchodzi wcale — okno stałoby
    // w miejscu do puszczenia. Tu leci co ~100 ms i natychmiast, żeby szło za palcem.
    if (e.target.id === "ovmXr" || e.target.id === "ovmYr") {
      const k = (e.target.id === "ovmXr") ? "x" : "y";
      const v = Math.round(+e.target.value);
      _ovmSet(k === "x" ? "ovmX" : "ovmY", v);      // pole obok pokazuje tę samą liczbę na żywo
      _ovmPosLive(w.wid, { [k]: v });
      return;
    }
  });
  // Puszczenie suwaka — TĄ SAMĄ drogą, co ruch. Nie natychmiastowym zapisem: `change` na suwaku
  // leci raz po puszczeniu myszy, ale przy strzałkach klawiatury leci PO KAŻDYM naciśnięciu, więc
  // zapis „od razu" podwajał tempo i omijał ograniczenie, dla którego to ograniczenie powstało
  // (zmierzone: 26 zapisów na sekundę zamiast dziesięciu). Nic się przy tym nie gubi: `_ovmPosLive`
  // zawsze ma uzbrojony zegar, więc ostatnia wartość ląduje najdalej 100 ms po puszczeniu.
  host.addEventListener("change", e => {
    if (!inEd(e)) return;
    const w = sel(); if (!w) return;
    if (e.target.id !== "ovmXr" && e.target.id !== "ovmYr") return;
    _ovmPosLive(w.wid, { [e.target.id === "ovmXr" ? "x" : "y"]: Math.round(+e.target.value) });
  });
  // POKAZYWANIE ZAMIAST TŁUMACZENIA: najechanie na wiersz części podświetla TĘ CZĘŚĆ w podglądzie
  // nad spodem — czyli w tym samym oknie, o którym mowa. Etykiety są jednowyrazowe („opis",
  // „liczniki") i żadne słowo nie odpowiada na pytanie „który to prostokąt"; odpowiada mignięcie
  // prawdziwego elementu. Ten sam chwyt i ta sama klasa `.ovl-hl`, co w szufladzie ⚙ (rf-41).
  // Do 2026-09-01 zapalało się to na ściądze pod kartą; ściąga zeszła na własną zakładkę, więc
  // pytanie odpowiada teraz miniatura (rf-41d → rfOvlPreviewHighlight w rf-41).
  let hl = null;
  const light = (part, on) => {
    if (typeof ovgHighlight === "function") ovgHighlight(part, on);
  };
  host.addEventListener("mouseover", e => {
    if (!inEd(e)) return;
    const t = e.target.closest("[data-part]"), p = t ? t.dataset.part : null;
    if (p === hl) return;
    if (hl) light(hl, false);
    hl = p;
    if (hl) light(hl, true);
  });
  host.addEventListener("mouseout", e => {
    if (!hl || !inEd(e)) return;
    if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest("[data-part]")) return;
    light(hl, false); hl = null;
  });
  // Pola liczbowe na `change` (Enter albo wyjście z pola), nie na `input`: po każdej cyfrze okno
  // skakałoby na „8", potem „80", potem „800" — a każdy z tych skoków to prawdziwe przesunięcie
  // okna na ekranie. Puste pole nie znaczy zera, tylko „nie zmieniam" — wracamy do stanu.
  host.addEventListener("change", e => {
    if (!inEd(e)) return;
    const w = sel(); if (!w) return;
    const id = e.target.id;
    // Zostały DWA pola liczbowe, nie cztery: wielkość okna jest od 2026-09-01 wynikiem ustawień,
    // a nie ustawieniem (patrz „Wielkość" wyżej). Położenie zostaje — tego nikt za nas nie zgadnie.
    if (id !== "ovmX" && id !== "ovmY") return;
    const raw = String(e.target.value || "").trim();
    if (!raw) { ovmEditorSync(w); return; }
    const v = Math.round(+raw);
    if (isNaN(v)) { ovmEditorSync(w); return; }
    const lim = { ovmX: [-20000, 20000, "x"], ovmY: [-20000, 20000, "y"] }[id];
    ovmSend(w.wid, { [lim[2]]: Math.max(lim[0], Math.min(lim[1], v)) }, true);
  });
  _ovmBlocksDrag();
}

// ------------------------------------------------------------------------------------------
//  KOLEJNOŚĆ BLOKÓW — PRZECIĄGANIE (i strzałki, bo nie każdy ciągnie myszą)
// ------------------------------------------------------------------------------------------
// Lista jest pionowa, więc „rozmieszczenie" znaczy KOLEJNOŚĆ — i tak też się ją zmienia: wiersz
// jedzie za palcem, a reszta rozstępuje się pod nim na żywo. Robimy to przestawianiem WĘZŁÓW
// w DOM (a nie liczeniem przesunięć), bo wtedy przerwa jest prawdziwą przerwą, a na końcu wystarczy
// odczytać porządek z listy. Wiersz w ruchu przestaje łapać mysz, żeby `elementFromPoint` widział
// to, NAD czym naprawdę jesteśmy.
//
// Zapis dopiero po puszczeniu: przeciągnięcie przez osiem wierszy to osiem zapisów po drodze,
// z których siedem nikogo nie interesuje.
let _ovmDrag = null;
function _ovmBlkOpen(blk) {
  if (!blk) return;
  // Pusty blok się nie rozwija: w środku jest „Rozmiar" elementu, który akurat nic nie rysuje.
  // Powód pustki niesie plakietka „pusto" obok nazwy (jej dymek mówi, w którym module się to
  // włącza) — i to jest odpowiedź na kliknięcie, a nie suwak bez skutku.
  if (blk.classList.contains("is-empty") && !blk.classList.contains("is-open")) return;
  const host = blk.parentNode, was = blk.classList.contains("is-open");
  for (const b of host.querySelectorAll(".ovm-blk")) {
    const on = (b === blk && !was);
    b.classList.toggle("is-open", on);
    const body = b.querySelector(".ovm-blk-body"); if (body) body.hidden = !on;
    const row = b.querySelector(".ovm-blk-row"); if (row) row.setAttribute("aria-expanded", on ? "true" : "false");
  }
}
function _ovmOrderFromDom(host) {
  return [...host.querySelectorAll(".ovm-blk")].map(b => b.dataset.part);
}
function _ovmCommitOrder(host) {
  const w = (typeof ovmWindowOf === "function") ? ovmWindowOf(_ovmSel) : null;
  if (w) ovmSend(w.wid, { order: _ovmOrderFromDom(host) }, true);
}
function _ovmBlocksDrag() {
  document.addEventListener("pointerdown", e => {
    const g = e.target.closest && e.target.closest(".ovm-grip");
    if (!g || (e.button != null && e.button !== 0)) return;
    const blk = g.closest(".ovm-blk"), host = blk && blk.parentNode;
    if (!host) return;
    e.preventDefault();
    _ovmDrag = { blk: blk, host: host, before: [...host.children] };
    blk.classList.add("is-drag");
    host.classList.add("is-sorting");
    try { g.setPointerCapture(e.pointerId); } catch (_) { }
  });
  document.addEventListener("pointermove", e => {
    const d = _ovmDrag; if (!d) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const over = el && el.closest && el.closest(".ovm-blk");
    if (!over || over === d.blk || over.parentNode !== d.host) return;
    // Nad górną połową sąsiada wchodzimy PRZED niego, nad dolną — za niego. Bez tego progu wiersz
    // przeskakiwałby tam i z powrotem przy każdym drgnięciu ręki nad granicą.
    const r = over.getBoundingClientRect();
    const before = (e.clientY < r.top + r.height / 2);
    d.host.insertBefore(d.blk, before ? over : over.nextSibling);
  });
  const end = (cancel) => {
    const d = _ovmDrag; if (!d) return;
    _ovmDrag = null;
    d.blk.classList.remove("is-drag");
    d.host.classList.remove("is-sorting");
    if (cancel) { for (const n of d.before) d.host.appendChild(n); return; }
    const now = _ovmOrderFromDom(d.host).join(",");
    const was = d.before.map(n => n.dataset.part).join(",");
    if (now !== was) _ovmCommitOrder(d.host);
  };
  document.addEventListener("pointerup", () => end(false));
  document.addEventListener("pointercancel", () => end(true));
  // Strzałki na uchwycie: ta sama zmiana bez myszy — i jedyna droga dla kogoś, kto przeciągać nie
  // może. Ognisko zostaje na uchwycie, więc kilka kroków pod rząd robi się bez sięgania myszą.
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && _ovmDrag) { end(true); return; }
    const g = e.target.closest && e.target.closest(".ovm-grip"); if (!g) return;
    const step = { ArrowUp: -1, ArrowDown: 1 }[e.key]; if (!step) return;
    e.preventDefault();
    const blk = g.closest(".ovm-blk"), host = blk.parentNode;
    const sib = step < 0 ? blk.previousElementSibling : blk.nextElementSibling;
    if (!sib) return;
    host.insertBefore(step < 0 ? blk : sib, step < 0 ? sib : blk);
    try { g.focus(); } catch (_) { }
    _ovmCommitOrder(host);
  });
}

// ------------------------------------------------------------------------------------------
//  RYSOWANIE STANU
// ------------------------------------------------------------------------------------------
function _ovmSet(id, val) {
  const el = document.getElementById(id);
  if (el && document.activeElement !== el && String(el.value) !== String(val)) el.value = val;
}
function _ovmShow(el, on) { if (el) el.hidden = !on; }

function ovmEditorSync(w) {
  const ed = document.getElementById("ovmEdit");
  const lk = document.getElementById("ovmLook");
  if (!ed && !lk) return;
  const c = w ? w.cfg : null;
  // Trzy stany, jeden zestaw pól: nie wybrano okna / wybrano, ale ustawienia jeszcze nie doszły /
  // jest co pokazać. W dwóch pierwszych ramka ZOSTAJE (karta nie ma prawa skakać na wysokość),
  // a w środku stoi zdanie mówiące, na co się czeka.
  const empties = [["ovmEdit", "ovmEmpty"], ["ovmLook", "ovmLookEmpty"]];
  for (const [edId, emId] of empties) {
    const box = document.getElementById(edId); if (!box) continue;
    _ovmShow(box, true);
    const cols = box.querySelector(".ovm-cols");
    if (cols) cols.hidden = !c;
    const em = document.getElementById(emId);
    _ovmShow(em, !c);
    if (!c && em) {
      em.textContent = w ? _cvT("Czekam na odpowiedź aplikacji…")
                         : _cvT("Wybierz okno powyżej, żeby zobaczyć jego ustawienia.");
    }
  }
  // OTWÓRZ ⇄ ZAMKNIJ, w nagłówku karty. Jeden przycisk, dwa czasowniki — bo to jedno pytanie
  // („czy to okno ma teraz stać nad grą?") i człowiek zawsze zna na nie połowę odpowiedzi
  // z tego, co widzi. Nie ma go tam, gdzie nie ma czego otwierać: bez wybranego okna i przy
  // kole przy kursorze, które pokazuje się samo na czas jednego naciśnięcia.
  {const b = document.getElementById("ovmPower");
   if (b) {
     const show = !!(w && !w.wheel && c);
     b.hidden = !show;
     if (show) {
       const on = !!w.running;
       // Czynność, nie stan, i bez różu (UX 261120 B5b): stan okna niesie zielona kropka `is-up`.
       const mode = (typeof ovgWinMode === "function") ? ovgWinMode(w.wid, on) : (on ? "hide" : "show");
       b.dataset.mode = mode;
       b.classList.remove("on");
       b.classList.toggle("is-up", on);
       b.setAttribute("aria-pressed", on ? "true" : "false");
       b.textContent = _cvT(mode === "keep" ? "Zostaw nad grą" : mode === "hide" ? "Schowaj" : "Pokaż nad grą");
       if (typeof ovlTip === "function") {
         ovlTip(b, mode === "keep" ? _cvT("To okno jest otwarte tylko na czas ustawiania. Kliknij, żeby zostało nad grą także po wyjściu z tego ekranu.")
                 : on ? _cvT("Zamknij to okno. Jego miejsce, rozmiar i ustawienia zostają — otworzysz je tym samym przyciskiem.")
                      : _cvT("Postaw to okno nad grą — zmiany poniżej widać w nim od razu"));
       }
       const s = (typeof OVL !== "undefined" && OVL.state) ? OVL.state : null;
       b.disabled = !!(s && s.avail === false);
     }
   }}
  if (!c) return;

  // KOLOR KAPSLA idzie na obie karty, tak jak w samej nakładce: zielony kapsel ma zielone akcenty
  // wszędzie, gdzie się o nim mówi. (Nazwa okna i jego stan stoją w galerii nad kartami — drugi
  // raz byłyby echem tego, co widać dwa centymetry wyżej.)
  for (const id of ["ovmCfgCard", "ovmLookCard"]) {
    const card = document.getElementById(id);
    if (card) card.style.setProperty("--dcol", w.color || "#8aa0b5");
  }

  // WYGLĄD. Podpowiedzi przy miniaturach zależą od tego, co w oknie stoi — w okienku koła „Sama
  // treść" zostawia samo koło, w zwykłej nakładce kulę, strzałki i napisy. Kanon kodów jest jeden
  // (RF_LOOKS), zestawy podpowiedzi dwa (OVL_THEMES / OVL_WHEEL_THEMES), oba w rf-41.
  const hints = w.wheel ? (typeof OVL_WHEEL_THEMES !== "undefined" ? OVL_WHEEL_THEMES : [])
                        : (typeof OVL_THEMES !== "undefined" ? OVL_THEMES : []);
  const theme = c.theme || "bare";   // the server default is "bare" for every window kind
  if (lk) {
    for (const b of lk.querySelectorAll(".ovm-theme")) {
      b.classList.toggle("on", b.dataset.theme === theme);
      const h = hints.find(x => x.k === b.dataset.theme);
      if (h && typeof ovlTip === "function") ovlTip(b, _cvT(h.hint));
    }
  }
  const hasBg = !!(c.show && c.show.bg);
  const outl = c.outline || "dark";
  if (lk) for (const b of lk.querySelectorAll(".ovm-outline")) b.classList.toggle("on", b.dataset.outline === outl);
  // Obrys istnieje tylko tam, gdzie nie ma karty pod literami — jak w szufladzie ⚙ (ovlApply).
  const orow = document.getElementById("ovmOutlineRow");
  if (orow) orow.style.display = (theme === "bare" && !hasBg) ? "" : "none";
  {const t = document.getElementById("ovmBg"); if (t && document.activeElement !== t) t.checked = hasBg;}

  const op = Math.max(20, Math.min(100, +c.opacity || 100));
  _ovmSet("ovmOpacity", op);
  {const v = document.getElementById("ovmOpacityV"); if (v) v.textContent = op + "%";}
  // PRZEZROCZYSTOŚĆ ROBI WINDOWS — to samo zdanie i ta sama zasada, co w szufladzie ⚙ (rf-41):
  // suwak jedzie wprost do alfy warstwowej okna, więc działa w KAŻDYM wyglądzie (przy „Samej treści"
  // przygasza same napisy i rysunki nad grą, bo tylko one tam są). Strona nie przygasza niczego —
  // z jednym wyjątkiem, którym jest miniatura w podglądzie: tam nie ma okna, więc alfę udaje
  // strona (RF_OVL_PREVIEW w rf-41).
  {const oh = document.getElementById("ovmOpacityHint");
   if (oh) oh.textContent = w.wheel
     ? _cvT("Jak mocno koło przygasa nad grą. 100% = pełna moc koloru.")
     : hasBg
       ? _cvT("Przygasza całe okienko razem z jego tłem.")
       : _cvT("Przygasza treść okna; tło jest wycięte, więc grę widać zawsze.");}
  const sc = Math.max(60, Math.min(200, +c.scale || 100));
  _ovmSet("ovmScale", sc);
  {const v = document.getElementById("ovmScaleV"); if (v) v.textContent = sc + "%";}
  const bw = Math.max(240, Math.min(1200, Math.round(+c.baseW || 400)));
  _ovmSet("ovmWidth", bw);
  {const v = document.getElementById("ovmWidthV"); if (v) v.textContent = bw + " px";}

  // CZEGO OKNO KOŁA NIE MA — i dlaczego (patrz nagłówek pliku). Chowamy całe bloki, nie
  // wyszarzamy pojedynczych kontrolek.
  const geom = document.getElementById("ovmGeom"), gsec = document.getElementById("ovmGeomSec");
  const parts = document.getElementById("ovmPartsCol"), srow = document.getElementById("ovmScaleRow");
  // NAZWA TEŻ NIE, i z tego samego powodu: okno koła jest jedno na kapsel i nigdzie nie stoi na
  // liście obok innych — nie ma czego od czego odróżniać, a wpisana nazwa nie pojawiłaby się
  // nigdzie. (Nazwy rozróżniają NAKŁADKI jednego kapsla: na pasku, w panelu i w menu zasobnika.)
  {const nrow = document.getElementById("ovmNameRow");
   if (nrow) nrow.style.display = w.wheel ? "none" : "";}
  if (geom) geom.style.display = w.wheel ? "none" : "";
  if (gsec) gsec.style.display = w.wheel ? "none" : "";
  if (parts) parts.style.display = w.wheel ? "none" : "";
  if (srow) srow.style.display = w.wheel ? "none" : "";
  {const wrow = document.getElementById("ovmWidthRow");
   if (wrow) wrow.style.display = w.wheel ? "none" : "";}
  // …a skoro w karcie ustawień nie zostaje wtedy ANI JEDNA kontrolka, zamiast pustej karty stoi
  // tam zdanie mówiące, gdzie te rzeczy są. Pusta karta pod nagłówkiem „Ustawienia tego okna"
  // czyta się jak awaria. (Karta „Wygląd tego okna" pod spodem zostaje pełna — koło ma wygląd.)
  {const em = document.getElementById("ovmEmpty");
   const cols = ed ? ed.querySelector(".ovm-cols") : null;
   if (w.wheel) {
     if (cols) cols.hidden = true;
     if (em) { em.hidden = false;
       em.textContent = _cvT("Koło przy kursorze zawsze przepuszcza kliknięcia i zawsze stoi pod wskaźnikiem — dlatego nie ma tu ani miejsca, ani rogu do ciągnięcia. Wielkość bierze z „Wielkości koła” w karcie „Koło wyboru”."); }
   }}
  if (w.wheel) return;

  // MIEJSCE I WIELKOŚĆ. `x`/`y` bywają puste i to NIE jest zero: zero to lewy górny róg pierwszego
  // monitora, a „puste" znaczy „okno jeszcze nigdzie nie stało" (serwer wybierze mu miejsce przy
  // prawej krawędzi przy pierwszym pokazaniu — patrz `_place`).
  const ww = Math.round(+c.w || 0), hh = Math.round(+c.h || 0);
  const hasXY = (c.x !== null && c.x !== undefined && c.y !== null && c.y !== undefined);
  _ovmSet("ovmX", hasXY ? Math.round(+c.x) : "");
  _ovmSet("ovmY", hasXY ? Math.round(+c.y) : "");
  // GRANICE SUWAKÓW liczymy przy każdym rysowaniu, bo zależą od DWÓCH rzeczy, które się zmieniają:
  // od ekranów (monitor dopięty w trakcie sesji) i od WIELKOŚCI tego okna — a ta idzie za
  // „Rozmiarem całości" i za tym, co w oknie włączone, więc rusza się przy niemal każdej zmianie
  // w karcie pod spodem. Suwak z wczorajszym maksimum stawiałby okno pół szerokości za krawędzią.
  {const lim = _ovmPosLimits(c);
   for (const [id, key] of [["ovmXr", "x"], ["ovmYr", "y"]]) {
     const sl = document.getElementById(id); if (!sl) continue;
     if (+sl.min !== lim[key][0]) sl.min = lim[key][0];
     if (+sl.max !== lim[key][1]) sl.max = lim[key][1];
     // Okno, które nigdzie jeszcze nie stoi, nie ma czego pokazać — suwak siada na początku
     // zakresu, a zdanie pod spodem mówi, że miejsce wybierze serwer przy pierwszym pokazaniu.
     const v = hasXY ? Math.round(+c[key]) : lim[key][0];
     if (document.activeElement !== sl && +sl.value !== v) sl.value = v;
     sl.disabled = !hasXY;
   }}
  // WIELKOŚĆ — sam odczyt, razem z nazwą proporcji, która z tego wyszła („1:1", „16:9"). Proporcji
  // nie da się wybrać, bo nie jest ustawieniem; jest opisem tego, co się zrobiło z okna.
  // …w pikselach CSS, bo tyle okno ma NA EKRANIE. W ustawieniach siedzą fizyczne (przy skalowaniu
  // 150% okno „400" ma zapisane 600) — i to jest liczba dla Windows, nie dla człowieka.
  {const v = document.getElementById("ovmSizeV");
   const dpr = window.devicePixelRatio || 1;
   const rk = (ww && hh && typeof ovlRatioOf === "function") ? ovlRatioOf(ww, hh) : "";
   if (v) v.textContent = (ww && hh)
     ? (Math.round(ww / dpr) + " × " + Math.round(hh / dpr) + " px" + (rk ? (" · " + rk) : ""))
     : _cvT("dopasuje się przy pierwszym pokazaniu");}
  {const sn = document.getElementById("ovmSizeNote");
   if (sn) sn.textContent = _cvT("Okno dopasowuje się samo: szerokość idzie za „Szerokością” i „Rozmiarem całości”, wysokość za tym, co w nim włączone.");}
  _ovmMapDraw(w.wheel ? null : c);
  const gn = document.getElementById("ovmGeomNote");
  if (gn) {
    gn.textContent = hasXY
      ? _cvT("Suwaki sięgają krawędzi Twoich ekranów; pole obok przyjmuje każdą liczbę.")
      : _cvT("Okno jeszcze nigdzie nie stoi — postawi się samo przy pierwszym pokazaniu, przy prawej krawędzi ekranu.");
  }
  {const b = document.getElementById("ovmTop");
   if (b) { const on = (c.onTop !== false); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }}
  {const b = document.getElementById("ovmThru");
   if (b) { const on = !!c.clickThrough; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }}
  // PASEK OKNA — wciśnięty znaczy „pasek jest", jak każdy inny przełącznik w tym rzędzie. Zdanie
  // pod nim pojawia się dopiero po WYŁĄCZENIU: dopóki pasek jest, nie ma o czym mówić, a stałe
  // ostrzeżenie pod przełącznikiem, którego prawie nikt nie rusza, jest tylko szumem.
  {const b = document.getElementById("ovmBar");
   const on = (c.winBar !== false);
   if (b && b.checked !== on) b.checked = on;
   const nt = document.getElementById("ovmBarNote");
   if (nt) nt.textContent = on ? ""
     : _cvT("Wyłączony pasek znaczy: przesuwanie suwakami wyżej, reszta w tych zakładkach, zamykanie przyciskiem w nagłówku karty. Włączyć go z powrotem można tylko tutaj.");}

  // ZAWARTOŚĆ — jedna lista bloków: kolejność, oko, rozmiar i drobiazgi każdego z nich.
  const sh = c.show || {}, sp = c.scaleParts || {};
  const host = document.getElementById("ovmBlocks");
  if (host && !_ovmDrag) {
    // KOLEJNOŚĆ. Przestawiamy WĘZŁY, a nie `order` w stylu: dzięki temu kolejność w DOM jest
    // kolejnością na ekranie i po przeciągnięciu wystarczy ją odczytać. Nie ruszamy tego w trakcie
    // ciągnięcia — odpowiedź serwera przychodzi co 4 s i wyrwałaby wiersz spod palca.
    const want = (typeof ovlOrderOf === "function") ? ovlOrderOf(c) : [];
    const now = [...host.querySelectorAll(".ovm-blk")].map(b => b.dataset.part);
    if (want.join(",") !== now.join(",")) {
      for (const k of want) {
        const b = host.querySelector('.ovm-blk[data-part="' + k + '"]');
        if (b) host.appendChild(b);
      }
    }
    const lbl = {};
    for (const p of (typeof OVL_PARTS !== "undefined" ? OVL_PARTS : [])) lbl[p.key] = p.label;
    const empty = _ovmEmptyBlocks(w.dev, c);
    for (const b of host.querySelectorAll(".ovm-blk")) {
      const key = b.dataset.part, on = !!sh[key];
      b.classList.toggle("off", !on);
      // PUSTY MODUŁ — wygaszony, z jednym słowem zamiast procentu. Nie znika i nie da się go
      // przez to przeoczyć, gdy w module coś powstanie: wtedy zapala się sam.
      {const e = !!empty[key];
       b.classList.toggle("is-empty", e);
       const tag = b.querySelector(".ovm-blk-empty");
       if (tag) {
         tag.hidden = !e;
         if (e && typeof ovlTip === "function") ovlTip(tag, _cvT(_OVM_EMPTY_WHY[key] || ""));
       }}
      const eye = b.querySelector(".ovm-eye");
      if (eye) {
        eye.classList.toggle("on", on);
        eye.setAttribute("aria-pressed", on ? "true" : "false");
        // Podpowiedź składana z DWÓCH napisów, więc walker nie ma jej jak przetłumaczyć jako
        // całości („Pokaż lub ukryj: nagłówek" nie jest kluczem) — składamy ją tu, przy każdym
        // rysowaniu, i wtedy obie połówki są w bieżącym języku.
        if (typeof ovlTip === "function") ovlTip(eye, _cvT("Pokaż lub ukryj:") + " " + _cvT(lbl[key] || ""));
      }
      const sl = b.querySelector(".ovm-pscale");
      if (sl) {
        const v = Math.max(40, Math.min(250, +sp[key] || 100));
        if (document.activeElement !== sl && +sl.value !== v) sl.value = v;
        const big = b.querySelector('[data-vals="' + key + '"]'); if (big) big.textContent = v + "%";
        // Procent w zwiniętym wierszu pokazujemy TYLKO wtedy, gdy nie jest domyślny: „100%" przy
        // każdej z ośmiu pozycji to osiem razy ta sama informacja, czyli tło, a nie treść.
        const tag = b.querySelector('[data-val="' + key + '"]');
        if (tag) tag.textContent = (v === 100 || !on || empty[key]) ? "" : (v + "%");
      }
      for (const cb of b.querySelectorAll(".ovm-sub")) {
        if (document.activeElement !== cb) cb.checked = !!sh[cb.dataset.part];
      }
      // PRZÓD KAPSLA: komponent czyta ustawienia KAPSLA tego okna (rf-41e).
      if (key === "front" && typeof frontSettingsSync === "function") {
        const fs = b.querySelector(".fs"); if (fs) { fs.dataset.fsDev = w.dev; frontSettingsSync(fs, w.dev); }
      }
      // ZAKRES PADA — widoczny dopiero od dwóch kapsli na kontrolerze (patrz _ovmBlockHtml).
      // Liczony z REJESTRU, nie z zapisanego `pad`: pytanie brzmi „czy jest tu co wybierać TERAZ",
      // a odpowiada na nie skład kontrolera, w który kapsel tego okna jest wpięty w tej chwili.
      const psRow = b.querySelector(".ovm-padscope");
      if (psRow) {
        const pid = (typeof gpvPadId === "function") ? gpvPadId(w.dev) : "";
        const mem = (pid && typeof padMembers === "function") ? padMembers(pid) : [];
        psRow.hidden = mem.length < 2;
        const scope = (c.padScope === "own") ? "own" : "all";
        for (const pill of psRow.querySelectorAll(".ovm-pscope")) {
          const on = pill.dataset.scope === scope;
          pill.classList.toggle("on", on);
          pill.setAttribute("aria-pressed", on ? "true" : "false");
        }
      }
    }
  }
  _ovmSet("ovmLabel", c.label || "");
  _ovmSet("ovmNote", c.note || "");
}
