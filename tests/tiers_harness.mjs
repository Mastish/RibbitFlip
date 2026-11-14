/* PIĘTRA WIDOCZNOŚCI (rfTier, web/js/rf-28d-tiers.js) w prawdziwej przeglądarce, bez instancji.
   Uruchomienie: node tests/tiers_harness.mjs   (woła go też tests/test_tiers.py)

   Strona jest składana na miejscu: arkusz 08-felt-components.css, rf-06-modals.js (rfFold, rfUndo)
   i rf-28d-tiers.js, a w niej wzorcowe zwijaki. Bąbel czaszki (rfToast) jest zaślepką, która
   tylko zapamiętuje przycisk „Cofnij”, żeby test mógł go nacisnąć.

   Sprawdza to, czego pilnuje reguła „chowanie nie może chować stanu”: nagłówek zwiniętego
   zwijaka mówi bieżące wartości i liczbę zmian, „Przywróć domyślne” jest tylko z funkcją modułu
   i da się cofnąć, zwijak ze zmianami nie otwiera się sam, a „Rozwijaj wszystkie ustawienia”
   otwiera zwijaki bez nadpisywania ich pamięci. */
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const wymagaj = createRequire(import.meta.url);
const { rfBezPierwszegoStartu } = wymagaj("./_rf_pierwszy_start.cjs");   // bez pytania i zaproszenia pierwszego startu
let chromium;
for (const p of [path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@playwright', 'test'), '@playwright/test']) {
  try { ({ chromium } = wymagaj(p)); break; } catch (e) { }
}
if (!chromium) { console.log('SKIP  brak @playwright/test'); console.log('0 passed, 0 failed'); process.exit(0); }

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const czytaj = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
let ok = 0, zle = 0;
function sprawdz(nazwa, warunek, dodatek) {
  if (warunek) { ok++; console.log('PASS  ' + nazwa); }
  else { zle++; console.log('FAIL  ' + nazwa + (dodatek !== undefined ? '  -> ' + JSON.stringify(dodatek) : '')); }
}

const WZOR = `
<div style="width:520px">
<details class="cardfold inset" id="f1"><summary>Wzór</summary><div class="cardfold-body">
  <label class="fld">Czułość <input id="c1" type="range" min="0" max="2" step="0.5" value="1" data-def=""><span class="vnum" id="c1v">1,0×</span></label>
  <label class="rf-swrow"><input type="checkbox" class="rf-swi" id="c2" data-def="0"><span class="rf-swrow-tx">Odwróć<small>opis pod spodem</small></span></label>
  <label class="fld">Tryb <select id="c3" data-def="a"><option value="a">🎯 Alfa (pierwszy)</option><option value="b">Beta</option></select></label>
  <div class="seg" id="c4" aria-label="Klik" data-def="l"><button type="button" class="on" data-v="l">Lewy</button><button type="button" data-v="r">Prawy</button></div>
  <label class="fld" id="c5w" style="display:none">Ukryte <input id="c5" type="number" value="7" data-def="1"></label>
</div></details>
<details class="cardfold inset" id="f2"><summary>Bez resetu</summary><div class="cardfold-body">
  <label class="fld">Opóźnienie <input id="d1" type="number" value="3" data-def="3"></label></div></details>
<details class="cardfold inset" id="f3"><summary>Długi</summary><div class="cardfold-body">
  <label class="fld">Pierwsza bardzo długa nazwa <input id="e1" type="number" value="111"></label>
  <label class="fld">Druga bardzo długa nazwa <input id="e2" type="number" value="222"></label>
  <label class="fld">Trzecia bardzo długa nazwa <input id="e3" type="number" value="333"></label></div></details>
<details class="cardfold adv" id="f4"><summary>Zaawansowane</summary><div class="cardfold-body">
  <label class="fld">Surowe <input id="g1" type="number" value="5" data-def="5"></label></div></details>
<details class="cardfold inset" id="f5"><summary>Pamięć</summary><div class="cardfold-body">x</div></details>
</div>`;

const przegladarka = await chromium.launch({ headless: true });
const page = await (await rfBezPierwszegoStartu(przegladarka.newContext({ viewport: { width: 900, height: 900 } }))).newPage();
const bledy = [];
page.on('pageerror', e => bledy.push(e.message));
// Strona pod własnym adresem (nie about:blank), bo localStorage potrzebuje prawdziwego pochodzenia.
await page.route('http://rf-tiers.test/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
  body: '<!doctype html><html lang="pl"><head><meta charset="utf-8"></head><body>' + WZOR + '</body></html>' }));
