/* SKANER EKRANU — sekcja „Czym sterujesz skanerem" w prawdziwej przeglądarce.
   Uruchomienie: instancja testowa aplikacji, potem

     node tests/scan_signals_harness.mjs            (domyślnie 127.0.0.1:8791)
     RF_URL=http://127.0.0.1:8790/ node tests/scan_signals_harness.mjs

   Instancja MUSI iść z `--no-keys`: harness dokłada i kasuje reguły, a bez tej flagi część
   z nich naprawdę by coś nacisnęła.

   CZEGO TU PILNUJEMY, A CZEGO NIE PILNUJE `test_scan_signals.py`. Tamten test sprawdza LICZBY
   i silnik. Ten sprawdza to, czego z Pythona nie widać i co w tym module psuło się już dwa razy:
   czy narysowany element naprawdę jest, czy kliknięcie robi to, co obiecuje napis obok, i czy
   przejście do Mapowania zabiera ze sobą akcję. „Silnik liczy dobrze" nie znaczy „człowiek widzi
   dobrze" — ta lekcja kosztowała ten moduł dwa zgłoszenia (ćwiartki rysowane jedno pod drugim,
   pokrycie pasków zapisywane w niewłaściwej połowie konfiguracji). */
import { createRequire } from 'module';
import path from 'path';
const wymagaj = createRequire(import.meta.url);
const { rfBezPierwszegoStartu } = wymagaj("./_rf_pierwszy_start.cjs");   // bez pytania i zaproszenia pierwszego startu
const { chromium } = wymagaj(path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@playwright', 'test'));

const ADRES = process.env.RF_URL || 'http://127.0.0.1:8791/';
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
await spij(2500);

// JĘZYK JEST STANEM GLOBALNYM NA DYSKU, nie ustawieniem tej karty: wybór EN zapisuje się
// w Settings/ i wstrzykuje się KAŻDEMU kolejnemu klientowi, także świeżemu kontekstowi
// Playwrighta. Bez tego kroku harness wywraca się na asercji o polskim napisie, choć kod jest
// bez zarzutu. Zamiast zgadywać — wymuszamy PL i przywracamy wybór na końcu.
const jezykPrzed = await page.evaluate(() => (typeof _lang !== 'undefined' ? _lang : 'pl'));
if (jezykPrzed !== 'pl') { await page.evaluate(() => setLang('pl', false)); await spij(400); }

await page.click('[data-tab="skaner"]');
await spij(900);

// Reguły, które zastaliśmy — oddamy je co do sztuki na końcu.
const regulyPrzed = await page.evaluate(() => JSON.parse(JSON.stringify(state.rules || [])));

/* WSZYSTKO PONIZEJ IDZIE W `try`, A SPRZATANIE W `finally` — i nie jest to higiena dla higieny.
   Ten harness DOPISUJE reguly przez `commitRules()`, a to POST /rules, czyli zapis na dysk do tego
   samego `Settings/`, z ktorego czyta zwykla instancja aplikacji. Wyjatek w polowie (a kazdy
   `querySelector(...).click()` na nieistniejacym elemencie rzuca) zostawial uzytkownikowi zywa,
   WLACZONA regule „Moj przechyl testowy” wciskajaca spacje przy przechyleniu kapsla o 30° —
   w tym, co ma akurat na ekranie. Do tego wymuszony jezyk PL, bo `setLang` melduje sie serwerowi,
   a ten zapisuje wybor dla wszystkich kolejnych klientow. */
let bladTestu = null;
try {


console.log('\n- sekcja jest i mówi, co robi');
sprawdz('sekcja wyzwalaczy jest w karcie', await page.evaluate(() =>
  !!document.getElementById('scanSignals')));
sprawdz('nagłówek po polsku', (await page.evaluate(() =>
  (document.getElementById('scanSignalsTytul') || {}).textContent)) === 'Czym sterujesz skanerem');
sprawdz('wyjaśnienie mówi, skąd bierze się sygnał', await page.evaluate(() => {
  const t = (document.querySelector('#scanSignals .sk-wyzw-wstep') || {}).textContent || '';
  return /Mapowani/i.test(t) && /wyzwalacz/i.test(t);
}));
sprawdz('wyjaśnienie ostrzega o wspólnocie reguł z Mapowaniem', await page.evaluate(() => {
  const t = (document.querySelector('#scanSignals .sk-wyzw-uwaga') || {}).textContent || '';
  return /kasuje/i.test(t) && /cofn/i.test(t);
}));
sprawdz('są trzy pudełka ról', (await page.evaluate(() =>
  document.querySelectorAll('#scanSignals .sk-rola').length)) === 3);
sprawdz('każda rola mówi, po co jest', await page.evaluate(() =>
  Array.from(document.querySelectorAll('#scanSignals .sk-rola-cel'))
    .every(e => (e.textContent || '').trim().length > 8)));

// WIERSZ MA SIĘ MIEŚCIĆ. Sekcja nie miała do 12.09 ani jednej reguły CSS i rozjeżdżała się na
// trzy linijki w kolumnie 340 px — mierzymy PIKSELE, nie obecność klasy.
console.log('\n- układ');
/* MIERZYMY ZAWARTOSC, NIE POJEMNIK. `.sk-rola` to zwykly blok w kolumnie `flex: 0 0 340px`, wiec
   jego szerokosc Z DEFINICJI nie przekroczy rodzica — asercja na niej nie moze sie zaczerwienic,
   cokolwiek dzieje sie w srodku. Realna usterka, ktora ten pomiar ma lapac, to WYPYCHANIE
   zawartosci: dlugi opis warunku rozpycha wiersz i przyciski ✎ oraz ✕ wyjezdzaja poza karte,
   stajac sie nieklikalne. Dlatego pytamy o `scrollWidth` i o prawa krawedz przyciskow. */
sprawdz('pudełka ról mieszczą się w prawej kolumnie', await page.evaluate(() => {
  const kol = document.querySelector('.sk-prawa');
  if (!kol) return false;
  const prawa = kol.getBoundingClientRect().right;
  const wiersze = Array.from(document.querySelectorAll('#scanSignals .sk-sygnal'));
  const rozpychane = wiersze.filter(w => w.scrollWidth > w.clientWidth + 1);
  const wystajace = Array.from(document.querySelectorAll('#scanSignals .sk-sygnal-usun, #scanSignals .sk-sygnal-edyt'))
    .filter(b => b.getBoundingClientRect().right > prawa + 1);
  return rozpychane.length === 0 && wystajace.length === 0;
}), await page.evaluate(() => {
  const kol = document.querySelector('.sk-prawa');
  const prawa = kol ? kol.getBoundingClientRect().right : 0;
  return {
    prawaKolumny: Math.round(prawa),
    wiersze: Array.from(document.querySelectorAll('#scanSignals .sk-sygnal')).map(w => [w.scrollWidth, w.clientWidth]),
    przyciski: Array.from(document.querySelectorAll('#scanSignals .sk-sygnal-usun')).map(b => Math.round(b.getBoundingClientRect().right))
  };
}));

console.log('\n- drzwi ① gotowy ruch');
await page.evaluate(() => document.querySelector('#scanSignals .sk-rola .sk-rola-dodaj').click());
await spij(300);
sprawdz('panel dodawania się rozwinął', await page.evaluate(() =>
  !!document.querySelector('#scanSignals .sk-rola .sk-dodaj')));
sprawdz('są trzy drzwi', (await page.evaluate(() =>
  document.querySelectorAll('#scanSignals .sk-dodaj .sk-drzwi').length)) === 3);
sprawdz('lista ruchów nie ma nic wybranego z góry', (await page.evaluate(() =>
  document.querySelector('#scanSignals .sk-dodaj select').value)) === '');
// TO JEST SEDNO ZLECENIA: osoba, która nie naciśnie przycisku, ma zobaczyć SWOJE drogi jako
// pierwsze. Do 12.09 pierwszą i domyślną pozycją listy było „Puknięcie w kapsel".
sprawdz('pierwsza grupa to ruchy bez naciskania', await page.evaluate(() => {
  const g = document.querySelector('#scanSignals .sk-dodaj select optgroup');
  return !!g && /bez naciskania/i.test(g.label);
}), await page.evaluate(() => Array.from(document.querySelectorAll('#scanSignals .sk-dodaj select optgroup')).map(g => g.label)));
sprawdz('puknięcie siedzi w grupie „wymaga przycisku"', await page.evaluate(() => {
  const o = Array.from(document.querySelectorAll('#scanSignals .sk-dodaj select option')).find(x => x.value === 'tap');
  return !!o && /przycisk/i.test((o.parentNode || {}).label || '');
}));
sprawdz('katalog ma i przytrzymanie, i znieruchomienie', await page.evaluate(() => {
  const k = Array.from(document.querySelectorAll('#scanSignals .sk-dodaj select option')).map(o => o.value);
  return k.includes('hold-right') && k.includes('still') && k.includes('tilt-any');
}));
sprawdz('wybór ruchu pokazuje jego opis', await page.evaluate(async () => {
  const s = document.querySelector('#scanSignals .sk-dodaj select');
  const przed = document.querySelector('#scanSignals .sk-drzwi-opis').textContent;
  s.value = 'hold-right';
  s.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 120));
  const po = document.querySelector('#scanSignals .sk-drzwi-opis').textContent;
  return po !== przed && /wytrzymaj/i.test(po);
}));

