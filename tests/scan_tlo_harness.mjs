/* SKANER EKRANU — ZRZUT GRY POD PODGLĄDEM (rf-50l) w prawdziwej przeglądarce.
   Uruchomienie: instancja testowa aplikacji na 8790 (albo RF_URL), potem

     node tests/scan_tlo_harness.mjs

   Dlaczego osobny plik, a nie dopisek do `scan_card_harness.mjs`: tamten mierzy RUCH PASKA
   i musi mieć czystą ramkę podglądu, a tu przez pół testu leży na niej obrazek. Mieszanie jednego
   z drugim skończyłoby się testem, który zależy od kolejności własnych bloków.

   Co jest sprawdzane (i dlaczego akurat to):
     • droga wgrania JEST TA SAMA, co przy upuszczeniu pliku i wklejeniu ze schowka — wszystkie
       trzy kończą się na `_sktloZPliku`, więc test woła ją z prawdziwym obiektem `File`,
     • po wgraniu piaskownica ZNIKA, a jej ikony przestają być celami dociągania (inaczej skaner
       ściągałby punkt do niewidocznego „Kosza" leżącego pod obrazem gry),
     • przeciągnięcie po zrzucie ustawia obszar — i to jest właściwy powód istnienia tej funkcji,
     • nazwa bez pliku (zestaw z innego komputera) NIE chowa piaskownicy i mówi, co się stało.

   Zrzut wgrany przez test kasujemy z `Settings/ScanTla` na końcu — katalog należy do aplikacji,
   a nie do testów. */
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
const wymagaj = createRequire(import.meta.url);
const { rfBezPierwszegoStartu } = wymagaj("./_rf_pierwszy_start.cjs");   // bez pytania i zaproszenia pierwszego startu
const { chromium } = wymagaj(path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@playwright/test'));

const ADRES = process.env.RF_URL || 'http://127.0.0.1:8790/';
const KORZEN = path.dirname(path.dirname(new URL(import.meta.url).pathname.slice(1)));
let ok = 0, zle = 0;
const bledy = [];
const spij = (ms) => new Promise(r => setTimeout(r, ms));
function sprawdz(nazwa, warunek, dodatek) {
  if (warunek) { ok++; console.log('  OK   ' + nazwa); }
  else { zle++; console.log('  ZLE  ' + nazwa + (dodatek !== undefined ? '  -> ' + JSON.stringify(dodatek) : '')); }
}

const przegladarka = await chromium.launch();
// 1920×1080: dwie kolumny (podgląd obok pokręteł) stoją od karty szerszej niż 1180 px (26-scan.css, 2026-11-21).
const page = await (await rfBezPierwszegoStartu(przegladarka.newContext({ viewport: { width: 1920, height: 1080 } }))).newPage();
/* 404 ze zrzutu, którego nie ma, jest CZĘŚCIĄ TESTU: blok „zestaw od kogoś innego" celowo prosi
   o plik spoza tego komputera, a przeglądarka każdą nieudaną prośbę o obrazek wpisuje do konsoli
   jako błąd. Filtrujemy dokładnie ten jeden przypadek, żeby „zero błędów w konsoli" dalej znaczyło
   to, co ma znaczyć. */
const OCZEKIWANY_404 = /Failed to load resource.*(404|Nie ma takiego zrzutu)/i;
page.on('console', m => { if (m.type() === 'error' && !OCZEKIWANY_404.test(m.text())) bledy.push(m.text()); });
page.on('pageerror', e => bledy.push('pageerror: ' + e.message));
await page.goto(ADRES, { waitUntil: 'domcontentloaded' });
await spij(2500);
await page.click('[data-tab="skaner"]');
await spij(900);

/* STAN STARTOWY USTAWIANY, NIE ZASTANY — poprzednie uruchomienie zostawia obszar i zrzut.
   ⚠️ OD 16.09 ZRZUT NALEŻY DO EKRANU (rf-50n), a spis ekranów celowo NIE wchodzi przez `/scan`
   (tak samo jak spis sekcji — patrz nota przy tej trasie w serwerze). Sam `tlo: ''` już więc
   podglądu nie czyści; ekrany kasujemy ich własnym wejściem, od końca listy. */
await page.evaluate(async () => {
  const czyste = Object.assign({}, window.RFScan.DOMYSLNE, window.RFScan.WYGLAD_DOM,
    { enabled: false, tlo: '' });
  await fetch('/scan?dev=d0', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(czyste)
  });
  await scanLoad('d0');
  for (let i = ((window.RFScanKarta.u.zrzuty) || []).length; i > 0; i--) {
    await fetch('/scan/zrzut?dev=d0', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ act: 'usun', n: i })
    });
  }
  await scanLoad('d0');
});
await spij(400);

console.log('\n- pasek zrzutu');
sprawdz('przycisk wgrania jest w karcie', await page.evaluate(() => !!document.getElementById('scanTloWgraj')));
sprawdz('przelacznik miejsca skanera ma dwa stany', await page.evaluate(() =>
  document.querySelectorAll('#scanGdzie [data-gdzie]').length === 2));
sprawdz('bez zrzutu przelacznik stoi na „W symulacji"', await page.evaluate(() =>
  document.querySelector('#scanGdzie [data-gdzie="karta"]').classList.contains('sk-seg-wybrany')));
sprawdz('bez zrzutu podpis mowi, jak go wgrac', (await page.evaluate(() =>
  document.getElementById('scanTloNazwa').textContent)).indexOf('Ctrl+V') > 0,
  await page.evaluate(() => document.getElementById('scanTloNazwa').textContent));
sprawdz('bez zrzutu „Zdejmij" jest zgaszony', await page.evaluate(() =>
  document.getElementById('scanTloUsun').disabled));
sprawdz('bez zrzutu widac piaskownice', await page.evaluate(() =>
  !document.getElementById('scanStage').classList.contains('sk-ma-tlo')));

