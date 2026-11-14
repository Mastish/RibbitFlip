"use strict";
// ==================================================================================================
//  KASETY ZESTAWÓW — zestaw wygląda jak filcowa kaseta magnetofonowa (2026-11-22)
//
//  PROŚBA WŁAŚCICIELA: moduł „Zestawy" (biblioteka gotowych ustawień, wczytywanych z pliku albo
//  z forum) ma wyglądać jak kasety z filcu. Zestaw to „nagranie" pod jedną grę: wkłada się je
//  i gra. Stąd cztery rzeczy w tym pliku:
//
//    1. OSIEM KASET do wyboru (`web/assets/kasety/N-160.png` i `N-360.png`, wygenerowane jedną
//       serią: ten sam układ, różne kolory i naklejki bez tekstu). Autor wybiera kasetę przy
//       zapisie, a wybór jedzie w pliku jako pole koperty `cassette` (1–8, serwer: `_sanitize_cassette`).
//       Plik bez pola, z liczbą spoza zakresu albo ze śmieciem = kaseta 1, tak samo tu i na serwerze.
//    2. WYBÓR przy zapisie: przycisk z miniaturą w pasku „Zapisz obecną konfigurację jako zestaw"
//       i ta sama siatka w kreatorze posta (rf-39f). Obie siatki piszą do jednego ukrytego pola
//       `#setupCassette` — ten sam wzorzec bliźniaczych pól, co nick, wersja i instrukcja.
//       Dopóki autor nie wybierze sam, pole PODPOWIADA: kasetę zestawu o wpisanej nazwie (nadpisanie
//       nie zmienia wyglądu), a dla nowej nazwy kasetę najrzadziej używaną na liście — Biblioteka
//       sama robi się różnobarwna i dwa zestawy rzadko wyglądają tak samo.
//    3. PODGLĄD: kaseta na liście Biblioteki (rf-39i3), duża kaseta z opisem od twórcy i „Co robi"
//       w panelu opisu (rf-39i2), kaseta w oknie importu z pliku i z forum (rf-28 `rfSafetyModal`).
//       Klik w dużą kasetę WŁASNEGO zestawu zmienia mu kasetę bez ponownego zapisu (`/setup/cassette`
//       zmienia jedno pole pliku); najechanie na nią kręci szpulami.
//    4. ANIMACJA WCZYTANIA: kaseta wsuwa się do filcowej kieszeni, szpule kręcą się chwilę i widać
//       „Wczytane". Wczytanie zestawu przeładowuje panel, więc animacja gra PO przeładowaniu:
//       wołający zapowiada ją (`rfKasetaZapowiedz`), a `initKasety` odtwarza zapowiedź raz.
//       Warstwa ma `pointer-events:none` i znika sama po dwóch sekundach, więc niczego nie blokuje.
//       Przy `prefers-reduced-motion` kaseta stoi od razu na miejscu i tylko łagodnie się pojawia.
//
//  PRZEDMIOTY TO FILCOWE OBRAZY. Kręcące się szpule nie są rysowane w kodzie: każda szpula to
//  okrągły wycinek TEGO SAMEGO obrazka kasety, obracany wokół środka szpuli (środki zmierzone na
//  obrazkach, `RF_KASETY[n].szp`, promień `RF_KASETA_R` jako ułamek szerokości, proporcje `ar`).
//  Położenie liczone w procentach, więc wycinek trzyma się szpuli przy każdej szerokości kasety.
//
//  Ładowany po rf-28c (czyta `rfRoleHeadHtml`, `rfSetupAboutHtml`) i przed rf-29 / rf-39i*,
//  które wołają stąd funkcje dopiero w chwili rysowania albo kliknięcia (zawsze przez `typeof`).
// ==================================================================================================

// `ar` = wysokość / szerokość obrazka N-360.png (te same proporcje ma N-160.png).
const RF_KASETY = {
  1: { pl: "czarna z piorunem",        en: "black with a lightning bolt", ar: 0.7556, szp: [[0.2833, 0.5000], [0.7139, 0.5037]] },
  2: { pl: "różowa z gwiazdą",         en: "pink with a star",            ar: 0.7500, szp: [[0.2806, 0.5000], [0.7139, 0.5000]] },
  3: { pl: "zielona z żabimi oczami",  en: "green with frog eyes",        ar: 0.7583, szp: [[0.2806, 0.5018], [0.7139, 0.5018]] },
  4: { pl: "musztardowa z czaszką",    en: "mustard with a skull",        ar: 0.7528, szp: [[0.2861, 0.4982], [0.7111, 0.5018]] },
  5: { pl: "kraftowa z sercem",        en: "kraft with a heart",          ar: 0.7556, szp: [[0.2833, 0.5000], [0.7139, 0.5000]] },
  6: { pl: "czarna z szachownicą",     en: "black with a checkerboard",   ar: 0.7583, szp: [[0.2833, 0.5055], [0.7139, 0.5055]] },
  7: { pl: "limonkowa z tęczą",        en: "lime with a rainbow",         ar: 0.7556, szp: [[0.2861, 0.5037], [0.7111, 0.5037]] },
  8: { pl: "oliwkowa z kapslem",       en: "olive with a bottle top",     ar: 0.7528, szp: [[0.2806, 0.4945], [0.7111, 0.4945]] },
};
const RF_KASETA_IDS = Object.keys(RF_KASETY).map(Number);
const RF_KASETA_DOMYSLNA = 1;
const RF_KASETA_R = 0.062;          // promień szpuli: ułamek szerokości obrazka (zmierzone na 1–8)
const _KAS_PLAY_KEY = "ribbitflip.kaseta.play";
const _KAS_PLAY_TTL = 20000;        // zapowiedź starsza niż 20 s to już nie „przed chwilą wczytany"

