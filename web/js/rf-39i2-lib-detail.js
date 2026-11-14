"use strict";
// ==================================================================================================
//  BIBLIOTEKA — PANEL OPISU (prawa strona)
//
//  ZASADA, KTÓRA TRZYMA TO RAZEM: BIBLIOTEKA OPISUJE, MODUŁ ZMIENIA. W tym panelu nie ma ani
//  jednego pola do wpisywania. Klik w pozycję niczego nie wczytuje i nigdzie nie wyrzuca — mówi,
//  co ta konfiguracja ustawia, kto ją nosi i skąd się wzięła. Do edycji prowadzi jeden przycisk:
//  „Otwórz w module X". Gdyby te same ustawienia dały się ruszać i tu, i tam, byłyby dwa edytory
//  jednej rzeczy, które rozjadą się po cichu.
//
//  SKĄD BIERZE TREŚĆ (nic nie liczy sam — dlatego opis nie ma jak skłamać):
//    * kto to nosi        → `rfCfgIdCarriers` z adaptera modułu (rf-49), czyli to samo źródło,
//                           z którego rysuje chipy lista presetów w module,
//    * co ustawia         → `rfCfgDescribe` (rf-49k), ten sam rejestr, co podgląd w module,
//    * wczytaj / usuń /
//      zmień nazwę        → wspólne działania z rf-49a, czyli te same okna z tą samą treścią,
//    * pobierz / wczytaj
//      zestaw             → `_rflDownload` / `_rflLoad` z rf-39i, bez zmian.
//
//  ZESTAW NIE MA MODUŁU. Jest migawką całej aplikacji, więc zamiast „kto go nosi" mówi, CO WYMIENI
//  po wczytaniu (sekcje z pliku) i — gdy jest paczką na kilka kapsli — na ile kapsli wchodzi.
//
//  Ładowany PO rf-39i-library.js (czyta jej `_rflData`, `_rflSel` i woła jej funkcje).
// ==================================================================================================

const RF_LIBDET_I18N = {
  "Wybierz coś z listy": "Pick something from the list",
  "Tej pozycji już nie ma w bibliotece.": "This entry is no longer in the library.",
  "Kto to nosi": "Who carries it",
  "Co ustawia": "What it sets",
  "włączone u autora": "on at the author's",
  "Aktywuj od razu po wczytaniu": "Switch it on right after loading",
  "Jak tego używać": "How to use it",
  "Otwórz w module": "Open in",
  "Wczytaj na": "Load onto",
  "Wczytaj zestaw": "Load the setup",
  "Pobierz": "Download",
  "Zmień nazwę": "Rename",
  "Usuń": "Delete",
  "fabryczny": "from the app",
  "w aplikacji": "built in",
  "bez opisu": "no description",
  "nie nosi go żaden kapsel": "no capsule carries it",
  "Nosi go:": "Carried by:",
  "nosi tę konfigurację teraz": "carries this configuration right now",
  "Zestaw na kilka kapsli. Role kapsli wybierzesz przy wczytywaniu.":
    "A multi-capsule setup. You choose the capsule roles while loading it.",
  "To jest opis. Suwaki i listy tej konfiguracji stoją w module": "This is a description. This configuration's sliders and lists live in",
  "i tylko tam się je rusza, żeby te same ustawienia nie miały dwóch edytorów.":
    "and that is the only place they move, so the same settings never get two editors.",
  "Tego pliku nie da się odczytać. Zostaje usunięcie.": "This file will not parse. Deleting it is all that is left.",
};
try { Object.assign(I18N_EN, RF_LIBDET_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

function _ldT(pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; }
function _ldEl(tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}
function _ldHuman(n) { n.setAttribute("data-noi18n", ""); return n; }
function _ldBtn(label, cls, fn, title) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "btn sm" + (cls ? " " + cls : "");
  b.textContent = label;
  if (title) b.title = title;
  b.addEventListener("click", fn);
  return b;
}
function _ldSec(host, txt) { host.appendChild(_ldEl("div", "lib-sec", txt)); }
// Pełny opis prosto z pliku — tylko wtedy, gdy indeks mógł go uciąć. Żeton pilnuje, żeby wolna
// odpowiedź nie wpadła do panelu, który opisuje już inną pozycję.
let _ldDescTok = 0;
function _ldFullDesc(kind, name, node) {
  const tok = ++_ldDescTok;
  fetch("/library/item?kind=" + encodeURIComponent(kind) + "&name=" + encodeURIComponent(name))
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (tok !== _ldDescTok || !node.isConnected) return;
      const d = res && res.item;
      if (!d) return;
      const full = String((d.description || d.desc) || "");
      if (full.length > (node.textContent || "").length) node.textContent = full;
    })
    .catch(function () { /* the truncated text is still there and still readable */ });
}

