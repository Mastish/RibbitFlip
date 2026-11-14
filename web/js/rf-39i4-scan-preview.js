"use strict";
// ==================================================================================================
//  PODGLĄD SKANERA W BIBLIOTECE — plansze z obrysami sekcji, skrót, różnice i komplet ustawień
//
//  Wymaganie (2026-10-02): „biblioteka i zestawy w skanerach powinny mieć w miniaturkach
//  podglądu gdzieś screeny (…) prezentują rzeczy z tego zestawu/presetu w sposób jasny i wyraźny
//  z opisami, żeby user nie gubił się w tym przy podglądzie i rozumiał, co robi".
//
//  DWIE WARSTWY, DWA ŹRÓDŁA:
//    • RYSUNEK PLANSZ (`rfScanPreview`) opisuje STRUKTURĘ — gdzie na ekranie pracuje który skaner.
//      Zrzut z `/scan/tlo`, a bez niego schemat ekranu z tymi samymi obrysami (mówimy to wprost:
//      pusty prostokąt z podpisem „bez zrzutu" jest prawdą, ilustracja nie byłaby).
//    • SŁOWA O POKRĘTŁACH (skrót, różnice, „Wszystkie ustawienia") NIE SĄ PISANE TUTAJ. Do południa
//      02.10 ten plik miał własne zdanie o trybie (`rfScanJak`) — od tego dnia
//      wszystko idzie z tablicy pól karty przez rf-50b2 (`RFScan.opisz/roznice/naglowek`) i z modelu
//      (`RFScan.kosztWyboru`). Nowe pokrętło pojawia się tu samo; ten plik tylko rysuje.
//
//  Jedno wejście dla presetu i zestawu: pełna konfiguracja skanera (preset z `/scan-presets`, zestaw
//  z indeksu Biblioteki — serwer daje tam `scan_preset_config` + flagę `jest` przy planszach).
// ==================================================================================================

function _spT(pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; }
function _spEl(tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}
function _spHuman(n) { n.setAttribute("data-noi18n", ""); return n; }
function _spNum(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }
function _spPl(n, a, b, c, ea, eb) {
  return (typeof rfPl === "function") ? rfPl(n, a, b, c, ea, eb) : _spT(c, eb);
}
function _spKolor(n) {
  return (window.RFScan && typeof RFScan.kolorSekcji === "function") ? RFScan.kolorSekcji(n) : "#ec1a83";
}
// Napisy z tablicy pól są po polsku; angielski bierzemy ze wspólnego słownika w chwili składania
// (tak samo jak `_cdEn` w rf-49k), a węzeł dostaje `data-noi18n`, żeby walker nie mielił go drugi raz.
function _spEn(pl) {
  if (typeof _lang !== "undefined" && _lang === "en" && typeof I18N_EN !== "undefined" && I18N_EN[pl] != null) return I18N_EN[pl];
  return pl;
}
function _spNS(fn) { return !!(window.RFScan && typeof RFScan[fn] === "function"); }

// Etykieta opcji z tej samej tablicy, z której karta modułu buduje swoje listy (rf-50b `NS.POLA`).
// Wartość spoza tablicy zostaje sobą — surowa prawda zamiast pustego miejsca.
function rfScanOpcja(k, v) {
  const P = (window.RFScan && Array.isArray(RFScan.POLA)) ? RFScan.POLA : [];
  for (const p of P) {
    if (p.k !== k || !Array.isArray(p.opcje)) continue;
    const o = p.opcje.find(function (x) { return String(x[0]) === String(v); });
    if (o) return o[1];
  }
  return String(v == null ? "" : v);
}

// SEKCJE: spis albo — przy konfiguracji bez spisu — ona sama jako jedyny skaner.
function _spSekcje(cfg) {
  const lista = (window.RFScan && typeof RFScan.skanery === "function") ? RFScan.skanery(cfg || {})
    : ((cfg && Array.isArray(cfg.sekcje) && cfg.sekcje.length) ? cfg.sekcje : [cfg || {}]);
  return lista.map(function (s, i) { return { n: i + 1, s: s || {} }; });
}

