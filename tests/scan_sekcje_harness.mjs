/* SKANER — PIGUŁKI SEKCJI I POZOSTAŁE SKANERY W PODGLĄDZIE (rf-50k).
   Uruchomienie: instancja testowa aplikacji na 8790 (koniecznie z `--no-keys`), potem

     node tests/scan_sekcje_harness.mjs

   SKĄD TO SIĘ WZIĘŁO: podgląd ma pokazywać edytowany skaner, ale też pozostałe (albo
   tylko edytowany, do wyboru), a zamiast listy rozwijalnej utworzone skanery mają swoje
   pigułki i kolory.

   Co jest sprawdzane i dlaczego akurat to:
     • KOLOR IDZIE Z POZYCJI — pigułka nr 2 i prostokąt sekcji nr 2 muszą mieć tę samą barwę,
       bo cała funkcja polega na tym, że da się je ze sobą związać wzrokiem,
     • PROSTOKĄTY POZOSTAŁYCH LEŻĄ TAM, GDZIE MÓWIĄ LICZBY — sprawdzamy je względem ramki
       podglądu, a nie „czy w ogóle coś narysowano",
     • OKO NAPRAWDĘ GASI i zapamiętuje wybór (to jest ta druga połowa zgłoszenia: „albo mieć
       możliwość widzenia tylko aktualnie edytowanego"),
     • SEKCJA EDYTOWANA NIE JEST RYSOWANA DWA RAZY — jej obszar rysuje scena, więc wśród cieni
       ma jej nie być; inaczej ten sam prostokąt miałby dwa obrysy w dwóch grubościach.

   ⚠️ TEN TEST PISZE DO KONFIGURACJI SKANERA kapsla d0 (obszar i spis sekcji) i sprząta po sobie
   na końcu — tak samo jak `scan_tlo_harness` i `scan_edytor_harness`. */
import { createRequire } from 'module';
import path from 'path';
const wymagaj = createRequire(import.meta.url);
const { rfBezPierwszegoStartu } = wymagaj("./_rf_pierwszy_start.cjs");   // bez pytania i zaproszenia pierwszego startu
const { chromium } = wymagaj(path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@playwright/test'));

const BAZA = process.env.RF_URL || 'http://127.0.0.1:8790/';
let ok = 0, zle = 0;
const bledy = [];
const spij = (ms) => new Promise(r => setTimeout(r, ms));
function sprawdz(nazwa, warunek, dodatek) {
  if (warunek) { ok++; console.log('  OK   ' + nazwa); }
  else { zle++; console.log('  ZLE  ' + nazwa + (dodatek !== undefined ? '  -> ' + JSON.stringify(dodatek) : '')); }
}

const przegladarka = await chromium.launch();
const page = await (await rfBezPierwszegoStartu(przegladarka.newContext({ viewport: { width: 1680, height: 1000 } }))).newPage();
page.on('console', m => { if (m.type() === 'error') bledy.push(m.text()); });
page.on('pageerror', e => bledy.push('pageerror: ' + e.message));

/* ⚠️ ZAPISY IDĄ PRZEZ STRONĘ, nie przez `fetch` Node'a: serwer odrzuca POST bez nagłówka
   `X-RibbitFlip-Token`, a token zna tylko strona. */
const post = (sciezka, dane) => page.evaluate(([s, d]) => fetch(s, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d)
}).then(r => r.json()), [sciezka, dane]);

const przed = await (await fetch(BAZA + 'scan?dev=d0')).json();
/* ⚠️ SKANERÓW ZASTANYCH NIE RUSZAMY — ani nie kasujemy, ani nie zmieniamy im nazw. `POST /scan`
   celowo IGNORUJE spis sekcji (patrz nota przy `_sekcje_out` w serwerze), więc czego test by tu
   nie skasował, tego sprzątanie nie odtworzy. Dokładamy własne TRZY na koniec spisu i liczymy
   wszystko od `baza` — dzięki temu test wychodzi tak samo przy jednym zastanym skanerze, jak
   przy pięciu. */
const baza = przed.sekcje.length;
if (baza + 3 > 8) {
  console.log('POMINIETE: w konfiguracji d0 jest juz %d skanerow, a sufit to 8.', baza);
  await przegladarka.close();
  process.exit(0);
}

await page.goto(BAZA, { waitUntil: 'domcontentloaded' });
await spij(2500);
await page.click('[data-tab="skaner"]');
await spij(900);

/* ⚠️ ŻADEN EKRAN NIE JEST WYBRANY. Od 16.09 wybrany ekran interfejsu (rf-50n) FILTRUJE obrysy —
   widać wtedy tylko skanery do niego przypisane. Ten test mówi o samych skanerach, więc zaczyna
   od „bez ekranu": inaczej jego wynik zależałby od tego, co zostało po poprzednim klikaniu. */