// Pozycja, którą trzeba opisać — z tej samej listy, z której narysowano wiersz. `null` znaczy, że
// pliku już nie ma (ktoś go przed chwilą skasował), i to też jest odpowiedź.
function _ldItem() {
  if (!_rflSel || !_rflData) return null;
  const arr = _rflData[_rflSel.kind] || [];
  return arr.find(function (x) { return x.name === _rflSel.name; }) || null;
}

function _ldBlank(host, msg) {
  const box = _ldEl("div", "lib-blank");
  const ic = _ldEl("span", "rfic lib-blank-ic tab-ic-vault");
  ic.setAttribute("aria-hidden", "true");
  box.appendChild(ic);
  box.appendChild(_ldEl("h3", null, _ldT("Wybierz coś z listy", "Pick something from the list")));
  box.appendChild(_ldEl("p", null, msg || _ldT(
    "Tu zobaczysz, co ustawia ta pozycja, kto ją nosi i skąd pochodzi.",
    "Here you will see what this entry sets, who carries it and where it comes from.")));
  host.appendChild(box);
}

// ------------------------------------------------------------------------------------------
//  RYSUNEK
// ------------------------------------------------------------------------------------------
function rfLibDetailRender() {
  const host = document.getElementById("libDetail");
  if (!host) return;
  host.textContent = "";
  if (!_rflSel) { _ldBlank(host); return; }
  const it = _ldItem();
  if (!it) {
    _rflSel = null;
    _ldBlank(host, _ldT("Tej pozycji już nie ma w bibliotece.", "This entry is no longer in the library."));
    return;
  }
  const kind = _rflSel.kind;
  const A = (typeof _rflAdapter === "function") ? _rflAdapter(kind) : null;
  let p = null;
  if (A && typeof A.findPreset === "function") { try { p = A.findPreset(it.name); } catch (e) { } }

  // — nagłówek
  const head = _ldEl("div", "lib-dh");
  head.appendChild(_rflModIcon(kind));
  const h = _ldHuman(_ldEl("h3", null, it.name));
  head.appendChild(h);
  const tag = _ldEl("span", "lib-modtag", _rflModLabel(kind));
  head.appendChild(tag);
  if (it.official) head.appendChild(_ldEl("span", "lib-chip own", _ldT("w aplikacji", "built in")));
  host.appendChild(head);
  const desc = it.description || it.desc;
  const dnode = _ldHuman(_ldEl("div", "lib-ddesc lib-dlong", desc || _ldT("bez opisu", "no description")));
  // ZESTAW TO KASETA (22.11, rf-28e): duża kaseta wybrana przez autora, a obok opis od twórcy.
  // Ten sam węzeł opisu, więc dociąganie pełnego tekstu niżej działa bez zmian.
  if (kind === "setup" && typeof rfKasetaHero === "function") host.appendChild(rfKasetaHero(it, dnode));
  else host.appendChild(dnode);
  // Indeks biblioteki przycina opis do 200 znaków (`_library_facts` w ribbitflip_monitor.py), bo
  // jest listą, a nie czytelnią. W panelu opisu to jedyna rzecz, którą się TU czyta, więc na ucięciu
  // w połowie słowa nie może się skończyć: dociągamy cały plik i podmieniamy tekst, gdy dojedzie.
  // Próg 200 nie jest zgadywaniem — dokładnie tam serwer tnie, więc krótszy opis jest już całym.
  if (desc && desc.length >= 200) _ldFullDesc(kind, it.name, dnode);

  // — JAK TEGO UŻYWAĆ: kroki, które autor zapisał w pliku (`howto` → `setup_about` w monitorze).
  //   Tutaj, a nie tylko w oknie importu: z tej szuflady zestaw wczytuje się jednym przyciskiem,
  //   więc instrukcja widoczna wyłącznie „przy imporcie z pliku" byłaby instrukcją, której przy
  //   wczytywaniu z Biblioteki nikt nigdy nie zobaczy. Stoi NAD przyciskami z premedytacją.
  if (Array.isArray(it.howto) && it.howto.length) {
    _ldSec(host, _ldT("Jak tego używać", "How to use it"));
    const ol = _ldEl("ol", "lib-howto");
    it.howto.forEach(function (s) {
      const t = String(s == null ? "" : s).trim();
      if (t) ol.appendChild(_ldHuman(_ldEl("li", null, t)));   // słowa autora — nie tłumaczymy
    });
    if (ol.childNodes.length) host.appendChild(ol);
  }

  // — pasek kontekstu: kto to nosi TERAZ (preset) albo co to w ogóle jest (zestaw)
  host.appendChild(_ldCtx(kind, it, A, p));

  // — akcje
  host.appendChild(_ldActs(kind, it, A, p));

  // — kto to nosi
  if (A) {
    const car = _rflCarriers(kind, it.name);
    if (car) { _ldSec(host, _ldT("Kto to nosi", "Who carries it")); host.appendChild(car); }
  }

  // — CO ROBI (22.11, rf-28e): reguły i ruch z treści pliku, zanim ktoś go wczyta. Nad listą
  //   sekcji, bo „co się stanie, kiedy ruszę kapslem" pada przed „co mi to podmieni".
  if (kind === "setup" && !it.broken && typeof rfKasetaCoRobi === "function") host.appendChild(rfKasetaCoRobi(it));

  // — co ustawia / co wymieni
  if (kind === "setup") _ldSetupInside(host, it);
  else if (p) {
    _ldSec(host, _ldT("Co ustawia", "What it sets"));
    host.appendChild(_ldSum(kind, p));
  }

  // — i gdzie się to zmienia
  if (kind !== "setup") {
    const note = _ldEl("div", "lib-note");
    note.appendChild(document.createTextNode(_ldT(
      "To jest opis. Suwaki i listy tej konfiguracji stoją w module",
      "This is a description. This configuration's sliders and lists live in") + " "));
    note.appendChild(_ldHuman(_ldEl("b", null, _rflModLabel(kind))));
    note.appendChild(document.createTextNode(" " + _ldT(
      "i tylko tam się je rusza, żeby te same ustawienia nie miały dwóch edytorów.",
      "and that is the only place they move, so the same settings never get two editors.")));
    host.appendChild(note);
  }
  try { if (typeof applyLang === "function") applyLang(host); } catch (e) { }
}

