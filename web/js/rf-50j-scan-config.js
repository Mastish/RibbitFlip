"use strict";
/* SKANER EKRANU — nazwane konfiguracje: adapter do wspólnego komponentu biblioteki (rf-49j).

   ZGŁOSZENIE WŁAŚCICIELA (11.09): „nie da się konfiguracji zapisać — powinna być biblioteka".

   PO CO SKANEROWI NAZWY. Ten moduł dobiera się POD CZŁOWIEKA i to dobieranie trwa: prędkość,
   pasmo, wyprzedzenie, czasy dostępności to dwadzieścia liczb, które razem znaczą „dla tej osoby,
   na tym ekranie". „Mama, wolno", „ja, szybko", „na tablecie" to trzy różne komplety, a bez nazw
   wraca się do nich przez przekręcanie wszystkiego od nowa. Preset jest też jedyną drogą, żeby
   komuś te ustawienia DAĆ — a to jest w sprzęcie wspomagającym połowa roboty.

   DLACZEGO ADAPTER, A NIE WŁASNA LISTA. Biblioteka w panelu jest JEDNYM komponentem dla wszystkich
   modułów: te same cztery działania, ten sam pasek „Konfiguracja: X · zmienione", ten sam hub
   z chipami kapsli, ta sama wymiana z forum. Własna lista w karcie byłaby drugą doktryną obok
   pierwszej — projekt już raz za to zapłacił (dwie listy presetów koła, każda z innymi akcjami).
   Wpięcie się w kontrakt daje też ZAKŁADKI MODUŁU (Konfiguracja · Biblioteka · ℹ), których skaner
   jako jedyny moduł nie miał.

   ⚠️ PRESET NIE NIESIE WŁĄCZNIKA. `SCAN_PRESET_SKIP` po stronie serwera odcina `enabled`:
   wczytanie cudzych ustawień nie ma prawa uzbroić wyjścia. Tak samo robi mysz i koło. */

function _skanCfgDev() { return (typeof _scanDev === "function") ? _scanDev() : "d0"; }

function _skanCfgDevName(dev) {
  const D = (typeof state === "object" && state.devices) ? state.devices[dev] : null;
  const m = (D && D.meta) || {};
  return m.label || m.name || dev || "?";
}

function _skanCfgGotowe() {
  return !!(typeof _SCAN === "object" && _SCAN && _SCAN.u);
}
function _skanCfgNieGotowe() {
  return _scanT("Konfiguracja skanera jeszcze się wczytuje — spróbuj za chwilę.",
    "The scanner's configuration is still loading — try again in a moment.");
}

/* Odcisk konfiguracji. Bez `enabled` i bez `configName`: pierwsze jest przełącznikiem, a nie
   ustawieniem, drugie jest NAZWĄ tego, co porównujemy — gdyby weszło do odcisku, każda
   konfiguracja różniłaby się od siebie samej przez to, jak ją nazwano. */
function skanCfgFingerprint(cfg) {
  const c = Object.assign({}, cfg || {});
  delete c.enabled;
  delete c.configName;
  return Object.keys(c).sort().map(function (k) {
    return k + "=" + JSON.stringify(c[k]);
  }).join("|");
}

function _skanCfgPost(url, body, done) {
  fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  }).then(function (r) { return r.json(); }).then(function (j) {
    if (!j || j.error) return done(String((j && j.error) || _scanT("Serwer odmówił.", "The server refused.")), null);
    done(null, j);
  }).catch(function () {
    done(_scanT("Nie udało się porozmawiać z aplikacją.", "Could not reach the application."), null);
  });
}

/* ZESTAWY Z APLIKACJI JAKO POZYCJE BIBLIOTEKI (11.09).
   Do tej pory „Zrównoważony", „Ostrożny" i reszta siedziały w pasku pod podglądem i były czymś
   INNYM niż zapisana konfiguracja: klikało się je, ale nie dało się ich nazwać, opisać, wysłać
   ani wczytać na drugiego kapsla. Do tego służy biblioteka, więc te konfiguracje
   trafiają właśnie tam.

   ⭐ TREŚĆ ZOSTAJE PO TEJ STRONIE (`RFScan.ZESTAWY`) — serwer tylko zapisuje, co dostanie. Jeden
   komplet liczb: poprawka w zestawie jest od razu tym, co trafia do biblioteki.
   Zasiew jest jednorazowy (znacznik trzyma serwer), więc skasowany zestaw nie wraca sam.

   OD 02.10 ZESTAWY NADĄŻAJĄ ZA WERSJAMI: każdy jedzie z `kod` i `rev`, a serwer zapisuje w kopercie
   `zrodlo` z odciskiem tego, co zasiał. Nowszy `rev` podmienia kopię, której nikt nie ruszył,
   a przeróbce dopisuje `nowsza` — wtedy panel opisu proponuje „Zaktualizuj z aplikacji". */
