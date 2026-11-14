"use strict";
// ============================================================================
//  TOŻSAMOŚĆ KONFIGURACJI NA KAPSLU — komponent współdzielony
//
//  SKĄD TO SIĘ WZIĘŁO. Koło wyboru dostało 2026-08-28 pasek „Konfiguracja: … · zmienione"
//  z czterema działaniami (rf-46j), bo bez niego na trzy codzienne pytania nie było odpowiedzi
//  nigdzie w aplikacji: co ten kapsel ma na sobie, czy to jeszcze jest to, co zapisałem, które
//  kapsle mają to samo. Te pytania nie są o koło. Zadaje się je o KAŻDĄ konfigurację kapsla —
//  o wyzwalacze przede wszystkim, bo tych bywa czterdzieści i są przepisywane najczęściej.
//
//  Ten plik jest więc uogólnieniem tamtego paska: cała mechanika stoi tutaj, a moduł dokłada
//  ADAPTER — skąd brać bieżącą konfigurację, jak policzyć jej odcisk, gdzie leżą presety i co
//  znaczy „skopiuj". Koło zostaje przy własnej implementacji do czasu ręcznego sprawdzenia w UI;
//  scalenie tamtego z tym jest osobną decyzją i osobną zmianą.
//
//  DWIE ZASADY, KTÓRE TRZYMAJĄ TO W CAŁOŚCI I ŁATWO JE ZGUBIĆ:
//
//  1. „ZMIENIONE" JEST WYLICZANE, NIE ZAPISANE. Flaga w pliku rozjeżdża się z prawdą przy
//     pierwszym zapisie, którego nikt nie przewidział; porównanie odcisku tego, co na kapslu,
//     z odciskiem presetu o tej nazwie nie ma jak skłamać.
//
//  2. ODCISK LICZY DOKŁADNIE TO, CO PRESET NIESIE — ani jednego pola więcej. Każde nadmiarowe
//     pole robi z kapsla „zmienionego" od chwili wczytania, czyli zamienia całą tę funkcję
//     w ostrzeżenie, które zawsze świeci i którego nikt po tygodniu nie czyta.
//
//  I jedna zasada o tym, czym konfiguracja JEST: NIE NIESIE PRZEŁĄCZNIKÓW. Uzbrojenie wyjścia to
//  decyzja o tym kapslu w tej chwili, podejmowana przy przełączniku — plik nie ma prawa jej podjąć
//  (patrz apply_setup po stronie serwera i tests/test_setup_switches.py).
//
//  Ładowany PRZED konsumentami (rf-10 i dalej), bo to oni go wołają.
// ============================================================================