console.log('\n- wgranie zrzutu (ta sama droga, co upuszczenie pliku)');
// Obrazek 16:9 z rozpoznawalnym rogiem — 640x360, żeby przeskalowanie miało co robić.
const plik = await page.evaluate(async () => {
  const pl = document.createElement('canvas');
  pl.width = 640; pl.height = 360;
  const c = pl.getContext('2d');
  c.fillStyle = '#10305a'; c.fillRect(0, 0, 640, 360);
  c.fillStyle = '#ffd400'; c.fillRect(0, 240, 640, 120);       // „dolna 1/3" do wyklikania
  const blob = await new Promise(r => pl.toBlob(r, 'image/png'));
  const f = new File([blob], 'Sól Cesto plansza.png', { type: 'image/png' });
  _sktloZPliku(f);
  for (let i = 0; i < 60 && !window.scanZrzutAktualny(); i++) await new Promise(r => setTimeout(r, 100));
  const z = window.scanZrzutAktualny();
  return z ? z.plik : '';
});
// Od 16.09 wgrany zrzut ZAKŁADA EKRAN i od razu go wybiera — „gdzie leży zrzut" ma jedną odpowiedź.
sprawdz('zrzut wgrany i zalozyl ekran', !!plik, plik);
sprawdz('nazwa jest bez ogonkow i z rozszerzeniem .jpg', /^[a-z0-9-]+\.jpg$/.test(plik || ''), plik);
await spij(900);   // zapis pokretel jest opozniony o 400 ms
{
  const cfg = await (await page.request.get(ADRES + 'scan?dev=d0')).json();
  const akt = (cfg.zrzuty || [])[(cfg.zrzutAktywny || 0) - 1];
  sprawdz('serwer zapamietal ekran z tym zrzutem', !!akt && akt.plik === plik,
    { zrzuty: (cfg.zrzuty || []).map(z => z.plik), akt: cfg.zrzutAktywny });
  sprawdz('…i ekran zaczyna z edytowanym skanerem', !!akt && (akt.sekcje || []).includes(cfg.sekcjaAktywna),
    akt && akt.sekcje);
}
sprawdz('obrazek serwuje sie z /scan/tlo',
  (await page.request.get(ADRES + 'scan/tlo?plik=' + encodeURIComponent(plik || 'x'))).status() === 200);