function scanZestawyDoZasiewu() {
  const NS = window.RFScan || {};
  const Z = NS.ZESTAWY || {};
  return Object.keys(Z).map(function (kod) {
    const z = Z[kod];
    // Pełny komplet, dokładnie jak `zastosujZestaw`: czysta kartka, na nią zestaw.
    const cfg = Object.assign({}, NS.DOMYSLNE || {}, NS.WYGLAD_DOM || {}, z.u || {}, z.w || {});
    delete cfg.enabled;                     // preset nie niesie włącznika (SCAN_PRESET_SKIP)
    cfg.configName = "";
    return { name: z.nazwa, desc: z.opis, config: cfg, kod: kod, rev: z.rev | 0 };
  });
}

// `opcje.sync` — zwykłe wejście w moduł (dopisz tylko przy pierwszym spotkaniu, podmień nietknięte
// starsze wersje); `opcje.force` — nazwy do podmiany mimo zmian; `opcje.sets` — zawęża zasiew, żeby
// „Zaktualizuj" jednego presetu nie przywracał przy okazji zestawów, które ktoś skasował.
function scanZestawySiew(restore, done, opcje) {
  const o = opcje || {};
  _skanCfgPost("/scan-preset/seed", { sets: o.sets || scanZestawyDoZasiewu(), restore: !!restore,
                                      sync: !!o.sync, force: o.force || [] },
    function (err, j) {
      if (!err && j && j.items) {
        state.scanPresets = j.items;
        if (window._rfpc && window._rfpc.paintAll) window._rfpc.paintAll();
      }
      if (typeof done === "function") done(err || null, j || null);
    });
}

/* ZRZUTY PLANSZ Z PRESETU KOLEGI (2026-09-20).

   Zrzuty zrobione dla skanera mają się zapisywać w bibliotece razem z presetem, żeby szły
   do innych przy współdzieleniu. Do 20.09
   preset niósł same nazwy plików, więc po imporcie plansze były, obszary były, a obraz, na którym
   te obszary ustawiano — nie. Teraz koperta niesie `obrazy: {nazwa: data URL}` (dokłada je serwer
   przy pobieraniu pliku), a ta funkcja je rozpakowuje PRZED zapisem presetu.

   ⚠️ JEDEN ZRZUT NA ŻĄDANIE — ciało POST-a jest cięte na 2 MB, a plansza waży do 1,4 MB.
   ⚠️ Zapis idzie z `pod`, czyli POD NAZWĄ Z PRESETU: gdyby serwer nadał własną (po skrócie treści,
      jak przy zwykłym wgraniu), plansze wskazywałyby plik, którego nie ma.
   ⚠️ Niepowodzenie NIE blokuje importu: preset bez obrazu nadal jest wart zapisania — mówi, ile
      jest plansz i gdzie na ekranie pracują skanery, a sam obraz można wgrać u siebie. */
window.rfScanImportObrazy = function (koperta) {
  const obrazy = (koperta && koperta.obrazy && typeof koperta.obrazy === "object") ? koperta.obrazy : null;
  if (!obrazy) return Promise.resolve(0);
  const nazwy = Object.keys(obrazy).slice(0, 16);
  let wgrane = 0;
  return nazwy.reduce(function (kolejka, n) {
    return kolejka.then(function () {
      return fetch("/scan/tlo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pod: n, data: obrazy[n] })
      }).then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.ok) wgrane++; })
        .catch(function () { /* jeden zrzut mniej, preset i tak wchodzi */ });
    });
  }, Promise.resolve()).then(function () {
    // ⚠️ Tony notki to tylko `ok` i `danger` (11-felt-forms-devices.css) — trzeciego nie ma.
    if (wgrane && typeof rfToast === "function") {
      rfToast(_gl("Zrzuty plansz z tego presetu: ", "Screenshots of this preset's views: ")
        + wgrane + "/" + nazwy.length, { tone: wgrane === nazwy.length ? "ok" : "danger" });
    }
    return wgrane;
  });
};

