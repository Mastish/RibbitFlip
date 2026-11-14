"use strict";
// ==================================================================================================
//  RAMKA MODUŁU — DWA MIEJSCA, KTÓRE MÓWIĄ O NAZWANEJ KONFIGURACJI
//
//  Wydzielone z rf-49j-preset-col.js przy etapie 3 (limit 500/800 linii, .github/CONTRIBUTING.md).
//  Przepisane 2026-08-31 razem z podziałem modułu na trzy zakładki (rf-49m).
//
//  A. `paintDetail` — PANEL OPISU w zakładce „Biblioteka", po prawej od listy. Do 2026-08-30 był to
//     „podgląd cudzego presetu": pokazywał się WYŁĄCZNIE wtedy, gdy kliknięto pozycję, której ten
//     kapsel nie nosi, i musiał wtedy CHOWAĆ kartę konfiguracji, bo stali w tym samym miejscu.
//     Od trzech zakładek karta stoi gdzie indziej, więc opis jest widoczny ZAWSZE i odpowiada na
//     pytanie „co to jest" o KAŻDĄ pozycję — także o tę, którą kapsel właśnie nosi. To była jedyna
//     pozycja w tej aplikacji, której nie dało się obejrzeć bez zdejmowania jej z kapsla.
//
//  B. `paintCfgState` — BLOK STANU na górze zakładki „Konfiguracja". Jedno zdanie o tym, CO TEN
//     KAPSEL NIESIE I CZY TO JEST ZAPISANE, plus przyciski, które to rozstrzygają. To jest
//     odpowiedź na zarzut, przez który powstał hub: „nie jest świadomy user, że konfiguruje dany
//     aktywny preset z autozapisem czy wymagając zapisu". Model jest dwuwarstwowy — NA KAPSLU
//     zapisuje się samo, W BIBLIOTECE dopiero po „Zapisz zmiany" — i to jedyne miejsce, które mówi
//     to wprost.
//
//  ⚠️ BLOK STANU RYSUJE SIĘ W KAŻDYM MODULE. Do 2026-08-30 tylko tam, gdzie lista zastąpiła hub
//  (`spec.hub`), bo moduły z cienkim paskiem rf-49 (scena syntezatora) miały już własne zdanie
//  i własne przyciski. Teraz pasek chowa arkusz (`.rfpc .rf-cfgbar`, 21-presets.css), więc zdanie
//  jest jedno i stoi wszędzie w tym samym miejscu.
// ==================================================================================================