const RF_KASETY_I18N = {
  "Kaseta": "Cassette",
  "Kaseta zestawu": "Setup cassette",
  "Wybierz kasetę zestawu": "Pick the setup's cassette",
  "Tak ten zestaw wygląda na liście i u osób, którym go wyślesz.":
    "This is how the setup looks in the list and for the people you send it to.",
  "Wczytane": "Loaded",
  "Kliknij, żeby wybrać inną kasetę.": "Click to pick another cassette.",
  "Opis od twórcy": "Creator's description",
  "Twórca nie dodał opisu.": "The creator added no description.",
  "Co robi": "What it does",
  "Czytam zestaw…": "Reading the setup…",
  "Nie udało się odczytać zestawu.": "Could not read the setup.",
  "Ten zestaw nie niesie reguł, tylko ustawienia modułów (lista niżej).":
    "This setup carries no rules, only module settings (listed below).",
  "Zmień kasetę": "Change cassette",
  "Zmień kasetę zestawu": "Change the setup's cassette",
  "Zmieniam tylko kasetę w pliku tego zestawu, reszta zostaje bez zmian.":
    "I change only the cassette in this setup's file, everything else stays as it is.",
  "Zestaw z aplikacji ma stałą kasetę. Zapisz go pod swoją nazwą, żeby wybrać inną.":
    "A built-in setup keeps its cassette. Save it under your own name to pick another one.",
  "Nie udało się zmienić kasety.": "Could not change the cassette.",
  "czarna z piorunem": "black with a lightning bolt",
  "różowa z gwiazdą": "pink with a star",
  "zielona z żabimi oczami": "green with frog eyes",
  "musztardowa z czaszką": "mustard with a skull",
  "kraftowa z sercem": "kraft with a heart",
  "czarna z szachownicą": "black with a checkerboard",
  "limonkowa z tęczą": "lime with a rainbow",
  "oliwkowa z kapslem": "olive with a bottle top",
};
try { Object.assign(I18N_EN, RF_KASETY_I18N); } catch (e) { /* okno bez słownika: zostaje polski */ }

function _kasT(pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; }
function _kasEl(tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}
function _kasEsc(s) { return (typeof miEsc === "function") ? miEsc(s) : String(s == null ? "" : s); }
function _kasReduced() {
  try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  catch (e) { return false; }
}

// ------------------------------------------------------------------------------------------
//  DANE: numer kasety, adres obrazka, nazwa
// ------------------------------------------------------------------------------------------
// Ta sama reguła, co `_sanitize_cassette` po stronie serwera: liczba całkowita 1–8 (także zapisana
// tekstem), wszystko inne = kaseta domyślna. Dwie reguły, które różnią się na brzegach, dałyby
// kasetę, która na liście wygląda inaczej niż w podglądzie importu tego samego pliku.
function rfKaseta(v) {
  if (typeof v === "boolean" || v == null || v === "") return RF_KASETA_DOMYSLNA;
  const n = Number(v);
  return (Number.isInteger(n) && RF_KASETY[n]) ? n : RF_KASETA_DOMYSLNA;
}
function rfKasetaSrc(v, duza) { return "/web/assets/kasety/" + rfKaseta(v) + "-" + (duza ? 360 : 160) + ".png"; }
// „Kaseta 3: zielona z żabimi oczami" — czytnik ekranu i dymek mówią, KTÓRA to kaseta, bo sam numer
// nic nie znaczy dla kogoś, kto nie widzi obrazka.
function rfKasetaNazwa(v) {
  const k = rfKaseta(v), K = RF_KASETY[k];
  return _kasT("Kaseta", "Cassette") + " " + k + ": " + _kasT(K.pl, K.en);
}
function rfKasetaImg(v, duza, cls) {
  const im = document.createElement("img");
  im.className = "rf-kaseta" + (cls ? " " + cls : "");
  im.src = rfKasetaSrc(v, duza);
  im.alt = rfKasetaNazwa(v);
  im.draggable = false;
  im.decoding = "async";
  return im;
}
// SZPULE: dwa okrągłe wycinki obrazka nałożone dokładnie na szpule. Wszystko w procentach szerokości
// i wysokości kasety, więc `holder` (element o rozmiarze obrazka, z `position:relative`) może mieć
// dowolną szerokość. Pochodzenie wzorów: wycinek ma średnicę d = 2R·W, tło ma szerokość W, a pozycja
// tła w procentach to p·(d − W) — stąd p = (x − R) / (1 − 2R) i q = (y·ar − R) / (ar − 2R).
function _kasReels(holder, v, duza) {
  const k = rfKaseta(v), K = RF_KASETY[k], R = RF_KASETA_R, ar = K.ar;
  const src = rfKasetaSrc(k, duza);
  return K.szp.map(function (xy) {
    const x = xy[0], y = xy[1];
    const r = _kasEl("span", "kas-reel");
    r.setAttribute("aria-hidden", "true");
    r.style.backgroundImage = "url(" + src + ")";
    r.style.width = (2 * R * 100).toFixed(3) + "%";
    r.style.left = ((x - R) * 100).toFixed(3) + "%";
    r.style.top = ((y - R / ar) * 100).toFixed(3) + "%";
    r.style.backgroundSize = (100 / (2 * R)).toFixed(3) + "% auto";
    r.style.backgroundPosition = ((x - R) / (1 - 2 * R) * 100).toFixed(3) + "% " +
                                 ((y * ar - R) / (ar - 2 * R) * 100).toFixed(3) + "%";
    holder.appendChild(r);
    return r;
  });
}

