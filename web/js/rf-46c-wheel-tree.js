"use strict";
// ===================== KOŁO WYBORU — EDYTOR DRZEWA WYCINKÓW =====================
// Lista wycinków w karcie „Koło wyboru": jeden poziom naraz, okruszki nad listą, jeden wiersz na
// wycinek (kolejność, ikona, nazwa, kolor, akcja, makro, wejście w podmenu, usunięcie).
//
// FORMA Z PROTOTYPU (2026-08-26): wiersz ma teraz strzałki ▲▼ do układania kolejności — bo pozycja
// wycinka na kole to pamięć mięśniowa, a jedynym sposobem jej zmiany było wcześniej skasowanie
// wycinka i wpisanie go od nowa w innym miejscu. Ręcznej plakietki z prototypu NIE przenosimy:
// plakietki są tu AUTOMATYCZNE („makro" gdy jest sekwencja, „▸ n" gdy są dzieci), bo mówią prawdę
// o wycinku bez pilnowania, a wpisywana ręcznie po pierwszej zmianie akcji zaczyna kłamać.
//
// DWA KIERUNKI ZAZNACZENIA: wiersz, w którym stoi kursor, podświetla się na scenie (state.wheelFocus),
// a kliknięcie wycinka na scenie zaznacza jego wiersz tutaj (whFocusRow). Bez drugiego kierunku
// scena byłaby obrazkiem obok formularza, a ma być tym samym kołem.
//
// DLACZEGO OSOBNY PLIK: rf-46b to KARTA (układ, ustawienia całego koła, rozmowa z serwerem), a ten
// plik to LISTA WYCINKÓW w niej — jedyna część, która chodzi po drzewie i zna `state.wheelPath`.
// Granica jest tematyczna; twardy limit 800 linii z reguły organizacji JS wymusza podział, ale nie
// decyduje, którędy ma biec.

// Lista szybkiego wyboru bez akcji warstw: serwer i tak je odrzuca (koło nie przełącza warstw
// w tej wersji), a pozycja w liście, po której nic się nie dzieje, to najgorszy rodzaj pułapki.
function _whQuickOpts(sel) {
  const e = (typeof esc === "function") ? esc : (s => String(s));
  // Akcje modułów wyłączonych przy starcie (przycisk pada bez Kontrolera) też nie, z tego samego
  // powodu; wybrana zostaje na liście z dopiskiem (rf-10 quickKeysOn).
  const L = (typeof quickKeysOn === "function") ? quickKeysOn(sel) : QUICKKEYS;
  return L.filter(q => !/^layer:/.test(q[0]))
    .map(q => `<option value="${e(q[0])}"${q[0] === sel ? " selected" : ""}>${e(q[1])}</option>`)
    .join("");
}

// Kolor pokazywany w próbniku, dopóki wycinek żadnego nie ma. Sama obecność wartości w
// <input type=color> niczego nie zapisuje — kolor trafia do konfiguracji dopiero po zmianie.
const WH_COL_DEF = "#8b8b8b";

// ------------------------------------------------------------------------------------------
//  DRZEWO WYCINKÓW — jeden poziom naraz, okruszki nad listą
// ------------------------------------------------------------------------------------------
// Wycinek może mieć dzieci, ale lista pokazuje ZAWSZE jeden poziom. Rozwijane drzewo w karcie
// wyglądałoby jak drzewo plików, a tu chodzi o koło: na jednym kole jest jeden pierścień i to on
// odpowiada jednej liście. `state.wheelPath` mówi, w którym poziomie stoimy, a okruszki nad listą
// są jedyną drogą w górę — dokładnie tak, jak w samym kole.

// Listy od korzenia do poziomu, który właśnie edytujesz. Po drodze PRZYCINA ścieżkę: rodzic
// mógł zostać przed chwilą usunięty, a wtedy poziom pod nim przestaje istnieć.
function whLevels() {
  const W = state.wheel;
  if (!Array.isArray(W.slices)) W.slices = [];
  const out = [W.slices];
  const p = Array.isArray(state.wheelPath) ? state.wheelPath : (state.wheelPath = []);
  let list = W.slices;
  const ok = [];
  for (const i of p) {
    const s = list[i];
    if (!s) break;
    if (!Array.isArray(s.children)) break;
    ok.push(i);
    list = s.children;
    out.push(list);
  }
  if (ok.length !== p.length) state.wheelPath = ok;
  return out;
}
function whLevel() { const lv = whLevels(); return lv[lv.length - 1]; }
function whDepth() { return whLevels().length; }        // 1 = korzeń
function whCrumbLabels() {
  const lv = whLevels(), p = state.wheelPath || [], out = [];
  for (let k = 0; k < p.length; k++) {
    const s = lv[k][p[k]];
    out.push((s && s.label) || _wheelT("bez nazwy", "unnamed"));
  }
  return out;
}