const przedDodaniem = await page.evaluate(() => (state.rules || []).length);
/* KSZTALT REGULY MIERZYMY W TEJ SAMEJ CHWILI, W KTOREJ POWSTAJE — synchronicznie po kliknieciu,
   zanim serwer odesle echo. Wczesniejsza wersja czytala `state.rules` po dwoch przerwach, a w tym
   czasie `commitRules()` zdazylo wyslac POST /rules i odebrac z powrotem liste PO `sanitize_rules`.
   Sanityzator buduje slownik z zamknietej listy kluczy, wiec wszystkie pola sa tam ZAWSZE — test
   sprawdzal serwer, nie kod, ktory mial sprawdzac. Usuniecie pola z `_skanNowaRegula` przechodzilo
   bez zaczerwienienia, a uzytkownik dostawal regule z progiem 0, czyli sygnal przy kazdym drgnieciu. */
const swiezaRegula = await page.evaluate(() => {
  const s = document.querySelector('#scanSignals .sk-dodaj select');
  s.value = 'hold-right';
  s.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#scanSignals .sk-dodaj .sk-drzwi .btn').click();
  const r = (state.rules || []).slice(-1)[0] || {};
  const brakujace = ['id', 'label', 'enabled', 'source', 'abs', 'cmp', 'threshold', 'thresholdHi',
    'neg', 'extraConditions', 'match', 'layer', 'keySpec', 'sequence', 'noAction', 'behavior',
    'windowMs', 'crossings', 'dwellMs', 'intervalMs'].filter(k => r[k] === undefined);
  return { brakujace: brakujace, prog: r.threshold, zachowanie: r.behavior, dwell: r.dwellMs };
});
sprawdz('front buduje PELNA regule (nic nie jest undefined przed zapisem)',
  swiezaRegula.brakujace.length === 0, swiezaRegula.brakujace);