const RF_CFGID_I18N = {
  "Konfiguracja:": "Configuration:",
  "Zapisz jako…": "Save as…",
  "Przywróć": "Revert",
  "Skopiuj na…": "Copy to…",
  "tej konfiguracji nie ma już na liście": "this configuration is no longer on the list",
  "— wybierz —": "— choose —",
  "Wybierz konfigurację dla tego kapsla": "Choose a configuration for this capsule",
  "Zapisz zmiany w konfiguracji, z której to pochodzi": "Save the changes into the configuration this came from",
  "Odrzuć zmiany i wróć do zapisanej wersji": "Discard the changes and go back to the saved version",
  "Skopiuj tę konfigurację na inny kapsel": "Copy this configuration onto another capsule",
  "Nazwa": "Name",
};
try { Object.assign(I18N_EN, RF_CFGID_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

function _cfgT(pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; }

// KTO NOSI TĘ KONFIGURACJĘ — nazwany w zdaniach okien z pytaniem o zgodę. Do rf-49e był to zawsze
// kapsel, więc słowo stało wpisane w zdania. Od rf-49f (układy okien nakładek) nośnikiem bywa CAŁY
// EKRAN, a zdanie „Kapsel od razu zacznie nosić tę nazwę" jest tam po prostu nieprawdą.
//
// Podmieniane są całe FRAZY, nie sam rzeczownik: polska odmiana nie pozwala złożyć „na kapslu",
// „ten kapsel" i „Kapsel nosi teraz" z jednego słowa. Wartości domyślne są dokładnie tym, co stało
// w tych zdaniach przedtem, żeby cztery istniejące paski nie zauważyły tej zmiany.
const RF_CFGID_WORDS = {
  onIt: ["na kapslu", "on this capsule"],              // „…tym, co masz teraz NA KAPSLU (…)"
  onThis: ["na tym kapslu", "on this capsule"],        // „Zmiany zrobione NA TYM KAPSLU przepadną"
  thisOne: ["ten kapsel", "this capsule"],             // „To, co TEN KAPSEL ma teraz (…)"
  takes: ["Kapsel od razu zacznie nosić tę nazwę.",
          "The capsule starts carrying that name right away."],
  remembers: ["Konfiguracja zapamiętuje ", "The configuration remembers "],
  carries: ["Kapsel nosi teraz: ", "The capsule now carries: "],
  // …i to samo dla słowa „konfiguracja" w tytułach okien, podpowiedziach i potwierdzeniach.
  // Osobne pozycje, a nie jeden rzeczownik, z tego samego powodu: „tej konfiguracji" / „tego
  // układu" to dwa przypadki, a angielskie zdania mają rodzajnik w innym miejscu.
  gone: ["tej konfiguracji nie ma już na liście", "this configuration is no longer on the list"],
  askOverwrite: ["Nadpisać konfigurację „", "Overwrite the configuration “"],
  overwriteTip: ["Nadpisz konfigurację „", "Overwrite the configuration “"],
  askLoadTitle: ["Wczytać konfigurację „", "Load the configuration “"],
  // JEDEN RZECZOWNIK NA CAŁĄ DROGĘ ZAPISU. Ten sam przedmiot nazywał się po drodze trzema
  // słowami: przycisk mówił „Utwórz preset", okno „Zapisz jako nową konfigurację", a nagłówek
  // listy „Zapisane konfiguracje tego modułu". Domyślną nazwą jest PRESET — tak mówi przycisk,
  // od którego się zaczyna, i tak mówi wymiana („Preset wyzwalaczy"). Moduły, w których nośnik
  // nazywa się inaczej, podmieniają to u siebie (koło, scena, układ okien — patrz `words`).
  saveAsTitle: ["Zapisz jako nowy preset", "Save as a new preset"],
  saveAsBtn: ["Zapisz preset", "Save the preset"],
  // Przycisk bloku stanu w Konfiguracji (rf-49j3 `paintCfgState`, gdy nośnik nie ma jeszcze nazwy)
  // — TEN SAM RZECZOWNIK, co saveAsBtn. Do 2026-09-05 był wpisany na sztywno, więc w syntezatorze
  // zdanie nad nim mówiło „zapisz go jako scenę", a przycisk „Utwórz preset".
  createBtn: ["Utwórz preset", "Create a preset"],
  saved: ["Zapisano konfigurację: ", "Configuration saved: "],
  // — trzy zdania panelu opisu w zakładce „Biblioteka" (rf-49j3, od 2026-08-31). Też wymienne, bo
  //   nośnikiem bywa cała aplikacja: „Nosi ją kapsel, który edytujesz" o zestawie akcji sieciowych
  //   albo o scenie syntezatora jest po prostu nieprawdą, a to zdanie stoi nad przyciskiem, który
  //   coś podmienia.
  inUse: ["Nosi ją kapsel, który edytujesz.", "The capsule you are editing carries it."],
  toEdit: ["Żeby edytować, wczytaj go na kapsel.", "To edit it, load it onto a capsule."],
  loadHere: ["Wczytaj", "Load"],
  // Zdanie bloku stanu, gdy nośnik NIE JEST kapslem (syntezator, Usługi sieciowe). Wersja dla
  // kapsla jest składana osobno, bo zaczyna się od jego imienia i nie ma jak trafić w słownik.
  noName: ["Te ustawienia nie mają jeszcze nazwy. Zapisz je jako preset, żeby móc do nich wrócić.",
           "These settings have no name yet. Save them as a preset so you can come back to them."],
  // To samo zdanie, ale o KAPSLU — składane z jego imieniem z przodu (rf-49j3 `paintCfgState`,
  // rf-49i `_paintStatus`), więc w słowniku stoi sam ogon. TEN SAM RZECZOWNIK, co „Utwórz preset"
  // (`createBtn`) i „Zapisz jako nowy preset" (`saveAsTitle`) pod tym zdaniem: do 2026-09-05 pasek
  // mówił „ma konfigurację bez nazwy — zapisz ją", a przycisk tuż obok „Utwórz preset", więc jedna
  // rzecz na jednym ekranie miała dwie nazwy. Moduły, w których nośnik nazywa się inaczej,
  // podmieniają to u siebie (koło — rf-46k `words`).
  // UX 261120 A1 (synteza 3.12): zdanie z imieniem kapsla W ŚRODKU, więc słownik niesie wzór
  // z `{kto}`; składa go `_cfgNoNameDev`. Wpis bez `{kto}` (stary adapter) dostaje imię z przodu.
  noNameDev: ["Te ustawienia działają na {kto}, ale nie mają nazwy. Zapisz je jako preset, żeby móc do nich wrócić.",
              "These settings work on {kto} but have no name. Save them as a preset so you can come back to them."],
};
// Zdanie paska „bez nazwy" o kapslu: jedno miejsce składania dla zakładki „Konfiguracja" (rf-49j3)
// i huba (rf-49i), żeby oba mówiły to samo.
function _cfgNoNameDev(A, who) {
  const tail = _cfgW(A, "noNameDev");
  return tail.indexOf("{kto}") >= 0 ? tail.split("{kto}").join(who) : (who + " " + tail);
}
function _cfgW(A, key) {
  const own = (A.words || {})[key];
  const pair = (Array.isArray(own) && own.length === 2) ? own : RF_CFGID_WORDS[key];
  return _cfgT(pair[0], pair[1]);
}
function _cfgEsc(s) { return (typeof esc === "function") ? esc(s) : String(s); }
function _cfgSay(msg, bad) {
  try { rfToast(msg, bad ? { tone: "danger" } : { tone: "ok" }); } catch (e) { /* bez panelu */ }
}
// Pytanie z treścią zamiast „na pewno?". Każde okno tej sekcji mówi, CO się stanie i czego to
// dotyczy — dlatego wszystkie idą jedną drogą, przez wspólne dialogi aplikacji (rf-06).
function _cfgAsk(title, message, okLabel) {
  return rfConfirm(message, { title: title, confirmLabel: okLabel,
                              cancelLabel: _cfgT("Anuluj", "Cancel") });
}

// ------------------------------------------------------------------------------------------
//  STAN JEDNEGO NOŚNIKA — wspólny dla paska i dla huba (rf-49i)
// ------------------------------------------------------------------------------------------
// Wyniesione z domknięcia `rfCfgIdCreate`, bo od huba to samo pytanie zadaje się o KAŻDY kapsel,
// nie tylko o bieżący: kafel konfiguracji pokazuje kropkę „zmienione" przy każdym chipie, a chip
// to cudzy kapsel. Dwie implementacje tej odpowiedzi rozjechałyby się w pierwszym tygodniu —
// i rozjechałyby się CICHO, bo obie zwracają wiarygodnie wyglądający obiekt.
//
//   name  — jak się nazywa (pusto: ułożone ręcznie, nigdy nie zapisane pod nazwą — normalny stan)
//   known — czy preset o tej nazwie jeszcze istnieje (mógł zostać skasowany)
//   dirty — czy to, co na nośniku, różni się od zapisanej wersji
//
// `dev === null/undefined` znaczy „bieżący nośnik" i idzie przez fingerprintCurrent(); z `dev`
// pyta adapter przez fingerprintOf(dev). Odcisk `null` po którejkolwiek stronie znaczy „nie da się
// powiedzieć" (starszy serwer nie przysłał treści presetu, reguły cudzego kapsla jeszcze nie
// dojechały) — wtedy MILCZYMY, zamiast krzyczeć „zmienione" o czymś, czego nie porównaliśmy.
function rfCfgIdState(A, dev) {
  const name = String(A.getCfgName(dev) || "").trim();
  if (!name) return { name: "", known: false, dirty: false };
  const p = A.findPreset(name);
  if (!p) return { name: name, known: false, dirty: false };
  const fp = A.fingerprintPreset(p);
  const cur = (dev === undefined || dev === null || typeof A.fingerprintOf !== "function")
    ? A.fingerprintCurrent() : A.fingerprintOf(dev);
  return { name: name, known: true, dirty: fp != null && cur != null && cur !== fp };
}

// KTO NOSI KONFIGURACJĘ O TEJ NAZWIE. Pasek pyta o to przy nadpisywaniu (to jedyne jego działanie
// dotykające czegoś poza bieżącym kapslem); hub rysuje z tego chipy na kaflu. Porównanie bez
// względu na wielkość liter, bo nazwa jest podpisem człowieka, nie kluczem.
function rfCfgIdCarriers(A, name) {
  const k = rfCfgIdKey(name);
  if (!k) return [];
  const all = (typeof A.listAllDevs === "function")
    ? (A.listAllDevs() || [])
    : [A.getDev()].concat(A.listOtherDevs() || []);
  return all.filter(d => d && rfCfgIdKey(A.getCfgName(d)) === k);
}

// KLUCZ PORÓWNANIA NAZW — jedno miejsce dla pasków, huba i adapterów. Wielkość liter nie gra
// (nazwa to podpis człowieka), a biały znak zwijany jest do jednej spacji: serwer robi to samo
// przy zapisie nazwy na kapslu, więc porównanie bez zwijania potrafiło uznać istniejący preset
// za nieistniejący (nazwa pliku z podwójną spacją vs nazwa na kapslu z pojedynczą).
function rfCfgIdKey(name) {
  return String(name == null ? "" : name).replace(/\s+/g, " ").trim().toLowerCase();
}

// ------------------------------------------------------------------------------------------
//  REJESTR ADAPTERÓW — „jak nazywa się konfiguracja modułu X na kapslu Y"
// ------------------------------------------------------------------------------------------
// Adaptery są prywatne: każdy moduł trzyma swój jako `const` u siebie w pliku i nikt poza nim
// go nie widzi. Póki jedynym pytającym był pasek tego samego modułu, było to w porządku.
// Od 2026-08-29 pytają dwa miejsca STOJĄCE OBOK: ścieżka okruszków nad modułem i lista
// „Co wychodzi z tego kapsla" w prawej kolumnie — a obie pytają o CUDZY moduł.
//
// Rejestr jest więc jedną tablicą „zakładka → adapter", wypełnianą przy starcie (rf-49j).
// Kluczem jest ZAKŁADKA, a nie moduł, bo MIDI i OSC dzielą jeden adapter i dwa ekrany.
const RF_CFG_REG = Object.create(null);
function rfCfgIdRegister(tab, key, adapter) {
  if (!tab || !adapter) return;
  RF_CFG_REG[String(tab)] = { key: String(key || tab), adapter: adapter };
}
function rfCfgIdRegistry() { return RF_CFG_REG; }
function rfCfgIdEntry(tab) { return RF_CFG_REG[String(tab)] || null; }
// Nazwa noszonej konfiguracji. Bez `dev` — na bieżącym nośniku. Cisza (pusty napis) znaczy
// „nic pod nazwą", co jest zupełnie normalnym stanem, a nie błędem.
function rfCfgIdNameForTab(tab, dev) {
  const e = RF_CFG_REG[String(tab)];
  if (!e || !e.adapter || typeof e.adapter.getCfgName !== "function") return "";
  try { return String(e.adapter.getCfgName(dev) || "").trim(); } catch (err) { return ""; }
}

// ------------------------------------------------------------------------------------------
//  PYTANIE PRZED WCZYTANIEM — wyniesione z domknięcia, bo pytają o to DWA miejsca
// ------------------------------------------------------------------------------------------
// Do 2026-08-29 to okno żyło wyłącznie w środku `rfCfgIdCreate` i otwierała je zmiana wyboru na
// pasku. Lista presetów (rf-49j) ma własny przycisk „Wczytaj na …", a jest to dokładnie to samo
// działanie i musi zadawać dokładnie to samo pytanie — najważniejsze zdanie jest ostatnie:
// co się stanie z NIEZAPISANYMI zmianami, które człowiek ma teraz na kapslu. Druga kopia tego
// tekstu rozjechałaby się przy pierwszej poprawce i nikt by nie zauważył, która wersja kłamie.
function rfCfgIdAskLoad(A, p, after) {
  const W = (key) => _cfgW(A, key);
  const done = (typeof after === "function") ? after : function () { };
  const cur = rfCfgIdState(A);
  const lost = cur.dirty
    ? _cfgT(" ⚠️ Zmiany, które masz teraz w „" + cur.name + "”, nie są nigdzie zapisane i przepadną.",
      " ⚠️ The changes you have in “" + cur.name + "” right now are saved nowhere and will be lost.")
    : (cur.name ? "" : _cfgT(" ⚠️ To, co masz teraz " + W("onIt") + ", nie jest zapisane pod żadną nazwą, więc przepadnie.",
      " ⚠️ What you have " + W("onIt") + " right now is not saved under any name, so it will be lost."));
  _cfgAsk(W("askLoadTitle") + p.name + "”?",
    _cfgT("To, co " + W("thisOne") + " ma teraz (" + A.describeCurrent() + "), zostanie zastąpione ("
      + A.describePreset(p) + "). " + A.describeKeeps() + lost,
      "What " + W("thisOne") + " has now (" + A.describeCurrent() + ") will be replaced ("
      + A.describePreset(p) + "). " + A.describeKeeps() + lost),
    _cfgT("Wczytaj", "Load")).then(ok => {
      if (!ok) { done(); return; }   // wybór cofnięty — pasek musi wrócić do starej nazwy
      A.applyPreset(p, (err) => {
        if (err) { done(err); return _cfgSay(err, true); }
        // DRUGI ARGUMENT `applied` — jedyny sposób, żeby wywołujący odróżnił „wczytano" od
        // „cofnięto": obie drogi kończą się `done()` bez błędu, bo pasek w obu wypadkach musi
        // przerysować swój wybór. Panel opisu w module (rf-49j3) przerzuca się po wczytaniu na
        // zakładkę Konfiguracja i po cofnięciu robić tego NIE MOŻE. Starsi wywołujący biorą jeden
        // argument i dodatkowego po prostu nie widzą.
        done(null, true);
        _cfgSay(_cfgT("Wczytano: " + p.name, "Loaded: " + p.name));
      });
    });
}

// ------------------------------------------------------------------------------------------
//  KOMPONENT
// ------------------------------------------------------------------------------------------
//  rfCfgIdCreate(adapter) -> { barHtml(), wire(), sync() }
//
//  Adapter (wszystko wymagane oprócz copyTo, barLabel, pickTitle i words):
//    idPrefix                    prefiks id elementów DOM (np. "trig")
//    barLabel pickTitle          napisy paska; domyślnie „Konfiguracja:” i „…dla tego kapsla”.
//                                Nadpisuje je adapter, którego nazwa NIE wisi na kapslu (rf-49f)
//    words                       podmiana fraz nazywających NOŚNIKA i samą rzecz w zdaniach okien
//                                (RF_CFGID_WORDS wyżej); {klucz: [pl, en]}, brak = domyślne
//    getDev() devName(dev) listOtherDevs()          kapsle
//    getCfgName(dev) setCfgName(name, done)         nazwa NA kapslu; bez `dev` — na bieżącym,
//                                                   z `dev` — na wskazanym (kto jeszcze to nosi)
//    fingerprintCurrent() fingerprintPreset(p)      odciski obu stron porównania
//    listPresets() findPreset(name)                 biblioteka konfiguracji
//    saveAs(name, done) overwrite(name, done) applyPreset(p, done)
//    copyTo(dev, done)                              opcjonalne — bez niego lista „Skopiuj na…" znika
//    describeCurrent() describePreset(p) describeKeeps()   zdania do okien, już przetłumaczone
//                                                          (adapter zna swoje słowa, komponent nie)
function rfCfgIdCreate(adapter) {
  const A = adapter || {};
  const P = A.idPrefix || "cfg";
  const id = (suffix) => P + "Cfg" + suffix;
  const $ = (suffix) => document.getElementById(id(suffix));
  const W = (key) => _cfgW(A, key);      // fraza nazywająca nośnika (kapsel / ekran) — patrz wyżej

  // Stan bieżącego nośnika — liczony przez wspólne `rfCfgIdState` (wyżej), którego używa też hub.
  function st() { return rfCfgIdState(A); }

  // Które POZOSTAŁE kapsle noszą konfigurację o tej nazwie. Potrzebne przy nadpisywaniu: to jedyne
  // działanie tej sekcji, które zmienia coś POZA tym kapslem, więc musi powiedzieć, kogo jeszcze
  // dotyczy. Ten sam spis, co na kaflach huba, minus ten, przy którym się właśnie stoi.
  function others(name) {
    const cur = A.getDev();
    return rfCfgIdCarriers(A, name).filter(d => d !== cur);
  }

  // ------------------------------------------------------------------------------------------
  //  PASEK
  // ------------------------------------------------------------------------------------------
  function barHtml() {
    // ETYKIETA I PODPOWIEDŹ LISTY SĄ WYMIENNE, reszta paska nie. Powód: od rf-49f nośnikiem nazwy
    // bywa CAŁA APLIKACJA, nie kapsel — układ okien nakładek jest o ekranie, więc „Konfiguracja:"
    // i „…dla tego kapsla" byłyby tam po prostu nieprawdą. Domyślne wartości są dokładnie te, co
    // przedtem, żeby cztery istniejące paski nie zauważyły tej zmiany. Napisy MUSZĄ mieć parę
    // w I18N_EN (adapter dokłada swoją, patrz RF_OVLLAY_I18N).
    const lbl = _cfgEsc(A.barLabel || "Konfiguracja:");
    const pickTip = _cfgEsc(A.pickTitle || "Wybierz konfigurację dla tego kapsla");
    return `<div class="rf-cfgbar" id="${id("Bar")}">
      <span class="rf-cfgbar-l">${lbl}</span>
      <select id="${id("Pick")}" class="rf-cfgpick"
        title="${pickTip}" aria-label="${pickTip}"></select>
      <span class="rf-cfgbar-state" id="${id("State")}"></span>
      <button type="button" class="btn sm primary" id="${id("Save")}" style="display:none"
        title="Zapisz zmiany w konfiguracji, z której to pochodzi">Zapisz zmiany</button>
      <button type="button" class="btn sm" id="${id("SaveAs")}">Zapisz jako…</button>
      <button type="button" class="btn sm" id="${id("Revert")}" style="display:none"
        title="Odrzuć zmiany i wróć do zapisanej wersji">Przywróć</button>
      <select id="${id("Copy")}" class="rf-cfgpick"
        title="Skopiuj tę konfigurację na inny kapsel" aria-label="Skopiuj tę konfigurację na inny kapsel"></select>
    </div>`;
  }

  // Odświeżenie paska. Wołane po KAŻDEJ zmianie listy, więc musi być tanie i nie może zabierać
  // ogniska z pola, w którym ktoś właśnie stoi — stąd porównanie HTML przed podmianą.
  function sync() {
    const bar = $("Bar"); if (!bar) return;
    const s = st();

    // LISTA KONFIGURACJI. Pierwsza pozycja to stan „ułożone ręcznie" — bez niej wybór wyglądałby
    // na obowiązkowy, a konfiguracja bez nazwy jest w tej aplikacji zupełnie normalna.
    const sel = $("Pick");
    if (sel) {
      const opts = ['<option value="">' + _cfgEsc(_cfgT("— wybierz —", "— choose —")) + "</option>"]
        .concat((A.listPresets() || []).map(p =>
          '<option value="' + _cfgEsc(p.name) + '">' + _cfgEsc(p.name) + "</option>"));
      // …a jeśli kapsel nosi nazwę presetu, którego już nie ma, lista musi umieć ją pokazać:
      // inaczej wybór skakałby na „— wybierz —" i wyglądałoby to na skasowanie nazwy.
      if (s.name && !s.known) opts.push('<option value="' + _cfgEsc(s.name) + '">' + _cfgEsc(s.name) + "</option>");
      const html = opts.join("");
      if (sel._html !== html) { sel.innerHTML = html; sel._html = html; }
      const want = s.name || "";
      if (sel.value !== want) sel.value = want;
    }

    const tag = $("State");
    if (tag) {
      let txt = "", cls = "rf-cfgbar-state";
      if (!s.name) txt = "";
      else if (!s.known) { txt = W("gone"); cls += " is-gone"; }
      else if (s.dirty) { txt = _cfgT("zmienione", "changed"); cls += " is-dirty"; }
      if (tag.textContent !== txt) tag.textContent = txt;
      if (tag.className !== cls) tag.className = cls;
    }

    // ZAPISZ ZMIANY I PRZYWRÓĆ POKAZUJĄ SIĘ TYLKO, GDY JEST CO ZAPISAĆ ALBO CO ODRZUCIĆ. Przycisk,
    // który nic nie robi, uczy, że przyciski nic nie robią — a tu chodzi o zapisywanie.
    const show = !!(s.name && s.known && s.dirty);
    const sv = $("Save");
    if (sv) {
      sv.style.display = show ? "" : "none";
      if (show) sv.title = W("overwriteTip") + s.name + "”";
      else { sv.removeAttribute("title"); sv.removeAttribute("data-rftip"); }
    }
    const sa = $("SaveAs");
    if (sa && sa.title !== W("saveAsTitle")) sa.title = W("saveAsTitle");
    const rv = $("Revert"); if (rv) rv.style.display = show ? "" : "none";

    // SKOPIUJ NA… — lista pozostałych kapsli. Przy jednym kapslu znika w całości: „skopiuj" bez
    // celu jest pytaniem bez odpowiedzi.
    const cp = $("Copy");
    if (cp) {
      const list = (typeof A.copyTo === "function") ? (A.listOtherDevs() || []) : [];
      cp.style.display = list.length ? "" : "none";
      const html = ['<option value="">' + _cfgEsc(_cfgT("Skopiuj na…", "Copy to…")) + "</option>"]
        .concat(list.map(d => '<option value="' + _cfgEsc(d) + '">' + _cfgEsc(A.devName(d)) + "</option>"))
        .join("");
      if (cp._html !== html) { cp.innerHTML = html; cp._html = html; }
      if (cp.value !== "") cp.value = "";
    }
  }

  // ------------------------------------------------------------------------------------------
  //  DZIAŁANIA
  // ------------------------------------------------------------------------------------------
  // ZAPISZ ZMIANY = nadpisz preset o tej nazwie tym, co jest na kapslu. Pyta, bo to jedyne
  // działanie w tej sekcji, które zmienia coś poza tym kapslem: konfiguracji może używać kilka.
  function saveChanges() {
    const s = st();
    if (!s.name || !s.known) return;
    const users = others(s.name);
    const also = users.length
      ? _cfgT(" Tej konfiguracji używa też: " + users.map(A.devName).join(", ")
        + ". Ich ustawienia zostają takie, jakie są; nową wersję dostaną dopiero, gdy je wczytasz.",
        " It is also used by: " + users.map(A.devName).join(", ")
        + ". Their settings stay as they are; they get the new version only when you load it.")
      : "";
    _cfgAsk(W("askOverwrite") + s.name + "”?",
      _cfgT("Zapisana wersja zostanie zastąpiona tym, co masz teraz " + W("onIt")
        + " (" + A.describeCurrent() + ")." + also,
        "The saved version will be replaced by what you have " + W("onIt") + " right now ("
        + A.describeCurrent() + ")." + also),
      _cfgT("Zapisz zmiany", "Save the changes")).then(ok => {
        if (!ok) return;
        A.overwrite(s.name, (err) => {
          if (err) return _cfgSay(err, true);
          sync();
          _cfgSay(W("saved") + s.name);
        });
      });
  }

  // ZAPISZ JAKO… = nowa konfiguracja z tego, co na ekranie, i kapsel od razu ją nosi. To jest
  // różnica wobec „Zapisz" z sekcji presetów, która robiła kopię i zostawiała kapsel bezimiennym:
  // tam zapisywało się LISTĘ, tu nadaje się kapslowi KONFIGURACJĘ.
  function saveAs() {
    const s = st();
    rfModal({
      title: W("saveAsTitle"),
      icon: '<span class="bic bic-save" aria-hidden="true"></span>',
      message: W("takes") + " " + W("remembers") + A.describeCurrent() + ". " + A.describeKeeps(),
      input: { label: _cfgT("Nazwa", "Name"), maxLength: 40,
               value: s.name ? s.name + _cfgT(" (moje)", " (mine)") : "",
               placeholder: _cfgT("np. Elden Ring", "e.g. Elden Ring") },
      actions: [{ label: _cfgT("Anuluj", "Cancel"), value: false, variant: "ghost" },
                { label: W("saveAsBtn"), value: true, variant: "primary" }]
    }).then(name => {
      if (!name) return;
      A.saveAs(name, (err) => {
        if (err) return _cfgSay(err, true);
        A.setCfgName(name, () => {
          sync();
          _cfgSay(W("carries") + name);
        });
      });
    });
  }

  // PRZYWRÓĆ = wczytaj z powrotem zapisaną wersję. Pyta, bo odrzuca pracę — i mówi wprost, że ją
  // odrzuca, zamiast pytać „na pewno?" bez treści.
  function revert() {
    const s = st();
    if (!s.name || !s.known || !s.dirty) return;
    const p = A.findPreset(s.name);
    _cfgAsk(_cfgT("Wrócić do zapisanej wersji „" + s.name + "”?",
      "Go back to the saved version of “" + s.name + "”?"),
      _cfgT("Zmiany zrobione " + W("onThis") + " przepadną. Jeśli chcesz je zatrzymać, zamknij to "
        + "okno i użyj „Zapisz zmiany” albo „Zapisz jako…”.",
        "The changes made " + W("onThis") + " will be lost. To keep them, close this window and use "
        + "“Save the changes” or “Save as…”."),
      _cfgT("Przywróć", "Revert")).then(ok => {
        if (!ok) return;
        A.applyPreset(p, (err) => {
          if (err) return _cfgSay(err, true);
          sync();
          _cfgSay(_cfgT("Przywrócono: " + s.name, "Restored: " + s.name));
        });
      });
  }

  // Pytanie przed wczytaniem stoi na zewnątrz (rfCfgIdAskLoad wyżej), bo zadaje je też lista
  // presetów przyciskiem „Wczytaj na …". Tutaj zostaje samo domknięcie: cokolwiek się stanie,
  // pasek musi się odświeżyć — także po cofnięciu wyboru, żeby wrócił do starej nazwy.
  function askLoad(p) { rfCfgIdAskLoad(A, p, sync); }

  // SKOPIUJ NA… — jedno kliknięcie zamiast trzech kroków przez bibliotekę presetów (zapisz →
  // przełącz kapsel → wczytaj). Nie przełącza edycji: kopiuje się PO TO, żeby zostać tam, gdzie
  // się jest.
  function copyTo(dev) {
    if (typeof A.copyTo !== "function") return;
    const nm = A.devName(dev);
    _cfgAsk(_cfgT("Skopiować na " + nm + "?", "Copy onto " + nm + "?"),
      _cfgT("To, co " + nm + " ma teraz, zostanie zastąpione (" + A.describeCurrent() + "). "
        + A.describeKeeps(),
        "What " + nm + " has now will be replaced (" + A.describeCurrent() + "). " + A.describeKeeps()),
      _cfgT("Skopiuj", "Copy")).then(ok => {
        if (!ok) return;
        A.copyTo(dev, (err) => {
          if (err) return _cfgSay(err, true);
          _cfgSay(_cfgT("Skopiowano na: " + nm, "Copied onto: " + nm));
        });
      });
  }

  function wire() {
    const pick = $("Pick");
    if (pick) pick.onchange = () => {
      const name = pick.value;
      // Powrót do „— wybierz —" zdejmuje z kapsla samą NAZWĘ, a nie konfigurację: ustawienia
      // zostają, kapsel po prostu przestaje twierdzić, że nosi cudzą konfigurację.
      if (!name) { A.setCfgName("", sync); return; }
      const cur = st();
      if (cur.name && rfCfgIdKey(cur.name) === rfCfgIdKey(name)) return;
      const p = A.findPreset(name);
      if (!p) { sync(); return; }
      askLoad(p);
    };
    const sv = $("Save"); if (sv) sv.onclick = saveChanges;
    const sa = $("SaveAs"); if (sa) sa.onclick = saveAs;
    const rv = $("Revert"); if (rv) rv.onclick = revert;
    const cp = $("Copy");
    if (cp) cp.onchange = () => { const d = cp.value; cp.value = ""; if (d) copyTo(d); };
    sync();
  }

  return { barHtml: barHtml, wire: wire, sync: sync };
}