// Okruszki: „Koło wyboru ▸ Media ▸ …". Ostatni jest miejscem, w którym stoisz, więc nie jest
// przyciskiem — klikalne są tylko te, które gdzieś prowadzą.
function whCrumbsHtml() {
  const e = (typeof esc === "function") ? esc : (x => String(x));
  const names = whCrumbLabels();
  let s = `<button type="button" class="wh-cr${names.length ? "" : " is-now"}" data-d="0"`
    + (names.length ? "" : " disabled") + `>${_wheelT("Koło wyboru", "Selection wheel")}</button>`;
  for (let k = 0; k < names.length; k++) {
    const now = (k === names.length - 1);
    s += `<span class="wh-cr-sep" aria-hidden="true">▸</span>`
      + `<button type="button" class="wh-cr${now ? " is-now" : ""}" data-d="${k + 1}"`
      + (now ? " disabled" : "") + `>${e(names[k])}</button>`;
  }
  return s;
}

// PUSTE POLE: wycinek bez akcji, bez makra i bez dzieci. Nie ma własnego pola w konfiguracji i mieć
// go nie będzie — „puste" WYNIKA z tego, czego w wycinku nie ma, więc wpisanie akcji zdejmuje ten
// stan samo z siebie, a każde koło zapisane kiedykolwiek wcześniej czyta się bez zmian.
function whIsEmptySlice(s) {
  return !!s && !(s.children && s.children.length)
    && !String(s.spec || "").trim() && !String(s.sequence || "").trim();
}

// Wiersz mówi „puste" JEDNĄ KLASĄ. Plakietka i wyciszenie pól akcji wiszą na niej w CSS, więc
// zmiana stanu w trakcie pisania kosztuje jedno przestawienie klasy zamiast przerysowania listy.
function whMarkEmpty(row, s) {
  if (row) row.classList.toggle("is-empty", whIsEmptySlice(s));
}

// Dopisanie wycinka do bieżącego poziomu. Jedno miejsce dla obu przycisków, bo dokładają DOKŁADNIE
// ten sam obiekt — pusty wycinek to zwykły wycinek, w którym jeszcze nic nie stoi. Różni je to, co
// się dzieje POTEM: „Dodaj wycinek" stawia kursor w nazwie, bo za chwilę trzeba wpisać akcję,
// a „+ puste pole" tylko zaznacza wiersz, bo w pustym polu nie ma czego wypełniać (nazwa jest
// nieobowiązkowa i ktoś może chcieć zostawić je bez podpisu).
function whAddSlice(empty) {
  const sl = whLevel();
  if (sl.length >= WHEEL_MAX_SLICES) return;
  sl.push({ label: "", spec: "", sequence: "" });
  const i = sl.length - 1;
  state.wheelFocus = i;
  whRenderSlices(); whSync(); commitWheel();
  if (empty) { whFocusRow(i); return; }
  const rows = document.querySelectorAll("#whSlices .wh-slice .wh-label");
  if (rows.length) rows[rows.length - 1].focus();
}