// Rodzaj do wymiany dla tej szuflady. Zestaw na kilka kapsli ma własny rodzaj i własny tag na
// forum, więc rozpoznajemy go po fladze z indeksu — te dwa pliki leżą w jednym katalogu i w jednej
// szufladzie, a wysyła się je inaczej.
function _ldShareKind(kind, it) {
  const R = (typeof RF_KINDS !== "undefined") ? RF_KINDS : (window.RF_KINDS || {});
  if (kind === "setup") return (it && it.bundle) ? "bundle" : "setup";
  for (const id in R) if (R[id].lib === kind && R[id].share) return R[id].shareId;
  return "";
}

// PASEK KONTEKSTU. Dla presetu odpowiada na pytanie, które pada przed każdą decyzją: czy to jest
// to, co mam teraz na kapslu. Dla zestawu mówi, czym zestaw jest — zdaniem, które i tak stoi już
// w opisie rodzaju, więc nie ma dwóch wersji tej samej informacji.
function _ldCtx(kind, it, A, p) {
  const box = _ldEl("div", "lib-ctx");
  if (it.broken) {
    box.classList.add("bad");
    box.textContent = _ldT("Tego pliku nie da się odczytać. Zostaje usunięcie.",
                           "This file will not parse. Deleting it is all that is left.");
    return box;
  }
  if (kind === "setup") {
    const t = RFL_EXPLAIN.setup;
    box.textContent = it.bundle
      ? _ldT("Zestaw na kilka kapsli. Role kapsli wybierzesz przy wczytywaniu.",
             "A multi-capsule setup. You choose the capsule roles while loading it.")
      : _gl(t[0], t[1]);
    return box;
  }
  if (!A) { box.textContent = _gl(RFL_EXPLAIN[kind] ? RFL_EXPLAIN[kind][0] : "", RFL_EXPLAIN[kind] ? RFL_EXPLAIN[kind][1] : ""); return box; }
  let who = [];
  try { who = rfCfgIdCarriers(A, it.name) || []; } catch (e) { }
  const cur = (typeof A.getDev === "function") ? A.getDev() : "";
  if (cur && who.indexOf(cur) >= 0) {
    box.classList.add("live");
    box.appendChild(document.createTextNode("✓ "));
    box.appendChild(_ldHuman(_ldEl("b", null, A.devName(cur))));
    box.appendChild(document.createTextNode(" " + _ldT("nosi tę konfigurację teraz", "carries this configuration right now")));
  } else if (who.length) {
    box.appendChild(_ldEl("span", null, _ldT("Nosi go:", "Carried by:")));
    box.appendChild(document.createTextNode(" "));
    box.appendChild(_ldHuman(_ldEl("b", null, who.map(A.devName).join(", "))));
  } else {
    box.textContent = _ldT("nie nosi go żaden kapsel", "no capsule carries it");
  }
  return box;
}