// Rozmiar bazy, z której liczą się piksele: plansza, na której sekcja pracuje, a bez niej szablon.
function _spBaza(cfg, plansza) {
  if (plansza && plansza.w && plansza.h) return { w: plansza.w, h: plansza.h };
  if (cfg && cfg.szablonW && cfg.szablonH) return { w: cfg.szablonW, h: cfg.szablonH };
  return null;
}

// Prostokąt sekcji w PROCENTACH bazy albo null, gdy nie da się go policzyć uczciwie.
function rfScanProstokat(s, baza) {
  if (!s || s.obszar !== "wlasny") return { x1: 0, y1: 0, x2: 100, y2: 100, caly: true };
  let x1 = _spNum(s.obszarX1), y1 = _spNum(s.obszarY1), x2 = _spNum(s.obszarX2), y2 = _spNum(s.obszarY2);
  if (s.obszarJednostka === "piksele") {
    if (!baza) return null;                 // piksele bez rozmiaru ekranu — nie zgadujemy
    x1 = x1 / baza.w * 100; x2 = x2 / baza.w * 100; y1 = y1 / baza.h * 100; y2 = y2 / baza.h * 100;
  }
  const lo = function (a, b) { return Math.max(0, Math.min(100, Math.min(a, b))); };
  const hi = function (a, b) { return Math.max(0, Math.min(100, Math.max(a, b))); };
  return { x1: lo(x1, x2), y1: lo(y1, y2), x2: hi(x1, x2), y2: hi(y1, y2), caly: false };
}

// GDZIE — podpis obszaru w legendzie rysunku. Z TYCH SAMYCH wpisów `RFScan.opisz`, co tabela
// różnic i „Wszystkie ustawienia" (pola „od–do"): do 02.10 legenda zaokrąglała po swojemu
// („22%–81% szerokości") obok „Od lewej 22–80.9 %" w tabeli, a dwa zapisy jednej liczby wyglądają
// jak błąd. Bez własnego prostokąta — etykieta obszaru z tablicy pól.
function rfScanGdzie(s) {
  const obszar = (s && s.obszar) || "caly";
  const pary = (obszar === "wlasny" && _spNS("opisz"))
    ? [].concat.apply([], RFScan.opisz(s).map(function (x) { return x.pola; })).filter(function (p) { return p.typ === "liczba"; })
    : [];
  if (!pary.length) return _spEn(rfScanOpcja("obszar", obszar));
  return pary.map(function (p) {
    const n = _spEn(p.nazwa);
    return n.charAt(0).toLowerCase() + n.slice(1) + " " + p.tekst;
  }).join(", ");
}

// Chipy trybu z dymkiem „pole: opis" z tablicy — sam napis „Kończ na nim" odpowiada na pytanie,
// którego chip nie zadaje.
function _spNaglowek(s) {
  return _spNS("naglowekPola") ? RFScan.naglowekPola(s).map(function (c) {
    return { tekst: _spEn(c.tekst), dymek: _spEn(c.nazwa) + (c.opis ? ": " + _spEn(c.opis) : "") };
  }) : [];
}
function _spChip(c, cls) {
  const n = _spHuman(_spEl("span", cls, c.tekst));
  if (c.dymek) n.title = c.dymek;
  return n;
}

function _spLegenda(sekcje) {
  const ul = _spEl("ul", "scp-leg");
  sekcje.forEach(function (x) {
    const li = _spEl("li");
    const nr = _spEl("span", "scp-nr", String(x.n));
    nr.style.background = _spKolor(x.n);
    li.appendChild(nr);
    const w = _spEl("span", "scp-lw");
    const nazwa = String(x.s.nazwa || "").trim();
    w.appendChild(nazwa ? _spHuman(_spEl("b", null, nazwa))
                        : _spEl("b", null, _spT("Skaner ", "Scanner ") + x.n));
    const jak = _spEl("span", "scp-jak");
    _spNaglowek(x.s).forEach(function (c, i) {
      if (i) jak.appendChild(document.createTextNode(" · "));
      jak.appendChild(_spChip(c, "scp-jak-c"));
    });
    w.appendChild(jak);
    w.appendChild(_spHuman(_spEl("span", "scp-gdzie", rfScanGdzie(x.s))));
    li.appendChild(w);
    ul.appendChild(li);
  });
  return ul;
}