// WYCINEK Z PODMENU to DRZWI, nie akcja: silnik ignoruje jego `spec` i `sequence`, więc pola akcji
// są wyszarzone, a pod wierszem stoi zdanie, które mówi dlaczego.
function whSliceRowHtml(s, i, n) {
  const e = (typeof esc === "function") ? esc : (x => String(x));
  const seq = String(s.sequence || "");
  // JEDEN EDYTOR MAKRA NA CAŁĄ LISTĘ, a nie szesnaście: rejestrator klawiszy i biblioteka chipów
  // pracują na JEDNYM celu (rf-32), więc szesnaście równoległych pól byłoby pytaniem „do którego
  // z nich właśnie nagrywam". Otwarty jest zawsze najwyżej jeden wiersz; pozostałe z makrem
  // pokazują je jednym zdaniem podglądu.
  const open = (state.wheelSeqRow === i);
  const macro = !!seq.trim();
  const seqSum = macro ? ((typeof seqPreview === "function") ? seqPreview(seq) : seq) : "";
  const kids = Array.isArray(s.children) ? s.children.length : 0;
  // POWTÓRZENIE. Wycinek z podmenu albo z makrem nie wysyła pojedynczej akcji, więc nie ma czego
  // powtarzać — pole jest wtedy wyłączone razem z polem akcji, a nie ukrywane, żeby wiersz nie
  // zmieniał kształtu przy dopisaniu makra.
  const rep = Math.max(1, Math.min(WHEEL_REP_MAX, parseInt(s.rep, 10) || 1));
  const col = _whCol(s.color);
  const canSub = whDepth() < WHEEL_MAX_DEPTH;
  const focus = (state.wheelFocus === i);
  // L4e: wiersz zwinięty pokazuje ikonę, nazwę i skrót akcji; resztę (kolejność, kolor, akcja,
  // ×N, makro, podmenu, usuń) rozwija kliknięcie wiersza. Rozwinięty jest wiersz, przy którym stoi
  // ręka (to samo zaznaczenie, które podświetla wycinek na scenie), i ten z otwartym makrem.
  const opened = focus || open;
  const mt = whIsEmptySlice(s);
  // jednozdaniowy dymek — bez kropki na końcu (jak wszystkie jednozdaniowe w panelu)
  const specTitle = kids ? _wheelT("Ten wycinek otwiera podmenu, więc własnej akcji nie wysyła",
      "This slice opens a submenu, so it sends no action of its own")
    : macro ? _wheelT("Ten wycinek ma makro, więc pojedyncza akcja jest pomijana",
        "This slice has a macro, so the single action is skipped")
      : _wheelT("Pojedyncza akcja tego wycinka", "The single action of this slice");
  // PLAKIETKI SĄ WYLICZANE, nie wpisywane: mówią o wycinku to, co i tak o nim wiadomo z jego
  // własnych pól, więc nie mają jak się rozjechać z rzeczywistością. „puste" jest w tej samej
  // rodzinie: pojawia się w chwili, w której wiersz nie ma ani akcji, ani makra, i znika w chwili,
  // w której cokolwiek z tego dostanie.
  const badges = (macro ? `<span class="wh-badge wh-badge-macro">${_wheelT("makro", "macro")}</span>` : "")
    + (kids ? `<span class="wh-badge wh-badge-sub">▸ ${kids}</span>` : "")
    // Plakietka „puste" stoi w wierszu ZAWSZE, a pokazuje ją klasa wiersza. Bo ten jeden stan
    // zmienia się pod palcami — w trakcie wpisywania akcji, znak po znaku — a przerysowanie listy
    // przy każdym naciśnięciu klawisza zabrałoby kursor z pola, w którym się właśnie pisze.
    + `<span class="wh-badge wh-badge-empty" title="${_wheelT(
      "Nic nie wysyła. Bezpieczne miejsce na puszczenie przycisku, gdy nie chcesz żadnej akcji.",
      "Sends nothing. A safe place to let the button go when you want no action at all.")}">${
      _wheelT("puste", "empty")}</span>`;
  return `<div class="wh-slice${macro ? " has-seq" : ""}${kids ? " has-kids" : ""}${col ? " has-col" : ""}${mt ? " is-empty" : ""}${focus ? " is-focus" : ""}${opened ? " is-open" : ""}" data-i="${i}">
   <button type="button" class="wh-slice-head" aria-expanded="${opened ? "true" : "false"}"
     title="${_wheelT("Kliknij, żeby ustawić ten wycinek", "Click to set up this slice")}">
     <span class="wh-num">${i + 1}</span>
     <span class="wh-h-ico" aria-hidden="true" data-noi18n>${e(s.icon || "")}</span>
     <span class="wh-h-name" data-noi18n>${e(_whHeadName(s))}</span>
     <span class="wh-h-key" data-noi18n>${e(_whHeadKey(s))}</span>
     ${badges}</button>
   <div class="wh-slice-main">
    <span class="wh-ord">
      <button type="button" class="wh-up" title="Przesuń wyżej" aria-label="${_wheelT("Przesuń wycinek", "Move slice")} ${i + 1} ${_wheelT("wyżej", "up")}"${i === 0 ? " disabled" : ""}>▴</button>
      <button type="button" class="wh-down" title="Przesuń niżej" aria-label="${_wheelT("Przesuń wycinek", "Move slice")} ${i + 1} ${_wheelT("niżej", "down")}"${i >= n - 1 ? " disabled" : ""}>▾</button>
    </span>
    <input type="text" class="wh-ico" maxlength="3" value="${e(s.icon || "")}" placeholder="🙂"
      title="${_wheelT("Ikona wycinka: jedno emoji, rysuje się na kole nad nazwą. Systemowe menu wyboru emoji otworzysz skrótem Win + kropka.",
        "The slice icon: a single emoji, drawn on the wheel above the name. Open the system emoji picker with Win + period.")}" aria-label="${_wheelT("Ikona wycinka", "Icon of slice")} ${i + 1}">
    <label class="wh-colw" title="${_wheelT("Kolor wycinka — delikatnie podbarwia go na kole i wypełnia kółko pod ikoną",
      "The slice colour — it tints the slice on the wheel and fills the dot under its icon")}">
      <input type="color" class="wh-col" value="${e(col || WH_COL_DEF)}" aria-label="${_wheelT("Kolor wycinka", "Colour of slice")} ${i + 1}">
      <button type="button" class="wh-colx" title="${_wheelT("Wyczyść kolor", "Clear the colour")}" aria-label="${_wheelT("Wyczyść kolor wycinka", "Clear the colour of slice")} ${i + 1}">✕</button></label>
    <input type="text" class="wh-label" maxlength="24" value="${e(s.label || "")}" placeholder="nazwa, np. Apteczka">
    <input type="text" class="wh-spec" maxlength="40" value="${e(s.spec || "")}" placeholder="akcja, np. 1, mouse:left, pad:a"
      title="${specTitle}"${kids ? " disabled" : ""}>
    <button type="button" class="wh-cap" title="${_wheelT("Naciśnij klawisz albo skrót, a wpisze się sam jako akcja tego wycinka",
      "Press a key or a shortcut and it fills in as this slice's action")}"
      aria-label="${_wheelT("Naciśnij klawisz dla wycinka", "Press a key for slice")} ${i + 1}"${kids ? " disabled" : ""}>⌨</button>
    <select class="wh-quick" title="Szybki wybór akcji"${kids ? " disabled" : ""}>${_whQuickOpts(s.spec || "")}</select>
    <label class="wh-repw${rep > 1 ? " on" : ""}" title="${_wheelT(
      "Ile razy z rzędu nacisnąć tę akcję przy JEDNYM wskazaniu. Klawisz głośności przesuwa suwak Windows o 2%, a koło zamyka się po wyborze, więc jedno naciśnięcie bywa niesłyszalne; 5 to jeden wyraźny krok. Zostaw 1, gdy akcja ma pójść raz.",
      "How many times to press this action on ONE pick. A volume key moves the Windows slider by 2% and the wheel closes after a pick, so a single press can be inaudible; 5 is one clear step. Leave it at 1 when the action should go once.")}">
      <span class="wh-repx" aria-hidden="true">×</span>
      <input type="number" class="wh-rep" min="1" max="${WHEEL_REP_MAX}" step="1" value="${rep}"
        aria-label="${_wheelT("Ile razy powtórzyć akcję wycinka", "How many times to repeat the action of slice")} ${i + 1}"${(kids || macro) ? " disabled" : ""}></label>
    <button class="wh-seqtog${open ? " on" : ""}" type="button" title="Makro — kilka kroków po kolei zamiast jednej akcji"
      aria-label="${_wheelT("Makro wycinka", "Macro of slice")} ${i + 1}" aria-expanded="${open ? "true" : "false"}"${kids ? " disabled" : ""}>⛓</button>
    ${canSub ? `<button class="wh-subbtn${kids ? " on" : ""}" type="button"
      title="${kids ? _wheelT("Otwórz podmenu tego wycinka", "Open this slice's submenu")
        : _wheelT("Zrób z tego wycinka podmenu — przestanie wysyłać akcję, a zacznie otwierać listę poziom niżej",
          "Turn this slice into a submenu — it stops sending an action and starts opening a list one level down")}"
      aria-label="${_wheelT("Podmenu wycinka", "Submenu of slice")} ${i + 1}">${kids ? _wheelT("podmenu · ", "submenu · ") + kids : `<span class="bic bic-plus" aria-hidden="true"></span>${_wheelT("podmenu", "submenu")}`}</button>` : ""}
    <button class="wh-del" type="button" title="Usuń ten wycinek" aria-label="${_wheelT("Usuń wycinek", "Remove slice")} ${i + 1}">✕</button>
   </div>
   <div class="wh-seqline"${open ? "" : ' style="display:none"'}></div>
   ${(!open && macro) ? `<div class="wh-seqsum" title="${e(seq)}">⛓ ${e(seqSum)}</div>` : ""}
   ${kids ? `<div class="wh-kidnote">${_wheelT("Ten wycinek otwiera podmenu — jego akcja i makro są pomijane.",
    "This slice opens a submenu — its own action and macro are skipped.")}</div>` : ""}
  </div>`;
}

