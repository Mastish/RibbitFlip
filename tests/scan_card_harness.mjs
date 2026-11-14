/* SKANER EKRANU — karta modułu w prawdziwej przeglądarce.
   Uruchomienie: instancja testowa aplikacji na 8790, potem

     node tests/scan_card_harness.mjs

   Dlaczego prawdziwy Chromium, a nie panel przeglądarki: ukryta karta zamraża
   requestAnimationFrame, a skaner CAŁY jest pętlą klatek — pasek stałby w miejscu i każdy
   pomiar byłby fikcją. */
import { createRequire } from 'module';
import path from 'path';
const wymagaj = createRequire(import.meta.url);
const { rfBezPierwszegoStartu } = wymagaj("./_rf_pierwszy_start.cjs");   // bez pytania i zaproszenia pierwszego startu
const { chromium } = wymagaj(path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@playwright', 'test'));

const ADRES = process.env.RF_URL || 'http://127.0.0.1:8790/';
let ok = 0, zle = 0;
const bledy = [];
const spij = (ms) => new Promise(r => setTimeout(r, ms));
function sprawdz(nazwa, warunek, dodatek) {
  if (warunek) { ok++; console.log('  OK   ' + nazwa); }
  else { zle++; console.log('  ZLE  ' + nazwa + (dodatek !== undefined ? '  -> ' + JSON.stringify(dodatek) : '')); }
}

const przegladarka = await chromium.launch();
// 1920×1080: dwie kolumny (podgląd obok pokręteł, lepki) stoją dopiero od karty szerszej niż 1180 px
// (26-scan.css, 2026-11-21); przy 1680 px okna z panelami bocznymi karta stawia podgląd nad pokrętłami.
const page = await (await rfBezPierwszegoStartu(przegladarka.newContext({ viewport: { width: 1920, height: 1080 } }))).newPage();
page.on('console', m => { if (m.type() === 'error') bledy.push(m.text()); });
page.on('pageerror', e => bledy.push('pageerror: ' + e.message));
await page.goto(ADRES, { waitUntil: 'domcontentloaded' });
await spij(2500);

console.log('\n- zakladka');
sprawdz('przycisk „Skaner" jest w nawigacji', await page.evaluate(() =>
  !!Array.from(document.querySelectorAll('button,a')).find(b => /^Skaner$/.test((b.textContent || '').trim()))));
await page.click('[data-tab="skaner"]');
await spij(900);
sprawdz('karta skanera jest widoczna', await page.evaluate(() => {
  const c = document.getElementById('scanCard');
  return !!(c && c.offsetParent !== null);
}));
sprawdz('silnik wstal', await page.evaluate(() => !!(window.RFScan && window.RFScan.Silnik)));
sprawdz('piaskownica ma cele', await page.evaluate(() => {
  const st = window.RFScan && document.querySelector('.sk-card .pu-pulpit');
  return !!st && document.querySelectorAll('.sk-card [data-cel]').length > 20;
}), await page.evaluate(() => document.querySelectorAll('.sk-card [data-cel]').length));
sprawdz('pola ustawien zbudowane', (await page.evaluate(() => document.querySelectorAll('#scanFields .sk-wiersz').length)) > 15,
  await page.evaluate(() => document.querySelectorAll('#scanFields .sk-wiersz').length));
// ZESTAWY NIE SA JUZ PASKIEM W KARCIE — od 11.09 sa pozycjami BIBLIOTEKI modulu. W karcie ma
// po nich NIE BYC sladu, a to, ze sa w bibliotece, sprawdza scan_library_harness.
sprawdz('paska zestawow w karcie nie ma', (await page.evaluate(() =>
  !document.getElementById('scanPresets') && !document.querySelector('.sk-card .ui-zestaw'))));
// PODGLAD JEDZIE ZE STRONA. Mierzymy PO PRZEWINIECIU: regula `position:sticky` bywa poprawna
// i bezsilna (pojemnik przewijania z `.card{overflow:hidden}`), wiec pytamy o piksele.
sprawdz('lewa kolumna jest lepka', (await page.evaluate(() =>
  getComputedStyle(document.querySelector('.sk-lewa')).position)) === 'sticky');
// ⚠️ Sekcja „📸 Zrzut planszy skrótem" (rf-50o) stoi celowo ROZWINIĘTA i dokłada
// lewej kolumnie ~400 px: przy 1680×1000 kolumna jest wtedy WYŻSZA niż prawa, wyznacza wysokość
// `.sk-body` i `sticky` nie ma już po czym jechać — ramka odjeżdża razem z przewinięciem, choć reguła
// działa. To pomiar treści, nie lepkości, więc mierzymy przy zwiniętej sekcji i przywracamy jej stan.
{
  const jedzie = await page.evaluate(async () => {
    const sek = document.getElementById('scanSkrot');
    const bylaOtwarta = !!(sek && sek.open);
    if (sek) sek.open = false;
    // Od UX 261120 L4d prawa kolumna to zwinięte piętra 2 i 3, więc bez nich strona prawie się nie
    // przewija. Otwieramy je na czas pomiaru, żeby było po czym jechać, i zamykamy z powrotem.
    const pietra = Array.from(document.querySelectorAll('.sk-prawa details.cardfold:not([open])'))
      .filter(d => d.id !== 'scanSkrot');
    pietra.forEach(d => { d.open = true; });
    await new Promise(r => setTimeout(r, 100));
    const s = document.getElementById('scanStage');
    const przed = s.getBoundingClientRect().top;
    window.scrollTo(0, 700);
    await new Promise(r => setTimeout(r, 350));
    const po = s.getBoundingClientRect().top;
    const y = window.scrollY;
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 250));
    if (sek) sek.open = bylaOtwarta;
    pietra.forEach(d => { d.open = false; });
    return { przed: Math.round(przed), po: Math.round(po), scroll: Math.round(y) };
  });
  // Przy braku lepkosci ramka odjechalaby w gore o cale przewiniecie.
  sprawdz('podglad zostaje w oknie po przewinieciu', jedzie.scroll > 100 && jedzie.po > -40, jedzie);
}
sprawdz('obszar skanowania to ramka podgladu, nie cale okno', await page.evaluate(() => {
  const r = document.getElementById('scanStage').getBoundingClientRect();
  return r.width > 300 && r.height > 300 && r.width < window.innerWidth - 200;
}));

