/* SKANER — OBSZAR USTAWIANY MYSZĄ NA PULPICIE (`?edycja=1`, rf-50m).
   Uruchomienie: instancja testowa aplikacji na 8790 (koniecznie z `--no-keys`), potem

     node tests/scan_edytor_harness.mjs

   ⚠️ TESTUJEMY STRONĘ, NIE OKNO. Prawdziwa nakładka w tym trybie zbiera WSZYSTKIE kliknięcia
   z ekranu (serwer nie zakłada jej `WS_EX_TRANSPARENT` — patrz `ScanOverlay.open`), więc
   otwarcie jej z testu odebrałoby mysz człowiekowi przy klawiaturze. Adres z `?edycja=1`
   w zwykłej karcie przeglądarki uruchamia dokładnie ten sam kod strony.

   ⚠️ TEN TEST PISZE DO KONFIGURACJI SKANERA kapsla d0 (obszar i spis sekcji) i sprząta po sobie
   na końcu — tak samo jak `scan_tlo_harness`. */
import { createRequire } from 'module';
import path from 'path';
const wymagaj = createRequire(import.meta.url);
const { rfBezPierwszegoStartu } = wymagaj("./_rf_pierwszy_start.cjs");   // bez pytania i zaproszenia pierwszego startu
const { chromium } = wymagaj(path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@playwright/test'));

const BAZA = process.env.RF_URL || 'http://127.0.0.1:8790/';
const ADRES = BAZA + 'skaner-nakladka?dev=d0&mark=TEST-EDYCJA&edycja=1';
let ok = 0, zle = 0;
const bledy = [];
const spij = (ms) => new Promise(r => setTimeout(r, ms));
function sprawdz(nazwa, warunek, dodatek) {
  if (warunek) { ok++; console.log('  OK   ' + nazwa); }
  else { zle++; console.log('  ZLE  ' + nazwa + (dodatek !== undefined ? '  -> ' + JSON.stringify(dodatek) : '')); }
}

/* ⚠️ OKNO TESTOWE MA ROZMIAR PULPITU, i to nie jest kosmetyka. Nakładka rysuje w skali 1:1
   z ekranem (`pelne()` w rf-50h to prostokąt PULPITU, nie widoku), więc w mniejszym oknie uchwyty
   prawej krawędzi wypadają POZA widokiem i mysz Playwrighta nie ma w co trafić. */
const ekr = await (await fetch(BAZA + 'screens?dev=d0')).json();
const widok = { width: (ekr && ekr.desktop && ekr.desktop.w) || 1280,
                height: (ekr && ekr.desktop && ekr.desktop.h) || 800 };
const przegladarka = await chromium.launch();
const page = await (await rfBezPierwszegoStartu(przegladarka.newContext({ viewport: widok }))).newPage();
page.on('console', m => { if (m.type() === 'error') bledy.push(m.text()); });
page.on('pageerror', e => bledy.push('pageerror: ' + e.message));

/* ⚠️ ZAPISY IDĄ PRZEZ STRONĘ, nie przez `fetch` Node'a. Serwer odrzuca POST bez nagłówka
   `X-RibbitFlip-Token` (anty-CSRF), a token zna tylko strona — rf-50h dokłada go do każdego
   zapisu sam. Node'owy POST wraca 403 i wygląda jak „zapis nic nie zmienił". */
const post = (sciezka, dane) => page.evaluate(([s, d]) => fetch(s, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d)
}).then(r => r.json()), [sciezka, dane]);

// Stan sprzed testu — wraca na koniec.
const przed = await (await fetch(BAZA + 'scan?dev=d0')).json();

await page.goto(ADRES, { waitUntil: 'domcontentloaded' });
await spij(1400);

console.log('- edytor wstaje tylko w swoim trybie');
sprawdz('strona wie, ze to edycja', await page.evaluate(() =>
  document.body.classList.contains('rf-edycja') && !!document.getElementById('edytor')));
sprawdz('edycja JEST podgladem (nic nie klika, sygnaly ignorowane)', await page.evaluate(() =>
  document.body.classList.contains('rf-podglad')));
sprawdz('pasek podgladu schodzi z drogi, pasek edycji stoi', await page.evaluate(() =>
  getComputedStyle(document.getElementById('podglad')).display === 'none'
  && getComputedStyle(document.getElementById('edPasek')).display !== 'none'));
