"use strict";
// ===== Start programu: moduły wyłączone przy starcie aplikacji (--disable / --only, 2026-10-15) =====
// Serwer wstrzykuje do <head> `window.RIBBITFLIP_MODULES = {off, routes, tabs}` (_serve_html):
// listę modułów, które w tym uruchomieniu NIE wstały, tablicę ich tras HTTP (te same wzorce, które
// sprawdza serwer, MODULE_ROUTES w ribbitflip_monitor.py) i zakładkę panelu każdego modułu.
//
// Ten plik robi z tego trzy rzeczy:
//   • `rfModOn(id)` / `rfModTabOff(tabId)` / `rfModGroupOn(grp)` dla miejsc, które budują zakładki
//     (rf-34), kolumny „Modułów” (rf-45) i listę initów (rf-40),
//   • BRAMKĘ NA fetch: zapytanie o trasę wyłączonego modułu nie wychodzi z przeglądarki wcale, tylko
//     dostaje na miejscu tę samą odpowiedź, którą dałby serwer (404 i JSON z powodem). Wywołań jest
//     ponad dwieście w kilkudziesięciu plikach, a część pyta przy zmianie kapsla, przy imporcie albo
//     z biblioteki — jedna bramka zamiast dwustu warunków, i żadne zapytanie się nie prześlizgnie,
//     także z kodu dopisanego jutro,
//   • to samo dla `navigator.sendBeacon` (rf-41d zamyka nim okno nakładki przy wyjściu ze strony).
// Ładowany zaraz po rf-00-core, przed wszystkim, co cokolwiek pobiera.
// WHY: one gate at the source keeps the panel silent about a module the server never started.
(function () {
  const M = window.RIBBITFLIP_MODULES || {};
  const off = new Set(Array.isArray(M.off) ? M.off.map(String) : []);
  const tabs = (M.tabs && typeof M.tabs === "object") ? M.tabs : {};
  const routes = [];
  for (const r of (Array.isArray(M.routes) ? M.routes : [])) {
    try { routes.push([new RegExp("^(?:" + r[0] + ")$"), (r[1] || []).map(String)]); } catch (e) { }
  }
  // Grupy wyjść serwera (rfGroupName, macierz „Modułów”) -> moduł. Grupa spoza listy jest podstawowa.
  const GROUP = { wheel: ["kolo"], motion: ["mysz", "kontroler"], midi: ["midi"], osc: ["osc"],
                  rest: ["uslugi"], pad: ["synth"] };

  function rfModOn(id) { return !off.has(String(id)); }
  function rfModTabOff(tabId) {
    for (const id of off) if (tabs[id] && tabs[id] === tabId) return true;
    return false;
  }
  function rfModGroupOn(grp) {
    const L = GROUP[grp];
    return !L || L.some(rfModOn);
  }
  // Moduł, który blokuje ten adres, albo "". Trasa wspólna (np. /midi dla MIDI i OSC) jest
  // zablokowana dopiero, gdy wyłączone są wszystkie jej moduły — dokładnie jak na serwerze.
  function rfModBlocking(url) {
    if (!off.size) return "";
    let path = "";
    try {
      const u = new URL(String(url), location.href);
      if (u.origin !== location.origin) return "";
      path = u.pathname;
    } catch (e) { return ""; }
    for (const [rx, mods] of routes) {
      if (rx.test(path)) return mods.every(m => off.has(m)) ? mods[0] : "";
    }
    return "";
  }
  function _answer(mid) {
    const body = JSON.stringify({ ok: false, disabled: true, module: mid,
      error: "Moduł wyłączony przy starcie aplikacji (--disable / --only).",
      errorEn: "This module was switched off when the app started (--disable / --only)." });
    return new Response(body, { status: 404, statusText: "Not Found",
      headers: { "Content-Type": "application/json; charset=utf-8" } });
  }

  window.rfModOn = rfModOn;
  window.rfModTabOff = rfModTabOff;
  window.rfModGroupOn = rfModGroupOn;
  window.rfModBlocking = rfModBlocking;
  window.rfModsOff = function () { return Array.from(off); };

  // ---- karta „Moduły wyłączone przy starcie” w zakładce Konfiguracja (wybór, 2026-10-16) ---------
  // Na słabszym komputerze ktoś chce aplikację bez Skanera i Koła, a nie umie zrobić skrótu
  // z parametrem. Ta karta jest więc zawsze: przełącznik na moduł, zapis od razu do
  // Settings/ribbitflip_modules.json (POST /modules/startup) i „Uruchom ponownie” tą samą drogą co
  // przełączenie trybu (POST /modules/restart). Stan liczy serwer (zależności, edycja, pierwszeństwo
  // źródeł), karta tylko go rysuje: po każdym kliknięciu rysuje odpowiedź, nie własne zgadywanie.
  // Gdy listę dał parametr albo zmienna (`overridden`), plik nie wygrywa i karta mówi to wprost.
  // Zdania tłumaczy walker (pary w rf-01); nazwy modułów idą z serwera w obu językach (`names`), więc
  // są składane _gl() i przepisywane po zmianie języka. Moduły, których ta edycja nie ma, nie dostają
  // wiersza: nikt ich nie wybierał, a RibbitFlip Essential po prostu nie ma Syntha ani gry.
  const names = (M.names && typeof M.names === "object") ? M.names : {};
  function _nm(id) {
    const n = names[id] || [id, id];
    return (typeof _gl === "function") ? _gl(n[0], n[1]) : n[0];
  }
  function _paintNames() {
    document.querySelectorAll("#modsOffCard [data-mod]").forEach(function (b) { b.textContent = _nm(b.dataset.mod); });
  }
  function _el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function _modB(id) {
    const b = _el("b"); b.dataset.mod = id; b.setAttribute("data-noi18n", ""); b.textContent = _nm(id);
    return b;
  }
  let _st = null, _busy = false, _tierSync = null;
  function _gl2(pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; }
  function _sum() {
    if (!_st) return "";
    const ed = new Set(_st.edition || []), all = Object.keys(names).filter(function (id) { return !ed.has(id); }).length;
    const n = (_st.disable || []).length;
    let t = _gl2("wyłączone: ", "off: ") + n + _gl2(" z ", " of ") + all;
    if (_st.overridden) t += " · " + _gl2("parametr startu ma pierwszeństwo", "a start parameter wins");
    else if (_st.pending) t += " · " + _gl2("czeka na ponowne uruchomienie", "waits for a restart");
    return t;
  }
  const _req = {};
  function _msg(pl) {
    const m = document.getElementById("modsOffMsg");
    if (!m) return;
    m.textContent = pl;
    setTimeout(function () { if (m.textContent === pl) m.textContent = ""; }, 3200);
  }
  function _render() {
    const card = document.getElementById("modsOffCard");
    if (!card || !_st) return;
    const nextWhy = _st.nextWhy || {}, chosen = new Set(_st.disable || []), ed = new Set(_st.edition || []);
    const list = card.querySelector("#modsOffRows");
    list.textContent = "";
    for (const id of Object.keys(names)) {
      if (ed.has(id)) continue;
      const w = String(nextWhy[id] || ""), dep = w.indexOf("requires:") === 0;
      const row = _el("div", "setupbar mods-row"); row.dataset.row = id;
      const lbl = _el("span", "setuplbl"); lbl.style.minWidth = "210px";   // przełączniki w jednej kolumnie
      lbl.appendChild(_modB(id));
      row.appendChild(lbl);
      const tg = _el("div", "rf-toggle" + (w ? "" : " on") + (dep ? " dis" : ""));
      tg.id = "modsTg-" + id; tg.style.marginLeft = "0";
      if (dep) tg.style.opacity = "0.7";   // .dis daje .45: „Off” byłoby za blade, a stan ma być czytelny
      tg.setAttribute("role", "switch"); tg.setAttribute("tabindex", dep ? "-1" : "0");
      tg.setAttribute("aria-checked", w ? "false" : "true");
      tg.setAttribute("aria-disabled", dep ? "true" : "false");
      tg.title = "Włącz albo wyłącz moduł przy następnym starcie";
      tg.innerHTML = '<span class="rf-tg-lbl off">Wył.</span><span class="rf-tg-knob"></span><span class="rf-tg-lbl on">Wł.</span>';
      tg.addEventListener("click", function () { _toggle(id, chosen); });   // Enter/Space: rf-27-fx-draw.js
      row.appendChild(tg);
      // Zależność wprost: Koło potrzebuje Nakładki, więc wyłączona Nakładka gasi też Koło.
      if (dep) {
        row.appendChild(_el("span", "hint", "wyłączy się razem z modułem"));
        row.appendChild(_modB(w.split(":")[1]));
      } else if ((_req[id] || []).length) {
        row.appendChild(_el("span", "hint", "potrzebuje:"));
        for (const r of _req[id]) row.appendChild(_modB(r));
      }
      list.appendChild(row);
    }
    const cur = card.querySelector("#modsOffNow");
    cur.textContent = "";
    if ((_st.current || []).length) {
      cur.appendChild(_el("span", "", "W tym uruchomieniu wyłączone:"));
      _st.current.forEach(function (id, i) { cur.appendChild(document.createTextNode(i ? ", " : " ")); cur.appendChild(_modB(id)); });
    } else {
      cur.appendChild(_el("span", "", "W tym uruchomieniu działają wszystkie moduły."));
    }
    const pill = card.querySelector("#modsOffPill");
    pill.textContent = _st.overridden ? "Parametr startu ma pierwszeństwo"
      : (_st.pending ? "Zmiana zadziała po ponownym uruchomieniu" : "Tak działa to uruchomienie");
    pill.className = "ra-pill " + (_st.overridden || _st.pending ? "warn" : "ok");
    card.querySelector("#modsOffLock").style.display = _st.overridden ? "" : "none";
    card.querySelector("#modsOffRestart").disabled = !_st.pending || _busy;
    try { if (_tierSync) _tierSync(); } catch (e) { }
  }
  function _load() {
    Promise.all([fetch("/modules/startup", { cache: "no-store" }).then(function (r) { return r.json(); }),
                 fetch("/modules", { cache: "no-store" }).then(function (r) { return r.json(); })])
      .then(function (a) {
        if (a[1] && Array.isArray(a[1].modules)) for (const m of a[1].modules) _req[m.id] = m.requires || [];
        if (a[1] && a[1].pid && a[0]) a[0].pid = a[1].pid;
        if (a[0] && a[0].ok) { _st = a[0]; _render(); }
      }).catch(function () { });
  }
  function _toggle(id, chosen) {
    if (_busy || !_st) return;
    if (String((_st.nextWhy || {})[id] || "").indexOf("requires:") === 0) return;
    const L = new Set(chosen);
    if (L.has(id)) L.delete(id); else L.add(id);
    _busy = true;
    fetch("/modules/startup", { method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ disable: Array.from(L) }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        _busy = false;
        if (j && j.ok) { j.pid = _st.pid; _st = j; _render(); _msg("Zapisano"); }
        else { _render(); _msg("Nie udało się zapisać wyboru"); }
      })
      .catch(function () { _busy = false; _render(); _msg("Nie udało się zapisać wyboru"); });
  }
  function _restart() {
    if (_busy || !_st || !_st.pending) return;
    _busy = true; _render();
    // Stary proces odpowiada jeszcze przez pół sekundy, więc nowy poznajemy po innym `pid`.
    const pid0 = _st.pid;
    if (typeof rfRestartOverlay === "function") rfRestartOverlay(true, "Uruchamiam ponownie…", "Czekam na ponowne połączenie…");
    function wait() {
      let n = 0;
      (function poll() {
        n++;
        fetch("/modules", { cache: "no-store" }).then(function (r) { return r.json(); })
          .then(function (j) { if (j && j.pid && j.pid !== pid0) location.reload(); else throw 0; })
          .catch(function () { if (n < 80) setTimeout(poll, 500); else location.reload(); });
      })();
    }
    fetch("/modules/restart", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) { setTimeout(wait, 900); return; }
        _busy = false; _render();
        if (typeof rfRestartOverlay === "function") rfRestartOverlay(false);
        _msg("Nie udało się uruchomić ponownie");
      })
      .catch(function () { setTimeout(wait, 900); });   // odpowiedź mogła zginąć ze starym procesem
  }
  window.initModsOffCard = function () {
    const panel = document.getElementById("tab-ustawienia");
    if (!panel || document.getElementById("modsOffCard")) return;   // ?view=overview nie ma paneli
    // PIĘTRO 2 (UX 261120 L4c): ustawia się raz po instalacji, więc to zwijak. W nagłówku liczba
    // wyłączonych i to, czy wybór czeka na ponowne uruchomienie, więc zwinięty nie chowa stanu.
    const card = document.createElement("details"); card.className = "cardfold inset us-fold"; card.id = "modsOffCard";
    card.innerHTML =
      '<summary>Start programu</summary><div class="cardfold-body">' +
        '<p class="hint us-fold-hint">które moduły ładują się razem z programem</p>' +
      '<div class="ra-lead">Wyłączony moduł nie wstaje razem z aplikacją: nie ma zakładki ani karty, nie zajmuje procesora i nie odpowiada na zapytania. Wybór zapisuje się od razu, a działa po ponownym uruchomieniu.</div>' +
      '<div id="modsOffRows"></div>' +
      '<div class="setupbar">' +
        '<button class="btn sm" id="modsOffRestart" disabled title="Zamyka aplikację i uruchamia ją od nowa z tym wyborem">Uruchom ponownie</button>' +
        '<span class="ra-pill" id="modsOffPill"></span>' +
        '<span class="setupmsg" id="modsOffMsg" role="status" aria-live="polite"></span>' +
      '</div>' +
      '<div class="setup-note" id="modsOffNow"></div>' +
      '<div class="setup-note" id="modsOffLock" style="display:none">Aplikację uruchomiono z parametrem --disable albo --only (albo zmienną RIBBITFLIP_DISABLE lub RIBBITFLIP_ONLY), więc teraz liczy się on, a nie ten wybór. Wybór czeka zapisany i zadziała, gdy uruchomisz aplikację bez parametru.</div>' +
      '</div>';
    // Miejsce karty ustala rfUstawOrder (rf-40): zawsze zaraz pod Stopem awaryjnym, więc ktoś
    // szukający zaginionej zakładki widzi ją od razu, a ekran nie zmienia układu między startami.
    panel.appendChild(card);
    try {
      if (typeof rfTier === "function") _tierSync = rfTier(card, "ustawienia.moduly", { sum: _sum,
        changed: function () { return _st ? (_st.disable || []).length : 0; } });
    } catch (e) { }
    card.querySelector("#modsOffRestart").addEventListener("click", _restart);
    _load();
    // Nazwy są składane _gl(), więc zmiana języka musi je przepisać (jak rf-40 przy Usługach).
    if (typeof setLang === "function") {
      const prev = setLang;
      setLang = function () { const r = prev.apply(this, arguments); try { _paintNames(); } catch (e) { } return r; };
    }
  };
  if (!off.size) return;
  document.documentElement.dataset.modsOff = Array.from(off).join(" ");

  const _fetch = window.fetch;
  if (typeof _fetch === "function") {
    window.fetch = function (input, init) {
      const url = (typeof input === "string") ? input : ((input && input.url) || String(input || ""));
      const mid = rfModBlocking(url);
      if (mid) return Promise.resolve(_answer(mid));
      return _fetch.apply(this === window ? window : this, arguments);
    };
  }
  if (navigator.sendBeacon) {
    const _beacon = navigator.sendBeacon.bind(navigator);
    try {
      navigator.sendBeacon = function (url, data) { return rfModBlocking(url) ? true : _beacon(url, data); };
    } catch (e) { }
  }
})();