console.log('\n- wlacznik modulu');
// Stan startowy USTAWIANY przez serwer, nie zastawany: inaczej o tym, czy test sprawdza zapalanie
// czy gaszenie, decyduje kolejnosc uruchomien (i test raz przechodzi, raz nie — zmierzone).
// ⚠️ TO SAMO DOTYCZY CALEJ KONFIGURACJI, nie tylko wlacznika. Instancja testowa trzyma ustawienia
// na dysku, wiec test dziedziczyl po poprzednim uruchomieniu (i po recznym klikaniu) miedzy innymi
// OBSZAR skanowania i kolejnosc w kratce — a wtedy „pasek na caly obszar" albo „pola zapalaja sie
// jak czytanie" upadaly na ustawieniu, nie na kodzie. Zaczynamy od DOMYSLNYCH, tak samo jak
// zestawy w rf-50b (po zgloszeniu z 10.09).
await page.evaluate(async () => {
  const czyste = Object.assign({}, window.RFScan.DOMYSLNE, window.RFScan.WYGLAD_DOM, { enabled: false });
  await fetch('/scan?dev=d0', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(czyste) });
  await scanLoad('d0');
  // ⚠️ EKRANY TEŻ (16.09): od wprowadzenia ekranów zrzut należy do nich, a spis ekranów celowo
  // NIE wchodzi przez `/scan`. Zostawiony ekran znaczyłby zrzut pod podglądem (czyli schowaną
  // piaskownicę) i filtr obrysów — a oba psują testy, które o ekranach nic nie wiedzą.
  for (let i = ((window.RFScanKarta.u.zrzuty) || []).length; i > 0; i--) {
    await fetch('/scan/zrzut?dev=d0', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ act: 'usun', n: i })
    });
  }
  await scanLoad('d0');
  await new Promise(r => setTimeout(r, 300));
});
sprawdz('start od ustawien domyslnych (obszar i kratka nie zostaja po poprzednim uruchomieniu)',
  await page.evaluate(() => {
    const u = window.RFScanKarta.u, D = window.RFScan.DOMYSLNE;
    return u.obszar === D.obszar && u.cwiartkiKolejnosc === D.cwiartkiKolejnosc
        && u.przebiegi === D.przebiegi && u.poCwiartkach === D.poCwiartkach;
  }), await page.evaluate(() => {
    const u = window.RFScanKarta.u;
    return { obszar: u.obszar, kratka: u.cwiartkiKolejnosc, przebiegi: u.przebiegi, poCwiartkach: u.poCwiartkach };
  }));
await page.click('#scanEnable');
await spij(700);
sprawdz('wlacznik zapala sie', await page.evaluate(() => document.getElementById('scanEnable').classList.contains('on')));
sprawdz('serwer zapamietal wlaczenie',
  (await (await page.request.get(ADRES + 'scan?dev=d0')).json()).enabled === true);
sprawdz('kropka stanu przy zakladce swieci', await page.evaluate(() =>
  !!document.querySelector('.tab-dot[data-grp="scan"].on')));

console.log('\n- pelny cykl w piaskownicy');
await page.evaluate(() => {
  const R = window.RFScan, S = window;
  // Ustawienia pod test: szybko, dwa przebiegi, bez dociagania.
  S.RFScanTest = true;
});
const stanPo = await page.evaluate(async () => {
  const cel = Array.from(document.querySelectorAll('.sk-card [data-cel]'))
    .find(n => n.getAttribute('data-cel') === 'Przycisk Zapisz');
  const r = cel.getBoundingClientRect();
  const punkt = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  // Sygnal idzie PRZYCISKIEM — klawiatury w module nie ma od 11.09 („wywal p, zostaw
  // sterowanie przyciskiem i kapslem"), wiec test ma isc ta sama droga, co czlowiek.
  const puk = () => {
    const b = document.getElementById('scanSignal');
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    setTimeout(() => b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })), 20);
  };
  const czekaj = (ms) => new Promise(r2 => setTimeout(r2, ms));
  puk();                                   // start
  await czekaj(250);
  for (let etap = 0; etap < 4; etap++) {
    const trafiony = await new Promise((res) => {
      const t0 = performance.now();
      function klatka() {
        if (performance.now() - t0 > 14000) return res(false);
        const st = window._scanStanTestowy;
        if (st && st.faza === 'biegnie' && st.pasmo) {
          const s = (st.pasmo.od + st.pasmo.do) / 2;
          const chce = st.pasmo.os === 'y' ? punkt.y : punkt.x;
          if (Math.abs(s - chce) <= Math.max(6, (st.pasmo.do - st.pasmo.od) / 2 - 4)) { puk(); return res(true); }
        }
        requestAnimationFrame(klatka);
      }
      requestAnimationFrame(klatka);
    });
    if (!trafiony) return { etap, ok: false };
    await czekaj(180);
  }
  await czekaj(300);
  const wpis = document.querySelector('#scanLog .ui-dz-wpis');
  return { ok: true, wpis: wpis ? wpis.textContent : '' };
});
sprawdz('cztery przebiegi doprowadzily do klikniecia', stanPo.ok, stanPo);
sprawdz('klikniecie trafilo w „Zapisz" i jest w dzienniku', /Zapisz/.test(stanPo.wpis || ''), stanPo.wpis);

console.log('\n- sygnal z kapsla (regula `scan:sygnal` przez serwer)');
await page.evaluate(() => document.getElementById('scanStop').click());
await spij(200);
const przed = await page.evaluate(() => window._scanStanTestowy && window._scanStanTestowy.faza);
await page.evaluate(() => fetch('/scan/sygnal?dev=d0', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({co:'sygnal'})}).then(r=>r.json()));
await spij(600);
const poSygnale = await page.evaluate(() => window._scanStanTestowy && window._scanStanTestowy.faza);
sprawdz('sygnal ze strumienia uruchamia skanowanie', przed !== poSygnale && poSygnale !== 'spoczynek', { przed, poSygnale });
await page.evaluate(() => fetch('/scan/sygnal?dev=d0', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({co:'stop'})}).then(r=>r.json()));
await spij(400);
sprawdz('„stop" ze strumienia zatrzymuje', (await page.evaluate(() => window._scanStanTestowy.faza)) === 'spoczynek');