// AKCJE. Wczytanie presetu idzie przez ADAPTER modułu, a nie przez `/…/load` biblioteki — bo tylko
// ta droga nadaje kapslowi NAZWĘ, czyli robi to, co widać potem na chipach („chip się przenosi").
// Wczytanie przez samo `/load` podmieniłoby ustawienia i zostawiło kapsel z cudzą, nieaktualną
// nazwą albo bez żadnej. Zestaw nie ma adaptera i zostaje przy swojej drodze (`_rflLoad`), razem
// z migawką „Cofnij" i przeładowaniem panelu.
function _ldActs(kind, it, A, p) {
  const acts = _ldEl("div", "lib-dacts");
  const after = function () {
    if (typeof rfLibReload === "function") rfLibReload();
    if (typeof rfPresetCols !== "undefined" && rfPresetCols.paintAll) { try { rfPresetCols.paintAll(); } catch (e) { } }
  };
  if (!it.broken) {
    if (kind === "setup") {
      acts.appendChild(_ldBtn(_ldT("Wczytaj zestaw", "Load the setup"), "primary",
        function () { _rflLoad("setup", it.name, it); }));
      // „WŁĄCZ OD RAZU PO WCZYTANIU" — obok przycisku, bo decyzję podejmuje się w chwili wczytania.
      // To samo zapamiętane pole, które pokazuje okno importu (rf-29e); Biblioteka nic tu nie
      // zmienia, tylko czyta je przy „Wczytaj zestaw" (rf-39i). Tylko dla zestawu na jeden kapsel:
      // paczka na kilka kapsli i tak przechodzi przez okno importu, gdzie pole stoi przy liście ról.
      // Tylko gdy plik ma cokolwiek włączone — pole przy zestawie, który niczego nie włącza,
      // obiecywałoby coś, czego nie ma.
      if (!it.bundle && Array.isArray(it.wantsOn) && it.wantsOn.length && typeof rfArmPref === "function") {
        const lab = _ldEl("label", "lib-arm");
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.checked = rfArmPref();
        cb.addEventListener("change", function () { rfArmPrefSet(cb.checked); });
        lab.appendChild(cb);
        lab.appendChild(_ldEl("span", null, _ldT("Aktywuj od razu po wczytaniu", "Switch it on right after loading")));
        lab.title = _ldT("Włączy tylko to, co masz teraz wyłączone: ", "Switches on only what you have off now: ") +
                    it.wantsOn.map(_ldGroupName).join(", ");
        acts.appendChild(lab);
      }
    } else if (A && p) {
      const cur = (typeof A.getDev === "function") ? A.getDev() : "";
      let carried = false;
      try { carried = rfCfgIdKey(rfCfgIdState(A).name) === rfCfgIdKey(it.name); } catch (e) { }
      if (!carried && cur) {
        const b = _ldBtn("", "primary", function () { rfCfgIdAskLoad(A, p, after); });
        b.textContent = "";
        b.appendChild(_ldEl("span", null, _ldT("Wczytaj na", "Load onto")));
        b.appendChild(document.createTextNode(" "));
        b.appendChild(_ldHuman(_ldEl("span", null, A.devName(cur))));
        acts.appendChild(b);
      }
      // …i na dowolny inny kapsel. Ta sama lista, co w module — bez niej Biblioteka umiałaby
      // wczytać wyłącznie na ten kapsel, przy którym akurat stoisz.
      const others = (typeof A.applyPresetOn === "function" && typeof A.listOtherDevs === "function")
        ? (A.listOtherDevs() || []) : [];
      if (others.length) {
        const sel = document.createElement("select");
        sel.className = "rf-cfgpick lib-load";
        sel.title = _ldT("Wczytaj na", "Load onto") + "…";
        sel.setAttribute("aria-label", sel.title);
        const o0 = document.createElement("option");
        o0.value = ""; o0.textContent = _ldT("Wczytaj na", "Load onto") + "…";
        sel.appendChild(o0);
        others.forEach(function (d) {
          const o = document.createElement("option");
          o.value = d; o.textContent = A.devName(d); o.setAttribute("data-noi18n", "");
          sel.appendChild(o);
        });
        sel.onchange = function () {
          const d = sel.value; sel.value = "";
          if (d) rfCfgIdAskLoadOnto(A, d, p, after);
        };
        acts.appendChild(sel);
      }
      // OTWÓRZ W MODULE — jedyna droga do edycji. Skacze do zakładki I zaznacza tam ten preset,
      // bo człowiek kliknął konkretną pozycję, a nie „gdzieś w module".
      const m = RFL_MOD[kind];
      if (m && m.tab && typeof rfPresetCols !== "undefined" && rfPresetCols.open) {
        const b = _ldBtn("", "", function () {
          rfPresetCols.open(m.tab, it.name);
          // Moduł bez kolumny presetów (osie 3D siedzą zwykłą sekcją w Czujniku) nie ma czego
          // zaznaczyć, więc sam skok do zakładki zostawiłby człowieka na jej górze, a szukana
          // rzecz byłaby dwa ekrany niżej. `card` mówi, DO CZEGO w tej zakładce dojechać;
          // rozwijamy ją, jeśli jest zwinięta, bo inaczej dojazd kończy się na samym nagłówku.
          if (m.card) setTimeout(function () {
            const c = document.getElementById(m.card);
            if (!c) return;
            if (c.tagName === "DETAILS") c.open = true;
            try { c.scrollIntoView({ block: "nearest" }); } catch (e) { }
          }, 60);
        });
        b.textContent = "";
        b.appendChild(_ldEl("span", null, _ldT("Otwórz w module", "Open in")));
        b.appendChild(document.createTextNode(" "));
        b.appendChild(_ldHuman(_ldEl("span", null, _rflModLabel(kind))));
        acts.appendChild(b);
      }
    }
    acts.appendChild(_ldBtn(_ldT("Pobierz", "Download"), "", function () { _rflDownload(kind, it.name); },
      "Zapisz tę pozycję do pliku, nic u Ciebie nie ruszając"));
    // WYMIANA — bo do 2026-08-31 te dwie listy tych samych plików miały po połowie działań:
    // tutaj dało się pobrać i nie dało wysłać, a w module odwrotnie. Otwiera to samo okno, co
    // przycisk „Wymiana" w stopce listy modułu, z TĄ pozycją już wybraną — inaczej człowiek,
    // który kliknął konkretny preset, musiałby wskazać go drugi raz.
    const KS = _ldShareKind(kind, it);
    if (KS && typeof rfShareHubOpen === "function") {
      const b = _ldBtn(_ldT("Wymiana", "Exchange"), "", function () {
        try { rfShareHubOpen(KS, {opener: b, target: it.name}); } catch (e) { }
      }, "Podziel się na forum, zobacz cudze albo wczytaj od kogoś");
      b.setAttribute("aria-expanded", "false");
      acts.appendChild(b);
    }
  }
  // ZMIEŃ NAZWĘ — przez adapter, bo to on wie, jak zapisać plik z JEGO WŁASNĄ treścią i przenieść
  // nazwę na kapsle, które ją noszą. Zestaw i osie 3D takiej drogi nie mają, więc przycisku też nie:
  // przycisk, który nie ma jak zadziałać, uczy, że przyciski nic nie robią.
  if (A && p && typeof A.savePresetMeta === "function" && !it.official) {
    acts.appendChild(_ldBtn(_ldT("Zmień nazwę", "Rename"), "", function () {
      rfCfgIdEditMeta(A, { name: it.name, desc: (it.desc || ""), preset: p }, after);
    }));
  }
  // No Delete on a built-in one: it lives inside the app, so the button could only ever fail.
  if (!it.official) {
    // `danger` — ten sam znacznik, co przy „Usuń" w Bibliotece modułu (rf-49j3). Bez niego jedyna
    // nieodwracalna rzecz w tym rzędzie wyglądała dokładnie jak „Pobierz" obok niej.
    acts.appendChild(_ldBtn(_ldT("Usuń", "Delete"), "lib-del danger", function () {
      _rflDelete(kind, it.name);
      _rflSel = null;
    }));
  }
  return acts;
}