sprawdz('kursor jest widoczny (skaner prowadzi sie sygnalem, obszar - mysza)', await page.evaluate(() =>
  getComputedStyle(document.body).cursor !== 'none'));
{
  // ⚠️ Warstwa edytora NIE MOŻE mieć tła: Windows wycina z tego okna piksele koloru klucza,
  // a tło na całą warstwę zasłoniłoby pulpit, po którym człowiek przykłada ramkę.
  const tla = await page.evaluate(() => {
    const t = (el) => getComputedStyle(el).backgroundColor;
    return [t(document.getElementById('edytor')), t(document.getElementById('edRamka'))];
  });
  sprawdz('warstwa i ramka bez tla', tla.every(t => t === 'rgba(0, 0, 0, 0)' || t === 'transparent'), tla);
}

console.log('\n- ramka bierze sie z konfiguracji');
await post('/scan?dev=d0', Object.assign({}, przed, {
  obszar: 'wlasny', obszarJednostka: 'procent', obszarX1: 20, obszarY1: 30, obszarX2: 60, obszarY2: 80
}));
await spij(1400);       // zmiana idzie strumieniem (`scan_cfg`), strona sama sie o nia pyta
{
  const r = await page.evaluate(() => {
    const p = window.RFScanEdycja.prostokat(), c = window.RFScanNakladka.pelne();
    return { x: p.x / c.w, y: p.y / c.h, w: p.w / c.w, h: p.h / c.h };
  });
  sprawdz('ramka stoi tam, gdzie mowia liczby (20-60% x 30-80%)',
    Math.abs(r.x - 0.2) < 0.01 && Math.abs(r.y - 0.3) < 0.01
    && Math.abs(r.w - 0.4) < 0.01 && Math.abs(r.h - 0.5) < 0.01, r);
}

console.log('\n- przeciagniecie ramki zapisuje sie SAMO');
{
  // Ciagniemy za srodek ramki. Wspolrzedne strony = wspolrzedne pulpitu (okno pokrywa ekran),
  // wiec przesuniecie o 10% szerokosci ma dac +10 punktow procentowych w konfiguracji.
  const przedR = await page.evaluate(() => window.RFScanEdycja.prostokat());
  const c = await page.evaluate(() => window.RFScanNakladka.pelne());
  const sx = przedR.x + przedR.w / 2, sy = przedR.y + przedR.h / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + c.w * 0.1, sy, { steps: 6 });
  await page.mouse.up();
  await spij(1200);
  const cfg = await (await fetch(BAZA + 'scan?dev=d0')).json();
  sprawdz('nowe liczby sa na serwerze (30-70%)',
    Math.abs(cfg.obszarX1 - 30) < 1.5 && Math.abs(cfg.obszarX2 - 70) < 1.5
    && Math.abs(cfg.obszarY1 - 30) < 1.5 && Math.abs(cfg.obszarY2 - 80) < 1.5,
    [cfg.obszarX1, cfg.obszarY1, cfg.obszarX2, cfg.obszarY2]);
  sprawdz('pasek powiedzial, ze zapisal', /zapisa/.test(await page.evaluate(() =>
    document.getElementById('edStan').textContent)), await page.evaluate(() =>
      document.getElementById('edStan').textContent));
  /* ⚠️ NAJWAŻNIEJSZA ASERCJA W TYM PLIKU. Strona nakładki trzyma konfiguracje CELOWO PODMIENIONĄ
     pod siebie (`dociaganie: 0`, „elementy" zamienione na „pasy" — nad pulpitem nie znamy
     przycisków Windowsa), a `/scan` NADPISUJE sekcję tym, co dostanie. Gdyby edytor odesłał tamtą
     kopię zamiast świeżej z serwera, pierwsze przeciągnięcie ramki kasowałoby człowiekowi
     dociąganie i tryb skanera — po cichu. */
  sprawdz('zapis NIE skasowal innych pokretel sekcji',
    cfg.dociaganie === przed.dociaganie && cfg.tryb === przed.tryb
    && cfg.predkosc === przed.predkosc,
    { dociaganie: [przed.dociaganie, cfg.dociaganie], tryb: [przed.tryb, cfg.tryb] });
}

