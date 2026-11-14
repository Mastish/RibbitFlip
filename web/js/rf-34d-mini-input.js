"use strict";
// ==================================================================================================
// MINIATURA PODGLĄDU — WEJŚCIE (przyciski akcji + sterowanie kapslem myszą po małej kuli)
//
// Rozdzielone z `rf-34c-rcol.js` po granicy RYSOWANIE / WEJŚCIE. Tamten plik odpowiada na pytanie
// „co widać", ten na „co da się z tym zrobić". Podział wymusił limit z
// `.github/CONTRIBUTING.md` (rf-34c miał 498 linii, a etap 8 dokładał dwie sprawy naraz),
// ale granica nie jest z rozpaczy — pliki mają różne zależności: rf-34c wisi na buforach danych
// (rf-02/08/09/10/12), a ten na module sterowania ręcznego (rf-14b).
//
// ŁADOWANY PO rf-34c I PRZED rf-40-boot. Kolejność ma znaczenie tylko dla namespace'u: obie połowy
// dokładają do `window.rfRcolMini` (`NS.x = …`, NIGDY `= { … }`), a wołane są dopiero z bootstrapu.
//
// ---------------------------------------------------------------------------------------------
// DWA PRZYCISKI. ŻADEN NIE MA WŁASNEJ LOGIKI — oba są skrótem do mechanizmu, który już istnieje:
//   • „Steruj ręcznie"    → `vpToggle()` (rf-14b), czyli DOKŁADNIE ta funkcja, którą woła
//                           oryginalny przycisk `#poseManual` z karty orientacji. Drugiej
//                           implementacji być nie może: tryb ręczny zajmuje slot na serwerze
//                           (`POST /virtual`), a dwa niezależne przełączniki jednego slotu to
//                           gwarantowany rozjazd — jeden by go zwalniał, drugi dalej uważał, że
//                           trzyma. Warunek widoczności też jest przepisany, a nie wymyślony:
//                           `vpSimMode()`, bo przy prawdziwym kapslu na BLE nie ma czego udawać
//                           (rf-14b `vpUpdateUi`: „the button is not offered at all rather than
//                           offered and refused").
//   • „Zobacz szczegóły"  → `setTabById("czujnik")`. Miniatura odpowiada na „drga czy nie drga";
//                           kto chce ODCZYTAĆ wykres albo dostroić oś, ma po to pełne karty na
//                           górze zakładki Czujnik. Przycisk mówi, gdzie one są — bez niego
//                           trzeba to wiedzieć z pamięci.
//
// ---------------------------------------------------------------------------------------------
// KULA W KOLUMNIE JEST STEREM — ZAWSZE (2026-08-30, etap 8, przepisane w 9b).
// Etap 8: „jak jest aktywne sterowanie ręczne - to ta orientacja po prawej też ma dawać możliwość
// sterowania". Etap 9b: „zostawmy po prawej. ale z możliwością klikania itp. i może te prawe koło
// niech cały czas wygląda właśnie tak jak teraz".
//
// Zrobione JEDNYM wywołaniem `vpWireSphere(#rfMiniPose, {axis:true, keys:true})` — tej samej
// funkcji, którą rf-14b podpina do dużej kuli `#pose3d`. Nie ma tu ANI JEDNEJ linii przeliczeń:
// kwaterniony, czułość na piksel, chwyt „za rant" (knob), zamach kółkiem, krok co 5°/15° z Ctrl,
// precyzja z Alt, podwójny klik = wypoziomuj — wszystko to jest ten sam kod, tylko z innym płótnem
// w parametrze. Konsekwencja jest ważniejsza niż oszczędność linii: obie kule NIE MAJĄ JAK pokazać
// czegoś innego, bo obracają ten sam `VPUCK.q` i obie rysują z `POSE.drawnQ`.
//
// PEŁNY KOMPLET, BO ZNIKŁY OBA POWODY OGRANICZEŃ (w etapie 8 szło tu `{axis:false,keys:false}`):
//   • uchwyty osi — miniatura rysuje teraz PEŁNĄ kulę tą samą funkcją, co duża karta (rf-34e),
//     więc litery są na ekranie i mają własne, policzone dla TEGO płótna współrzędne
//     (`canvas._poseHits`, patrz rf-14 i rf-14b),
//   • klawiatura — kafel przestał być `aria-hidden`, dostał `tabindex` i etykietę, bo przestał być
//     ilustracją. Spacja NIE koliduje z globalną Pauzą: tamten skrót wymaga `e.target===document.body`.
//
// TRYB RĘCZNY WYŁĄCZONY ≠ KULA BIERNA (zmiana z etapu 9b). Chwyt SAM włącza tryb — `vpEngage()`
// w rf-14b, ta sama zasada, co „każda ręka na sterze przejmuje kapsel" przy `vpClaim`. Kula bez
// reakcji przy wyłączonym trybie była obrazkiem, który nie mówił, czego mu brakuje.
// Kółko myszy nad kaflem dalej przewija prawą kolumnę poza symulacją, bo `preventDefault()` leci
// dopiero za bramką `vpSimMode()`.
//
// ⚠️ NIC STĄD NIE WYCHODZI DO WINDOWS. Ręka rusza kapslem SYMULOWANYM: pakiety idą przez serwer
// (`POST /virtual` → strumień 50 Hz w układzie kanałów prawdziwego kapsla), a czy z tego powstanie
// klawisz, ruch myszy czy nuta MIDI, decydują wyłącznie grupy wyjścia w module Mapowanie. Przy
// wyłączonych grupach ciągnięcie kuli zmienia wykresy i nic poza tym — dokładnie tak samo jak
// ciągnięcie dużej kuli.
// ==================================================================================================

