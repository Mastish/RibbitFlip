"use strict";
// ==================================================================================================
//  PRESET MODUŁU OD KOGOŚ — jedne drzwi dla wszystkich rodzajów
//
//  SKĄD TO SIĘ WZIĘŁO. Do 2026-08-31 preset modułu można było POBRAĆ z Biblioteki, ale nie dało
//  się go wczytać z pliku. Sniffer rozpoznawał preset myszy i MIDI po imieniu i odpowiadał
//  komunikatem „wrzuć plik do folderu Library/MousePresets obok aplikacji i odśwież panel" —
//  jedynym miejscem w tej aplikacji, w którym instrukcją obsługi był Eksplorator Windows.
//  Preset usług sieciowych i preset koła nie miały nawet tego: wpadały w gałąź ZESTAWU (ich
//  koperta też niesie `config`), przechodziły przez podgląd bezpieczeństwa, który mówił
//  „bezpieczne, 0 reguł", i kończyły komunikatem „Pusty lub nieznany zestaw".
//
//  Tutaj jest jedna droga dla wszystkich czterech, prowadzona przez rejestr rodzajów (rf-49-kinds):
//
//      plik → rozpoznanie po `kind` → PODGLĄD (co niesie, jakie klawisze, do kogo mówi)
//           → zapis do biblioteki pod WOLNĄ nazwą → pytanie „wczytać teraz?"
//
//  TRZY ZASADY, KTÓRE TO TRZYMAJĄ:
//
//  1. NIC SIĘ NIE NADPISUJE. Preset o nazwie, którą już masz, ląduje jako „… (2)". Plik od obcej
//     osoby nie ma prawa skasować Twojej pracy, a „Multimedia" to nazwa, którą nada mu co drugi
//     autor. (Do dziś `wheel_preset_put` podmieniał w miejscu preset o tej samej nazwie — import
//     z forum potrafił po cichu zabrać własne koło.)
//
//  2. NAJPIERW BIBLIOTEKA, POTEM KAPSEL. „Wziąłem to z posta" ma znaczyć, że to MASZ, a nie że
//     raz się zmieniły ustawienia. Wczytanie jest osobnym pytaniem i wolno go nie chcieć —
//     plik i tak zostaje. Ta sama zasada, co w imporcie presetu osi (poseImport).
//
//  3. PODGLĄD PRZED WCZYTANIEM, ZAWSZE. „Plik JSON" nie znaczy „nieszkodliwy" i ta aplikacja
//     wie o tym od początku (patrz nagłówek IMPORT SAFETY w ribbitflip_monitor.py). Preset myszy
//     niesie OSIEM pól klawiszowych, a wycinki koła niosą `spec` i `sequence` — czyli dokładnie
//     to samo, co reguła zestawu, razem z makrami. Klasyfikuje je serwer (`/preset/analyze`),
//     tym samym `_classify_spec`, którym ocenia reguły zestawu.
//
//  Zestaw, zestaw na kilka kapsli, preset wyzwalaczy, preset osi i paczka REST mają WŁASNE drzwi
//  z własnymi bramkami (podgląd bezpieczeństwa reguł, wybór ról, kopia osi, przegląd akcji)
//  i tędy NIE chodzą — obejście tamtych bramek byłoby tu jedyną nowością, której nikt nie chce.
//
//  Ładowany PO rf-29 (sniffer go woła) i PO rf-49-kinds (czyta rejestr).
// ==================================================================================================