sprawdz('podglad pokazuje zrzut', await page.evaluate(() => {
  const w = document.getElementById('scanTlo');
  return document.getElementById('scanStage').classList.contains('sk-ma-tlo')
    && /url\(/.test(w.style.backgroundImage);
}), await page.evaluate(() => document.getElementById('scanTlo').style.backgroundImage));
sprawdz('piaskownica schowana pod zrzutem', await page.evaluate(() =>
  getComputedStyle(document.getElementById('scanSandbox')).visibility === 'hidden'));
sprawdz('ikony piaskownicy przestaly byc celami dociagania', await page.evaluate(() => {
  _scanOdswiezCele();
  return (window.RFScanKarta.silnik.cele || []).length === 0;
}), await page.evaluate(() => (window.RFScanKarta.silnik.cele || []).length));
sprawdz('zrzut kryje CALA ramke przy jednym pulpicie', await page.evaluate(() => {
  const r = document.getElementById('scanStage').getBoundingClientRect();
  const t = document.getElementById('scanTlo').getBoundingClientRect();
  return Math.abs(r.width - t.width) < 2 && Math.abs(r.height - t.height) < 2;
}));
// ⚠️ DWA POPRAWNE PODPISY. Od 16.09 ramka bierze proporcje EKRANU, więc zrzut o innych proporcjach
// jest rozciagany — i wtedy podpis mowi o tym zamiast zachecac do przeciagania. Testowy obrazek ma
// 16:9, a pulpit maszyny testowej bywa inny, wiec przyjmujemy obie odpowiedzi.
sprawdz('podpis niesie nazwe pliku i mowi, co dalej', await page.evaluate(() => {
  const t = document.getElementById('scanTloNazwa').textContent;
  const z = window.scanZrzutAktualny();
  return !!z && t.indexOf(z.plik) === 0 && /(przeciągnij|proporcje)/.test(t);
}), await page.evaluate(() => document.getElementById('scanTloNazwa').textContent));

console.log('\n- wyznaczanie obszaru po zrzucie');
{
  const r = await page.evaluate(() => {
    const b = document.getElementById('scanStage').getBoundingClientRect();
    return { x: b.left, y: b.top, w: b.width, h: b.height };
  });
  // Dolna 1/3 na środku: od 25% do 75% wszerz, od 66% do 100% wzdłuż.
  await page.mouse.move(r.x + r.w * 0.25, r.y + r.h * 0.66);
  await page.mouse.down();
  await page.mouse.move(r.x + r.w * 0.50, r.y + r.h * 0.80, { steps: 6 });
  await page.mouse.move(r.x + r.w * 0.75, r.y + r.h * 0.98, { steps: 6 });
  await page.mouse.up();
  await spij(300);
  const u = await page.evaluate(() => {
    const u = window.RFScanKarta.u;
    return { obszar: u.obszar, jed: u.obszarJednostka, x1: u.obszarX1, y1: u.obszarY1, x2: u.obszarX2, y2: u.obszarY2 };
  });
  sprawdz('przeciagniecie ustawia wlasny prostokat', u.obszar === 'wlasny', u);
  sprawdz('liczby zgadzaja sie z tym, co zaznaczono (± 1,5 %)',
    Math.abs(u.x1 - 25) < 1.5 && Math.abs(u.x2 - 75) < 1.5
    && Math.abs(u.y1 - 66) < 1.5 && Math.abs(u.y2 - 98) < 1.5, u);
  sprawdz('jednostka zostaje procentowa', u.jed === 'procent', u.jed);
  sprawdz('pola „Od lewej" pokazuja nowe liczby', await page.evaluate(() => {
    const p = Array.from(document.querySelectorAll('#scanFields .sk-liczba'));
    return p.some(i => Math.abs(parseFloat(i.value) - window.RFScanKarta.u.obszarX1) < 0.2);
  }));
  await spij(900);
  sprawdz('serwer zapamietal obszar z przeciagniecia',
    Math.abs((await (await page.request.get(ADRES + 'scan?dev=d0')).json()).obszarX1 - u.x1) < 0.2);
}
/* ZAZNACZENIE NIE WYCHODZI POZA ZRZUT (16.09). Po wrzuceniu zrzutu dało się zaznaczać obszar
   poza nim. Nasłuch ruchu siedzi na OKNIE (musi —
   inaczej szybkie przeciągnięcie gubiłoby się przy pierwszym wyjściu poza podgląd), więc prostokąt
   jechał za kursorem przez pół strony, a zapis i tak przycinał liczby do 0…100%. Test pilnuje obu
   końców naraz: gumka ma STAĆ na krawędzi obrazu, a zapisane liczby mają być tym, co widać. */
console.log('\n- zaznaczenie nie wychodzi poza zrzut');
{
  // Ramka bierze szerokość kolumny (2026-11-21), więc bywa wyższa niż pół okna:
  // najpierw stawiamy ją na środku okna, żeby punkt „daleko poza ramką" był naprawdę poza nią.
  const r = await page.evaluate(() => {
    const st = document.getElementById('scanStage');
    st.scrollIntoView({ block: 'center' });
    const b = st.getBoundingClientRect();
    return { x: b.left, y: b.top, w: b.width, h: b.height, vw: innerWidth, vh: innerHeight };
  });
  await spij(200);
  await page.mouse.move(r.x + r.w * 0.30, r.y + r.h * 0.40);
  await page.mouse.down();
  await page.mouse.move(r.x + r.w * 0.60, r.y + r.h * 0.70, { steps: 4 });
  // Daleko poza ramką — przy samej krawędzi okna, czyli tam, gdzie w zgłoszonym błędzie
  // lądował prostokąt rysowany po pokrętłach i po prawej kolumnie.
  await page.mouse.move(Math.min(r.vw - 5, r.x + r.w + 60), Math.min(r.vh - 5, r.y + r.h + 60), { steps: 6 });
  const g = await page.evaluate(() => {
    const b = document.getElementById('scanStage').getBoundingClientRect();
    const d = document.querySelector('.sk-gumka').getBoundingClientRect();
    return { mniejsza: d.right <= b.right + 1 && d.bottom <= b.bottom + 1
                       && d.left >= b.left - 1 && d.top >= b.top - 1,
             x2: (d.right - b.left) / b.width * 100, y2: (d.bottom - b.top) / b.height * 100 };
  });
  sprawdz('gumka staje na krawedzi zrzutu, nie jedzie za kursorem', g.mniejsza, g);
  await page.mouse.up();
  await spij(300);
  const u = await page.evaluate(() => {
    const u = window.RFScanKarta.u;
    return { x1: u.obszarX1, y1: u.obszarY1, x2: u.obszarX2, y2: u.obszarY2 };
  });
  sprawdz('zapisane liczby to dokladnie to, co bylo narysowane',
    Math.abs(u.x1 - 30) < 1.5 && Math.abs(u.y1 - 40) < 1.5 && u.x2 === 100 && u.y2 === 100, u);
}

sprawdz('samo klikniecie (bez ciagniecia) NIE zmienia obszaru', await page.evaluate(async () => {
  const przed = window.RFScanKarta.u.obszarX1;
  const b = document.getElementById('scanStage').getBoundingClientRect();
  const ev = (n, x, y) => document.getElementById('scanStage').dispatchEvent(
    new PointerEvent(n, { clientX: x, clientY: y, button: 0, bubbles: true }));
  ev('pointerdown', b.left + 60, b.top + 60);
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: b.left + 62, clientY: b.top + 61, bubbles: true }));
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: b.left + 62, clientY: b.top + 61, bubbles: true }));
  await new Promise(r => setTimeout(r, 120));
  return window.RFScanKarta.u.obszarX1 === przed;
}));

/* PODGLĄD JEST POMNIEJSZONĄ KOPIĄ EKRANU (16.09). Ekrany muszą współdzielić podgląd
   i rozdzielczość (albo proporcje), inaczej podgląd nie ma sensu.
   Sprawdzamy trzy rzeczy, bo dopiero razem znaczą „ta sama scena, tylko mniejsza”:
   kształt ramki, skalę pokręteł „w pikselach” i CZAS — ten ostatni jest tu najważniejszy, bo to
   on decyduje, czy trening celności w karcie mierzy cokolwiek, co da się przenieść na pulpit. */