// Zasiew z `sync` raz na start modułu (karta woła `loadScanPresets` przy budowie, potem już tylko
// po zapisach) — tyle wystarczy, żeby nowa wersja zestawu z aktualizacji aplikacji trafiła na listę.
// ⚠️ PO BŁĘDZIE ZASIEWU JEDEN ZWYKŁY ODCZYT LISTY, BEZ ZEROWANIA ZNACZNIKA (UX 261120, F-G5-09).
// Zerowanie i ponowne wołanie dawało pętlę bez przerwy: serwer, który trwale odmawia zasiewu
// (np. katalog Library tylko do odczytu), dostawał tysiące żądań w kilka sekund. Odczyt niżej
// może jeszcze raz spróbować zasiewu (`seeded === false`), ale jego błąd kończy już sprawę.
let _scanSyncZrobiony = false;
function loadScanPresets(done) {
  if (!_scanSyncZrobiony) {
    _scanSyncZrobiony = true;
    return scanZestawySiew(false, function (err) {
      if (err) return loadScanPresets(done);
      if (typeof done === "function") done();
    }, { sync: true });
  }
  fetch("/scan-presets").then(function (r) { return r.json(); }).then(function (m) {
    state.scanPresets = (m && m.items) || [];
    // Pierwsze spotkanie tej biblioteki z zestawami z aplikacji. Pytamy serwer, a nie „czy lista
    // jest pusta": pusta bywa też dlatego, że ktoś skasował wszystko, i wtedy zasiew wracałby
    // w kółko po każdym sprzątaniu.
    if (m && m.seeded === false) return scanZestawySiew(false, function () {
      if (typeof done === "function") done();
    }, { sync: true });
    if (typeof $ !== "undefined" && window._rfpc && window._rfpc.paintAll) window._rfpc.paintAll();
    if (typeof done === "function") done();
  }).catch(function () { if (typeof done === "function") done(); });
}

/* Zdanie o tym, CO ta konfiguracja robi — w oknach wczytania i nadpisania (rf-49-cfgid, rf-49a:
   „To, co X ma teraz (…), zostanie zastąpione (…)") i przy kapslu (`describeDev`). Bez niego okno
   pyta o zgodę na podmianę dwóch rzeczy, których nie nazywa.
   Od 02.10 z tablicy pól: chipy trybu i koszt jednego kliknięcia (`rfScanZdanie`, rf-39i4) — do
   tego dnia stało tu ręczne „paski, płynnie, 700 px/s", które nie wiedziało o ćwiartkach z paskami,
   kolejności w kratce ani o niczym, co doszło po nim. Wiersz listy tego zdania NIE pokazuje: tam
   stoi opis autora (`p.desc`) i metryka (`presetMetric`). */
function _skanCfgOpis(cfg) {
  if (!cfg) return "";
  return (typeof rfScanZdanie === "function") ? rfScanZdanie(cfg) : "";
}

/* MINIATURA PRESETU — zrzut ekranu, na którym ustawiano skanery, zmniejszony do 640 px.

   SKĄD TO SIĘ WZIĘŁO (2026-09-16): gdy użytkownik używał zrzutów, można dodać miniaturę
   (a za duże zrzuty od razu się konwertują i zmniejszają).

   Preset skanera to dwadzieścia pokręteł i kilka prostokątów; z listy w Bibliotece widać samą
   nazwę. Zrzut, na którym te prostokąty powstały, odpowiada na „co to właściwie było" jednym
   spojrzeniem — a mamy go pod ręką, bo od 16.09 każdy EKRAN interfejsu (rf-50n) niesie swój plik.

   Bierzemy zrzut EKRANU OGLĄDANEGO, a gdy żaden nie jest wybrany — pierwszego z listy. Konwersja
   i zmniejszenie dzieją się TUTAJ (canvas → JPEG): obraz i tak jest już w przeglądarce, więc
   serwer nie musi znać ani jednego formatu obrazu. Bez zrzutu miniatury po prostu nie ma —
   pusty obrazek nie niósłby żadnej informacji, a ważyłby tyle samo, co zdanie o jego braku. */
const SKAN_MINI_BOK = 640;        // dłuższy bok miniatury — czytelna w wierszu i w podglądzie pozycji
const SKAN_MINI_JAKOSC = 0.72;    // JPEG: przy tym rozmiarze daje 25–60 kB

