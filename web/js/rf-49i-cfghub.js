"use strict";
// ============================================================================
//  HUB KONFIGURACJI — biblioteka na kaflach, kapsle jako chipy
//
//  SKĄD TO SIĘ WZIĘŁO. Etapy 1-7 dały każdemu modułowi cienki pasek tożsamości (rf-49-cfgid):
//  „Konfiguracja: [lista] · zmienione · Zapisz zmiany / Zapisz jako… / Przywróć / Skopiuj na…".
//  Mechanika była dobra, kształt nie. Pasek był prosty, nieczytelny i ukryty,
//  nie był wyborem z biblioteki, a użytkownik nie wiedział, czy konfiguruje aktywny
//  preset z autozapisem, czy taki, który wymaga zapisu. Trzy rzeczy, których pasek nie umiał:
//
//    1. NIE BYŁ BIBLIOTEKĄ. Lista rozwijana pokazuje nazwy. Nazwa „Triki 2" nie mówi nic —
//       dopiero „Wolfenstein: kamera i strzelanie" mówi. Opis nie miał gdzie zamieszkać.
//    2. NIE POKAZYWAŁ, KTO CO NOSI. „Które kapsle mają to samo" było pytaniem, na które pasek
//       odpowiadał dopiero w oknie potwierdzenia nadpisania — czyli po decyzji, nie przed nią.
//    3. NIE MÓWIŁ, CO ZNACZY ZAPIS. Zmiany działają NA KAPSLU od razu, ale w BIBLIOTECE dopiero
//       po „Zapisz zmiany". Pasek pokazywał słowo „zmienione" i zostawiał to do domyślenia.
//
//  WZORZEC INTERAKCJI JEST JUŻ W APLIKACJI i użytkownik go zna: pas padów w zakładce Kontroler
//  (rf-44). Tam kafel = kontroler, chip = kapsel, który na nim gra; przeciąganie chipa między
//  kaflami, tacka dla nieprzypiętych, kafel „+" na końcu, i przy każdym geście myszy równorzędna
//  ścieżka przez listę rozwijaną, bo przeciąganie jest gestem wyłącznie mysim. Tutaj role są
//  ODWRÓCONE: kafel = nazwana konfiguracja z biblioteki, chip = kapsel, który ją nosi. Poza tym
//  język jest ten sam, celowo — druga składnia dla tego samego gestu to drugi zestaw do nauczenia.
//
//  CO TEN PLIK MA, A PASEK NIE MIAŁ:
//    * OPIS na kaflu (serwer: `desc` w kopercie presetu, limit z serwera przez GET /profiles),
//    * CHIPY kapsli na kaflu, z kropką „zmienione" przy każdym z osobna — także przy cudzych,
//    * ZDANIE STATUSOWE pod kaflami, które wykłada model zapisu wprost, zamiast liczyć na to,
//      że słowo „zmienione" samo się wytłumaczy,
//    * KAFEL-DUCH dla nazwy, której nie ma już w bibliotece: kapsel nadal ją nosi, więc musi mieć
//      gdzie stać. Ukrycie go zamieniłoby „usunąłem preset" w „kapsel zgubił konfigurację".
//
//  CZEGO TEN PLIK NIE ROBI: nie liczy sam stanu {name, known, dirty}. To robi `rfCfgIdState`
//  w rf-49 — jedna implementacja dla paska i dla huba, bo dwie rozjechałyby się CICHO (obie
//  zwracają wiarygodnie wyglądający obiekt).
//
//  I zasada, która trzyma to razem tak samo jak pasek: KONFIGURACJA NIE NIESIE PRZEŁĄCZNIKÓW.
//  Uzbrojenie wyjścia to decyzja o tym kapslu w tej chwili, podejmowana przy przełączniku.
//
//  Ładowany PO rf-49 (używa jego rfCfgIdState / rfCfgIdCarriers) i po adapterze modułu.
// ============================================================================

