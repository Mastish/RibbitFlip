"use strict";
// ==================================================================================================
//  KOLUMNA PRESETÓW — LISTA (wiersze, wiersz-duch, stopka)
//
//  Wydzielone z rf-49j-preset-col.js przy etapie 3 (limit 500/800 linii na plik,
//  .github/CONTRIBUTING.md). Pisze na tę samą prywatną przestrzeń `window._rfpc`.
//
//  WIERSZ JEST `div[role=option]`, NIE `<button>`. Do etapu 3 był przyciskiem i to było w porządku,
//  dopóki nic w środku nie było klikalne. Chip kapsla dostał ✕ („zdejmij nazwę"), a przycisk
//  w przycisku to nieprawidłowy HTML — przeglądarki radzą sobie z tym po swojemu i klik potrafi
//  trafić w rodzica. Rola `option` w liście `listbox` mówi czytnikowi ekranu dokładnie to samo, co
//  mówił przycisk, a strzałki i tabulator chodzą po `tabindex`.
// ==================================================================================================

(function (global) {
  const $ = global._rfpc = global._rfpc || {};
  const el = $.el, human = $.human, _t = $.t;

  // ------------------------------------------------------------------------------------------
  //  WIERSZ PRESETU
  // ------------------------------------------------------------------------------------------
  function row(I, p, st) {
    const b = el("div", "rfpc-row");
    b.setAttribute("role", "option");
    b.dataset.p = p.name;
    const carried = rfCfgIdKey(p.name) === rfCfgIdKey(st.name);
    if (carried) b.classList.add("act");
    const sel = rfCfgIdKey(p.name) === rfCfgIdKey(I.sel || st.name);
    if (sel) b.classList.add("sel");
    b.setAttribute("aria-selected", sel ? "true" : "false");
    b.tabIndex = sel ? 0 : -1;      // roving tabindex: tabulator wchodzi w listę tam, gdzie stoisz

    const A = I.spec.adapter();
    // OBRAZEK WIERSZA (02.10) — moduł, który go ma (dziś skaner: miniatura albo zrzut planszy),
    // podaje adres przez `presetThumb`. Stoi przed nazwą, bo opływa go reszta wiersza.
    if (A && typeof A.presetThumb === "function") {
      let src = "";
      try { src = String(A.presetThumb(p) || ""); } catch (e) { }
      if (src) {
        const im = el("img", "rfpc-thumb");
        im.alt = ""; im.loading = "lazy"; im.src = src;
        im.addEventListener("error", function () { im.remove(); });
        b.appendChild(im);
      }
    }
    const nm = human(el("span", "rfpc-nm", p.name));
    let metric = "";
    if (A && typeof A.presetMetric === "function") {
      try { metric = String(A.presetMetric(p) || ""); } catch (e) { }
    }
    if (carried || p.factory || p.seeded || metric) {
      const tags = el("span", "rfpc-tags");
      // Znacznik mówi „na tym kapslu", a nie „na Triki 2": kapsel nazywa linijkę wyżej ścieżka
      // okruszków, a napis składany z imienia nie ma jak trafić w słownik i18n (walker tłumaczy
      // po CAŁYM tekście węzła, więc „na Triki 2" zostałoby po polsku po przełączeniu języka).
      if (carried) {
        tags.appendChild(el("span", "rfpc-tag-act", I.spec.perDev === false
          ? _t("aktywna", "in use") : _t("na tym kapslu", "on this capsule")));
      }
      if (p.factory || p.seeded) tags.appendChild(el("span", "rfpc-tag-seed", _t("z aplikacji", "from the app")));
      // METRYKA („8 wyzwalaczy", „kursor · klika sam", „5 mapowań · 3 MIDI · 2 OSC") — jedyny fakt
      // z kafla huba, którego wiersz do tej pory nie miał, a to on odróżnia dwa presety o podobnych
      // nazwach szybciej niż opis. Składa ją moduł, nie ten plik.
      if (metric) tags.appendChild(human(el("span", "rfpc-tag-metric", metric)));
      nm.appendChild(tags);
    }
    b.appendChild(nm);

    // Bez zdania autora moduł może podać OPIS ZASTĘPCZY (`presetAutoDesc`, dziś skaner) — tylko do
    // oglądania; pole „Opis" w oknie zmiany nazwy dalej dostaje `descOf`, czyli słowa autora.
    let d = $.descOf(I, p), auto = false;
    if (!d && A && typeof A.presetAutoDesc === "function") { try { d = String(A.presetAutoDesc(p) || ""); auto = !!d; } catch (e) { } }
    if (d) b.appendChild(auto ? human(el("div", "rfpc-ds auto", d)) : el("div", "rfpc-ds", d));

    if (I.spec.perDev !== false) b.appendChild(carriers(I, p));

    b.addEventListener("click", e => {
      if (e.target && e.target.closest && e.target.closest("button,select")) return;
      $.pick(I, p.name);
    });
    b.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (e.target !== b) return;
      e.preventDefault(); $.pick(I, p.name);
    });
    return b;
  }

  // CHIPY KAPSLI, KTÓRE TO NOSZĄ. Każdy ma własną kropkę „zmienione" i własne ✕ — bo pytanie
  // „czy to jeszcze jest to, co zapisałem" zadaje się o KAŻDY kapsel z osobna, a nie o listę.
  function carriers(I, p) {
    const car = el("div", "rfpc-car");
    const who = $.carriersOf(I, p.name);
    if (!who.length) {
      car.appendChild(el("span", "rfpc-chip none", _t("nie nosi go żaden kapsel", "no capsule carries it")));
      return car;
    }
    const A = I.spec.adapter();
    const canStrip = A && typeof A.setCfgNameOn === "function";
    for (const c of who) {
      const chip = el("span", "rfpc-chip");
      let col = "";
      try { col = _cfhDevColor(A, c.dev) || ""; } catch (e) { }
      const bead = el("span", "rfpc-bead");
      if (col) bead.style.background = col;
      chip.appendChild(bead);
      chip.appendChild(human(el("b", null, $.devName(c.dev))));
      if (c.dirty) {
        const dot = el("span", "rfpc-dd");
        // CO ZMIENIONE — moduł, który umie to policzyć (dziś skaner, `dirtyWhy`), dopisuje pierwsze
        // różnice do dymka. Sama kropka mówiła „coś", a pytanie po niej zawsze brzmi „co".
        let why = "";
        if (A && typeof A.dirtyWhy === "function") { try { why = String(A.dirtyWhy(c.dev, p) || ""); } catch (e) { } }
        dot.title = _t("zmienione na tym kapslu", "changed on this capsule") + (why ? ":\n" + why : "");
        dot.setAttribute("role", "img");
        dot.setAttribute("aria-label", $.devName(c.dev) + ": " + dot.title);
        chip.appendChild(dot);
      }
      // ✕ ZDEJMUJE SAMĄ NAZWĘ Z TAMTEGO KAPSLA. W hubie robiło się to przeciągnięciem chipa na
      // tackę; tutaj chip stoi w wierszu, więc dostaje przycisk. Pyta — nie dlatego, że coś ginie
      // (ustawienia zostają co do wartości), tylko dlatego, że dotyczy kapsla, przy którym nie stoisz.
      if (canStrip) {
        const off = el("button", "rfpc-chip-off");
        off.type = "button";
        off.innerHTML = '<span aria-hidden="true">✕</span>';
        off.title = _t("Zdejmij nazwę z tego kapsla (ustawienia zostają)",
                       "Take the name off this capsule (the settings stay)");
        off.setAttribute("aria-label", off.title + ": " + $.devName(c.dev));
        off.onclick = e => {
          e.stopPropagation();
          rfCfgIdStripName(A, c.dev, $.after(I));
        };
        chip.appendChild(off);
      }
      car.appendChild(chip);
    }
    return car;
  }

  // ------------------------------------------------------------------------------------------
  //  WIERSZ-DUCH — nazwa, którą kapsel nosi, a której nie ma już na liście
  // ------------------------------------------------------------------------------------------
  // Kapsel nosi nazwę, bo ktoś skasował preset albo przyszedł zestaw z cudzą nazwą. Ustawienia SĄ
  // na kapslu, więc ukrycie tego stanu czytałoby się jako „konfiguracja zniknęła z kapsla", a to
  // nieprawda: zniknęła z listy. Jedyne wyjście, jakie tu istnieje, stoi w wierszu: zapisać
  // z powrotem to, co kapsel wciąż ma na sobie.
  function ghostRow(I, st) {
    const b = el("div", "rfpc-row is-gone");
    b.appendChild(human(el("span", "rfpc-nm", st.name)));
    b.appendChild(el("div", "rfpc-ds",
      _t("tej konfiguracji nie ma już na liście", "this configuration is no longer on the list")));
    const A = I.spec.adapter();
    if (A && typeof A.saveAs === "function") {
      const back = el("button", "btn sm", _t("Zapisz z powrotem…", "Save it back…"));
      back.type = "button";
      back.onclick = e => { e.stopPropagation(); rfCfgIdSaveAsNew(A, st.name, $.after(I)); };
      b.appendChild(back);
    }
    return b;
  }

  // ------------------------------------------------------------------------------------------
  //  LISTA
  // ------------------------------------------------------------------------------------------
  $.paintList = function (I) {
    const st = $.stateOf(I);
    const q = String(I.q.value || "").trim().toLowerCase();
    const all = $.presetsOf(I);
    const list = q
      ? all.filter(p => (String(p.name || "") + " " + $.descOf(I, p)).toLowerCase().indexOf(q) >= 0)
      : all;
    I.list.textContent = "";
    // UX 261120 B1 (P-G1-12): moduł z `adapter.libEmpty` mówi o pustej Bibliotece RAZ, w prawym
    // panelu (rf-49j3 `blank`), a wyszukiwarka nad pustą listą znika. Inne moduły bez zmian.
    const _A = I.spec.adapter && I.spec.adapter();
    const _bare = !q && !all.length && !st.name && !!(_A && typeof _A.libEmpty === "function");
    const _sb = I.q && I.q.closest && I.q.closest(".rfpc-search");
    if (_sb) _sb.style.display = _bare ? "none" : "";
    if (_bare) { $.paintFoot(I); return; }
    // (koniec fragmentu B1)
    // Duch idzie PIERWSZY: to stan, który wymaga decyzji, a nie pozycja do przeglądania.
    if (st.name && !st.known && (!q || st.name.toLowerCase().indexOf(q) >= 0)) {
      I.list.appendChild(ghostRow(I, st));
    }
    if (!list.length) {
      I.list.appendChild(el("div", "rfpc-empty", q
        ? _t("Nic nie pasuje do wpisanej frazy.", "Nothing matches what you typed.")
        // „preset" — ten sam rzeczownik, co na przycisku, w tytule okna zapisu i w nagłówku tej
        // zakładki (rf-49-cfgid `saveAsTitle`, rf-49m). Jeden przedmiot, jedno słowo.
        : _t("Ten moduł nie ma jeszcze zapisanego żadnego presetu.",
             "This module has no saved preset yet.")));
    } else {
      for (const p of list) I.list.appendChild(row(I, p, st));
    }
    $.paintFoot(I);
  };

  // ------------------------------------------------------------------------------------------
  //  STOPKA
  // ------------------------------------------------------------------------------------------
  // Podpina się pod PRZYCISKI, KTÓRE JUŻ ISTNIEJĄ w module — nie powtarza ich okien. Przycisk
  // wyłączony pokazuje się WRAZ Z POWODEM (to zachowanie kafla „+" z huba): przycisk, który po
  // prostu przestał działać, czyta się jak usterka, a powód mówi, czego brakuje.
  // Jedno źródło tej decyzji stoi w `$.addBtn` (rf-49j3), bo o ten sam przycisk pyta też blok stanu
  // w Konfiguracji („Utwórz preset") — dwa własne czytania `spec.addBtn` rozjechałyby się przy
  // pierwszym module, który go nie ma.
  $.paintFoot = function (I) {
    I.foot.textContent = "";
    // `offsetParent` tu NIE działa: panel nieaktywnej zakładki jest `display:none`, więc każdy
    // przycisk w środku zgłosiłby się jako niewidoczny. Pytamy o to, co moduł naprawdę ustawia.
    // Rzeczownik modułu ze słownika adaptera (`words.libSaveAs`, `words.libSearch`): Synth mówi
    // o scenach, nie o presetach. Pole szukania przepisujemy tu, bo stopka rysuje się przy każdej
    // synchronizacji, także po zmianie języka.
    const A = I.spec.adapter && I.spec.adapter();
    const W = (A && A.words) || {};
    const q = document.getElementById("rfpcQ-" + I.spec.tab);
    if (q && Array.isArray(W.libSearch)) q.placeholder = _t(W.libSearch[0], W.libSearch[1]);
    const b = $.addBtn(I, Array.isArray(W.libSaveAs) ? _t(W.libSaveAs[0], W.libSaveAs[1])
                                                    : _t("+ Zapisz obecne jako…", "+ Save the current one as…"),
                          "Zapisz to, co masz teraz, jako nową pozycję na tej liście");
    if (b) {
      b.classList.remove("primary");   // w stopce listy to jedna z dwóch równorzędnych dróg
      I.foot.appendChild(b);
      if (b.disabled && b.title) I.foot.appendChild(human(el("div", "rfpc-f-why", b.title)));
    }
    // WYMIANA — W KAŻDYM MODULE, NIE W JEDNYM. Do 2026-08-31 ten przycisk pojawiał się wyłącznie
    // tam, gdzie moduł miał w swoim wpisie `exchange` z id istniejącego przycisku — czyli w JEDNYM
    // module na osiem (Mapowanie). W pozostałych siedmiu lista presetów kończyła się na „zapisz",
    // a wysłanie komuś tego samego pliku wymagało wyjścia do innej zakładki. Rodzaj bierzemy
    // z rejestru (rf-49-kinds) i otwieramy TO SAMO okno, co tamten przycisk.
    const kind = _rfpcShareKind(I);
    if (kind && typeof rfShareHubOpen === "function") {
      const b = el("button", "btn sm", _t("Wymiana", "Exchange"));
      b.type = "button";
      b.title = "Podziel się na forum, zobacz cudze albo wczytaj od kogoś";
      b.setAttribute("aria-expanded", "false");
      b.onclick = () => { try { rfShareHubOpen(kind, { opener: b }); } catch (e) { } };
      I.foot.appendChild(b);
    }
    // PRZYCISK TYLKO DLA JEDNEGO MODUŁU — brany po NAZWIE z jego wpisu w MODS, tak samo jak
    // `sync`, `addBtn` i `onShow`. Skaner ma tu „Przywróć zestawy z aplikacji": jego zestawy są
    // pozycjami tej listy, a zasiew jest jednorazowy, więc skasowany zestaw potrzebuje drogi
    // powrotnej. Funkcja ODDAJE przycisk (albo nic) — stopka nie wie, co on robi.
    const extra = I.spec && I.spec.footBtn;
    if (extra && typeof window[extra] === "function") {
      try { const x = window[extra](I); if (x) I.foot.appendChild(x); } catch (e) { }
    }
  };

  // Rodzaj do wymiany dla tego modułu — po kluczu adaptera (`trig`, `mouse`, `midi`, `rest`,
  // `wheel`, `synth`). Moduł, którego rodzaj nie jest do wysyłania (sceny syntezatora, układy
  // nakładek), przycisku nie dostaje: `share: false` w rejestrze jest tu jedyną bramką.
  function _rfpcShareKind(I) {
    const R = (typeof RF_KINDS !== "undefined") ? RF_KINDS : (window.RF_KINDS || {});
    const key = I.spec && I.spec.key;
    if (!key) return "";
    for (const id in R) {
      const K = R[id];
      if (K.key === key && K.share && K.shareId) return K.shareId;
    }
    return "";
  }
})(window);
