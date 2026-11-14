// =====================================================================================================
// LINIA GOTOWOŚCI — „czemu to nie działa i co kliknąć" (przegląd modułów 2026-11-17)
// =====================================================================================================
// Ten sam kłopot wracał w kilku modułach naraz: żeby Skaner, wirtualny pad albo samo połączenie
// zadziałało, musi się zgadzać kilka rzeczy jednocześnie (moduł, reguła, moduł Mapowanie, kapsel,
// sterownik, główny przełącznik sterowania), a każda z nich stała w innym miejscu panelu. Nowy
// człowiek widział „nic się nie dzieje" i nie miał skąd wiedzieć, której z nich brakuje. Opiekun
// osoby obsługującej komputer jednym sygnałem tym bardziej.
//
// Linia stoi pod nagłówkiem modułu i wypisuje warunki po kolei: spełnione na zielono, niespełnione
// z jednym przyciskiem, który je naprawia (albo prowadzi tam, gdzie się to robi). Gdy wszystko się
// zgadza, zostaje jedno zielone zdanie.
//
// JAK DZIAŁA. Każdy moduł rejestruje adapter (`rfReady.register`): gdzie wstawić linię i funkcję,
// która zwraca wiersze. Wiersz:
//   {ok, pl, en, fix:{pl, en, click:"#selektor" | run()}, steps:[[pl,en],…], wait, info}
//     ok    spełniony (✓); niespełniony (✗) dostaje przycisk naprawy, pierwszy z nich też kroki,
//     wait  „trwa" (⏳): niespełniony, ale aplikacja sama nad tym pracuje; nie krzyżyk,
//     info  informacja (ℹ), np. tryb podglądu: nie blokuje zdania „wszystko gotowe".
// Odświeża ją jeden licznik co sekundę, ale tylko dla linii widocznych na ekranie i bez dotykania
// DOM-u, gdy nic się nie zmieniło (podpis z tekstu i stanów). Wyjątek to główny przełącznik
// sterowania: na jego zmianę linia odpowiada od razu (obserwator klasy `#armBtn`), bo to pierwsza
// rzecz, którą człowiek klika, i sekunda „wszystko gotowe" po wstrzymaniu byłaby nieprawdą.
//
// ZASADY (synteza UX 2026-11-20, 3.4):
//   · kolejność wierszy = kolejność zależności: program spoza aplikacji → konfiguracja (port,
//     mapowanie, sygnał) → moduł włączony → sterowanie włączone (`armedRow`) → kapsel (`capsuleRow`),
//   · przycisk naprawy KLIKA TĘ SAMĄ KONTROLKĘ co człowiek (`fix.click`), zamiast wołać funkcję
//     obok niej: tylko wtedy przechodzi przez te same pytania (symulacja, potwierdzenia) i zapis,
//   · pusty moduł nie dostaje linii (`empty`): tam prowadzi pusty stan modułu,
//   · `show(id)` najpierw otwiera pod-zakładkę, w której cel leży, potem przewija i podświetla.
// WHY: one shared component instead of four ad-hoc "why isn't it working" hints.
(function () {
  "use strict";
  const T = function (pl, en) { return (typeof _lang !== "undefined" && _lang === "en") ? en : pl; };
  const esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c];
    });
  };
  const REG = [];

  // Znaki stanu rysuje font filcowy (tools/ikony_filc_mapa.json): ✓ checks, ✗ zamknij-x, ⏳ stoper, ℹ info.
  function icOf(r) { return r.ok ? "✓" : r.wait ? "⏳" : r.info ? "ℹ" : "✗"; }
  function stOf(r) { return r.ok ? "ok" : r.wait ? "wait" : r.info ? "info" : "no"; }

  function render(host, rows, okPair) {
    // `info` nie blokuje: tryb podglądu to wiadomość, a nie brak.
    const bad = rows.filter(function (r) { return !r.ok && !r.info; });
    const sig = T("pl", "en") + "|" + rows.map(function (r) { return stOf(r) + r.pl; }).join("|") + "|" + okPair[0];
    if (host.dataset.sig === sig) return;
    host.dataset.sig = sig;
    host.className = "rf-ready " + (bad.length ? "todo" : "ok");
    if (!rows.length) { host.hidden = true; return; }
    host.hidden = false;
    if (!bad.length) {
      const infos = rows.filter(function (r) { return r.info; });
      host.innerHTML = '<span class="rf-ready-all"><span class="rf-ready-ic" aria-hidden="true">✓</span>' +
        esc(T(okPair[0], okPair[1])) + '</span>' +
        infos.map(function (r) {
          return '<span class="rf-ready-it info"><span class="rf-ready-ic" aria-hidden="true">ℹ</span>' + esc(T(r.pl, r.en)) + '</span>';
        }).join("");
      return;
    }
    let h = '<span class="rf-ready-lead">' + esc(T("Żeby to zadziałało:", "For this to work:")) + '</span>';
    rows.forEach(function (r, i) {
      h += '<span class="rf-ready-it ' + stOf(r) + '">' +
        '<span class="rf-ready-ic" aria-hidden="true">' + icOf(r) + '</span>' +
        '<span class="rf-ready-tx">' + esc(T(r.pl, r.en)) + '</span>' +
        (!r.ok && !r.info && r.fix ? '<button type="button" class="btn xs primary rf-ready-fix" data-i="' + i + '">' +
          esc(T(r.fix.pl, r.fix.en)) + '</button>' : "") +
        '</span>';
    });
    const first = bad[0];
    if (first.steps && first.steps.length) {
      h += '<ol class="rf-ready-steps">' + first.steps.map(function (s) {
        return '<li>' + esc(T(s[0], s[1])) + '</li>';
      }).join("") + '</ol>';
    }
    host.innerHTML = h;
    host.querySelectorAll(".rf-ready-fix").forEach(function (b) {
      b.addEventListener("click", function () {
        const r = rows[+b.dataset.i];
        try { runFix(r.fix); } catch (e) { console.error("[RibbitFlip] linia gotowości:", e); }
        host.dataset.sig = "";                       // przelicz od razu, nie po sekundzie
        setTimeout(tick, 150);
      });
    });
  }

  // `click` = selektor kontrolki, którą klika człowiek (zalecane); `run` = funkcja, gdy takiej
  // kontrolki nie ma (link zewnętrzny, przewinięcie do miejsca).
  function runFix(fix) {
    if (!fix) return;
    if (fix.click) {
      const el = document.querySelector(fix.click);
      if (el) { el.click(); return; }
    }
    if (typeof fix.run === "function") fix.run();
  }

  function mount(a) {
    if (a.host && a.host.isConnected) return a.host;
    const anchor = a.anchor();
    if (!anchor) return null;
    const host = document.createElement("div");
    host.className = "rf-ready";
    host.id = a.id;
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    host.setAttribute("data-noi18n", "");          // napisy składa T(), słownik PL→EN nie ma tu czego szukać
    host.hidden = true;
    anchor.parentNode.insertBefore(host, anchor.nextSibling);
    a.host = host;
    return host;
  }

  function okPairOf(a) {
    let p = typeof a.allOk === "function" ? a.allOk() : a.allOk;
    if (!p || p.length !== 2) p = ["Wszystko gotowe.", "All set."];
    // Symulacja ma własne zdanie (F-G6-07): „gotowe" nie może brzmieć jak „kapsel jest w ręku".
    if (a.sim !== false && isSim()) {
      p = [p[0] + " " + SIM_TAIL[0], p[1] + " " + SIM_TAIL[1]];
    }
    return p;
  }

  function tick() {
    REG.forEach(function (a) {
      const host = mount(a);
      if (!host || !host.parentNode || !host.parentNode.offsetParent) return;   // schowana zakładka: nie licz
      let rows = [];
      let empty = false;
      try { empty = typeof a.empty === "function" && !!a.empty(); } catch (e) { empty = false; }
      if (!empty) {
        try { rows = (a.rows() || []).filter(Boolean); } catch (e) { rows = []; }
      }
      render(host, rows, okPairOf(a));
    });
  }

  // ----- wspólne kawałki adapterów -----
  function S() { return (typeof state !== "undefined") ? state : null; }
  function viewedDev() {
    const s = S();
    if (!s || !s.devices) return null;
    return s.devices[s.viewDev || s.activeDeviceId || "d0"] || null;
  }
  function isSim() {
    const D = viewedDev();
    if (D && D.conn) return D.conn === "sim";
    const s = S();
    return !!(s && s.cfg && s.cfg.simulate);
  }
  const SIM_TAIL = ["Symulacja: ruch kapsla udaje aplikacja.", "Simulation: the app fakes the capsule motion."];
  function goTab(id) {
    const b = document.querySelector('[data-tab="' + id + '"]');
    if (b) b.click();
  }
  // Cel w innej pod-zakładce (Biblioteka, Informacje) nie ma wymiaru i przewinięcie do niego nic nie
  // robi (F-G2-03). Najpierw otwieramy zakładkę, w której leży, potem przewijamy i podświetlamy.
  function show(id) {
    const el = typeof id === "string" ? document.getElementById(id) : id;
    if (!el) return false;
    try { if (typeof rfRevealPane === "function") rfRevealPane(el); } catch (e) { }
    // UX 261120 L4c: cel bywa w zwiniętym zwijaku piętra 2 albo 3 (np. port MIDI), więc otwieramy go.
    for (let d = el.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) d.open = true;
    requestAnimationFrame(function () {
      try { el.scrollIntoView({block: "center", behavior: "smooth"}); } catch (e) { }
      el.classList.remove("rf-ready-target"); void el.offsetWidth;
      el.classList.add("rf-ready-target");
      setTimeout(function () { el.classList.remove("rf-ready-target"); }, 1600);
    });
    return true;
  }
  function capsuleRow() {
    const D = viewedDev();
    if (!D) return null;
    if (D.parked) return {ok: false, pl: "Kapsel śpi (oszczędzanie baterii)", en: "The capsule is asleep (battery saving)",
      fix: {pl: "Przejdź do Połączenia", en: "Go to Connection", run: function () { goTab("polaczenie"); }}};
    if (D.scanning) return {ok: false, wait: true, pl: "Szukam kapsla", en: "Looking for the capsule",
      fix: {pl: "Przejdź do Połączenia", en: "Go to Connection", run: function () { goTab("polaczenie"); }}};
    if (isSim()) return {ok: true, pl: "Kapsel symulowany", en: "Simulated capsule"};
    return {ok: true, pl: "Kapsel jest połączony", en: "The capsule is connected"};
  }
  // GŁÓWNY PRZEŁĄCZNIK STEROWANIA (F-G2-02 = F-G3-02). Silnik wysyła tylko przy `armed`, więc bez
  // tego wiersza linia mówiła „wszystko gotowe" przy wstrzymanym sterowaniu. Naprawa klika
  // `#armBtn`, nie woła `setArmed`: tylko tak przechodzi przez pytanie o symulację i zapis na serwer.
  // Napisy w jednej stałej, żeby zmiana nazwy przełącznika (D4) była jedną edycją.
  const ARMED = {on: ["Sterowanie włączone", "Control is on"], fix: ["Włącz sterowanie", "Turn control on"]};
  function armedRow() {
    const s = S();
    if (!s) return null;
    return {ok: !!s.armed, pl: ARMED.on[0], en: ARMED.on[1],
      fix: {pl: ARMED.fix[0], en: ARMED.fix[1], click: "#armBtn"}};
  }
  function mappingRow(why) {
    const s = S();
    const on = !!(s && s.trigEnabled);
    return {ok: on, pl: "Moduł Mapowanie włączony" + (why ? " (" + why[0] + ")" : ""),
      en: "The Mapping module is on" + (why ? " (" + why[1] + ")" : ""),
      fix: {pl: "Włącz Mapowanie", en: "Turn Mapping on", click: "#trigEnable"}};
  }
  // Linia stoi pod nagłówkiem MODUŁU (`#rfpc-<zakładka> > .rfpc-head`, składa go rf-49m), czyli
  // tam, gdzie jest włącznik modułu, a nie pod nagłówkiem którejś karty w pod-zakładce.
  function headOf(tab) {
    const m = document.getElementById("rfpc-" + tab);
    return m ? (m.querySelector(":scope > .rfpc-head") || null) : null;
  }

  // Rejestracja: `id` hosta, `anchor()` zwraca element, ZA którym linia stoi (zwykle `headOf(tab)`),
  // `rows()` zwraca wiersze, `allOk` to [pl, en] zdania, gdy wszystko się zgadza (albo funkcja,
  // która je zwraca), `empty()` = moduł nie ma jeszcze czego sprawdzać (linia znika),
  // `sim:false` = adapter sam mówi o symulacji (Połączenie).
  window.rfReady = {
    register: function (a) { REG.push(a); },
    tick: tick,
    armedRow: armedRow,
    capsuleRow: capsuleRow,
    mappingRow: mappingRow,
    headOf: headOf,
    show: show,
    goTab: goTab,
    isSim: isSim,
  };
  // Stare nazwy zostają: wołają je moduły spoza tego pliku.
  window.rfReadyRegister = window.rfReady.register;
  window.rfReadyTick = tick;
  setInterval(tick, 1000);

  // Główny przełącznik zmienia stan w `setArmed` (rf-12); patrzymy na jego przycisk, żeby nie
  // wpinać się w tamten plik. Pasek górny bywa składany na nowo, więc obserwator sprawdza przy
  // każdym liczeniu, czy patrzy na przycisk, który naprawdę stoi na ekranie.
  let armSeen = null, armObs = null;
  function watchArm() {
    const b = document.getElementById("armBtn");
    if (!b || b === armSeen || typeof MutationObserver !== "function") return;
    if (armObs) armObs.disconnect();
    armSeen = b;
    armObs = new MutationObserver(function () { setTimeout(tick, 0); });
    armObs.observe(b, {attributes: true, attributeFilter: ["class", "aria-checked"]});
  }
  setInterval(watchArm, 1000);
  watchArm();

  // ----- SKANER ----- adapter mieszka w rf-50d-scan-card.js (UX 261120 B2, właściciel ekranu).

  // ----- KONTROLER ----- adapter mieszka w rf-44-pad-hub.js (`padReadyRegister`).

  // ----- POŁĄCZENIE ----- adapter mieszka w rf-11c-pairing.js (UX 261120 B5b, właściciel ekranu).
})();