sprawdz('...z progiem i czasem z gotowca, nie z domyslnych',
  swiezaRegula.prog === 25 && swiezaRegula.zachowanie === 'dwell' && swiezaRegula.dwell === 1500,
  swiezaRegula);
await spij(900);
sprawdz('doszła dokładnie jedna reguła', (await page.evaluate(() => (state.rules || []).length)) === przedDodaniem + 1);
const nowa = await page.evaluate(() => (state.rules || []).slice(-1)[0]);
sprawdz('…z akcją sygnału skanera', nowa && nowa.keySpec === 'scan:sygnal', nowa && nowa.keySpec);
sprawdz('…z ruchem, nie z przyciskiem', nowa && nowa.source && nowa.source.kind === 'filter', nowa && nowa.source);
sprawdz('…i przezyla sanityzator serwera bez zmiany progu', await page.evaluate(() => {
  const r = (state.rules || []).slice(-1)[0] || {};
  return Number(r.threshold) === 25 && r.behavior === 'dwell' && Number(r.dwellMs) === 1500;
}), await page.evaluate(() => {
  const r = (state.rules || []).slice(-1)[0] || {};
  return [r.threshold, r.behavior, r.dwellMs];
}));
sprawdz('wiersz pokazał się w pudełku „Sygnał"', (await page.evaluate(() =>
  document.querySelectorAll('#scanSignals .sk-rola')[0].querySelectorAll('.sk-sygnal').length)) >= 1);