console.log('\n- wymiary, kolor i krycie paska (zgloszenie 11.09)');
// Ustawiamy i MIERZYMY NARYSOWANY pasek — nie stan silnika. Liczba w konfiguracji, która nie
// przekłada się na piksele, jest dokładnie tym rodzajem usterki, którego nie widać w logach.
const zmierz = async (ustawienia) => page.evaluate(async (ust) => {
  const R = window.RFScanKarta;
  Object.assign(R.u, ust.u || {});
  Object.assign(R.w, ust.w || {});
  R.silnik.ustawienia(R.u);
  const bs = document.getElementById('scanSignal');
  bs.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  bs.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  await new Promise(r => setTimeout(r, 1000));
  const p = document.querySelector('.sk-scene-layer .sc-pasmo');
  const st = window._scanStanTestowy;
  const e = window.RFSkanerEkran ? window.RFSkanerEkran() : document.getElementById('scanStage').getBoundingClientRect();
  const out = {
    szer: p ? Math.round(parseFloat(p.style.width)) : 0,
    wys: p ? Math.round(parseFloat(p.style.height)) : 0,
    tlo: p ? p.style.background : '',
    obszarW: Math.round(e.width || e.w), obszarH: Math.round(e.height || e.h),
    os: st && st.pasmo ? st.pasmo.os : null
  };
  document.getElementById('scanStop').click();
  await new Promise(r => setTimeout(r, 200));
  return out;
}, ustawienia);

const pelny = await zmierz({ u: { tryb: 'pasy', kolejnosc: 'Y', przebiegi: 1, pasmoY: 100, opoznienieStartu: 0 }, w: { pokrycieY: 100 } });
sprawdz('pasek poziomy ma zadana wysokosc', Math.abs(pelny.wys - 100) <= 2, pelny);
sprawdz('przy 100% pasek jest szeroki na caly obszar', Math.abs(pelny.szer - pelny.obszarW) <= 2, pelny);

const polowa = await zmierz({ w: { pokrycieY: 50 } });
sprawdz('przy 50% pasek jest o polowe krotszy', Math.abs(polowa.szer - pelny.obszarW / 2) <= 4, polowa);
sprawdz('…i nadal ma te sama wysokosc', Math.abs(polowa.wys - 100) <= 2, polowa);

const chudy = await zmierz({ u: { pasmoY: 40 }, w: { pokrycieY: 100 } });
sprawdz('wysokosc paska idzie za ustawieniem', Math.abs(chudy.wys - 40) <= 2, chudy);