function _skanCfgMiniatura(done) {
  const c = (typeof _SCAN !== "undefined" && _SCAN.u) ? _SCAN.u : null;
  const lista = (c && Array.isArray(c.zrzuty)) ? c.zrzuty : [];
  const akt = (c && parseInt(c.zrzutAktywny, 10)) || 0;
  const z = (akt >= 1 && akt <= lista.length) ? lista[akt - 1] : lista[0];
  const plik = z && z.plik;
  if (!plik) return done("");
  const img = new Image();
  // ⚠️ Bez `crossOrigin`: obraz idzie z tego samego serwera, a ustawienie go zmusiłoby do CORS-u
  // i „skaziło" canvas, czyli `toDataURL` rzuciłoby wyjątkiem.
  img.onload = function () {
    try {
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (!w || !h) return done("");
      const skala = Math.min(1, SKAN_MINI_BOK / Math.max(w, h));
      const pl = document.createElement("canvas");
      pl.width = Math.max(1, Math.round(w * skala));
      pl.height = Math.max(1, Math.round(h * skala));
      pl.getContext("2d").drawImage(img, 0, 0, pl.width, pl.height);
      const url = pl.toDataURL("image/jpeg", SKAN_MINI_JAKOSC);
      done(url.indexOf("data:image/jpeg") === 0 ? url : "");
    } catch (e) { done(""); }
  };
  // Brak pliku (preset z innej maszyny, skasowany katalog) nie jest błędem zapisu — po prostu
  // nie ma z czego zrobić miniatury.
  img.onerror = function () { done(""); };
  img.src = "/scan/tlo?plik=" + encodeURIComponent(plik);
}

