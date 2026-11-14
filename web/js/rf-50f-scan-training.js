"use strict";
/* SKANER EKRANU — trening i kalibracja.

   Bez tego cała rzecz jest ładną animacją. Z tym jest narzędziem: po dziesięciu celach wiadomo,
   ile realnie trwa jedno kliknięcie, ile razy człowiek chybia i o ile spóźnia sygnał.
   ⚠️ To NIE jest dodatek. Badania nad porzucaniem sprzętu wspomagającego wskazują dobór ustawień
   pod konkretnego człowieka jako główny czynnik — a nikt nie dobierze tego, czego nie zmierzył. */
(function (global) {
  'use strict';
  const NS = global.RFScan = global.RFScan || {};

  function mediana(t) {
    if (!t.length) return 0;
    const s = t.slice().sort(function (a, b) { return a - b; });
    const p = Math.floor(s.length / 2);
    return s.length % 2 ? s[p] : (s[p - 1] + s[p]) / 2;
  }
  function srednia(t) { return t.length ? t.reduce(function (a, b) { return a + b; }, 0) / t.length : 0; }
  function odchylenie(t) {
    if (t.length < 2) return 0;
    const m = srednia(t);
    return Math.sqrt(t.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (t.length - 1));
  }
  /* Średnia obcięta — odrzuca skrajną próbę z każdej strony. Przy siedmiu próbach jedno
     kichnięcie potrafi przesunąć średnią o 200 ms, a to jest liczba, którą wpisujemy w ustawienia. */
  function sredniaObcieta(t) {
    if (t.length < 4) return srednia(t);
    const s = t.slice().sort(function (a, b) { return a - b; });
    return srednia(s.slice(1, s.length - 1));
  }

  NS.Trening = function (korzen) {
    const self = this;
    this.bieg = null;
    this.historia = [];     // poprzednie serie w tej sesji — do porównania trybów

    function czysc() { korzen.innerHTML = ''; }

    /* --- CELNOŚĆ ---------------------------------------------------------- */
    function losujCel(ekran, rozmiar) {
      const m = 60;                       // margines od krawędzi — tam pasek zawraca
      const w = rozmiar, h = rozmiar;
      return {
        x: ekran.x + m + Math.random() * Math.max(1, ekran.w - 2 * m - w),
        y: ekran.y + m + Math.random() * Math.max(1, ekran.h - 2 * m - h),
        w: w, h: h
      };
    }

    this.zacznij = function (rodzaj, ile, ekran, opcje) {
      opcje = opcje || {};
      czysc();
      self.bieg = {
        rodzaj: rodzaj, ile: ile, i: 0, wyniki: [], ekran: ekran,
        rozmiar: opcje.rozmiar || 64, opis: opcje.opis || '', t0: Date.now()
      };
      self.nastepny();
      return self.bieg;
    };

    this.nastepny = function () {
      const b = self.bieg;
      if (!b) return null;
      czysc();
      if (b.i >= b.ile) { b.cel = null; return null; }
      if (b.rodzaj === 'kalibracja') {
        // Kreska w losowej wysokości — ale nie za blisko krawędzi, bo tam pasek zwalnia
        // (zawraca) i pomiar mówiłby wtedy o krawędzi, a nie o człowieku.
        const y = b.ekran.y + b.ekran.h * (0.25 + Math.random() * 0.5);
        b.cel = { x: b.ekran.x, y: y - 4, w: b.ekran.w, h: 8, srodek: y };
        const k = document.createElement('div');
        k.className = 'tr-kreska';
        k.style.transform = 'translateY(' + Math.round(y) + 'px)';
        const p = document.createElement('div');
        p.className = 'tr-kreska-opis';
        p.textContent = 'zatrzymaj pasek dokładnie tutaj  ·  próba ' + (b.i + 1) + ' z ' + b.ile;
        k.appendChild(p);
        korzen.appendChild(k);
      } else {
        b.cel = losujCel(b.ekran, b.rozmiar);
        const c = document.createElement('div');
        c.className = 'tr-cel';
        c.setAttribute('data-cel', 'Cel treningowy');
        c.style.transform = 'translate(' + Math.round(b.cel.x) + 'px,' + Math.round(b.cel.y) + 'px)';
        c.style.width = b.cel.w + 'px';
        c.style.height = b.cel.h + 'px';
        const n = document.createElement('div');
        n.className = 'tr-cel-nr';
        n.textContent = (b.i + 1) + '/' + b.ile;
        c.appendChild(n);
        korzen.appendChild(c);
      }
      return b.cel;
    };

    /* Wołane po każdej akcji silnika. `wynik` to obiekt z naZdarzenie('akcja', …). */
    this.zapisz = function (wynik) {
      const b = self.bieg;
      if (!b || !b.cel) return null;
      const p = wynik.punkt.surowy || wynik.punkt;     // celność mierzymy PRZED dociąganiem
      const w = {
        czas: wynik.czas, sygnaly: wynik.sygnaly, cofniecia: wynik.cofniecia,
        odrzucone: wynik.odrzucone, akcja: wynik.akcja
      };
      if (b.rodzaj === 'kalibracja') {
        w.bladPx = p.y - b.cel.srodek;
        w.bladMs = b.predkosc ? (w.bladPx / b.predkosc) * 1000 : 0;
        w.trafiony = Math.abs(w.bladPx) <= 12;
      } else {
        const sx = b.cel.x + b.cel.w / 2, sy = b.cel.y + b.cel.h / 2;
        w.trafiony = p.x >= b.cel.x && p.x <= b.cel.x + b.cel.w && p.y >= b.cel.y && p.y <= b.cel.y + b.cel.h;
        w.bladPx = Math.round(Math.sqrt((p.x - sx) * (p.x - sx) + (p.y - sy) * (p.y - sy)));
        w.trafionyPoDociaganiu = !!(wynik.punkt.cel);
      }
      b.wyniki.push(w);
      b.i++;
      const dalej = self.nastepny();
      if (!dalej) { const r = self.raport(); self.historia.push(r); return { koniec: true, raport: r }; }
      return { koniec: false, ostatni: w };
    };

    this.raport = function () {
      const b = self.bieg;
      if (!b || !b.wyniki.length) return null;
      const czasy = b.wyniki.map(function (w) { return w.czas; });
      const bledy = b.wyniki.map(function (w) { return Math.abs(w.bladPx); });
      const traf = b.wyniki.filter(function (w) { return w.trafiony; }).length;
      const trafDoc = b.wyniki.filter(function (w) { return w.trafionyPoDociaganiu; }).length;
      const r = {
        rodzaj: b.rodzaj, opis: b.opis, prob: b.wyniki.length,
        trafienia: traf, procentTrafien: Math.round(traf / b.wyniki.length * 100),
        trafieniaPoDociaganiu: trafDoc,
        medianaCzasu: Math.round(mediana(czasy)), sredniCzas: Math.round(srednia(czasy)),
        najlepszy: Math.round(Math.min.apply(null, czasy)),
        medianaBledu: Math.round(mediana(bledy)),
        sygnalyNaCel: +(srednia(b.wyniki.map(function (w) { return w.sygnaly; }))).toFixed(1),
        cofniecia: b.wyniki.reduce(function (a, w) { return a + w.cofniecia; }, 0),
        odrzucone: b.wyniki.reduce(function (a, w) { return a + w.odrzucone; }, 0),
        kiedy: new Date().toLocaleTimeString('pl-PL')
      };
      if (b.rodzaj === 'kalibracja') {
        const ms = b.wyniki.map(function (w) { return w.bladMs; });
        r.opoznienie = Math.round(sredniaObcieta(ms));
        r.rozrzut = Math.round(odchylenie(ms));
        r.wszystkieMs = ms.map(function (x) { return Math.round(x); });
      }
      return r;
    };

    this.przerwij = function () { czysc(); self.bieg = null; };
    this.cel = function () { return self.bieg ? self.bieg.cel : null; };

    /* --- PODPOWIEDZI ------------------------------------------------------
       Najważniejsza część całego pomiaru: zamiana liczb na jedno zdanie „zmień to na to".
       Badania nad porzucaniem sprzętu wspomagającego mówią jasno, że dobór ustawień pod
       konkretnego człowieka waży więcej niż liczba funkcji — a nikt nie dobiera ustawień,
       których nie umie nazwać. */
    this.sugestie = function (raport, u) {
      const s = [];
      if (!raport) return s;
      if (raport.rodzaj === 'kalibracja') {
        if (Math.abs(raport.opoznienie) >= 40) {
          s.push({
            pole: 'wyprzedzenie', wartosc: raport.opoznienie,
            tekst: 'Sygnał pada średnio ' + Math.abs(raport.opoznienie) + ' ms '
              + (raport.opoznienie > 0 ? 'za późno' : 'za wcześnie')
              + '. Ustaw „wyprzedzenie” na ' + raport.opoznienie + ' ms, a skaner sam to nadrobi.'
          });
        } else {
          s.push({ tekst: 'Czas reakcji jest równy (±' + Math.abs(raport.opoznienie) + ' ms) — poprawka niepotrzebna.' });
        }
        if (raport.rozrzut > 120) {
          s.push({
            pole: 'ruch', wartosc: 'skokowy',
            tekst: 'Rozrzut ' + raport.rozrzut + ' ms jest duży, a przy płynnym ruchu rozrzut zamienia się '
              + 'w chybienia. Spróbuj ruchu skokowego — tam trafia się w POLE, nie w moment.'
          });
        } else if (raport.rozrzut > 60 && u) {
          const pasmo = Math.max(60, Math.round(2 * raport.rozrzut / 1000 * u.predkosc));
          s.push({ pole: 'pasmo', wartosc: pasmo, tekst: 'Przy rozrzucie ' + raport.rozrzut + ' ms pasmo węższe niż ' + pasmo + ' px będzie zgadywaniem.' });
        }
        return s;
      }
      if (raport.procentTrafien < 70 && u) {
        s.push({
          pole: 'predkosc', wartosc: Math.max(120, Math.round(u.predkosc * 0.7)),
          tekst: 'Celność ' + raport.procentTrafien + '%. Zwolnij pasek do '
            + Math.round(u.predkosc * 0.7) + ' px/s — to najprostsza dźwignia.'
        });
      }
      if (raport.procentTrafien >= 90 && u && raport.medianaCzasu > 4000) {
        s.push({
          pole: 'predkosc', wartosc: Math.round(u.predkosc * 1.35),
          tekst: 'Trafiasz ' + raport.procentTrafien + '%, więc możesz przyspieszyć do '
            + Math.round(u.predkosc * 1.35) + ' px/s i skrócić czas o jakąś trzecią część.'
        });
      }
      if (u && raport.medianaBledu > (u.dociaganie || 0) && raport.trafieniaPoDociaganiu > raport.trafienia) {
        s.push({
          pole: 'dociaganie', wartosc: Math.min(140, Math.round(raport.medianaBledu * 1.5)),
          tekst: 'Dociąganie uratowało ' + (raport.trafieniaPoDociaganiu - raport.trafienia)
            + ' z ' + raport.prob + ' prób. Przy medianie błędu ' + raport.medianaBledu
            + ' px warto dać mu ' + Math.min(140, Math.round(raport.medianaBledu * 1.5)) + ' px.'
        });
      }
      if (raport.odrzucone > raport.prob * 0.5) {
        s.push({ tekst: 'Sporo sygnałów odrzuconych (' + raport.odrzucone + '). Zajrzyj w „przerwę po wyborze” i „odbicie” — mogą być za długie.' });
      }
      if (raport.cofniecia > raport.prob) {
        s.push({ tekst: 'Dużo cofania (' + raport.cofniecia + ' razy). To zwykle znaczy, że pasek jest za szybki albo za wąski.' });
      }
      if (!s.length) s.push({ tekst: 'Ustawienia wyglądają na dobrane. Jak na jedno kliknięcie, mediana ' + (raport.medianaCzasu / 1000).toFixed(1) + ' s jest przyzwoita.' });
      return s;
    };
  };

  NS._stat = { mediana: mediana, srednia: srednia, odchylenie: odchylenie, sredniaObcieta: sredniaObcieta };
  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(typeof window !== 'undefined' ? window : globalThis);