await page.goto('http://rf-tiers.test/');
await page.addStyleTag({ content: czytaj('web/css/01-assets-tokens.css') + czytaj('web/css/08-felt-components.css') });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); window._lang = 'pl'; });
await page.addScriptTag({ content: czytaj('web/js/rf-06-modals.js') });
await page.addScriptTag({ content: czytaj('web/js/rf-28d-tiers.js') });
await page.evaluate(() => {
  window.rfToast = function (msg, opt) { window._toast = { msg: msg, opt: opt || {} }; return null; };
  const $ = id => document.getElementById(id);
  window._resets = 0;
  $('c1').addEventListener('input', () => { $('c1v').textContent = (+$('c1').value).toFixed(1).replace('.', ',') + '×'; });
  window._s1 = rfTier($('f1'), 'test.wzor', {
    reset: () => { window._resets++; $('c1').value = '1'; $('c1v').textContent = '1,0×'; $('c2').checked = false; $('c3').value = 'a'; }
  });
  window._s2 = rfTier($('f2'), 'test.bezresetu');
  window._s3 = rfTier($('f3'), 'test.dlugi');
  window._s4 = rfTier($('f4'), 'test.adv');
});
const nag = (id) => page.evaluate((i) => {
  const sm = document.querySelector('#' + i + '>summary');
  const s = sm.querySelector('.cardfold-sum'), c = sm.querySelector('.cardfold-chg');
  return { sum: s && !s.hidden ? s.textContent : '', chg: c && !c.hidden ? c.textContent : '', open: document.getElementById(i).open };
}, id);
const klatka = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

// 1. Podsumowanie liczone z kontrolek
let h = await nag('f1');
sprawdz('podsumowanie: etykieta i wartość suwaka (z .vnum)', h.sum.startsWith('Czułość 1,0×'), h);
sprawdz('podsumowanie: przełącznik jako „odwróć: nie” (bez opisu <small>)', h.sum.includes('odwróć: nie'), h);
sprawdz('podsumowanie: lista bez emoji i nawiasu', h.sum.includes('tryb: Alfa') && !h.sum.includes('🎯') && !h.sum.includes('pierwszy'), h);
sprawdz('podsumowanie: segment z aria-label', h.sum.includes('klik: Lewy'), h);
sprawdz('podsumowanie: ukryta kontrolka pominięta', !h.sum.includes('Ukryte'), h);
sprawdz('bez zmian: licznika nie ma', h.chg === '', h);
let r = await page.evaluate(() => { const b = document.querySelector('#f1 .cardfold-reset'); return b ? { dis: b.disabled, tx: b.textContent } : null; });
sprawdz('„Przywróć domyślne” jest w środku i nieczynne bez zmian', r && r.dis === true && r.tx === 'Przywróć domyślne', r);
const dl = await nag('f3');
sprawdz('długie podsumowanie skrócone do ok. 60 znaków', dl.sum.length <= 62 && dl.sum.endsWith('…'), dl);

// 2. Licznik zmian
await page.evaluate(() => { const e = document.getElementById('c1'); e.value = '1.5'; e.dispatchEvent(new Event('input', { bubbles: true })); });
await klatka();
h = await nag('f1');
sprawdz('zmiana suwaka: „zmienione: 1”', h.chg === 'zmienione: 1', h);
sprawdz('zmiana suwaka: podsumowanie nadąża', h.sum.startsWith('Czułość 1,5×'), h);
await page.evaluate(() => { const e = document.getElementById('c2'); e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); });
await page.evaluate(() => { const b = document.querySelector('#c4 button[data-v=r]'); document.querySelector('#c4 .on').classList.remove('on'); b.classList.add('on'); b.click(); });
await klatka();
h = await nag('f1');
sprawdz('przełącznik i segment: „zmienione: 3”', h.chg === 'zmienione: 3', h);
sprawdz('ukryta, zmieniona kontrolka nie liczy się', h.chg === 'zmienione: 3', h);
sprawdz('zwijak ze zmianami NIE otwiera się sam', h.open === false, h);
const kolor = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('#f1 .cardfold-chg')); return [c.backgroundColor, c.color]; });
sprawdz('licznik: musztarda z grafitem', kolor[0] === 'rgb(234, 163, 43)' && kolor[1] === 'rgb(33, 31, 29)', kolor);