// ------------------------------------------------------------------------------------------
//  WYBÓR KASETY PRZY ZAPISIE — jedno ukryte pole, dowolnie wiele siatek
// ------------------------------------------------------------------------------------------
// `data-touched` odróżnia „autor wybrał kasetę" od „stoi podpowiedź". Przy nadpisaniu zestawu pod tą
// samą nazwą nietknięty wybór bierze kasetę z zapisanej wersji (rf-29 `setupSave`), dokładnie jak
// puste pola gry i opisu — inaczej poprawka reguł zmieniałaby zestawowi wygląd bez słowa.
function _kasPole() {
  let p = document.getElementById("setupCassette");
  if (!p) {
    p = document.createElement("input");
    p.type = "hidden"; p.id = "setupCassette"; p.value = String(RF_KASETA_DOMYSLNA);
    const host = document.getElementById("setupMetaHidden") || document.body;
    host.appendChild(p);
  }
  return p;
}
function rfKasetaWybrana() {
  const p = _kasPole();
  return { id: rfKaseta(p.value), touched: p.getAttribute("data-touched") === "1" };
}
function rfKasetaUstaw(v, touched) {
  const k = rfKaseta(v), p = _kasPole();
  p.value = String(k);
  if (touched) p.setAttribute("data-touched", "1");
  else if (touched === false) p.removeAttribute("data-touched");
  // Tylko siatki związane z polem zapisu — siatka „zmień kasetę zapisanego zestawu" ma własny stan.
  document.querySelectorAll(".kas-grid.kas-grid-pole").forEach(function (g) { _kasGridSync(g, k); });
  document.querySelectorAll(".kas-btn").forEach(function (b) {
    const im = b.querySelector("img.rf-kaseta");
    if (im) { im.src = rfKasetaSrc(k, false); im.alt = ""; }
    b.title = rfKasetaNazwa(k) + ". " + _kasT("Kliknij, żeby wybrać inną kasetę.", "Click to pick another cassette.");
    b.setAttribute("aria-label", _kasT("Kaseta zestawu", "Setup cassette") + ": " + rfKasetaNazwa(k));
  });
}
function _kasGridSync(g, k) {
  g.querySelectorAll(".kas-opt").forEach(function (o) {
    const on = (rfKaseta(o.getAttribute("data-k")) === k);
    o.classList.toggle("on", on);
    o.setAttribute("aria-checked", on ? "true" : "false");
    o.tabIndex = on ? 0 : -1;
  });
}
// Siatka ośmiu kaset (role=radiogroup, strzałki przesuwają wybór — wzorzec WAI-ARIA „radio group").
// Bez `opts` siatka pisze do pola zapisu (`#setupCassette`); z `opts.get` / `opts.set` ma własny stan.
// `onPick` dostaje numer kasety po kliknięciu, Enterze albo spacji (strzałka tylko przesuwa wybór).
function rfKasetaSiatka(onPick, opts) {
  const o0 = opts || {};
  const pole = !o0.get;
  const get = o0.get || function () { return rfKasetaWybrana().id; };
  const set = o0.set || function (k) { rfKasetaUstaw(k, true); };
  const g = _kasEl("div", "kas-grid" + (pole ? " kas-grid-pole" : ""));
  g.setAttribute("role", "radiogroup");
  g.setAttribute("aria-label", _kasT("Kaseta zestawu", "Setup cassette"));
  const ustaw = function (k) { set(k); if (!pole) _kasGridSync(g, rfKaseta(k)); };
  RF_KASETA_IDS.forEach(function (k) {
    const o = _kasEl("button", "kas-opt");
    o.type = "button";
    o.setAttribute("role", "radio");
    o.setAttribute("data-k", String(k));
    o.setAttribute("aria-label", rfKasetaNazwa(k));
    o.title = rfKasetaNazwa(k);
    const im = rfKasetaImg(k, false);
    im.alt = "";
    o.appendChild(im);
    o.addEventListener("click", function () {
      ustaw(k);
      if (onPick) onPick(k);
    });
    g.appendChild(o);
  });
  g.addEventListener("keydown", function (e) {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys) && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const ids = RF_KASETA_IDS;
    // Strzałki w siatce bez pola zapisu tylko przesuwają fokus i zaznaczenie w siatce — zapis
    // (zmiana kasety pliku) dzieje się dopiero na klik, Enter albo spację.
    const on = g.querySelector(".kas-opt.on");
    let i = ids.indexOf(rfKaseta(on ? on.getAttribute("data-k") : get()));
    if (e.key === "Home") i = 0;
    else if (e.key === "End") i = ids.length - 1;
    else i = (i + keys[e.key] + ids.length) % ids.length;
    if (pole) rfKasetaUstaw(ids[i], true); else _kasGridSync(g, ids[i]);
    const b = g.querySelector('.kas-opt[data-k="' + ids[i] + '"]');
    if (b) b.focus();
  });
  _kasGridSync(g, rfKaseta(get()));
  return g;
}