const zielony = await zmierz({ u: {}, w: { kolorY: '#00ff00', kryciePasma: 0.8 } });
sprawdz('kolor paska idzie z ustawien', /#00ff00|rgb\(0,\s*255,\s*0\)/i.test(zielony.tlo), zielony.tlo);
sprawdz('krycie idzie z ustawien', /80%/.test(zielony.tlo), zielony.tlo);
const przezroczysty = await zmierz({ u: {}, w: { kryciePasma: 0.1 } });
sprawdz('mniejsze krycie = mniejszy procent w tle', /10%/.test(przezroczysty.tlo), przezroczysty.tlo);

const pionowy = await zmierz({ u: { kolejnosc: 'X', pasmoX: 60 }, w: { kolorX: '#0000ff', pokrycieX: 40 } });
sprawdz('pasek pionowy ma zadana szerokosc', Math.abs(pionowy.szer - 60) <= 2, pionowy);
sprawdz('…i zadane pokrycie wysokosci', Math.abs(pionowy.wys - pionowy.obszarH * 0.4) <= 5, pionowy);
sprawdz('…i wlasny kolor', /#0000ff|rgb\(0,\s*0,\s*255\)/i.test(pionowy.tlo), pionowy.tlo);
await page.evaluate(() => {
  const R = window.RFScanKarta;
  Object.assign(R.u, { kolejnosc: 'Y-X', przebiegi: 2, pasmoY: 140, pasmoX: 140, opoznienieStartu: 600 });
  Object.assign(R.w, { kolorY: '#ec1a83', kolorX: '#6cb33f', kryciePasma: 0.26, pokrycieY: 100, pokrycieX: 100 });
  R.silnik.ustawienia(R.u);
});

// PASEK STANU STOI POD RAMKA, NIE NA NIEJ (16.09). Dwa paski zaslanialy podglad: pasek wisial przy gornej krawedzi podgladu,
// a zdanie „Nacisnij SYGNAL…" przy dolnej. Do 16.09 test pilnowal ODWROTNEJ wlasnosci (pasek
// LEZY W RAMCE, nad scena), wiec sam by tego nie zglosil. Teraz mierzy piksele: nic z paska nie
// wchodzi w prostokat podgladu, a pudelka ze zdaniem nie ma w ogole.
console.log('\n- pasek stanu nie zaslania podgladu');
sprawdz('pasek stanu lezy PONIZEJ ramki podgladu', await page.evaluate(() => {
  const h = document.getElementById('scanHud'), s = document.getElementById('scanStage');
  if (!h || !s) return false;
  const hb = h.getBoundingClientRect(), sb = s.getBoundingClientRect();
  return hb.height > 0 && hb.top >= sb.bottom - 1;
}), await page.evaluate(() => {
  const h = document.getElementById('scanHud'), s = document.getElementById('scanStage');
  const r = (n) => n ? { t: Math.round(n.getBoundingClientRect().top), b: Math.round(n.getBoundingClientRect().bottom) } : null;
  return { hud: r(h), ramka: r(s) };
}));
sprawdz('pudelka „Nacisnij SYGNAL" na obrazie juz nie ma', await page.evaluate(() =>
  !document.getElementById('scanIdle') && !document.querySelector('.sk-plansza-napis')));
sprawdz('…bo to samo mowi pasek stanu w spoczynku', await page.evaluate(() =>
  /SYGNA|SIGNAL/.test((document.querySelector('#scanHud .hud-opis') || {}).textContent || '')),
  await page.evaluate(() => (document.querySelector('#scanHud .hud-opis') || {}).textContent));
// Paska „Konfiguracja skanera: <kapsel>" nie ma od UX 261120 (M06): czyje to ustawienia, mowi
// chip kapsla w naglowku modulu, a pasek byl dublem i trzecim pasem nad podgladem.
sprawdz('paska-dubla „Konfiguracja skanera" nie ma', await page.evaluate(() =>
  !document.getElementById('scanCfgHead') && !document.getElementById('scanCfgTitle')));
sprawdz('sekcje ustawien sie zwijaja', await page.evaluate(() =>
  document.querySelectorAll('#scanFields details.sk-fold').length >= 4));
// Od 14.09 ZWINIETE SA WSZYSTKIE, rowniez pierwsza (sekcje po prawej domyslnie
// zwiniete) — z zamknietymi widac caly spis sekcji naraz.
sprawdz('na starcie wszystkie sekcje sa zwiniete', await page.evaluate(() =>
  Array.from(document.querySelectorAll('#scanFields details.sk-fold')).filter(d => d.open).length === 0),
  await page.evaluate(() => Array.from(document.querySelectorAll('#scanFields details.sk-fold'))
    .filter(d => d.open).map(d => d.textContent.slice(0, 24))));
sprawdz('sekcja otwiera sie kliknieciem w naglowek', await page.evaluate(async () => {
  const f = document.querySelector('#scanFields details.sk-fold');
  f.querySelector('summary').click();
  await new Promise(r => setTimeout(r, 120));
  const otwarta = f.open;
  f.querySelector('summary').click();               // i z powrotem, zeby dalsze testy mialy stan startowy
  await new Promise(r => setTimeout(r, 120));
  return otwarta && !f.open;
}));

/* WARTOSC SPOZA SUWAKA (16.09). Suwaki m.in. predkosci koncza sie na 100 px/s, a nie kazdy
   uzytkownik ma takie zdolnosci: wartosc mozna dostroic albo wpisac recznie poza zakresem
   suwaka, a suwaki sa tam, gdzie sie da, szersze.
   Skaner jest narzedziem DOSTEPNOSCI, wiec dolna granica wygodna dla wiekszosci nie moze byc
   granica twarda — a to, co da sie wpisac, musi byc dokladnie tym, co przyjmuje serwer. */
console.log('\n- wartosc spoza suwaka i szerokosc suwakow');
{
  const stan = await page.evaluate(async () => {
    const R = window.RFScanKarta;
    R.u.ruch = 'plynny';                       // „Predkosc paska" pokazuje sie tylko przy ruchu plynnym
    R.pola.podepnij(R.u, R.w); R.pola.odswiez();
    document.querySelectorAll('#scanFields details.sk-fold').forEach(d => { d.open = true; });
    await new Promise(r => setTimeout(r, 200));
    const wiersze = Array.from(document.querySelectorAll('#scanFields .sk-wiersz'))
      .filter(w => w.querySelector('.sk-suwak') && !w.classList.contains('sk-ukryte'));
    const w = wiersze.find(x => /Prędkość paska/.test((x.querySelector('.sk-nazwa') || {}).textContent || ''));
    const pole = w.querySelector('.sk-odczyt-pole'), suwak = w.querySelector('.sk-suwak');
    const przed = R.u.predkosc;
    pole.value = '40';                         // ponizej minimum suwaka (100)
    pole.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 900));
    return {
      suwakow: wiersze.length,
      zPolem: wiersze.filter(x => x.querySelector('.sk-odczyt-pole')).length,
      widelki: [+pole.min, +pole.max],
      serwerowe: RFScan.ZAKRESY.predkosc,
      poWpisaniu: R.u.predkosc,
      suwakMin: +suwak.min, suwakWartosc: +suwak.value,
      szerokosc: Math.round(suwak.getBoundingClientRect().width),
      wysokosc: Math.round(suwak.getBoundingClientRect().height),
      przed: przed
    };
  });
  sprawdz('kazdy suwak (poza procentowymi) ma pole do wpisania',
    stan.zPolem >= stan.suwakow - 4 && stan.zPolem > 0, stan);
  sprawdz('pole przyjmuje dokladnie to, co serwer',
    stan.widelki[0] === stan.serwerowe[0] && stan.widelki[1] === stan.serwerowe[1], stan.widelki);
  sprawdz('40 px/s (ponizej minimum suwaka) wchodzi', stan.poWpisaniu === 40, stan.poWpisaniu);
  sprawdz('…i suwak rozciaga sie do wpisanej wartosci zamiast ja wyrzucac',
    stan.suwakMin === 40 && stan.suwakWartosc === 40, stan);
  sprawdz('serwer zapamietal wartosc spoza suwaka',
    (await (await page.request.get(ADRES + 'scan?dev=d0')).json()).predkosc === 40);
  // 300 px to prog „da sie w to trafic" — do 16.09 suwaki mialy 120 px, bo `.sk-suwak{width:100%}`
  // przegrywalo specyficznoscia z `input[type=range]{width:120px}` z bazy.
  sprawdz('suwak jest szeroki i wysoki na tyle, zeby dalo sie go chwycic',
    stan.szerokosc > 300 && stan.wysokosc >= 28, { szer: stan.szerokosc, wys: stan.wysokosc });
  await page.evaluate(async (przed) => {
    const R = window.RFScanKarta;
    R.u.predkosc = przed;
    R.pola.podepnij(R.u, R.w); R.pola.odswiez();
    scanSave();
    await new Promise(r => setTimeout(r, 700));
  }, stan.przed);
}

