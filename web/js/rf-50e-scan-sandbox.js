"use strict";
/* SKANER EKRANU — piaskownica: udawany pulpit do bezpiecznego ćwiczenia.

   Po co to w aplikacji, skoro skaner umie już klikać naprawdę: bo parametry dobiera się
   dziesiątki razy pod rząd, a robienie tego na żywym systemie — gdy pasek sam klika, gdzie
   trafi — jest złym pomysłem dla wszystkich. Tu klika się w rzeczy, które wyglądają jak
   pulpit i nic nie znaczą. Klawiatura ekranowa jest częścią tej samej sceny: w trybie
   „elementy" z wzorem wiersz-kolumna wychodzi z niej klasyczne skanowanie AAC. */
(function (global) {
  'use strict';
  const NS = global.RFScan = global.RFScan || {};

  const IKONY = [
    { n: 'Ten komputer', e: '🖥️' }, { n: 'Kosz', e: '🗑️' }, { n: 'Dokumenty', e: '📁' },
    { n: 'Zdjęcia', e: '🖼️' }, { n: 'Przeglądarka', e: '🌐' }, { n: 'Poczta', e: '✉️' },
    { n: 'Odtwarzacz', e: '🎬' }, { n: 'Notatnik', e: '📝' }, { n: 'RibbitFlip', e: '🐸' }
  ];
  const PASEK = ['🐸 RibbitFlip', '🌐 Przeglądarka', '✉️ Poczta', '📁 Pliki'];

  NS.Pulpit = function (korzen) {
    const self = this;
    let dziennik = [];

    function e(rodzic, klasa, tekst, cel, tag) {
      const d = document.createElement(tag || 'div');
      d.className = klasa;
      if (tekst !== undefined && tekst !== null) d.textContent = tekst;
      if (cel) d.setAttribute('data-cel', cel);
      rodzic.appendChild(d);
      return d;
    }

    this.zbuduj = function () {
      korzen.innerHTML = '';
      korzen.className = 'pu-pulpit';

      // --- ikony pulpitu ---
      const siatka = e(korzen, 'pu-ikony');
      IKONY.forEach(function (i) {
        const k = e(siatka, 'pu-ikona', null, i.n);
        e(k, 'pu-ikona-obraz', i.e);
        e(k, 'pu-ikona-napis', i.n);
      });

      // --- okno aplikacji ---
      const okno = e(korzen, 'pu-okno');
      const belka = e(okno, 'pu-belka');
      e(belka, 'pu-tytul', 'Ustawienia — Sieć i internet');
      const przyciski = e(belka, 'pu-belka-btn');
      e(przyciski, 'pu-bx', '—', 'Zminimalizuj okno');
      e(przyciski, 'pu-bx', '▢', 'Powiększ okno');
      e(przyciski, 'pu-bx pu-bx-zamknij', '✕', 'Zamknij okno');

      const menu = e(okno, 'pu-menu');
      ['Plik', 'Edycja', 'Widok', 'Pomoc'].forEach(function (m) { e(menu, 'pu-menu-poz', m, 'Menu ' + m); });

      const tresc = e(okno, 'pu-tresc');
      const lewa = e(tresc, 'pu-lewa');
      ['Stan', 'Wi-Fi', 'Ethernet', 'VPN', 'Zapora', 'Proxy'].forEach(function (p, i) {
        const w = e(lewa, 'pu-poz' + (i === 1 ? ' pu-wybrana' : ''), p, 'Zakładka ' + p);
        w.setAttribute('data-grupa', 'lewa');
      });
      const prawa = e(tresc, 'pu-prawa');
      e(prawa, 'pu-naglowek', 'Wi-Fi');
      const wiersz1 = e(prawa, 'pu-wiersz');
      e(wiersz1, 'pu-etykieta', 'Sieć domowa');
      const przel = e(wiersz1, 'pu-przelacznik pu-wl', null, 'Przełącznik Wi-Fi');
      e(przel, 'pu-galka');
      const wiersz2 = e(prawa, 'pu-wiersz');
      e(wiersz2, 'pu-etykieta', 'Łącz automatycznie');
      const ptaszek = e(wiersz2, 'pu-ptaszek', '✓', 'Łącz automatycznie');
      const wiersz3 = e(prawa, 'pu-wiersz');
      e(wiersz3, 'pu-etykieta', 'Nazwa sieci');
      e(wiersz3, 'pu-pole', 'WiFi-Gosc', 'Pole nazwy sieci');
      const lista = e(prawa, 'pu-lista');
      // Nazwy sieci są CELOWO nijakie — udawany pulpit ogląda się przy dostrajaniu długo
      // i trafia na zrzuty, więc nie może zdradzać, czyj to komputer ani gdzie stoi.
      ['WiFi-Gosc', 'WiFi-Biuro', 'Sasiad-5G', 'Hotspot-telefon'].forEach(function (s, i) {
        const p = e(lista, 'pu-siec' + (i === 0 ? ' pu-wybrana' : ''), null, 'Sieć ' + s);
        e(p, 'pu-sygnal', '▮▮▯');
        e(p, 'pu-sn', s);
      });
      const stopka = e(okno, 'pu-stopka');
      e(stopka, 'pu-btn pu-btn-glowny', 'Zapisz', 'Przycisk Zapisz');
      e(stopka, 'pu-btn', 'Anuluj', 'Przycisk Anuluj');
      e(stopka, 'pu-btn', 'Pomoc', 'Przycisk Pomoc');

      // --- pasek zadań ---
      const pasek = e(korzen, 'pu-pasek');
      e(pasek, 'pu-start', '⊞', 'Menu Start');
      const apki = e(pasek, 'pu-apki');
      PASEK.forEach(function (a) { e(apki, 'pu-apka', a, a); });
      const zasobnik = e(pasek, 'pu-zasobnik');
      e(zasobnik, 'pu-zas', '🔊', 'Głośność');
      e(zasobnik, 'pu-zas', '📶', 'Sieć');
      e(zasobnik, 'pu-zas', '🔋', 'Bateria');
      e(zasobnik, 'pu-zegar', '9:41', 'Zegar');
      ptaszek.dataset.wl = '1';
      przel.dataset.wl = '1';
      self.dopasuj();
      if (!self._obserwator && typeof ResizeObserver === 'function') {
        self._obserwator = new ResizeObserver(function () { self.dopasuj(); });
        self._obserwator.observe(korzen);
      }
      return self;
    };

    /* SKALA POD RAMKĘ (UX 261120). Pulpit jest narysowany pod ramkę ok. 818×511 px. Gdy ramka
       wychodzi niższa (niskie okno: od 1280×720 podgląd oddaje wysokość paskowi z SYGNAŁEM),
       wymiary w 26-scan.css liczą się od `--pu-k`, więc okno, ikony i pasek zadań maleją razem
       z ramką, zamiast wystawać poza nią albo chować się pod jej dolną krawędzią. Większa ramka
       nie powiększa pulpitu: przy 1 zostaje po prostu więcej miejsca. Zmiana zmiennej nie zmienia
       rozmiaru korzenia, więc obserwator nie wpada w pętlę. */
    const BAZA_W = 818, BAZA_H = 511;
    this.dopasuj = function () {
      const w = korzen.clientWidth, h = korzen.clientHeight;
      if (!(w > 0 && h > 0)) return;
      const k = Math.max(0.3, Math.min(1, w / BAZA_W, h / BAZA_H));
      const v = k.toFixed(3);
      if (korzen.style.getPropertyValue('--pu-k') !== v) korzen.style.setProperty('--pu-k', v);
    };

    /* --- KLAWIATURA EKRANOWA ------------------------------------------------
       Po co ona tu jest: pisanie to najstarsze i najważniejsze zastosowanie skanowania.
       W trybie „elementy" z wzorem wiersz-kolumna wychodzi z tego dokładnie to, co robią
       komunikatory AAC — najpierw leci wiersz, potem klawisz w wierszu, czyli 2 sygnały
       zamiast 40. Klawisze są zwykłymi celami (`data-cel`), więc każdy tryb skanera
       obsługuje ją bez jednej linijki kodu specjalnie dla niej. */
    const UKLAD = [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '⌫'],
      ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'ą', 'ę', 'ł'],
      ['ó', 'ś', 'ż', 'ź', 'ć', 'ń', '-', '.', '␣', '✓']
    ];
    let poleTekstu = null;

    this.pokazKlawiature = function (pole) {
      poleTekstu = pole || korzen.querySelector('.pu-pole');
      let k = korzen.querySelector('.pu-klawiatura');
      if (k) { k.classList.remove('pu-schowana'); return; }
      k = e(korzen, 'pu-klawiatura');
      e(k, 'pu-klaw-pasek', 'Klawiatura ekranowa — w trybie „elementy” skanuje się wiersz, potem klawisz');
      UKLAD.forEach(function (wiersz) {
        const w = e(k, 'pu-klaw-wiersz');
        wiersz.forEach(function (z) {
          const nazwa = z === '␣' ? 'Spacja' : (z === '⌫' ? 'Kasuj' : (z === '✓' ? 'Gotowe' : 'Klawisz ' + z));
          const b = e(w, 'pu-klaw' + (z.length > 1 || '⌫✓␣'.indexOf(z) >= 0 ? ' pu-klaw-szeroki' : ''), z, nazwa);
          b.dataset.znak = z;
        });
      });
    };
    this.schowajKlawiature = function () {
      const k = korzen.querySelector('.pu-klawiatura');
      if (k) k.classList.add('pu-schowana');
    };
    function pisz(znak) {
      if (!poleTekstu) return;
      const teraz = poleTekstu.textContent;
      if (znak === '⌫') poleTekstu.textContent = teraz.slice(0, -1);
      else if (znak === '␣') poleTekstu.textContent = teraz + ' ';
      else if (znak === '✓') self.schowajKlawiature();
      else poleTekstu.textContent = teraz + znak;
    }

    /* Lista celów w układzie okna (px viewportu) — to samo źródło dla trybu „elementy"
       i dla dociągania. Filtrujemy niewidoczne, bo skaner nie ma prawa trafić w nic. */
    this.cele = function () {
      const lista = [];
      korzen.querySelectorAll('[data-cel]').forEach(function (n) {
        const r = n.getBoundingClientRect();
        if (r.width < 6 || r.height < 6) return;
        if (r.bottom < 0 || r.top > global.innerHeight) return;
        lista.push({ x: r.left, y: r.top, w: r.width, h: r.height, id: n.getAttribute('data-cel'), wezel: n });
      });
      return lista;
    };

    /* Kliknięcie w punkcie. Zwraca opis tego, w co trafiło — albo null, gdy w nic.
       Kilka rzeczy reaguje naprawdę (przełącznik, ptaszek, zakładki, zamknięcie okna),
       żeby dało się poczuć, że to interfejs, a nie obrazek. */
    this.klik = function (x, y, akcja, skad) {
      const pod = document.elementsFromPoint(x, y) || [];
      let cel = null;
      for (let i = 0; i < pod.length; i++) {
        const n = pod[i].closest ? pod[i].closest('[data-cel]') : null;
        if (n && korzen.contains(n)) { cel = n; break; }
      }
      if (!cel) { zapisz(null, akcja, skad, x, y); return null; }

      cel.classList.remove('pu-blysk');
      void cel.offsetWidth;
      cel.classList.add('pu-blysk');

      const nazwa = cel.getAttribute('data-cel');
      if (cel.classList.contains('pu-przelacznik')) {
        const wl = cel.dataset.wl !== '1';
        cel.dataset.wl = wl ? '1' : '0';
        cel.classList.toggle('pu-wl', wl);
      } else if (cel.classList.contains('pu-ptaszek')) {
        const wl = cel.dataset.wl !== '1';
        cel.dataset.wl = wl ? '1' : '0';
        cel.textContent = wl ? '✓' : '';
      } else if (cel.getAttribute('data-grupa') === 'lewa') {
        korzen.querySelectorAll('[data-grupa=lewa]').forEach(function (n) { n.classList.remove('pu-wybrana'); });
        cel.classList.add('pu-wybrana');
      } else if (cel.classList.contains('pu-siec')) {
        korzen.querySelectorAll('.pu-siec').forEach(function (n) { n.classList.remove('pu-wybrana'); });
        cel.classList.add('pu-wybrana');
      } else if (cel.classList.contains('pu-klaw')) {
        pisz(cel.dataset.znak);
      } else if (cel.classList.contains('pu-pole')) {
        self.pokazKlawiature(cel);
      } else if (cel.classList.contains('pu-bx-zamknij')) {
        const okno = korzen.querySelector('.pu-okno');
        if (okno) { okno.classList.add('pu-schowane'); setTimeout(function () { okno.classList.remove('pu-schowane'); }, 1500); }
      }
      zapisz(nazwa, akcja, skad, x, y);
      return nazwa;
    };

    function zapisz(nazwa, akcja, skad, x, y) {
      dziennik.push({ t: Date.now(), nazwa: nazwa, akcja: akcja, skad: skad || 'skaner', x: Math.round(x), y: Math.round(y) });
      if (dziennik.length > 200) dziennik.shift();
      if (self.naKlik) try { self.naKlik(dziennik[dziennik.length - 1]); } catch (e) { }
    }

    this.dziennik = function () { return dziennik.slice(); };
    this.wyczysc = function () { dziennik = []; };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(typeof window !== 'undefined' ? window : globalThis);
