"use strict";
// ==================================================================================================
// PIERWSZE PYTANIE: „Do czego chcesz używać RibbitFlipa?” (UX 261120 L23, decyzja L-D1)
//
// Nowa osoba widziała od razu 14 pozycji nawigacji, choć zwykle używa 2–4 modułów. Przy pierwszym
// uruchomieniu, PRZED zaproszeniem do przewodnika (D8), czaszka pyta jednym bąblem z czterema
// filcowymi kaflami (`.pad-add-tile.rf-pick`, kontrakt B1). Wybór ustawia istniejącą „Widoczność
// modułów” (rf-48 `rfTabVisSet`): moduły spoza wyboru nie znikają, tylko stoją pod „Więcej modułów (N)”
// na dole sekcji Moduły (rf-34b). Zmiana zdania: oko nad nawigacją albo Ustawienia › Wygląd panelu
// („Wybierz ponownie”, ten sam bąbel). Mapowanie zostaje zawsze (kotwica nawigacji).
//
// KTO DOSTAJE PYTANIE. Tylko pierwsze uruchomienie w tej przeglądarce: brak `ribbitflip.firstAsk`
// i żadnego innego klucza `ribbitflip.*` (poza językiem) zapisanego wcześniej, a serwer nie ma
// schowanych pozycji. Kto już używał panelu, ma tam co najmniej ostatnią zakładkę, więc pytania nie
// dostaje i nic mu nie znika. Klucze czytamy przy wczytaniu tego pliku, zanim start panelu zapisze
// cokolwiek nowego. Pytanie, tak jak zaproszenie D8, zapisuje flagę przy pokazaniu: po odświeżeniu
// nie wraca.
//
// ZAPROSZENIE D8. rf-39p pokazuje je 1,5 s po starcie, jeśli nie ma `ribbitflip.tourOffered`. Gdy
// pytamy, ustawiamy tę flagę od razu (rf-39p milczy), a po odpowiedzi wołamy to samo zaproszenie
// przez `rfTourOffer(true)`, więc słowa i przyciski są w jednym miejscu.
//
// Napisy składa `_gl` (bąbel i kafle mają `data-noi18n`), zmiana języka przerysowuje kafle.
// ==================================================================================================
(function (global) {
  const T = (pl, en) => (typeof global._gl === "function" ? global._gl(pl, en) : pl);
  const LS = "ribbitflip.firstAsk";
  const TOUR_LS = "ribbitflip.tourOffered";

  // Wybór → pozycje nawigacji, które zostają na wierzchu (sekcje „Moduły” i „Wypróbuj”).
  // Zestawy stoją nad sekcjami, a Narzędzia i Ustawienia pod nimi: pytanie ich nie dotyczy.
  const CHOICES = [
    { k: "gram", ic: "gamepad", t: ["Gram", "I play games"], ids: ["mapowanie", "kolo", "kontroler"] },
    { k: "opieka", ic: "mmouse", t: ["Pomagam komuś sterować komputerem", "I help someone use a computer"],
      ids: ["mysz", "skaner", "mapowanie"] },
    { k: "muzyka", ic: "synth", t: ["Muzyka i streaming", "Music and streaming"], ids: ["midi", "osc", "pad", "restapi"] },
    { k: "wszystko", ic: "eye", t: ["Pokaż wszystko", "Show everything"], ids: null },
  ];
  const ASKED = ["mod", "play"];

  // Klucze sprzed tego uruchomienia (patrz nagłówek). Język ustawia też serwer i test, więc nie liczy się.
  // The snapshot comes from an inline script at the top of the panel page, taken before rf-00..rf-48
  // write their own keys on load; counted here it would always say "used before".
  let _prior = false;
  if (typeof global.RF_LS_PRIOR === "boolean") _prior = global.RF_LS_PRIOR;
  else {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || "";
        if (k.indexOf("ribbitflip.") === 0 && k !== "ribbitflip.lang") { _prior = true; break; }
      }
    } catch (e) { _prior = true; }
  }

  function _tabs() { try { return (global.rfTabsList && global.rfTabsList()) || []; } catch (e) { return []; } }
  function _names(ids) {
    const L = _tabs();
    return ids.map(id => (L.find(t => t.id === id) || {}).label).filter(Boolean).join(", ");
  }
  function _desc(c) {
    if (!c.ids) return T("Każdy moduł w nawigacji", "Every module in the navigation");
    return _names(c.ids);
  }
  function _esc(s) { return (typeof global.esc === "function") ? global.esc(s) : String(s == null ? "" : s); }

  function _tilesHtml() {
    return CHOICES.map(c =>
      `<button type="button" class="pad-add-tile rf-pick" data-pick="${c.k}">` +
      `<span class="pat-ic rfic tab-ic-${c.ic}" aria-hidden="true"></span>` +
      `<span class="pat-txt"><b>${_esc(T(c.t[0], c.t[1]))}</b><span>${_esc(_desc(c))}</span></span></button>`).join("");
  }

  // Ustawia widoczność według wyboru. Pozycje spoza „Modułów” i „Wypróbuj” zostają, jak były.
  function apply(key) {
    const c = CHOICES.find(x => x.k === key); if (!c) return;
    const L = _tabs();
    let hidden = [];
    try { hidden = (global.rfTabVisHidden && global.rfTabVisHidden()) || []; } catch (e) { }
    hidden = hidden.filter(id => { const t = L.find(x => x.id === id); return t && ASKED.indexOf(t.grp) < 0; });
    if (c.ids) for (const t of L) if (ASKED.indexOf(t.grp) >= 0 && !t.anchor && c.ids.indexOf(t.id) < 0) hidden.push(t.id);
    try { localStorage.setItem(LS, key); } catch (e) { }
    if (typeof global.rfTabVisSet === "function") global.rfTabVisSet(hidden);
    _rowPaint();
  }

  let _slot = null, _relang = null;
  // Bąbel z pytaniem. `first` = pierwsze uruchomienie: po odpowiedzi idzie zaproszenie do przewodnika.
  function ask(first) {
    if (typeof global.rfSkullNote !== "function") return;
    if (_slot && _slot.isConnected) return;
    _slot = global.rfSkullNote(T("Do czego chcesz używać RibbitFlipa?", "What do you want to use RibbitFlip for?"),
                               { ms: 0, polite: false });
    const b = _slot && _slot.querySelector(".rss-bubble"); if (!b) return;
    b.classList.add("rf-ask");
    const box = document.createElement("div");
    box.setAttribute("data-noi18n", "");
    box.innerHTML = `<div class="rf-picks rf-ask-picks">${_tilesHtml()}</div>` +
      `<p class="rf-ask-note">${_esc(T("Reszta modułów będzie pod „Więcej modułów”. Zmienisz to okiem nad nawigacją albo w Ustawieniach.",
                                     "The other modules will wait under “More modules”. Change it with the eye above the navigation or in Settings."))}</p>`;
    b.appendChild(box);
    // Kafel łapie `pointerdown`, bo rf-06 zdejmuje notkę na nim, zanim przyjdzie `click`. Klik obok
    // kafli odprawia pytanie jak każdą notkę czaszki: nic się nie chowa, a wybór czeka w Ustawieniach.
    box.addEventListener("pointerdown", e => { if (e.target.closest && e.target.closest("[data-pick]")) e.stopPropagation(); });
    box.addEventListener("click", e => {
      const t = e.target.closest && e.target.closest("[data-pick]"); if (!t) return;
      const key = t.getAttribute("data-pick");
      apply(key);
      try { if (global.rfNoteClose) global.rfNoteClose(_slot); } catch (err) { }
      _slot = null;
      if (_relang) { _relang.disconnect(); _relang = null; }
      if (first) setTimeout(_invite, 450);
    });
    try {
      _relang = new MutationObserver(() => {
        const g = box.querySelector(".rf-ask-picks"); if (g) g.innerHTML = _tilesHtml();
        const n = box.querySelector(".rf-ask-note");
        if (n) n.textContent = T("Reszta modułów będzie pod „Więcej modułów”. Zmienisz to okiem nad nawigacją albo w Ustawieniach.",
                                 "The other modules will wait under “More modules”. Change it with the eye above the navigation or in Settings.");
      });
      _relang.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    } catch (e) { }
    // Fokus na pierwszy kafel tylko po „Wybierz ponownie” (ktoś właśnie kliknął). Przy starcie
    // podświetlony kafel wyglądałby na wybrany; bąbel i tak ogłasza się czytnikowi od razu.
    if (!first) { const f = box.querySelector("[data-pick]"); if (f) try { f.focus({ preventScroll: true }); } catch (e) { } }
  }

  // Zaproszenie D8 z rf-39p (`rfTourOffer`), wymuszone: flagę `tourOffered` ustawiliśmy sami przy pytaniu.
  function _invite() {
    if (typeof global.rfTourOffer === "function") global.rfTourOffer(true);
  }

  // ---- Ustawienia › Wygląd panelu: „Wybierz ponownie” ----------------------------------------
  function _rowPaint() {
    const row = document.getElementById("askRow"); if (!row) return;
    let cur = ""; try { cur = localStorage.getItem(LS) || ""; } catch (e) { }
    const c = CHOICES.find(x => x.k === cur);
    const tx = row.querySelector(".rf-swrow-tx");
    if (tx) tx.innerHTML = _esc(T("Do czego używasz RibbitFlipa", "What you use RibbitFlip for")) +
      `<small>${_esc(c ? T("Teraz: ", "Now: ") + T(c.t[0], c.t[1]) + ". " : "")}` +
      `${_esc(T("Wybór ustawia, które moduły stoją w nawigacji, a które pod „Więcej modułów”.",
                "The choice sets which modules stand in the navigation and which wait under “More modules”."))}</small>`;
    const btn = row.querySelector("#askAgain");
    if (btn) btn.textContent = T("Wybierz ponownie", "Choose again");
  }
  function _row() {
    const body = document.querySelector("#uiLookCard .ui-look-body");
    if (!body || document.getElementById("askRow")) return;
    const row = document.createElement("div");
    row.className = "rf-swrow rf-ask-row"; row.id = "askRow";
    row.setAttribute("data-noi18n", "");
    row.innerHTML = '<span class="rf-swrow-tx"></span><button type="button" class="btn sm" id="askAgain"></button>';
    body.appendChild(row);
    row.querySelector("#askAgain").addEventListener("click", () => ask(false));
    _rowPaint();
    try {
      new MutationObserver(_rowPaint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    } catch (e) { }
  }

  function initFirstAsk() {
    if (typeof IS_OVERVIEW !== "undefined" && IS_OVERVIEW) return;
    if (document.documentElement.classList.contains("rf-ovl")) return;
    if (!document.getElementById("rfApp")) return;
    _row();
    let done = "";
    try { done = localStorage.getItem(LS) || ""; } catch (e) { return; }
    if (done) return;
    let hiddenOnServer = false;
    try { hiddenOnServer = (global.RIBBITFLIP_HIDDEN_TABS || []).length > 0; } catch (e) { }
    if (_prior || hiddenOnServer) {
      // Już używał panelu: bez pytania i bez zmian w nawigacji.
      try { localStorage.setItem(LS, "juz"); } catch (e) { }
      return;
    }
    try { localStorage.setItem(LS, "pytano"); localStorage.setItem(TOUR_LS, "1"); } catch (e) { return; }
    setTimeout(() => ask(true), 1200);
  }

  global.initFirstAsk = initFirstAsk;
  global.rfFirstAsk = ask;
})(window);
