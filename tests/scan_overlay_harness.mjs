/* SKANER EKRANU — strona okna stojącego nad pulpitem.
   Uruchomienie: instancja testowa aplikacji na 8790 (koniecznie z `--no-keys`), potem

     node tests/scan_overlay_harness.mjs

   ⚠️ `--no-keys` jest tu WARUNKIEM, nie ozdobą: ten test przechodzi całą drogę aż do wysłania
   `mouse:left@…%` do emitera. Bez tej flagi kursor na maszynie testującej naprawdę by skoczył
   i kliknął — czyli test rozwaliłby komuś pracę. Z nią serwer odpowiada `sent:false` i to jest
   dokładnie ten dowód, o który chodzi: droga działa, wyjście jest rozbrojone. */
import { createRequire } from 'module';
import path from 'path';
const wymagaj = createRequire(import.meta.url);
const { rfBezPierwszegoStartu } = wymagaj("./_rf_pierwszy_start.cjs");   // bez pytania i zaproszenia pierwszego startu
const { chromium } = wymagaj(path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@playwright', 'test'));

const ADRES = (process.env.RF_URL || 'http://127.0.0.1:8790/') + 'skaner-nakladka?dev=d0&mark=TEST-SKAN';
let ok = 0, zle = 0;
const bledy = [];
const spij = (ms) => new Promise(r => setTimeout(r, ms));
function sprawdz(nazwa, warunek, dodatek) {
  if (warunek) { ok++; console.log('  OK   ' + nazwa); }
  else { zle++; console.log('  ZLE  ' + nazwa + (dodatek !== undefined ? '  -> ' + JSON.stringify(dodatek) : '')); }
}

const przegladarka = await chromium.launch();
/* ⚠️ UKŁAD MONITORÓW PODSTAWIAMY (16.10), zamiast brać go z maszyny — tak jak scan_edytor_harness.
   Odpowiedź `/screens` niesie prawdziwy pulpit komputera, na którym akurat leci test, a od niej
   zależy, czy okno 1280×800 „różni się" od pulpitu i o ile scena jest skalowana (`doskalujScene`,
   próg 5 %). Na jednej maszynie asercje przechodziły, na drugiej nie — z tym samym kodem.
   Pulpit testowy to zmierzony 1707×1067 (2560×1600 przy 150 %): skala 0,75, więc widok jest INNY
   od pulpitu, a scena DOSKALOWANA — obie ścieżki, które te asercje mają widzieć. */
const EKRANY_TEST = {
  screens: [{ name: 'TEST1', primary: true, x: 0, y: 0, w: 1707, h: 1067, pw: 2560, ph: 1600,
              wx: 0, wy: 0, ww: 1707, wh: 1019, i: 0 }],
  desktop: { x: 0, y: 0, w: 1707, h: 1067 }, cursor: { x: 600, y: 300 },
  area: { x: 0, y: 0, w: 1707, h: 1067 }, monitor: null, fallback: false, dev: 'd0' };
async function kontekst() {
  const ctx = await rfBezPierwszegoStartu(przegladarka.newContext({ viewport: { width: 1280, height: 800 } }));
  await ctx.route(/\/screens(\?|$)/, r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(EKRANY_TEST) }));
  return ctx;
}
const page = await (await kontekst()).newPage();
page.on('console', m => { if (m.type() === 'error') bledy.push(m.text()); });
page.on('pageerror', e => bledy.push('pageerror: ' + e.message));

// Podsłuch wysyłek do emitera — to jest „klik" tej strony.
const wyslane = [];
page.on('request', r => { if (r.url().indexOf('/test-key') >= 0) wyslane.push(JSON.parse(r.postData() || '{}')); });

await page.goto(ADRES, { waitUntil: 'domcontentloaded' });
await spij(1200);