const SCAN_CFG_ADAPTER = {
  idPrefix: "scan",
  hubTitle: "Konfiguracje skanera",
  getDev: _skanCfgDev,
  devName: _skanCfgDevName,
  listAllDevs: function () { return Object.keys(state.devices || {}).sort(); },
  listOtherDevs: function () {
    const cur = _skanCfgDev();
    return SCAN_CFG_ADAPTER.listAllDevs().filter(function (d) { return d !== cur; });
  },

  // Nazwa jest polem konfiguracji, więc dla edytowanego kapsla przychodzi tą samą drogą, co
  // reszta. O cudzym kapslu mówimy „nie wiem" (pusto) zamiast zgadywać — hub użyje tego tylko do
  // ustawienia chipa, a ten wróci na kafel, gdy odpowiedź dojedzie.
  getCfgName: function (dev) {
    const cur = _skanCfgDev();
    if (!dev || dev === cur) return String((_SCAN.u || {}).configName || "");
    return "";
  },
  setCfgNameOn: function (dev, name, done) {
    const cur = _skanCfgDev();
    const target = dev || cur;
    if (target === cur && !_skanCfgGotowe()) {
      if (typeof rfToast === "function") rfToast(_skanCfgNieGotowe(), { tone: "danger" });
      if (done) done(); return;
    }
    // Serwer SCALA (`set_config` dotyka tylko kluczy, które przyszły), więc zdjęcie podpisu nie
    // ma prawa przepisać dwudziestu pokręteł.
    _skanCfgPost("/scan?dev=" + encodeURIComponent(target), { configName: String(name || "") },
      function (err, j) {
        if (err) { if (typeof rfToast === "function") rfToast(err, { tone: "danger" }); }
        else if (target === cur && _SCAN.u) _SCAN.u.configName = String((j && j.configName) || "");
        if (typeof done === "function") done();
      });
  },
  setCfgName: function (name, done) { return SCAN_CFG_ADAPTER.setCfgNameOn(_skanCfgDev(), name, done); },

  fingerprintCurrent: function () {
    return _skanCfgGotowe() ? skanCfgFingerprint(_scanScal()) : null;
  },
  fingerprintOf: function (dev) {
    return (dev === _skanCfgDev()) ? SCAN_CFG_ADAPTER.fingerprintCurrent() : null;
  },
  fingerprintPreset: function (p) {
    return (p && p.config && typeof p.config === "object") ? skanCfgFingerprint(p.config) : null;
  },

  // Fakt i obrazek wiersza listy presetów (rf-49j2) — 02.10. Bez nich wiersz skanera był samą
  // nazwą z opisem, a miniatura z 16.09 pokazywała się wyłącznie w Bibliotece wszystkich modułów.
  // Metryka = fakty o strukturze + pierwszy chip trybu z tablicy pól (rf-50b2), nie własne zdanie.
  presetMetric: function (p) {
    if (typeof rfScanFakty !== "function") return "";
    const tryb = (window.RFScan && typeof RFScan.naglowek === "function") ? RFScan.naglowek(p && p.config)[0] : "";
    const en = (tryb && typeof I18N_EN !== "undefined" && I18N_EN[tryb]) || tryb;
    return rfScanFakty(p && p.config) + (tryb ? " · " + _scanT(tryb, en) : "");
  },
  // OPIS ZASTĘPCZY (02.10): preset bez zdania autora mówi w wierszu listy i na kaflu zdaniem z tablicy
  // pól (`rfScanZdanie`) zamiast „bez opisu". Osobny hak, a NIE `presetDesc`: tamten trafia do pola
  // „Opis" w oknie „Zmień nazwę" (rf-49j3, rf-49i), więc wygenerowane zdanie zapisałoby się po cichu
  // jako zdanie autora. Bez kawałków, które obok mówi już metryka (fakty, chip trybu).
  presetAutoDesc: function (p) {
    if (!p || String(p.desc || "").trim() || !p.config || typeof rfScanZdanie !== "function") return "";
    const metryka = SCAN_CFG_ADAPTER.presetMetric(p).split(" · ");
    return rfScanZdanie(p.config).split(" · ").filter(function (c) { return metryka.indexOf(c) < 0; }).join(" · ");
  },
  // DYMEK KROPKI „zmienione" (rf-49j2): pierwsze pięć różnic między presetem a tym, co kapsel ma
  // TERAZ. O cudzym kapslu nie wiemy nic bez pytania serwera, więc tam dymek zostaje krótki.
  dirtyWhy: function (dev, p) {
    if (dev !== _skanCfgDev() || !_skanCfgGotowe() || !p || !p.config) return "";
    if (!window.RFScan || typeof RFScan.rozniceKonfiguracji !== "function" || typeof rfScanRoznicaTekst !== "function") return "";
    const r = RFScan.rozniceKonfiguracji(p.config, _scanScal());
    const out = r.slice(0, 5).map(rfScanRoznicaTekst);
    if (r.length > 5) out.push(_scanTf("…i jeszcze {0}", "…and {0} more", r.length - 5));
    return out.join("\n");
  },
  presetThumb: function (p) {
    return (typeof rfScanOkladka === "function" && p)
      ? rfScanOkladka("scan", p.name, { cover: !!p.miniatura }, p.config) : "";
  },

  listPresets: function () { return state.scanPresets || []; },
  findPreset: function (name) {
    const k = rfCfgIdKey(name);
    if (!k) return null;
    return (state.scanPresets || []).find(function (p) { return rfCfgIdKey(p.name) === k; }) || null;
  },
  saveAs: function (name, done, desc) {
    if (!_skanCfgGotowe()) return done(_skanCfgNieGotowe());
    // MINIATURA JEST CZĘŚCIĄ ZAPISU, nie osobnym krokiem — gdy w konfiguracji jest zrzut, preset
    // dostaje go w kopercie zmniejszonego. Budowa trwa moment (canvas), więc zapis czeka.
    _skanCfgMiniatura(function (mini) {
      _skanCfgPost("/scan-preset/save",
        { name: name, config: _scanScal(), desc: String(desc || ""), miniatura: mini || "" },
        function (err) {
          if (err) return done(err);
          loadScanPresets(function () { done(null); });
        });
    });
  },
  // ⚠️ Nadpisanie MUSI oddać opis, który preset już ma — zapis idzie jedną drogą z „Zapisz jako…",
  // więc bez tego „Zapisz zmiany" kasowałoby opis po cichu przy każdym zapisie ustawień.
  overwrite: function (name, done) {
    const p = SCAN_CFG_ADAPTER.findPreset(name);
    return SCAN_CFG_ADAPTER.saveAs(name, done, (p && p.desc) || "");
  },
  savePresetMeta: function (p, name, desc, done) {
    _skanCfgPost("/scan-preset/save", { name: name, config: (p && p.config) || {}, desc: String(desc || "") },
      function (err) { done(err || null); });
  },
  deletePreset: function (name, done) {
    _skanCfgPost("/scan-preset/delete", { name: name }, function (err) { done(err || null); });
  },
  reloadPresets: function () { loadScanPresets(); },

  applyPresetOn: function (dev, p, done) {
    const cur = _skanCfgDev();
    const target = dev || cur;
    _skanCfgPost("/scan-preset/load?dev=" + encodeURIComponent(target), { name: p.name },
      function (err, j) {
        if (err) return done(err);
        // Serwer sam nadaje kapslowi nazwę wczytanego presetu, a odpowiedź jest pierwszym
        // miejscem, w którym to widać — wyprzedza rozgłoszenie po strumieniu.
        if (target === cur && j && j.config && typeof scanCfgArrived === "function") scanCfgArrived(j.config);
        done(null);
      });
  },
  applyPreset: function (p, done) { return SCAN_CFG_ADAPTER.applyPresetOn(_skanCfgDev(), p, done); },

  // Migawki do cofnięcia skaner jeszcze nie ma (`_rfUndoStash` zna moduły, które ją zgłosiły).
  // Mówimy o tym wprost przez `false`, zamiast obiecywać „Cofnij", które nic nie cofnie.
  stashUndo: function () { return Promise.resolve(false); },

  copyTo: function (dev, done) {
    if (!_skanCfgGotowe()) return done(_skanCfgNieGotowe());
    const body = _scanScal();
    delete body.enabled;             // kopia ustawień nie uzbraja cudzego wyjścia
    _skanCfgPost("/scan?dev=" + encodeURIComponent(dev), body, function (err) { done(err || null); });
  },

  describeCurrent: function () { return _skanCfgGotowe() ? _skanCfgOpis(_scanScal()) : ""; },
  describePreset: function (p) { return _skanCfgOpis(p && p.config); },
  describeDev: function (dev) {
    return (dev === _skanCfgDev()) ? SCAN_CFG_ADAPTER.describeCurrent() : "";
  },
  // GRANICA PRESETU wyłożona wprost: co zostaje kapsla własne po wczytaniu cudzych ustawień.
  describeKeeps: function () {
    return _scanT("Włącznik modułu Skaner zostaje taki, jaki jest — preset go nie niesie. "
      + "Reguły, które dają sygnał, też zostają: mieszkają w Mapowaniu.",
      "The Scanner module's switch stays as it is — the preset does not carry it. The rules that "
      + "provide the signal stay too: they live in Mapping.");
  }
};