// Jedna plansza: obraz (albo schemat) + obrysy sekcji + podpis.
function _spPlansza(cfg, plansza, sekcje) {
  const kart = _spEl("figure", "scp-card");
  const ramka = _spEl("div", "scp-frame");
  const baza = _spBaza(cfg, plansza);
  ramka.style.aspectRatio = baza ? (baza.w + " / " + baza.h) : "16 / 9";
  const pokazObraz = !!(plansza && plansza.plik && plansza.jest !== false);
  if (pokazObraz) {
    const img = _spEl("img", "scp-img");
    img.alt = "";
    img.loading = "lazy";
    img.src = "/scan/tlo?plik=" + encodeURIComponent(plansza.plik);
    img.addEventListener("error", function () {
      img.remove();
      ramka.classList.add("bez");
      ramka.appendChild(_spEl("span", "scp-brak", _spT("zrzutu nie ma na tym komputerze", "the screenshot is not on this computer")));
    });
    ramka.appendChild(img);
  } else {
    ramka.classList.add("bez");
    ramka.appendChild(_spEl("span", "scp-brak", plansza && plansza.plik
      ? _spT("zrzutu nie ma na tym komputerze", "the screenshot is not on this computer")
      : _spT("bez zrzutu", "no screenshot")));
  }
  sekcje.forEach(function (x) {
    const r = rfScanProstokat(x.s, baza);
    if (!r) return;
    const o = _spEl("div", "scp-rect" + (r.caly ? " caly" : ""));
    o.style.left = r.x1 + "%"; o.style.top = r.y1 + "%";
    o.style.width = Math.max(1, r.x2 - r.x1) + "%"; o.style.height = Math.max(1, r.y2 - r.y1) + "%";
    o.style.setProperty("--k", _spKolor(x.n));
    o.appendChild(_spEl("span", "scp-rnr", String(x.n)));
    ramka.appendChild(o);
  });
  kart.appendChild(ramka);
  const cap = _spEl("figcaption", "scp-cap");
  const nm = String((plansza && plansza.nazwa) || "").trim();
  if (nm) cap.appendChild(_spHuman(_spEl("b", null, nm)));
  else cap.appendChild(_spEl("b", null, plansza ? _spT("Plansza bez nazwy", "Unnamed view")
                                                : _spT("Schemat ekranu", "Screen outline")));
  cap.appendChild(_spEl("span", null, sekcje.length
    ? " · " + sekcje.length + " " + _spPl(sekcje.length, "skaner", "skanery", "skanerów", "scanner", "scanners")
    : " · " + _spT("żaden skaner tu nie pracuje", "no scanner works here")));
  kart.appendChild(cap);
  if (sekcje.length) kart.appendChild(_spLegenda(sekcje));
  return kart;
}

// rfScanPreview(cfg) -> element. Plansze w kolejności z pliku; bez plansz — jeden schemat ekranu
// ze wszystkimi skanerami. Sekcja, której nie przypisano do żadnej planszy, trafia na schemat
// „poza planszami", żeby nie zniknęła z opisu tylko dlatego, że autor jej nigdzie nie pokazał.
function rfScanPreview(cfg) {
  cfg = cfg || {};
  const box = _spEl("div", "scp");
  const sekcje = _spSekcje(cfg);
  const plansze = Array.isArray(cfg.zrzuty) ? cfg.zrzuty.filter(function (z) { return z && typeof z === "object"; }) : [];
  if (!plansze.length) {
    box.appendChild(_spPlansza(cfg, null, sekcje));
    return box;
  }
  const uzyte = {};
  plansze.forEach(function (z) {
    const nry = Array.isArray(z.sekcje) ? z.sekcje : [];
    const tu = sekcje.filter(function (x) { return nry.indexOf(x.n) >= 0; });
    tu.forEach(function (x) { uzyte[x.n] = true; });
    box.appendChild(_spPlansza(cfg, z, tu));
  });
  const reszta = sekcje.filter(function (x) { return !uzyte[x.n]; });
  if (reszta.length) {
    const k = _spPlansza(cfg, null, reszta);
    const cap = k.querySelector(".scp-cap b");
    if (cap) cap.textContent = _spT("Poza planszami", "Outside the views");
    box.appendChild(k);
  }
  return box;
}