// Okienko z siatką pod przyciskiem. Jedno naraz; Escape, klik obok albo wybór zamyka.
// `opts`: {title, sub, get, set, onPick} — bez nich okienko wybiera kasetę do zapisu.
let _kasPop = null;
function _kasPopClose(focusBtn) {
  if (!_kasPop) return;
  const p = _kasPop; _kasPop = null;
  try { document.removeEventListener("keydown", p._onKey, true); document.removeEventListener("pointerdown", p._onOut, true); } catch (e) { }
  if (p._btn) { p._btn.setAttribute("aria-expanded", "false"); if (focusBtn) try { p._btn.focus(); } catch (e) { } }
  p.remove();
}
function _kasPopOpen(btn, opts) {
  if (_kasPop) { const was = _kasPop._btn; _kasPopClose(true); if (was === btn) return; }
  const o = opts || {};
  const title = o.title || _kasT("Wybierz kasetę zestawu", "Pick the setup's cassette");
  const p = _kasEl("div", "kas-pop");
  p.setAttribute("role", "dialog");
  p.setAttribute("aria-label", title);
  p.appendChild(_kasEl("div", "kas-pop-h", title));
  p.appendChild(_kasEl("div", "kas-pop-s", o.sub || _kasT("Tak ten zestaw wygląda na liście i u osób, którym go wyślesz.",
    "This is how the setup looks in the list and for the people you send it to.")));
  const g = rfKasetaSiatka(function (k) {
    if (o.onPick) o.onPick(k);
    setTimeout(function () { _kasPopClose(true); }, 140);
  }, o.get ? { get: o.get, set: o.set || function () { } } : null);
  p.appendChild(g);
  document.body.appendChild(p);
  const r = btn.getBoundingClientRect();
  const w = p.offsetWidth, h = p.offsetHeight;
  let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
  let top = r.bottom + 8;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
  p.style.left = Math.round(left) + "px";
  p.style.top = Math.round(top) + "px";
  p._btn = btn;
  btn.setAttribute("aria-expanded", "true");
  p._onKey = function (e) { if (e.key === "Escape") { e.stopPropagation(); _kasPopClose(true); } };
  p._onOut = function (e) { if (!p.contains(e.target) && e.target !== btn && !btn.contains(e.target)) _kasPopClose(false); };
  document.addEventListener("keydown", p._onKey, true);
  document.addEventListener("pointerdown", p._onOut, true);
  _kasPop = p;
  const on = g.querySelector(".kas-opt.on") || g.querySelector(".kas-opt");
  if (on) on.focus();
}
function _kasSaveRowButton() {
  const row = document.getElementById("setupSaveRow");
  const save = document.getElementById("setupSave");
  if (!row || !save || document.getElementById("setupKasetaBtn")) return;
  const b = _kasEl("button", "btn sm kas-btn");
  b.type = "button"; b.id = "setupKasetaBtn";
  b.setAttribute("aria-haspopup", "dialog");
  b.setAttribute("aria-expanded", "false");
  const im = rfKasetaImg(rfKasetaWybrana().id, false, "kas-btn-img");
  im.alt = "";
  // SAMA KASETA, BEZ NAPISU: przycisk z napisem „Kaseta" (88 px) spychał „Wymianę" do drugiego
  // wiersza już przy oknie 1100 px. Miniatura jest swoim własnym podpisem, a nazwę i to, co robi
  // klik, mówią dymek i `aria-label` (rfKasetaUstaw).
  b.appendChild(im);
  b.appendChild(_kasEl("span", "kas-btn-strut", "\u200b"));   // wysokość linii tekstu = wysokość sąsiednich przycisków
  b.addEventListener("click", function () { _kasPopOpen(b); });
  save.parentNode.insertBefore(b, save);
  rfKasetaUstaw(rfKasetaWybrana().id);   // dymek z nazwą kasety od pierwszej klatki
  // Nazwa wpisana w pasku decyduje o podpowiedzi: nazwa istniejącego zestawu pokazuje jego kasetę.
  const nm = document.getElementById("setupName");
  if (nm) nm.addEventListener("input", _kasPodpowiedz);
}
// Wiersz kreatora posta (rf-39f): ta sama siatka, to samo pole. Zwraca wiersz, żeby kreator mógł
// go chować przy rodzajach, które kasety nie mają (presety modułów, paczki REST).
function rfKasetaPickerRow() {
  // `div`, nie `<label>` jak przy polach tekstowych: etykieta bez `for` przekazuje klik pierwszemu
  // przyciskowi w środku, więc klik w napis wybierałby kasetę 1. Klasa ta sama, więc układ też.
  const row = _kasEl("div", "rfs-row kas-rfs");
  const lab = _kasEl("div", "rfs-lab");
  lab.appendChild(_kasEl("span", null, _kasT("Kaseta", "Cassette")));
  lab.appendChild(rfKasetaSiatka(null));
  row.appendChild(lab);
  return row;
}