/* BAZA „CO ZMIENI WCZYTANIE" — konfiguracja kapsla, na który trafi „Wczytaj" (w module i w Bibliotece
   to ten sam kapsel: adapter `getDev`). Edytowany kapsel mamy pod ręką; inny dociągamy z serwera
   i oddajemy przez `gotowa`. `null` = nie ma żadnego kapsla, wtedy opis porównuje z domyślnymi. */
function scanBazaWczytania(gotowa) {
  const dev = _skanCfgDev();
  if (!(typeof state === "object" && state.devices && state.devices[dev])) return null;
  const tytul = _scanT("Co zmieni wczytanie na ", "What loading changes on ") + _skanCfgDevName(dev);
  if (_skanCfgGotowe() && (!_SCAN.dev || _SCAN.dev === dev)) return { cfg: _scanScal(), tytul: tytul };
  fetch("/scan?dev=" + encodeURIComponent(dev)).then(function (r) { return r.json(); })
    .then(function (cfg) { if (cfg && typeof cfg === "object" && typeof gotowa === "function") gotowa({ cfg: cfg, tytul: tytul }); })
    .catch(function () { /* zostaje zdanie „sprawdzam" — lepsze niż różnice wobec zgadniętej bazy */ });
  return { cfg: null, tytul: tytul };
}

/* „JEST NOWSZA WERSJA" — chip i przycisk w panelu opisu presetu zasianego z aplikacji, który ktoś
   przerobił, zanim zestaw dostał nowy `rev`. Nietkniętych to nie dotyczy: te serwer podmienia sam. */