// Nagłówek zwiniętego wiersza (L4e). Skrót akcji to sama akcja albo makro; wycinek z podmenu
// i pusty mówią to plakietką obok, więc skrótu nie mają.
function _whHeadName(s) {
  return String(s.label || "").trim() || _wheelT("bez nazwy", "no name");
}
function _whHeadKey(s) {
  if (Array.isArray(s.children) && s.children.length) return "";
  const seq = String(s.sequence || "").trim();
  if (seq) return "⛓ " + ((typeof seqPreview === "function") ? seqPreview(seq) : seq);
  const sp = String(s.spec || "").trim();
  const rep = parseInt(s.rep, 10) || 1;
  return sp ? sp + (rep > 1 ? " ×" + rep : "") : "";
}
// Pisanie w polach rozwiniętego wiersza poprawia jego nagłówek bez przerysowania listy.
function _whHeadSync(row, s) {
  if (!row || !s) return;
  const set = (sel, v) => { const el = row.querySelector(sel); if (el && el.textContent !== v) el.textContent = v; };
  set(".wh-h-ico", String(s.icon || ""));
  set(".wh-h-name", _whHeadName(s));
  set(".wh-h-key", _whHeadKey(s));
}
// Rozwinięty: wiersz zaznaczony i wiersz z otwartym makrem.
function _whOpenSync(box) {
  if (!box) return;
  box.querySelectorAll(".wh-slice").forEach(r => {
    const k = +r.dataset.i, on = (k === state.wheelFocus || k === state.wheelSeqRow);
    r.classList.toggle("is-open", on);
    const h = r.querySelector(".wh-slice-head"); if (h) h.setAttribute("aria-expanded", on ? "true" : "false");
  });
}