sprawdz('wiersz mówi, co to za ruch i jak działa', await page.evaluate(() => {
  const w = document.querySelector('#scanSignals .sk-sygnal');
  const n = (w.querySelector('.sk-sygnal-zrodlo') || {}).textContent || '';
  const j = (w.querySelector('.sk-sygnal-jak') || {}).textContent || '';
  return n.length > 3 && j.length > 3;
}), await page.evaluate(() => {
  const w = document.querySelector('#scanSignals .sk-sygnal');
  return [(w.querySelector('.sk-sygnal-zrodlo') || {}).textContent, (w.querySelector('.sk-sygnal-jak') || {}).textContent];
}));
sprawdz('panel dodawania zwinął się po dodaniu', await page.evaluate(() =>
  !document.querySelector('#scanSignals .sk-dodaj')));

console.log('\n- przełącznik wycisza, nie kasuje');
await page.evaluate(() => document.querySelector('#scanSignals .sk-sygnal .sk-przel').click());
await spij(400);
sprawdz('reguła została wyciszona, nie usunięta', await page.evaluate(() => {
  const r = (state.rules || []).find(x => /^scan-/.test(x.id));
  return !!r && r.enabled === false;
}));
sprawdz('przełącznik melduje stan czytnikowi ekranu', (await page.evaluate(() =>
  document.querySelector('#scanSignals .sk-sygnal .sk-przel').getAttribute('aria-checked'))) === 'false');
await page.evaluate(() => document.querySelector('#scanSignals .sk-sygnal .sk-przel').click());
await spij(400);
sprawdz('i z powrotem', await page.evaluate(() => {
  const r = (state.rules || []).find(x => /^scan-/.test(x.id));
  return !!r && r.enabled === true;
}));

console.log('\n- drzwi ② wyzwalacz, który już masz');
// Zakładamy wyzwalacz „swój" poza skanerem, żeby było co połączyć.
await page.evaluate(async () => {
  state.rules.push({
    id: 'harness-moj', label: 'Mój przechył testowy', enabled: true,
    source: { kind: 'filter', metric: 'roll' }, abs: false, cmp: '>', threshold: 30,
    thresholdHi: null, neg: false, extraConditions: [], match: 'all', layer: 0,
    keySpec: 'space', sequence: '', glow: true, noAction: false, behavior: 'once',
    windowMs: 600, crossings: 2, dwellMs: 500, intervalMs: 100
  });
  commitRules();
  await new Promise(r => setTimeout(r, 300));
  scanSignalsSync();
});
await spij(400);
await page.evaluate(() => document.querySelectorAll('#scanSignals .sk-rola-dodaj')[1].click());  // rola „Cofnij"
await spij(300);
sprawdz('drugie drzwi wymieniają istniejący wyzwalacz', await page.evaluate(() => {
  const sel = document.querySelectorAll('#scanSignals .sk-dodaj select')[1];
  return !!sel && Array.from(sel.options).some(o => o.textContent === 'Mój przechył testowy');
}), await page.evaluate(() => {
  const sel = document.querySelectorAll('#scanSignals .sk-dodaj select')[1];
  return sel ? Array.from(sel.options).map(o => o.textContent) : null;
}));
sprawdz('…i NIE wymieniają wyzwalaczy samego skanera', await page.evaluate(() => {
  const sel = document.querySelectorAll('#scanSignals .sk-dodaj select')[1];
  const scanIds = (state.rules || []).filter(r => /^scan:/.test(r.keySpec || '')).map(r => r.id);
  return !!sel && !Array.from(sel.options).some(o => scanIds.includes(o.value));
}));
sprawdz('drugie drzwi tłumaczą, że tamten wyzwalacz robi dalej swoje', await page.evaluate(() => {
  const t = document.querySelectorAll('#scanSignals .sk-drzwi')[1].textContent || '';
  return /dalej robi swoje|robi swoje/i.test(t);
}));
await page.evaluate(async () => {
  const drzwi = document.querySelectorAll('#scanSignals .sk-dodaj .sk-drzwi')[1];
  const sel = drzwi.querySelector('select');
  sel.value = (state.rules || []).find(r => r.id === 'harness-moj').id;
  drzwi.querySelector('.btn').click();
  await new Promise(r => setTimeout(r, 400));
});
await spij(500);
const polaczona = await page.evaluate(() => (state.rules || []).filter(r => r.keySpec === 'scan:cofnij').slice(-1)[0]);
sprawdz('połączenie stworzyło regułę „za tamtym wyzwalaczem"',
  !!polaczona && polaczona.source && polaczona.source.kind === 'trigger' && polaczona.source.ref === 'harness-moj',
  polaczona && polaczona.source);