console.log('\n- uchwyt zmienia rozmiar, nie polozenie');
{
  const r0 = await page.evaluate(() => window.RFScanEdycja.prostokat());
  const box = await page.evaluate(() => {
    const b = document.querySelector('.sk-ed-u-se').getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 40, { steps: 5 });
  await page.mouse.up();
  await spij(1000);
  const r1 = await page.evaluate(() => window.RFScanEdycja.prostokat());
  sprawdz('narozniki zostaly na miejscu, urosl bok',
    Math.abs(r1.x - r0.x) < 2 && Math.abs(r1.y - r0.y) < 2
    && r1.w > r0.w + 60 && r1.h > r0.h + 25, { r0, r1 });
}

console.log('\n- sekcje: dodaj i nazwij bez wracania do karty');
{
  const ile0 = (await (await fetch(BAZA + 'scan?dev=d0')).json()).sekcje.length;
  await page.click('#edDodaj');
  await spij(1200);
  const cfg = await (await fetch(BAZA + 'scan?dev=d0')).json();
  sprawdz('doszla sekcja i od razu jest ta ustawiana',
    cfg.sekcje.length === ile0 + 1 && cfg.sekcjaAktywna === cfg.sekcje.length,
    { ile0, teraz: cfg.sekcje.length, akt: cfg.sekcjaAktywna });
  sprawdz('pole nazwy czeka z kursorem',
    await page.evaluate(() => document.activeElement && document.activeElement.id === 'edNazwa'));
  await page.fill('#edNazwa', 'Panel opcji');
  await page.evaluate(() => document.getElementById('edNazwa').dispatchEvent(new Event('change')));
  await spij(1200);
  const cfg2 = await (await fetch(BAZA + 'scan?dev=d0')).json();
  sprawdz('nazwa doszla na serwer',
    cfg2.sekcje[cfg2.sekcjaAktywna - 1].nazwa === 'Panel opcji',
    cfg2.sekcje.map(s => s.nazwa));
  sprawdz('lista w pasku zna nowa nazwe', (await page.evaluate(() =>
    document.getElementById('edSekcja').textContent)).indexOf('Panel opcji') >= 0);
}

/* WIDAC WSZYSTKIE SKANERY ALBO TYLKO USTAWIANY . W trybie „na
   pulpicie” mozna zobaczyc wszystkie albo wybrac konkretny, oznaczone kolorami i opisane. Ustawiany obszar ma pelna ramke z uchwytami, reszta idzie
   cienka kreska w kolorze swojej pigulki z karty i z wlasnym podpisem. */
/* ⚠️ NAJPIERW ZDEJMUJEMY GRUPĘ. Od 16.09 wybrany ekran (albo grupa) ZAWĘŻA obrysy do swoich
   skanerów — ten blok mówi o samych skanerach, więc zaczyna od „bez grupy": inaczej jego wynik
   zależałby od tego, co zostało po poprzednim klikaniu. */
await post('/scan/zrzut?dev=d0', { act: 'wybierz', n: 0 });
await page.evaluate(() => window.RFScanEdycja.poZmianie());
await spij(600);
console.log('\n- pozostale skanery na pulpicie');
{
  const teraz = await (await fetch(BAZA + 'scan?dev=d0')).json();
  const ile = teraz.sekcje.length, akt = teraz.sekcjaAktywna;
  const c = await page.evaluate(() => {
    const d = document.querySelector('.sk-ed-cien');
    const hex = (h) => { const n = parseInt(String(h).replace('#', ''), 16);
      return 'rgb(' + (n >> 16 & 255) + ', ' + (n >> 8 & 255) + ', ' + (n & 255) + ')'; };
    const cfgAkt = +document.getElementById('edSekcja').value || 1;
    return { ile: document.querySelectorAll('.sk-ed-cien').length,
             lbl: d ? d.textContent : null,
             kolor: d ? d.style.getPropertyValue('--sek') : null,
             tlo: d ? getComputedStyle(d).backgroundColor : null,
             wybor: document.getElementById('edPodglad').value,
             ramka: getComputedStyle(document.getElementById('edRamka')).borderColor,
             ramkaMaByc: hex(RFScan.kolorSekcji(cfgAkt)),
             cienMaByc: d ? RFScan.kolorSekcji(parseInt(d.textContent, 10)) : null };
  });
  sprawdz('obszary pozostalych skanerow stoja na ekranie i sa podpisane',
    c.ile === ile - 1 && /^\d+ · /.test(c.lbl || ''), { ile: c.ile, oczekiwane: ile - 1, lbl: c.lbl });
  sprawdz('…kazdy w kolorze swojej pigulki z karty', c.kolor === c.cienMaByc, [c.kolor, c.cienMaByc]);
  // ⚠️ Nad pulpitem NIE WOLNO wypelniac: Windows wycina z tego okna jeden kolor, wiec
  // polprzezroczysta plama zostaje na ekranie brudna szyba.
  sprawdz('cien jest sama kreska, bez wypelnienia',
    c.tlo === 'rgba(0, 0, 0, 0)' || c.tlo === 'transparent', c.tlo);
  sprawdz('ustawiana ramka ma kolor SWOJEGO skanera', c.ramka === c.ramkaMaByc,
    { jest: c.ramka, maByc: c.ramkaMaByc, akt: akt });
  await page.selectOption('#edPodglad', 'ten');
  await spij(300);
  sprawdz('„Tylko ustawiany" gasi pozostale', await page.evaluate(() =>
    document.querySelectorAll('.sk-ed-cien').length === 0));
  await page.selectOption('#edPodglad', 'wszystkie');
  await spij(300);
  sprawdz('…i wracaja ta sama lista', await page.evaluate((n) =>
    document.querySelectorAll('.sk-ed-cien').length === n, ile - 1));
  // Ustawiac mozna JEDEN skaner naraz, wiec zeby ruszyc inny, trzeba sie na niego przelaczyc —
  // podpis cudzej ramki jest na to najkrotsza droga (zgloszenie: „nie przeciaga tego, ktore chce").
  {
    /* ⚠️ KLIKAMY Z JS, nie myszą: podpis cudzej ramki bywa ZASŁONIĘTY przez ramkę ustawianą (ta
       rysuje się nad warstwą cieni), a wtedy Playwright słusznie odmawia kliknięcia. Sprawdzamy
       tu zachowanie, a nie to, czy akurat w tym układzie prostokątów podpis jest odsłonięty —
       gdy jest zasłonięty, drogą do przełączenia zostaje lista w pasku. */
    const nr = await page.evaluate(() => {
      const l = document.querySelector('.sk-ed-cien-lbl');
      const n = parseInt(l.textContent, 10);
      l.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return n;
    });
    await spij(800);
    const po = await (await fetch(BAZA + 'scan?dev=d0')).json();
    sprawdz('klikniecie podpisu cudzej ramki przelacza na ten skaner', po.sekcjaAktywna === nr,
      { klikniety: nr, aktywny: po.sekcjaAktywna });
    await post('/scan/sekcja?dev=d0', { act: 'wybierz', n: akt });   // wracamy do stanu bloku
    await spij(500);
  }
}

/* CALA RAMKA CIAGNIE, RAZEM Z PODPISEM WYMIARU . Blad: proba przeciagniecia
   ramki zaczynala rysowac nowa. Chip z wymiarem lezy nad
   gorna krawedzia ramki, ma kursor ✥ i jest jej dzieckiem — a przeciaganie lapalo wylacznie sam
   prostokat, wiec klikniecie w chip zaczynalo rysowanie NOWEJ ramki. */
console.log('\n- ciagniecie za podpis wymiaru przesuwa ramke, a nie rysuje nowej');
{
  const przed = await page.evaluate(() => window.RFScanEdycja.prostokat());
  const chip = await page.evaluate(() => {
    const r = document.getElementById('edWymiar').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width) };
  });
  await page.mouse.move(chip.x, chip.y);
  await page.mouse.down();
  await page.mouse.move(chip.x + 60, chip.y + 40, { steps: 6 });
  await page.mouse.up();
  await spij(900);
  const po = await page.evaluate(() => window.RFScanEdycja.prostokat());
  sprawdz('ramka PRZESUNELA sie o tyle, ile poszla mysz',
    Math.abs((po.x - przed.x) - 60) < 6 && Math.abs((po.y - przed.y) - 40) < 6
    && Math.abs(po.w - przed.w) < 2 && Math.abs(po.h - przed.h) < 2, { przed, po, chip });
}