function whRenderSlices() {
  const box = document.getElementById("whSlices"); if (!box) return;
  const sl = whLevel();
  const deep = whDepth() > 1;
  const cr = document.getElementById("whCrumbs");
  if (cr) { cr.innerHTML = whCrumbsHtml(); cr.style.display = deep ? "" : "none"; whWireCrumbs(); }
  box.innerHTML = sl.length
    ? sl.map((s, i) => whSliceRowHtml(s, i, sl.length)).join("")
    : `<div class="wh-empty">${deep
      ? _wheelT("To podmenu jest puste. Dodaj wycinki albo wróć okruszkiem wyżej — pusty rodzic zachowa się jak zwykły wycinek.",
        "This submenu is empty. Add slices, or step back up with the crumbs — an empty parent behaves like an ordinary slice.")
      : _wheelT("Brak wycinków. Dodaj co najmniej dwa — koło z jednym wycinkiem to zwykły przycisk.",
        "No slices yet. Add at least two — a wheel with one slice is just a button.")}</div>`;
  const full = sl.length >= WHEEL_MAX_SLICES;
  const add = document.getElementById("whAdd");
  if (add) add.disabled = full;
  const adm = document.getElementById("whAddEmpty");
  if (adm) adm.disabled = full;
  // LICZNIK MÓWI, ILE JESZCZE WOLNO DOŁOŻYĆ NA TYM POZIOMIE, a nie „jak duże jest to koło" — i od
  // 2026-09-02 mówi to wprost (audyt UX #31). Samo „4 / 16" stało obok Biblioteki, która to samo
  // koło opisywała jako „7 wycinków", i czytało się jak sprzeczność; teraz nazywa swój zakres,
  // a wielkość całego koła podaje jedno zdanie (whCountLabel) pod listą i na kaflu kapsla.
  const cnt = document.getElementById("whCount");
  if (cnt) {
    cnt.textContent = _wheelT(sl.length + " / " + WHEEL_MAX_SLICES + " w tej obręczy",
      sl.length + " / " + WHEEL_MAX_SLICES + " in this ring");
    cnt.title = _wheelT("Ile wycinków stoi na tym poziomie i ile najwyżej może stać. Podmenu mają"
      + " własne, osobne szesnaście.",
      "How many slices sit on this level and how many it can hold. A submenu has its own sixteen.");
  }
  whWireSlices();
  _whMountSeq();
}

// ------------------------------------------------------------------------------------------
//  EDYTOR MAKRA WYCINKA — ten sam, co w Mapowaniu
// ------------------------------------------------------------------------------------------
// Pole sekwencji, podgląd, biblioteka chipów i przycisk „Nagraj makro" to DOKŁADNIE ta sama
// maszyneria, którą ma edytor wyzwalacza (rf-32): SEQLIB, insertSeqToken, startSeqRec/stopSeqRec.
// Rejestrator dostaje tylko CEL — pola, na których ma pracować. Druga kopia rejestratora
// oznaczałaby dwie odpowiedzi na pytanie „co znaczy przytrzymanie klawisza", a te rozjechałyby się
// przy pierwszej poprawce jednej z nich.
//
// JEDEN EGZEMPLARZ, PRZENOSZONY MIĘDZY WIERSZAMI. Element powstaje raz i wędruje do wiersza, który
// właśnie edytujesz — dzięki temu jego zdarzenia podpina się raz, a rozpoczęcie nagrania w innym
// wierszu kończy poprzednie samo z siebie (seqSetTarget zatrzymuje rejestrator).
const WH_SEQ_CATS = [["keys", "⌨ Klawisze"], ["combos", "⌨ Kombinacje"], ["hold", "⬇⬆ Przytrzymanie"],
["media", "🎵 Media"], ["mouse", "🖱 Mysz"], ["pad", "🎮 Kontroler"],
["led", "💡 LED"], ["wait", "⏱ Pauzy"]];
const WH_SEQ_REC_LABEL = "Nagraj makro";
const WH_SEQ_HINT = "nagrywa wciśnięcie+puszczenie (przytrzymanie)";
let _whSeqEl = null;

function whSeqEditorEl() {
  if (_whSeqEl) return _whSeqEl;
  const e = (typeof esc === "function") ? esc : (x => String(x));
  const d = document.createElement("div");
  d.className = "wh-seqed";
  d.innerHTML = `<div class="wh-seqed-top">
      <button class="btn sm" type="button" id="whSeqRec"><span class="bic bic-camera" aria-hidden="true"></span>${WH_SEQ_REC_LABEL}</button>
      <span class="seqrec-hint" id="whSeqRecHint">${WH_SEQ_HINT}</span>
      <span class="wh-seqed-sp"></span>
      <button class="btn sm" type="button" id="whSeqGuide">jak pisać makra?</button>
    </div>
    <div class="wh-seqed-lib">
      <select id="whSeqLib" title="Biblioteka elementów — wybierz kategorię">
        ${WH_SEQ_CATS.filter(c => c[0] !== "pad" || typeof rfModOn !== "function" || rfModOn("kontroler")).map(c => `<option value="${c[0]}">${e(c[1])}</option>`).join("")}
      </select>
      <div class="seqchips" id="whSeqChips"></div>
    </div>
    <textarea id="whSeq" rows="2" maxlength="500" placeholder="ctrl+c; wait 200; ctrl+v"
      aria-label="Makro wycinka"></textarea>
    <div class="wh-seqed-note">Kroki oddziel <b>średnikiem</b>. Pauza: <b>wait 100</b>. Kliknij element z biblioteki = dodaj, albo <b>nagraj</b> na żywo. Podgląd: <b id="whSeqPrev"></b></div>`;
  const ta = d.querySelector("#whSeq");
  ta.oninput = () => _whSeqStore(ta.value);
  const lib = d.querySelector("#whSeqLib");
  lib.onchange = () => renderSeqLib(lib, d.querySelector("#whSeqChips"));
  const rec = d.querySelector("#whSeqRec");
  rec.onclick = () => { if (typeof toggleSeqRec === "function") toggleSeqRec(); };
  const gd = d.querySelector("#whSeqGuide");
  gd.onclick = () => whOpenMacroGuide();
  _whSeqEl = d;
  return d;
}

