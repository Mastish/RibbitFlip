/* MODUŁY WYŁĄCZONE PRZY STARCIE (--disable / --only) — panel w prawdziwej przeglądarce, headless.
   Uruchomienie: instancja testowa aplikacji z parametrami modułów, potem

     RF_URL=http://127.0.0.1:8791/ RF_OFF=kolo,skaner,midi node tests/moduly_startowe_smoke.mjs

   Zwykle woła go tests/test_moduly_startowe.py dla kilku kombinacji (sam stawia kopie aplikacji).
   RF_OFF to lista, której oczekujemy po stronie panelu (już z zależnościami); pusta = nic nie wyłączone.

   Co sprawdza: panel dostał tę samą listę wyłączonych, co serwer (window.RIBBITFLIP_MODULES), zakładek
   wyłączonych modułów nie ma w nawigacji, a pozostałe są; link RibbitBeat tylko przy włączonej grze;
   macierz „Modułów” bez kolumn wyłączonych; po przejściu przez KAŻDĄ widoczną zakładkę (PL i EN) żadne
   żądanie sieciowe nie poszło na trasę wyłączonego modułu, a konsola nie ma ani jednego błędu.
   Kod wyjścia: 0 = wszystko OK, 1 = coś źle, 2 = instancja niedostępna. */