console.log('\n- podglad w skali i proporcjach ekranu');
{
  /* ⚠️ UKŁAD MONITORÓW POBIERAMY SAMI. Karta pyta o niego przy budowie i potem co 10 s, więc
     w teście trafia się moment, w którym cache modelu jest jeszcze pusty — a wtedy ramka
     słusznie zostaje przy starej arytmetyce i blok nie miałby czego mierzyć. */
  const g = await page.evaluate(async () => {
    const j = await (await fetch('/screens?dev=d0')).json();
    if (j && j.desktop) RFScan.ustawEkrany(j);
    scanTloSync();                       // ramka bierze proporcje z nowo poznanego ekranu
    scanSilnikOdswiez(false);
    await new Promise(r => setTimeout(r, 250));
    const st = document.getElementById('scanStage').getBoundingClientRect();
    const b = window.scanBazaPulpitu ? window.scanBazaPulpitu() : null;
    const u = window.RFScanKarta.u;
    const up = window.scanUstawieniaPodgladu();
    return {
      ramka: { w: st.width, h: st.height },
      baza: b,
      maFunkcje: typeof window.scanBazaPulpitu,
      pulpit: (window.RFScan && RFScan.ekrany) ? RFScan.ekrany.desktop : null,
      skala: window.scanSkalaPodgladu(),
      pasmoY: [u.pasmoY, up.pasmoY],
      predkosc: [u.predkosc, up.predkosc],
      silnik: { pasmoY: window.RFScanKarta.silnik.u.pasmoY, predkosc: window.RFScanKarta.silnik.u.predkosc },
      // Czas przejazdu liczony DWA razy: w podglądzie (przeskalowane pokrętła, mała ramka)
      // i na ekranie (pokrętła z konfiguracji, prawdziwy prostokąt). Mają wyjść takie same.
      czasPodgladu: RFScan.szacujCzas(up, { x: 0, y: 0, w: st.width, h: st.height }),
      czasEkranu: b ? RFScan.szacujCzas(u, { x: 0, y: 0, w: b.w, h: b.h }) : null
    };
  });
  if (!g.baza) {
    console.log('  POMINIETE: brak ukladu monitorow -> ' + JSON.stringify({ fn: g.maFunkcje, pulpit: g.pulpit }));
  } else {
    const propRamki = g.ramka.w / g.ramka.h, propBazy = g.baza.w / g.baza.h;
    sprawdz('ramka ma proporcje ekranu, ktory udaje (± 2 %)',
      Math.abs(propRamki - propBazy) / propBazy < 0.02,
      { ramka: +propRamki.toFixed(3), ekran: +propBazy.toFixed(3) });
    sprawdz('skala to stosunek ramki do ekranu',
      Math.abs(g.skala - g.ramka.w / g.baza.w) < 0.01, { skala: g.skala, ramka: g.ramka.w, ekran: g.baza.w });
    sprawdz('pokretla „w pikselach" jada do silnika w tej skali',
      Math.abs(g.pasmoY[1] - g.pasmoY[0] * g.skala) < 1
      && Math.abs(g.predkosc[1] - g.predkosc[0] * g.skala) < 1, g);
    sprawdz('…i silnik ma je juz przeliczone',
      Math.abs(g.silnik.pasmoY - g.pasmoY[1]) < 1 && Math.abs(g.silnik.predkosc - g.predkosc[1]) < 1, g.silnik);
    sprawdz('przejazd trwa tyle samo w podgladzie, co na ekranie (± 3 %)',
      Math.abs(g.czasPodgladu - g.czasEkranu) / Math.max(0.1, g.czasEkranu) < 0.03,
      { podglad: +g.czasPodgladu.toFixed(2), ekran: +g.czasEkranu.toFixed(2) });
  }
}

/* POWRÓT Z PULPITU ODŚWIEŻA KARTĘ (16.09). Po przejściu z pulpitu na symulację widok nie
   aktualizował się, dopóki nie zmieniło się skanera. Obszar ustawiony myszą nad
   pulpitem leży na serwerze, a karta trzymała swoją kopię sprzed wyprawy. */
console.log('\n- powrot z pulpitu odswieza podglad');
{
  const wynik = await page.evaluate(async () => {
    const u = window.RFScanKarta.u;
    window.RFScanTlo.ustawGdzie('pulpit', 'edycja');          // tylko układ karty, bez otwierania okna
    // …a w tym czasie „okno nad pulpitem" zapisuje obszar (to samo robi rf-50m po puszczeniu myszy)
    await fetch('/scan?dev=d0', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, u, {
        obszar: 'wlasny', obszarJednostka: 'procent',
        obszarX1: 12, obszarX2: 64, obszarY1: 22, obszarY2: 78
      }))
    });
    await new Promise(r => setTimeout(r, 300));
    const przed = { obszar: u.obszar, x1: u.obszarX1 };
    rfOnScanOkno({ open: false });                            // tą drogą karta dowiaduje się o zamknięciu
    await new Promise(r => setTimeout(r, 900));
    const po = window.RFScanKarta.u;
    const st = document.getElementById('scanStage').getBoundingClientRect();
    const e = (typeof window._scanEkran === 'function') ? window._scanEkran() : null;
    return { przed, po: { obszar: po.obszar, x1: po.obszarX1, x2: po.obszarX2 },
             obrys: e ? { x: (e.x - st.left) / st.width * 100, x2: (e.x + e.w - st.left) / st.width * 100 } : null };
  });
  sprawdz('karta czyta konfiguracje na nowo, bez przelaczania sekcji',
    wynik.po.obszar === 'wlasny' && Math.abs(wynik.po.x1 - 12) < 0.6, wynik);
  sprawdz('…i obrys w ramce od razu pokazuje nowy obszar',
    !!wynik.obrys && Math.abs(wynik.obrys.x - 12) < 1.5 && Math.abs(wynik.obrys.x2 - 64) < 1.5, wynik.obrys);
}

console.log('\n- zrzut, ktorego nie ma na tym komputerze (zestaw od kogos innego)');
// Ekran z nazwa pliku, ktorego tu nie ma - dokladnie to przywozi preset z cudzej maszyny.
// UWAGA: droga aplikacji (`scanZrzutDodaj`), a nie goly `fetch`: to ona przepuszcza odpowiedz
// przez `scanCfgArrived`, czyli przez jedyne miejsce, ktore przerysowuje ramke, podpis i pigulki.
await page.evaluate(async () => {
  await window.scanZrzutDodaj('czegos-takiego-nie-ma-00000000.jpg', 'Obcy');
});
await spij(700);
sprawdz('brak pliku NIE chowa piaskownicy', await page.evaluate(() =>
  !document.getElementById('scanStage').classList.contains('sk-ma-tlo')));
sprawdz('podpis mowi wprost, ze zrzutu tu nie ma', /nie ma na tym komputerze/.test(
  await page.evaluate(() => document.getElementById('scanTloNazwa').textContent)),
  await page.evaluate(() => document.getElementById('scanTloNazwa').textContent));

