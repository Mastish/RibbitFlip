"use strict";
/* SKANER EKRANU — OPIS KONFIGURACJI POCHODNY OD TABLICY PÓL (2026-10-02).

   Opis presetu skanera w Bibliotece ma wynikać z `NS.POLA` (rf-50b)
   i z modelu, a nie z ręcznie pisanych zdań. Wcześniej opis stał na trzech ręcznych
   listach (zdanie o trybie w rf-39i4, wybrane pola w rf-49k, wyciąg pól w serwerze) — każde nowe
   pokrętło trzeba by dopisać w trzech miejscach, a zapomniane znikałoby z opisu bez jednego błędu.

   Tutaj NIE MA ani jednej nazwy pola. Wszystko idzie z tablicy, tą samą drogą co karta:
     • widoczność — `!p.gdy || p.gdy(u, w)`, ta sama reguła, którą karta chowa pokrętła,
     • wartość    — `NS.wartosc` (z `czytaj`, więc „Po wybraniu pola" mówi zdaniem, nie liczbą),
     • odczyt     — `NS.formatuj` dla suwaków, etykiety opcji dla wyborów.
   Strażnik w `tests/scan_opisz_harness.cjs`: każde widoczne pole ma wpis z niepustym tekstem.

   Napisy wychodzą po polsku (jak w tablicy). Angielski dokłada renderer (rf-39i4) przez słownik
   i18n — te same pary, które tłumaczą kartę. Wydzielone z rf-50b, bo tamten ma już ponad 600 linii. */