// Krótki fakt do wiersza listy i nagłówka: „3 skanery · 2 plansze" / „1 skaner · bez zrzutów".
function rfScanFakty(cfg) {
  cfg = cfg || {};
  const n = (Array.isArray(cfg.sekcje) && cfg.sekcje.length) ? cfg.sekcje.length : 1;
  const z = Array.isArray(cfg.zrzuty) ? cfg.zrzuty.length : 0;
  return n + " " + _spPl(n, "skaner", "skanery", "skanerów", "scanner", "scanners") + " · "
    + (z ? z + " " + _spPl(z, "plansza", "plansze", "plansz", "view", "views")
         : _spT("bez zrzutów", "no screenshots"));
}

// Adres obrazka wiersza: miniatura z pliku presetu, a bez niej pierwszy zrzut planszy.
function rfScanOkladka(kind, name, it, cfg) {
  if (it && it.cover) return "/library/cover?kind=" + encodeURIComponent(kind) + "&name=" + encodeURIComponent(name);
  if (it && it.zrzut) return "/scan/tlo?plik=" + encodeURIComponent(it.zrzut);
  const lista = (cfg && Array.isArray(cfg.zrzuty)) ? cfg.zrzuty : [];
  const z = lista.find(function (x) { return x && x.plik && x.jest !== false; });
  return z ? "/scan/tlo?plik=" + encodeURIComponent(z.plik) : "";
}

// ------------------------------------------------------------------------------------------
//  SKRÓT — chipy trybu, koszt jednego kliknięcia i to, co skaner robi we wskazanym punkcie
// ------------------------------------------------------------------------------------------
// Ekran, na którym liczy się koszt: plansza skanera (albo szablon, albo monitor z `/screens`),
// zawężona do jego prostokąta. Ćwiartki na dolnej trzeciej ekranu kończą zawężanie wcześniej
// niż na całym pulpicie — liczba poziomów zależy od tego, ile miejsca jest do dzielenia.
function _spEkran(cfg, x) {
  const plansza = (Array.isArray(cfg.zrzuty) ? cfg.zrzuty : []).find(function (z) {
    return z && Array.isArray(z.sekcje) && z.sekcje.indexOf(x.n) >= 0 && z.w && z.h;
  });
  let baza = _spBaza(cfg, plansza);
  if (!baza) {
    const E = window.RFScan && RFScan.ekrany;
    const lista = (E && Array.isArray(E.screens)) ? E.screens : [];
    const g = (x.s.obszarMonitor && lista.find(function (m) { return m && m.name === x.s.obszarMonitor; }))
      || lista.find(function (m) { return m && m.primary; }) || lista[0];
    baza = (g && g.w && g.h) ? { w: g.w, h: g.h } : { w: 1920, h: 1080 };
  }
  const r = rfScanProstokat(x.s, baza);
  if (!r || r.caly) return baza;
  return { w: Math.max(1, baza.w * (r.x2 - r.x1) / 100), h: Math.max(1, baza.h * (r.y2 - r.y1) / 100) };
}

function _spSkrotWiersz(cfg, x, numer) {
  const row = _spEl("div", "scp-sk");
  if (numer) {
    const nr = _spEl("span", "scp-nr", String(x.n));
    nr.style.background = _spKolor(x.n);
    row.appendChild(nr);
    const nazwa = String(x.s.nazwa || "").trim();
    if (nazwa) row.appendChild(_spHuman(_spEl("b", "scp-sk-nm", nazwa)));
  }
  _spNaglowek(x.s).forEach(function (c) { row.appendChild(_spChip(c, "scp-chip")); });
  if (_spNS("kosztWyboru")) {
    const k = RFScan.kosztWyboru(x.s, _spEkran(cfg, x));
    row.appendChild(_spEl("span", "scp-koszt", k.sygnaly + " "
      + _spPl(k.sygnaly, "sygnał", "sygnały", "sygnałów", "signal", "signals")
      + " · ~" + k.sekundy.toFixed(1) + _spT(" s na jedno kliknięcie", " s per click")));
  }
  let po;
  if (x.s.menuAkcji) po = _spT("pyta, co zrobić", "asks what to do");
  else {
    const a = (window.RFScan && typeof RFScan.akcja === "function") ? RFScan.akcja(x.s.akcjaDomyslna || "lewy") : null;
    po = _spT("po wskazaniu: ", "after pointing: ") + (a ? _spT(a.pl, a.en) : String(x.s.akcjaDomyslna || ""));
  }
  row.appendChild(_spHuman(_spEl("span", "scp-po", po)));
  return row;
}