// PODPOWIEDŹ KASETY. Dopóki autor sam nie wybrał (`data-touched`): nazwa istniejącego zestawu =
// jego kaseta (zapis i tak ją zachowa, więc przycisk ma pokazywać prawdę), nowa nazwa = kaseta
// najrzadziej używana na liście (remis: niższy numer). Liczone z indeksu Biblioteki, który
// rf-39i podaje po każdym przeładowaniu listy (`rfKasetaPoBibliotece`).
let _kasLib = [];
function _kasPodpowiedz() {
  const p = _kasPole();
  if (p.getAttribute("data-touched") === "1") return;
  const nmEl = document.getElementById("setupName");
  const key = String((nmEl && nmEl.value) || "").trim().toLowerCase();
  const hit = key ? _kasLib.find(function (x) { return x && String(x.name || "").trim().toLowerCase() === key; }) : null;
  if (hit) { rfKasetaUstaw(hit.cassette, false); return; }
  const cnt = {};
  RF_KASETA_IDS.forEach(function (k) { cnt[k] = 0; });
  _kasLib.forEach(function (x) { if (x) cnt[rfKaseta(x.cassette)]++; });
  let best = RF_KASETA_IDS[0];
  RF_KASETA_IDS.forEach(function (k) { if (cnt[k] < cnt[best]) best = k; });
  rfKasetaUstaw(best, false);
}
function rfKasetaPoBibliotece(data) {
  _kasLib = (data && Array.isArray(data.setup)) ? data.setup : [];
  _kasPodpowiedz();
}