sprawdz('…i tamten wyzwalacz został nietknięty', await page.evaluate(() => {
  const r = (state.rules || []).find(x => x.id === 'harness-moj');
  return !!r && r.keySpec === 'space' && r.enabled === true;
}));
sprawdz('…a wiersz nazywa go po imieniu', await page.evaluate(() => {
  const box = document.querySelectorAll('#scanSignals .sk-rola')[1];
  const n = (box.querySelector('.sk-sygnal-zrodlo') || {}).textContent || '';
  return /Mój przechył testowy/.test(n);
}), await page.evaluate(() => {
  const box = document.querySelectorAll('#scanSignals .sk-rola')[1];
  return (box.querySelector('.sk-sygnal-zrodlo') || {}).textContent;
}));

console.log('\n- drzwi ③ przeniesienie do Mapowania');
await page.evaluate(() => document.querySelectorAll('#scanSignals .sk-rola-dodaj')[2].click());   // rola „Zatrzymaj"
await spij(300);
await page.evaluate(async () => {
  const drzwi = document.querySelectorAll('#scanSignals .sk-dodaj .sk-drzwi')[2];
  drzwi.querySelector('.btn').click();
  await new Promise(r => setTimeout(r, 600));
});
await spij(700);
sprawdz('jesteśmy w Mapowaniu', await page.evaluate(() => {
  const k = document.getElementById('trigCard');
  return !!(k && k.offsetParent !== null);
}));
sprawdz('edytor jest otwarty', await page.evaluate(() => {
  const e = document.getElementById('ruleEditor');
  return !!e && getComputedStyle(e).display !== 'none';
}));
// Kontroler POŻYCZA sobie ten jeden element edytora do własnej kolumny. Gdyby ktoś był tam przed
// nami, edytor otworzyłby się w cudzej zakładce i to wyglądałoby jak martwe kliknięcie.
sprawdz('edytor wrócił do karty Mapowania', await page.evaluate(() => {
  const e = document.getElementById('ruleEditor'), k = document.getElementById('trigCard');
  return !!(e && k && k.contains(e));
}));
sprawdz('nowy wyzwalacz jest już wycelowany w „zatrzymaj skaner"',
  (await page.evaluate(() => (state._draft || {}).keySpec)) === 'scan:stop',
  await page.evaluate(() => (state._draft || {}).keySpec));
sprawdz('…i liczy się jako szkic nietknięty (aplikacja wpisała akcję, nie człowiek)',
  await page.evaluate(() => JSON.stringify(state._draft) === state._draftBase));
// Porzucamy szkic, żeby nie pytał przy następnym otwarciu.
await page.evaluate(() => { if (typeof closeEditor === 'function') closeEditor(); });
await spij(300);

console.log('\n- ✎ otwiera TEN wyzwalacz');
await page.click('[data-tab="skaner"]');
await spij(600);
const idDoEdycji = await page.evaluate(() => {
  const w = document.querySelector('#scanSignals .sk-rola .sk-sygnal');
  w.querySelector('.sk-sygnal-edyt').click();
  return (state.rules || []).find(r => r.keySpec === 'scan:sygnal').id;
});
await spij(800);
sprawdz('edytor otworzył się na wskazanej regule',
  (await page.evaluate(() => (state._draft || {}).id)) === idDoEdycji,
  [await page.evaluate(() => (state._draft || {}).id), idDoEdycji]);
await page.evaluate(() => { if (typeof closeEditor === 'function') closeEditor(); });
await spij(300);