console.log('\n- strona wstaje');
sprawdz('tytuł niesie znacznik dla uruchamiarki', (await page.title()) === 'TEST-SKAN', await page.title());
sprawdz('silnik i scena zamontowane', await page.evaluate(() => !!(window.RFScanNakladka && window.RFScanNakladka.silnik)));
sprawdz('token sesji wstrzyknięty', await page.evaluate(() => !!window.RIBBITFLIP_TOKEN));
sprawdz('tło w kolorze klucza (Windows je wytnie)',
  (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(1, 2, 3)',
  await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
/* ⚠️ SKANER OBEJMUJE PULPIT, A NIE SWÓJ WIDOK (od 15.09) — i to jest naprawa celności, nie
   kosmetyka. Widok tego okna nie pokrywa pulpitu co do piksela: przeglądarka rysuje sobie pasek
   tytułu wewnątrz obszaru klienta, a okna nie wolno powiększyć o tyle, ile ten pasek zabiera
   (Chromium przycina wysokość). Serwer dosuwa więc lewy górny narożnik WIDOKU do narożnika
   pulpitu, a strona liczy procenty od pulpitu — inaczej klik padał o kilkadziesiąt pikseli wyżej
   niż narysowany pasek. W teście okno przeglądarki ma zwykły rozmiar, więc różnica jest duża
   i dobrze widoczna. */
{
  // Pytamy Z POZIOMU STRONY: `ADRES` w tym harnessie to adres samej nakładki, nie korzeń.
  const pulpit = await page.evaluate(() =>
    fetch('/screens?dev=d0').then(r => r.json()).then(j => j.desktop));
  sprawdz('skaner obejmuje PULPIT, nie widok okna', await page.evaluate((p) => {
    const e = window.RFScanNakladka.ekran();
    return e.x === 0 && e.y === 0 && Math.abs(e.w - p.w) < 2 && Math.abs(e.h - p.h) < 2;
  }, pulpit), { ekran: await page.evaluate(() => window.RFScanNakladka.ekran()), pulpit });
  sprawdz('…a widok okna jest INNY (dowód, że to nie przypadek)', await page.evaluate((p) =>
    Math.abs(window.innerHeight - p.h) > 2, pulpit),
    await page.evaluate(() => window.innerHeight));
}
sprawdz('przyciemnienie wyłączone (jedna alfa na okno — patrz nagłówek pliku)',
  await page.evaluate(() => document.querySelectorAll('.sc-przyciem').length === 0
    || Array.from(document.querySelectorAll('.sc-przyciem')).every(n => n.style.display === 'none')));
sprawdz('dociąganie wyłączone (nad pulpitem nie znamy przycisków Windowsa)',
  (await page.evaluate(() => window.RFScanNakladka.silnik.u.dociaganie)) === 0);

console.log('\n- sygnał ze strumienia prowadzi do kliknięcia');
const sygnal = (co) => page.evaluate((c) => fetch('/scan/sygnal?dev=d0', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ co: c })
}).then(r => r.json()), co);

await sygnal('sygnal');
await spij(1100);   // domyslne opoznienie startu to 600 ms
sprawdz('skaner ruszyl', (await page.evaluate(() => window.RFScanNakladka.silnik.faza)) === 'biegnie',
  await page.evaluate(() => window.RFScanNakladka.silnik.faza));
sprawdz('pasek jest narysowany', await page.evaluate(() => {
  const p = document.querySelector('.sc-pasmo');
  return !!p && p.style.display !== 'none' && parseFloat(p.style.width) > 10;
}));

// Cztery sygnały = cztery przebiegi (domyślnie dwa na oś) → jedno kliknięcie.
for (let i = 0; i < 4; i++) { await sygnal('sygnal'); await spij(900); }
await spij(500);
sprawdz('poszło dokładnie jedno kliknięcie', wyslane.length === 1, wyslane);
sprawdz('kliknięcie ma postać „mouse:…@x%,y%"',
  wyslane.length > 0 && /^mouse:(left|right|middle|double|move)@[\d.]+%,[\d.]+%$/.test(wyslane[0].keySpec || ''),
  wyslane[0]);
const proc = wyslane.length ? (wyslane[0].keySpec.match(/@([\d.]+)%,([\d.]+)%/) || []).slice(1).map(Number) : [];
sprawdz('procenty mieszczą się w ekranie', proc.length === 2 && proc.every(v => v >= 0 && v <= 100), proc);

console.log('\n- „stop" zatrzymuje z każdego miejsca');
await sygnal('sygnal');
await spij(300);
await sygnal('stop');
await spij(300);
sprawdz('po „stop" skaner stoi', (await page.evaluate(() => window.RFScanNakladka.silnik.faza)) === 'spoczynek');

/* TRYB PODGLĄDU (`?podglad=1`, 14.09) — to samo okno, ale tylko rysujące obrys obszaru.
   Sprawdzamy go TUTAJ, w przeglądarce testowej, a nie przez przełącznik w karcie: tamten otwiera
   PRAWDZIWE okno na cały pulpit człowieka, który akurat pracuje. Strona jest ta sama, więc to,
   co zmienia adres, da się zmierzyć bez zasłaniania komukolwiek ekranu.
   Najważniejsze sprawdzenie jest ostatnie: sygnał ze strumienia NIE MA ruszyć paska. „To okno nic
   nie klika" musi wynikać z kodu, a nie z tego, że nikt go nie obudzi. */