// 3. Przywróć domyślne + Cofnij
r = await page.evaluate(() => { const b = document.querySelector('#f1 .cardfold-reset'); const d = b.disabled; b.click(); return d; });
await klatka();
h = await nag('f1');
const t = await page.evaluate(() => window._toast && { msg: window._toast.msg, act: !!(window._toast.opt.action && window._toast.opt.action.onClick) });
sprawdz('reset: przycisk czynny przy zmianach i woła funkcję modułu', r === false && (await page.evaluate(() => window._resets)) === 1, r);
sprawdz('reset: bąbel z „Cofnij”', t && t.act && t.msg === 'Przywrócono domyślne: Wzór', t);
sprawdz('reset: zostaje tylko to, czego moduł nie zeruje (segment)', h.chg === 'zmienione: 1', h);
await page.evaluate(() => window._toast.opt.action.onClick());
await klatka();
h = await nag('f1');
sprawdz('Cofnij: wartości sprzed resetu wracają (zmienione: 3)', h.chg === 'zmienione: 3' && h.sum.startsWith('Czułość 1,5×'), h);

// 4. Bez funkcji modułu nie ma przycisku; piętro 3 to sam nagłówek
r = await page.evaluate(() => !!document.querySelector('#f2 .cardfold-reset'));
sprawdz('bez reset() nie ma „Przywróć domyślne”', r === false);
const adv = await page.evaluate(() => { const d = document.getElementById('f4'), c = getComputedStyle(d), b = getComputedStyle(d, '::before');
  return { cls: d.classList.contains('adv'), sum: !!d.querySelector('summary>.cardfold-sum:not([hidden])'), shadow: c.boxShadow, stitch: b.display }; });
sprawdz('piętro 3: bez podsumowania, bez cienia i ściegu', adv.cls && !adv.sum && adv.shadow === 'none' && adv.stitch === 'none', adv);

// 5. Funkcje modułu: sum() i changed()
await page.evaluate(() => { window._s2b = rfTier(document.getElementById('f2'), 'test.bezresetu', { sum: () => 'Własne zdanie', changed: () => 2 }); });
h = await nag('f2');
sprawdz('sum() i changed() modułu wygrywają z automatem', h.sum === 'Własne zdanie' && h.chg === 'zmienione: 2', h);

// 6. Pamięć i „Rozwijaj wszystkie ustawienia”
await page.evaluate(() => { localStorage.setItem('ribbitflip.fold.test.pamiec', '0'); rfTier.setFoldAll(true); });
const fa = await page.evaluate(() => { const d = document.getElementById('f5'); rfTier(d, 'test.pamiec'); return { open: d.open, all: [...document.querySelectorAll('details.cardfold')].every(x => x.open) }; });
await page.waitForTimeout(50);
const ls = await page.evaluate(() => localStorage.getItem('ribbitflip.fold.test.pamiec'));
sprawdz('preferencja: wszystkie zwijaki otwarte, także nowy', fa.open && fa.all, fa);
sprawdz('preferencja: pamięć zwijaka nienadpisana', ls === '0', ls);
await page.evaluate(() => rfTier.setFoldAll(false));
const off = await page.evaluate(() => ({ f5: document.getElementById('f5').open, ls: localStorage.getItem('ribbitflip.foldAll') }));
sprawdz('wyłączenie preferencji wraca do zapamiętanego układu', off.f5 === false && off.ls === '0', off);

// 7. Angielski: napisy mechanizmu po angielsku
await page.evaluate(() => { window._lang = 'en'; document.documentElement.lang = 'en'; });
await page.waitForTimeout(50);
h = await nag('f1');
const btn = await page.evaluate(() => document.querySelector('#f1 .cardfold-reset').textContent);
sprawdz('EN: „changed: 3” i „Restore defaults”', h.chg === 'changed: 3' && btn === 'Restore defaults', [h, btn]);

const audyt = await page.evaluate(() => rfTier.audit(document.body));
sprawdz('rfTier.audit zwraca zwijaki z licznikami', audyt.folds.length === 5 && audyt.folds[0].changed === 3, audyt.folds[0]);
sprawdz('0 błędów strony', bledy.length === 0, bledy);

await przegladarka.close();
console.log(`${ok} passed, ${zle} failed`);
process.exit(zle ? 1 : 0);