/* PASEK STOI NA DOLE EKRANU GLOWNEGO . Przy ustawianiu na wielu
   ekranach menu stoi na dole ekranu glownego. Okno rozciaga sie na CALY pulpit, wiec
   arkuszowe `left:50%` celowalo w styk miedzy monitorami.
   ⚠️ UKLAD MONITOROW PODSTAWIAMY, zamiast polegac na tym, co ma maszyna: test ma wyjsc tak samo
   na jednym ekranie, jak na trzech. */
console.log('\n- pasek na dole ekranu glownego (dwa monitory)');
{
  const wynik = await page.evaluate(async () => {
    // ⚠️ `widok` TEŻ: od 23.09 edytor liczy pasek w widoku okna (rf-50m `cel()` pyta najpierw
    // `widok()`, dopiero potem `pelne()`), a prawdziwy widok to okno tej przeglądarki — czyli
    // rozmiar pulpitu maszyny, na której leci test. Bez podmiany wynik zależał od jej monitorów.
    const pierwotne = { ekrany: RFScanNakladka.ekrany, pelne: RFScanNakladka.pelne, widok: RFScanNakladka.widok };
    const fake = { desktop: { x: -1920, y: 0, w: 3627, h: 1594 },
      screens: [{ name: 'L', x: -1920, y: 514, w: 1920, h: 1080, primary: false },
                { name: 'G', x: 0, y: 0, w: 1707, h: 1067, primary: true }] };
    RFScanNakladka.ekrany = () => fake;
    RFScanNakladka.pelne = () => ({ x: 0, y: 0, w: fake.desktop.w, h: fake.desktop.h });
    RFScanNakladka.widok = RFScanNakladka.pelne;
    window.RFScanEdycja.poZmianie();
    await new Promise(r => setTimeout(r, 900));
    const p = document.getElementById('edPasek');
    const out = { left: parseFloat(p.style.left), bottom: parseFloat(p.style.bottom),
                  // srodek ekranu glownego w widoku i jego dolna krawedz liczona od dolu pulpitu
                  oczekLeft: 1920 + 1707 / 2, oczekBottom: 1594 - 1067 + 18 };
    RFScanNakladka.ekrany = pierwotne.ekrany;
    RFScanNakladka.pelne = pierwotne.pelne;
    RFScanNakladka.widok = pierwotne.widok;
    window.RFScanEdycja.poZmianie();
    await new Promise(r => setTimeout(r, 600));
    return out;
  });
  sprawdz('pasek celuje w srodek dolnej krawedzi ekranu GLOWNEGO, nie pulpitu',
    Math.abs(wynik.left - wynik.oczekLeft) < 2 && Math.abs(wynik.bottom - wynik.oczekBottom) < 2, wynik);
}