console.log('\n- wgranie TEGO SAMEGO zrzutu jeszcze raz (nasza wlasna rada przy braku pliku)');
// Nazwa niesie skrot TRESCI, wiec ten sam obrazek = ta sama nazwa. Gdyby synchronizacja pytala
// tylko „czy nazwa sie zmienila", rada „wgraj go jeszcze raz" nie robilaby nic — a wlasnie to
// mowimy czlowiekowi, ktoremu brakuje pliku.
{
  const ten_sam = await page.evaluate(async () => {
    const pl = document.createElement('canvas');
    pl.width = 640; pl.height = 360;
    const c = pl.getContext('2d');
    c.fillStyle = '#10305a'; c.fillRect(0, 0, 640, 360);
    c.fillStyle = '#ffd400'; c.fillRect(0, 240, 640, 120);      // TA SAMA tresc, co wyzej
    const blob = await new Promise(r => pl.toBlob(r, 'image/png'));
    _sktloZPliku(new File([blob], 'Sól Cesto plansza.png', { type: 'image/png' }));
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (document.getElementById('scanStage').classList.contains('sk-ma-tlo')) break;
    }
    const z = window.scanZrzutAktualny();
    return { tlo: z ? z.plik : '', ekranow: (window.RFScanKarta.u.zrzuty || []).length,
             widac: document.getElementById('scanStage').classList.contains('sk-ma-tlo') };
  });
  sprawdz('ta sama tresc daje te sama nazwe', ten_sam.tlo === plik, ten_sam);
  // I NIE MNOZY EKRANOW: serwer poznaje zrzut po nazwie (skrot tresci) i wybiera ten, ktory juz jest.
  sprawdz('...i nie zaklada drugiego ekranu na tym samym zrzucie', ten_sam.ekranow === 2, ten_sam);
  sprawdz('mimo tej samej nazwy zrzut WRACA na podglad', ten_sam.widac === true, ten_sam);
}

console.log('\n- zdjecie zrzutu');
// „Zdejmij" nie kasuje ekranu - zdejmuje go z PODGLADU. Ekran ze swoimi skanerami zostaje
// na liscie, a ramka wraca do piaskownicy, czyli pokazuje wszystkie obrysy naraz.
// Od UX 261120 L4d rząd wybranej planszy stoi w „Zaawansowanych” (piętro 3): człowiek otwiera je
// jednym kliknięciem, zanim sięgnie po „Zdejmij”.
await page.click('#scanAdv > summary');
await page.click('#scanTloUsun');
await spij(500);
sprawdz('po zdjeciu wraca piaskownica', await page.evaluate(() =>
  !document.getElementById('scanStage').classList.contains('sk-ma-tlo')
  && getComputedStyle(document.getElementById('scanSandbox')).visibility !== 'hidden'));
sprawdz('cele piaskownicy wracaja', await page.evaluate(() => {
  _scanOdswiezCele();
  return (window.RFScanKarta.silnik.cele || []).length > 20;
}), await page.evaluate(() => (window.RFScanKarta.silnik.cele || []).length));

console.log('\n- stan okna nad pulpitem');
// Okna NIE otwieramy: uruchomiłoby prawdziwą przeglądarkę na cały pulpit człowieka, który akurat
// pracuje. Sprawdzamy kontrakt trasy i to, że przełącznik czyta z niej stan.
{
  const st = await (await page.request.get(ADRES + 'scan/okno')).json();
  sprawdz('trasa /scan/okno mowi, ze nic nie stoi', st.open === false && st.tryb === '', st);
  await page.evaluate(() => _sktloStanOkna());
  await spij(300);
  sprawdz('przelacznik pokazuje „W symulacji"', await page.evaluate(() =>
    document.querySelector('#scanGdzie [data-gdzie="karta"]').classList.contains('sk-seg-wybrany')));
}

/* ==========================================================================================
   SKANER NA PULPICIE: KARTA PRZESTAWIA UKLAD (15.09)

   Tryby „na pulpicie" i „na zrzucie/symulacji" sa rozdzielone: widoczny jest tylko jeden,
   a UI przestawia sie tak, zeby zrekompensowac nieaktywny lewy panel podgladu.

   OKNA NIE OTWIERAMY — otworzyloby prawdziwa przegladarke na caly pulpit czlowieka, ktory
   akurat pracuje (ta sama zasada, co w bloku wyzej). Podstawiamy odpowiedz trasy `/scan/okno`
   i wolamy `_sktloStanOkna()`, czyli dokladnie te droge, ktora karta poznaje stan po wejsciu
   w zakladke i co 5 s. To ona byla zepsuta: czytala `tryb === "podglad"`, wiec PRACUJACY skaner
   (tryb „skan") pokazywal sie jako „W aplikacji", a ramka podgladu udawala, ze to ona skanuje.
   ========================================================================================== */