// Zapis tekstu makra do wycinka, który właśnie edytujemy. Jedno miejsce, bo dochodzi się tu trzema
// drogami: pisaniem, chipem z biblioteki i nagraniem.
function _whSeqStore(v) {
  const i = state.wheelSeqRow;
  const s = (i >= 0) ? whLevel()[i] : null;
  if (!s) return;
  s.sequence = v;
  const row = document.querySelector('#whSlices .wh-slice[data-i="' + i + '"]');
  if (row) { row.classList.toggle("has-seq", !!String(v).trim()); whMarkEmpty(row, s); }
  const p = _whSeqEl && _whSeqEl.querySelector("#whSeqPrev");
  if (p) p.textContent = (typeof seqPreview === "function") ? seqPreview(v) : v;
  whSync();
  commitWheel();
}

function _whMountSeq() {
  const i = state.wheelSeqRow;
  if (i < 0 || i >= whLevel().length) {
    state.wheelSeqRow = -1;
    if (typeof seqSetTarget === "function") seqSetTarget(null);
    if (_whSeqEl && _whSeqEl.parentNode) _whSeqEl.parentNode.removeChild(_whSeqEl);
    return;
  }
  const line = document.querySelector('#whSlices .wh-slice[data-i="' + i + '"] .wh-seqline');
  if (!line) return;
  const el = whSeqEditorEl();
  line.appendChild(el);
  const ta = el.querySelector("#whSeq");
  ta.value = String(whLevel()[i].sequence || "");
  const p = el.querySelector("#whSeqPrev");
  if (p) p.textContent = (typeof seqPreview === "function") ? seqPreview(ta.value) : ta.value;
  // CEL REJESTRATORA. Ustawiany przy KAŻDYM zamontowaniu, bo montowanie znaczy „teraz pracujemy
  // na tym wycinku" — a seqSetTarget przy okazji kończy nagranie, które szło do poprzedniego.
  if (typeof seqSetTarget === "function") seqSetTarget({
    ta: ta, prev: p, btn: el.querySelector("#whSeqRec"), hint: el.querySelector("#whSeqRecHint"),
    recLabel: WH_SEQ_REC_LABEL, hintLabel: WH_SEQ_HINT,
    onChange: (v) => _whSeqStore(v),
  });
  if (typeof renderSeqLib === "function")
    renderSeqLib(el.querySelector("#whSeqLib"), el.querySelector("#whSeqChips"));
}

