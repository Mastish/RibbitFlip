/* SKANER EKRANU — biblioteka nazwanych konfiguracji i sekcja „Co daje sygnał".
   Uruchomienie: instancja testowa aplikacji na 8790, potem

     node tests/scan_library_harness.mjs

   Sprawdzamy dwie rzeczy zgłoszone 11.09: że konfigurację DA SIĘ zapisać pod nazwą i wczytać
   z powrotem (razem z zakładkami modułu, których skaner jako jedyny nie miał), oraz że da się
   wybrać, JAKIE ruchy kapsla wyzwalają skaner. */
import { createRequire } from 'module';
import path from 'path';
const wymagaj = createRequire(import.meta.url);
const { rfBezPierwszegoStartu } = wymagaj("./_rf_pierwszy_start.cjs");   // bez pytania i zaproszenia pierwszego startu
const { chromium } = wymagaj(path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@playwright', 'test'));

const ADRES = process.env.RF_URL || 'http://127.0.0.1:8790/';
const NAZWA = 'Test biblioteki skanera';
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
await page.goto(ADRES, { waitUntil: 'domcontentloaded' });
await spij(2600);
await page.click('[data-tab="skaner"]');
await spij(1200);

/* MIGAWKA REGUL. Ten harness dopisuje regule z akcja skanera, a sprzatanie na koncu kasowalo
   WSZYSTKIE reguly `scan:` — nie tylko swoja. Dla uzytkownika, ktory ma skonfigurowane trzy
   wyzwalacze skanera, uruchomienie tego testu na tej samej instalacji (Settings/ jest wspolne)
   znaczylo utrate jedynej drogi sterowania, bez toastu i bez cofniecia. Test raportowal 30 OK.
   Teraz oddajemy dokladnie to, co zastalismy. */
const regulyPrzed = await page.evaluate(() => JSON.parse(JSON.stringify(state.rules || [])));

// Sprzątanie po poprzednim przebiegu — test nie ma prawa zależeć od tego, co zostawił poprzedni.
await page.evaluate(async (n) => {
  await fetch('/scan-preset/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n }) });
  await loadScanPresets();
}, NAZWA);
await spij(400);

console.log('\n- zakladki modulu (skaner byl jedynym modulem bez nich)');
const zakl = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#tab-skaner [role="tab"], #tab-skaner .rfpc-tab')).map(n => (n.textContent || '').trim()));
sprawdz('sa trzy zakladki modulu', zakl.length >= 3, zakl);
sprawdz('pierwsza to Konfiguracja', /Konfiguracja|Configuration/.test(zakl[0] || ''), zakl[0]);
sprawdz('jest Biblioteka', zakl.some(t => /Biblioteka|Library/.test(t)), zakl);

console.log('\n- zapis konfiguracji pod nazwa');
const zapis = await page.evaluate(async (n) => {
  const R = window.RFScanKarta;
  R.u.predkosc = 1234;                  // znacznik, po ktorym poznamy, ze wrocila TA konfiguracja
  R.u.pasmoY = 77;
  await new Promise((res) => SCAN_CFG_ADAPTER.saveAs(n, res, 'opis z testu'));
  await new Promise(r => setTimeout(r, 400));
  return {
    ile: (state.scanPresets || []).length,
    wpis: (state.scanPresets || []).find(p => p.name === n) || null
  };
}, NAZWA);
sprawdz('preset pojawil sie na liscie', !!zapis.wpis, zapis);
sprawdz('preset niesie konfiguracje', !!(zapis.wpis && zapis.wpis.config && zapis.wpis.config.predkosc === 1234), zapis.wpis && zapis.wpis.config && zapis.wpis.config.predkosc);
sprawdz('preset niesie opis autora', (zapis.wpis || {}).desc === 'opis z testu', (zapis.wpis || {}).desc);
sprawdz('preset NIE niesie wlacznika modulu', !!(zapis.wpis && !('enabled' in zapis.wpis.config)), Object.keys((zapis.wpis || {}).config || {}).filter(k => k === 'enabled'));

const naDysku = await (await page.request.get(ADRES + 'scan-presets')).json();
sprawdz('serwer widzi ten sam preset', (naDysku.presets || []).indexOf(NAZWA) >= 0, naDysku.presets);

console.log('\n- wczytanie z powrotem');
const wczyt = await page.evaluate(async (n) => {
  const R = window.RFScanKarta;
  R.u.predkosc = 300;                   // przestawiamy, zeby bylo widac, ze wczytanie dziala
  R.u.pasmoY = 200;
  const p = SCAN_CFG_ADAPTER.findPreset(n);
  await new Promise((res) => SCAN_CFG_ADAPTER.applyPreset(p, res));
  await new Promise(r => setTimeout(r, 400));
  return { predkosc: R.u.predkosc, pasmo: R.u.pasmoY, nazwa: R.u.configName };
}, NAZWA);
sprawdz('wczytanie przywrocilo predkosc', wczyt.predkosc === 1234, wczyt);
sprawdz('…i szerokosc pasma', wczyt.pasmo === 77, wczyt);
sprawdz('kapsel nosi teraz nazwe presetu', wczyt.nazwa === NAZWA, wczyt);

console.log('\n- odcisk mowi „zmienione" dopiero po zmianie');
const odcisk = await page.evaluate(async (n) => {
  const R = window.RFScanKarta;
  const p = SCAN_CFG_ADAPTER.findPreset(n);
  const rowne = SCAN_CFG_ADAPTER.fingerprintCurrent() === SCAN_CFG_ADAPTER.fingerprintPreset(p);
  R.u.predkosc = 999;
  const poZmianie = SCAN_CFG_ADAPTER.fingerprintCurrent() === SCAN_CFG_ADAPTER.fingerprintPreset(p);
  return { rowne, poZmianie };
}, NAZWA);
sprawdz('zaraz po wczytaniu odcisk sie zgadza', odcisk.rowne === true, odcisk);
sprawdz('po przekreceniu pokretla juz nie', odcisk.poZmianie === false, odcisk);

console.log('\n- usuniecie');
const poUsunieciu = await page.evaluate(async (n) => {
  await new Promise((res) => SCAN_CFG_ADAPTER.deletePreset(n, res));
  await loadScanPresets();
  await new Promise(r => setTimeout(r, 300));
  return (state.scanPresets || []).some(p => p.name === n);
}, NAZWA);
sprawdz('preset znikl z listy', poUsunieciu === false);

console.log('\n- co daje sygnal');
sprawdz('sekcja jest w karcie', await page.evaluate(() => !!document.getElementById('scanSignals')));
// UWAGA: do 12.09 sekcja byla JEDNYM rozwijakiem `#scanSignalSrc`, ktorego pierwsza i domyslna
// pozycja bylo „Puknięcie w kapsel" — i ten harness tego pilnowal. Nowe wymaganie odwrocilo
// te zasade: sekcja jest dla kogos, kto przycisku nacisnac NIE MOZE, wiec nic nie jest wybrane
// z gory, a ruchy bez naciskania stoja w pierwszej grupie. Pelny klik-through nowej sekcji ma
// wlasny plik (scan_signals_harness.mjs); tu zostaje tylko to, co dotyczy biblioteki: ze dodanie
// wyzwalacza tworzy zwykla regule Mapowania, a nie zapis w presecie skanera.
await page.evaluate(() => document.querySelector('#scanSignals .sk-rola .sk-rola-dodaj').click());
await spij(300);
const zrodla = await page.evaluate(() => {
  const s = document.querySelector('#scanSignals .sk-dodaj select');
  return { opcje: Array.from(s.options).map(o => o.textContent), wybrane: s.value,
           grupy: Array.from(s.querySelectorAll('optgroup')).map(g => g.label) };
});
sprawdz('nic nie jest wybrane z gory', zrodla.wybrane === '', zrodla.wybrane);
sprawdz('pierwsza grupa to ruchy bez naciskania', /bez naciskania/i.test(zrodla.grupy[0] || ''), zrodla.grupy);
sprawdz('sa tez odchylenia', zrodla.opcje.some(t => /Przechylenie/.test(t)), zrodla.opcje);
sprawdz('sa tez gesty z reszty aplikacji', zrodla.opcje.some(t => /Potrząśnięcie|Potrzasniecie/.test(t)), zrodla.opcje);

const przedDodaniem = await page.evaluate(() => (state.rules || []).filter(r => /^scan:/.test(r.keySpec || '')).length);
await page.evaluate(() => {
  const s = document.querySelector('#scanSignals .sk-dodaj select');
  s.value = 'tap';
  s.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#scanSignals .sk-dodaj .sk-drzwi .btn').click();
});
await spij(700);
const regula = await page.evaluate(() => {
  const r = (state.rules || []).filter(x => /^scan:/.test(x.keySpec || ''));
  return { ile: r.length, ostatnia: r[r.length - 1] || null };
});
sprawdz('dodanie tworzy regule w Mapowaniu', regula.ile === przedDodaniem + 1, regula.ile);
sprawdz('regula ma akcje skanera', /^scan:/.test((regula.ostatnia || {}).keySpec || ''), (regula.ostatnia || {}).keySpec);
sprawdz('regula stoi na przycisku kapsla', ((regula.ostatnia || {}).source || {}).kind === 'button', (regula.ostatnia || {}).source);
sprawdz('regula jest wlaczona', (regula.ostatnia || {}).enabled === true);
{
  // ⚠️ KARTA POKAZUJE TRZY ROLE (sygnal / cofnij / stop), a nie wszystko, co zaczyna sie od
  // `scan:`. Od 13.09 istnieje czwarty rodzaj reguly — `scan:sekcja=N`, ktora PRZELACZA sekcje
  // skanera i zadnej roli nie obsadza (niesie ja np. zestaw „Sol Cesto"). Porownanie z liczba
  // WSZYSTKICH regul `scan:` upadalo wiec nie na kodzie, tylko na tym, co akurat lezy
  // w ustawieniach instancji testowej.
  const wKarcie = await page.evaluate(() => document.querySelectorAll('#scanSignals .sk-sygnal').length);
  const wRolach = await page.evaluate(() => (state.rules || []).filter(x =>
    /^scan:(sygnal|cofnij|stop)$/i.test(String(x.keySpec || '').trim())).length);
  sprawdz('lista w karcie pokazuje wszystkie reguly trzech rol', wKarcie === wRolach,
    { wKarcie, wRolach, wszystkieScan: regula.ile, spec: (regula.ostatnia || {}).keySpec });
}

// Sprzatanie: kasujemy regule prosto ze stanu, zeby nie zostawiac smiecia w Mapowaniu.
await page.evaluate((poprzednie) => {
  state.rules = JSON.parse(JSON.stringify(poprzednie));
  if (typeof commitRules === 'function') commitRules();
}, regulyPrzed);
await spij(400);

/* ZESTAWY Z APLIKACJI SA POZYCJAMI TEJ LISTY (11.09) — nie paskiem pod podgladem.
   Plus dwie rzeczy, ktore przy tej zmianie realnie sie zepsuly:
     • przycisk „Przywroc zestawy z aplikacji" gubil sie przy kazdym przerysowaniu listy,
       bo stopke czysci `paintFoot` (stad `footBtn` w MODS, a nie dokladanie z zewnatrz),
     • scena, cele treningu i pasek stanu zostawaly NA EKRANIE po wejsciu w Biblioteke —
       leza w <body> z `position:fixed`, wiec schowanie karty ich nie dotyczy. */
console.log('\n- zestawy z aplikacji w bibliotece');
await page.locator('.rfpc-tab:visible', { hasText: 'Biblioteka' }).first().click();
await spij(900);
{
  const nazwy = await page.evaluate(() => (state.scanPresets || []).map(p => p.name));
  const maja = ['Ostrożny', 'Zrównoważony', 'Ćwiartki'].filter(n => nazwy.indexOf(n) >= 0);
  sprawdz('zestawy z aplikacji sa na liscie', maja.length === 3, nazwy);
  sprawdz('przycisk „Przywroc zestawy" jest w stopce',
    await page.evaluate(() => !!document.getElementById('scanRestoreSets')));
  // przerysowanie listy (wyszukiwanie) nie moze go zgubic
  await page.fill('#rfpcQ-skaner', 'ostro');
  await spij(500);
  await page.fill('#rfpcQ-skaner', '');
  await spij(500);
  sprawdz('…i zostaje po przerysowaniu listy',
    await page.evaluate(() => !!document.getElementById('scanRestoreSets')));
  const warstwy = await page.evaluate(() => ['scanSceneLayer', 'scanTargetsLayer', 'scanHud']
    .map(id => { const n = document.getElementById(id); return n ? getComputedStyle(n).display : 'brak'; }));
  sprawdz('scena i pasek stanu gasna poza zakladka Konfiguracja',
    warstwy.every(d => d === 'none'), warstwy);
  await page.locator('.rfpc-tab:visible', { hasText: 'Konfiguracja' }).first().click();
  await spij(700);
  const wracaja = await page.evaluate(() => ['scanSceneLayer', 'scanTargetsLayer', 'scanHud']
    .map(id => { const n = document.getElementById(id); return n ? getComputedStyle(n).display : 'brak'; }));
  sprawdz('…i wracaja po powrocie do niej', wracaja.every(d => d !== 'none'), wracaja);
}

/* KROPKA PRZY MODULE MA MOWIC LUDZKIM JEZYKIEM (zgloszenie 14.09: „chcialbym, zeby
   bylo to zrozumiale dla uzytkownika koncowego, bo jest to kryptyczne").
   Mierzymy TRESC dymka w obu stanach — nazwa konfiguracji, zdanie o tym, ze nic nie przepadlo,
   i przycisk, ktory to zalatwia. Stan „duch" robimy tak, jak robi go zycie: kapsel nosi nazwe,
   ktorej nie ma na liscie (po skasowaniu presetu albo po wczytaniu cudzego zestawu). */
console.log('\n- kropka „niezapisane zmiany" mowi, co robic');
{
  const nazwaDucha = 'Wieczór z Sol Cesto';
  const dymek = async () => await page.evaluate(() => {
    const n = document.querySelector('.tab-btn[data-tab="skaner"] .rf-dirty');
    return n ? { kl: n.className, txt: n.getAttribute('data-rftip') || n.title || '',
                 aria: n.getAttribute('aria-label') || '' } : null;
  });
  const przed = await page.evaluate(async () => {
    const j = await (await fetch('/scan?dev=d0')).json();
    return (j.config || j).configName || '';
  });
  // 1. DUCH — nazwa, ktorej nie ma na liscie
  await page.evaluate(async (nm) => {
    const j = await (await fetch('/scan?dev=d0')).json();
    const c = j.config || j; c.configName = nm;
    await fetch('/scan?dev=d0', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
    if (typeof scanLoad === 'function') await scanLoad('d0');
    await new Promise(r => setTimeout(r, 500));
    try { _rfpc.paintAll(); } catch (e) { }
  }, nazwaDucha);
  await spij(700);
  {
    const d = await dymek();
    sprawdz('duch: kropka jest pierscieniem (is-gone), nie zwykla kropka',
      !!d && /is-gone/.test(d.kl), d);
    sprawdz('duch: dymek nazywa konfiguracje po imieniu',
      !!d && d.txt.indexOf(nazwaDucha) >= 0, d && d.txt);
    sprawdz('duch: dymek mowi, ze nic nie przepadlo',
      !!d && /nic nie przepadło/.test(d.txt), d && d.txt);
    sprawdz('duch: dymek wskazuje przycisk i miejsce',
      !!d && /Zapisz z powrotem/.test(d.txt) && /Konfiguracji/.test(d.txt), d && d.txt);
    sprawdz('duch: to samo slyszy czytnik ekranu', !!d && d.aria === d.txt, d);
    sprawdz('duch: stare, kryptyczne zdanie zniklo',
      !!d && !/zniknęła z listy/.test(d.txt), d && d.txt);
  }
  // 2. ZMIENIONE — nazwa Z listy plus jedno pokretlo ruszone
  await page.evaluate(() => new Promise(r => {
    SCAN_CFG_ADAPTER.applyPresetOn('d0', { name: 'Ostrożny' }, async () => {
      await new Promise(x => setTimeout(x, 1500));
      window.RFScanKarta.u.predkosc = 480;
      if (typeof scanSave === 'function') scanSave();
      await new Promise(x => setTimeout(x, 1300));
      try { _rfpc.paintAll(); } catch (e) { }
      r(1);
    });
  }));
  await spij(500);
  {
    const d = await dymek();
    sprawdz('zmienione: kropka jest pelna (bursztyn), nie pierscieniem',
      !!d && /rf-dirty/.test(d.kl) && !/is-gone/.test(d.kl), d);
    sprawdz('zmienione: dymek nazywa konfiguracje i mowi o starszej wersji',
      !!d && d.txt.indexOf('Ostrożny') >= 0 && /starsza wersja/.test(d.txt), d && d.txt);
    sprawdz('zmienione: dymek wskazuje „Zapisz zmiany" u gory Konfiguracji',
      !!d && /Zapisz zmiany/.test(d.txt) && /Konfiguracji/.test(d.txt), d && d.txt);
  }
  // 3. PO ZAPISANIU kropki nie ma w ogole
  await page.evaluate(() => new Promise(r => {
    SCAN_CFG_ADAPTER.applyPresetOn('d0', { name: 'Ostrożny' }, async () => {
      await new Promise(x => setTimeout(x, 1800));
      try { _rfpc.paintAll(); } catch (e) { }
      r(1);
    });
  }));
  await spij(500);
  sprawdz('zgodne z zapisem = zadnej kropki', (await dymek()) === null, await dymek());
  // Sprzatanie: oddajemy kapslowi nazwe, ktora nosil przed testem.
  await page.evaluate(async (nm) => {
    const j = await (await fetch('/scan?dev=d0')).json();
    const c = j.config || j; c.configName = nm;
    await fetch('/scan?dev=d0', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
    if (typeof scanLoad === 'function') await scanLoad('d0');
  }, przed);
  await spij(400);
}

console.log('\n- konsola');
sprawdz('zero bledow w konsoli', bledy.length === 0, bledy.slice(0, 6));

await przegladarka.close();
console.log('\n' + ok + ' passed, ' + zle + ' failed');
process.exit(zle ? 1 : 0);