const RF_PRESETIMP_I18N = {
  "Nie udało się odczytać pliku.": "Could not read the file.",
  "Nie rozpoznano pliku — to nie wygląda na konfigurację RibbitFlip.":
    "File not recognised — this does not look like a RibbitFlip configuration.",
  "Dodaj do biblioteki": "Add it to the library",
  "Anuluj": "Cancel",
};
try { Object.assign(I18N_EN, RF_PRESETIMP_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

function _rfpiT(pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; }
// Liczebnik z rejestru rodzajów (rf-49-kinds). Osobna nazwa, bo bez rejestru (starszy build)
// to zdanie ma dalej wyjść po polsku, a nie zniknąć.
function _rfpiPl(n, f1, f2, f5, e1, e2) {
  return (typeof rfPl === "function") ? rfPl(n, f1, f2, f5, e1, e2)
    : ((n === 1) ? f1 : f5);
}

// Lista pozycji tego rodzaju, prosto z serwera. `items` (z treścią i opisem) tam, gdzie jest;
// same nazwy tam, gdzie serwer nic więcej nie daje — wtedy pozycja to `{name}` i tyle.
async function _rfpiItems(K) {
  if (!K || !K.api || !K.api.list) return [];
  try {
    const j = await fetch(K.api.list).then(r => r.json());
    if (j && Array.isArray(j.items)) return j.items;
    const arr = j && j[K.api.listKey || "presets"];
    if (!Array.isArray(arr)) return [];
    return arr.map(x => (typeof x === "string" ? { name: x } : x));
  } catch (e) { return []; }
}

// Wolna nazwa: „Precyzja" → „Precyzja (2)". Porównanie tym samym kluczem, którym porównuje je
// panel i serwer (zwinięte spacje, bez wielkości liter) — inaczej „Precyzja" i „precyzja "
// wyglądałyby na dwie różne i jedna z nich by drugą nadpisała.
function _rfpiFreeName(base, taken) {
  const key = (s) => (typeof rfCfgIdKey === "function")
    ? rfCfgIdKey(s) : String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const busy = (taken || []).map(x => key(x && x.name != null ? x.name : x));
  let n = String(base || "").trim() || _rfpiT("Preset z posta", "Preset from a post"), i = 2;
  while (busy.indexOf(key(n)) >= 0) { n = base + " (" + i + ")"; i++; }
  return n;
}

// ------------------------------------------------------------------------------------------
//  CO TEN PLIK NIESIE — zdanie, które człowiek czyta przed decyzją
// ------------------------------------------------------------------------------------------
// Fakty przychodzą z serwera STRUKTURALNIE (`/preset/analyze`), bo panel jest dwujęzyczny i to on
// składa tekst. Kolejność zdań jest zawsze ta sama: co to jest → co ustawia → czego dotknie
// na zewnątrz (klawisze, adresy) → gdzie wyląduje.
function _rfpiReview(K, info, saveAs, origName) {
  const L = [];
  const f = {};
  (info.facts || []).forEach(x => { f[x.k] = x.v; });

  if (K.id === "mouse") {
    const mode = { mouse: _rfpiT("kursor", "the cursor"), stick: _rfpiT("drążek", "the stick"),
                   dpad: _rfpiT("krzyżak", "the d-pad") }[f.mode] || f.mode;
    L.push(_rfpiT("Preset myszy: ruch kapsla prowadzi ", "A mouse preset: capsule movement drives ") + mode +
      (f.dwell ? _rfpiT(", klik bez klikania włączony", ", clicking without clicking is on") : "") + ".");
  } else if (K.id === "midi") {
    L.push(_rfpiT("Zestaw mapowań na wyjście muzyczne: ", "A set of mappings to the musical output: ") +
      f.maps + " " + _rfpiPl(f.maps, "mapowanie", "mapowania", "mapowań", "mapping", "mappings") +
      " (" + f.midi + _rfpiT(" MIDI, ", " MIDI, ") + f.osc +
      _rfpiT(" OSC), skala ", " OSC), the ") + f.scale + _rfpiT(".", " scale."));
    L.push(_rfpiT("Klawiszy nie wysyła.", "It sends no keystrokes."));
  } else if (K.id === "rest") {
    L.push(_rfpiT("Zestaw akcji sieciowych: ", "A set of network actions: ") +
      f.apis + " " + _rfpiPl(f.apis, "aplikacja", "aplikacje", "aplikacji", "application", "applications") +
      ", " + f.acts + " " + _rfpiPl(f.acts, "akcja", "akcje", "akcji", "action", "actions") +
      ", " + f.trigs + " " + _rfpiPl(f.trigs, "wyzwalacz", "wyzwalacze", "wyzwalaczy", "trigger", "triggers") + ".");
    if ((info.hosts || []).length) {
      L.push(_rfpiT("Po wczytaniu aplikacja zacznie mówić do: ",
                    "Once loaded, the app will start talking to: ") + info.hosts.join(", ") + ".");
    }
    L.push(_rfpiT("Haseł ani tokenów ten plik nie niesie — te zostają w Twoim sejfie.",
                  "This file carries no passwords and no tokens — those stay in your own vault."));
  } else if (K.id === "synth") {
    L.push(_rfpiT("Scena syntezatora: ", "A synth scene: ") + (f.pads || 0) + " " +
      _rfpiPl(f.pads || 0, "pad", "pady", "padów", "pad", "pads") +
      (f.fxPads ? (", " + f.fxPads + " " +
        _rfpiPl(f.fxPads, "efekt", "efekty", "efektów", "effect pad", "effect pads")) : "") + ".");
    // WŁASNE BRZMIENIA to jedyny fakt, który trzeba powiedzieć wprost: w tej scenie są NAGRANIA
    // autora i jadą razem z plikiem.
    if (f.customSounds) {
      L.push(_rfpiT("W środku są własne brzmienia autora (" + f.customSounds + ") — nagrania jadą razem z plikiem.",
                    "It contains the author's own sounds (" + f.customSounds + ") — the recordings travel with the file."));
    }
    L.push(_rfpiT("Klawiszy nie wysyła.", "It sends no keystrokes."));
  } else if (K.id === "wheel") {
    L.push(_rfpiT("Koło z ", "A wheel with ") + f.slices + " " +
      _rfpiPl(f.slices, "wycinkiem", "wycinkami", "wycinkami", "slice", "slices") + ".");
  }

  // KLAWISZE. Najpierw ile ich jest, a potem — gdy któryś jest ryzykowny — dokładnie który
  // i dlaczego. Lista wszystkiego byłaby ścianą tekstu, a milczenie o ryzykownym byłoby kłamstwem.
  const keys = info.keys || [];
  const risky = keys.filter(k => k.level === "risky");
  if (keys.length) {
    const shown = keys.slice(0, 8).map(k => k.spec).join(", ");
    L.push(_rfpiPl(keys.length, "Wyśle klawisz: ", "Wyśle klawisze: ", "Wyśle klawisze: ",
                   "It will send this key: ", "It will send these keys: ") + shown +
      (keys.length > 8 ? _rfpiT(" i jeszcze " + (keys.length - 8) + ".", " and " + (keys.length - 8) + " more.") : "."));
  }
  if (risky.length) {
    const why = risky.map(k => k.spec + (k.why ? " (" + k.why + ")" : "")).slice(0, 4).join("; ");
    L.push(_rfpiT("⚠️ Uwaga: nie są to zwykłe klawisze do gry — ",
                  "⚠️ Careful: these are not ordinary game keys — ") + why +
      _rfpiT(". Wczytuj tylko od kogoś, komu ufasz.",
             ". Only load this from somebody you trust."));
  }

  // Gdzie to wyląduje. Zmiana nazwy jest tu ważniejsza niż wygląda: bez tego zdania człowiek
  // szuka potem w bibliotece nazwy z posta, a leży tam „… (2)".
  // „Scena" jest rodzaju żeńskiego, reszta nazw męskiego — polszczyzna nie pozwala tego zignorować
  // („zapiszę JĄ", ale „zapiszę GO"). Rodzaj czytamy z samej nazwy, a nie z listy wyjątków, żeby
  // rodzaj dołożony później dostał właściwy zaimek bez pamiętania o tej linijce (ta sama sztuczka,
  // co `_rfpIt` w rf-39g).
  const it = /a$/.test(String(K.pl.one || "").split(" ")[0]) ? "ją" : "go";
  L.push(_rfpiT("Zapiszę " + it + " w bibliotece jako „", "I will save it in the library as “") + saveAs + "”" +
    ((origName && origName !== saveAs)
      ? _rfpiT(" (nazwa „" + origName + "” jest już zajęta, nic nie nadpisuję)",
               " (the name “" + origName + "” is taken, so nothing gets overwritten)")
      : "") +
    _rfpiT(". Nic się nie zmieni, dopóki " + it + " nie wczytasz.", ". Nothing changes until you load it."));
  return L.join(" ");
}

// ------------------------------------------------------------------------------------------
//  IMPORT
// ------------------------------------------------------------------------------------------
async function rfPresetImportObj(o, K) {
  if (!o || !K) return;
  // Scena syntezatora niesie `state`, a nie `config` — to nie jest lista pokręteł, tylko paczka
  // stanu silnika dźwięku, i serwer sprawdza jej kopertę, nie treść. Pole mówi rejestr, żeby nie
  // rozstrzygać tego kolejnym `if`-em po rodzaju.
  const field = K.saveField || "config";
  const cfg = (o[field] && typeof o[field] === "object") ? o[field] : null;
  if (!cfg) {
    rfToast(_rfpiT("Ten plik nie ma ustawień w środku (brak pola „config”).",
                   "This file has no settings inside (no “config” field)."), { tone: "danger" });
    return;
  }

  // 1. Co to niesie — pyta serwer, bo klasyfikator klawiszy jest jego i ma być jeden.
  let info = { facts: [], keys: [], hosts: [], level: "safe" };
  try {
    const r = await fetch("/preset/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: K.id, preset: o })
    }).then(x => x.json());
    if (r && r.ok) info = r;
  } catch (e) { /* starszy serwer: pytamy dalej, tylko bez faktów */ }

  // 2. Wolna nazwa — zanim cokolwiek zapiszemy, bo to zdanie wchodzi do pytania.
  const taken = await _rfpiItems(K);
  const orig = String(o.name || "").trim();
  const saveAs = _rfpiFreeName(orig || _rfpiT("Preset z posta", "Preset from a post"), taken);

  // 3. Pytanie z treścią.
  const ok = (typeof rfConfirm === "function")
    ? await rfConfirm(_rfpiReview(K, info, saveAs, orig), {
        title: (typeof rfKindName === "function" ? rfKindName(K, "one") : "") +
               _rfpiT(" od kogoś", " from somebody"),
        icon: '<span class="bic bic-import" aria-hidden="true"></span>',
        tone: info.level === "risky" ? "danger" : "",
        confirmLabel: _rfpiT("Dodaj do biblioteki", "Add it to the library"),
        cancelLabel: _rfpiT("Anuluj", "Cancel")
      })
    : true;
  if (!ok) return;

  /* 3b. CO JESZCZE JEDZIE W KOPERCIE (2026-09-20). Do dziś import brał z pliku WYŁĄCZNIE `config`
         i opis — więc preset skanera gubił po drodze miniaturę i (od 20.09) zrzuty plansz, mimo
         że autor je wysłał. Rodzaj mówi teraz sam, co jeszcze przepisać (`carry`) i czy ma coś do
         rozpakowania przed zapisem (`onImport` — nazwa funkcji, nie funkcja, żeby rejestr został
         danymi). Zrzuty idą osobnymi żądaniami, bo ciało POST-a jest cięte na 2 MB. */
  const dodatki = {};
  for (const pole of (K.carry || [])) if (o[pole] != null) dodatki[pole] = o[pole];
  if (K.onImport && typeof window[K.onImport] === "function") {
    try { await window[K.onImport](o); } catch (e) { /* preset ma się zapisać także bez obrazów */ }
  }

  // 4. Zapis. Koło ma inny kształt żądania (cały preset razem z kategorią), bo jego magazyn to
  //    lista w Settings, nie katalog z plikami — patrz `inSettings` w rejestrze.
  const body = (K.id === "wheel")
    ? { name: saveAs, category: String(o.category || o.desc || ""), config: cfg }
    : (K.saveField && K.saveField !== "config")
      // Scena syntezatora zapisuje się jako `state` — pole mówi rejestr, żeby nie rozstrzygać
      // tego kolejnym `if`-em po rodzaju.
      ? (function () { const b = { name: saveAs }; b[K.saveField] = cfg; return b; })()
      : Object.assign({ name: saveAs, config: cfg, desc: String(o.desc || "").slice(0, 200) }, dodatki);
  let res = null;
  try {
    res = await fetch(K.api.save, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(x => x.json());
  } catch (e) { res = null; }
  if (!res || !res.ok) {
    rfToast((res && res.error) || _rfpiT("Nie udało się zapisać presetu.", "Could not save the preset."),
      { tone: "danger" });
    return;
  }

  // 5. Odświeżenie wszystkich list, które pokazują te same pliki.
  const A = (typeof rfKindAdapter === "function") ? rfKindAdapter(K) : null;
  try { if (A && typeof A.reloadPresets === "function") A.reloadPresets(saveAs); } catch (e) { }
  try { if (typeof rfLibReload === "function") rfLibReload(); } catch (e) { }
  try { if (typeof rfPresetCols !== "undefined" && rfPresetCols.paintAll) rfPresetCols.paintAll(); } catch (e) { }

  // 6. „Wczytać teraz?" — tym samym oknem, którym pyta o to lista presetów w module, żeby
  //    zdanie o niezapisanych zmianach na kapslu było jedno i to samo. Pozycję bierzemy
  //    ze świeżej listy serwera, a nie z pliku: serwer po drodze sanityzuje, a porównanie
  //    „zmienione" ma porównywać to, co naprawdę leży w bibliotece.
  const fresh = await _rfpiItems(K);
  const key = (s) => (typeof rfCfgIdKey === "function") ? rfCfgIdKey(s) : String(s || "").toLowerCase();
  const p = fresh.filter(x => key(x && x.name) === key(saveAs))[0] || { name: saveAs, config: cfg };
  const done = () => {
    try { if (A && typeof A.reloadPresets === "function") A.reloadPresets(saveAs); } catch (e) { }
    try { if (typeof rfLibReload === "function") rfLibReload(); } catch (e) { }
    try { if (typeof rfPresetCols !== "undefined" && rfPresetCols.paintAll) rfPresetCols.paintAll(); } catch (e) { }
  };
  if (A && typeof rfCfgIdAskLoad === "function") {
    rfToast(_rfpiT("Preset jest w bibliotece: „", "The preset is in the library: “") + saveAs + "”",
      { tone: "ok", ms: 6000 });
    rfCfgIdAskLoad(A, p, done);
    return;
  }
  // Moduł nie doszedł (okno nakładki, zakładka ukryta) — plik i tak jest u siebie, a to jest
  // cała obietnica tej ścieżki.
  rfToast(_rfpiT("Zapisano w bibliotece jako „", "Saved in the library as “") + saveAs +
    _rfpiT("”. Wczytasz go w module, do którego należy.", "”. You load it in the module it belongs to."),
    { tone: "ok", ms: 9000 });
  done();
}

// Wejście z pliku: to samo, co wyżej, plus odczytanie bajtów. Rodzaj rozstrzyga koperta, nigdy
// nazwa pliku — nazwę pliku zmienia każdy, kto go raz zapisze.
function rfPresetImportFile(file, K) {
  const fr = new FileReader();
  fr.onerror = () => rfToast(_rfpiT("Nie udało się odczytać pliku.", "Could not read the file."),
    { tone: "danger" });
  fr.onload = () => {
    let o;
    try { o = JSON.parse(fr.result); }
    catch (e) {
      rfToast(_rfpiT("Nie rozpoznano pliku — nieprawidłowy JSON.", "File not recognised — invalid JSON."),
        { tone: "danger" });
      return;
    }
    const kind = K || ((typeof rfKindByEnv === "function") ? rfKindByEnv(o && o.kind) : null);
    if (!kind) {
      rfToast(_rfpiT("Nie rozpoznano pliku — to nie wygląda na konfigurację RibbitFlip.",
                     "File not recognised — this does not look like a RibbitFlip configuration."),
        { tone: "danger" });
      return;
    }
    rfPresetImportObj(o, kind);
  };
  fr.readAsText(file);
}

window.rfPresetImportFile = rfPresetImportFile;
window.rfPresetImportObj = rfPresetImportObj;