// NOWE NAPISY PRZEZ LOKALNĄ TABLICĘ (wzór z `RF_PRESETCOL_I18N` w rf-49j-preset-col.js): rf-01-i18n
// jest w tej chwili edytowany przez równoległą sesję i nie wolno go ruszać. `Object.assign` do
// `I18N_EN` rejestruje klucz w tym samym słowniku, z którego czyta walker — także dla atrybutu
// `title` (rf-01 obserwuje `title`/`aria-label`/`placeholder`).
const RF_MINIINPUT_I18N = {
  "Chwyć kulę myszą — pochyl kapsel. Prawy przycisk albo Shift — obróć, podwójny klik — wypoziomuj.":
    "Grab the ball with the mouse to tilt the capsule. Right button or Shift turns it, double-click levels it.",
  // Etap 9b — pas przycisków kapsla przeniesiony z pływającego okna pod pas naciśnięć.
  "Sterowanie kapslem": "Capsule controls",
  // Etap 11 — gest uchwytu osi zmieniony z „zatocz koło wokół litery" na „przesuń w poprzek osi"
  // (prosty ruch ręki nie zamiatał kąta i uchwyt był martwy). Oba napisy pomocy trzeba było przepisać,
  // a rf-01-i18n jest zablokowany — więc para PL→EN ląduje tutaj, jak reszta napisów tej sekcji.
  "chwyć kulę — pochyl · chwyć literę osi i przesuń w poprzek — obróć wokół niej · Ctrl — co 5°":
    "grab the ball to tilt · grab an axis letter and push across it to turn about that axis · Ctrl — 5° steps",
  "Chwyć X, −X, Y, −Y, Z albo −Z i przesuń mysz W POPRZEK tej osi — kapsel obróci się wokół niej, a powierzchnia kuli pójdzie za ręką. Z to oś kapsla (obrót jak pokrętłem), X i Y to przewroty przez przód i przez bok. Litera pod kursorem podświetla się kółkiem i to właśnie ona zostanie chwycona.":
    "Grab X, −X, Y, −Y, Z or −Z and push the mouse ACROSS that axis — the capsule turns about it and the surface of the ball follows your hand. Z is the capsule's own axis (turning it like a knob), X and Y roll it over front-to-back and side-to-side. The letter under the cursor lights up with a ring, and that is the one you will grab.",
  "ostatnie": "last"
};
try { Object.assign(I18N_EN, RF_MINIINPUT_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

(function (global) {
  const NS = global.rfRcolMini = global.rfRcolMini || {};

  function bic(cls) {
    const s = document.createElement("span");
    s.className = "bic " + cls;
    s.setAttribute("aria-hidden", "true");     // znaczenie niesie napis obok, nie obrazek
    return s;
  }

  // Przycisk trybu ręcznego. Ta sama ikona i ten sam napis, co w oryginale — bo to ten sam
  // przełącznik, tylko podany pod ręką przy podglądzie, na który się przy nim patrzy.
  NS.manualBtn = function () {
    const b = document.createElement("button");
    b.type = "button"; b.id = "rfMiniManual"; b.className = "btn sm rf-mini-hand";
    b.hidden = true;                            // do pierwszego `syncManual()` nie wiemy, czy symulacja
    b.setAttribute("aria-pressed", "false");
    b.appendChild(bic("bic-drag"));
    const lbl = document.createElement("span");
    lbl.className = "vp-lbl"; lbl.textContent = "Steruj ręcznie";
    b.appendChild(lbl);
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      // Ten sam mechanizm, nie kopia: `vpToggle` sam decyduje, czy włączyć, czy wyłączyć, sam gada
      // z serwerem i sam woła `vpUpdateUi`, które odświeży OBA przyciski (przez hak w rf-14b).
      if (typeof vpToggle === "function") vpToggle();
      NS.syncManual();       // wyłączenie jest natychmiastowe — nie ma na co czekać do klatki
    });
    return b;
  };

  // Odnośnik do pełnych kart. Budowany tutaj, a wieszany przez rf-34b w nagłówku sekcji — nagłówek
  // należy do układu kolumny, treść przycisku do miniatury.
  NS.moreBtn = function () {
    const b = document.createElement("button");
    b.type = "button"; b.id = "rfMiniMore"; b.className = "btn xs rf-morebtn";
    // Bez ikony — w nagłówku nie ma na nią miejsca (pomiar w 20-cols.css przy `.rf-morebtn`).
    b.appendChild(document.createTextNode("Zobacz szczegóły"));
    b.title = "Pełne karty podglądu i strojenie osi kapsla stoją na ekranie Czujnik";
    // Czujnik schowany okiem (rf-48) dalej jest osiągalny (stoi pod „Więcej modułów”, UX 261120
    // L23), więc przycisk zostaje zawsze: wykresy kanałów mieszkają już tylko tam.
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      try { if (typeof global.setTabById === "function") global.setTabById("czujnik"); } catch (e2) { }
    });
    return b;
  };

  // PODPIĘCIE MYSZY DO MAŁEJ KULI — LENIWE I JEDNORAZOWE. Nie da się tego zrobić „po zbudowaniu
  // sekcji", bo sekcję buduje rf-34c, a ten plik ma nie wiedzieć, kiedy tamten skończył. `syncManual`
  // leci i tak przy każdej zmianie stanu (hak w `vpUpdateUi`) oraz raz na klatkę jako siatka
  // bezpieczeństwa, więc pierwsze wywołanie po zbudowaniu kolumny załatwia sprawę. Samo
  // `vpWireSphere` jest dodatkowo idempotentne (znacznik `_vpWired` na płótnie), więc nawet gdyby
  // ktoś zawołał to dwa razy, drugiego kompletu nasłuchów nie będzie.
  // PEŁNE MOŻLIWOŚCI OD ETAPU 9. Do etapu 8 szło tu `{axis:false,keys:false}` i oba wyłączenia miały
  // wtedy dobry powód: mała kula nie rysowała liter osi (uchwyt, którego nie widać, nie jest
  // uchwytem), a `aria-hidden` trzymało płótno poza kolejką Tab, więc nasłuch klawiszy i tak nigdy
  // by się nie odezwał. Etap 9 zdejmuje OBIE przyczyny: w trybie ręcznym kafel rysuje PEŁNĄ kulę
  // tą samą funkcją, co duża karta (rf-34e), więc litery są na ekranie i mają własne, policzone dla
  // TEGO płótna współrzędne (`canvas._poseHits`, patrz rf-14/rf-14b), a płótno dostaje wtedy
  // `tabindex` i etykietę zamiast `aria-hidden`. W formie małej nic się nie psuje: rf-34c zeruje
  // wtedy `_poseHits` („rysowałem, liter nie ma"), a bez `tabindex` fokusu nie ma skąd wziąć.
  // Podpinamy RAZ, z kompletem — przepinanie nasłuchów przy każdym przełączeniu trybu byłoby
  // stanem do zgubienia, a `vpWireSphere` i tak zapamiętuje płótno znacznikiem `_vpWired`.
  function _wireMini(c) {
    if (!c || c._vpWired || typeof vpWireSphere !== "function") return;
    vpWireSphere(c, { axis: true, keys: true });
  }

  // STAN PRZYCISKU TRZYMANY W LICZBIE, NIE ODCZYTYWANY Z DOM-u. Kusi napisać
  // `if (lbl.textContent !== txt) lbl.textContent = txt`, tyle że walker i18n podmienia ten napis
  // na angielski zaraz po tym, jak go wpiszemy — porównanie z polskim wzorcem NIGDY by się nie
  // zgodziło i przy 30 klatkach na sekundę przepisywalibyśmy etykietę bez końca, budząc przy każdym
  // zapisie MutationObserver walkera. Pamiętamy więc STAN, z którego napis wynika, i ruszamy DOM
  // wyłącznie wtedy, gdy ten stan naprawdę się zmienił.
  let _mSt = -1;
  NS.syncManual = function () {
    const mp = document.getElementById("rfMiniPose");
    _wireMini(mp);                              // przed wyjściem po niezmienionym stanie — patrz wyżej
    const b = document.getElementById("rfMiniManual");
    if (!b) return;
    const sim = (typeof vpSimMode === "function") ? !!vpSimMode() : false;
    const on = (typeof VPUCK !== "undefined") && !!VPUCK.on;
    // Kafel orientacji (rf-34e) i przenosiny przycisków kapsla — oba PRZED wyjściem po niezmienionym
    // stanie, bo `_mSt` nie zna stanu „siatka już zbudowana" ani „karta wróciła do drzewa".
    if (NS.poseSync) try { NS.poseSync(); } catch (e) { }
    _moveVpBtns(document.getElementById("rfMiniVpActs"));
    const st = (sim ? 2 : 0) + (on ? 1 : 0);
    if (st === _mSt) return;
    _mSt = st;
    // Trzy linijki przepisane 1:1 z `vpUpdateUi` (rf-14b) — ten sam warunek widoczności, ten sam
    // napis, ta sama podpowiedź. Oba napisy i obie podpowiedzi mają już swoje klucze w rf-01-i18n.
    b.hidden = !sim;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
    const lbl = b.querySelector(".vp-lbl");
    if (lbl) lbl.textContent = on ? "Wróć do animacji" : "Steruj ręcznie";
    b.title = on ? "Wyłącz sterowanie ręczne i wróć do animacji"
                 : "Chwyć kapsel myszą — testuj wyzwalacze bez sprzętu";
    // AFORDANCJA NA SAMEJ KULI — DWA POZIOMY OD ETAPU 9b, bo są DWA różne stany, a nie jeden.
    //   • `vp-ready` (symulacja, tryb wyłączony) — sam kursor „łapka". Kula JEST już czynna:
    //     chwyt włączy tryb (`vpEngage` w rf-14b). Kursor to obietnica, którą da się dotrzymać.
    //   • `vp-on`   (tryb włączony) — dodatkowo obwódka w kolorze azymutu, czyli „ta ręka trzyma
    //     teraz kapsel". Ta sama klasa, co na dużej karcie; wygląd w 20-cols.css.
    // Rozdzielenie jest konieczne, odkąd chwyt działa zawsze: gdyby pierścień świecił się także
    // przy wyłączonym trybie, przestałby cokolwiek znaczyć, a gdyby kursor pojawiał się dopiero
    // po włączeniu, nikt by nie wpadł, że kulę wolno złapać.
    if (mp) {
      mp.classList.toggle("vp-ready", sim);
      mp.classList.toggle("vp-on", on);
      if (!on) mp.classList.remove("vp-grab");
      // Dymek mówi to, co w danym stanie jest prawdą. Przy wyłączonym trybie — że chwyt go włączy.
      if (on) mp.title = "Chwyć kulę myszą — pochyl kapsel. Prawy przycisk albo Shift — obróć, podwójny klik — wypoziomuj.";
      else if (sim) mp.title = "Chwyć kulę — kapsel od razu przejdzie pod Twoją rękę";
      else mp.removeAttribute("title");
    }
    // Pas przycisków kapsla pod naciśnięciami („Przycisk kapsla", „Kliknij", „Wypoziomuj").
    //
    // WIDOCZNY DOPIERO PRZY WŁĄCZONYM STEROWANIU RĘCZNYM (przy
    // wyłączonym sterowaniu ręcznym „klikaj”, „przytrzymaj” i „wyśrodkuj” po prawej są
    // niepotrzebne). Do tej pory bramką była sama SYMULACJA i to było za mało: przy
    // wyłączonym trybie kapslem rusza animacja, więc „Wypoziomuj" jest cofane w następnej klatce,
    // a „Przycisk kapsla" wysyła naciśnięcie w środek cudzego ruchu. Trzy przyciski, które nie mają
    // czego dotknąć, uczą, że przyciski nic nie robią.
    //   Ta sama bramka, co na dużej karcie: tam ten wiersz siedzi w `#pose3dManual`, chowanym
    //   przez `vpUpdateUi` warunkiem `bar.hidden = !VPUCK.on`. Kolumna po prostu wraca do niej,
    //   zamiast mieć własną, luźniejszą.
    const va = document.getElementById("rfMiniVpActs");
    if (va) va.hidden = !(sim && on);
  };

  // ---- PRZYCISKI KAPSLA PRZENIESIONE Z PŁYWAJĄCEGO OKNA (2026-08-30, etap 9b) --------------------
  // Przyciski od klikania przy sterowaniu ręcznym pokazują się pod pasem naciśnięć. To jest naturalne sąsiedztwo, a nie układanka:
  // przyciskiem robisz naciśnięcie, a pas TUŻ NAD NIM od razu pokazuje jego kreskę i czas trzymania.
  //
  // PRZENIESIONE, NIE SKLONOWANE — dokładnie ta sama decyzja, którą rf-14c podjęło dla całej karty
  // („The card is MOVED, not cloned"). `appendChild` przenosi węzeł razem z jego nasłuchami, więc:
  //   • zostaje JEDEN `#poseVBtn` — dwa elementy o tym samym id to `getElementById`, które
  //     odpowiada raz temu, raz tamtemu, i `vpBtnUi()` podświetlający nie ten przycisk,
  //   • nie piszemy ani jednego nowego handlera: przechwytywanie wskaźnika przy „Przycisku kapsla",
  //     odmierzanie stuknięcia przez `vpTap` i siatka bezpieczeństwa na `window.pointerup` (mysz
  //     puszczona poza oknem) jadą z nimi w komplecie.
  // W karcie „Orientacja 3D" zostają przyciski dotyczące SAMEGO OKNA („🗗 Okienko", „Koniec") —
  // te nie mają czego szukać w kolumnie, bo od wyłączania trybu jest tu „Wróć do animacji".
  //
  // ⚠️ PRZENOSINY SĄ LENIWE, NIE ROBIONE PRZY BUDOWIE WIERSZA — i to jest naprawa błędu złapanego
  // w teście, nie ostrożność. `rfCols.build()` leci w trakcie `initTabs`, a ten przez chwilę trzyma
  // kartę „Orientacja 3D" ODCZEPIONĄ od dokumentu (rf-34 przekłada `#pose3dCard` do szyny). W tym
  // oknie `getElementById("poseVBtn")` zwraca `null` — cicho, bez błędu — więc wiersz powstawał
  // pusty i przyciski zostawały na karcie. Pytamy więc o nie z `syncManual`, który leci raz na
  // klatkę: pierwsza klatka, w której wszystko jest już w drzewie, domyka sprawę.
  // Znacznik na wierszu (`_moved`) zamiast licznika prób: przeniesienie jest jednorazowe, a warunek
  // „mam już swoje dzieci" jest odporny na to, że ktoś kiedyś zbuduje kolumnę drugi raz.
  NS.vpActs = function () {
    const box = document.createElement("div");
    box.className = "rf-mini-vpacts"; box.id = "rfMiniVpActs";
    box.hidden = true;                          // do pierwszego `syncManual()` nie wiemy, czy symulacja
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Sterowanie kapslem");
    return box;
  };
  function _moveVpBtns(box) {
    if (!box || box._moved) return;
    let n = 0;
    ["poseVBtn", "poseVLatch", "poseVTap", "poseVLevel"].forEach((id) => {
      const b = document.getElementById(id);
      if (b && b.parentElement !== box) { box.appendChild(b); n++; }   // MOVE — nie kopia
      else if (b) n++;
    });
    if (n === 4) box._moved = true;             // komplet na miejscu — więcej nie pytamy
  }

})(window);