// ZDANIE O KONFIGURACJI do okien wczytania i nadpisania (rf-50j `_skanCfgOpis` → `describe*`).
// Te same chipy i ten sam koszt, co skrót; przy kilku skanerach fakty i PIERWSZY skaner.
function rfScanZdanie(cfg) {
  cfg = cfg || {};
  const sekcje = _spSekcje(cfg);
  const x = sekcje[0];
  const czesci = sekcje.length > 1 ? [rfScanFakty(cfg)] : [];
  _spNaglowek(x.s).forEach(function (c) { czesci.push(c.tekst); });
  if (_spNS("kosztWyboru")) {
    const k = RFScan.kosztWyboru(x.s, _spEkran(cfg, x));
    czesci.push(k.sygnaly + " " + _spPl(k.sygnaly, "sygnał", "sygnały", "sygnałów", "signal", "signals"));
    czesci.push("~" + k.sekundy.toFixed(1) + _spT(" s na klik", " s per click"));
  }
  return czesci.join(" · ");
}

// rfScanSkrot(cfg) -> element. Przy kilku skanerach po jednym wierszu na skaner, z numerem
// w kolorze jego obrysu — tym samym, co na rysunku niżej i w karcie modułu.
function rfScanSkrot(cfg) {
  cfg = cfg || {};
  const box = _spEl("div", "scp-skrot");
  box.appendChild(_spEl("div", "scp-fakty", rfScanFakty(cfg)));
  const sekcje = _spSekcje(cfg);
  sekcje.forEach(function (x) { box.appendChild(_spSkrotWiersz(cfg, x, sekcje.length > 1)); });
  return box;
}

// ------------------------------------------------------------------------------------------
//  RÓŻNICE — co zmieni wczytanie (lista z `RFScan.rozniceKonfiguracji`)
// ------------------------------------------------------------------------------------------
const RF_SCAN_ROZNIC_MAX = 24;      // dłuższa lista przestaje być odpowiedzią, a staje się zrzutem pliku

// Jedna różnica jako tekst — dla dymka kropki „zmienione" (rf-49j2) i dla czytnika ekranu.
function rfScanRoznicaTekst(r) {
  const nr = r.nr ? _spT("Skaner ", "Scanner ") + r.nr + ": " : "";
  if (r.nowy) return nr + _spT("nowy skaner", "a new scanner");
  if (r.znika) return nr + _spT("zniknie", "goes away");
  return nr + _spEn(r.nazwa) + ": " + _spEn(r.od) + " → " + _spEn(r.do);
}

function _spProbka(hex) {
  const s = _spEl("span", "scp-probka");
  s.style.background = hex;
  s.setAttribute("aria-hidden", "true");
  return s;
}

