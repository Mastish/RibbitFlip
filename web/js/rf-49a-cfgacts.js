"use strict";
// ==================================================================================================
//  DZIAŁANIA NA NAZWANEJ KONFIGURACJI — jedna implementacja dla trzech miejsc
//
//  SKĄD TO SIĘ WZIĘŁO. Do 2026-08-29 sześć działań („zapisz obecne jako…", „zmień nazwę i opis",
//  „usuń", „zdejmij nazwę z kapsla", „zapisz zmiany", „przywróć") żyło w DOMKNIĘCIU huba
//  (rf-49i). Póki hub był jedynym miejscem, w którym się je klikało, było to w porządku. Etap 3
//  układu z trzech kolumn daje im dwa nowe domy: listę presetów w module (rf-49j) i panel opisu
//  w Bibliotece (rf-39i2). Skopiowanie ich tam dałoby TRZY kopie tego samego pytania o zgodę —
//  a te rozjeżdżają się przy pierwszej poprawce i nikt nie zauważa, która wersja kłamie.
//
//  Ten plik jest więc dokładnie tym, czym rf-49 stał się dla `rfCfgIdAskLoad`: wspólnym domem dla
//  działania, o które pyta więcej niż jedno miejsce. Hub po tej zmianie NIC nie robi sam — woła te
//  same funkcje, a jego harnessy sprawdzają dalej ten sam skutek.
//
//  DWIE ZASADY, KTÓRE ZOSTAJĄ Z HUBA:
//  1. PYTANIE MA TREŚĆ. Każde okno mówi, CO się stanie i CZEGO NIE dotknie — „na pewno?" bez treści
//     uczy klikać „tak" bez czytania.
//  2. NAJWAŻNIEJSZE ZDANIE JEST OSTATNIE: co się stanie z niezapisanymi zmianami.
//
//  Ładowany PO rf-49-cfgid.js (używa rfCfgIdState / rfCfgIdCarriers / rfCfgIdKey) i PRZED
//  rf-49i / rf-49j / rf-39i, które go wołają.
// ==================================================================================================