// ------------------------------------------------------------------------------------------
//  PODGLĄD: miniatura na liście, duża kaseta z opisem od twórcy, „Co robi"
// ------------------------------------------------------------------------------------------
function rfKasetaMini(it) {
  const im = rfKasetaImg(it && it.cassette, false, "lib-kaseta");
  im.loading = "lazy";
  return im;
}
// Nagłówek panelu opisu zestawu: duża kaseta i obok to, co napisał twórca. `dnode` to gotowy węzeł
// opisu z rf-39i2 (on dociąga pełny tekst, gdy indeks go uciął), więc tu tylko zmienia miejsce.
// Kaseta WŁASNEGO zestawu jest przyciskiem „Zmień kasetę"; zestaw z aplikacji ma kasetę stałą.
let _kasHeroNowa = "";              // nazwa zestawu, któremu przed chwilą zmieniono kasetę (wyskok w nowym rysunku)
function rfKasetaHero(it, dnode) {
  const box = _kasEl("div", "kas-hero");
  const mozna = !!(it && it.name && !it.official && !it.broken);
  const fig = _kasEl(mozna ? "button" : "div", "kas-hero-fig" + (mozna ? " kas-hero-btn" : ""));
  const tape = _kasEl("div", "kas-hero-tape");
  tape.appendChild(rfKasetaImg(it && it.cassette, true, "kas-hero-img"));
  _kasReels(tape, it && it.cassette, true);
  fig.appendChild(tape);
  if (it && _kasHeroNowa && _kasHeroNowa === it.name) { fig.classList.add("kas-hero-new"); _kasHeroNowa = ""; }
  if (mozna) {
    fig.type = "button";
    fig.setAttribute("aria-haspopup", "dialog");
    fig.setAttribute("aria-expanded", "false");
    // Bez `title`: dymek panelu stawał na łatce „Zmień kasetę" i mówił to samo drugi raz.
    fig.setAttribute("aria-label", _kasT("Zmień kasetę", "Change cassette") + ": " + rfKasetaNazwa(it.cassette));
    fig.appendChild(_kasEl("span", "kas-hero-chip", _kasT("Zmień kasetę", "Change cassette")));
    fig.addEventListener("click", function () { _kasZmienPlik(fig, it); });
  } else if (it && it.official) {
    fig.title = rfKasetaNazwa(it.cassette) + ". " +
      _kasT("Zestaw z aplikacji ma stałą kasetę. Zapisz go pod swoją nazwą, żeby wybrać inną.",
            "A built-in setup keeps its cassette. Save it under your own name to pick another one.");
  }
  box.appendChild(fig);
  const txt = _kasEl("div", "kas-hero-t");
  txt.appendChild(_kasEl("div", "lib-sec kas-hero-h", _kasT("Opis od twórcy", "Creator's description")));
  if (dnode) {
    if (!(it && (it.description || it.desc))) {
      dnode.textContent = _kasT("Twórca nie dodał opisu.", "The creator added no description.");
      dnode.removeAttribute("data-noi18n");
      dnode.classList.add("kas-none");
    }
    txt.appendChild(dnode);
  }
  const who = [];
  if (it && it.author) who.push(it.author);
  if (it && it.rev) who.push("v" + it.rev);
  if (who.length) {
    const w = _kasEl("div", "kas-hero-who", who.join(" · "));
    w.setAttribute("data-noi18n", "");
    txt.appendChild(w);
  }
  box.appendChild(txt);
  return box;
}
// ZMIANA KASETY ZAPISANEGO ZESTAWU — jedno pole pliku przez `/setup/cassette`, bez `/setup/save`
// (tamten zbudowałby kopertę od zera z konfiguracji, którą kapsel ma TERAZ, i podmienił zestaw).
function _kasZmienPlik(btn, it) {
  let cur = rfKaseta(it.cassette);
  _kasPopOpen(btn, {
    title: _kasT("Zmień kasetę zestawu", "Change the setup's cassette"),
    sub: _kasT("Zmieniam tylko kasetę w pliku tego zestawu, reszta zostaje bez zmian.",
               "I change only the cassette in this setup's file, everything else stays as it is."),
    get: function () { return cur; },
    set: function (k) { cur = rfKaseta(k); },
    onPick: function (k) {
      if (rfKaseta(k) === rfKaseta(it.cassette)) return;
      fetch("/setup/cassette", { method: "POST", headers: { "Content-Type": "application/json" },
                                 body: JSON.stringify({ name: it.name, cassette: rfKaseta(k) }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.ok) {
            const msg = (j && j.why === "builtin")
              ? _kasT("Zestaw z aplikacji ma stałą kasetę. Zapisz go pod swoją nazwą, żeby wybrać inną.",
                      "A built-in setup keeps its cassette. Save it under your own name to pick another one.")
              : _kasT("Nie udało się zmienić kasety.", "Could not change the cassette.");
            if (typeof rfToast === "function") rfToast(msg, { tone: "danger" });
            return;
          }
          _kasHeroNowa = it.name;
          if (typeof rfLibReload === "function") rfLibReload();
        })
        .catch(function () {
          if (typeof rfToast === "function") rfToast(_kasT("Nie udało się zmienić kasety.", "Could not change the cassette."), { tone: "danger" });
        });
    },
  });
}
// „CO ROBI" — reguły i ruch z TREŚCI pliku, zanim ktokolwiek go wczyta. Reguły opisuje ten sam
// rejestr, co moduł (rf-49k `rfCfgDescribe("trig")`, czyli funkcje rf-10), a sterowanie ruchem
// i rolę kapsla to samo zdanie, co okno importu (rf-28c `rfRoleHeadHtml` z faktów `/…/analyze`).
// Analiza niczego nie zapisuje i nie stosuje — to ta sama droga, którą idzie podgląd importu.
let _kasCoTok = 0;
const _kasCoCache = new Map();
function _kasBezObrazow(env) {
  if (!env || !env.obrazy) return env;
  const c = Object.assign({}, env); delete c.obrazy; return c;
}
// Reguła z NAZWĄ od autora („Następny utwór (przechył w prawo)") pokazuje najpierw tę nazwę, a warunek
// i akcję drobniej pod nią: nazwa mówi, PO CO jest reguła, zapis warunku — JAK ją wywołać. Reguła bez
// nazwy zostaje przy samym zapisie „warunek → akcja", tak jak w module.
function _kasChips(rules) {
  const box = _kasEl("div", "lib-rules kas-rules");
  let d = { rules: [] };
  try { if (typeof rfCfgDescribe === "function") d = rfCfgDescribe("trig", { rules: rules }) || d; } catch (e) { }
  const list = (d.rules || []);
  list.slice(0, 16).forEach(function (r, i) {
    const lb = String((rules[i] && rules[i].label) || "").trim();
    const chip = _kasEl("span", "lib-rule" + (lb ? " kas-rule" : "") + (r.off ? " off" : ""));
    const line = lb ? _kasEl("span", "kas-rule-d") : chip;
    if (lb) {
      const n = _kasEl("span", "kas-rule-n", lb); n.setAttribute("data-noi18n", ""); chip.appendChild(n);
      chip.appendChild(line);
    }
    const c = _kasEl("b", null, r.c); c.setAttribute("data-noi18n", ""); line.appendChild(c);
    line.appendChild(_kasEl("span", "lib-rule-ar", "→"));
    const a = _kasEl("span", null, r.a); a.setAttribute("data-noi18n", ""); line.appendChild(a);
    box.appendChild(chip);
  });
  if (list.length > 16) {
    const n = list.length - 16;
    box.appendChild(_kasEl("span", "lib-rule more", _kasT("i jeszcze " + n, "and " + n + " more")));
  }
  return list.length ? box : null;
}
function rfKasetaCoRobi(it) {
  const box = _kasEl("div", "kas-co");
  box.appendChild(_kasEl("div", "lib-sec", _kasT("Co robi", "What it does")));
  const body = _kasEl("div", "kas-co-body kas-co-wait", _kasT("Czytam zestaw…", "Reading the setup…"));
  box.appendChild(body);
  const tok = ++_kasCoTok;
  const fail = function () {
    if (tok !== _kasCoTok) return;
    body.className = "kas-co-body kas-co-wait";
    body.textContent = _kasT("Nie udało się odczytać zestawu.", "Could not read the setup.");
  };
  // Panel opisu rysuje się na nowo przy zmianie języka, przeładowaniu listy i powrocie do pozycji;
  // plik, który się nie zmienił (ta sama nazwa, rozmiar i czas zapisu), nie jest czytany drugi raz.
  const key = [(it && it.name) || "", (it && it.mtime) || 0, (it && it.size) || 0].join("|");
  const cached = _kasCoCache.get(key);
  (cached ? Promise.resolve(cached) : fetch("/library/item?kind=setup&name=" + encodeURIComponent((it && it.name) || ""))
    .then(function (r) { return r.json(); })
    .then(function (res) {
      const env = res && res.ok && res.item;
      if (!env || typeof env !== "object") throw new Error("brak");
      const isB = env.kind === "bundle" || Array.isArray(env.devices);
      const lite = _kasBezObrazow(env);
      const cfg = (lite.config && typeof lite.config === "object") ? lite.config : lite;
      const url = isB ? "/bundle/analyze" : "/setup/analyze";
      const payload = isB ? { bundle: lite } : { config: cfg, envelope: lite };
      return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json(); })
        .then(function (a) {
          const x = { env: lite, cfg: cfg, a: a || {}, isB: isB };
          if (_kasCoCache.size > 40) _kasCoCache.clear();
          _kasCoCache.set(key, x);
          return x;
        });
    }))
    .then(function (x) {
      if (tok !== _kasCoTok || !box.isConnected) return;
      body.className = "kas-co-body";
      body.textContent = "";
      let secs = [];
      if (x.isB) {
        const devs = Array.isArray(x.env.devices) ? x.env.devices.filter(function (d) { return d && typeof d === "object"; }) : [];
        const an = Array.isArray(x.a.devices) ? x.a.devices : [];
        secs = devs.map(function (dv, i) {
          const st = (dv.setup && typeof dv.setup === "object") ? dv.setup : {};
          return { sec: an[i] || { devName: dv.name }, rules: Array.isArray(st.rules) ? st.rules : [] };
        });
      } else {
        secs = [{ sec: { motion: x.a.motion }, rules: Array.isArray(x.cfg.rules) ? x.cfg.rules : [] }];
      }
      let any = false;
      secs.forEach(function (s) {
        const part = _kasEl("div", "kas-co-cap");
        const head = (typeof rfRoleHeadHtml === "function") ? rfRoleHeadHtml(s.sec) : "";
        if (head) { const h = document.createElement("div"); h.innerHTML = head; part.appendChild(h); any = true; }
        const chips = _kasChips(s.rules);
        if (chips) { part.appendChild(chips); any = true; }
        else if (x.isB) {
          part.appendChild(_kasEl("div", "ts-norule", _kasT("Bez reguł przycisku, ten kapsel prowadzi sam ruch.",
            "No button rules, this capsule only drives the motion.")));
        }
        if (part.childNodes.length) body.appendChild(part);
      });
      if (!any) body.appendChild(_kasEl("div", "kas-co-wait", _kasT(
        "Ten zestaw nie niesie reguł, tylko ustawienia modułów (lista niżej).",
        "This setup carries no rules, only module settings (listed below).")));
      try { if (typeof applyLang === "function") applyLang(body); } catch (e) { }
    })
    .catch(fail);
  return box;
}
// Okno importu (rf-28 `rfSafetyModal`): kaseta obok opisu i instrukcji autora. Gdy autor nic nie
// napisał, kaseta stoi i tak — to pierwsza rzecz, po której człowiek pozna ten zestaw na liście.
function rfKasetaAboutHtml(a, v) {
  const about = (typeof rfSetupAboutHtml === "function") ? rfSetupAboutHtml(a) : "";
  return '<div class="ts-kasabout"><img class="rf-kaseta ts-kas-img" src="' + rfKasetaSrc(v, true) + '" alt="' +
    _kasEsc(rfKasetaNazwa(v)) + '" draggable="false"><div class="ts-kas-t">' +
    (about || ('<div class="ts-about"><div class="ts-about-h">' + _kasEsc(_kasT("Opis od twórcy", "Creator's description")) +
      '</div><div class="ts-about-d kas-none">' + _kasEsc(_kasT("Twórca nie dodał opisu.", "The creator added no description.")) + '</div></div>')) +
    '</div></div>';
}

