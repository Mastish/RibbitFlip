"use strict";
/* SKANER EKRANU — scena: wszystko, co widać podczas skanowania.
   Czyta stan z silnika (silnik.js) i przekłada go na kilkanaście elementów DOM.
   Nic nie liczy sama: gdyby coś tu policzyć, w trybie nakładki i w piaskownicy wyszłoby inaczej.

   Dlaczego DOM, a nie canvas: nakładka nad pulpitem wycina tło KOLOREM (Windows,
   LWA_COLORKEY), więc to, co ma być dziurą, musi zostać niepomalowane. Przy DOM-ie
   „niepomalowane" jest domyślne, a przyciemnienie rysujemy jawnie czterema prostokątami
   wokół obszaru. Do tego jeden element na warstwę = kilka zmian stylu na klatkę. */
(function (global) {
  'use strict';
  const NS = global.RFScan = global.RFScan || {};

  // Kolor osi — po nim człowiek poznaje, w którym kroku jest, bez czytania napisu. To są
  // WARTOŚCI DOMYŚLNE: od 2026-09-11 każdą z trzech ról da się przemalować w ustawieniach
  // (`kolorY` · `kolorX` · `kolorDokladny`), bo nad grą i na jasnym pulpicie sprawdzają się
  // inne barwy niż na ciemnym. Pola i radar zostają przy swoich — mają własne role.
  const KOLORY = { y: '#ec1a83', x: '#6cb33f', dokladny: '#eaa32b', blok: '#1f93c9', radar: '#8a52d9' };
  function kolorRoli(ust, p) {
    if (p.dokladny) return ust.kolorDokladny || KOLORY.dokladny;
    return (p.os === 'y' ? ust.kolorY : ust.kolorX) || KOLORY[p.os];
  }

  function el(rodzic, klasa, tag) {
    const e = document.createElement(tag || 'div');
    e.className = klasa;
    rodzic.appendChild(e);
    return e;
  }

  NS.Scena = function (korzen) {
    const self = this;
    const w = {};   // warstwy

    korzen.innerHTML = '';
    korzen.classList.add('sc-korzen');
    w.przyciem = ['gora', 'dol', 'lewo', 'prawo'].map(function (n) { return el(korzen, 'sc-przyciem sc-p-' + n); });
    w.obszar = el(korzen, 'sc-obszar');
    w.kresY = el(korzen, 'sc-kres sc-kres-y');
    w.kresX = el(korzen, 'sc-kres sc-kres-x');
    w.bloki = el(korzen, 'sc-bloki');
    w.elementy = el(korzen, 'sc-elementy');
    w.radar = el(korzen, 'sc-radar');
    w.promien = el(w.radar, 'sc-promien');
    w.srodek = el(w.radar, 'sc-radar-srodek');
    w.kropka = el(w.radar, 'sc-kropka');
    w.pasmo = el(korzen, 'sc-pasmo');
    w.krawedz = el(w.pasmo, 'sc-krawedz');
    w.etykieta = el(korzen, 'sc-etykieta');
    w.punkt = el(korzen, 'sc-punkt');
    w.menu = el(korzen, 'sc-menu');
    w.slady = el(korzen, 'sc-slady');

    let blokiIle = 0, elementyIle = 0, ostatniMenu = -1;

    /* PODGLĄD OBSZARU — „gdzie skaner będzie pracować", zanim ruszy.
       Do 14.09 obrys obszaru pokazywał się WYŁĄCZNIE podczas skanowania, więc ustawienia z sekcji
       „Gdzie skaner ma działać" (kształt, jednostka, cztery liczby od–do) nie dawały żadnej
       odpowiedzi na ekranie: człowiek wpisywał 25 → 75 i musiał uruchomić skaner, żeby zobaczyć,
       co z tego wyszło. Teraz po wybraniu lub wpisaniu wartości podgląd się aktualizuje,
       a na pulpicie od razu podświetla się ramka.
         `staly`   — podgląd stoi cały czas, dopóki skaner czeka (tak ma karta: to jej robota).
         `blyskDo` — krótkie podświetlenie po zmianie ustawienia (tak ma okno nad pulpitem: tam
                     stały prostokąt wisiałby nad cudzą pracą).
       Wypełnienie jest półprzezroczyste i steruje nim `ust.podgladObszaru` (0 = sam obrys). */
    /* NAD PRAWDZIWYM PULPITEM RYSUJE SIĘ INACZEJ — i to nie jest kwestia gustu (2026-09-22).

       Objaw: same nakładki (np. ćwiartki) zasłaniały, a radar nie pokazywał kropki.
       W karcie scena leży na własnej piaskownicy i może wypełniać pola kolorem; nad pulpitem leży
       na CUDZEJ PRACY i każdy wypełniony prostokąt to zasłonięte okno gry. Do tego okno wycina
       jeden kolor (#010203), więc półprzezroczysta plama nie staje się przezroczysta — zostaje
       brudną szybą, a cienie i poświaty są w tym oknie wyłączone arkuszem.

       Tryb `nadPulpitem` zmienia więc trzy rzeczy: pola i obszary idą SAMYM OBRYSEM, każdy jasny
       znak dostaje ciemną obwódkę (`outline` — nie cień, bo cienie tu nie działają), a to, co było
       rysowane półprzezroczystą bielą albo gradientem do przezroczystości, dostaje pełny kolor.
       Bez obwódki różowa kreska na białym oknie gry jest nie do zobaczenia. */
    let nadPulpitem = false;
    this.nadPulpitem = function (tak) {
      nadPulpitem = !!tak;
      korzen.classList.toggle('sc-nad', nadPulpitem);
    };

    let stalyPodglad = false, blyskDo = 0, kolorSekcji = '';
    const zegar = function () { return (global.performance && performance.now) ? performance.now() : Date.now(); };
    this.stalyPodgladObszaru = function (tak) { stalyPodglad = !!tak; };
    this.blysnijObszarem = function (ms) { blyskDo = zegar() + (ms > 0 ? ms : 1600); };
    /* KOLOR OBRYSU PODGLĄDU — nadpisanie z zewnątrz, puste = kolor osi Y z ustawień.
       Ustawia to karta (rf-50k), gdy skanerów w konfiguracji jest kilka: obszar ma wtedy świecić
       kolorem swojej pigułki, żeby „ten trzeci na liście" i „ten prostokąt na dole ekranu" były
       jedną rzeczą. Okno nad pulpitem tej metody nie woła, więc tam nic się nie zmienia. */
    this.kolorPodgladu = function (hex) { kolorSekcji = hex || ''; };

    function pokaz(e, tak) { e.style.display = tak ? '' : 'none'; }
    function ustawProstokat(e, r) {
      e.style.transform = 'translate(' + Math.round(r.x) + 'px,' + Math.round(r.y) + 'px)';
      e.style.width = Math.round(r.w) + 'px';
      e.style.height = Math.round(r.h) + 'px';
    }

    /* Przyciemnienie: cztery prostokąty dookoła obszaru. Nie jeden z „dziurą", bo dziura
       w gradientach potrafi zostawić półprzezroczysty ślad, a nad pulpitem to widać. */
    function rysujPrzyciemnienie(obszar, moc, ekran) {
      if (!obszar || moc <= 0) { w.przyciem.forEach(function (e) { pokaz(e, false); }); return; }
      const a = 'rgba(10,8,6,' + moc + ')';
      const pk = ekran.x + ekran.w, dk = ekran.y + ekran.h;   // prawa i dolna krawędź planszy
      const p = [
        { x: ekran.x, y: ekran.y, w: ekran.w, h: Math.max(0, obszar.y - ekran.y) },
        { x: ekran.x, y: obszar.y + obszar.h, w: ekran.w, h: Math.max(0, dk - obszar.y - obszar.h) },
        { x: ekran.x, y: obszar.y, w: Math.max(0, obszar.x - ekran.x), h: obszar.h },
        { x: obszar.x + obszar.w, y: obszar.y, w: Math.max(0, pk - obszar.x - obszar.w), h: obszar.h }
      ];
      w.przyciem.forEach(function (e, i) {
        pokaz(e, true);
        e.style.background = a;
        ustawProstokat(e, p[i]);
      });
    }

    /* Ślad po wybranej współrzędnej: po zatrzymaniu poziomego paska zostaje cienka linia
       na tej wysokości. Bez niej po drugim przebiegu nie widać, co się właściwie wybrało. */
    function rysujKreski(stan, ust, ekran) {
      const maY = stan.tryb === 'pasy' && stan.etap > 0 && stan.obszar && stan.obszar.h < ekran.h;
      const maX = stan.tryb === 'pasy' && stan.etap > 0 && stan.obszar && stan.obszar.w < ekran.w;
      pokaz(w.kresY, maY);
      pokaz(w.kresX, maX);
      if (maY) ustawProstokat(w.kresY, { x: ekran.x, y: stan.obszar.y + stan.obszar.h / 2 - 1, w: ekran.w, h: 2 });
      if (maX) ustawProstokat(w.kresX, { x: stan.obszar.x + stan.obszar.w / 2 - 1, y: ekran.y, w: 2, h: ekran.h });
    }

    function rysujPasmo(stan, ust, ekran) {
      const p = stan.pasmo;
      pokaz(w.pasmo, !!p);
      if (!p) { pokaz(w.etykieta, false); return; }   // inaczej podpis paska zostaje w trybie ćwiartek
      const kolor = kolorRoli(ust, p);
      // POKRYCIE: pasek może być krótszy niż obszar i wtedy stoi w jego środku. Wpływa wyłącznie
      // na to, ile zasłania — wybór idzie po osi ruchu, a gdzie skaner szuka, mówi obrys obszaru.
      const pokr = Math.max(5, Math.min(100, (p.os === 'y' ? ust.pokrycieY : ust.pokrycieX) || 100)) / 100;
      const r = p.os === 'y'
        ? { x: stan.obszar.x + stan.obszar.w * (1 - pokr) / 2, y: p.od,
            w: stan.obszar.w * pokr, h: Math.max(2, p.do - p.od) }
        : { x: p.od, y: stan.obszar.y + stan.obszar.h * (1 - pokr) / 2,
            w: Math.max(2, p.do - p.od), h: stan.obszar.h * pokr };
      ustawProstokat(w.pasmo, r);
      const krycie = Math.round(Math.max(0, Math.min(1, ust.kryciePasma === undefined ? 0.26 : ust.kryciePasma)) * 100);
      w.pasmo.style.background = 'color-mix(in srgb, ' + kolor + ' ' + krycie + '%, transparent)';
      w.pasmo.style.boxShadow = ust.poswiata ? '0 0 0 2px ' + kolor + ', 0 0 22px ' + kolor + '66' : '0 0 0 2px ' + kolor;
      /* ⚠️ NAD PULPITEM PASEK NIE MIAŁ KRAWĘDZI. Obwódkę rysował `box-shadow`, a te są w oknie
         nad pulpitem wyłączone arkuszem (rozmycie nie trafia w kolor klucza i zostaje czarną
         aureolą). Zostawało samo wypełnienie 26%, czyli blady prostokąt bez granic — stąd
         „niskie kontrasty". `outline` nie jest cieniem, nie rozmywa się i nie zmienia układu. */
      w.pasmo.style.outline = nadPulpitem ? '2px solid ' + kolor : '';
      // Postój na krańcu ma być WIDOCZNY: pasek pulsuje, żeby nie wyglądało to na zawieszenie.
      w.pasmo.classList.toggle('sc-czeka', stan.czekaNaStart > 0);
      w.pasmo.classList.toggle('sc-stoi', !!p.stoi && stan.czekaNaStart <= 0);
      // Kreska w środku pasma — to ona jest „miejscem", nie cała szerokość.
      w.krawedz.style.background = kolor;
      if (p.os === 'y') {
        w.krawedz.style.left = '0'; w.krawedz.style.right = '0';
        w.krawedz.style.top = 'calc(50% - 1px)'; w.krawedz.style.bottom = 'auto';
        w.krawedz.style.width = 'auto'; w.krawedz.style.height = '2px';
      } else {
        w.krawedz.style.top = '0'; w.krawedz.style.bottom = '0';
        w.krawedz.style.left = 'calc(50% - 1px)'; w.krawedz.style.right = 'auto';
        w.krawedz.style.width = '2px'; w.krawedz.style.height = 'auto';
      }
      // Etykieta biegnąca z paskiem: numer kroku i podpowiedź, tuż obok, nie w rogu ekranu.
      if (ust.etykietaPrzyPasku) {
        pokaz(w.etykieta, true);
        w.etykieta.textContent = (p.os === 'y' ? 'wysokość' : 'poziom')
          + (p.dokladny ? ' — dokładnie' : '');
        w.etykieta.style.borderColor = kolor;
        w.etykieta.style.color = kolor;
        const prawa = ekran.x + ekran.w - 150;
        const ex = p.os === 'y' ? Math.min(prawa, stan.obszar.x + 12) : Math.min(prawa, p.do + 10);
        // Podpis stoi NAD paskiem, ale przy górnej krawędzi przeskakuje POD niego: wyżej jest
        // pasek stanu i róg ramki, więc etykieta wchodziłaby pod jedno i drugie.
        const gora = ekran.y + 46;
        const ey = p.os === 'y'
          ? (p.od - 26 < gora ? p.do + 6 : p.od - 26)
          : Math.max(gora, stan.obszar.y + 12);
        w.etykieta.style.transform = 'translate(' + Math.round(ex) + 'px,' + Math.round(ey) + 'px)';
      } else pokaz(w.etykieta, false);
    }

    function rysujBloki(stan, ust) {
      const lista = stan.bloki || [];
      pokaz(w.bloki, lista.length > 0);
      if (!lista.length) return;
      if (blokiIle !== lista.length) {
        w.bloki.innerHTML = '';
        for (let i = 0; i < lista.length; i++) {
          const b = el(w.bloki, 'sc-blok');
          // Numer pola: kolejność zapalania to lewe górne → prawe górne → lewe dolne → prawe
          // dolne, czyli jak czytanie. Bez cyfr trzeba jej się domyślać z jednego przebiegu.
          el(b, 'sc-blok-nr').textContent = (i + 1);
        }
        blokiIle = lista.length;
      }
      const dzieci = w.bloki.children;
      for (let i = 0; i < lista.length; i++) {
        const b = lista[i], d = dzieci[i];
        ustawProstokat(d, b);
        const aktywny = stan.blok && Math.abs(b.x - stan.blok.x) < 0.5 && Math.abs(b.y - stan.blok.y) < 0.5;
        d.classList.toggle('sc-aktywny', !!aktywny);
        if (nadPulpitem) {
          /* NAD PULPITEM POLE NIE MA WYPEŁNIENIA. Zapalone pole ćwiartek zajmuje ćwiartkę ekranu
             (przy siatce 2×2 — całe 25%!), więc wypełnienie zasłania dokładnie to, w co człowiek
             celuje. Zostaje sama ramka: grubsza i w pełnym kolorze na polu zapalonym, cienka
             i stonowana na pozostałych. Kolor stonowany jest PEŁNY, nie półprzezroczysta biel —
             biel 22% znika na jasnym oknie gry i siatki nie widać wcale. */
          d.style.background = 'transparent';
          d.style.borderColor = aktywny ? KOLORY.blok : '#4a7f96';
          d.style.borderWidth = aktywny ? '3px' : '1px';
          d.style.boxShadow = 'none';
        } else {
          d.style.borderColor = aktywny ? KOLORY.blok : 'rgba(255,255,255,.22)';
          d.style.background = aktywny ? 'color-mix(in srgb, ' + KOLORY.blok + ' 24%, transparent)' : 'transparent';
          d.style.boxShadow = aktywny && ust.poswiata ? '0 0 24px ' + KOLORY.blok + '88' : 'none';
        }
      }
    }

    function rysujElementy(stan, cele, ust) {
      const s = stan.elementy;
      pokaz(w.elementy, !!s);
      if (!s) return;
      if (elementyIle !== cele.length) {
        w.elementy.innerHTML = '';
        for (let i = 0; i < cele.length; i++) el(w.elementy, 'sc-elem');
        elementyIle = cele.length;
      }
      const grupa = s.grupy[s.grupa] || [];
      const aktywnyIdx = s.wIdx >= 0 ? grupa[s.wIdx] : -1;
      const wGrupie = {};
      grupa.forEach(function (i) { wGrupie[i] = true; });
      const dzieci = w.elementy.children;
      for (let i = 0; i < cele.length; i++) {
        const c = cele[i], d = dzieci[i];
        ustawProstokat(d, { x: c.x - 3, y: c.y - 3, w: c.w + 6, h: c.h + 6 });
        const wyroz = s.wybieraGrupe ? wGrupie[i] : (i === aktywnyIdx);
        d.classList.toggle('sc-aktywny', !!wyroz);
        d.style.borderColor = wyroz ? KOLORY.blok : 'rgba(255,255,255,.16)';
        d.style.background = wyroz ? 'color-mix(in srgb, ' + KOLORY.blok + ' 22%, transparent)' : 'transparent';
      }
    }

    function rysujRadar(stan, ust) {
      const r = stan.radar;
      pokaz(w.radar, !!r);
      if (!r) return;
      w.radar.style.transform = 'translate(' + Math.round(r.sx) + 'px,' + Math.round(r.sy) + 'px)';
      w.promien.style.width = Math.round(r.maxR) + 'px';
      w.promien.style.transform = 'rotate(' + (r.kat * 180 / Math.PI) + 'deg)';
      // Gradient do przezroczystości nad pulpitem NIE ZNIKA — okno wycina jeden kolor, a piksele
      // „prawie przezroczyste" zostają brudną smugą. Tam promień jest pełnym kolorem, w karcie
      // gaśnie ku krawędzi jak dotąd.
      w.promien.style.background = nadPulpitem ? KOLORY.radar
        : 'linear-gradient(90deg,' + KOLORY.radar + ',transparent)';
      pokaz(w.kropka, r.r !== null && r.r !== undefined);
      if (r.r !== null && r.r !== undefined) {
        w.kropka.style.transform = 'translate(' + Math.round(Math.cos(r.kat) * r.r - 9) + 'px,'
          + Math.round(Math.sin(r.kat) * r.r - 9) + 'px)';
        w.kropka.style.background = KOLORY.radar;
      }
      // ŚRODEK RADARU widać dopiero z kropką: bez niego promień wychodzi znikąd i nie wiadomo,
      // wokół czego się kręci. W pierwszym etapie (sam kierunek) to jedyny stały punkt na ekranie.
      w.srodek.style.background = KOLORY.radar;
      w.srodek.classList.toggle('sc-radar-stoi', !!r.stoi);
    }

    function rysujMenu(stan, ekran) {
      pokaz(w.menu, !!stan.menu);
      if (!stan.menu) { ostatniMenu = -1; return; }
      // Lista bywa zmieniana w panelu w trakcie, więc podpis odświeżamy przy każdym otwarciu.
      const podpis = stan.menu.pozycje.map(function (a) { return a.kod; }).join(',');
      if (w.menu._podpis !== podpis) {
        w.menu.innerHTML = '';
        stan.menu.pozycje.forEach(function (a) {
          const p = el(w.menu, 'sc-mpoz');
          el(p, 'sc-mpoz-ikona').textContent = a.ikona || '';
          el(p, 'sc-mpoz-nazwa').textContent = NS.nazwaAkcji(a.kod);
          if (a.klawisze) el(p, 'sc-mpoz-skrot').textContent = a.klawisze.toUpperCase();
        });
        w.menu._podpis = podpis;
        ostatniMenu = -1;
      }
      const p = stan.punkt || { x: ekran.x + ekran.w / 2, y: ekran.y + ekran.h / 2 };
      const x = Math.min(ekran.x + ekran.w - 250, Math.max(ekran.x + 8, p.x + 18));
      const y = Math.min(ekran.y + ekran.h - 40 - stan.menu.pozycje.length * 30, Math.max(ekran.y + 8, p.y + 18));
      w.menu.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
      if (ostatniMenu !== stan.menu.idx) {
        for (let i = 0; i < w.menu.children.length; i++)
          w.menu.children[i].classList.toggle('sc-aktywny', i === stan.menu.idx);
        ostatniMenu = stan.menu.idx;
      }
    }

    function rysujPunkt(stan) {
      const p = stan.punkt;
      pokaz(w.punkt, !!p);
      if (!p) return;
      w.punkt.style.transform = 'translate(' + Math.round(p.x - 22) + 'px,' + Math.round(p.y - 22) + 'px)';
      w.punkt.classList.toggle('sc-dociagniety', !!p.cel);
    }

    /* Znacznik kliknięcia — zostaje na chwilę po akcji. W teście na sucho to jedyny dowód,
       że coś się wydarzyło, więc jest wyraźny i podpisany. */
    /* ŚLAD TRZYMA SWÓJ UŁAMEK RAMKI, a nie piksel okna. Ramka podglądu w karcie jest lepka
       i jedzie ze stroną, a ślad żyje 2,6 s — więc przewinięcie w tym czasie zostawiało kropkę
       tam, gdzie ramka BYŁA (złapał to `scan_card_harness`: ślad 200 px pod dolną krawędzią
       podglądu). Ta sama zasada, co przy `ustawEkran` w silniku: pozycja w ułamkach przeżywa
       i przesunięcie, i zmianę rozmiaru. */
    const slady = [];
    function ustawSlad(z, e) {
      z.el.style.transform = 'translate(' + Math.round(e.x + z.u * e.w - 26) + 'px,'
        + Math.round(e.y + z.v * e.h - 26) + 'px)';
    }
    this.slad = function (punkt, akcja, ekran) {
      const s = el(w.slady, 'sc-slad');
      const e = ekran || { x: 0, y: 0, w: 1, h: 1 };
      const z = { el: s, u: e.w ? (punkt.x - e.x) / e.w : 0, v: e.h ? (punkt.y - e.y) / e.h : 0 };
      slady.push(z);
      ustawSlad(z, e);
      const opis = el(s, 'sc-slad-opis');
      opis.textContent = akcja;
      // Podpis ucieka na lewo, gdy ślad jest przy PRAWEJ krawędzi ramki. Liczone od krawędzi,
      // nie od zera okna — w karcie ramka zaczyna się dopiero w połowie ekranu, więc porównanie
      // z samą szerokością przerzucało podpis już w jej środku.
      if (punkt.x > e.x + e.w - 180) opis.classList.add('sc-z-lewej');
      setTimeout(function () { s.classList.add('sc-gasnie'); }, 1400);
      setTimeout(function () {
        if (s.parentNode) s.parentNode.removeChild(s);
        const i = slady.indexOf(z);
        if (i >= 0) slady.splice(i, 1);
      }, 2600);
    };
    this.wyczyscSlady = function () { w.slady.innerHTML = ''; slady.length = 0; };

    /* Jedno wywołanie na klatkę. */
    this.rysuj = function (stan, ust, ekran, cele) {
      const biegnie = stan.faza === 'biegnie' || stan.faza === 'menu' || stan.faza === 'odliczanie';
      korzen.classList.toggle('sc-cicho', !biegnie);
      rysujPrzyciemnienie(biegnie && stan.obszar ? stan.obszar : null, ust.przyciemnienie, ekran);
      // Obrys pokazuje dwie różne rzeczy, zależnie od tego, czy skaner jedzie: w ruchu jest to
      // obszar ZAWĘŻONY do bieżącego kroku, na postoju — cały obszar z ustawień (patrz podgląd).
      const blyska = !biegnie && zegar() < blyskDo;
      const podglad = !biegnie && (stalyPodglad || blyska);
      pokaz(w.obszar, (biegnie && !!stan.obszar && stan.tryb !== 'elementy') || podglad);
      w.obszar.classList.toggle('sc-obszar-podglad', podglad);
      w.obszar.classList.toggle('sc-obszar-blysk', blyska);
      // Wypełnienie TYLKO w podglądzie: w ruchu obszar ma zostać przezroczysty, bo to po nim
      // jedzie pasek. Krycie z ustawień; 0 = sam obrys (tak robi okno nad pulpitem — Windows
      // wycina z niego jeden kolor, więc „półprzezroczyste" wyszłoby tam pełną plamą).
      const mocPodgladu = Math.max(0, Math.min(0.6, ust.podgladObszaru === undefined ? 0.18 : ust.podgladObszaru));
      const kolorPodgladu = kolorSekcji || ust.kolorY || KOLORY.y;
      if (podglad && mocPodgladu > 0) {
        const proc = Math.round(Math.min(0.9, mocPodgladu * (blyska ? 1.7 : 1)) * 100);
        w.obszar.style.background = 'color-mix(in srgb, ' + kolorPodgladu + ' ' + proc + '%, transparent)';
      } else w.obszar.style.background = 'transparent';
      w.obszar.style.borderColor = podglad ? kolorPodgladu : '';
      if (biegnie && stan.obszar) ustawProstokat(w.obszar, stan.obszar);
      else if (podglad) ustawProstokat(w.obszar, ekran);
      if (slady.length) slady.forEach(function (z) { ustawSlad(z, ekran); });
      rysujKreski(stan, ust, ekran);
      rysujPasmo(stan, ust, ekran);
      rysujBloki(stan, ust);
      rysujElementy(stan, cele || [], ust);
      rysujRadar(stan, ust);
      rysujMenu(stan, ekran);
      rysujPunkt(stan);
      korzen.style.setProperty('--sc-grubosc', (ust.grubosc || 2) + 'px');
    };
  };

  NS.KOLORY_OSI = KOLORY;
  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(typeof window !== 'undefined' ? window : globalThis);