console.log('\n- skaner na pulpicie: uklad karty');
{
  // Szerokosci PRZED przestawieniem — „ui sie przestawia" jest twierdzeniem o pikselach, wiec
  // mierzymy je, a nie ogladamy klase.
  const przed = await page.evaluate(() => ({
    prawa: Math.round(document.querySelector('.sk-prawa').getBoundingClientRect().width),
    ramka: !!document.getElementById('scanStage').offsetParent,
    pilot: !!document.getElementById('scanPilot').offsetParent
  }));
  sprawdz('przed: ramka podgladu widoczna, pilota nie ma', przed.ramka && !przed.pilot, przed);

  await page.evaluate(() => {
    window.__rfOknoStan = { open: true, tryb: 'skan', dev: 'd0' };
    window.__rfZapytania = [];
    window.__rfFetchOryg = window.fetch;
    window.fetch = function (url, opts) {
      const u = String(url || '');
      window.__rfZapytania.push(((opts || {}).method || 'GET') + ' ' + u);
      if (u.indexOf('/scan/okno') === 0 && ((opts || {}).method || 'GET') === 'GET')
        return Promise.resolve(new Response(JSON.stringify(window.__rfOknoStan),
          { headers: { 'Content-Type': 'application/json' } }));
      return window.__rfFetchOryg.apply(this, arguments);
    };
    _sktloStanOkna();
  });
  await spij(400);

  sprawdz('pracujacy skaner NAD PULPITEM przestawia segment na „Na pulpicie"',
    await page.evaluate(() => document.querySelector('#scanGdzie [data-gdzie="pulpit"]')
      .classList.contains('sk-seg-wybrany')));
  sprawdz('karta dostaje klase sk-na-pulpicie', await page.evaluate(() =>
    document.getElementById('scanCard').classList.contains('sk-na-pulpicie')));
  sprawdz('ramka podgladu SCHODZI (nie udaje, ze skanuje)', await page.evaluate(() =>
    !document.getElementById('scanStage').offsetParent));
  sprawdz('w jej miejscu staje panel pilota', await page.evaluate(() =>
    !!document.getElementById('scanPilot').offsetParent));
  sprawdz('pilot mowi, ze skaner PRACUJE (a nie ze to podglad)', await page.evaluate(() =>
    /pracuje|working/i.test(document.getElementById('scanPilotStan').textContent || '')),
    await page.evaluate(() => document.getElementById('scanPilotStan').textContent));
  sprawdz('jest przycisk zamykajacy okno nad pulpitem', await page.evaluate(() =>
    !!document.getElementById('scanPilotZamknij')
    && !!document.getElementById('scanPilotZamknij').offsetParent));
  sprawdz('zrzut gry i trening chowaja sie razem z ramka', await page.evaluate(() =>
    Array.prototype.every.call(document.querySelectorAll('.sk-tylko-symulacja'),
      function (n) { return !n.offsetParent; })));
  sprawdz('warstwy sceny i paska stanu zgaszone', await page.evaluate(() =>
    ['scanSceneLayer', 'scanTargetsLayer', 'scanHud'].every(function (id) {
      const n = document.getElementById(id);
      return !n || n.style.display === 'none';
    })));

  // REKOMPENSATA: miejsce po ramce idzie do pokretel, a te rozsypuja sie na kolumny.
  const po = await page.evaluate(() => ({
    prawa: Math.round(document.querySelector('.sk-prawa').getBoundingClientRect().width),
    uklad: getComputedStyle(document.getElementById('scanFields')).display,
    kolumny: getComputedStyle(document.getElementById('scanFields'))
      .gridTemplateColumns.split(' ').filter(Boolean).length
  }));
  sprawdz('kolumna pokretel ROSNIE po schowaniu ramki', po.prawa > przed.prawa + 100,
    { przed: przed.prawa, po: po.prawa });
  sprawdz('pokretla ida w siatke wielokolumnowa', po.uklad === 'grid' && po.kolumny >= 2, po);

  // SYGNAL / COFNIJ / STOP jada do OKNA NAD PULPITEM, nie do silnika w schowanej ramce.
  await page.evaluate(() => { window.__rfZapytania.length = 0; _scanDol(); _scanGora(); });
  await spij(300);
  sprawdz('SYGNAL jedzie trasa /scan/sygnal', await page.evaluate(() =>
    window.__rfZapytania.some(function (z) { return z.indexOf('POST /scan/sygnal') === 0; })),
    await page.evaluate(() => window.__rfZapytania.slice(0, 4)));
  sprawdz('silnik w karcie ZOSTAJE w spoczynku', await page.evaluate(() =>
    window.RFScanKarta.silnik.faza === 'spoczynek'), await page.evaluate(() =>
      window.RFScanKarta.silnik.faza));
  await page.evaluate(() => { window.__rfZapytania.length = 0; _scanStop(); });
  await spij(300);
  sprawdz('Stop tez jedzie do okna', await page.evaluate(() =>
    window.__rfZapytania.some(function (z) { return z.indexOf('POST /scan/sygnal') === 0; })));

  /* SAM PODGLĄD OBSZARU NIE SKANUJE — a odkąd przyciski jadą do okna nad pulpitem, w tym jednym
     stanie byłyby martwe. Muszą więc być ZGASZONE i powiedzieć, co zrobić zamiast tego. */
  await page.evaluate(() => {
    window.__rfOknoStan = { open: true, tryb: 'podglad', dev: 'd0' };
    _sktloStanOkna();
  });
  await spij(400);
  sprawdz('przy samym podgladzie pilot mowi o OBRYSIE, nie o pracy', await page.evaluate(() =>
    /obrys|outline/i.test(document.getElementById('scanPilotStan').textContent || '')),
    await page.evaluate(() => document.getElementById('scanPilotStan').textContent));
  sprawdz('SYGNAL / Cofnij / Stop sa zgaszone (podglad nie skanuje)', await page.evaluate(() =>
    ['scanSignal', 'scanUndo', 'scanStop'].every(function (id) {
      return document.getElementById(id).disabled === true;
    })));
  /* ⚠️ `data-rftip`, NIE `title`. Aplikacja ma wlasne dymki (rf-05): obserwator zabiera kazdy
     `title` i przepisuje go do `data-rftip`, wiec asercja na `title` widzi null i wyglada jak
     brak podpowiedzi. */
  sprawdz('…i mowia, czym je obudzic', await page.evaluate(() => {
    const b = document.getElementById('scanSignal');
    const t = b.getAttribute('data-rftip') || b.getAttribute('title') || '';
    return /Uruchom nad pulpitem|Run over the desktop/.test(t);
  }), await page.evaluate(() => {
    const b = document.getElementById('scanSignal');
    return [b.getAttribute('data-rftip'), b.getAttribute('title')];
  }));
  await page.evaluate(() => {
    window.__rfOknoStan = { open: true, tryb: 'skan', dev: 'd0' };
    _sktloStanOkna();
  });
  await spij(400);
  // Sprzatanie musi zdjac OBA atrybuty: podpowiedz zostawiona w `data-rftip` wisialaby nad
  // przyciskiem, ktory znowu dziala (i mowilaby, ze nie dziala).
  sprawdz('pracujacy skaner znowu wlacza przyciski i zdejmuje podpowiedz',
    await page.evaluate(() => ['scanSignal', 'scanUndo', 'scanStop'].every(function (id) {
      const b = document.getElementById(id);
      return b.disabled === false && !b.getAttribute('title') && !b.getAttribute('data-rftip');
    })), await page.evaluate(() => {
      const b = document.getElementById('scanSignal');
      return [b.disabled, b.getAttribute('title'), b.getAttribute('data-rftip')];
    }));

  // Zamkniete okno = powrot do symulacji, bez przeladowania karty.
  await page.evaluate(() => {
    window.__rfOknoStan = { open: false, tryb: '', dev: '' };
    _sktloStanOkna();
  });
  await spij(400);
  sprawdz('po zamknieciu okna wraca ramka podgladu', await page.evaluate(() =>
    !document.getElementById('scanCard').classList.contains('sk-na-pulpicie')
    && !!document.getElementById('scanStage').offsetParent
    && !document.getElementById('scanPilot').offsetParent));
  sprawdz('…i segment wraca na „W symulacji"', await page.evaluate(() =>
    document.querySelector('#scanGdzie [data-gdzie="karta"]').classList.contains('sk-seg-wybrany')));
  sprawdz('warstwy sceny wracaja', await page.evaluate(() => {
    const n = document.getElementById('scanSceneLayer');
    return !!n && n.style.display !== 'none';
  }));
  await page.evaluate(() => { if (window.__rfFetchOryg) window.fetch = window.__rfFetchOryg; });
}