console.log('\n- przelaczniki segmentowe');
// ⚠️ PRZYCISK WYBRANY MOZE BYC TYLKO JEDEN W RZEDZIE. Do 14.09 `classList.toggle` dostawal tu
// `undefined` zamiast `false` (wyrazenie `false || (undefined && …)`), a `toggle(klasa, undefined)`
// PRZELACZA klase zamiast ja zgasic — wiec niewybrane przyciski zapalaly sie i gasly co
// odswiezenie panelu, jakby zapalaly sie w losowej kolejnosci.
// Test musi WYMUSIC kilka odswiezen, bo przy jednym bledna droga wyglada poprawnie.
{
  const rzedy = await page.evaluate(async () => {
    const R = window.RFScanKarta;
    for (let i = 0; i < 5; i++) { R.pola.odswiez(); await new Promise(r => setTimeout(r, 30)); }
    return Array.from(document.querySelectorAll('#scanFields .sk-wiersz:not(.sk-ukryte) .sk-segment'))
      .map(s => ({
        nazwa: (s.parentElement.querySelector('.sk-nazwa') || {}).textContent || '?',
        wybrane: Array.from(s.children).filter(b => b.classList.contains('sk-seg-wybrany'))
          .map(b => b.textContent)
      }));
  });
  sprawdz('po pieciu odswiezeniach kazdy rzad ma DOKLADNIE jeden zapalony przycisk',
    rzedy.length > 3 && rzedy.every(r => r.wybrane.length === 1),
    rzedy.filter(r => r.wybrane.length !== 1));
  const klik = await page.evaluate(async () => {
    const rzad = Array.from(document.querySelectorAll('#scanFields .sk-wiersz:not(.sk-ukryte)'))
      .find(w => (w.querySelector('.sk-nazwa') || {}).textContent === 'Sposob wskazywania'
              || (w.querySelector('.sk-nazwa') || {}).textContent === 'Sposób wskazywania');
    const przyciski = Array.from(rzad.querySelectorAll('.sk-seg'));
    przyciski[1].click();                              // „Cwiartki"
    await new Promise(r => setTimeout(r, 200));
    const po = przyciski.map(b => b.classList.contains('sk-seg-wybrany'));
    przyciski[0].click();                               // z powrotem na „Pasy"
    await new Promise(r => setTimeout(r, 200));
    const wroc = przyciski.map(b => b.classList.contains('sk-seg-wybrany'));
    return { po, wroc };
  });
  sprawdz('klikniecie zapala TEN przycisk i gasi pozostale',
    JSON.stringify(klik.po) === JSON.stringify([false, true, false])
    && JSON.stringify(klik.wroc) === JSON.stringify([true, false, false]), klik);
  // CZARNY FILC ZE SCIEGIEM (decyzja D5, UX 2026-11-20): wybrany segment ma kolor --felt-ink,
  // kremowy napis i kremowa nitke, bo roz w aplikacji znaczy akcje glowna. Mierzymy PIKSELE,
  // nie nazwe klasy.
  const wyglad = await page.evaluate(() => {
    const b = document.querySelector('#scanFields .sk-seg-wybrany');
    const s = getComputedStyle(b), nic = getComputedStyle(b, '::after');
    const root = getComputedStyle(document.documentElement);
    return { tlo: s.backgroundColor, tekst: s.color, cien: s.boxShadow,
             nitka: nic.borderTopStyle + ' ' + nic.borderTopColor, wciecie: nic.inset || nic.top,
             wzor: root.getPropertyValue('--felt-ink').trim(), krem: root.getPropertyValue('--panel').trim() };
  });
  const doRgb = (hex) => {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
    return m ? 'rgb(' + parseInt(m[1], 16) + ', ' + parseInt(m[2], 16) + ', ' + parseInt(m[3], 16) + ')' : '';
  };
  sprawdz('wybrany przycisk to czarny filc (--felt-ink), nie roz', wyglad.tlo === doRgb(wyglad.wzor), wyglad);
  sprawdz('…ma kremowy napis (--panel) i twardy cien', wyglad.tekst === doRgb(wyglad.krem) && /rgb/.test(wyglad.cien), wyglad);
  sprawdz('…i ma scieg: kreskowana nitka WEWNATRZ krawedzi',
    /dashed/.test(wyglad.nitka) && /px/.test(String(wyglad.wciecie)), wyglad);
}

console.log('\n- po wybraniu pola: klik w srodek albo kolejny poziom');
// Po przejechaniu wiersza i kolumny skaner caly czas dzielil wybrane pole na mniejsze segmenty;
// uzytkownik ma wybrac miedzy „kolejny poziom szczegolu" a „kliknij na srodek wybranego".
// Pytanie jest teraz wyborem z dwoch zdan, a liczba poziomow schodzi na
// drugi plan i pokazuje sie dopiero przy „glebiej".
{
  const w = await page.evaluate(async () => {
    const spij = (ms) => new Promise(r => setTimeout(r, ms));
    const R = window.RFScanKarta;
    Object.assign(R.u, { tryb: 'cwiartki' });
    R.pola.odswiez(); await spij(150);
    const rzad = (nazwa) => Array.from(document.querySelectorAll('#scanFields .sk-wiersz'))
      .find(x => (x.querySelector('.sk-nazwa') || {}).textContent === nazwa);
    const widac = (nazwa) => { const x = rzad(nazwa); return !!x && !x.classList.contains('sk-ukryte'); };
    const wybor = rzad('Po wybraniu pola');
    const przyciski = wybor ? Array.from(wybor.querySelectorAll('.sk-seg')).map(b => b.textContent) : [];
    // 1. „Konicz na nim" → jeden poziom, suwak znika
    Array.from(wybor.querySelectorAll('.sk-seg'))[0].click(); await spij(200);
    const koniec = { poziomy: R.u.poziomyMax, suwak: widac('Ile poziomów szczegółu'),
                     prog: widac('Kończ, gdy pole zejdzie poniżej') };
    // 2. „Dodaj kolejny poziom szczegolu" → co najmniej dwa, suwak wraca
    Array.from(wybor.querySelectorAll('.sk-seg'))[1].click(); await spij(200);
    const glebiej = { poziomy: R.u.poziomyMax, suwak: widac('Ile poziomów szczegółu'),
                      zapalony: Array.from(wybor.querySelectorAll('.sk-seg'))
                        .map(b => b.classList.contains('sk-seg-wybrany')) };
    // 3. wieksza liczba poziomow nadal trzyma wybor na „glebiej" (pole czyta klucz, nie literal)
    R.u.poziomyMax = 6; R.pola.odswiez(); await spij(120);
    const szesc = Array.from(wybor.querySelectorAll('.sk-seg')).map(b => b.classList.contains('sk-seg-wybrany'));
    Object.assign(R.u, { tryb: 'pasy', poziomyMax: 4 }); R.pola.odswiez();
    return { przyciski, koniec, glebiej, szesc };
  });
  sprawdz('pole „Po wybraniu pola" mowi obiema drogami',
    w.przyciski.length === 2 && /Kończ na nim/.test(w.przyciski[0]) && /poziom szczegółu/.test(w.przyciski[1]), w.przyciski);
  sprawdz('„Kończ na nim" = jeden poziom i klik w srodek wybranego',
    w.koniec.poziomy === 1 && !w.koniec.suwak, w.koniec);
  sprawdz('…i chowa prog konca, ktory nie ma juz czego przycinac', !w.koniec.prog, w.koniec);
  sprawdz('„Dodaj kolejny poziom szczegolu" = co najmniej dwa poziomy, z liczba do wyboru',
    w.glebiej.poziomy >= 2 && w.glebiej.suwak
    && JSON.stringify(w.glebiej.zapalony) === JSON.stringify([false, true]), w.glebiej);
  sprawdz('szesc poziomow to nadal „glebiej", a nie zaden z dwoch',
    JSON.stringify(w.szesc) === JSON.stringify([false, true]), w.szesc);
}