// ------------------------------------------------------------------------------------------
//  ANIMACJA WCZYTANIA
// ------------------------------------------------------------------------------------------
// Wołający zapisuje zapowiedź tuż przed przeładowaniem panelu; `initKasety` odtwarza ją raz.
function rfKasetaZapowiedz(v, name) {
  try { localStorage.setItem(_KAS_PLAY_KEY, JSON.stringify({ k: rfKaseta(v), name: String(name || "").slice(0, 80), t: Date.now() })); } catch (e) { }
}
// Auto-zestaw (rf-39o) zna tylko nazwę — kasetę bierzemy z indeksu Biblioteki, gdy już jest w pamięci.
function rfKasetaZapowiedzNazwa(name) {
  let k = RF_KASETA_DOMYSLNA;
  try {
    const arr = (typeof _rflData !== "undefined" && _rflData && _rflData.setup) || [];
    const it = arr.find(function (x) { return x && x.name === name; });
    if (it) k = rfKaseta(it.cassette);
  } catch (e) { }
  rfKasetaZapowiedz(k, name);
}
const _KAS_MS = 2150;               // cała scena: wejście, wsunięcie, szpule, „Wczytane", wyjście
function rfKasetaGraj(v, name) {
  const k = rfKaseta(v);
  document.querySelectorAll(".kas-load").forEach(function (n) { n.remove(); });
  const root = _kasEl("div", "kas-load" + (_kasReduced() ? " kas-still" : ""));
  root.setAttribute("aria-hidden", "true");   // dymek „Wczytano zestaw…" mówi to samo czytnikowi ekranu
  const deck = _kasEl("div", "kas-deck");
  const slot = _kasEl("div", "kas-slot");
  const tape = _kasEl("div", "kas-tape");
  const im = rfKasetaImg(k, true, "kas-tape-img");
  im.alt = "";
  tape.appendChild(im);
  _kasReels(tape, k, true);
  slot.appendChild(tape);
  deck.appendChild(slot);
  const txt = _kasEl("div", "kas-txt");
  const done = _kasEl("div", "kas-done");
  done.appendChild(_kasEl("span", "kas-check", "✓"));
  done.appendChild(_kasEl("span", null, _kasT("Wczytane", "Loaded")));
  txt.appendChild(done);
  if (name) {
    const n = _kasEl("div", "kas-name", String(name));
    n.setAttribute("data-noi18n", "");
    txt.appendChild(n);
  }
  deck.appendChild(txt);
  root.appendChild(deck);
  // Start dopiero, gdy obrazek jest gotowy: scena bez kasety (pierwsze wczytanie dużego obrazka)
  // byłaby pustą kieszenią z napisem.
  let started = false;
  const go = function () {
    if (started) return; started = true;
    document.body.appendChild(root);
    setTimeout(function () { root.remove(); }, _KAS_MS + 120);
  };
  if (im.complete && im.naturalWidth) go();
  else {
    im.addEventListener("load", go, { once: true });
    im.addEventListener("error", function () { started = true; }, { once: true });
    setTimeout(go, 900);              // obrazek się spóźnia — gramy, gdy już jest co pokazać
  }
  return root;
}
function _kasPlayPending() {
  let z = null;
  try { z = JSON.parse(localStorage.getItem(_KAS_PLAY_KEY) || "null"); localStorage.removeItem(_KAS_PLAY_KEY); } catch (e) { }
  if (!z || !(Date.now() - (+z.t || 0) < _KAS_PLAY_TTL)) return;
  // Chwila oddechu po starcie: panel rysuje karty i wjeżdża swoim wejściem (rf-motion), a kaseta
  // ma wejść na gotowy ekran, nie przebijać się przez pierwszą klatkę.
  setTimeout(function () { rfKasetaGraj(z.k, z.name); }, 420);
}