await page.evaluate(async () => {
  await fetch('/scan/zrzut?dev=d0', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ act: 'wybierz', n: 0 })
  });
  await scanLoad('d0');
});
await spij(400);

// TRZY SKANERY O ROZŁĄCZNYCH OBSZARACH — inaczej „prostokąt leży tam, gdzie mówią liczby" dałoby
// się przejść, rysując wszystkie trzy w tym samym miejscu.
console.log('- trzy wlasne skanery dolozone do konfiguracji');
await page.evaluate(async (baza) => {
  const ustaw = async (x1, x2, y1, y2) => {
    Object.assign(window.RFScanKarta.u, {
      obszar: 'wlasny', obszarJednostka: 'procent', obszarX1: x1, obszarX2: x2, obszarY1: y1, obszarY2: y2
    });
    scanSave();
    await new Promise(r => setTimeout(r, 800));
  };
  await scanSekcjaDodaj('Test plansza');
  await new Promise(r => setTimeout(r, 400));
  await ustaw(4, 46, 8, 48);
  await scanSekcjaDodaj('Test panel');
  await new Promise(r => setTimeout(r, 400));
  await ustaw(54, 96, 52, 94);
  await scanSekcjaDodaj('Test pasek');
  await new Promise(r => setTimeout(r, 400));
  await ustaw(20, 80, 86, 98);
  await scanSekcjaWybierz(baza + 1);
  await new Promise(r => setTimeout(r, 600));
}, baza);
const cfg = await (await fetch(BAZA + 'scan?dev=d0')).json();
sprawdz('doszly trzy skanery, edytowany to pierwszy z nich',
  cfg.sekcje.length === baza + 3 && cfg.sekcjaAktywna === baza + 1,
  { ile: cfg.sekcje.length, akt: cfg.sekcjaAktywna });

console.log('\n- pigulki zamiast listy rozwijanej');
sprawdz('listy rozwijanej juz nie ma', await page.evaluate(() => !document.getElementById('scanSekcjaWybor')));
{
  const p = await page.evaluate(() => Array.from(document.querySelectorAll('.sk-sek-pill')).map(b => ({
    n: +b.getAttribute('data-sekcja'),
    txt: b.textContent,
    kolor: b.style.getPropertyValue('--sek'),
    akt: b.classList.contains('on'),
    pressed: b.getAttribute('aria-pressed')
  })));
  const moje = p.filter(x => x.n > baza);
  sprawdz('kazdy skaner ma swoja pigulke', p.length === baza + 3, p.map(x => x.txt));
  sprawdz('pigulka niesie numer i nazwe',
    moje[0].txt.indexOf(String(baza + 1)) === 0 && /Test plansza/.test(moje[0].txt), moje[0].txt);
  sprawdz('kazda ma inny kolor', new Set(moje.map(x => x.kolor)).size === 3, moje.map(x => x.kolor));
  sprawdz('edytowany skaner jest zaznaczony (takze dla czytnika ekranu)',
    moje[0].akt && moje[0].pressed === 'true' && !moje[1].akt && moje[1].pressed === 'false', moje);
}
{
  // Przełączenie ma iść na SERWER, nie tylko podświetlić pigułkę: pola pokręteł biorą się
  // z odpowiedzi, a wyzwalacz `scan:sekcja=N` czyta to samo miejsce.
  await page.click('.sk-sek-pill[data-sekcja="' + (baza + 2) + '"]');
  await spij(700);
  const po = await (await fetch(BAZA + 'scan?dev=d0')).json();
  sprawdz('klikniecie pigulki przelacza skaner na serwerze', po.sekcjaAktywna === baza + 2, po.sekcjaAktywna);
  sprawdz('…i pola pokazuja juz jego obszar', Math.abs(po.obszarX1 - 54) < 0.6, po.obszarX1);
}