console.log('\n- zapis ustawien');
await page.evaluate(() => {
  const s = document.querySelector('#scanFields .sk-wiersz:not(.sk-ukryte) .sk-suwak');
  s.value = String(Math.min(+s.max, +s.value + +s.step * 5));
  s.dispatchEvent(new Event('input', { bubbles: true }));
});
await spij(900);
sprawdz('zmiana pokretla poszla na serwer', await page.evaluate(async () => {
  const a = await (await fetch('/scan?dev=d0')).json();
  return typeof a.predkosc === 'number';
}));

/* ĆWIARTKI — dwa problemy naraz.
   (1) działały tylko lewa górna i prawa dolna — silnik liczył pola dobrze przez
       cały czas, ale scena rysowała je jedno POD drugim (wnuki warstwy zostawały w normalnym
       układzie), więc dwa wypadały poza ramkę. Dlatego test mierzy NARYSOWANE pole, nie stan.
   (2) na ostatniej ćwiartce można ustawić skanowanie góra/dół jak w pasach, ale wewnątrz niej. */
console.log('\n- cwiartki');
{
  const kolejnosc = await page.evaluate(async () => {
    const R = window.RFScanKarta;
    Object.assign(R.u, { tryb: 'cwiartki', poCwiartkach: 'klik', siatka: [2, 2], czasBloku: 300,
                         opoznienieStartu: 0, blokadaPoWyborze: 0, odbicie: 0 });
    R.silnik.ustawienia(R.u);
    const ramka = document.getElementById('scanStage').getBoundingClientRect();
    const b = document.getElementById('scanSignal');
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const rogi = [], t0 = performance.now();
    while (performance.now() - t0 < 2600) {
      const a = document.querySelector('.sk-scene-layer .sc-blok.sc-aktywny');
      if (a) {
        const r = a.getBoundingClientRect();
        const kod = (r.left - ramka.left < ramka.width / 4 ? 'L' : 'P')
                  + (r.top - ramka.top < ramka.height / 4 ? 'G' : 'D');
        if (rogi[rogi.length - 1] !== kod) rogi.push(kod);
      }
      await new Promise(r => setTimeout(r, 40));
    }
    document.getElementById('scanStop').click();
    return rogi;
  });
  const czwórka = kolejnosc.join('').includes('LGPGLDPD');
  sprawdz('pola zapalaja sie jak czytanie (LG-PG-LD-PD) i wszystkie sa widoczne', czwórka, kolejnosc);
}
{
  const w = await page.evaluate(async () => {
    const spij = (ms) => new Promise(r => setTimeout(r, ms));
    const R = window.RFScanKarta;
    Object.assign(R.u, { tryb: 'cwiartki', poCwiartkach: 'paski', poziomyMax: 1, siatka: [2, 2],
                         czasBloku: 400, opoznienieStartu: 0, blokadaPoWyborze: 0, odbicie: 0,
                         ruch: 'plynny', predkosc: 900, przebiegi: 1, kolejnosc: 'Y-X',
                         // bez postoju na krancu — inaczej pomiar ruchu nizej trafia w te 900 ms,
                         // w ktorych pasek stoi z premedytacja, i mierzy zero
                         pauzaNaKrancach: 0,
                         // ...i bez dociagania: przyciaga punkt do najblizszego celu nawet o 100 px,
                         // wiec przy JADACYM pasku (a nie stojacym w srodku pola, jak przed
                         // poprawka z 14.09) klikniecie potrafi wyladowac tuz za krawedzia pola.
                         // Tutaj mierzymy skaner, nie dociaganie — ono ma wlasny test nizej.
                         dociaganie: 0 });
    R.silnik.ustawienia(R.u);
    const sig = () => {
      const b = document.getElementById('scanSignal');
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    };
    sig(); await spij(800);
    sig(); await spij(250);                       // wybór ćwiartki
    const po = window._scanStanTestowy;
    const cw = { x: po.obszar.x, y: po.obszar.y, w: po.obszar.w, h: po.obszar.h };
    const maPasek = !!po.pasmo, maPola = !!(po.bloki && po.bloki.length);
    // CZY TEN PASEK W OGOLE JEDZIE. Objaw: „dojedz paskami" nie animowal paskow
    // — pasek BYL rysowany, ale mial grubosc liczona dla calego ekranu (170 px), wiec
    // zajmowal cale pole, `krokow` schodzilo do 1 i stal w miejscu. Mierzymy NARYSOWANY pasek:
    // rozstep jego gornych krawedzi przez pol sekundy.
    const gory = [];
    for (let i = 0; i < 12; i++) {
      const p = document.querySelector('.sk-scene-layer .sc-pasmo');
      if (p && p.style.display !== 'none') gory.push(Math.round(p.getBoundingClientRect().top));
      await spij(40);
    }
    const rozstep = gory.length ? Math.max(...gory) - Math.min(...gory) : 0;
    const wysokoscPaska = (() => { const p = document.querySelector('.sk-scene-layer .sc-pasmo');
      return p ? Math.round(p.getBoundingClientRect().height) : 0; })();
    sig(); await spij(350);                       // pasek Y
    sig(); await spij(450);                       // pasek X → koniec
    const kon = window._scanStanTestowy;
    return { cw, maPasek, maPola, rozstep, wysokoscPaska, faza: kon.faza,
             punkt: kon.punkt ? { x: kon.punkt.x, y: kon.punkt.y } : null };
  });
  sprawdz('po ostatniej cwiartce jedzie pasek, a pola gasna', w.maPasek && !w.maPola, w);
  sprawdz('pasek w ostatnim polu NAPRAWDE jedzie (rozstep > 1/5 pola)',
    w.rozstep > w.cw.h / 5, { rozstep: w.rozstep, poleH: Math.round(w.cw.h) });
  sprawdz('…i jest od tego pola cienszy, wiec ma po czym jechac',
    w.wysokoscPaska > 0 && w.wysokoscPaska <= w.cw.h / 2.9,
    { pasek: w.wysokoscPaska, poleH: Math.round(w.cw.h) });
  const wSrodku = w.punkt && w.punkt.x >= w.cw.x - 1 && w.punkt.x <= w.cw.x + w.cw.w + 1
                          && w.punkt.y >= w.cw.y - 1 && w.punkt.y <= w.cw.y + w.cw.h + 1;
  sprawdz('punkt konczy WEWNATRZ wybranej cwiartki', w.faza === 'gotowe' && wSrodku, w);
  await page.evaluate(() => {
    const R = window.RFScanKarta;
    Object.assign(R.u, { tryb: 'pasy', poCwiartkach: 'klik', poziomyMax: 4 });
    R.silnik.ustawienia(R.u);
  });
}