// CO USTAWIA — wspólny rejestr (rf-49k). Ten sam opis, co w podglądzie presetu w module.
function _ldSum(kind, p) {
  const m = RFL_MOD[kind];
  let d = { rows: [], rules: [] };
  try { d = rfCfgDescribe(m && m.key, p) || d; } catch (e) { }
  const box = _ldEl("div", "lib-sum");
  // RYSUNEK (rf-49k `art`) — przy skanerze plansze z obrysami sekcji, ten sam co w module.
  // Przy rysunku puste `rows` nie znaczą „preset pusty" — skaner mówi wszystko rysunkiem.
  let art = null;
  if (typeof d.art === "function") { try { art = d.art(); if (art) box.appendChild(art); } catch (e) { } }
  if (!d.rows.length && !d.rules.length && !art) {
    box.appendChild(_ldEl("div", "lib-ddesc", (typeof rfCfgDescribeEmptyText === "function")
      ? rfCfgDescribeEmptyText() : ""));
    return box;
  }
  d.rows.forEach(function (r) {
    const line = _ldEl("div", "lib-sumrow");
    line.appendChild(_ldEl("span", "lib-sk", r.k));
    line.appendChild(_ldHuman(_ldEl("span", "lib-sv", String(r.v))));
    box.appendChild(line);
  });
  if (d.rules.length) {
    const rb = _ldEl("div", "lib-rules");
    d.rules.slice(0, 24).forEach(function (r) {
      const chip = _ldEl("span", "lib-rule" + (r.off ? " off" : ""));
      chip.appendChild(_ldHuman(_ldEl("b", null, r.c)));
      chip.appendChild(_ldEl("span", "lib-rule-ar", "→"));
      chip.appendChild(_ldHuman(_ldEl("span", null, r.a)));
      rb.appendChild(chip);
    });
    if (d.rules.length > 24) {
      const n = d.rules.length - 24;
      rb.appendChild(_ldEl("span", "lib-rule more", _ldT("i jeszcze " + n, "and " + n + " more")));
    }
    box.appendChild(rb);
  }
  if (d.note) box.appendChild(_ldEl("div", "lib-ddesc", d.note));
  return box;
}