/* OCZKO „UKRYJ" . Ramka na dole jest caly czas
   wlaczona; oczko „ukryj” chowa ja, ale samo zostaje widoczne, zeby dalo sie ja
   znow pokazac. Edytor stoi teraz przez CALY czas, gdy skaner jest na pulpicie — a okno
   w tym trybie zbiera wszystkie klikniecia z ekranu. Oczko jest jedynym wyjsciem z tego bez
   zamykania okna, wiec test pyta o dwie rzeczy naraz: co widac i co dostal serwer.
   ⚠️ Prostokat sprawdzamy na SERWERZE (`/scan/okno` → `klik`), a nie w JS strony: to on
   decyduje, gdzie okno bierze mysz, i to on moze go odrzucic. */
console.log('\n- oczko „ukryj": obrys zostaje, klikniecia wracaja do pulpitu');
{
  const oko = await page.$('#edOko');
  sprawdz('oczko stoi w pasku', !!oko);
  await page.click('#edOko');
  await spij(350);
  const po = await page.evaluate(() => {
    const widac = (sel) => { const n = document.querySelector(sel);
      return !!n && getComputedStyle(n).display !== 'none' && n.getBoundingClientRect().width > 0; };
    return { ukryty: document.body.classList.contains('sk-ed-ukryty'),
             oko: widac('#edOko'), ramka: widac('#edRamka'),
             uchwyt: widac('.sk-ed-uchwyt'), gotowe: widac('#edGotowe'),
             wymiar: widac('.sk-ed-wymiar'),
             zgloszony: (window.RFScanEdycja || {}).okoProstokat
               ? window.RFScanEdycja.okoProstokat() : null };
  });
  sprawdz('po schowaniu zostaje oczko…', po.ukryty && po.oko, po);
  sprawdz('…i obrys obszaru (po to sie tu przyszlo)', po.ramka, po);
  sprawdz('…a uchwyty, wymiar i reszta paska znikaja', !po.uchwyt && !po.gotowe && !po.wymiar, po);
  const stan = await (await fetch(BAZA + 'scan/okno')).json();
  sprawdz('serwer dostal prostokat oczka', Array.isArray(stan.klik) && stan.klik[2] > 0 && stan.klik[3] > 0,
    { klik: stan.klik, zgloszony: po.zgloszony });
  // Prostokat ma OTACZAC to, co widac — inaczej „oczko nie dziala" przy zerowej liczbie bledow.
  sprawdz('…i prostokat obejmuje miejsce, w ktorym oczko naprawde stoi', await page.evaluate((k) => {
    const r = document.getElementById('edPasek').getBoundingClientRect();
    return !!k && k[0] <= r.left && k[1] <= r.top && k[0] + k[2] >= r.right && k[1] + k[3] >= r.bottom;
  }, stan.klik), stan.klik);
  // Chybienie oczka o piksel ma trafic w pulpit, a nie narysowac nowej ramki.
  const przedRamka = await page.evaluate(() => window.RFScanEdycja.prostokat());
  await page.mouse.move(40, 40); await page.mouse.down(); await page.mouse.move(180, 160);
  await page.mouse.up(); await spij(250);
  const poRamka = await page.evaluate(() => window.RFScanEdycja.prostokat());
  sprawdz('ciagniecie po ekranie NIE rysuje ramki, gdy edytor jest schowany',
    JSON.stringify(przedRamka) === JSON.stringify(poRamka), { przedRamka, poRamka });

  await page.click('#edOko');
  await spij(350);
  const wroc = await page.evaluate(() => ({
    ukryty: document.body.classList.contains('sk-ed-ukryty'),
    uchwyt: document.querySelector('.sk-ed-uchwyt').getBoundingClientRect().width > 0
  }));
  sprawdz('tym samym oczkiem wraca sie do ustawiania', !wroc.ukryty && wroc.uchwyt, wroc);
  const stan2 = await (await fetch(BAZA + 'scan/okno')).json();
  sprawdz('…a serwer znow oddaje mysz calemu oknu', stan2.klik === null, stan2.klik);
}