// ZAZNACZENIE Z DRUGIEJ STRONY: scena mówi „kliknięto ten wycinek", a lista go pokazuje. Bez
// przewijania byłoby to zaznaczenie w miejscu, którego przy szesnastu wierszach nie widać.
function whFocusRow(i) {
  state.wheelFocus = i;
  // Ręka stanęła na wierszu — koło ma pokazać, o KTÓRY wycinek chodzi, więc zamknięta scena
  // otwiera się sama (whStageWake w rf-46d nic nie robi, gdy koło już stoi albo gdy sceną
  // steruje kapsel). Podświetlenie edytowanego wiersza robi dalej whPreviewState.
  if (typeof whStageWake === "function") whStageWake();
  const box = document.getElementById("whSlices"); if (!box) return;
  box.querySelectorAll(".wh-slice").forEach(r => r.classList.toggle("is-focus", +r.dataset.i === i));
  _whOpenSync(box);
  const row = box.querySelector('.wh-slice[data-i="' + i + '"]');
  if (!row) return;
  try { row.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  catch (e) { row.scrollIntoView(); }
}

// Okruszek = skok na poziom. Ścieżka jest listą indeksów, więc „wróć o dwa" to zwykłe przycięcie.
function whWireCrumbs() {
  const cr = document.getElementById("whCrumbs"); if (!cr) return;
  cr.onclick = (e) => {
    const t = e.target.closest("button.wh-cr[data-d]"); if (!t || t.disabled) return;
    state.wheelPath = (state.wheelPath || []).slice(0, +t.dataset.d);
    state.wheelFocus = -1;
    state.wheelSeqRow = -1;      // inny poziom = inne wycinki, więc i inne makro
    whRenderSlices(); whSync();
  };
}

// Zdarzenia wierszy podpinane po każdym przerysowaniu listy. Bez delegacji, bo wierszy jest
// najwyżej szesnaście — delegacja kosztowałaby więcej czytania niż oszczędza.
function whWireSlices() {
  const box = document.getElementById("whSlices"); if (!box) return;
  const lvl = whLevel();
  box.querySelectorAll(".wh-slice").forEach(row => {
    const i = +row.dataset.i;
    const S = () => whLevel()[i];
    const focus = () => { whFocusRow(i); };
    const lab = row.querySelector(".wh-label");
    if (lab) {
      lab.onfocus = focus;
      lab.oninput = () => { S().label = lab.value; _whHeadSync(row, S()); whSync(); commitWheel(); };
    }
    const ic = row.querySelector(".wh-ico");
    if (ic) {
      ic.onfocus = focus;
      ic.oninput = () => {
        // Emoji bywa parą surogatów, więc obcinamy po ZNAKACH Unicode, nie po jednostkach kodowych:
        // slice(0,4) potrafi przeciąć jedno emoji na pół i zostawić w konfiguracji śmieć.
        const v = Array.from(String(ic.value || "")).slice(0, WHEEL_ICON_MAX).join("");
        if (v !== ic.value) ic.value = v;
        S().icon = v;
        _whHeadSync(row, S());
        commitWheel();
      };
    }
    const cl = row.querySelector(".wh-col");
    if (cl) {
      cl.onfocus = focus;
      cl.oninput = () => {
        S().color = cl.value;
        row.classList.add("has-col");
        state.wheelFocus = i;
        commitWheel();
      };
    }
    const cx = row.querySelector(".wh-colx");
    if (cx) cx.onclick = (e) => {
      e.preventDefault();
      delete S().color;
      row.classList.remove("has-col");
      if (cl) cl.value = WH_COL_DEF;
      state.wheelFocus = i;
      commitWheel();
    };
    const sp = row.querySelector(".wh-spec");
    if (sp) {
      sp.onfocus = focus;
      sp.oninput = () => {
        S().spec = sp.value;
        whSyncQuick(row, sp.value);
        _whHeadSync(row, S());
        // Wpisanie akcji ZDEJMUJE status pustego pola, a skasowanie go przywraca — znak po znaku,
        // bez przerysowania listy, żeby kursor został tam, gdzie stoi ręka.
        whMarkEmpty(row, S());
        whSync(); commitWheel();
      };
    }
    const cap = row.querySelector(".wh-cap");
    if (cap && sp && typeof captureKeyTo === "function") {
      cap.onfocus = focus;
      cap.onclick = (e) => {
        e.preventDefault();
        captureKeyTo(cap, (spec) => {
          sp.value = spec;
          S().spec = spec;
          whSyncQuick(row, spec);
          _whHeadSync(row, S());
          whMarkEmpty(row, S());
          whSync(); commitWheel();
        }, "⌨");
      };
    }
    const q = row.querySelector(".wh-quick");
    if (q) {
      q.onfocus = focus;
      q.onchange = () => {
        if (!q.value) return;
        S().spec = q.value;
        if (sp) sp.value = q.value;
        _whHeadSync(row, S());
        whMarkEmpty(row, S());
        whSync(); commitWheel();
      };
    }
    const rp = row.querySelector(".wh-rep");
    if (rp) {
      rp.onfocus = focus;
      // `change`, nie `input`: w polu liczbowym „15" przechodzi przez „1", a zapis po każdym znaku
      // wysyłałby do serwera wycinek naciskający raz, którego nikt nie prosił.
      rp.onchange = () => {
        const v = Math.max(1, Math.min(WHEEL_REP_MAX, parseInt(rp.value, 10) || 1));
        if (String(v) !== rp.value) rp.value = v;
        // Jedynka NIE JEST zapisywana — to zwykły wycinek. Dzięki temu koło sprzed tego pola wraca
        // do serwera takie samo, jakie przyszło (ta sama zasada, co przy ikonie i kolorze).
        if (v > 1) S().rep = v; else delete S().rep;
        const w = rp.closest(".wh-repw"); if (w) w.classList.toggle("on", v > 1);
        _whHeadSync(row, S());
        commitWheel();
      };
    }
    // KOLEJNOŚĆ. Pozycja wycinka na kole jest pamięcią mięśniową, więc musi dać się ją zmienić
    // bez przepisywania sąsiadów. Przesunięcie zabiera ze sobą zaznaczenie — inaczej po kliknięciu
    // „wyżej" podświetlał się na scenie wycinek, który właśnie zjechał w dół.
    const move = (d) => {
      const list = whLevel(), j = i + d;
      if (j < 0 || j >= list.length) return;
      list.splice(j, 0, list.splice(i, 1)[0]);
      state.wheelFocus = j;
      if (state.wheelSeqRow === i) state.wheelSeqRow = j;
      else if (state.wheelSeqRow === j) state.wheelSeqRow = i;
      whRenderSlices(); whSync(); commitWheel();
    };
    const up = row.querySelector(".wh-up");
    if (up) up.onclick = () => move(-1);
    const dn = row.querySelector(".wh-down");
    if (dn) dn.onclick = () => move(1);
    const tg = row.querySelector(".wh-seqtog");
    if (tg) tg.onclick = () => {
      // Zamknięcie wiersza z wpisanym makrem niczego nie ukrywa: pod wierszem zostaje jedno zdanie
      // podglądu, więc działająca akcja wycinka nadal jest widoczna. Wcześniej pole nie dawało się
      // zwinąć, bo było jedynym miejscem, w którym to makro w ogóle widać.
      state.wheelSeqRow = (state.wheelSeqRow === i) ? -1 : i;
      state.wheelFocus = i;
      whRenderSlices(); whSync();
      if (state.wheelSeqRow === i && _whSeqEl) {
        const f = _whSeqEl.querySelector("#whSeq"); if (f) f.focus();
      }
    };
    // PODMENU. Ma dzieci → wchodzimy w nie. Nie ma → robimy je i od razu wchodzimy, z dwoma pustymi
    // wycinkami: podmenu z jednym wycinkiem jest tym samym, co brak podmenu, a puste serwer i tak
    // wyrzuca przy zapisie.
    const sb = row.querySelector(".wh-subbtn");
    if (sb) sb.onclick = () => {
      const s = S();
      if (!Array.isArray(s.children) || !s.children.length)
        s.children = [{ label: "", spec: "", sequence: "" }, { label: "", spec: "", sequence: "" }];
      state.wheelPath = (state.wheelPath || []).concat([i]);
      state.wheelFocus = -1;
      state.wheelSeqRow = -1;
      whRenderSlices(); whSync(); commitWheel();
      const rows = document.querySelectorAll("#whSlices .wh-slice .wh-label");
      if (rows.length) rows[0].focus();
    };
    // USUNIĘCIE OD RAZU, Z „COFNIJ” (UX 261120, P-G1-10): ten sam bąbel i te same 25 s co reguła
    // w Mapowaniu (rf-06 `rfUndo`). Migawka bierze całe koło i poziom, na którym stoimy, bo wycinek
    // mógł mieć podmenu, a cofnięcie ma oddać je razem z nim, na tym samym miejscu.
    const del = row.querySelector(".wh-del");
    if (del) del.onclick = () => {
      const s = whLevel()[i] || {};
      const nm = String(s.label || "").trim() || String(i + 1);
      const drop = () => {
        whLevel().splice(i, 1);
        if (state.wheelFocus >= whLevel().length) state.wheelFocus = -1;
        if (state.wheelSeqRow === i) state.wheelSeqRow = -1;
        else if (state.wheelSeqRow > i) state.wheelSeqRow--;
        whRenderSlices(); whSync(); commitWheel();
      };
      if (typeof rfUndo !== "function") { drop(); return; }
      rfUndo({
        msg: _wheelT("Usunięto wycinek „" + nm + "”", "Deleted the slice “" + nm + "”"),
        take: () => ({ slices: state.wheel.slices, path: (state.wheelPath || []).slice(), dev: state.wheelDev }),
        run: drop,
        restore: (snap) => {
          if (!snap || snap.dev !== state.wheelDev) return;   // w międzyczasie przełączono kapsel
          state.wheel.slices = snap.slices;
          state.wheelPath = snap.path;
          state.wheelFocus = -1; state.wheelSeqRow = -1;
          whRenderSlices(); whSync(); commitWheel();
        }
      });
    };
    // NAGŁÓWEK WIERSZA (L4e): rozwija wiersz i stawia kursor w nazwie; drugie kliknięcie zwija.
    const head = row.querySelector(".wh-slice-head");
    if (head) head.onclick = () => {
      if (row.classList.contains("is-open")) {
        const hadSeq = (state.wheelSeqRow === i);
        if (state.wheelFocus === i) state.wheelFocus = -1;
        if (hadSeq) { state.wheelSeqRow = -1; whRenderSlices(); whSync(); return; }
        row.classList.remove("is-focus");
        _whOpenSync(box); whSync();
        return;
      }
      whFocusRow(i);
      if (lab) try { lab.focus({ preventScroll: true }); } catch (e) { lab.focus(); }
    };
    // Kliknięcie gdziekolwiek w wierszu też jest wyborem tego wycinka — scena ma pokazywać ten,
    // przy którym stoi ręka, a nie tylko ten, którego pole akurat dostało kursor.
    row.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      whFocusRow(i);
    });
  });
  return lvl;
}

// Rozwiń poradnik pisania makr i przewiń do niego. Poradnik jest jeden (rf-12), a to jest jego
// drugie wejście — dlatego nie ma tu modala ani kopii tekstu.
// ⚠️ Od 2026-08-31 stoi on na SPODZIE ZAKŁADKI „INFORMACJE" tego modułu, a nie na dole karty
// (celowo). Trzeba więc najpierw tę zakładkę odsłonić: przewijanie do elementu
// w schowanej zakładce kończy się niczym i niczym nie miga.
function whOpenMacroGuide() {
  const d = document.getElementById("whMacroGuide");
  if (!d) return;
  try { if (typeof rfRevealPane === "function") rfRevealPane(d); } catch (e) { }
  d.open = true;
  try { d.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) { d.scrollIntoView(); }
}

// Lista szybkiego wyboru pokazuje wpisaną akcję, jeśli ją zna; wpisana ręcznie „ctrl+q" zostawia
// listę na „— szybki wybór —" zamiast kłamać, że wybrano coś innego.
function whSyncQuick(row, spec) {
  const q = row.querySelector(".wh-quick"); if (!q) return;
  q.value = Array.prototype.some.call(q.options, o => o.value === spec) ? spec : "";
}