// ZESTAW — co ma w środku. Nie zawiera nazwanych presetów, tylko SEKCJE konfiguracji, więc tyle
// dokładnie mówi: które części aplikacji wymieni po wczytaniu, ile niesie reguł i (przy paczce)
// na ile kapsli wchodzi. Zmyślona lista „presetów w środku" byłaby tu wygodniejsza i nieprawdziwa.
// CO AUTOR MIAŁ WŁĄCZONE — z indeksu biblioteki (`wantsOn` / `wantsOnBy` liczone przez serwer
// z samego pliku). Paczka mówi to po ROLI („Toczenie: Mapowanie, Mysz i kontroler"), bo rola jest
// słowem autora; zestaw na jeden kapsel samą listą. Nazwy grup z rf-39j — te same, którymi mówi
// dymek po wczytaniu, więc opis i dymek nazywają rzeczy tak samo.
function _ldGroupName(k) {
  const n = (typeof rfGroupName === "function") ? rfGroupName(k) : "";
  return n || String(k || "");
}
function _ldWantsBy(it) {
  if (it.bundle) return Array.isArray(it.wantsOnBy) ? it.wantsOnBy.filter(function (x) { return x && (x.groups || []).length; }) : [];
  return (Array.isArray(it.wantsOn) && it.wantsOn.length) ? [{ name: "", groups: it.wantsOn }] : [];
}
function _ldSetupInside(host, it) {
  _ldSec(host, _ldT("Co podmieni po wczytaniu", "What it replaces when loaded"));
  const box = _ldEl("div", "lib-sum");
  // JEDEN WIERSZ = JEDNA SEKCJA, a szczegół stoi przy swojej sekcji. Liczba reguł należy do
  // „wyzwalaczy" i tylko tam ma sens; wiersz bez szczegółu niesie samą nazwę (klasa `one` zdejmuje
  // rezerwę na drugą kolumnę), bo pusta prawa połowa czytała się jak brakująca dana.
  const row = function (k, v) {
    const line = _ldEl("div", "lib-sumrow" + (v ? "" : " one"));
    line.appendChild(_ldEl("span", "lib-sk", k));
    if (v) line.appendChild(_ldEl("span", "lib-sv", v));
    box.appendChild(line);
  };
  const rulesTxt = (it.rules != null) ? _rflRules(it.rules) : "";
  let sawRules = false;
  (it.groups || []).forEach(function (k) {
    const v = _RFL_GROUP[k];
    if (!v) return;                       // `trigEnabled` i nieznane klucze nie są sekcją do pokazania
    if (k === "rules") sawRules = true;
    const sk = (k === "scan" && Array.isArray(it.scan) && it.scan.length && typeof rfScanFakty === "function")
      ? it.scan.map(rfScanFakty).join(" | ") : "";
    row(_gl(v[0], v[1]), k === "rules" ? rulesTxt : sk);
  });
  // Starszy plik potrafi podać liczbę reguł, nie wymieniając sekcji — wtedy reguły dostają wiersz.
  if (rulesTxt && !sawRules) row(_gl(_RFL_GROUP.rules[0], _RFL_GROUP.rules[1]), rulesTxt);
  if (it.bundle && it.deviceCount) row(_gl("kapsle", "capsules"), String(it.deviceCount));
  // …i które włączniki autor miał włączone: to odpowiada na „czemu po wczytaniu nic nie działa"
  // ZANIM ktoś wczyta. Sam wiersz niczego nie włącza; od tego jest pole przy przycisku.
  const wants = _ldWantsBy(it);
  if (wants.length) {
    const line = _ldEl("div", "lib-sumrow lib-wants");
    line.appendChild(_ldEl("span", "lib-sk", _ldT("włączone u autora", "on at the author's")));
    const v = _ldEl("span", "lib-sv");
    wants.forEach(function (x, i) {
      if (i) v.appendChild(document.createTextNode(" · "));
      if (x.name) { v.appendChild(_ldHuman(_ldEl("b", null, x.name))); v.appendChild(document.createTextNode(": ")); }
      (x.groups || []).forEach(function (g, j) {
        if (j) v.appendChild(document.createTextNode(", "));
        v.appendChild(_ldEl("span", null, _ldGroupName(g)));
      });
    });
    line.appendChild(v);
    box.appendChild(line);
  }
  const chips = _ldEl("div", "lib-chips");
  _rflChips("setup", it).forEach(function (c) {
    const s = _ldEl("span", "lib-chip" + (c.cls ? " " + c.cls : ""), c.t);
    s.setAttribute("data-noi18n", "");
    chips.appendChild(s);
  });
  box.appendChild(chips);
  host.appendChild(box);
  // SKANER W ZESTAWIE — to samo, co przy presecie skanera (rf-39i4): skrót, plansze z obrysami
  // i zwinięty komplet ustawień z tablicy pól karty. Pod spisem sekcji, bo mówi, GDZIE i JAK
  // zestaw będzie klikał, zanim ktoś go wczyta. Bez różnic: zestaw wymienia całość, nie poprawia.
  if (Array.isArray(it.scan) && it.scan.length && typeof rfScanPreview === "function") {
    _ldSec(host, _ldT("Skaner w tym zestawie", "The scanner in this setup"));
    it.scan.forEach(function (c) {
      if (typeof rfScanSkrot === "function") host.appendChild(rfScanSkrot(c));
      host.appendChild(rfScanPreview(c));
      // Ten sam podział na skanery, co w opisie presetu (rf-49k).
      if (typeof _cdScanWszystko === "function" && window.RFScan && typeof RFScan.opisz === "function")
        _cdScanWszystko(c).forEach(function (d) { host.appendChild(d); });
    });
  }
}

window.rfLibDetailRender = rfLibDetailRender;