console.log('\n- sygnał z kapsla działa WIĘCEJ NIŻ RAZ');
// Regresja z 12.09: karta wołała `_scanDol()` bez `_scanGora()`, więc `silnik.wcisniete` nigdy
// się nie zerowało i każdy kolejny sygnał odbijał się o „juz-wcisniete". Objaw: „kapsel zadziałał
// raz i przestał" — czyli dokładnie to, co człowiek zobaczyłby przy pierwszym teście wyzwalacza.
await page.click('[data-tab="skaner"]');
await spij(700);
const wielokrotny = await page.evaluate(async () => {
  const wyniki = [];
  for (let i = 0; i < 3; i++) {
    scanSignalArrived({ t: 'scan', co: 'sygnal' });
    await new Promise(r => setTimeout(r, 220));
    wyniki.push({ wcisniete: !!(_SCAN.silnik && _SCAN.silnik.wcisniete), faza: _SCAN.silnik && _SCAN.silnik.faza });
  }
  scanSignalArrived({ t: 'scan', co: 'stop' });
  return wyniki;
});
sprawdz('po każdym sygnale kapsel jest „puszczony"',
  wielokrotny.every(w => w.wcisniete === false), wielokrotny);
sprawdz('skaner naprawdę ruszył (nie stoi w spoczynku)',
  wielokrotny.some(w => w.faza && w.faza !== 'spoczynek'), wielokrotny);

console.log('\n- sygnał cudzego kapsla nie steruje tym podglądem');
const obcy = await page.evaluate(async () => {
  const przed = _SCAN.silnik.faza;
  scanSignalArrived({ t: 'scan', co: 'sygnal', dev: 'na-pewno-nie-ten-kapsel' });
  await new Promise(r => setTimeout(r, 250));
  return { przed, po: _SCAN.silnik.faza };
});
sprawdz('sygnał z innego kapsla jest pomijany', obcy.przed === obcy.po, obcy);

console.log('\n- ✕ kasuje: zwykly przypadek i ten jeden, w ktorym pytamy');

// PRZYPADEK 1: jest wiecej niz jeden sposob na sygnal, wiec kasowanie idzie bez pytania —
// z prawdziwym przyciskiem cofniecia. Asercja celuje w ELEMENT `.rss-act`, a nie w tekst strony:
// slowo „cofnij" stoi w sekcji na stale (pudelko roli „Cofnij", zdanie wstepu), wiec szukanie go
// w `document.body.textContent` przechodzilo ZAWSZE — takze gdyby cofniecia w ogole nie bylo.
await page.evaluate(async () => {
  document.querySelector('#scanSignals .sk-rola .sk-rola-dodaj').click();
  await new Promise(r => setTimeout(r, 200));
  const sel = document.querySelector('#scanSignals .sk-dodaj select');
  sel.value = 'nod'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#scanSignals .sk-dodaj .sk-drzwi .btn').click();
  await new Promise(r => setTimeout(r, 500));
});
await spij(600);
const sygnalowPrzed = await page.evaluate(() =>
  (state.rules || []).filter(r => String(r.keySpec || '').toLowerCase() === 'scan:sygnal').length);
sprawdz('sa dwa sposoby na sygnal', sygnalowPrzed >= 2, sygnalowPrzed);

const idDoKasacji = await page.evaluate(() => {
  const box = document.querySelectorAll('#scanSignals .sk-rola')[0];
  const w = box.querySelectorAll('.sk-sygnal')[0];
  const fk = w.querySelector('.sk-sygnal-usun').dataset.fk || '';
  w.querySelector('.sk-sygnal-usun').click();
  return fk.replace(/^usun:/, '');
});
await spij(700);
sprawdz('regula zniknela bez pytania', await page.evaluate((id) =>
  !(state.rules || []).some(r => r.id === id), idDoKasacji));
sprawdz('...i pojawil sie PRZYCISK cofniecia, nie samo slowo', await page.evaluate(() => {
  const b = document.querySelector('.rss-bubble .rss-act');
  return !!b && /cofnij/i.test(b.textContent || '');
}), await page.evaluate(() => {
  const b = document.querySelector('.rss-bubble .rss-act');
  return b ? b.textContent : null;
}));