console.log('\n- tryb podgladu obszaru (?podglad=1)');
{
  const strona2 = await (await kontekst()).newPage();
  const wyslane2 = [];
  strona2.on('request', r => { if (r.url().indexOf('/test-key') >= 0) wyslane2.push(r.url()); });
  await strona2.goto(ADRES.replace('mark=TEST-SKAN', 'mark=TEST-PODGLAD&podglad=1'), { waitUntil: 'domcontentloaded' });
  await spij(1200);
  // Obszar musi być ZAWĘŻONY, inaczej „obrys obszaru" pokrywa się z krawędzią okna i nie widać,
  // czy w ogóle jest rysowany.
  await strona2.evaluate(() => fetch('/scan?dev=d0', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RibbitFlip-Token': window.RIBBITFLIP_TOKEN },
    body: JSON.stringify({ obszar: 'wlasny', obszarJednostka: 'procent', obszarX1: 25, obszarY1: 66, obszarX2: 75, obszarY2: 100 })
  }));
  await spij(1200);   // zmiana idzie strumieniem (`scan_cfg`), okno samo się o nią pyta
  sprawdz('strona wie, ze jest podgladem', await strona2.evaluate(() => document.body.classList.contains('rf-podglad')));
  sprawdz('pasek stanu schowany, zdanie o podgladzie widoczne', await strona2.evaluate(() =>
    getComputedStyle(document.getElementById('hud')).display === 'none'
    && getComputedStyle(document.getElementById('podglad')).display !== 'none'));
  sprawdz('obrys obszaru stoi CALY CZAS', await strona2.evaluate(() => {
    const o = document.querySelector('.sc-obszar');
    return !!o && o.style.display !== 'none' && o.classList.contains('sc-obszar-podglad');
  }));
  // ⚠️ Tolerancja 8 px, bo `getBoundingClientRect` liczy RAZEM Z OBRYSEM: prostokat 640x272 mierzy
  // sie jako 644x276 przy grubosci linii 2 px (a ta jest pokretlem, wiec bywa grubsza).
  // ⚠️ UŁAMKI LICZĄ SIĘ OD PULPITU, NIE OD OKNA (od 15.09). Nakładka rysuje w skali 1:1 z ekranem
  // — patrz `pelne()` w rf-50h i nota przy asercji „skaner obejmuje PULPIT" wyżej. W teście okno
  // przeglądarki jest mniejsze od pulpitu, więc gdyby ułamki liczyły się od okna, obrys wyszedłby
  // za mały i ta asercja by to złapała (i złapała: 858 px zamiast 640).
  {
    const pulpit2 = await strona2.evaluate(() =>
      fetch('/screens?dev=d0').then(r => r.json()).then(j => j.desktop));
    /* ⚠️ OBRYS JEST DOCIAGANY DO TEGO, CO W OKNIE WIDAC . Bez tego
       ramka nie dochodzila do samego dolu pulpitu, bo widok okna jest krotszy
       od pulpitu (Chromium nie pozwala powiekszyc okna o swoj pasek tytulu), wiec dolna krecha
       ladowala pod krawedzia widoku. Skracamy wiec sam obrys; pasek i punkt kliku zostaja 1:1.
       W tym tescie okno przegladarki jest mniejsze od pulpitu, wiec docinanie jest duze i widac
       je jak na dloni — dlatego oczekiwana wartosc to „ulamek pulpitu, ale nie wiecej niz widok". */
    /* Od 23.09 scena jest DOSKALOWANA do widoku, gdy ten różni się od pulpitu o ≥ 5 % (rf-50h
       `doskalujScene`): ułamek pulpitu mnożymy więc przez skalę, którą strona sama podaje. Ułamki
       liczone od okna dalej by tu wpadły — wyszłyby o tę samą skalę za małe. */
    const obrysPomiar = (p) => {
      const o = document.querySelector('.sc-obszar').getBoundingClientRect();
      const s = window.RFScanNakladka.skala();
      const rowne = Math.abs(s.sx - 1) < 0.05 && Math.abs(s.sy - 1) < 0.05;
      const sx = rowne ? 1 : s.sx, sy = rowne ? 1 : s.sy;
      const chce = [Math.min(p.w * 0.5 * sx, window.innerWidth - o.x - 3),
                    Math.min(p.h * 0.34 * sy, window.innerHeight - o.y - 3)];
      return { ok: Math.abs(o.width - chce[0]) <= 8 && Math.abs(o.height - chce[1]) <= 8,
               obrys: [Math.round(o.width), Math.round(o.height)], chce: chce.map(Math.round),
               skala: [+sx.toFixed(3), +sy.toFixed(3)], okno: [window.innerWidth, window.innerHeight] };
    };
    const obrys = await strona2.evaluate(`(${obrysPomiar})(${JSON.stringify(pulpit2)})`);
    sprawdz('obrys trzyma ulamki pulpitu, dociety do widoku okna', obrys.ok, obrys);
    sprawdz('…i nie wystaje za krawedz okna (ramka sie DOMYKA)', await strona2.evaluate(() => {
      const o = document.querySelector('.sc-obszar').getBoundingClientRect();
      return o.right <= window.innerWidth && o.bottom <= window.innerHeight;
    }), await strona2.evaluate(() => {
      const o = document.querySelector('.sc-obszar').getBoundingClientRect();
      return [Math.round(o.right), window.innerWidth, Math.round(o.bottom), window.innerHeight];
    }));
  }
  sprawdz('wypelnienia nie ma (Windows wycina z tego okna jeden kolor)', await strona2.evaluate(() => {
    const t = document.querySelector('.sc-obszar').style.background || '';
    return t === '' || t === 'transparent';
  }), await strona2.evaluate(() => document.querySelector('.sc-obszar').style.background));
  const ile = wyslane2.length;
  await sygnal('sygnal');
  await spij(1400);
  sprawdz('sygnal NIE rusza paska w podgladzie',
    (await strona2.evaluate(() => window.RFScanNakladka.silnik.faza)) === 'spoczynek',
    await strona2.evaluate(() => window.RFScanNakladka.silnik.faza));
  sprawdz('podglad nic nie klika', wyslane2.length === ile, wyslane2);
  await strona2.close();
  // Sprzatanie: obszar wraca na caly pulpit, zeby nastepne uruchomienie zaczynalo od tego samego.
  await page.evaluate(() => fetch('/scan?dev=d0', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RibbitFlip-Token': window.RIBBITFLIP_TOKEN },
    body: JSON.stringify({ obszar: 'caly', obszarX1: 0, obszarY1: 0, obszarX2: 100, obszarY2: 100 })
  }));
}