function scanZestawNowszy(p) {
  const Z = (window.RFScan && RFScan.ZESTAWY) || {};
  const z = (p && p.zrodlo) ? Z[p.zrodlo] : null;
  if (!z || !((p.nowsza | 0) > (p.zrodloRev | 0))) return null;
  const box = document.createElement("div");
  box.className = "scp-nowsza";
  const chip = document.createElement("span");
  chip.className = "scp-chip nowa";
  chip.textContent = _scanTf("jest nowsza wersja (v{0})", "a newer version exists (v{0})", p.nowsza | 0);
  box.appendChild(chip);
  const b = document.createElement("button");
  b.type = "button"; b.className = "btn sm";
  b.textContent = _scanT("Zaktualizuj z aplikacji", "Update from the app");
  b.title = _scanT("Podmienia ustawienia tego presetu na nową wersję zestawu z aplikacji. Twoje zmiany w nim przepadną.",
                   "Replaces this preset's settings with the app's new version of the set. Your changes to it will be lost.");
  b.onclick = function () {
    const zestaw = scanZestawyDoZasiewu().filter(function (x) { return x.kod === p.zrodlo; });
    const idz = function () {
      b.disabled = true;
      scanZestawySiew(true, function (err, j) {
        b.disabled = false;
        if (typeof rfToast !== "function") return;
        if (err) return rfToast(err, { tone: "danger" });
        rfToast((j && j.updated) ? _scanTf("„{0}” ma teraz wersję z aplikacji.", "“{0}” now has the app's version.", p.name)
                                 : _scanT("Nic nie trzeba było zmieniać.", "Nothing needed changing."),
                { tone: (j && j.updated) ? "ok" : "" });
        if (typeof rfLibReload === "function") { try { rfLibReload(); } catch (e) { } }
      }, { sets: zestaw, force: [p.name] });
    };
    if (typeof rfConfirm !== "function") return idz();
    rfConfirm(_scanTf("Preset „{0}” ma Twoje zmiany. Wersja {1} z aplikacji je zastąpi.",
                      "Preset “{0}” has your changes. Version {1} from the app will replace them.", p.name, p.nowsza | 0),
              { title: _scanT("Zaktualizować z aplikacji?", "Update from the app?"),
                confirmLabel: _scanT("Zaktualizuj", "Update"), tone: "danger" })
      .then(function (tak) { if (tak) idz(); });
  };
  box.appendChild(b);
  return box;
}

// Pasek „Konfiguracja: X · zmienione" w karcie odświeża się przez tę nazwę (pole `sync` w rf-49j).
function scanCfgColSync() {
  try { if (typeof rfCfgIdSync === "function") rfCfgIdSync("skaner"); } catch (e) { }
}

/* „PRZYWRÓĆ ZESTAWY Z APLIKACJI" — w stopce listy, obok „Zapisz obecne jako…".
   Po co: zestaw skasowany nie wraca sam (zasiew jest jednorazowy — i tak ma być, bo inaczej
   sprzątanie po sobie byłoby bezcelowe). Bez tego przycisku „Ostrożny" usunięty jednym kliknięciem
   trzeba by odtwarzać z pamięci, pokrętło po pokrętle.
   Dokłada wyłącznie BRAKUJĄCE — cudza przeróbka pod tą samą nazwą zostaje przeróbką.

   ⚠️ ODDAJE przycisk, nie wstawia go sam: stopkę czyści `paintFoot` przy każdym przerysowaniu
   listy (wyszukiwanie, zapis, usunięcie), więc dokładanie z zewnątrz gubiłoby się po pierwszym
   wpisanym znaku. Wywołuje to `footBtn` we wpisie modułu w MODS. */
function scanFootRestoreBtn() {
  const b = document.createElement("button");
  b.type = "button"; b.id = "scanRestoreSets"; b.className = "btn sm";
  // Słownik syntezy (UX 261120, P-G2-04): ustawienia jednego modułu to „preset", „zestaw" to całość pod grę.
  b.textContent = _scanT("Przywróć gotowe presety", "Restore ready presets");
  b.title = _scanT("Dokłada te gotowe presety z aplikacji, których nie ma na liście. Twoich nie rusza.",
                   "Adds back the app's ready presets that are missing from the list. It does not touch yours.");
  b.onclick = function () {
    b.disabled = true;
    scanZestawySiew(true, function (err, j) {
      b.disabled = false;
      if (typeof rfToast !== "function") return;
      if (err) return rfToast(err, { tone: "danger" });
      const ile = (j && j.added) || 0;
      rfToast(ile
        ? _scanTf("Wróciło presetów: {0}.", "Presets restored: {0}.", ile)
        : _scanT("Wszystkie gotowe presety już tu są.", "The ready presets are all here already."),
        { tone: ile ? "" : "info" });
    });
  };
  return b;
}