/* EKRANY INTERFEJSU (16.09, rf-50n). Kazdy wgrany zrzut ma przypisane swoje skanery (np. jeden
   1 i 2, drugi 1, 3 i 4), zeby dalo sie obslugiwac kapslem kilka interfejsow.
   Sprawdzamy to, co z tego wynika na ekranie: wgrany zrzut zaklada EKRAN, chip przy skanerze
   przypisuje go do kilku ekranow naraz, a wybrany ekran daje podgladowi tlo i FILTRUJE obrysy. */
console.log('\n- ekrany interfejsu: jeden zrzut, kilka skanerow');
let drugiPlik = '';
{
  // ⚠️ Liczymy OD STANU ZASTANEGO: wczesniejsze bloki tego pliku zalozyly juz ekrany (ten
  // z wgranym zrzutem i ten z plikiem, ktorego tu nie ma). Test ma sprawdzac PRZYROST, a nie
  // zakladac, ze zaczyna od zera.
  const _przed = await (await page.request.get(ADRES + 'scan?dev=d0')).json();
  const przedSekcji = _przed.sekcje.length, przedEkranow = (_przed.zrzuty || []).length;
  drugiPlik = await page.evaluate(async () => {
    const pl = document.createElement('canvas');
    pl.width = 800; pl.height = 450;
    const c = pl.getContext('2d');
    c.fillStyle = '#2f4a1a'; c.fillRect(0, 0, 800, 450);
    c.fillStyle = '#fff'; c.fillRect(40, 40, 200, 60);
    const blob = await new Promise(r => pl.toBlob(r, 'image/png'));
    await scanSekcjaDodaj('Test ekranu');
    await new Promise(r => setTimeout(r, 600));
    _sktloZPliku(new File([blob], 'menu gry.png', { type: 'image/png' }));
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 100));
      const z = window.scanZrzutAktualny();
      if (z && /menu-gry/.test(z.plik)) break;
    }
    const z = window.scanZrzutAktualny();
    return z ? z.plik : '';
  });
  await spij(600);
  const cfg = await (await fetch(ADRES + 'scan?dev=d0')).json();
  sprawdz('nowy zrzut zaklada NOWY ekran, a nie podmienia poprzedniego',
    cfg.zrzuty.length === przedEkranow + 1 && cfg.zrzuty[cfg.zrzuty.length - 1].plik === drugiPlik,
    cfg.zrzuty.map(z => z.plik));
  sprawdz('nowy skaner powstal jako kopia, wiec zostal na ekranie pierwowzoru',
    cfg.sekcje.length === przedSekcji + 1 && cfg.zrzuty[0].sekcje.length >= 1,
    { sekcji: cfg.sekcje.length, ekran1: cfg.zrzuty[0].sekcje });
  /* SPIS PLANSZ MA O JEDNA PIGULKE WIECEJ NIZ `zrzuty` — pierwsza to PULPIT TESTOWY (20.09).
     Plansza zerowa nie stoi w konfiguracji (nie jest niczyim zdjeciem i nie da sie jej skasowac),
     a mimo to musi byc w spisie: to ona pokazuje rysowany pulpit z ikonami i wszystkie skanery
     naraz. Test pilnuje obu polowek tej umowy — liczby pigulek i tego, ze zerowa jest oznaczona. */
  sprawdz('pigulki plansz stoja pod podgladem, a pierwsza to pulpit testowy',
    await page.evaluate(() => {
      const p = Array.from(document.querySelectorAll('.sk-zrz-pill'));
      return p.length === (window.RFScanKarta.u.zrzuty || []).length + 1
        && p[0].classList.contains('sk-zrz-szablon')
        && p.some(x => x.querySelectorAll('.sk-zrz-kropki i').length > 0);
    }));
  const przypisane = await page.evaluate(async () => {
    const chipy = Array.from(document.querySelectorAll('.sk-zrz-chip'));
    const wolny = chipy.find(c => !c.classList.contains('on'));
    if (wolny) { wolny.click(); await new Promise(r => setTimeout(r, 700)); }
    const akt = window.RFScanKarta.u.sekcjaAktywna;
    return (window.RFScanKarta.u.zrzuty || []).filter(z => (z.sekcje || []).includes(akt)).length;
  });
  sprawdz('chip dopisuje edytowany skaner do kolejnego ekranu (ten sam skaner na kilku)',
    przypisane >= 2, przypisane);
  // Ekran z PRAWDZIWYM plikiem to ten ostatnio dolozony; ten z brakujacym plikiem slusznie
  // zostawia piaskownice, wiec do pytania „czy ekran daje tlo" sie nie nadaje.
  const widok = await page.evaluate(async (ost) => {
    const stan = [];
    for (const n of [ost, 0]) {
      await window.scanZrzutWybierz(n);
      await new Promise(r => setTimeout(r, 700));
      stan.push({ n, cieni: document.querySelectorAll('#scanSekcjeCienie .sk-cien').length,
                  maTlo: document.getElementById('scanStage').classList.contains('sk-ma-tlo') });
    }
    return stan;
  }, przedEkranow + 1);
  sprawdz('wybrany ekran daje ramce tlo', widok[0].maTlo === true, widok);
  sprawdz('…a „zaden ekran" wraca do piaskownicy', widok[1].maTlo === false, widok[1]);
  sprawdz('bez ekranu widac tyle samo obrysow albo wiecej niz na jednym ekranie',
    widok[1].cieni >= widok[0].cieni, widok);
  /* ROZDZIELCZOSC PLANSZY (20.09). Zrzut mierzy sie PRZED zmniejszeniem pliku do 1920 px, wiec
     plansza z obrazu 2560x1440 musi niesc 2560x1440, a nie rozmiar podkladki. Bez tego testu
     pomylka byla niewidoczna: obie liczby wygladaja sensownie. */
  const wym = await page.evaluate((wgrane) => (window.RFScanKarta.u.zrzuty || [])
    .filter(z => wgrane.includes(z.plik)).map(z => [z.plik, z.w, z.h]), [plik, drugiPlik]);
  sprawdz('plansza niesie rozdzielczosc ekranu, z ktorego pochodzi zrzut',
    wym.length >= 1 && wym.every(x => x[1] > 0 && x[2] > 0), wym);
  // ⚠️ Plansza „Obcy" (zrzut z cudzego zestawu, pliku tu nie ma) rozmiaru NIE ZNA i ma go nie
  // zmyslac — dlatego pytamy o pigulki tych plansz, ktore naprawde wgrano.
  sprawdz('pigulka pokazuje ta rozdzielczosc', await page.evaluate((wgrane) => {
    const z = window.RFScanKarta.u.zrzuty || [];
    return Array.from(document.querySelectorAll('.sk-zrz-pill')).slice(1)
      .filter((_, i) => wgrane.includes((z[i] || {}).plik))
      .every(x => /\d+×\d+/.test((x.querySelector('.sk-zrz-wym') || {}).textContent || ''));
  }, [plik, drugiPlik]));
  /* PULPIT TESTOWY PAMIETA SWOJ ROZMIAR. Domyslnie jest nim monitor („auto"), ale wpisany recznie
     ma przezyc zapis — zmiana uzytkownika ma zostac zapamietana. */
  const szablon = await page.evaluate(async () => {
    await window.scanZrzutWymiar(0, 1280, 720);
    await new Promise(r => setTimeout(r, 400));
    await scanLoad('d0');
    await new Promise(r => setTimeout(r, 300));
    const po = [window.RFScanKarta.u.szablonW, window.RFScanKarta.u.szablonH];
    await window.scanZrzutWymiar(0, 0, 0);          // z powrotem „jak mój ekran"
    await new Promise(r => setTimeout(r, 300));
    return { po: po, auto: window.scanPlanszaRozmiar(0).auto };
  });
  sprawdz('rozmiar pulpitu testowego przezywa zapis, a zero wraca do „jak mój ekran"',
    szablon.po[0] === 1280 && szablon.po[1] === 720 && szablon.auto === true, szablon);
  /* „ZDEJMIJ" ZOSTAWIA GRUPE, a nie kasuje pozycji (20.09). Nazwa i przypisane skanery zostaja —
     inaczej pomylka przy wgrywaniu kosztowalaby cale przypisanie. */
  const poZdejmij = await page.evaluate(async () => {
    const ile = (window.RFScanKarta.u.zrzuty || []).length;
    await window.scanZrzutWybierz(ile);
    await new Promise(r => setTimeout(r, 400));
    const przed = window.RFScanKarta.u.zrzuty[ile - 1];
    const sek = (przed.sekcje || []).length, nazwa = przed.nazwa;
    document.getElementById('scanTloUsun').click();
    await new Promise(r => setTimeout(r, 700));
    const po = window.RFScanKarta.u.zrzuty[ile - 1];
    return { ile: (window.RFScanKarta.u.zrzuty || []).length === ile, plik: po.plik,
             nazwa: po.nazwa === nazwa, sekcje: (po.sekcje || []).length === sek,
             zgaszony: document.getElementById('scanTloUsun').disabled };
  });
  sprawdz('„Zdejmij" zdejmuje sam obraz: zostaje grupa z ta sama nazwa i skanerami',
    poZdejmij.ile && poZdejmij.plik === '' && poZdejmij.nazwa && poZdejmij.sekcje
    && poZdejmij.zgaszony === true, poZdejmij);
  await page.evaluate(async () => {
    for (let i = ((window.RFScanKarta.u.zrzuty) || []).length; i > 0; i--) {
      await fetch('/scan/zrzut?dev=d0', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ act: 'usun', n: i })
      });
    }
    const c = window.RFScanKarta.u;
    if (c.sekcje.length > 1) await scanSekcjaUsun(c.sekcje.length);
    await scanLoad('d0');
  });
  await spij(500);
  sprawdz('po sprzataniu nie ma ani ekranow, ani zrzutu pod podgladem', await page.evaluate(() =>
    (window.RFScanKarta.u.zrzuty || []).length === 0
    && !document.getElementById('scanStage').classList.contains('sk-ma-tlo')));
}

console.log('\n- konsola');
sprawdz('zero bledow w konsoli', bledy.length === 0, bledy.slice(0, 4));

// Sprzątanie: zrzut wgrany przez test znika z katalogu aplikacji.
for (const p of [plik, drugiPlik]) {
  if (p) { try { fs.unlinkSync(path.join(KORZEN, 'Settings', 'ScanTla', p)); } catch (e) { } }
}
await przegladarka.close();
console.log('\n' + ok + ' passed, ' + zle + ' failed');
process.exit(zle ? 1 : 0);
