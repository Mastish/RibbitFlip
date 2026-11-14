"use strict";
/* SKANER EKRANU — pasek stanu, dziennik kliknięć i raport z treningu.
   Wszystko, co jest „wokół" skanera. Sam skaner rysuje rf-50c-scan-scene.js. */
(function (global) {
  'use strict';
  const NS = global.RFScan = global.RFScan || {};
  const ui = NS.ui = {};

  function el(rodzic, klasa, tekst, tag) {
    const d = document.createElement(tag || 'div');
    d.className = klasa || '';
    if (tekst !== undefined && tekst !== null) d.textContent = tekst;
    rodzic.appendChild(d);
    return d;
  }
  ui.el = el;

  /* --- PASEK STANU --------------------------------------------------------
     Trzy rzeczy, których człowiek szuka w czasie skanowania: gdzie jestem, ile zostało
     i co się stanie, gdy nacisnę. Reszta to ozdoby, więc jej tu nie ma. */
  ui.Hud = function (korzen) {
    korzen.innerHTML = '';
    const lewo = el(korzen, 'hud-lewo');
    const faza = el(lewo, 'hud-faza');
    const opis = el(lewo, 'hud-opis');
    const srodek = el(korzen, 'hud-srodek');
    const kropki = el(srodek, 'hud-kropki');
    const nawrot = el(srodek, 'hud-nawrot', '');
    const prawo = el(korzen, 'hud-prawo');
    const lampka = el(prawo, 'hud-lampka');
    const skroty = el(prawo, 'hud-skroty');
    let ileKropek = 0;
    /* PRAWY KONIEC PASKA DO WYNAJĘCIA (2026-09-15). W karcie mówi, kto daje sygnał; nad pulpitem
       ważniejsze jest, CZYM TO ZGASIĆ — okno nie ma ramki, nie ma przycisku na pasku zadań
       i nigdy nie bierze skupienia, więc jedyne wyjście to skrót awaryjny albo panel. Nadpisanie,
       a nie drugi element: pasek jest wąski i dwa napisy w tym samym miejscu zasłaniałyby się. */
    let skrotyNadpis = '';
    this.skrotyTekst = function (html) { skrotyNadpis = html || ''; };

    this.blysk = function (rodzaj) {
      lampka.className = 'hud-lampka hud-l-' + rodzaj;
      setTimeout(function () { lampka.className = 'hud-lampka'; }, 260);
    };
    this.rysuj = function (stan) {
      faza.textContent = _scanFaza(stan.faza);
      opis.textContent = stan.opis || '';
      // Linia skrotow klawiszowych zniknela 11.09: skaner sluchaja przyciski na karcie i kapsel,
      // a nie klawiatura. Zostaje miejsce na to, co naprawde warto tu widziec — kto daje sygnal.
      // „capsule", nigdy „puck" — pilnuje tego i18n_spelling_harness (ten napis mu umknął,
      // bo idzie przez `_scanT`, a harness czyta `_gl` i słowniki).
      skroty.innerHTML = skrotyNadpis || _scanT('sygnał: przycisk albo kapsel', 'signal: the button or the capsule');
      korzen.dataset.faza = stan.faza;
      const ile = stan.tryb === 'pasy' ? stan.plan : 0;
      if (ileKropek !== ile) {
        kropki.innerHTML = '';
        for (let i = 0; i < ile; i++) el(kropki, 'hud-kropka');
        ileKropek = ile;
      }
      for (let i = 0; i < kropki.children.length; i++) {
        kropki.children[i].classList.toggle('hud-k-zrobiona', i < stan.etap);
        kropki.children[i].classList.toggle('hud-k-teraz', i === stan.etap && stan.faza === 'biegnie');
      }
      nawrot.textContent = (stan.faza === 'biegnie' && stan.nawroty > 0)
        ? _scanTf('przejazd {0} z {1}', 'pass {0} of {1}', stan.nawrot + 1, stan.nawroty) : '';
    };
  };

  /* --- ZESTAWY ------------------------------------------------------------ */
  ui.zestawy = function (korzen, panel, poZmianie) {
    korzen.innerHTML = '';
    const en = (typeof _gl === 'function') && _gl('pl', 'en') === 'en';
    Object.keys(NS.ZESTAWY).forEach(function (kod) {
      const z = NS.ZESTAWY[kod];
      const b = el(korzen, 'ui-zestaw', null, 'button');
      b.dataset.kod = kod;
      el(b, 'ui-zestaw-nazwa', z.nazwa);
      el(b, 'ui-zestaw-opis', z.opis);
      b.addEventListener('click', function () {
        panel.zastosujZestaw(kod);
        korzen.querySelectorAll('.ui-zestaw').forEach(function (n) { n.classList.remove('ui-wybrany'); });
        b.classList.add('ui-wybrany');
        if (poZmianie) poZmianie(kod);
      });
    });
  };

  /* --- DZIENNIK KLIKNIĘĆ --------------------------------------------------
     W teście na sucho to jedyny ślad po akcji — więc mówi wprost, czy klik był ze skanera,
     czy z myszy, i w co trafił. */
  ui.Dziennik = function (korzen) {
    korzen.innerHTML = '';
    const lista = el(korzen, 'ui-dz-lista');
    this.dodaj = function (wpis, czas) {
      const w = document.createElement('div');
      w.className = 'ui-dz-wpis';
      lista.insertBefore(w, lista.firstChild);
      el(w, 'ui-dz-skad ui-dz-' + wpis.skad, wpis.skad === 'skaner' ? _scanT('skaner', 'scanner') : _scanT('mysz', 'mouse'));
      el(w, 'ui-dz-cel', wpis.nazwa || _scanT('— pusty pulpit —', '— empty desktop —'));
      el(w, 'ui-dz-czas', czas ? (czas / 1000).toFixed(1) + ' s' : '');
      while (lista.children.length > 40) lista.removeChild(lista.lastChild);
    };
    this.wyczysc = function () { lista.innerHTML = ''; };
  };

  /* --- RAPORT Z TRENINGU -------------------------------------------------- */
  ui.raport = function (korzen, raport, sugestie, naZastosuj) {
    korzen.innerHTML = '';
    korzen.classList.remove('ui-raport-jest');
    if (!raport) return;
    korzen.classList.add('ui-raport-jest');
    const g = el(korzen, 'ui-rap-glowa');
    el(g, 'ui-rap-tytul', (raport.rodzaj === 'kalibracja' ? _scanT('Kalibracja czasu reakcji', 'Reaction-time calibration') : _scanT('Trening celności', 'Accuracy practice')));
    el(g, 'ui-rap-kiedy', raport.kiedy);

    const kafle = el(korzen, 'ui-rap-kafle');
    function kafel(nazwa, wartosc, dopisek, mocny) {
      const k = el(kafle, 'ui-rap-kafel' + (mocny ? ' ui-mocny' : ''));
      el(k, 'ui-rap-w', wartosc);
      el(k, 'ui-rap-n', nazwa);
      if (dopisek) el(k, 'ui-rap-d', dopisek);
    }
    if (raport.rodzaj === 'kalibracja') {
      kafel(_scanT('opóźnienie', 'lag'), (raport.opoznienie > 0 ? '+' : '') + raport.opoznienie + ' ms', _scanT('średnia obcięta', 'trimmed mean'), true);
      kafel(_scanT('rozrzut', 'spread'), '± ' + raport.rozrzut + ' ms', _scanT('im mniej, tym równiej', 'the lower, the steadier'));
      kafel(_scanT('prób', 'tries'), raport.prob, raport.wszystkieMs.join(' · ') + ' ms');
    } else {
      kafel(_scanT('celność', 'accuracy'), raport.procentTrafien + '%', _scanTf('{0} z {1}', '{0} of {1}', raport.trafienia, raport.prob), true);
      kafel(_scanT('czas (mediana)', 'time (median)'), (raport.medianaCzasu / 1000).toFixed(1) + ' s', _scanTf('średnia {0} s', 'mean {0} s', (raport.sredniCzas / 1000).toFixed(1)));
      kafel(_scanT('najlepszy', 'best'), (raport.najlepszy / 1000).toFixed(1) + ' s', '');
      kafel(_scanT('błąd (mediana)', 'error (median)'), raport.medianaBledu + ' px', _scanT('przed dociąganiem', 'before snapping'));
      kafel(_scanT('sygnałów na cel', 'signals per target'), raport.sygnalyNaCel, _scanTf('cofnięć: {0}, odrzuconych: {1}', 'undos: {0}, rejected: {1}', raport.cofniecia, raport.odrzucone));
      if (raport.trafieniaPoDociaganiu > raport.trafienia)
        kafel(_scanT('dociąganie uratowało', 'snapping saved'), (raport.trafieniaPoDociaganiu - raport.trafienia), _scanT('trafień', 'hits'));
    }

    const s = el(korzen, 'ui-rap-sugestie');
    (sugestie || []).forEach(function (sg) {
      const w = el(s, 'ui-sug');
      el(w, 'ui-sug-tekst', sg.tekst);
      if (sg.pole !== undefined && naZastosuj) {
        const b = el(w, 'ui-sug-btn', _scanT('Zastosuj', 'Apply'), 'button');
        b.addEventListener('click', function () {
          naZastosuj(sg.pole, sg.wartosc);
          b.textContent = _scanT('zastosowane', 'applied');
          b.disabled = true;
        });
      }
    });
  };

  /* --- HISTORIA SERII (porównanie ustawień) -------------------------------- */
  ui.historia = function (korzen, historia) {
    korzen.innerHTML = '';
    if (!historia.length) return;
    const t = el(korzen, 'ui-hist', null, 'table');
    const gl = el(t, '', null, 'tr');
    [_scanT('seria', 'run'), _scanT('celność', 'accuracy'), _scanT('mediana', 'median'), _scanT('sygnałów na cel', 'signals per target')]
      .forEach(function (n) { el(gl, '', n, 'th'); });
    historia.slice(-8).reverse().forEach(function (r) {
      const w = el(t, '', null, 'tr');
      el(w, '', r.opis || r.rodzaj, 'td');
      el(w, '', r.rodzaj === 'kalibracja' ? ((r.opoznienie > 0 ? '+' : '') + r.opoznienie + ' ms') : (r.procentTrafien + '%'), 'td');
      el(w, '', (r.medianaCzasu / 1000).toFixed(1) + ' s', 'td');
      el(w, '', r.sygnalyNaCel, 'td');
    });
  };

  /* --- WIADOMOŚĆ NA ŚRODKU ------------------------------------------------ */
  ui.komunikat = function (korzen, tekst, ms) {
    korzen.textContent = tekst;
    korzen.classList.add('ui-widoczny');
    clearTimeout(korzen._t);
    korzen._t = setTimeout(function () { korzen.classList.remove('ui-widoczny'); }, ms || 2200);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(typeof window !== 'undefined' ? window : globalThis);