/* PASEK NA DOLE MÓWI, CZYM TO ZGASIĆ — od 15.09 DWOMA skrótami (2026-09-15).

   Wyłączenie nakładki na pulpicie i powrót do symulacji idzie po shift+r+f, a nie po alt+r+f,
   żeby nie wyzwalało to wyłączania wszystkich modułów.
   Skrót skanera stoi PIERWSZY, bo jest codziennym wyjściem; stop awaryjny drugi, bo rozbraja
   całą aplikację.

   ⚠️ ODPOWIEDŹ `/hotkey` JEST TU PODSTAWIONA, i to nie jest wygoda: kopia testowa (--allow-multi)
   świadomie NIE przejmuje haków klawiatury, więc prawdziwy serwer odpowiada „niedostępny" i pasek
   — słusznie — nie obiecuje żadnych klawiszy. Obie odpowiedzi trzeba więc pokazać z zewnątrz. */
console.log('\n- pasek na dole nazywa OBA skroty');
{
  const zgasNa = async (hotkey, mark) => {
    const s = await (await rfBezPierwszegoStartu(przegladarka.newContext({ viewport: { width: 1280, height: 800 } }))).newPage();
    s.on('console', m => { if (m.type() === 'error') bledy.push(m.text()); });
    s.on('pageerror', e => bledy.push('pageerror: ' + e.message));
    await s.route('**/hotkey', r => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(hotkey)
    }));
    await s.goto(ADRES.replace('mark=TEST-SKAN', 'mark=' + mark + '&podglad=1'), { waitUntil: 'domcontentloaded' });
    await spij(900);
    const t = await s.evaluate(() => document.getElementById('podgladSkrot').textContent);
    await s.close();
    return t;
  };
  const oba = await zgasNa({
    ok: true, enabled: true, available: true, combo: 'alt+r+f',
    scan: { enabled: true, available: true, combo: 'shift+r+f' }
  }, 'TEST-SKROTY');
  sprawdz('skrot skanera jest wymieniony i stoi PIERWSZY',
    oba.indexOf('Shift + R + F') >= 0 && oba.indexOf('Shift') < oba.indexOf('Alt'), oba);
  sprawdz('stop awaryjny nadal wymieniony, ale jako drugi',
    oba.indexOf('Alt + R + F') >= 0 && /rozbraja/.test(oba), oba);
  sprawdz('kazdy skrot mowi, CO robi (zamyka vs rozbraja)',
    /zamyka to okno/.test(oba) && /stop awaryjny/.test(oba), oba);
  const zaden = await zgasNa({
    ok: true, enabled: false, available: false, combo: 'alt+r+f',
    scan: { enabled: true, available: false, combo: 'shift+r+f' }
  }, 'TEST-BEZSKROTU');
  sprawdz('skrot niedostepny = ZADNYCH klawiszy, tylko przelacznik w karcie',
    zaden.indexOf('+') < 0 && /Gdzie działa/.test(zaden), zaden);
}

console.log('\n- zrzut');
await page.screenshot({ path: '_backups/260911-skaner/skaner-nakladka.png' });

console.log('\n- konsola');
sprawdz('zero błędów w konsoli', bledy.length === 0, bledy.slice(0, 6));

await przegladarka.close();
console.log('\n' + ok + ' passed, ' + zle + ' failed');
process.exit(zle ? 1 : 0);