function initKasety() {
  _kasPole();
  _kasSaveRowButton();
  _kasPlayPending();
}
// Po zmianie języka (rf-01 `setLang`): nazwy kaset w dymkach i etykietach siatek są składane
// z numerem, więc walker nie ma czego dopasować — przepisujemy je sami.
function rfKasetyRelang() {
  document.querySelectorAll(".kas-opt").forEach(function (o) {
    const k = rfKaseta(o.getAttribute("data-k"));
    o.setAttribute("aria-label", rfKasetaNazwa(k));
    o.title = rfKasetaNazwa(k);
  });
  document.querySelectorAll(".kas-grid").forEach(function (g) { g.setAttribute("aria-label", _kasT("Kaseta zestawu", "Setup cassette")); });
  rfKasetaUstaw(rfKasetaWybrana().id);
}

window.rfKaseta = rfKaseta;
window.rfKasetaSrc = rfKasetaSrc;
window.rfKasetaNazwa = rfKasetaNazwa;
window.rfKasetaWybrana = rfKasetaWybrana;
window.rfKasetaUstaw = rfKasetaUstaw;
window.rfKasetaGraj = rfKasetaGraj;
window.rfKasetaZapowiedz = rfKasetaZapowiedz;
window.rfKasetaZapowiedzNazwa = rfKasetaZapowiedzNazwa;
window.rfKasetaPoBibliotece = rfKasetaPoBibliotece;