(function (global) {
  const $ = global._rfpc = global._rfpc || {};
  const el = $.el, human = $.human, _t = $.t;

  const RULES_MAX = 16;      // dłuższa lista przestaje być opisem, a staje się zrzutem pliku

  // ------------------------------------------------------------------------------------------
  //  CO USTAWIA
  // ------------------------------------------------------------------------------------------
  // Treść liczy wspólny rejestr (rf-49k), z którego korzysta też panel opisu w Bibliotece. Ten plik
  // wyłącznie ją rysuje — dzięki temu opis tego samego presetu w dwóch miejscach nie ma jak się
  // rozjechać. Zero wartości domyślnych: brak pola w presecie = brak wiersza.
  $.sumBox = function (key, p) {
    let d = { rows: [], rules: [] };
    try { d = rfCfgDescribe(key, p) || d; } catch (e) { }
    const sum = el("div", "rfpc-sum");
    sum.appendChild(el("div", "rfpc-sum-h", _t("Co ustawia", "What it sets")));
    // RYSUNEK (rf-49k `art`) — przy skanerze plansze z obrysami sekcji. Nad wierszami, bo odpowiada
    // na pierwsze pytanie („gdzie to działa"), zanim ktoś zacznie czytać liczby.
    // Przy rysunku puste `rows` nie znaczą „preset pusty" — skaner mówi wszystko rysunkiem.
    let art = null;
    if (typeof d.art === "function") { try { art = d.art(); if (art) sum.appendChild(art); } catch (e) { } }
    if (!d.rows.length && !d.rules.length && !art) {
      sum.appendChild(el("div", "rfpc-ds", (typeof rfCfgDescribeEmptyText === "function")
        ? rfCfgDescribeEmptyText() : ""));
      return sum;
    }
    if (d.rows.length) {
      const ul = document.createElement("ul");
      for (const r of d.rows) {
        const li = document.createElement("li");
        li.appendChild(el("span", "rfpc-k", r.k));
        li.appendChild(human(el("span", null, String(r.v))));
        ul.appendChild(li);
      }
      sum.appendChild(ul);
    }
    if (d.rules.length) {
      const box = el("div", "rfpc-rules");
      for (const r of d.rules.slice(0, RULES_MAX)) {
        const chip = el("span", "rfpc-rule" + (r.off ? " off" : ""));
        chip.appendChild(human(el("b", null, r.c)));
        chip.appendChild(el("span", "rfpc-rule-ar", "→"));
        chip.appendChild(human(el("span", null, r.a)));
        if (r.b) chip.appendChild(human(el("span", "rfpc-rule-b", r.b)));
        box.appendChild(chip);
      }
      if (d.rules.length > RULES_MAX) {
        const n = d.rules.length - RULES_MAX;
        box.appendChild(el("span", "rfpc-rule more",
          _t("i jeszcze " + n, "and " + n + " more")));
      }
      sum.appendChild(box);
    }
    if (d.note) sum.appendChild(el("div", "rfpc-ds", d.note));
    return sum;
  };

  // Przycisk „Pobierz" albo `null`, gdy tego rodzaju nie da się zapisać do pliku. JEDNA droga dla
  // wszystkich rodzajów: `/library/item` na serwerze. Od etapu E4 oddaje on także koło, sceny
  // i układy okien — buduje im kopertę z magazynu w `Settings/` — więc panel nie musi wiedzieć,
  // czy pozycja jest plikiem, czy wierszem listy. Nazwa pliku z rejestru, w rodzinie „ribbitflip-".
  function _rfpcDownload(I, p) {
    const R = (typeof RF_KINDS !== "undefined") ? RF_KINDS : (window.RF_KINDS || {});
    let K = null;
    for (const id in R) if (R[id].key === I.spec.key) { K = R[id]; break; }
    if (!K || !K.lib || typeof rfLibDownload !== "function") return null;
    const fn = () => rfLibDownload(K.lib, p.name);
    const b = el("button", "btn sm", _t("Pobierz", "Download"));
    b.type = "button";
    b.title = "Zapisz tę pozycję do pliku, nic u Ciebie nie ruszając";
    b.onclick = fn;
    return b;
  }

  // „Wczytaj na…" — lista POZOSTAŁYCH kapsli. To była jedyna droga huba do wczytania konfiguracji
  // na kapsel, przy którym się nie stoi (kafel miał ją obok chipów), i jedyna równorzędna wobec
  // przeciągania. Przy jednym kapslu znika w całości: „wczytaj na" bez celu jest pytaniem
  // bez odpowiedzi.
  $.loadOntoPick = function (I, p) {
    const others = $.otherDevs(I);
    if (!others.length || !p) return null;
    const A = I.spec.adapter();
    const sel = document.createElement("select");
    sel.className = "rf-cfgpick rfpc-load";
    sel.title = _t("Wczytaj tę konfigurację na wybrany kapsel", "Load this configuration onto a capsule");
    sel.setAttribute("aria-label", sel.title);
    const first = document.createElement("option");
    first.value = ""; first.textContent = _t("Wczytaj na…", "Load onto…");
    sel.appendChild(first);
    for (const d of others) {
      const o = document.createElement("option");
      o.value = d; o.textContent = $.devName(d); o.setAttribute("data-noi18n", "");
      sel.appendChild(o);
    }
    sel.onchange = () => {
      const d = sel.value; sel.value = "";
      // Bez przerzucenia na Konfigurację: wczytanie na CUDZY kapsel nie zmienia tego, co jest pod
      // ręką, więc lista jest nadal tym, na co się patrzy.
      if (d) rfCfgIdAskLoadOnto(A, d, p, $.after(I));
    };
    return sel;
  };

  // Nazwa i usunięcie — te same okna, co w hubie (rf-49a), więc pytanie o zgodę jest jedno.
  // Adapter, który nie umie zapisać metadanych albo skasować pliku (osie 3D, syntezator), po
  // prostu nie dostaje tych przycisków; tamte moduły mają własne wiersze presetów.
  $.metaActs = function (I, p, box) {
    const A = I.spec.adapter();
    if (!A || !p) return;
    // POBIERZ — w TEJ liście, a nie tylko w Bibliotece globalnej. Do 2026-08-31 zapisany preset
    // dawało się stąd wczytać, przemianować i skasować, ale żeby go komuś WYSŁAĆ, trzeba było
    // wyjść do innej zakładki i znaleźć tę samą pozycję drugi raz. Plik jest ten sam i pisze go
    // ta sama funkcja — różni się wyłącznie miejsce, w którym stoi przycisk.
    const dl = _rfpcDownload(I, p);
    if (dl) box.appendChild(dl);
    if (typeof A.savePresetMeta === "function") {
      const b = el("button", "btn sm", _t("Zmień nazwę", "Rename"));
      b.type = "button";
      b.title = _t("Zmień nazwę i opis tej konfiguracji", "Change this configuration's name and description");
      b.onclick = () => rfCfgIdEditMeta(A, { name: p.name, desc: $.descOf(I, p), preset: p }, $.after(I));
      box.appendChild(b);
    }
    if (typeof A.deletePreset === "function") {
      const b = el("button", "btn sm danger", _t("Usuń", "Delete"));
      b.type = "button";
      b.title = _t("Usuń tę konfigurację z biblioteki", "Remove this configuration from the library");
      b.onclick = () => rfCfgIdDeletePreset(A, p.name, $.after(I));
      box.appendChild(b);
    }
  };

  // „ZAPISZ OBECNE JAKO…" — klika przycisk, KTÓRY JUŻ ISTNIEJE w module (hub albo pasek), zamiast
  // powtarzać jego okno. Ta sama zasada, co w stopce listy (rf-49j2 `paintFoot`): hub pyta przy
  // okazji o opis, pasek nie, i te dwie drogi mają zostać dokładnie takie, jakie są.
  //   `label` — bo w Bibliotece to jest „dodaj pozycję do listy", a w bloku stanu Konfiguracji
  //             „nadaj nazwę temu, co masz" i te dwa zdania nie znaczą tego samego.
  $.addBtn = function (I, label, title) {
    const A = I.spec.adapter();
    const b = el("button", "btn sm primary", label);
    b.type = "button";
    b.title = title || "";
    const src = I.spec.addBtn && document.getElementById(I.spec.addBtn);
    if (src) {
      if (src.style.display === "none" || src.hidden) return null;
      if (src.disabled) {                       // wyłączony WRAZ Z POWODEM — patrz `paintFoot`
        b.disabled = true;
        b.classList.remove("primary");
        // Powód z adaptera ma pierwszeństwo: `title` przycisku modułu bywa pusty albo mówi, CO
        // przycisk robi, a nie czemu nie działa (UX 261120, F-G3-11).
        const why = (A && typeof A.canSaveCurrent === "function") ? (A.canSaveCurrent() || {}).why : "";
        b.title = why || src.title || "";
        return b;
      }
      b.onclick = () => src.click();
      return b;
    }
    // MODUŁ BEZ WŁASNEGO PRZYCISKU (Usługi sieciowe, Kontroler — dołączyły do ramki 2026-08-31 i nie
    // mają ani paska rf-49, ani huba rf-49i). Wołamy TO SAMO okno, które tamte przyciski otwierają;
    // mieszka w rf-49a właśnie po to, żeby dało się je otworzyć bez huba.
    if (!A || typeof A.saveAs !== "function") return null;
    const can = (typeof A.canSaveCurrent === "function") ? A.canSaveCurrent() : { ok: true, why: "" };
    if (can && can.ok === false) {
      b.disabled = true;
      b.classList.remove("primary");
      b.title = can.why || "";
      return b;
    }
    b.onclick = () => rfCfgIdSaveAsNew(A, "", $.after(I));
    return b;
  };

  // RYSUNEK POZYCJI — obok nazwy i opisu, gdy moduł umie się narysować (`adapter.previewInto`).
  // Zna go dziś JEDEN moduł: koło wyboru, bo jest jedynym, którego konfiguracja ma kształt i którego
  // się tym kształtem rozpoznaje — reszta („dwa wyzwalacze", „scena syntezatora") niczego by tu nie
  // pokazała. Adapter bez tej funkcji nie dostaje pojemnika, więc jego panel wygląda jak przedtem.
  $.previewArt = function (I, p) {
    const A = I.spec.adapter();
    if (!A || !p || typeof A.previewInto !== "function") return null;
    const box = el("div", "rfpc-prev-art");
    box.setAttribute("aria-hidden", "true");     // to samo, co zdanie obok — czytnik ma to raz
    let ok = false;
    try { ok = (A.previewInto(box, p) !== false); } catch (e) { ok = false; }
    return ok ? box : null;
  };

  // ------------------------------------------------------------------------------------------
  //  A. PANEL OPISU (zakładka „Biblioteka")
  // ------------------------------------------------------------------------------------------
  // Pozycja, o której mówi panel: ta wskazana na liście, a gdy nic nie wskazano — ta, którą kapsel
  // NOSI. Nie „nic": wejście w Bibliotekę bez zaznaczania czegokolwiek jest najczęstsze, a pusty
  // panel obok listy każe kliknąć, żeby zobaczyć to, co i tak jest odpowiedzią na pierwsze pytanie.
  function target(I, st) {
    const A = I.spec.adapter();
    let nm = I.sel || (st.known ? st.name : "");
    // …a gdy nic nie wskazano i kapsel nic nie nosi — JEDYNĄ pozycję z listy. Panel obok listy
    // z jedną rzeczą, mówiący „kliknij pozycję na liście", każe kliknąć to, na co się właśnie
    // patrzy; koło wyboru samo pokazywało tę jedną od początku i to jest zachowanie do powtórzenia.
    // Tylko przy JEDNEJ: przy dwóch wybór za człowieka byłby zgadywaniem.
    if (!nm) {
      let all = [];
      try { all = $.presetsOf(I) || []; } catch (e) { }
      if (all.length === 1 && all[0]) nm = all[0].name;
    }
    if (!nm) return null;
    try { return A.findPreset(nm) || null; } catch (e) { return null; }
  }

  // Nic do opisania: kapsel nie nosi nazwanej konfiguracji, a na liście nic nie wskazano.
  function blank(I, st) {
    const box = el("div", "rfpc-blank");
    // Pusta lista to INNY brak niż „nic nie wskazałeś": nie ma czego wskazywać, więc zdanie
    // „kliknij pozycję na liście" odsyłało do miejsca, w którym stoi napis „ten moduł nie ma
    // jeszcze zapisanej żadnej konfiguracji". Trzeci przypadek („duch") zostaje bez zmian.
    let empty = false;
    try { empty = !(($.presetsOf(I) || []).length); } catch (e) { }
    // „Nic nie jest wskazane" było zdaniem MARTWEJ STREFY koła wyboru („nic nie jest wskazane"
    // = puck celuje w środek). W bibliotece to nie ta sama sprawa i nie ten sam czasownik.
    box.appendChild(el("h3", null, st.name
      ? _t("Ta konfiguracja zniknęła z listy", "This configuration is gone from the list")
      : empty
        ? _t("Nie masz tu jeszcze nic zapisanego", "You have nothing saved here yet")
        : _t("Nic nie wybrano", "Nothing selected")));
    box.appendChild(el("p", null, st.name
      ? _t("Ustawienia są na kapslu, ale pliku o tej nazwie już nie ma. Zapisz je z powrotem, żeby wróciła do biblioteki.",
           "The settings are on the capsule, but the file with that name is gone. Save them back to put it in the library again.")
      : empty
        ? _t("Zapisz to, co masz teraz, przyciskiem „+ Zapisz obecne jako…” pod listą — dopiero wtedy będzie co wybierać.",
             "Save what you have now with the “+ Save the current one as…” button under the list — then there will be something to pick.")
        : _t("Wybierz pozycję z listy po lewej.", "Pick an entry from the list on the left.")));
    // ŻADNEGO „+ Zapisz obecne jako…" TUTAJ. Ten przycisk stoi w stopce listy, czyli dwa centymetry
    // w lewo — powtórzony w pustym panelu wygląda jak druga, inna droga do tego samego okna.
    // „Zapisz z powrotem…" to co innego: dotyczy KONKRETNEJ nazwy, której nie ma na liście, więc
    // w stopce nie ma go i mieć nie może.
    const A = I.spec.adapter();
    // UX 261120 B1 (P-G1-12): pusta Biblioteka modułu z `libEmpty` ma jedno własne zdanie
    // i przycisk z powrotem do miejsca, w którym coś powstaje (Mapowanie: kafle startu).
    if (empty && !st.name && A && typeof A.libEmpty === "function") {
      const le = A.libEmpty() || {};
      box.textContent = "";
      box.appendChild(el("h3", null, le.title || ""));
      box.appendChild(el("p", null, le.text || ""));
      if (le.btn && typeof le.run === "function") {
        const acts = el("div", "rfpc-acts");
        const go = el("button", "btn sm primary", le.btn);
        go.type = "button"; go.onclick = le.run;
        acts.appendChild(go); box.appendChild(acts);
      }
      return box;
    }
    // (koniec fragmentu B1)
    if (st.name && !st.known && A && typeof A.saveAs === "function") {
      const acts = el("div", "rfpc-acts");
      const bk = el("button", "btn sm primary", _t("Zapisz z powrotem…", "Save it back…"));
      bk.type = "button";
      bk.onclick = () => rfCfgIdSaveAsNew(A, st.name, $.after(I));
      acts.appendChild(bk);
      box.appendChild(acts);
    }
    return box;
  }

  $.paintDetail = function (I) {
    const A = I.spec.adapter();
    const st = $.stateOf(I);
    const p = target(I, st);
    I.prev.textContent = "";
    if (!p) { I.prev.appendChild(blank(I, st)); return; }

    const carried = rfCfgIdKey(p.name) === rfCfgIdKey(st.name);

    const h = el("div", "rfpc-prev-h");
    h.appendChild(human(el("h3", null, p.name)));
    const d = $.descOf(I, p);
    const ds = el("div", "rfpc-ds", d || _t("bez opisu", "no description"));
    // „bez opisu" było ślepym zaułkiem: mówiło, czego brakuje, i nie mówiło, jak to uzupełnić —
    // jedyna droga wiodła przez przycisk „Zmień nazwę", czyli przez okno, które nazywa się od
    // innej rzeczy. Ten sam edytor, tylko wejście stoi przy zdaniu, którego dotyczy. Pojawia się
    // tylko wtedy, gdy opisu NIE MA (istniejący poprawia się „Zmień nazwę") i tylko tam, gdzie
    // moduł umie zapisać metadane.
    if (!d && A && typeof A.savePresetMeta === "function") {
      const add = el("button", "btn xs rfpc-ds-add", _t("Dodaj opis", "Add a description"));
      add.type = "button";
      add.onclick = () => rfCfgIdEditMeta(A, { name: p.name, desc: "", preset: p }, $.after(I));
      ds.appendChild(document.createTextNode(" "));
      ds.appendChild(add);
    }
    h.appendChild(ds);
    // Rysunek stoi PRZED zdaniem: przy szerokim panelu obok niego, przy wąskim (zawijanie w CSS)
    // nad nim — a w obu układach czyta się go pierwszy, bo to on odpowiada na „które to jest".
    const art = $.previewArt(I, p);
    if (art) {
      const top = el("div", "rfpc-prev-top");
      top.appendChild(art);
      top.appendChild(h);
      I.prev.appendChild(top);
    } else I.prev.appendChild(h);

    // Zdania o NOŚNIKU bierzemy ze słownika adaptera (`words` w rf-49): nośnikiem bywa kapsel,
    // ale bywa też cała aplikacja (scena syntezatora, preset Usług sieciowych) i wtedy „nosi ją
    // kapsel" jest po prostu nieprawdą. `_cfgW` sam sięga po wartość domyślną, gdy adapter swojej
    // nie podał, więc moduł, którego nikt nie tknął, brzmi dokładnie jak przedtem.
    const W = (k) => (typeof _cfgW === "function") ? _cfgW(A, k) : "";
    const note = el("div", "rfpc-note" + (carried ? " is-live" : ""));
    const w = el("span", "rfpc-note-w");
    if (carried) {
      // Pozycja, którą ten kapsel ma na sobie. Zdanie mówi model zapisu, a przyciski obok są
      // dokładnie tymi, które ten model rozstrzygają — te same, co w bloku stanu Konfiguracji.
      w.appendChild(el("span", null, W("inUse")));
      if (st.dirty) {
        w.appendChild(document.createTextNode(" "));
        w.appendChild(el("span", null,
          _t("Na kapslu masz zmiany, których w bibliotece jeszcze nie ma.",
             "The capsule has changes the library does not have yet.")));
      }
    } else {
      w.appendChild(document.createTextNode(_t("Podgląd z biblioteki.", "A preview from the library.") + " "));
      const who = $.carriersOf(I, p.name).map(c => $.devName(c.dev));
      if (who.length) {
        w.appendChild(el("span", null, _t("Nosi go:", "Carried by:")));
        w.appendChild(document.createTextNode(" "));
        w.appendChild(human(el("b", null, who.join(", "))));
        w.appendChild(document.createTextNode(". "));
      } else if (I.spec.perDev !== false) {
        w.appendChild(document.createTextNode(_t("Nie nosi go żaden kapsel.", "No capsule carries it.") + " "));
      }
      w.appendChild(document.createTextNode(W("toEdit")));
    }
    note.appendChild(w);

    if (carried && st.dirty) {
      const sv = el("button", "btn sm primary", _t("Zapisz zmiany", "Save the changes"));
      sv.type = "button";
      sv.onclick = () => rfCfgIdSaveChanges(A, $.after(I));
      note.appendChild(sv);
      const rv = el("button", "btn sm", _t("Przywróć", "Revert"));
      rv.type = "button";
      rv.title = _t("Odrzuć zmiany i wróć do zapisanej wersji",
                    "Discard the changes and go back to the saved version");
      rv.onclick = () => rfCfgIdRevert(A, $.after(I));
      note.appendChild(rv);
    } else if (!carried) {
      const load = el("button", "btn sm primary");
      load.type = "button";
      // Nazwa kapsla w osobnym, nietłumaczonym węźle — kluczem i18n jest sama reszta zdania
      // (ten sam wzorzec, co „… jest wstrzymany, nic nie wychodzi" w rf-34b).
      if (I.spec.perDev === false) load.textContent = W("loadHere");
      else {
        load.appendChild(el("span", null, _t("Wczytaj na", "Load onto")));
        load.appendChild(document.createTextNode(" "));
        load.appendChild(human(el("span", null, $.devName($.curDev()))));
      }
      // WCZYTANIE PRZERZUCA NA KONFIGURACJĘ (rf-49m, zasada 4): „wczytaj" znaczy „chcę teraz tego
      // używać". Przerzucenie idzie PO odświeżeniu listy, więc wraca się na ekran, który już wie,
      // co kapsel nosi.
      // ⚠️ TYLKO PRZY FAKTYCZNYM WCZYTANIU. Okno z pytaniem kończy się wywołaniem zwrotnym również
      // po „Anuluj" (pasek musi wtedy przerysować swój wybór), więc bez drugiego argumentu
      // `applied` cofnięcie też wyrzucałoby z Biblioteki — czyli karałoby za rozmyślenie się.
      load.onclick = () => {
        try {
          rfCfgIdAskLoad(A, p, function (nm, applied) {
            $.after(I)(nm);
            if (applied) $.setPane(I, "cfg");
          });
        } catch (e) { }
      };
      note.appendChild(load);
    }
    I.prev.appendChild(note);

    const acts = el("div", "rfpc-acts");
    const pick = $.loadOntoPick(I, p);
    if (pick) acts.appendChild(pick);
    $.metaActs(I, p, acts);
    if (acts.childNodes.length) I.prev.appendChild(acts);

    I.prev.appendChild($.sumBox(I.spec.key, p));
  };

  // ------------------------------------------------------------------------------------------
  //  B. BLOK STANU (góra zakładki „Konfiguracja")
  // ------------------------------------------------------------------------------------------
  $.paintCfgState = function (I) {
    const A = I.spec.adapter();
    const st = $.stateOf(I);
    const who = $.devName($.curDev());
    // OPTIONAL PHRASE NAMING THE KIND of record („wspólną konfigurację MIDI i OSC"). Read through
    // the adapter dictionary, empty for every module that does not set it — so the sentence of a
    // module nobody touched is composed exactly as before. Guarded on `A.words.kindOf` on purpose:
    // `_cfgW` falls back to RF_CFGID_WORDS, which carries no default for this key.
    const kind = (A && A.words && A.words.kindOf && typeof _cfgW === "function")
      ? (_cfgW(A, "kindOf") + " ") : "";
    I.stat.textContent = "";
    I.stat.className = "rfpc-state";
    I.stat.hidden = false;
    // PASEK „BEZ NAZWY" TYLKO, GDY JEST CO ZAPISAĆ (UX 261120, synteza 3.12, K5). Na pustym module
    // (zero reguł, zero mapowań, koło bez wycinków) zdanie „zapisz je jako preset" nad wygaszonym
    // przyciskiem tylko zasłaniało pusty stan, który ma tam prowadzić. Jedna reguła dla wszystkich
    // modułów: przycisk zapisu istnieje i jest czynny, inaczej paska nie ma.
    let add = null;
    if (!st.name) {
      add = $.addBtn(I, (typeof _cfgW === "function" && A) ? _cfgW(A, "createBtn") : _t("Utwórz preset", "Create a preset"),
                     "Nadaj nazwę temu, co masz teraz, i dopisz to do biblioteki modułu");
      if (!add || add.disabled) { I.stat.hidden = true; return; }
    }
    const p = document.createElement("p"); p.className = "rfpc-state-tx";
    if (!st.name) {
      // Stan „bez nazwy" to stan DOMYŚLNY każdego, kto jeszcze nic nie zapisał, więc wisi na górze
      // każdego modułu. Jako pełny blok z różowym przyciskiem przekrzykiwał główną akcję ekranu
      // („Nowy wyzwalacz”, „Nowe mapowanie”) — przegląd UX 2026-10-15. Zostaje celowo,
      // ale jako jedna cicha linijka: klasa is-noname + przycisk drugorzędny niżej.
      I.stat.classList.add("is-noname");
      // Nośnikiem bywa kapsel, ale bywa też cała aplikacja — zdanie o nim idzie wtedy ze słownika
      // adaptera, bo „scenę" w Usługach sieciowych i „preset" w syntezatorze to dwa różne słowa
      // o dwóch różnych rzeczach. Wersja z imieniem kapsla składana jest tu, bo napis zaczynający
      // się od czyjegoś imienia nie ma jak trafić w słownik i18n.
      // Zdanie („Te ustawienia działają na {kto}, ale nie mają nazwy…") idzie przez ten sam
      // słownik: rzeczownik ma być TEN SAM, co na przycisku pod zdaniem („Utwórz preset",
      // w kole „Utwórz koło"). Fallback zostaje na wypadek panelu bez rf-49.
      p.textContent = I.spec.perDev === false
        ? ((typeof _cfgW === "function") ? _cfgW(A, "noName") : "")
        : ((typeof _cfgNoNameDev === "function")
            ? _cfgNoNameDev(A, who)
            : _t("Te ustawienia działają na " + who + ", ale nie mają nazwy. Zapisz je jako preset, żeby móc do nich wrócić.",
                 "These settings work on " + who + " but have no name. Save them as a preset so you can come back to them."));
    } else if (!st.known) {
      I.stat.classList.add("is-gone");
      p.textContent = _t(
        who + " nosi " + kind + "„" + st.name + "”, ale tej konfiguracji nie ma już na liście. Ustawienia są na kapslu; zapisz je z powrotem, żeby wróciła do biblioteki.",
        who + " carries " + kind + "“" + st.name + "”, but that configuration is no longer on the list. The settings are on the capsule; save them back to put it in the library again.");
    } else if (st.dirty) {
      I.stat.classList.add("is-dirty");
      p.textContent = _t(
        who + " nosi " + kind + "„" + st.name + "” ze zmianami. Na kapslu wszystko już działa. „" + st.name + "” w bibliotece zmieni się dopiero po „Zapisz zmiany”.",
        who + " carries " + kind + "“" + st.name + "” with changes. On the capsule everything already works. “" + st.name + "” in the library changes only once you hit “Save the changes”.");
    } else {
      p.textContent = _t(
        who + " nosi " + kind + "„" + st.name + "”. Zmiany, które tu zrobisz, działają od razu i zapisują się na kapslu.",
        who + " carries " + kind + "“" + st.name + "”. The changes you make here take effect immediately and are saved on the capsule.");
    }
    p.setAttribute("data-noi18n", "");     // zdanie złożone z imienia kapsla — walker ma je zostawić
    I.stat.appendChild(p);

    const acts = el("div", "rfpc-state-acts");
    if (!st.name) {
      // ŻYCZENIE WŁAŚCICIELA (2026-08-31): „na górze który preset edytujesz albo, że aktywny preset
      // nie jest zapisany i utwórz preset". Bez tego przycisku jedyne wyjście z bezimiennej
      // konfiguracji stało w stopce listy, czyli w INNEJ zakładce niż zdanie, które o nim mówi.
      // Rzeczownik ze słownika adaptera (`words.createBtn`), bo zdanie nad przyciskiem też z niego
      // idzie: syntezator mówi „zapisz go jako scenę" i dostaje „Utwórz scenę", reszta „Utwórz preset".
      // Przycisk zbudowany wyżej (od niego zależy, czy pasek w ogóle stoi). Drugorzędny i niski
      // (`xs`, 28 px): pasek to cicha linijka, nie wezwanie (patrz is-noname wyżej).
      add.classList.remove("primary", "sm");
      add.classList.add("xs");
      acts.appendChild(add);
    } else if (st.known && st.dirty) {
      const sv = el("button", "btn sm primary", _t("Zapisz zmiany", "Save the changes"));
      sv.type = "button";
      sv.onclick = () => rfCfgIdSaveChanges(A, $.after(I));
      acts.appendChild(sv);
      const rv = el("button", "btn sm", _t("Przywróć", "Revert"));
      rv.type = "button";
      rv.title = _t("Odrzuć zmiany i wróć do zapisanej wersji",
                    "Discard the changes and go back to the saved version");
      rv.onclick = () => rfCfgIdRevert(A, $.after(I));
      acts.appendChild(rv);
    } else if (!st.known) {
      const bk = el("button", "btn sm primary", _t("Zapisz z powrotem…", "Save it back…"));
      bk.type = "button";
      bk.onclick = () => rfCfgIdSaveAsNew(A, st.name, $.after(I));
      acts.appendChild(bk);
    }
    // ZERO PRZYCISKÓW PORZĄDKOWYCH. Zmiana nazwy, usunięcie i „wczytaj na inny kapsel" stoją
    // w Bibliotece, przy pozycji, której dotyczą. Tutaj byłyby drugim kompletem tych samych okien
    // nad ekranem, na którym się kręci pokrętłami — a to nie jest czynność porządkowa.
    if (acts.childNodes.length) I.stat.appendChild(acts);
  };
})(window);