// rfScanRoznice(lista, tytul, pusto?) -> element. Pusta lista to też odpowiedź i mówi ją zdaniem.
function rfScanRoznice(lista, tytul, pusto) {
  const box = _spEl("div", "scp-roz");
  if (tytul) box.appendChild(_spHuman(_spEl("div", "scp-h", tytul)));
  lista = Array.isArray(lista) ? lista : [];
  if (!lista.length) {
    box.appendChild(_spEl("div", "scp-pusto", pusto || _spT("Kapsel ma dokładnie te ustawienia.",
      "The capsule already has exactly these settings.")));
    return box;
  }
  if (lista.length > RF_SCAN_ROZNIC_MAX) {
    box.appendChild(_spEl("div", "scp-pusto", _spT("Różnic: ", "Differences: ") + lista.length
      + _spT(", poniżej pierwsze ", ", the first ") + RF_SCAN_ROZNIC_MAX + _spT(".", " below.")));
  }
  const ul = _spEl("ul", "scp-roz-l");
  let nrPrzed = -1;
  lista.slice(0, RF_SCAN_ROZNIC_MAX).forEach(function (r) {
    if (r.nr && r.nr !== nrPrzed) {
      const h = _spEl("li", "scp-roz-nr");
      const nr = _spEl("span", "scp-nr", String(r.nr));
      nr.style.background = _spKolor(r.nr);
      h.appendChild(nr);
      h.appendChild(_spEl("span", null, _spT("Skaner ", "Scanner ") + r.nr));
      if (r.nazwa && (r.nowy || r.znika)) h.appendChild(_spHuman(_spEl("b", null, " " + r.nazwa)));
      if (r.nowy || r.znika) h.appendChild(_spEl("em", null, " — " + (r.nowy
        ? _spT("nowy skaner", "a new scanner") : _spT("kapsel go ma, preset nie: zniknie", "the capsule has it, the preset does not: it goes away"))));
      ul.appendChild(h);
      nrPrzed = r.nr;
    }
    if (r.nowy || r.znika) return;
    const li = _spEl("li", r.wyglad ? "wyg" : null);
    li.appendChild(_spHuman(_spEl("span", "scp-roz-k", _spEn(r.nazwa))));
    const v = _spEl("span", "scp-roz-v");
    if (r.kolorOd) v.appendChild(_spProbka(r.kolorOd));
    v.appendChild(_spHuman(_spEl("s", null, _spEn(r.od))));
    v.appendChild(_spEl("span", "scp-ar", " → "));
    if (r.kolorDo) v.appendChild(_spProbka(r.kolorDo));
    v.appendChild(_spHuman(_spEl("b", null, _spEn(r.do))));
    li.appendChild(v);
    ul.appendChild(li);
  });
  box.appendChild(ul);
  return box;
}

// ------------------------------------------------------------------------------------------
//  WSZYSTKIE USTAWIENIA — `RFScan.opisz`, zwinięte, bo to odpowiedź na pytanie zadawane rzadko
// ------------------------------------------------------------------------------------------
function rfScanWszystko(opis, tytul) {
  opis = Array.isArray(opis) ? opis : [];
  const n = opis.reduce(function (a, s) { return a + s.pola.length; }, 0);
  const d = _spEl("details", "scp-all");
  d.appendChild(_spHuman(_spEl("summary", null, (tytul || _spT("Wszystkie ustawienia", "All settings")) + " (" + n + ")")));
  opis.forEach(function (s) {
    const sek = _spEl("div", "scp-all-sek" + (s.wyglad ? " wyg" : ""));
    const h = _spEl("div", "scp-all-h");
    h.appendChild(_spEl("span", "scp-all-ik", s.ikona || ""));
    h.appendChild(_spHuman(_spEl("span", null, _spEn(s.sek))));
    sek.appendChild(h);
    const ul = _spEl("ul", "scp-all-l");
    s.pola.forEach(function (p) {
      const li = _spEl("li", p.domyslna ? "dom" : null);
      if (p.opis) li.title = _spEn(p.opis);
      li.appendChild(_spHuman(_spEl("span", "scp-all-k", _spEn(p.nazwa))));
      const v = _spEl("span", "scp-all-v");
      if (p.kolor) v.appendChild(_spProbka(p.kolor));
      v.appendChild(_spHuman(_spEl("span", null, _spEn(p.tekst))));
      li.appendChild(v);
      ul.appendChild(li);
    });
    sek.appendChild(ul);
    d.appendChild(sek);
  });
  return d;
}

window.rfScanPreview = rfScanPreview;
window.rfScanFakty = rfScanFakty;
window.rfScanGdzie = rfScanGdzie;
window.rfScanOpcja = rfScanOpcja;
window.rfScanOkladka = rfScanOkladka;
window.rfScanSkrot = rfScanSkrot;
window.rfScanZdanie = rfScanZdanie;
window.rfScanRoznice = rfScanRoznice;
window.rfScanRoznicaTekst = rfScanRoznicaTekst;
window.rfScanWszystko = rfScanWszystko;