// PRZYPADEK 2: zostal JEDEN, wiec kasowanie pyta. Powod jest wprost dostepnosciowy — komu skaner
// jest jedyna droga do komputera, ten po skasowaniu ostatniego sygnalu nie ma czym kliknac
// w bableku cofniecia. Sprawdzamy, ze pytanie pada I ze „Zostaw" naprawde zostawia.
await page.evaluate(() => {
  const box = document.querySelectorAll('#scanSignals .sk-rola')[0];
  box.querySelector('.sk-sygnal .sk-sygnal-usun').click();
});
await spij(500);
sprawdz('przy ostatnim sposobie na sygnal pada pytanie', await page.evaluate(() =>
  !!document.querySelector('.rfm-card')));
sprawdz('...i mowi, czym to grozi', await page.evaluate(() => {
  const m = document.querySelector('.rfm-msg');
  return !!m && /jedyny spos/i.test(m.textContent || '');
}), await page.evaluate(() => {
  const m = document.querySelector('.rfm-msg');
  return m ? m.textContent : null;
}));
const ostatniPrzed = await page.evaluate(() =>
  (state.rules || []).filter(r => String(r.keySpec || '').toLowerCase() === 'scan:sygnal').length);
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('.rfm-card .rfm-btn'))
    .find(x => /zostaw|keep/i.test(x.textContent || ''));
  if (b) b.click();
});
await spij(600);
sprawdz('„Zostaw" naprawde zostawia', (await page.evaluate(() =>
  (state.rules || []).filter(r => String(r.keySpec || '').toLowerCase() === 'scan:sygnal').length)) === ostatniPrzed);

console.log('\n- wyzwalacz martwy jest oznaczony');
await page.evaluate(async () => {
  const r = (state.rules || []).find(x => String(x.keySpec || '').toLowerCase() === 'scan:sygnal');
  r.enabled = false;
  commitRules();
  await new Promise(r2 => setTimeout(r2, 400));
  scanSignalsSync();
});
await spij(400);
sprawdz('wyciszony wyzwalacz mowi o tym w wierszu', await page.evaluate(() => {
  const j = document.querySelector('#scanSignals .sk-sygnal .sk-sygnal-jak');
  return !!j && /wyciszony/i.test(j.textContent || '');
}), await page.evaluate(() => {
  const j = document.querySelector('#scanSignals .sk-sygnal .sk-sygnal-jak');
  return j ? j.textContent : null;
}));
await page.evaluate(async () => {
  const r = (state.rules || []).find(x => String(x.keySpec || '').toLowerCase() === 'scan:sygnal');
  r.enabled = true; commitRules();
  await new Promise(r2 => setTimeout(r2, 300));
});
await spij(400);

console.log('\n- strumien odswieza sekcje, a wybor w panelu to przezywa');
// Hak `scanSignalsOnRules` (rf-08) jest jedyna droga, ktora pokazuje zmiane zrobiona GDZIE INDZIEJ
// — i po ktorej wraca wyzwalacz przywrocony przez „Cofnij". Panel dodawania zostaje otwarty,
// bo wybor z rozwijakow zyje poza DOM i ma przezyc przerysowanie.
await page.evaluate(async () => {
  document.querySelectorAll('#scanSignals .sk-rola-dodaj')[0].click();
  await new Promise(r => setTimeout(r, 200));
  const sel = document.querySelector('#scanSignals .sk-dodaj select');
  sel.value = 'still'; sel.dispatchEvent(new Event('change', { bubbles: true }));
});
await spij(300);
await page.evaluate(async () => {
  state.rules.push({
    id: 'harness-zewnatrz', label: 'Dopisany poza sekcja', enabled: true,
    source: { kind: 'filter', metric: 'twist' }, abs: false, cmp: '>', threshold: 200,
    thresholdHi: null, neg: false, extraConditions: [], match: 'all', layer: 0,
    keySpec: 'scan:stop', sequence: '', glow: true, noAction: false, behavior: 'once',
    windowMs: 600, crossings: 2, dwellMs: 500, intervalMs: 100
  });
  scanSignalsOnRules();
  await new Promise(r => setTimeout(r, 200));
});
await spij(300);
sprawdz('zmiana z zewnatrz pojawila sie w sekcji', await page.evaluate(() => {
  const box = document.querySelectorAll('#scanSignals .sk-rola')[2];
  return /Dopisany poza sekcja/.test(box.textContent || '');
}));
sprawdz('...a wybor w otwartym panelu przezyl przerysowanie', (await page.evaluate(() => {
  const sel = document.querySelector('#scanSignals .sk-dodaj select');
  return sel ? sel.value : null;
})) === 'still');
await page.evaluate(() => {
  const i = (state.rules || []).findIndex(r => r.id === 'harness-zewnatrz');
  if (i >= 0) state.rules.splice(i, 1);
  _skanDodajDo = null;
  scanSignalsSync();
});
await spij(300);