console.log('\n- obszary pozostalych skanerow w podgladzie');
{
  const w = await page.evaluate(() => {
    const st = document.getElementById('scanStage').getBoundingClientRect();
    return Array.from(document.querySelectorAll('#scanSekcjeCienie .sk-cien')).map(d => {
      const r = d.getBoundingClientRect();
      return {
        lbl: d.textContent,
        kolor: d.style.getPropertyValue('--sek'),
        x: (r.x - st.x) / st.width * 100, y: (r.y - st.y) / st.height * 100,
        x2: (r.right - st.x) / st.width * 100, y2: (r.bottom - st.y) / st.height * 100
      };
    });
  });
  const plansza = w.filter(c => /Test plansza/.test(c.lbl))[0];
  sprawdz('widac wszystkie pozostale skanery, edytowanego wsrod nich nie ma',
    w.length === baza + 2 && !w.some(c => /Test panel/.test(c.lbl)), w.map(c => c.lbl));
  sprawdz('podpis mowi, ktory to skaner', !!plansza && plansza.lbl === (baza + 1) + ' · Test plansza',
    plansza && plansza.lbl);
  sprawdz('prostokat lezy tam, gdzie mowia liczby (± 1,5 %)',
    Math.abs(plansza.x - 4) < 1.5 && Math.abs(plansza.x2 - 46) < 1.5
    && Math.abs(plansza.y - 8) < 1.5 && Math.abs(plansza.y2 - 48) < 1.5, plansza);
  sprawdz('kolor prostokata to kolor jego pigulki', await page.evaluate(([kol, n]) => {
    const p = document.querySelector('.sk-sek-pill[data-sekcja="' + n + '"]');
    return p.style.getPropertyValue('--sek') === kol;
  }, [plansza.kolor, baza + 1]), plansza.kolor);
}
sprawdz('obrys edytowanego skanera tez jest w jego kolorze', await page.evaluate((n) => {
  const ob = document.querySelector('#scanSceneLayer .sc-obszar');
  const p = document.querySelector('.sk-sek-pill[data-sekcja="' + n + '"]');
  const na = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return 'rgb(' + (n >> 16 & 255) + ', ' + (n >> 8 & 255) + ', ' + (n & 255) + ')';
  };
  return getComputedStyle(ob).borderColor === na(p.style.getPropertyValue('--sek').trim());
}, baza + 2), await page.evaluate((n) => [getComputedStyle(document.querySelector('#scanSceneLayer .sc-obszar')).borderColor,
  document.querySelector('.sk-sek-pill[data-sekcja="' + n + '"]').style.getPropertyValue('--sek')], baza + 2));

console.log('\n- oczko: widac tylko ten, ktory edytujesz');
{
  await page.click('#scanSekcjeOko');
  await spij(300);
  const zgaszone = await page.evaluate(() => ({
    ile: document.querySelectorAll('#scanSekcjeCienie .sk-cien').length,
    pressed: document.getElementById('scanSekcjeOko').getAttribute('aria-pressed'),
    pamiec: localStorage.getItem('rf.scan.pozostale')
  }));
  sprawdz('oczko gasi pozostale skanery', zgaszone.ile === 0 && zgaszone.pressed === 'false', zgaszone);
  sprawdz('wybor zostaje zapamietany na tym komputerze', zgaszone.pamiec === '0', zgaszone.pamiec);
  // Sekcja edytowana zostaje widoczna — gaśnie TŁO decyzji, nie to, co się ustawia.
  sprawdz('obszar edytowanego skanera zostaje', await page.evaluate(() =>
    getComputedStyle(document.querySelector('#scanSceneLayer .sc-obszar')).display !== 'none'));
  await page.click('#scanSekcjeOko');
  await spij(300);
  sprawdz('…i wracaja tym samym oczkiem', await page.evaluate((ile) =>
    document.querySelectorAll('#scanSekcjeCienie .sk-cien').length === ile, baza + 2));
}

console.log('\n- skaner w ruchu ma czysty ekran');
{
  // Po pasku jadącym przez cudze prostokąty nie da się celować, więc na czas przejazdu cienie
  // schodzą — i wracają same, bez klikania w oczko.
  await page.evaluate(() => { _SCAN.silnik.start(performance.now()); });
  await spij(500);
  sprawdz('w trakcie skanowania cieni nie ma', await page.evaluate(() =>
    document.querySelectorAll('#scanSekcjeCienie .sk-cien').length === 0));
  await page.evaluate(() => { _SCAN.silnik.przerwij(); });
  await spij(500);
  sprawdz('po zatrzymaniu wracaja same', await page.evaluate((ile) =>
    document.querySelectorAll('#scanSekcjeCienie .sk-cien').length === ile, baza + 2));
}

console.log('\n- sprzatanie');
{
  const cfg2 = await (await fetch(BAZA + 'scan?dev=d0')).json();
  for (let n = cfg2.sekcje.length; n > baza; n--) {
    await post('/scan/sekcja?dev=d0', { act: 'usun', n: n });
    await spij(250);
  }
  // Na aktywną wraca ta, która nią była: `usun` przesuwa numer aktywnej, a `POST /scan` wpisuje
  // pokrętła w sekcję AKTYWNĄ — bez tego kroku sprzątanie przepisałoby cudzą sekcję.
  await post('/scan/sekcja?dev=d0', { act: 'wybierz', n: przed.sekcjaAktywna || 1 });
  await spij(300);
  await post('/scan?dev=d0', przed);
  await spij(300);
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