(function (global) {
  'use strict';
  const NS = global.RFScan = global.RFScan || {};

  // STRUKTURA, NIE POKRĘTŁA: plansze, spis sekcji, nazwa i włącznik. Opisuje je rysunek plansz,
  // a w porównaniu dawałyby „różnice", których nie ustawia się żadnym suwakiem.
  const STRUKTURA = { enabled: 1, configName: 1, sekcje: 1, zrzuty: 1, zrzutAktywny: 1,
                      szablonW: 1, szablonH: 1, sekcjaAktywna: 1 };

  // Konfiguracja na czystej kartce: domyślne, na nie to, co plik naprawdę niesie. `null` z pliku
  // nie przykrywa domyślnej — suwak z `null` pokazałby „null px/s".
  function komplet(cfg) {
    const u = Object.assign({}, NS.DOMYSLNE || {});
    const w = Object.assign({}, NS.WYGLAD_DOM || {});
    const c = (cfg && typeof cfg === 'object') ? cfg : {};
    Object.keys(c).forEach(function (k) {
      if (c[k] === undefined || c[k] === null) return;
      u[k] = c[k]; w[k] = c[k];
    });
    return { u: u, w: w };
  }
  let _dom = null;
  function domyslne() { return _dom || (_dom = komplet({})); }

  // Pole „od–do" prowadzi dwa klucze naraz, więc porównuje się parą.
  function wartoscPelna(p, u, w) {
    return p.typ === 'liczba' ? [u[p.k], u[p.para]] : NS.wartosc(p, u, w);
  }
  function rowne(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function etykietaOpcji(p, v) {
    if (p.opcjeZ === 'AKCJE') return NS.nazwaAkcji ? NS.nazwaAkcji(v) : String(v);
    if (p.opcjeZ === 'EKRANY') {
      const lista = (typeof NS.ekranyOpcje === 'function') ? NS.ekranyOpcje() : [];
      const o = lista.find(function (x) { return String(x[0]) === String(v || ''); });
      if (o) return o[1];
      return v ? String(v).replace(/^\\\\\.\\/, '') : 'Cały pulpit';
    }
    const o = (p.opcje || []).find(function (x) { return String(x[0]) === String(v); });
    return o ? o[1] : String(v == null ? '' : v);      // spoza tablicy: surowa prawda, nie pustka
  }

  /* TEKST JEDNEGO POLA — per TYP pokrętła, nie per nazwa. `null` = pole nie jest ustawieniem
     (gotowe kształty to przyciski wpisujące cztery liczby; te liczby opisuje pole „od–do"). */
  NS.tekstPola = function (p, u, w) {
    const v = NS.wartosc(p, u, w);
    switch (p.typ) {
      case 'ksztalty': return null;
      case 'segment': case 'wybor': return { tekst: etykietaOpcji(p, v) };
      case 'przel': return { tekst: v ? 'tak' : 'nie' };
      case 'siatka': {
        const s = Array.isArray(v) ? v : [2, 2];
        return { tekst: (s[0] || 1) + ' × ' + (s[1] || 1) };
      }
      case 'kolor': { const h = String(v || '').toUpperCase(); return { tekst: h, kolor: h }; }
      case 'liczba': {
        const proc = u.obszarJednostka !== 'piksele';
        const f = function (x) { const n = +x || 0; return String(proc ? Math.round(n * 10) / 10 : Math.round(n)); };
        return { tekst: f(u[p.k]) + '–' + f(u[p.para]) + (proc ? ' %' : ' px') };
      }
      case 'akcje': {
        const l = Array.isArray(v) ? v : [];
        return { tekst: l.length ? l.map(function (k) { return NS.nazwaAkcji(k); }).join(', ') : 'pusto' };
      }
      default: {
        const n = (typeof v === 'number') ? v : Number(v);
        return { tekst: (v !== '' && v != null && isFinite(n)) ? NS.formatuj(p, n) : String(v == null ? '' : v) };
      }
    }
  };

  /* SEKCJA WYGLĄDU — ta, w której WSZYSTKIE pola są wyglądem („Widok i dźwięk"). Pole wyglądu
     stojące w karcie gdzie indziej (szerokość paska siedzi przy „Jak skanujemy", bo tam się ją
     stroi) w opisie idzie tutaj: opis odpowiada najpierw na „gdzie i jak kliknie", a wygląd tego
     nie zmienia. Szukana po flagach, nie po nazwie — przemianowanie sekcji niczego nie zepsuje. */
  function sekcjaWygladu() {
    let biez = null, wszystkie = false, wynik = null;
    (NS.POLA || []).concat([{ sek: '' }]).forEach(function (p) {
      if (p.sek !== undefined) {
        if (biez && wszystkie && !wynik) wynik = biez;
        biez = p; wszystkie = true;
        return;
      }
      if (!p.wyglad) wszystkie = false;
    });
    return wynik;
  }
  // Pola w kolejności OPISU: [{p, sek}] — wygląd zebrany do sekcji wyglądu, reszta jak w karcie.
  function polaOpisu() {
    const W = sekcjaWygladu();
    const out = [], obce = [];
    let sek = null;
    (NS.POLA || []).forEach(function (p) {
      if (p.sek) {
        sek = p;
        if (p === W) obce.forEach(function (x) { out.push({ p: x, sek: W }); });
        return;
      }
      if (!sek) return;
      if (W && p.wyglad && sek !== W) { obce.push(p); return; }
      out.push({ p: p, sek: sek });
    });
    return out;
  }

  /* NS.opisz(cfg) -> [{sek, ikona, wyglad, pola: [{k, nazwa, opis, tekst, kolor?, domyslna, wyglad, typ}]}]
     Tylko pola, które w TEJ konfiguracji coś robią; sekcja bez nich odpada. `domyslna` pozwala
     rendererowi przygasić to, czego autor nie ruszał — bez chowania, bo „domyślne" to też fakt. */
  NS.opisz = function (cfg) {
    const k = komplet(cfg), D = domyslne(), W = sekcjaWygladu();
    const out = [];
    let sek = null;
    polaOpisu().forEach(function (x) {
      const p = x.p;
      if (!sek || sek._z !== x.sek) {
        sek = { sek: x.sek.sek, ikona: x.sek.ikona, wyglad: x.sek === W, pola: [], _z: x.sek };
        out.push(sek);
      }
      if (p.gdy && !p.gdy(k.u, k.w)) return;
      const t = NS.tekstPola(p, k.u, k.w);
      if (!t) return;
      sek.pola.push({ k: p.k, nazwa: p.nazwa, opis: p.opis || '', tekst: t.tekst, kolor: t.kolor,
                      domyslna: rowne(wartoscPelna(p, k.u, k.w), wartoscPelna(p, D.u, D.w)),
                      wyglad: !!p.wyglad, typ: p.typ });
    });
    return out.filter(function (s) { delete s._z; return s.pola.length; });
  };

  /* NS.roznice(a, b) -> [{k, nazwa, sek, wyglad, od, do}] — co się zmieni, gdy `a` stanie się `b`.
     Widoczność liczona w `b`, bo to `b` będzie działać: pokrętło, które po wczytaniu nic nie robi,
     nie jest różnicą, którą ktoś poczuje. Ta sama wartość różnie zapisana (kolor małymi literami,
     0 i 0.0) daje ten sam tekst i różnicą nie jest. */
  NS.roznice = function (a, b) {
    const A = komplet(a), B = komplet(b);
    const out = [];
    polaOpisu().forEach(function (x) {
      const p = x.p;
      if (STRUKTURA[p.k] || (p.gdy && !p.gdy(B.u, B.w))) return;
      if (rowne(wartoscPelna(p, A.u, A.w), wartoscPelna(p, B.u, B.w))) return;
      const ta = NS.tekstPola(p, A.u, A.w), tb = NS.tekstPola(p, B.u, B.w);
      if (!ta || !tb || ta.tekst === tb.tekst) return;
      out.push({ k: p.k, nazwa: p.nazwa, sek: x.sek.sek, wyglad: !!p.wyglad, od: ta.tekst, do: tb.tekst,
                 kolorOd: ta.kolor, kolorDo: tb.kolor });
    });
    return out;
  };

  /* SKANERY PO NUMERZE. Pola płaskie to sekcja AKTYWNA (`ScanModule`), a jej kopia w `sekcje` potrafi
     być o jeden zapis starsza — więc aktywną bierzemy z pól płaskich. Bez spisu konfiguracja jest
     jednym skanerem. */
  function skanery(cfg) {
    const c = (cfg && typeof cfg === 'object') ? cfg : {};
    const lista = (Array.isArray(c.sekcje) && c.sekcje.length) ? c.sekcje : [c];
    const akt = Math.max(1, parseInt(c.sekcjaAktywna, 10) || 1);
    const plaskie = {};
    Object.keys(c).forEach(function (k) { if (!STRUKTURA[k]) plaskie[k] = c[k]; });
    return lista.map(function (s, i) {
      return (lista !== c.sekcje || i !== akt - 1) ? (s || {}) : Object.assign({}, s || {}, plaskie);
    });
  }
  NS.skanery = skanery;

  /* NS.rozniceKonfiguracji(a, b) -> [{nr, …różnica} | {nr, nowy, nazwa} | {nr, znika, nazwa}]
     Przy jednym skanerze po obu stronach `nr` = 0 i lista jest zwykłym `roznice`. Przy kilku —
     skaner po skanerze, po numerze, bo numerem nazywa go wyzwalacz (`scan:sekcja=2`). */
  NS.rozniceKonfiguracji = function (a, b) {
    const sa = skanery(a), sb = skanery(b);
    if (sa.length <= 1 && sb.length <= 1) {
      return NS.roznice(a, b).map(function (r) { return Object.assign({ nr: 0 }, r); });
    }
    const out = [];
    sb.forEach(function (s, i) {
      if (!sa[i]) { out.push({ nr: i + 1, nowy: true, nazwa: String(s.nazwa || '') }); return; }
      NS.roznice(sa[i], s).forEach(function (r) { out.push(Object.assign({ nr: i + 1 }, r)); });
    });
    for (let i = sb.length; i < sa.length; i++) out.push({ nr: i + 1, znika: true, nazwa: String(sa[i].nazwa || '') });
    return out;
  };

  /* NS.naglowekPola(cfg) -> [{tekst, nazwa, opis}] — do 4 chipów trybu. Zawsze najpierw sposób
     wskazywania (i podział przy ćwiartkach), potem wybory z pierwszej sekcji karty, które są
     widoczne i NIE są domyślne. Domyślne pomijamy, bo chip, który stoi przy każdym presecie,
     niczego nie odróżnia. Wybory liczbowe (`liczba: true`, np. przebiegi) też: chip „Jeden" bez
     rzeczownika nic nie mówi, a ile to kosztuje sygnałów, mówi linijka kosztu obok.
     `nazwa` i `opis` idą do dymka chipa: „Kończ na nim" bez pytania, na które odpowiada, nic nie
     mówi komuś, kto skanera jeszcze nie stroił. */
  NS.naglowekPola = function (cfg) {
    const k = komplet(cfg), D = domyslne();
    const P = NS.POLA || [];
    const pierwsza = P.length && P[0].sek ? P[0].sek : null;
    const gora = [], reszta = [];
    const chip = function (p) { return { tekst: NS.tekstPola(p, k.u, k.w).tekst, nazwa: p.nazwa, opis: p.opis || '' }; };
    let wJak = false;
    P.forEach(function (p) {
      if (p.sek) { wJak = (p.sek === pierwsza); return; }
      if (!wJak || (p.gdy && !p.gdy(k.u, k.w))) return;
      if (p.k === 'tryb') { gora.unshift(chip(p)); return; }
      if (p.typ === 'siatka') { gora.push(chip(p)); return; }
      if ((p.typ !== 'segment' && p.typ !== 'wybor') || p.liczba) return;
      if (rowne(NS.wartosc(p, k.u, k.w), NS.wartosc(p, D.u, D.w))) return;
      reszta.push(chip(p));
    });
    return gora.concat(reszta).slice(0, 4);
  };
  // Same napisy chipów — tam, gdzie dymka nie ma gdzie postawić (metryka wiersza, zdanie w oknie).
  NS.naglowek = function (cfg) {
    return NS.naglowekPola(cfg).map(function (c) { return c.tekst; });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(typeof window !== 'undefined' ? window : globalThis);