import { createRequire } from 'module';
import path from 'path';
const wymagaj = createRequire(import.meta.url);
const { rfBezPierwszegoStartu } = wymagaj("./_rf_pierwszy_start.cjs");   // bez pytania i zaproszenia pierwszego startu
const { chromium } = wymagaj(path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@playwright', 'test'));

const ADRES = process.env.RF_URL || 'http://127.0.0.1:8790/';
const OCZEKIWANE = (process.env.RF_OFF || '').split(',').map(s => s.trim()).filter(Boolean).sort();
const ZRODLO = process.env.RF_SRC || '';          // skąd serwer wziął listę: cli / env / file / ''
const RESTART = (process.env.RF_RESTART || '').trim();   // moduł do wyłączenia kliknięciem i restartem
// Zakładka panelu każdego modułu (APP_MODULES w ribbitflip_monitor.py); moduły bez zakładki mają kartę.
const ZAKLADKA = { kolo: 'kolo', mysz: 'mysz', kontroler: 'kontroler', skaner: 'skaner', midi: 'midi', osc: 'osc',
  uslugi: 'restapi', synth: 'pad', nakladka: 'wszystkie' };
const KOLUMNA = { kolo: 'wheel', midi: 'midi', osc: 'osc', uslugi: 'rest', synth: 'sound' };
let ok = 0, zle = 0;
const spij = (ms) => new Promise(r => setTimeout(r, ms));
function sprawdz(nazwa, warunek, dodatek) {
  if (warunek) { ok++; console.log('  OK   ' + nazwa); }
  else { zle++; console.log('  ZLE  ' + nazwa + (dodatek !== undefined ? '  -> ' + JSON.stringify(dodatek) : '')); }
}

const przegladarka = await chromium.launch({ headless: true });
const page = await (await rfBezPierwszegoStartu(przegladarka.newContext({ viewport: { width: 1440, height: 900 } }))).newPage();
const bledy = [], zadania = [];
page.on('console', m => { if (m.type() === 'error') bledy.push(m.text()); });
page.on('pageerror', e => bledy.push('pageerror: ' + e.message));
page.on('request', r => zadania.push(r.url()));
try {
  await page.goto(ADRES, { waitUntil: 'domcontentloaded', timeout: 15000 });
} catch (e) {
  console.log('  ZLE  instancja niedostepna: ' + ADRES);
  await przegladarka.close();
  process.exit(2);
}
await page.waitForSelector('#rfApp', { timeout: 15000 });
await spij(2500);

console.log('--- ' + ADRES + '  oczekiwane wylaczone: ' + (OCZEKIWANE.join(',') || '(nic)'));
// RF_RESTART=<moduł>: pełna droga z karty. Klik w przełącznik, „Uruchom ponownie”, strona wraca sama
// po restarcie serwera i ten moduł jest już wyłączony (bez zakładki). Potem koniec, bez reszty sprawdzeń.
if (RESTART) {
  await page.evaluate(() => window.setTabById('ustawienia'));
  await page.evaluate(() => { const c = document.getElementById('modsOffCard'); if (c) c.open = true; });   // zwijak „Start programu”
  await page.waitForSelector('#modsTg-' + RESTART, { timeout: 8000 });
  await page.click('#modsTg-' + RESTART);
  await page.waitForFunction(() => !document.getElementById('modsOffRestart').disabled, null, { timeout: 5000 }).catch(() => { });
  const gotowy = await page.evaluate(() => !document.getElementById('modsOffRestart').disabled);
  sprawdz('restart: po kliknieciu przelacznika przycisk Uruchom ponownie aktywny', gotowy);
  await Promise.all([page.waitForEvent('load', { timeout: 45000 }).catch(() => null), page.click('#modsOffRestart')]);
  bledy.length = 0;   // przerwa w połączeniu na czas restartu to nie błąd strony
  await page.waitForFunction((m) => window.rfModsOff && window.rfModsOff().includes(m), RESTART, { timeout: 30000 }).catch(() => { });
  await page.waitForSelector('#rfApp', { timeout: 15000 }).catch(() => { });
  await spij(2000);
  const po = await page.evaluate((m) => ({ off: window.rfModsOff ? window.rfModsOff() : null,
    tab: Array.from(document.querySelectorAll('.tab-btn[data-tab]')).filter(b => b.offsetParent !== null).map(b => b.dataset.tab),
    tg: (document.getElementById('modsTg-' + m) || {}).getAttribute ? document.getElementById('modsTg-' + m).getAttribute('aria-checked') : null,
    btn: (document.getElementById('modsOffRestart') || {}).disabled }), RESTART);
  sprawdz('restart: strona wrocila sama, modul wylaczony w tym uruchomieniu', Array.isArray(po.off) && po.off.includes(RESTART), po.off);
  sprawdz('restart: zakladka modulu schowana', !po.tab.includes(ZAKLADKA[RESTART] || RESTART), po.tab);
  sprawdz('restart: karta pokazuje wybor i nic nie czeka', po.tg === 'false' && po.btn === true, po);
  sprawdz('restart: konsola bez bledow', bledy.length === 0, bledy.slice(0, 8));
  await przegladarka.close();
  console.log(`${ok} passed, ${zle} failed`);
  process.exit(zle ? 1 : 0);
}
const off = await page.evaluate(() => (window.rfModsOff ? window.rfModsOff() : null));
sprawdz('panel zna liste wylaczonych modulow i jest ona taka jak oczekiwana',
  Array.isArray(off) && JSON.stringify([...off].sort()) === JSON.stringify(OCZEKIWANE), off);

const zakladki = await page.evaluate(() => Array.from(document.querySelectorAll('.tab-btn[data-tab]'))
  .filter(b => b.offsetParent !== null).map(b => b.dataset.tab));
for (const [mod, tab] of Object.entries(ZAKLADKA)) {
  const wyl = OCZEKIWANE.includes(mod);
  sprawdz(`zakladka ${tab} (${mod}) ${wyl ? 'schowana' : 'widoczna'}`, zakladki.includes(tab) === !wyl, zakladki);
}
for (const stala of ['mapowanie', 'konfiguracje', 'ustawienia', 'czujnik', 'polaczenie']) {
  sprawdz(`zakladka podstawowa ${stala} widoczna`, zakladki.includes(stala), zakladki);
}
const gra = await page.evaluate(() => !!document.getElementById('rfNavGra'));
sprawdz(`link RibbitBeat ${OCZEKIWANE.includes('gra') ? 'nie powstaje' : 'jest'}`, gra === !OCZEKIWANE.includes('gra'));
const gs = await page.evaluate(() => !!document.getElementById('gsCard'));
sprawdz(`karta Auto-zestawy ${OCZEKIWANE.includes('autozestawy') ? 'nie powstaje' : 'jest'}`, gs === !OCZEKIWANE.includes('autozestawy'));
const kolumny = await page.evaluate(() => (typeof DM_COLS !== 'undefined') ? DM_COLS.map(c => c.key) : null);
for (const [mod, key] of Object.entries(KOLUMNA)) {
  const wyl = OCZEKIWANE.includes(mod);
  sprawdz(`macierz Modulow: kolumna ${key} ${wyl ? 'bez' : 'z'}`, Array.isArray(kolumny) && kolumny.includes(key) === !wyl, kolumny);
}
// Biblioteka w Zestawach: bez szuflad modułów wyłączonych (preset myszy znika dopiero z Kontrolerem).
const szuflady = await page.evaluate(() => (typeof RFL_KINDS !== 'undefined') ? RFL_KINDS.map(x => x.k) : null);
// Presety „MIDI i OSC” czytają obie zakładki, więc ta szuflada znika dopiero bez obu.
for (const [mod, lib] of Object.entries({ kolo: 'wheel', skaner: 'scan', midi: 'midi', uslugi: 'rest', synth: 'synth', nakladka: 'overlay' })) {
  const wyl = OCZEKIWANE.includes(mod) && (mod !== 'midi' || OCZEKIWANE.includes('osc'));
  sprawdz(`biblioteka: szuflada ${lib} ${wyl ? 'schowana' : 'jest'}`, Array.isArray(szuflady) && szuflady.includes(lib) === !wyl, szuflady);
}
const ruch = !(OCZEKIWANE.includes('mysz') && OCZEKIWANE.includes('kontroler'));
sprawdz(`macierz Modulow: kolumna mouse ${ruch ? 'z' : 'bez'}`, Array.isArray(kolumny) && kolumny.includes('mouse') === ruch, kolumny);
sprawdz(`biblioteka: szuflada mouse ${ruch ? 'jest' : 'schowana'}`, Array.isArray(szuflady) && szuflady.includes('mouse') === ruch, szuflady);

// Przejście przez każdą widoczną zakładkę, w obu językach: inity i wejścia w zakładki pytają serwer.
for (const jezyk of ['pl', 'en']) {
  if (jezyk === 'en') await page.evaluate(() => { try { setLang('en'); } catch (e) { } });
  for (const t of zakladki) {
    await page.evaluate((id) => { try { window.setTabById(id); } catch (e) { } }, t);
    await spij(450);
  }
}
// Zwijak „Start programu” (Ustawienia): jest ZAWSZE, po angielsku, wiersz na moduł
// z przełącznikiem. Przełączniki pokazują NASTĘPNY start (plik), notka o pierwszeństwie tylko przy parametrze.
const karta = await page.evaluate(() => {
  const c = document.getElementById('modsOffCard');
  if (!c) return null;
  return { h: ((c.querySelector('summary') || {}).firstChild || {}).textContent.trim(),
           wiersze: Array.from(c.querySelectorAll('[data-row]')).map(r => r.dataset.row),
           wyl: Array.from(c.querySelectorAll('.rf-toggle[role=switch]')).filter(t => t.getAttribute('aria-checked') === 'false')
             .map(t => t.id.replace('modsTg-', '')).sort(),
           dis: Array.from(c.querySelectorAll('.rf-toggle.dis')).map(t => t.id.replace('modsTg-', '')),
           nazwy: Array.from(c.querySelectorAll('b[data-mod]')).map(x => x.textContent),
           lock: c.querySelector('#modsOffLock').style.display !== 'none',
           restart: c.querySelector('#modsOffRestart').disabled,
           kolo: (c.querySelector('[data-row="kolo"]') || {}).textContent || '',
           pill: c.querySelector('#modsOffPill').textContent };
});
sprawdz('karta "Start programu" jest zawsze i mowi po angielsku',
  karta && karta.h === 'Program start' && karta.nazwy.every(n => !/[ąćęłńóśźż]/i.test(n)), karta);
if (karta) {
  sprawdz('karta: wiersz z przelacznikiem na kazdy modul tej edycji', karta.wiersze.length >= 10 && karta.wiersze.includes('skaner'), karta.wiersze);
  // Przełączniki rysują następny start z serwera (plik), także gdy teraz wygrywa parametr.
  const zPliku = await page.evaluate(async () => (await (await fetch('/modules/startup')).json()).next);
  sprawdz('przelaczniki pokazuja nastepny start (' + (zPliku.join(',') || 'nic') + ')', JSON.stringify(karta.wyl) === JSON.stringify(zPliku), karta.wyl);
  if (ZRODLO === 'file') sprawdz('przy wyborze z panelu nastepny start = to uruchomienie', JSON.stringify(zPliku) === JSON.stringify(OCZEKIWANE), zPliku);
  sprawdz('notka o pierwszenstwie parametru ' + (['cli', 'env'].includes(ZRODLO) ? 'widoczna' : 'schowana'),
    karta.lock === ['cli', 'env'].includes(ZRODLO), karta.lock);
  sprawdz('przycisk Restart wylaczony, gdy nic nie czeka', karta.restart === true, karta.pill);
  if (zPliku.includes('nakladka')) {
    sprawdz('kolo: przelacznik zablokowany i zdanie o Nakladce', karta.dis.includes('kolo') && /switches off together with the module\s*Overlay/.test(karta.kolo), karta);
  } else {
    sprawdz('kolo: zaleznosc od Nakladki pokazana wprost', /needs:\s*Overlay/.test(karta.kolo), karta.kolo);
  }
}
// Kliknięcie przełącznika zapisuje wybór (pill i przycisk), drugie przywraca; plik wraca do stanu sprzed testu.
if (karta && !['cli', 'env'].includes(ZRODLO)) {
  await page.evaluate(() => window.setTabById('ustawienia'));
  // „Start programu” to zwijak (UX 261120 L4c): przełączniki widać dopiero po rozwinięciu.
  await page.evaluate(() => { const c = document.getElementById('modsOffCard'); if (c) c.open = true; });
  await page.click('#modsTg-midi');
  await page.waitForFunction(() => !document.getElementById('modsOffRestart').disabled, null, { timeout: 5000 }).catch(() => { });
  const po = await page.evaluate(() => ({ r: document.getElementById('modsOffRestart').disabled,
    p: document.getElementById('modsOffPill').textContent, a: document.getElementById('modsTg-midi').getAttribute('aria-checked') }));
  sprawdz('klik w MIDI: zapisane, przycisk Restart aktywny', po.r === false && po.a === 'false' && po.p === 'The change takes effect after a restart', po);
  await page.click('#modsTg-midi');
  await page.waitForFunction(() => document.getElementById('modsOffRestart').disabled, null, { timeout: 5000 }).catch(() => { });
  const wr = await page.evaluate(() => document.getElementById('modsTg-midi').getAttribute('aria-checked'));
  sprawdz('drugi klik przywraca MIDI i nic nie czeka', wr === 'true', wr);
}
await page.evaluate(() => { try { setLang('pl'); window.setTabById('mapowanie'); } catch (e) { } });
await spij(300);
{
  const pl = await page.evaluate(() => Array.from(document.querySelectorAll('#modsOffCard b[data-mod]'))
    .map(x => [x.textContent, window.RIBBITFLIP_MODULES.names[x.dataset.mod][0]]));
  sprawdz('po powrocie do polskiego nazwy modulow po polsku', pl.length > 0 && pl.every(([a, b]) => a === b), pl.slice(0, 3));
}
await spij(800);

const zablokowane = await page.evaluate((L) => L.filter(u => window.rfModBlocking && window.rfModBlocking(u)), zadania);
sprawdz('zadne zadanie sieciowe nie poszlo na trase wylaczonego modulu', zablokowane.length === 0, zablokowane.slice(0, 8));
// Bramka w przeglądarce odpowiada sama, tak jak serwer (404 + JSON z powodem), i nie wychodzi do sieci.
if (OCZEKIWANE.length) {
  const zMod = OCZEKIWANE.find(m => ['kolo', 'skaner', 'uslugi', 'synth', 'nakladka', 'autozestawy'].includes(m));
  if (zMod) {
    const trasa = { kolo: '/wheel', skaner: '/scan', uslugi: '/rest/config', synth: '/synth', nakladka: '/overlay', autozestawy: '/gameswitch' }[zMod];
    const przed = zadania.length;
    const odp = await page.evaluate(async (u) => { const r = await fetch(u); return { s: r.status, j: await r.json() }; }, trasa);
    sprawdz(`bramka fetch: ${trasa} -> 404 z modulem ${zMod}, bez wyjscia do sieci`,
      odp.s === 404 && odp.j.disabled === true && odp.j.module === zMod && !zadania.slice(przed).some(u => u.includes(trasa)), odp);
  }
}
// SPÓJNOŚĆ (2026-10-16): edytor reguł nie proponuje akcji wyłączonych modułów, reguła z taką akcją
// zostaje na liście Mapowania z plakietką, a podgląd zestawu mówi, które jego części czekają na restart.
// Reguły wstawiane tylko do pamięci panelu (bez zapisu), po sprawdzeniu lista wraca do stanu sprzed.
{
  const padOff = OCZEKIWANE.includes('kontroler'), scanOff = OCZEKIWANE.includes('skaner');
  await page.evaluate(() => { try { window.setTabById('mapowanie'); } catch (e) { } });
  const ed = await page.evaluate(async () => {
    const R = (id, spec, seq) => ({ id, label: id, enabled: true, source: { kind: 'button', any: true }, abs: false, cmp: '>',
      threshold: 0, extraConditions: [], behavior: 'once', keySpec: spec, sequence: seq || '', layer: 0 });
    const was = state.rules;
    state.rules = was.concat([R('smk_pad', 'pad:a'), R('smk_scan', '', 'wait 50; scan:sygnal')]);
    renderRules();
    const row = id => { const w = document.querySelector('#rulesList .rule-wrap[data-id="' + id + '"]');
      return w ? { tag: !!w.querySelector('.rmodoff'), dim: w.querySelector('.rule').classList.contains('rule-modoff') } : null; };
    const out = { pad: row('smk_pad'), scan: row('smk_scan') };
    _openEditorNow(R('smk_pad', 'pad:a'));
    const opts = Array.from(document.querySelectorAll('#edQuick option')).map(o => o.value);
    out.padOpts = opts.filter(v => /^pad:/.test(v)); out.scanOpts = opts.filter(v => /^scan:/.test(v));
    out.selLabel = (document.querySelector('#edQuick option:checked') || {}).textContent || '';
    const note = document.getElementById('edPadNote'); out.note = note && note.style.display !== 'none' ? note.textContent : '';
    closeEditor(); state._draft = null; state.editing = null;
    state.rules = was; renderRules();
    const a = await (await fetch('/setup/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { rules: [R('smk_pad', 'pad:a')], scan: { enabled: true } } }) })).json();
    const box = document.createElement('div'); box.innerHTML = rfModsOffSetupHtml(a.modulesOff);
    out.box = box.textContent; out.mods = (a.modulesOff || []).map(m => m.module);
    return out;
  });
  sprawdz(`Mapowanie: regula pad: ${padOff ? 'na liscie z plakietka' : 'w zakladce Kontroler, bez plakietki'}`,
    padOff ? (ed.pad && ed.pad.tag && ed.pad.dim) : ed.pad === null, ed.pad);
  sprawdz(`Mapowanie: regula z makrem scan: ${scanOff ? 'z plakietka' : 'bez plakietki'}`,
    ed.scan && ed.scan.tag === scanOff, ed.scan);
  sprawdz(`edytor: przyciski pada ${padOff ? 'tylko wybrany, z dopiskiem' : 'wszystkie na liscie'}`,
    padOff ? (ed.padOpts.length === 1 && /wyłączony przy starcie/.test(ed.selLabel)) : ed.padOpts.length > 10, ed);
  sprawdz(`edytor: sygnaly skanera ${scanOff ? 'nie oferowane' : 'oferowane'}`, (ed.scanOpts.length === 0) === scanOff, ed.scanOpts);
  sprawdz(`edytor: notka pod akcja ${padOff ? 'mowi o wylaczonym Kontrolerze' : 'nie mowi o module'}`,
    padOff ? /Kontroler wyłączono przy starcie/.test(ed.note) : !/przy starcie/.test(ed.note), ed.note);
  const want = ['kontroler', 'skaner'].filter(m => OCZEKIWANE.includes(m));
  sprawdz(`podglad zestawu: czesci dla ${want.join(',') || '(nic)'}${want.length ? ' i zdanie o restarcie' : ''}`,
    JSON.stringify(ed.mods) === JSON.stringify(want) && (want.length ? /nie zadziałają/.test(ed.box) : ed.box === ''), ed);
}
sprawdz('konsola bez bledow', bledy.length === 0, bledy.slice(0, 8));

await przegladarka.close();
console.log(`${ok} passed, ${zle} failed`);
process.exit(zle ? 1 : 0);