console.log('\n- angielski: sekcja tlumaczy sie CALA, razem z katalogiem');
// Cena swiadomej rezygnacji z kluczy I18N to jedna linia w `setLang` (rf-01). Nic jej nie chroni
// poza ta asercja — a katalog gotowcow do 12.09 byl w niej wyjatkiem i zostawal po polsku.
await page.evaluate(() => setLang('en', false));
await spij(600);
sprawdz('naglowek po angielsku', (await page.evaluate(() =>
  (document.getElementById('scanSignalsTytul') || {}).textContent)) === 'What drives the scanner');
sprawdz('role po angielsku', await page.evaluate(() => {
  const t = document.querySelector('#scanSignals .sk-rola-nazwa');
  return !!t && /Signal/i.test(t.textContent || '');
}));
sprawdz('katalog gotowcow po angielsku', await page.evaluate(async () => {
  document.querySelectorAll('#scanSignals .sk-rola-dodaj')[0].click();
  await new Promise(r => setTimeout(r, 250));
  const opts = Array.from(document.querySelectorAll('#scanSignals .sk-dodaj select option'))
    .map(o => o.textContent);
  const grupy = Array.from(document.querySelectorAll('#scanSignals .sk-dodaj select optgroup'))
    .map(g => g.label);
  return opts.some(t => /A held lean to the right/.test(t))
    && opts.some(t => /Going still/.test(t))
    && grupy.some(t => /nothing to press/i.test(t));
}), await page.evaluate(() => Array.from(document.querySelectorAll('#scanSignals .sk-dodaj select option')).map(o => o.textContent)));
await page.evaluate(() => { _skanDodajDo = null; scanSignalsSync(); setLang('pl', false); });
await spij(500);

} catch (e) {
  bladTestu = e;
} finally {
  console.log('\n- porzadki');
  // Oddajemy liste regul co do sztuki — harness nie ma prawa zostawic po sobie konfiguracji.
  // To musi sie wykonac TAKZE po wyjatku, dlatego stoi w `finally`, a nie na koncu skryptu.
  try {
    await page.evaluate(async (poprzednie) => {
      if (typeof state === 'undefined') return;
      state.rules = JSON.parse(JSON.stringify(poprzednie));
      if (typeof commitRules === 'function') commitRules();
      await new Promise(r => setTimeout(r, 500));
    }, regulyPrzed);
    await spij(600);
    sprawdz('reguly wrocily do stanu sprzed testu', await page.evaluate((poprzednie) =>
      JSON.stringify(state.rules) === JSON.stringify(poprzednie), regulyPrzed));
    // Szkic w edytorze tez jest stanem: zostawiony, przy nastepnym otwarciu wywola pytanie
    // „Porzucic niezapisany wyzwalacz?”, ktorego nikt sie nie spodziewa.
    await page.evaluate(() => { if (typeof closeEditor === 'function') { try { closeEditor(); } catch (e) { } } });
    if (jezykPrzed !== 'pl') { await page.evaluate((jp) => setLang(jp, false), jezykPrzed); await spij(300); }
  } catch (e2) {
    console.log('  ZLE  sprzatanie sie nie powiodlo -> ' + (e2 && e2.message));
    zle++;
  }

  console.log('\n- konsola');
  sprawdz('zero bledow w konsoli', bledy.length === 0, bledy.slice(0, 6));

  await przegladarka.close();
  if (bladTestu) { console.log('\nWYJATEK: ' + (bladTestu.stack || bladTestu.message)); zle++; }
  console.log('\n' + ok + ' OK, ' + zle + ' ZLE');
  process.exit(zle ? 1 : 0);
}