const RF_CFGHUB_I18N = {
  "Konfiguracje wyzwalaczy": "Trigger configurations",
  "Kapsle bez nazwanej konfiguracji": "Capsules with no named configuration",
  "wszystkie kapsle noszą nazwaną konfigurację": "every capsule carries a named configuration",
  "przeciągnij tu kapsel, żeby zdjąć samą nazwę": "drag a capsule here to take just the name off",
  "bez nazwy": "no name",
  "bez opisu": "no description",
  "Wczytaj na…": "Load onto…",
  "Wczytaj tę konfigurację na wybrany kapsel": "Load this configuration onto a capsule",
  "Zmień nazwę i opis": "Change the name and the description",
  "Usuń tę konfigurację z biblioteki": "Remove this configuration from the library",
  "Zapisz obecne jako preset…": "Save the current one as a preset…",
  "Nazwana konfiguracja daje się przenieść na inny kapsel i wraca po eksperymentach.":
    "A named configuration can be moved onto another capsule, and it comes back after you experiment.",
  "Nazwa i opis konfiguracji": "The configuration's name and description",
  "Zapisz jako nowy preset": "Save as a new preset",
  "Nazwa": "Name",
  "Opis": "Description",
  "Zapisz": "Save",
  "Anuluj": "Cancel",
  "Usuń": "Delete",
  "Wczytaj": "Load",
  "Przywróć": "Revert",
  "Zapisz z powrotem…": "Save it back…",
  "Zwiń sekcję": "Collapse this section",
  "Rozwiń sekcję": "Expand this section",
  "tej konfiguracji nie ma już na liście": "this configuration is no longer on the list",
  "Kapsel nosi tę konfigurację. Przeciągnij go na inny kafel, żeby wczytać tamtą.":
    "This capsule carries this configuration. Drag it onto another tile to load that one.",
  "Kapsel bez nazwanej konfiguracji. Przeciągnij go na kafel, żeby wczytać tamtą konfigurację.":
    "A capsule with no named configuration. Drag it onto a tile to load that one.",
  "Zdejmij samą nazwę (ustawienia zostają)": "Take just the name off (the settings stay)",
  "wczytaj konfigurację…": "load a configuration…",
  "Wczytaj konfigurację na ten kapsel": "Load a configuration onto this capsule",
};
try { Object.assign(I18N_EN, RF_CFGHUB_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

function _cfhT(pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; }
function _cfhEsc(s) { return (typeof esc === "function") ? esc(s) : String(s == null ? "" : s); }
function _cfhSay(msg, bad) {
  try { rfToast(msg, bad ? { tone: "danger" } : { tone: "ok" }); } catch (e) { /* bez panelu */ }
}
// Pytanie z treścią zamiast „na pewno?" — ta sama droga, co w pasku (rf-49): wspólne dialogi rf-06.
function _cfhAsk(title, message, okLabel, tone) {
  return rfConfirm(message, { title: title, confirmLabel: okLabel, tone: tone || "",
                              cancelLabel: _cfhT("Anuluj", "Cancel") });
}
// KOLOR KAPSLA — ten sam, którym pas padów maluje swoje chipy i pierścienie na rysunku pada.
// Czytany z rf-44 przez `typeof`, a nie importowany: hub jest komponentem współdzielonym i musi
// się złożyć także tam, gdzie zakładki Kontroler nie ma (okno nakładki, harness w `vm`).
function _cfhDevColor(A, dev) {
  if (typeof A.devColor === "function") { try { return A.devColor(dev) || ""; } catch (e) { /* */ } }
  if (typeof padCapColor === "function") { try { return padCapColor(dev) || ""; } catch (e) { /* */ } }
  return "";
}
function _cfhDevImg(A, dev, px) {
  if (typeof A.devImg === "function") { try { return A.devImg(dev, px) || ""; } catch (e) { /* */ } }
  if (typeof capImgSpan === "function") { try { return capImgSpan(dev, px) || ""; } catch (e) { /* */ } }
  return "";
}
// Kawałek id, który da się wpisać do atrybutu. Służy WYŁĄCZNIE do przywracania ogniska po
// przerysowaniu — kolizja dwóch podobnych nazw kosztuje najwyżej to, że ognisko wróci na sąsiedni
// przycisk, więc nie ma tu po co budować niczego mądrzejszego.
function _cfhSlug(s) { return String(s || "").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40); }

// ------------------------------------------------------------------------------------------
//  KOMPONENT
// ------------------------------------------------------------------------------------------
//  rfCfgHubCreate(adapter) -> { hubHtml(), wire(), sync() }
//
//  Adapter ROZSZERZA ten z rf-49 (fingerprint, listPresets, applyPreset, saveAs, overwrite,
//  describe*) o to, czego pasek nie potrzebował, bo pytał wyłącznie o bieżący kapsel:
//
//    hubTitle                     tytuł sekcji (np. „Konfiguracje wyzwalaczy")
//    exchangeBtnId exchangeLabel exchangeTitle   przycisk „Wymiana" w nagłówku; bez id — bez guzika
//    listAllDevs()                WSZYSTKIE kapsle, z bieżącym włącznie, w stałej kolejności
//    devColor(dev) devImg(dev,px) opcjonalne; bez nich hub bierze kolor i miniaturę z rf-44/rf-03
//    fingerprintOf(dev)           odcisk WSKAZANEGO kapsla; `null` = jeszcze nie wiadomo (milczymy)
//    describeDev(dev)             „8 wyzwalaczy" o wskazanym kapslu; "" = nie wiadomo
//    presetDesc(p) presetMetric(p)  opis i metryka kafla
//    descMax()                    limit długości opisu (z serwera)
//    canSaveCurrent()             {ok, why} — czy jest co zapisać jako nową konfigurację
//    setCfgNameOn(dev,name,done)  nazwa NA WSKAZANYM kapslu
//    applyPresetOn(dev,p,done)    wczytanie presetu na WSKAZANY kapsel
//    savePresetMeta(p,name,desc,done)  nadpisanie presetu JEGO WŁASNYMI regułami + nowa nazwa/opis
//    deletePreset(name,done) reloadPresets(selName)
//    describeUnname()             zdanie „co zostaje", gdy zdejmujemy samą nazwę
function rfCfgHubCreate(adapter) {
  const A = adapter || {};
  const P = A.idPrefix || "cfg";
  const id = (suffix) => P + "CfgHub" + suffix;
  const $ = (suffix) => document.getElementById(id(suffix));
  const FOLD_KEY = "ribbitflip.cfghub." + P;
  let _drag = null;              // kapsel niesiony w tej chwili (chip w locie)

  // ------------------------------------------------------------------------------------------
  //  MODEL — jedna odpowiedź dla rysunku, dla streszczenia i dla porównania „czy coś się zmieniło"
  // ------------------------------------------------------------------------------------------
  function devs() { return (typeof A.listAllDevs === "function" ? (A.listAllDevs() || []) : []); }
  function descMax() { return (typeof A.descMax === "function" ? (A.descMax() || 200) : 200); }
  function foldedNow() {
    // DOMYŚLNIE ROZWINIĘTY. Sekcja, która wita zwinięta, jest sekcją, której nikt nie znajdzie —
    // a to jest dokładnie ta wada, przez którą poprzedni kształt został odrzucony.
    try { return localStorage.getItem(FOLD_KEY) === "1"; } catch (e) { return false; }
  }
  function setFolded(v) {
    try { localStorage.setItem(FOLD_KEY, v ? "1" : "0"); } catch (e) { /* prywatny tryb */ }
  }

  function model() {
    const cur = A.getDev();
    const list = devs();
    const st = {};
    list.forEach(d => { st[d] = rfCfgIdState(A, d); });
    const chip = (d) => ({ dev: d, label: A.devName(d), color: _cfhDevColor(A, d),
                           active: d === cur, dirty: !!st[d].dirty });
    const tiles = (A.listPresets() || []).map(p => {
      const key = String(p.name || "").trim().toLowerCase();
      return {
        name: String(p.name || ""), preset: p, gone: false,
        desc: String((typeof A.presetDesc === "function" ? A.presetDesc(p) : "") || ""),
        // Opis zastępczy (rf-50j `presetAutoDesc`) tylko do pokazania — `desc` idzie do okna edycji.
        auto: String((typeof A.presetAutoDesc === "function" ? A.presetAutoDesc(p) : "") || ""),
        metric: String((typeof A.presetMetric === "function" ? A.presetMetric(p) : "") || ""),
        chips: list.filter(d => st[d].known && st[d].name.toLowerCase() === key).map(chip)
      };
    });
    // KAFLE-DUCHY. Kapsel nosi nazwę, której w bibliotece już nie ma — bo ktoś skasował preset,
    // albo przyszedł zestaw z cudzą nazwą. Ustawienia SĄ na kapslu, więc ukrycie tego stanu
    // czytałoby się jako „konfiguracja zniknęła z kapsla", a to nieprawda: zniknęła z listy.
    const ghost = {};
    list.forEach(d => {
      const s = st[d];
      if (!s.name || s.known) return;
      const k = s.name.toLowerCase();
      if (!ghost[k]) ghost[k] = { name: s.name, preset: null, gone: true, desc: "", metric: "", chips: [] };
      ghost[k].chips.push(chip(d));
    });
    Object.keys(ghost).sort().forEach(k => tiles.push(ghost[k]));

    const s = st[cur] || { name: "", known: false, dirty: false };
    return {
      cur: cur, curName: cur ? A.devName(cur) : "",
      tiles: tiles,
      tray: list.filter(d => !st[d].name).map(chip),
      status: { name: s.name, known: s.known, dirty: s.dirty },
      summary: list.map(d => {
        const x = st[d];
        const what = !x.name ? _cfhT("bez nazwy", "no name")
          : x.name + (x.dirty ? " (" + _cfhT("zmienione", "changed") + ")"
            : (x.known ? "" : " (" + _cfhT("tej konfiguracji nie ma już na liście",
                                           "this configuration is no longer on the list") + ")"));
        return A.devName(d) + ": " + what;
      }).join(" · "),
      canAdd: (typeof A.canSaveCurrent === "function") ? A.canSaveCurrent() : { ok: true, why: "" },
      folded: foldedNow()
    };
  }

  // ------------------------------------------------------------------------------------------
  //  SZKIELET
  // ------------------------------------------------------------------------------------------
  function hubHtml() {
    const title = _cfhEsc(A.hubTitle || "Konfiguracje");
    const ex = A.exchangeBtnId
      ? '<button class="btn sm cfh-exchange" id="' + _cfhEsc(A.exchangeBtnId) + '"' +
        ' aria-haspopup="dialog" aria-expanded="false" title="' +
        _cfhEsc(A.exchangeTitle || "Podziel się na forum, zobacz cudze albo wczytaj od kogoś") + '">' +
        '<span class="bic bic-swap" aria-hidden="true"></span>' +
        _cfhEsc(A.exchangeLabel || "Wymiana") + '</button>'
      : "";
    return `<section class="cfh" id="${id("")}">
      <div class="cfh-h">
        <span class="cfh-title"><span class="rfic prof-ic" aria-hidden="true"></span>${title}</span>
        <span class="cfh-sum" id="${id("Sum")}"></span>
        ${ex}
        <button type="button" class="cfh-fold" id="${id("Fold")}"
          aria-expanded="true" aria-controls="${id("Body")}"
          title="Zwiń sekcję"><span class="cfh-caret" aria-hidden="true">▾</span></button>
      </div>
      <div class="cfh-body" id="${id("Body")}">
        <div class="cfh-free" id="${id("Free")}"></div>
        <div class="cfh-tiles" id="${id("Tiles")}"></div>
        <div class="cfh-status" id="${id("Status")}"></div>
      </div>
    </section>`;
  }

  // ------------------------------------------------------------------------------------------
  //  RYSUNEK
  // ------------------------------------------------------------------------------------------
  // ODŚWIEŻENIE. Wołane po KAŻDEJ zmianie listy reguł — czyli przy każdym naciśnięciu klawisza
  // w edytorze wyzwalacza — więc pierwsze, co robi, to sprawdza, czy w ogóle jest co przerysować.
  // To nie jest optymalizacja, tylko warunek używalności: przerysowanie zabiera ognisko z listy
  // rozwijanej, w której ktoś właśnie stoi, i zamyka ją w połowie wyboru. Gdy jednak przerysować
  // trzeba, ognisko wraca po `id` — dlatego każdy element, który może je trzymać, ma stałe id.
  function sync() {
    const host = $(""); if (!host) return;
    const m = model();
    const sig = JSON.stringify([m.cur, m.folded, m.summary, m.canAdd, m.status,
      m.tray.map(c => [c.dev, c.label, c.color, c.active]),
      m.tiles.map(t => [t.name, t.desc, t.auto, t.metric, t.gone,
                        t.chips.map(c => [c.dev, c.label, c.color, c.active, c.dirty])])]);
    if (host._sig === sig) return;
    const ae = document.activeElement;
    const keep = (ae && ae.id && host.contains(ae)) ? ae.id : "";

    host.classList.toggle("is-folded", m.folded);
    const body = $("Body"); if (body) body.hidden = m.folded;
    const fold = $("Fold");
    if (fold) {
      fold.setAttribute("aria-expanded", m.folded ? "false" : "true");
      fold.title = m.folded ? _cfhT("Rozwiń sekcję", "Expand this section")
                            : _cfhT("Zwiń sekcję", "Collapse this section");
    }
    // Streszczenie widać TYLKO po zwinięciu, i to jest cały powód, dla którego istnieje: zwinięta
    // sekcja też ma odpowiadać na pytanie „kto co nosi", inaczej zwijanie znaczy „schowaj prawdę".
    const sum = $("Sum");
    if (sum) { sum.textContent = m.folded ? m.summary : ""; sum.hidden = !m.folded; }

    _paintTray(m);
    _paintTiles(m);
    _paintStatus(m);
    // Odcisk zapisujemy PO przerysowaniu: gdyby rysowanie wybuchło w połowie, sekcja zostałaby
    // niedorysowana i jednocześnie oznaczona jako aktualna, więc kolejne wywołania nic by nie
    // naprawiły. Tak najgorsze, co się dzieje, to jedna próba więcej.
    host._sig = sig;
    if (keep) { const el = document.getElementById(keep); if (el && el.focus) try { el.focus(); } catch (e) { /* */ } }
  }

  // TACKA — kapsle, które nie noszą żadnej nazwy. Widoczna ZAWSZE, tak jak tacka pasa padów
  // (rf-44) i z tego samego powodu: pusty cel upuszczenia, który widać, jest jedyną rzeczą, dzięki
  // której ten gest da się w ogóle odkryć — a jej jedno zdanie to jedyne miejsce, gdzie aplikacja
  // mówi na głos, że konfiguracja BEZ nazwy jest zupełnie normalna.
  function _paintTray(m) {
    const box = $("Free"); if (!box) return;
    box.innerHTML = "";
    box.classList.toggle("empty", !m.tray.length);
    const lab = document.createElement("span"); lab.className = "cfh-free-lab";
    lab.textContent = m.tray.length
      ? _cfhT("Kapsle bez nazwanej konfiguracji", "Capsules with no named configuration")
      : _cfhT("wszystkie kapsle noszą nazwaną konfigurację", "every capsule carries a named configuration");
    box.appendChild(lab);
    if (!m.tray.length) {
      const hint = document.createElement("span"); hint.className = "cfh-free-hint";
      hint.textContent = _cfhT("przeciągnij tu kapsel, żeby zdjąć samą nazwę",
                               "drag a capsule here to take just the name off");
      box.appendChild(hint);
    } else m.tray.forEach(c => box.appendChild(_trayChip(c, m)));
    if (box._wired) return;
    box._wired = true;
    box.addEventListener("dragover", e => {
      if (!_drag) return;
      if (!rfCfgIdState(A, _drag).name) return;            // już tu jest — nie ma czego zdejmować
      e.preventDefault(); e.dataTransfer.dropEffect = "move"; box.classList.add("drop");
    });
    box.addEventListener("dragleave", () => box.classList.remove("drop"));
    box.addEventListener("drop", e => {
      box.classList.remove("drop");
      const dev = (e.dataTransfer && e.dataTransfer.getData("text/plain")) || _drag;
      if (!dev) return;
      e.preventDefault();
      stripName(dev);
    });
  }

  // Chip na tacce. Ten sam kapsel, ten sam kolor, co na kaflu — z listą odwróconą: zamiast „którą
  // konfigurację nosisz" pyta „którą chcesz", i startuje na pozycji-zaślepce, żeby samo otwarcie
  // niczego nie zmieniało.
  function _trayChip(c, m) {
    const chip = _chipBase(c);
    const tiles = m.tiles.filter(t => !t.gone);
    if (tiles.length) {
      const sel = document.createElement("select");
      sel.className = "cfh-pick"; sel.id = id("TrayPick_" + _cfhSlug(c.dev));
      sel.title = _cfhT("Wczytaj konfigurację na ten kapsel", "Load a configuration onto this capsule");
      sel.setAttribute("aria-label", sel.title + ": " + c.label);
      sel.innerHTML = '<option value="">' + _cfhEsc(_cfhT("wczytaj konfigurację…", "load a configuration…")) + "</option>" +
        tiles.map(t => '<option value="' + _cfhEsc(t.name) + '">' + _cfhEsc(t.name) + "</option>").join("");
      sel.value = "";
      sel.onclick = e => e.stopPropagation();
      sel.onchange = () => {
        const t = tiles.find(x => x.name === sel.value); sel.value = "";
        if (t) askLoadOnto(c.dev, t.preset);
      };
      chip.appendChild(sel);
    }
    chip.title = _cfhT("Kapsel bez nazwanej konfiguracji. Przeciągnij go na kafel, żeby wczytać tamtą konfigurację.",
                       "A capsule with no named configuration. Drag it onto a tile to load that one.");
    return chip;
  }

  // Wspólna część każdego chipa: kolor kapsla na lewej krawędzi (ten sam, co pierścienie na
  // rysunku pada), miniatura, nazwa, i to, że da się go złapać i przenieść.
  function _chipBase(c) {
    const chip = document.createElement("div");
    chip.className = "cfh-chip" + (c.active ? " active" : "");
    chip.dataset.dev = c.dev;
    if (c.color) chip.style.setProperty("--dcol", c.color);
    chip.setAttribute("role", "group");
    chip.setAttribute("aria-label", c.label);
    chip.innerHTML = _cfhDevImg(A, c.dev, 18) + "<b>" + _cfhEsc(c.label) + "</b>";
    chip.draggable = true;
    chip.addEventListener("dragstart", e => {
      _drag = c.dev; chip.classList.add("dragging");
      try { e.dataTransfer.setData("text/plain", c.dev); e.dataTransfer.effectAllowed = "move"; } catch (_) { /* */ }
    });
    chip.addEventListener("dragend", () => {
      _drag = null; chip.classList.remove("dragging");
      document.querySelectorAll(".cfh-tile.drop,.cfh-free.drop").forEach(n => n.classList.remove("drop"));
    });
    // Klik na chipie przełącza edycję na ten kapsel: chip JEST kapslem, więc kliknięcie go ma
    // znaczyć to samo, co wszędzie indziej w aplikacji.
    chip.onclick = e => {
      if (e.target && e.target.closest && e.target.closest("select,button")) return;
      e.stopPropagation();
      if (typeof switchDevice === "function" && c.dev !== A.getDev()) switchDevice(c.dev);
    };
    return chip;
  }

  // Chip NA KAFLU: ten kapsel nosi tę konfigurację. Dokłada dwie rzeczy, których tacka nie ma —
  // kropkę „zmienione" (per kapsel, także cudzy) i ✕, które zdejmuje samą nazwę.
  function _tileChip(c) {
    const chip = _chipBase(c);
    chip.title = _cfhT("Kapsel nosi tę konfigurację. Przeciągnij go na inny kafel, żeby wczytać tamtą.",
                       "This capsule carries this configuration. Drag it onto another tile to load that one.");
    if (c.dirty) {
      // KROPKA, nie słowo. Chipów na kaflu bywa kilka, a „zmienione" przy każdym z nich zamieniłoby
      // kafel w akapit. Znaczenie stoi w tytule i w zdaniu statusowym pod kaflami.
      const dot = document.createElement("span");
      dot.className = "cfh-dot"; dot.setAttribute("role", "img");
      dot.title = _cfhT("zmienione", "changed");
      dot.setAttribute("aria-label", c.label + ": " + dot.title);
      chip.appendChild(dot);
    }
    const off = document.createElement("button");
    off.type = "button"; off.className = "cfh-chip-off"; off.id = id("Off_" + _cfhSlug(c.dev));
    off.innerHTML = '<span aria-hidden="true">✕</span>';
    off.title = _cfhT("Zdejmij samą nazwę (ustawienia zostają)", "Take just the name off (the settings stay)");
    off.setAttribute("aria-label", off.title + ": " + c.label);
    off.onclick = e => { e.stopPropagation(); stripName(c.dev); };
    chip.appendChild(off);
    return chip;
  }

  function _paintTiles(m) {
    const box = $("Tiles"); if (!box) return;
    box.innerHTML = "";
    m.tiles.forEach(t => box.appendChild(t.gone ? _ghostTile(t) : _tile(t)));
    box.appendChild(_addTile(m));
  }

  function _tile(t) {
    const el = document.createElement("div");
    el.className = "cfh-tile"; el.dataset.name = t.name;
    // Kafel jest grupą, nie przyciskiem: kliknięcie go samo w sobie nic nie znaczy (wczytanie ZAWSZE
    // potrzebuje celu). Etykieta niesie to, czego czytnik ekranu nie zbierze z porozrzucanych
    // węzłów — nazwę, ile w niej jest i po co jest.
    el.setAttribute("role", "group");
    const opis = t.desc || t.auto || "";
    el.setAttribute("aria-label", t.name + (t.metric ? (", " + t.metric) : "") + (opis ? (". " + opis) : ""));
    const head = document.createElement("div"); head.className = "cfh-t-h";
    const nm = document.createElement("b"); nm.className = "cfh-t-name"; nm.textContent = t.name;
    head.appendChild(nm);
    if (t.metric) {
      const me = document.createElement("span"); me.className = "cfh-t-metric"; me.textContent = t.metric;
      head.appendChild(me);
    }
    const tools = document.createElement("div"); tools.className = "cfh-t-tools";
    const ren = document.createElement("button");
    ren.type = "button"; ren.className = "cfh-tool"; ren.id = id("Ren_" + _cfhSlug(t.name));
    ren.innerHTML = '<span aria-hidden="true">✎</span>';
    ren.title = _cfhT("Zmień nazwę i opis", "Change the name and the description");
    ren.setAttribute("aria-label", ren.title + ": " + t.name);
    ren.onclick = e => { e.stopPropagation(); editTile(t); };
    tools.appendChild(ren);
    const del = document.createElement("button");
    del.type = "button"; del.className = "cfh-tool danger"; del.id = id("Del_" + _cfhSlug(t.name));
    del.innerHTML = '<span aria-hidden="true">✕</span>';
    del.title = _cfhT("Usuń tę konfigurację z biblioteki", "Remove this configuration from the library");
    del.setAttribute("aria-label", del.title + ": " + t.name);
    del.onclick = e => { e.stopPropagation(); delTile(t); };
    tools.appendChild(del);
    head.appendChild(tools);
    el.appendChild(head);

    // OPIS — to on odróżnia dwa kafle od siebie. Przycięty do trzech linijek, w całości w tytule:
    // kafel ma się dać przeczytać wzrokiem, a pełne zdanie ma być osiągalne bez otwierania okna.
    const d = document.createElement("div");
    d.className = "cfh-t-desc" + (t.desc ? "" : (t.auto ? " auto" : " none"));
    d.textContent = opis || _cfhT("bez opisu", "no description");
    if (opis) d.title = opis;
    if (!t.desc && t.auto) d.setAttribute("data-noi18n", "");   // zdanie złożone już w bieżącym języku
    el.appendChild(d);

    const chips = document.createElement("div"); chips.className = "cfh-t-chips";
    t.chips.forEach(c => chips.appendChild(_tileChip(c)));
    el.appendChild(chips);

    // RÓWNORZĘDNA ŚCIEŻKA BEZ PRZECIĄGANIA. Przeciąganie jest gestem wyłącznie mysim — bez tej
    // listy klawiatura i czytnik ekranu nie mają jak wczytać konfiguracji na kapsel w ogóle.
    const others = devs();
    if (others.length) {
      const sel = document.createElement("select");
      sel.className = "cfh-pick cfh-t-load"; sel.id = id("Load_" + _cfhSlug(t.name));
      sel.title = _cfhT("Wczytaj tę konfigurację na wybrany kapsel", "Load this configuration onto a capsule");
      sel.setAttribute("aria-label", sel.title + ": " + t.name);
      sel.innerHTML = '<option value="">' + _cfhEsc(_cfhT("Wczytaj na…", "Load onto…")) + "</option>" +
        others.map(dv => '<option value="' + _cfhEsc(dv) + '">' + _cfhEsc(A.devName(dv)) + "</option>").join("");
      sel.value = "";
      sel.onclick = e => e.stopPropagation();
      sel.onchange = () => { const dv = sel.value; sel.value = ""; if (dv) askLoadOnto(dv, t.preset); };
      el.appendChild(sel);
    }

    el.addEventListener("dragover", e => {
      if (!_drag) return;
      e.preventDefault(); e.dataTransfer.dropEffect = "copy"; el.classList.add("drop");
    });
    el.addEventListener("dragleave", () => el.classList.remove("drop"));
    el.addEventListener("drop", e => {
      el.classList.remove("drop");
      const dev = (e.dataTransfer && e.dataTransfer.getData("text/plain")) || _drag;
      if (!dev) return;
      e.preventDefault();
      // Upuszczenie kapsla na kafel, który już nosi — nie pytamy o zgodę na nic, bo nic się nie dzieje.
      if (rfCfgIdState(A, dev).name.toLowerCase() === t.name.toLowerCase()) return;
      askLoadOnto(dev, t.preset);
    });
    return el;
  }

  // KAFEL-DUCH: nazwa, którą kapsel nosi, a której nie ma już w bibliotece. Nie da się jej wczytać
  // (nie ma czego), więc nie jest celem upuszczenia i nie ma listy „Wczytaj na…". Ma za to jedyne
  // wyjście, jakie tu istnieje: zapisać z powrotem to, co kapsel wciąż ma na sobie.
  function _ghostTile(t) {
    const el = document.createElement("div");
    el.className = "cfh-tile is-gone"; el.dataset.name = t.name;
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", t.name + ". " +
      _cfhT("tej konfiguracji nie ma już na liście", "this configuration is no longer on the list"));
    const head = document.createElement("div"); head.className = "cfh-t-h";
    const nm = document.createElement("b"); nm.className = "cfh-t-name"; nm.textContent = t.name;
    head.appendChild(nm);
    el.appendChild(head);
    const d = document.createElement("div"); d.className = "cfh-t-desc gone";
    d.textContent = _cfhT("tej konfiguracji nie ma już na liście", "this configuration is no longer on the list");
    el.appendChild(d);
    const chips = document.createElement("div"); chips.className = "cfh-t-chips";
    t.chips.forEach(c => chips.appendChild(_tileChip(c)));
    el.appendChild(chips);
    if (t.chips.some(c => c.active)) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn sm"; b.id = id("Back_" + _cfhSlug(t.name));
      b.textContent = _cfhT("Zapisz z powrotem…", "Save it back…");
      b.onclick = e => { e.stopPropagation(); saveAsNew(t.name); };
      el.appendChild(b);
    }
    return el;
  }

  // „+ Zapisz obecne jako konfigurację…" — ostatni kafel, w kształcie tego, co robi (wzór
  // _padAddTile z rf-44). Wyłączony WRAZ Z POWODEM: przycisk, który po prostu przestał działać,
  // czyta się jak usterka.
  function _addTile(m) {
    const wrap = document.createElement("div"); wrap.className = "cfh-add-wrap";
    const b = document.createElement("button");
    b.type = "button"; b.className = "cfh-add-tile"; b.id = id("Add");
    b.innerHTML = '<span class="cfh-add-plus" aria-hidden="true">+</span><span>' +
      _cfhEsc(_cfhT("Zapisz obecne jako preset…", "Save the current one as a preset…")) + "</span>";
    if (!m.canAdd.ok) { b.disabled = true; b.title = m.canAdd.why || ""; }
    b.onclick = e => { e.stopPropagation(); saveAsNew(""); };
    const why = document.createElement("div"); why.className = "cfh-add-why";
    why.textContent = (!m.canAdd.ok && m.canAdd.why) ? m.canAdd.why
      : _cfhT("Nazwana konfiguracja daje się przenieść na inny kapsel i wraca po eksperymentach.",
              "A named configuration can be moved onto another capsule, and it comes back after you experiment.");
    wrap.appendChild(b); wrap.appendChild(why);
    return wrap;
  }

  // ZDANIE STATUSOWE — odpowiedź na trzeci brak: użytkownik nie wiedział, czy
  // konfiguruje aktywny preset z autozapisem, czy taki, który wymaga zapisu. Model jest dwuwarstwowy
  // i to jest jedyne miejsce, w którym aplikacja mówi to wprost: NA KAPSLU zapisuje się samo,
  // W BIBLIOTECE dopiero po „Zapisz zmiany". Przyciski stoją TUTAJ, przy zdaniu, które mówi po co
  // są, a nie w pasku, w którym trzeba się ich domyślić.
  function _paintStatus(m) {
    const box = $("Status"); if (!box) return;
    box.innerHTML = "";
    if (!m.cur) return;
    const who = m.curName, s = m.status;
    // OPTIONAL PHRASE NAMING THE KIND of record („wspólną konfigurację MIDI i OSC"). Same
    // dictionary and same rule as in the module's Configuration tab (rf-49j3): empty unless the
    // adapter sets `kindOf`, so a module nobody touched composes exactly the sentence it did
    // before. Guarded on `A.words.kindOf` — RF_CFGID_WORDS carries no default for this key.
    const kind = (A && A.words && A.words.kindOf && typeof _cfgW === "function")
      ? (_cfgW(A, "kindOf") + " ") : "";
    const p = document.createElement("p"); p.className = "cfh-status-tx";
    let cls = "cfh-status";
    if (!s.name) {
      // Ten sam ogon zdania, co w zakładce „Konfiguracja" modułu (rf-49j3) i ten sam rzeczownik,
      // co na przycisku pod nim — przez słownik adaptera (`noNameDev`), bo w kole to „koło”.
      p.textContent = (typeof _cfgNoNameDev === "function")
        ? _cfgNoNameDev(A, who)
        : _cfhT(
        who + " ma konfigurację bez nazwy — zapisz ją, żeby móc do niej wrócić.",
        who + " has an unnamed configuration — save it so you can come back to it.");
    } else if (!s.known) {
      cls += " is-gone";
      p.textContent = _cfhT(
        who + " nosi " + kind + "„" + s.name + "”, ale tej konfiguracji nie ma już na liście. Ustawienia są na kapslu; zapisz je z powrotem, żeby wróciła do biblioteki.",
        who + " carries " + kind + "“" + s.name + "”, but that configuration is no longer on the list. The settings are on the capsule; save them back to put it in the library again.");
    } else if (s.dirty) {
      cls += " is-dirty";
      p.textContent = _cfhT(
        who + " nosi " + kind + "„" + s.name + "” ze zmianami. Na kapslu wszystko już działa. „" + s.name + "” w bibliotece zmieni się dopiero po „Zapisz zmiany”.",
        who + " carries " + kind + "“" + s.name + "” with changes. On the capsule everything already works. “" + s.name + "” in the library changes only once you hit “Save the changes”.");
    } else {
      p.textContent = _cfhT(
        who + " nosi " + kind + "„" + s.name + "”. Zmiany, które tu zrobisz, działają od razu i zapisują się na kapslu.",
        who + " carries " + kind + "“" + s.name + "”. The changes you make here take effect immediately and are saved on the capsule.");
    }
    box.className = cls;
    box.appendChild(p);

    const acts = document.createElement("div"); acts.className = "cfh-status-acts";
    if (s.name && s.known && s.dirty) {
      const sv = document.createElement("button");
      sv.type = "button"; sv.className = "btn sm primary"; sv.id = id("Save");
      sv.textContent = _cfhT("Zapisz zmiany", "Save the changes");
      sv.title = _cfhT("Nadpisz konfigurację „" + s.name + "” tym, co jest na kapslu",
                       "Overwrite the configuration “" + s.name + "” with what is on the capsule");
      sv.onclick = saveChanges;
      acts.appendChild(sv);
      const rv = document.createElement("button");
      rv.type = "button"; rv.className = "btn sm"; rv.id = id("Revert");
      rv.textContent = _cfhT("Przywróć", "Revert");
      rv.title = _cfhT("Odrzuć zmiany i wróć do zapisanej wersji",
                       "Discard the changes and go back to the saved version");
      rv.onclick = revert;
      acts.appendChild(rv);
    } else if (s.name && !s.known) {
      const bk = document.createElement("button");
      bk.type = "button"; bk.className = "btn sm primary"; bk.id = id("Back");
      bk.textContent = _cfhT("Zapisz z powrotem…", "Save it back…");
      bk.onclick = () => saveAsNew(s.name);
      acts.appendChild(bk);
    }
    if (acts.childNodes.length) box.appendChild(acts);
  }

  // ------------------------------------------------------------------------------------------
  //  DZIAŁANIA
  // ------------------------------------------------------------------------------------------
  function refresh(selName) {
    if (typeof A.reloadPresets === "function") { try { A.reloadPresets(selName || ""); } catch (e) { /* */ } }
    sync();
  }

  // ⚠️ SZEŚĆ DZIAŁAŃ TEGO HUBA MIESZKA OD 2026-08-29 W rf-49a-cfgacts.js (wczytanie na wskazany
  // kapsel, zdjęcie nazwy, nazwa i opis, usunięcie, zapis zmian, przywrócenie). Powód: klika się je
  // teraz w TRZECH miejscach — tutaj, na liście presetów modułu (rf-49j) i w panelu opisu Biblioteki
  // (rf-39i2). Trzy kopie tego samego pytania o zgodę rozjeżdżają się przy pierwszej poprawce i nikt
  // nie zauważa, która wersja kłamie. Zachowanie jest DOKŁADNIE to samo; zmienił się tylko dom.
  function askLoadOnto(dev, p) {
    rfCfgIdAskLoadOnto(A, dev, p, (name) => { if (name) refresh(); else sync(); });
  }

  // Z huba nadal BEZ pytania (`ask:false`): przeciągnięcie chipa na tackę niczego nie niszczy —
  // ustawienia zostają, znika sam podpis. Lista presetów pyta, bo tam ✕ stoi przy CUDZYM kapslu.
  function stripName(dev) { rfCfgIdStripName(A, dev, refresh, { ask: false }); }

  // NAZWA I OPIS jednym oknem, bo to jedna decyzja: „czym ta pozycja jest na liście". Reguły idą
  // NIETKNIĘTE — te, które preset już ma — więc poprawienie literówki w opisie nie ma jak przypadkiem
  // zapisać tego, co ktoś właśnie majstruje na kapslu.
  function editTile(t) {
    if (!t || !t.preset) return;
    rfModal({
      title: _cfhT("Nazwa i opis konfiguracji", "The configuration's name and description"),
      icon: '<span class="bic bic-save" aria-hidden="true"></span>',
      message: _cfhT("Opis widać na kaflu i w Bibliotece. Napisz w nim, do czego ta konfiguracja jest. Po tygodniu sama nazwa tego nie powie. Wyzwalacze zostają bez zmian.",
                     "The description shows on the tile and in the Library. Say what this configuration is for. A week later the name alone will not. The triggers stay exactly as they are."),
      input: { label: _cfhT("Nazwa", "Name"), maxLength: 40, value: t.name },
      textarea: { label: _cfhT("Opis", "Description"), maxLength: descMax(), value: t.desc,
                  placeholder: _cfhT("np. Wolfenstein: kamera i strzelanie",
                                     "e.g. Wolfenstein: camera and shooting") },
      actions: [{ label: _cfhT("Anuluj", "Cancel"), value: false, variant: "ghost" },
                { label: _cfhT("Zapisz", "Save"), value: true, variant: "primary" }]
    }).then(r => {
      if (!r || !r.name) return;
      applyMeta(t, String(r.name).trim(), String(r.desc || ""));
    });
  }

  function applyMeta(t, name, desc) {
    const p = t.preset; if (!p) return;
    const sameFile = name.toLowerCase() === t.name.toLowerCase();
    const clash = !sameFile && A.findPreset(name);
    const go = () => A.savePresetMeta(p, name, desc, (err) => {
      if (err) return _cfhSay(err, true);
      if (name === t.name) { refresh(name); return _cfhSay(_cfhT("Zapisano: " + name, "Saved: " + name)); }
      const carriers = rfCfgIdCarriers(A, t.name);
      // ⚠️ STARY PLIK KASUJEMY TYLKO WTEDY, GDY TO NAPRAWDĘ INNY PLIK. Windows nie odróżnia
      // „Gry.json" od „gry.json", więc przy zmianie samej wielkości liter zapis trafił w ten sam
      // plik — a kasowanie „starego" usunęłoby to, co przed chwilą zapisaliśmy.
      const after = () => {
        let left = carriers.length;
        if (!left) { refresh(name); return _cfhSay(_cfhT("Zapisano: " + name, "Saved: " + name)); }
        // Kapsle noszące starą nazwę dostają nową. Bez tego rename zamieniałby je w kafle-duchy:
        // preset zniknął spod ich nazwy, choć to my go przemianowaliśmy.
        carriers.forEach(d => A.setCfgNameOn(d, name, () => {
          if (--left) return;
          refresh(name);
          _cfhSay(_cfhT("Zapisano: " + name, "Saved: " + name));
        }));
      };
      if (sameFile) after(); else A.deletePreset(t.name, after);
    });
    if (!clash) return go();
    _cfhAsk(_cfhT("Nadpisać „" + name + "”?", "Overwrite “" + name + "”?"),
      _cfhT("Konfiguracja o tej nazwie już jest w bibliotece i zostanie zastąpiona treścią „" + t.name + "”.",
            "A configuration of that name is already in the library and will be replaced by the contents of “" + t.name + "”."),
      _cfhT("Zapisz", "Save")).then(ok => { if (ok) go(); });
  }

  function delTile(t) {
    const carriers = rfCfgIdCarriers(A, t.name);
    const msg = carriers.length
      ? _cfhT("Konfiguracja „" + t.name + "” zniknie z biblioteki. Kapsle, które ją noszą ("
              + carriers.map(A.devName).join(", ") + "), zatrzymają swoje ustawienia; przy ich nazwie stanie „tej konfiguracji nie ma już na liście”.",
              "The configuration “" + t.name + "” will disappear from the library. The capsules carrying it ("
              + carriers.map(A.devName).join(", ") + ") keep their settings; next to their name it will say “this configuration is no longer on the list”.")
      : _cfhT("Konfiguracja „" + t.name + "” zniknie z biblioteki. Nie nosi jej żaden kapsel.",
              "The configuration “" + t.name + "” will disappear from the library. No capsule carries it.");
    _cfhAsk(_cfhT("Usunąć „" + t.name + "”?", "Delete “" + t.name + "”?"), msg,
            _cfhT("Usuń", "Delete"), "danger").then(ok => {
      if (!ok) return;
      A.deletePreset(t.name, (err) => {
        if (err) return _cfhSay(err, true);
        refresh("");
        _cfhSay(_cfhT("Usunięto: " + t.name, "Deleted: " + t.name));
      });
    });
  }

  // ZAPISZ OBECNE JAKO KONFIGURACJĘ — z tego, co na ekranie, i kapsel od razu ją nosi. To jest cała
  // różnica wobec dawnego „Zapisz" z rzędu presetów, który robił kopię i zostawiał kapsel bezimiennym.
  function saveAsNew(prefill) {
    rfModal({
      // TITLE THROUGH `words` — the same route as rf-49a and the bar. A module whose carrier is
      // called something else (a wheel, a scene, a window layout, one configuration shared by MIDI
      // and OSC) overrides it; the default is exactly the caption that stood here before.
      title: _cfgW(A, "saveAsTitle"),
      icon: '<span class="bic bic-save" aria-hidden="true"></span>',
      message: (typeof A.describeSaveAs === "function" ? A.describeSaveAs() : "")
        || _cfhT("Kapsel od razu zacznie nosić tę nazwę. " + A.describeKeeps(),
                 "The capsule starts carrying that name right away. " + A.describeKeeps()),
      input: { label: _cfhT("Nazwa", "Name"), maxLength: 40, value: prefill || "",
               placeholder: _cfhT("np. Wolfenstein chodzenie", "e.g. Wolfenstein walking") },
      textarea: { label: _cfhT("Opis", "Description"), maxLength: descMax(), value: "",
                  placeholder: _cfhT("np. Wolfenstein: kamera i strzelanie",
                                     "e.g. Wolfenstein: camera and shooting") },
      actions: [{ label: _cfhT("Anuluj", "Cancel"), value: false, variant: "ghost" },
                { label: _cfhT("Zapisz", "Save"), value: true, variant: "primary" }]
    }).then(r => {
      if (!r || !r.name) return;
      const name = String(r.name).trim();
      A.saveAs(name, (err) => {
        if (err) return _cfhSay(err, true);
        A.setCfgName(name, () => {
          refresh(name);
          _cfhSay(_cfhT("Kapsel nosi teraz: " + name, "The capsule now carries: " + name));
        });
      }, String(r.desc || ""));
    });
  }

  // ZAPISZ ZMIANY = nadpisz konfigurację o tej nazwie tym, co jest na kapslu. Pyta, bo to jedyne
  // działanie w tej sekcji, które zmienia coś POZA tym kapslem: tę samą konfigurację może nosić kilka.
  function saveChanges() {
    const s = rfCfgIdState(A);
    if (!s.name || !s.known) return;
    const cur = A.getDev();
    const users = rfCfgIdCarriers(A, s.name).filter(d => d !== cur);
    const also = users.length
      ? _cfhT(" Tę konfigurację nosi też: " + users.map(A.devName).join(", ")
              + ". Ich ustawienia zostają takie, jakie są; nową wersję dostaną dopiero, gdy ją wczytasz.",
              " It is also carried by: " + users.map(A.devName).join(", ")
              + ". Their settings stay as they are; they get the new version only when you load it.")
      : "";
    // Same title as the identical button in the module's Configuration tab (rf-49a) - through
    // `words`, so a module whose record has its own name says it in BOTH homes of this action.
    // Left hard-coded, the hub asked „Nadpisać „Stream”?" two clicks away from a button asking
    // „Nadpisać wspólną konfigurację MIDI i OSC „Stream”?" about the very same file.
    _cfhAsk(_cfgW(A, "askOverwrite") + s.name + "”?",
      _cfhT("Zapisana wersja zostanie zastąpiona tym, co masz teraz na kapslu (" + A.describeCurrent() + ")." + also,
            "The saved version will be replaced by what you have on the capsule right now (" + A.describeCurrent() + ")." + also),
      _cfhT("Zapisz zmiany", "Save the changes")).then(ok => {
        if (!ok) return;
        A.overwrite(s.name, (err) => {
          if (err) return _cfhSay(err, true);
          refresh(s.name);
          _cfhSay(_cfhT("Zapisano konfigurację: " + s.name, "Configuration saved: " + s.name));
        });
      });
  }

  // PRZYWRÓĆ = wczytaj z powrotem zapisaną wersję. Pyta, bo ODRZUCA pracę — i mówi wprost, że ją
  // odrzuca, zamiast pytać „na pewno?" bez treści.
  function revert() {
    const s = rfCfgIdState(A);
    if (!s.name || !s.known || !s.dirty) return;
    const p = A.findPreset(s.name);
    _cfhAsk(_cfhT("Wrócić do zapisanej wersji „" + s.name + "”?",
                  "Go back to the saved version of “" + s.name + "”?"),
      _cfhT("Zmiany zrobione na tym kapslu przepadną. Jeśli chcesz je zatrzymać, zamknij to okno i użyj „Zapisz zmiany” albo „Zapisz obecne jako preset…”.",
            "The changes made on this capsule will be lost. To keep them, close this window and use “Save the changes” or “Save the current one as a preset…”."),
      _cfhT("Przywróć", "Revert")).then(ok => {
        if (!ok) return;
        A.applyPreset(p, (err) => {
          if (err) return _cfhSay(err, true);
          refresh(s.name);
          _cfhSay(_cfhT("Przywrócono: " + s.name, "Restored: " + s.name));
        });
      });
  }

  function wire() {
    const fold = $("Fold");
    if (fold) fold.onclick = () => {
      const host = $("");
      setFolded(!(host && host.classList.contains("is-folded")));
      if (host) host._sig = null;      // wymuś przerysowanie: zmienił się TYLKO stan zwinięcia
      sync();
    };
    sync();
  }

  return { hubHtml: hubHtml, wire: wire, sync: sync };
}