const RF_CFGACT_I18N = {
  "Nazwa i opis konfiguracji": "The configuration's name and description",
  "Zapisz jako nowy preset": "Save as a new preset",
  "Zdejmij samą nazwę (ustawienia zostają)": "Take just the name off (the settings stay)",
  "Zdjąć nazwę z tego kapsla?": "Take the name off this capsule?",
  "Zdejmij nazwę": "Take the name off",
};
try { Object.assign(I18N_EN, RF_CFGACT_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

// Pytanie z treścią — ta sama droga, co w pasku i w hubie: wspólne dialogi aplikacji (rf-06).
function _actAsk(title, message, okLabel, tone) {
  return rfConfirm(message, {
    title: title, confirmLabel: okLabel, tone: tone || "",
    cancelLabel: _cfgT("Anuluj", "Cancel")
  });
}
function _actSay(msg, bad) {
  try { rfToast(msg, bad ? { tone: "danger" } : { tone: "ok" }); } catch (e) { /* bez panelu */ }
}
function _actDone(after) { return (typeof after === "function") ? after : function () { }; }
function _actDescMax(A) { return (typeof A.descMax === "function" ? (A.descMax() || 200) : 200); }
// Co WSKAZANY kapsel ma teraz na sobie. Pusto, gdy jego dane jeszcze nie dojechały — zdanie okna
// milczy wtedy o liczbie, zamiast podawać liczbę z kapsla, przy którym akurat stoimy.
function _actDescribeDev(A, dev) {
  if (typeof A.getDev === "function" && dev === A.getDev()) return String(A.describeCurrent() || "");
  return String((typeof A.describeDev === "function" ? A.describeDev(dev) : "") || "");
}

// ------------------------------------------------------------------------------------------
//  ZAPISZ OBECNE JAKO NOWĄ KONFIGURACJĘ
// ------------------------------------------------------------------------------------------
// …i kapsel od razu ją nosi. To jest cała różnica wobec dawnego „Zapisz" z rzędu presetów, który
// robił kopię i zostawiał kapsel bezimiennym. `prefill` niesie nazwę przy ratowaniu konfiguracji,
// której nie ma już na liście (kafel-duch / wiersz-duch).
function rfCfgIdSaveAsNew(A, prefill, after) {
  const done = _actDone(after);
  rfModal({
    // TYTUŁ I POTWIERDZENIE PRZEZ `words` — bo od 2026-08-31 to okno otwierają także adaptery,
    // w których nośnikiem nazwy NIE JEST KAPSEL (scena syntezatora, preset Usług sieciowych).
    // „Kapsel nosi teraz: Stream" byłoby tam po prostu nieprawdą, a jest to ostatnie zdanie,
    // które człowiek widzi po zapisie. Domyślne wartości są dokładnie te, co przedtem.
    title: _cfgW(A, "saveAsTitle"),
    icon: '<span class="bic bic-save" aria-hidden="true"></span>',
    message: (typeof A.describeSaveAs === "function" ? A.describeSaveAs() : "")
      || (_cfgW(A, "takes") + " " + A.describeKeeps()),
    input: {
      label: _cfgT("Nazwa", "Name"), maxLength: 40, value: prefill || "",
      placeholder: _cfgT("np. Wolfenstein chodzenie", "e.g. Wolfenstein walking")
    },
    textarea: {
      label: _cfgT("Opis", "Description"), maxLength: _actDescMax(A), value: "",
      placeholder: _cfgT("np. Wolfenstein: kamera i strzelanie",
                         "e.g. Wolfenstein: camera and shooting")
    },
    actions: [{ label: _cfgT("Anuluj", "Cancel"), value: false, variant: "ghost" },
              { label: _cfgT("Zapisz", "Save"), value: true, variant: "primary" }]
  }).then(r => {
    if (!r || !r.name) return;
    const name = String(r.name).trim();
    A.saveAs(name, (err) => {
      if (err) return _actSay(err, true);
      A.setCfgName(name, () => {
        done(name);
        _actSay(_cfgW(A, "carries") + name);
      });
    }, String(r.desc || ""));
  });
}

// ------------------------------------------------------------------------------------------
//  NAZWA I OPIS
// ------------------------------------------------------------------------------------------
// Jednym oknem, bo to jedna decyzja: „czym ta pozycja jest na liście". Reguły idą NIETKNIĘTE —
// te, które preset już ma — więc poprawienie literówki w opisie nie ma jak przypadkiem zapisać
// tego, co ktoś właśnie majstruje na kapslu.
//   t = { name, desc, preset }
function rfCfgIdEditMeta(A, t, after) {
  if (!t || !t.preset || typeof A.savePresetMeta !== "function") return;
  rfModal({
    title: _cfgT("Nazwa i opis konfiguracji", "The configuration's name and description"),
    icon: '<span class="bic bic-save" aria-hidden="true"></span>',
    message: _cfgT("Opis widać na liście i w Bibliotece. Napisz w nim, do czego ta konfiguracja jest. Po tygodniu sama nazwa tego nie powie. Ustawienia zostają bez zmian.",
                   "The description shows on the list and in the Library. Say what this configuration is for. A week later the name alone will not. The settings stay exactly as they are."),
    input: { label: _cfgT("Nazwa", "Name"), maxLength: 40, value: t.name },
    textarea: {
      label: _cfgT("Opis", "Description"), maxLength: _actDescMax(A), value: t.desc || "",
      placeholder: _cfgT("np. Wolfenstein: kamera i strzelanie",
                         "e.g. Wolfenstein: camera and shooting")
    },
    actions: [{ label: _cfgT("Anuluj", "Cancel"), value: false, variant: "ghost" },
              { label: _cfgT("Zapisz", "Save"), value: true, variant: "primary" }]
  }).then(r => {
    if (!r || !r.name) return;
    _rfCfgIdApplyMeta(A, t, String(r.name).trim(), String(r.desc || ""), after);
  });
}

function _rfCfgIdApplyMeta(A, t, name, desc, after) {
  const p = t.preset; if (!p) return;
  const done = _actDone(after);
  const sameFile = name.toLowerCase() === String(t.name).toLowerCase();
  const clash = !sameFile && A.findPreset(name);
  const go = () => A.savePresetMeta(p, name, desc, (err) => {
    if (err) return _actSay(err, true);
    if (name === t.name) { done(name); return _actSay(_cfgT("Zapisano: " + name, "Saved: " + name)); }
    const carriers = rfCfgIdCarriers(A, t.name);
    // ⚠️ STARY PLIK KASUJEMY TYLKO WTEDY, GDY TO NAPRAWDĘ INNY PLIK. Windows nie odróżnia
    // „Gry.json" od „gry.json", więc przy zmianie samej wielkości liter zapis trafił w ten sam
    // plik — a kasowanie „starego" usunęłoby to, co przed chwilą zapisaliśmy.
    const post = () => {
      let left = carriers.length;
      if (!left) { done(name); return _actSay(_cfgT("Zapisano: " + name, "Saved: " + name)); }
      // Kapsle noszące starą nazwę dostają nową. Bez tego zmiana nazwy zamieniałaby je w duchy:
      // preset zniknął spod ich nazwy, choć to my go przemianowaliśmy.
      carriers.forEach(d => A.setCfgNameOn(d, name, () => {
        if (--left) return;
        done(name);
        _actSay(_cfgT("Zapisano: " + name, "Saved: " + name));
      }));
    };
    if (sameFile) post(); else A.deletePreset(t.name, post);
  });
  if (!clash) return go();
  _actAsk(_cfgT("Nadpisać „" + name + "”?", "Overwrite “" + name + "”?"),
    _cfgT("Konfiguracja o tej nazwie już jest w bibliotece i zostanie zastąpiona treścią „" + t.name + "”.",
          "A configuration of that name is already in the library and will be replaced by the contents of “" + t.name + "”."),
    _cfgT("Zapisz", "Save")).then(ok => { if (ok) go(); });
}

// ------------------------------------------------------------------------------------------
//  USUNIĘCIE Z BIBLIOTEKI
// ------------------------------------------------------------------------------------------
// Okno mówi, co się stanie z KAPSLAMI, które tę konfigurację noszą: zostają ze swoimi ustawieniami,
// a przy ich nazwie stanie „tej konfiguracji nie ma już na liście". Bez tego zdania kasowanie
// wyglądałoby na zabranie ustawień z kapsla, a to nieprawda.
function rfCfgIdDeletePreset(A, name, after) {
  if (typeof A.deletePreset !== "function") return;
  const done = _actDone(after);
  const carriers = rfCfgIdCarriers(A, name);
  const msg = carriers.length
    ? _cfgT("Konfiguracja „" + name + "” zniknie z biblioteki. Kapsle, które ją noszą ("
            + carriers.map(A.devName).join(", ") + "), zatrzymają swoje ustawienia; przy ich nazwie stanie „tej konfiguracji nie ma już na liście”.",
            "The configuration “" + name + "” will disappear from the library. The capsules carrying it ("
            + carriers.map(A.devName).join(", ") + ") keep their settings; next to their name it will say “this configuration is no longer on the list”.")
    : _cfgT("Konfiguracja „" + name + "” zniknie z biblioteki. Nie nosi jej żaden kapsel.",
            "The configuration “" + name + "” will disappear from the library. No capsule carries it.");
  _actAsk(_cfgT("Usunąć „" + name + "”?", "Delete “" + name + "”?"), msg,
          _cfgT("Usuń", "Delete"), "danger").then(ok => {
    if (!ok) return;
    A.deletePreset(name, (err) => {
      if (err) return _actSay(err, true);
      done("");
      _actSay(_cfgT("Usunięto: " + name, "Deleted: " + name));
    });
  });
}

// ------------------------------------------------------------------------------------------
//  ZDJĘCIE SAMEJ NAZWY Z KAPSLA
// ------------------------------------------------------------------------------------------
// Ustawienia zostają na kapslu co do wartości, znika wyłącznie podpis. W hubie robiło się to
// przeciągnięciem chipa na tackę i szło BEZ pytania. Na liście presetów (rf-49j) i w Bibliotece
// ✕ stoi przy chipie CUDZEGO kapsla, więc pytanie jest — nie dlatego, że coś ginie, tylko dlatego,
// że działanie dotyczy kogoś innego niż ten, przy którym się stoi. `opts.ask === false` wraca do
// zachowania huba.
function rfCfgIdStripName(A, dev, after, opts) {
  const done = _actDone(after);
  const s = rfCfgIdState(A, dev);
  if (!s.name) return;
  const nm = A.devName(dev);
  const keeps = (typeof A.describeUnname === "function" ? A.describeUnname() : "");
  const go = () => A.setCfgNameOn(dev, "", () => {
    done("");
    _actSay(_cfgT(nm + " nie nosi już nazwy „" + s.name + "”. " + keeps,
                  nm + " no longer carries the name “" + s.name + "”. " + keeps));
  });
  if (opts && opts.ask === false) return go();
  _actAsk(_cfgT("Zdjąć nazwę z " + nm + "?", "Take the name off " + nm + "?"),
    _cfgT(nm + " przestanie twierdzić, że nosi „" + s.name + "”. Ustawienia zostają na kapslu co do wartości, znika sam podpis. " + keeps,
          nm + " stops claiming it carries “" + s.name + "”. The settings stay on the capsule exactly as they are, only the name goes. " + keeps),
    _cfgT("Zdejmij nazwę", "Take the name off")).then(ok => { if (ok) go(); });
}

// ------------------------------------------------------------------------------------------
//  WCZYTANIE NA WSKAZANY KAPSEL
// ------------------------------------------------------------------------------------------
// Z kafla, z listy, z Biblioteki albo przez upuszczenie chipa — jedna droga dla wszystkich.
// Najważniejsze zdanie jest OSTATNIE: co się stanie z niezapisanymi zmianami tamtego kapsla.
function rfCfgIdAskLoadOnto(A, dev, p, after) {
  if (!dev || !p) return;
  const done = _actDone(after);
  const s = rfCfgIdState(A, dev), nm = A.devName(dev), have = _actDescribeDev(A, dev);
  const lost = s.dirty
    ? _cfgT(" ⚠️ Zmiany, które " + nm + " ma teraz w „" + s.name + "”, nie są nigdzie zapisane i przepadną.",
            " ⚠️ The changes " + nm + " has in “" + s.name + "” right now are saved nowhere and will be lost.")
    : (s.name ? "" : _cfgT(" ⚠️ To, co " + nm + " ma teraz, nie jest zapisane pod żadną nazwą, więc przepadnie.",
                           " ⚠️ What " + nm + " has right now is not saved under any name, so it will be lost."));
  const now = have ? (" (" + have + ")") : "";
  _actAsk(_cfgT("Wczytać „" + p.name + "” na " + nm + "?", "Load “" + p.name + "” onto " + nm + "?"),
    _cfgT("To, co " + nm + " ma teraz" + now + ", zostanie zastąpione (" + A.describePreset(p) + "). "
          + A.describeKeeps() + lost,
          "What " + nm + " has now" + now + " will be replaced (" + A.describePreset(p) + "). "
          + A.describeKeeps() + lost),
    _cfgT("Wczytaj", "Load")).then(ok => {
      if (!ok) { done(""); return; }
      // MIGAWKA DO COFNIĘCIA — robiona TUŻ PRZED podmianą, nie przed pytaniem: wczytanie, które
      // się nie powiodło, nie ma prawa zostawić nieaktualnego „Cofnij" dla następnego toastu.
      Promise.resolve(typeof A.stashUndo === "function" ? A.stashUndo(dev) : false).then(stashed => {
        A.applyPresetOn(dev, p, (err) => {
          if (err) { done(""); return _actSay(err, true); }
          done(p.name);
          const msg = _cfgT(nm + " nosi teraz: " + p.name, nm + " now carries: " + p.name);
          if (stashed && typeof _rfUndoShowToast === "function") _rfUndoShowToast(msg);
          else _actSay(msg);
        });
      });
    });
}

// ------------------------------------------------------------------------------------------
//  ZAPISZ ZMIANY / PRZYWRÓĆ
// ------------------------------------------------------------------------------------------
// ZAPISZ ZMIANY = nadpisz konfigurację o tej nazwie tym, co jest na kapslu. Pyta, bo to jedyne
// działanie tej sekcji, które zmienia coś POZA tym kapslem: tę samą konfigurację może nosić kilka.
function rfCfgIdSaveChanges(A, after) {
  const done = _actDone(after);
  const s = rfCfgIdState(A);
  if (!s.name || !s.known) return;
  const cur = A.getDev();
  const users = rfCfgIdCarriers(A, s.name).filter(d => d !== cur);
  const also = users.length
    ? _cfgT(" Tę konfigurację nosi też: " + users.map(A.devName).join(", ")
            + ". Ich ustawienia zostają takie, jakie są; nową wersję dostaną dopiero, gdy ją wczytasz.",
            " It is also carried by: " + users.map(A.devName).join(", ")
            + ". Their settings stay as they are; they get the new version only when you load it.")
    : "";
  // TITLE THROUGH `words`, exactly as in the bar (rf-49, `W("askOverwrite")`). Hard-coded, this
  // window said „Nadpisać „Stream”?" where the very same button in the bar says „Nadpisać koło
  // „Stream”?" — and for MIDI/OSC the difference is not cosmetic: the record is SHARED by two
  // tabs and the title is the only thing that says so. The default (RF_CFGID_WORDS) is
  // „Nadpisać konfigurację „", i.e. the one the bar already uses.
  _actAsk(_cfgW(A, "askOverwrite") + s.name + "”?",
    _cfgT("Zapisana wersja zostanie zastąpiona tym, co masz teraz na kapslu (" + A.describeCurrent() + ")." + also,
          "The saved version will be replaced by what you have on the capsule right now (" + A.describeCurrent() + ")." + also),
    _cfgT("Zapisz zmiany", "Save the changes")).then(ok => {
      if (!ok) return;
      A.overwrite(s.name, (err) => {
        if (err) return _actSay(err, true);
        done(s.name);
        _actSay(_cfgT("Zapisano konfigurację: " + s.name, "Configuration saved: " + s.name));
      });
    });
}

// PRZYWRÓĆ = wczytaj z powrotem zapisaną wersję. Pyta, bo ODRZUCA pracę — i mówi wprost, że ją
// odrzuca, zamiast pytać „na pewno?" bez treści.
function rfCfgIdRevert(A, after) {
  const done = _actDone(after);
  const s = rfCfgIdState(A);
  if (!s.name || !s.known || !s.dirty) return;
  const p = A.findPreset(s.name);
  _actAsk(_cfgT("Wrócić do zapisanej wersji „" + s.name + "”?",
                "Go back to the saved version of “" + s.name + "”?"),
    _cfgT("Zmiany zrobione na tym kapslu przepadną. Jeśli chcesz je zatrzymać, zamknij to okno i użyj „Zapisz zmiany” albo „Zapisz obecne jako preset…”.",
          "The changes made on this capsule will be lost. To keep them, close this window and use “Save the changes” or “Save the current one as a preset…”."),
    _cfgT("Przywróć", "Revert")).then(ok => {
      if (!ok) return;
      A.applyPreset(p, (err) => {
        if (err) return _actSay(err, true);
        done(s.name);
        _actSay(_cfgT("Przywrócono: " + s.name, "Restored: " + s.name));
      });
    });
}