/* CUDZA RAMKA CIAGNIE SIE OD RAZU : cudzy obrys tez
   przesuwa sie przeciaganiem. Ustawiac mozna JEDEN skaner naraz, wiec chwycenie cudzego obrysu robi
   dwie rzeczy w jednym gescie: przelacza na tamten skaner i zaczyna go ciagnac.
   ⚠️ NAJWAZNIEJSZE W TYM TESCIE: zapis ma trafic w skaner CHWYCONY, a nie w ten, ktory byl aktywny
   przed gestem - przelaczenie jest rozmowa z serwerem i konczy sie w trakcie ruchu mysza. */
console.log('\n- cudza ramka: chwycenie przelacza i od razu ciagnie');
{
  const przygotuj = async (n, o) => {
    await post('/scan/sekcja?dev=d0', { act: 'wybierz', n: n });
    const cfg = await (await fetch(BAZA + 'scan?dev=d0')).json();
    await post('/scan?dev=d0', Object.assign({}, cfg, { obszar: 'wlasny', obszarJednostka: 'procent' }, o));
    await spij(250);
  };
  const ile = (await (await fetch(BAZA + 'scan?dev=d0')).json()).sekcje.length;
  if (ile < 2) {
    console.log('  POMINIETE: do tego testu potrzebne sa dwa skanery');
  } else {
    await przygotuj(1, { obszarX1: 5, obszarX2: 35, obszarY1: 8, obszarY2: 38 });
    await przygotuj(2, { obszarX1: 60, obszarX2: 92, obszarY1: 55, obszarY2: 88 });
    await page.evaluate(() => window.RFScanEdycja.poZmianie());
    await spij(900);
    const cel = await page.evaluate(() => {
      const d = Array.from(document.querySelectorAll('.sk-ed-cien'))
        .find(x => /^1 · /.test(x.textContent));
      if (!d) return null;
      const r = d.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    sprawdz('obrys skanera 1 stoi na ekranie jako cudza ramka', !!cel, cel);
    if (cel) {
      await page.mouse.move(cel.x, cel.y);
      await page.mouse.down();
      await page.mouse.move(cel.x + 120, cel.y + 90, { steps: 6 });
      await page.mouse.up();
      await spij(1400);
      const cfg = await (await fetch(BAZA + 'scan?dev=d0')).json();
      sprawdz('chwycenie cudzej ramki przelaczylo na TAMTEN skaner', cfg.sekcjaAktywna === 1,
        cfg.sekcjaAktywna);
      sprawdz('...i to JEGO obszar sie przesunal (a nie tego, ktory byl aktywny)',
        cfg.sekcje[0].obszarX1 > 5.5 && cfg.sekcje[0].obszarY1 > 8.5
        && Math.abs(cfg.sekcje[1].obszarX1 - 60) < 0.6,
        { skaner1: [cfg.sekcje[0].obszarX1, cfg.sekcje[0].obszarY1],
          skaner2: [cfg.sekcje[1].obszarX1, cfg.sekcje[1].obszarY1] });
    }
  }
}

/* EKRANY I GRUPY W PASKU NAD PULPITEM (16.09). Zgloszenie: „przy screenach daj dropdown wybierania,
   ktora wybrana grafika ma sie wyswietlac" - nad pulpitem zadna grafika sie nie wyswietla, wiec
   wybor ekranu znaczy tu: ktore obrysy widac. */
console.log('\n- lista ekranow i grup nad pulpitem');
{
  const gr = await post('/scan/zrzut?dev=d0', { act: 'dodaj', nazwa: 'Test grupa' });
  if (!gr || !gr.ok) {
    console.log('  POMINIETE: nie udalo sie zalozyc grupy');
  } else {
    const nGr = gr.zrzuty.length;
    await post('/scan/zrzut?dev=d0', { act: 'przypisz', n: nGr, sekcja: 1, wlacz: true });
    await page.evaluate(() => window.RFScanEdycja.poZmianie());
    await spij(900);
    const lista = await page.evaluate(() => {
      const z = document.getElementById('edZrzut');
      return { opcje: Array.from(z.options).map(o => o.textContent), wybrane: z.value,
               widoczna: !!z.offsetParent };
    });
    sprawdz('lista ekranow stoi w pasku i zaczyna sie od „bez grupy"',
      lista.widoczna && /bez grupy/.test(lista.opcje[0]), lista);
    sprawdz('grupa bez zrzutu ma inny znak niz ekran ze zrzutem',
      lista.opcje.some(o => /▦/.test(o)), lista.opcje);
    const cieni = await page.evaluate(() => document.querySelectorAll('.sk-ed-cien').length);
    sprawdz('wybrana grupa ZAWEZA obrysy do swoich skanerow', cieni <= 1, cieni);
    await post('/scan/zrzut?dev=d0', { act: 'usun', n: nGr });
    await spij(300);
  }
}

console.log('\n- sprzatanie');
{
  // Usuwamy dolozona sekcje i wracamy do konfiguracji sprzed testu.
  const cfg = await (await fetch(BAZA + 'scan?dev=d0')).json();
  if (cfg.sekcje.length > przed.sekcje.length) {
    await post('/scan/sekcja?dev=d0', { act: 'usun', n: cfg.sekcje.length });
  }
  await post('/scan?dev=d0', przed);
  const po = await (await fetch(BAZA + 'scan?dev=d0')).json();
  sprawdz('konfiguracja wrocila do stanu sprzed testu',
    po.obszar === przed.obszar && po.obszarX1 === przed.obszarX1
    && po.sekcje.length === przed.sekcje.length,
    { obszar: [przed.obszar, po.obszar], sekcji: [przed.sekcje.length, po.sekcje.length] });
}

console.log('\n- konsola');
sprawdz('zero bledow w konsoli', bledy.length === 0, bledy.slice(0, 6));

await przegladarka.close();
console.log('\n%d passed, %d failed', ok, zle);
process.exit(zle ? 1 : 0);