console.log('\n- podglad obszaru na postoju');
// Podglad ma sie aktualizowac po wybraniu lub wpisaniu wartosci, jako polprzezroczysta warstwa
// z mozliwoscia kontroli. Do tej pory
// obrys obszaru pokazywal sie WYLACZNIE w trakcie skanowania, wiec cztery liczby sekcji „Gdzie
// skaner ma dzialac" nie mialy zadnej odpowiedzi na ekranie. Mierzymy NARYSOWANY prostokat,
// bo to o jego widocznosc chodzi — stan silnika o niej nic nie mowi.
{
  const w = await page.evaluate(async () => {
    const spij = (ms) => new Promise(r => setTimeout(r, ms));
    const el = () => document.querySelector('.sk-scene-layer .sc-obszar');
    const widac = () => { const e = el(), r = e.getBoundingClientRect();
      return { x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height),
               tlo: getComputedStyle(e).backgroundColor, klasa: e.className }; };
    const klik = (t) => { const b = Array.from(document.querySelectorAll('#scanFields button'))
      .find(x => (x.textContent || '').trim() === t); if (b) b.click(); return !!b; };
    // „Caly pulpit" niczego nie zaweza, wiec plachty na cala ramke NIE MA (blysk ma zdazyc zgasnac).
    const bylCaly = klik('Cały pulpit'); await spij(1600);
    const caly = widac();
    // Gotowy ksztalt — najkrotsza droga do zawezonego obszaru.
    const bylWlasny = klik('Własny prostokąt'); await spij(250);
    const bylKsztalt = klik('Dolny pas'); await spij(400);
    const pas = widac();
    const ramka = document.getElementById('scanStage').getBoundingClientRect();
    await spij(1400);                                  // niech blysk zgasnie
    const przed = widac();
    // Liczba wpisana TA SAMA DROGA, co u czlowieka: pole „Od lewej" konczy sie zdarzeniem `change`.
    const inp = Array.from(document.querySelectorAll('#scanFields input.sk-liczba')).find(i => i._k === 'obszarX1');
    if (inp) { inp.value = '40'; inp.dispatchEvent(new Event('change', { bubbles: true })); }
    await spij(350);
    const po = widac();
    klik('Cały pulpit'); await spij(300);              // sprzatamy po sobie dla dalszych testow
    return { caly, pas, przed, po, bylCaly, bylWlasny, bylKsztalt, maInput: !!inp,
             ramka: { w: Math.round(ramka.width), h: Math.round(ramka.height) } };
  });
  sprawdz('„Caly pulpit": bez stalej plachty na cala ramke', w.caly.tlo === 'rgba(0, 0, 0, 0)', w.caly);
  sprawdz('zawezony obszar widac na postoju — obrys i polprzezroczyste wypelnienie',
    w.bylKsztalt && /sc-obszar-podglad/.test(w.pas.klasa) && w.pas.tlo !== 'rgba(0, 0, 0, 0)'
    && w.pas.h < w.ramka.h * 0.8, { pas: w.pas, ramka: w.ramka });
  sprawdz('wpisanie „Od lewej = 40" od razu przesuwa podglad', w.maInput && w.po.x > w.przed.x,
    { przed: w.przed, po: w.po });
  sprawdz('po zmianie obszaru leci blysk', /sc-obszar-blysk/.test(w.po.klasa), w.po.klasa);
}

console.log('\n- pasek stanu nie wchodzi na pasek modulu');
// Objaw: ciemny pasek
// „Czekam na sygnal" malowal po przyklejonym pasku modulu („Skaner · Triki 1 · Off · Konfiguracja").
// Dwa powody i oba widac dopiero w WEZSZYM oknie, bo tam pasek modulu zawija sie do dwoch rzedow:
//   1. `.sk-lewa` miala w CSS zgadywana wysokosc tego paska (`--topbar-h + 46px`), wiec podglad
//      parkowal ZA WYSOKO — od 14.09 po poludniu wysokosc paska jest MIERZONA raz dla calej
//      aplikacji (`rfWatchModHead` w rf-40) i stoi w `--rf-sticky-top`, z ktorej `.sk-lewa` czyta
//      swoj `top`; te sama liczbe zgadywaly osobno scena kola, podglad myszy i mapa kontrolera
//      (tests/sticky_modhead_harness.mjs pilnuje wszystkich czterech),
//   2. pasek stanu lezy na warstwie `fixed` i nie jest przycinany razem ze scena, wiec przy
//      podgladzie dosunietym pod pasek modulu i tak by na niego wjechal (naprawa: `widoczne.y`).
// Mierzymy w PIKSELACH: prostokat paska stanu kontra prostokat paska modulu.
{
  await page.setViewportSize({ width: 1366, height: 768 });
  await spij(600);
  const w = await page.evaluate(async () => {
    const spij = (ms) => new Promise(r => setTimeout(r, ms));
    const widoczny = (sel) => Array.from(document.querySelectorAll(sel))
      .find(n => n.offsetParent !== null && n.getBoundingClientRect().height > 0) || null;
    const rr = (n) => { if (!n) return null; const b = n.getBoundingClientRect();
      return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) }; };
    const pomiary = [];
    for (const s of [200, 900, 1500]) {
      window.scrollTo(0, s); await spij(450);
      pomiary.push({ scroll: s, hud: rr(document.getElementById('scanHud')),
                     glowa: rr(widoczny('.rfpc-head')) });
    }
    window.scrollTo(0, 0); await spij(300);
    return pomiary;
  });
  const kolizje = w.filter(p => p.glowa && p.hud && p.hud.y < p.glowa.b && p.hud.b > p.glowa.y
                                && p.hud.x < p.glowa.r && p.hud.r > p.glowa.x);
  sprawdz('pasek stanu zostaje POD paskiem modulu na kazdym przewinieciu', kolizje.length === 0, kolizje);
  sprawdz('pasek modulu w waskim oknie faktycznie sie zawija (inaczej test nic nie sprawdza)',
    w[1] && w[1].glowa && (w[1].glowa.b - w[1].glowa.y) > 50, w[1] && w[1].glowa);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await spij(500);
}

console.log('\n- przewijanie w srodku skanowania');
// Objaw: przy przewijaniu podglad najezdzal poza swoje okno (i nakladka, i informacja
// na gorze). Dwie przyczyny, obie
// mierzone TUTAJ — w pikselach NARYSOWANYCH elementow, nie w stanie silnika:
//   1. `obszar` silnika zostawal w starych wspolrzednych okna (naprawa w rf-50: `ustawEkran`),
//   2. scena i pasek stanu leza w <body> z `position:fixed`, wiec karta ich nie przycinala
//      (naprawa w rf-50d: `_scanPrzytnij`).
{
  const wynik = await page.evaluate(async () => {
    const spij = (ms) => new Promise(r => setTimeout(r, ms));
    const R = window.RFScanKarta;
    window.scrollTo(0, 0); await spij(200);
    Object.assign(R.u, { tryb: 'cwiartki', siatka: [2, 2], czasBloku: 600, opoznienieStartu: 0,
                         blokadaPoWyborze: 0, odbicie: 0, poziomyMax: 4, poCwiartkach: 'klik' });
    R.silnik.ustawienia(R.u);
    const sig = () => {
      const b = document.getElementById('scanSignal');
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    };
    sig(); await spij(500);
    sig(); await spij(200);                      // wybrana cwiartka — obszar jest juz zawezony
    window.scrollTo(0, 900); await spij(400);    // …i dopiero TERAZ strona jedzie
    const ramka = document.getElementById('scanStage').getBoundingClientRect();
    const poza = [];
    document.querySelectorAll('#scanSceneLayer *, #scanTargetsLayer *').forEach(n => {
      const b = n.getBoundingClientRect();
      if (!b.width || !b.height) return;
      // Slad po kliknieciu to kolko WOKOL punktu, wiec przy samej krawedzi legalnie z niej
      // wystaje (o tyle, ile jego promien) — malowanie i tak przycina `clip-path`. Pytamy wiec
      // o jego SRODEK: on ma siedziec w ramce, bo to on mowi, gdzie skaner kliknal.
      const slad = /sc-slad/.test(String(n.className));
      const t = slad ? (b.top + b.bottom) / 2 : b.top, d = slad ? (b.top + b.bottom) / 2 : b.bottom;
      const l = slad ? (b.left + b.right) / 2 : b.left, p = slad ? (b.left + b.right) / 2 : b.right;
      if (t < ramka.top - 1 || l < ramka.left - 1 || d > ramka.bottom + 1 || p > ramka.right + 1)
        poza.push({ k: String(n.className).slice(0, 18), y: Math.round(b.top), x: Math.round(b.left) });
    });
    const hud = document.getElementById('scanHud').getBoundingClientRect();
    // CIECIE MIERZONE W PIKSELACH OKNA, a nie sprawdzane na obecnosc: `inset()` liczy od krawedzi
    // pudla warstwy, wiec liczby trzeba do tego pudla dodac. To jedyny sposob, zeby test zauwazyl
    // pomylke o szerokosc paska przewijania (`innerWidth` go liczy, pudlo warstwy `fixed` juz nie).
    const w = document.getElementById('scanSceneLayer');
    const p = w.getBoundingClientRect();
    const l = (getComputedStyle(w).clipPath.match(/-?[\d.]+/g) || []).map(Number);
    const przyciete = l.length >= 4
      ? { t: Math.round(p.top + l[0]), r: Math.round(p.right - l[1]),
          b: Math.round(p.bottom - l[2]), l: Math.round(p.left + l[3]) } : null;
    document.getElementById('scanStop').click();
    window.scrollTo(0, 0); await spij(250);
    return { poza, przyciete,
             ramka: { t: Math.round(ramka.top), b: Math.round(ramka.bottom),
                      l: Math.round(ramka.left), r: Math.round(ramka.right) },
             hud: { t: Math.round(hud.top), b: Math.round(hud.bottom) } };
  });
  sprawdz('po przewinieciu scena rysuje WEWNATRZ ramki podgladu', wynik.poza.length === 0, wynik);
  // Do 16.09 stalo tu „pasek stanu zostaje w ramce" — teraz ma byc POD nia, takze w srodku
  // skanowania i po przewinieciu strony (wtedy ramka jest lepka, a pasek jedzie razem z nia).
  sprawdz('pasek stanu zostaje pod ramka takze w trakcie skanowania', wynik.hud.t >= wynik.ramka.b - 1, wynik);
  {
    const c = wynik.przyciete, r = wynik.ramka, blisko = (a, b) => Math.abs(a - b) <= 2;
    sprawdz('ciecie warstw pokrywa sie z widoczna czescia podgladu',
      !!c && blisko(c.l, r.l) && blisko(c.r, r.r) && blisko(c.t, r.t) && blisko(c.b, r.b), wynik);
  }
}

console.log('\n- zrzut');
await page.screenshot({ path: '_backups/260911-skaner/skaner-karta.png' });

console.log('\n- konsola');
sprawdz('zero bledow w konsoli', bledy.length === 0, bledy.slice(0, 6));

await przegladarka.close();
console.log('\n' + ok + ' passed, ' + zle + ' failed');
process.exit(zle ? 1 : 0);
